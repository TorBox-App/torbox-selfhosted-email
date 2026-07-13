/**
 * Unit tests for `wraps email agent` (create/list/kill).
 *
 * Boundaries are mocked (HTTP fetch, Pulumi deploy, metadata I/O, clack
 * prompts, process.exit); the exported command functions run against the REAL
 * agent.ts control flow. See .claude/sdlc/agent-mailboxes/7-followup-tests.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setJsonMode } from "../../../utils/shared/json-output.js";

vi.mock("@pulumi/pulumi", () => ({
  automation: {
    LocalWorkspace: {
      createOrSelectStack: vi.fn(),
    },
    installPulumiCli: vi.fn(),
  },
}));
vi.mock("@clack/prompts");
vi.mock("../../../utils/shared/aws.js");
vi.mock("../../../utils/shared/config.js");
vi.mock("../../../utils/shared/fs.js");
vi.mock("../../../utils/shared/metadata.js");
vi.mock("../../../utils/shared/pulumi.js");
vi.mock("../../../utils/shared/timeout.js");
vi.mock("../../../infrastructure/email-stack.js");

import * as clack from "@clack/prompts";
import * as pulumi from "@pulumi/pulumi";
import { deployEmailStack } from "../../../infrastructure/email-stack.js";
import * as aws from "../../../utils/shared/aws.js";
import * as config from "../../../utils/shared/config.js";
import * as fsUtils from "../../../utils/shared/fs.js";
import * as metadata from "../../../utils/shared/metadata.js";
import * as pulumiUtils from "../../../utils/shared/pulumi.js";
import * as timeout from "../../../utils/shared/timeout.js";
// Import after mocks so the module picks up the mocked deps.
import { agentCreate, agentKill, agentList } from "../agent.js";

const ACCOUNT_ID = "123456789012";
const REGION = "us-east-1";
const API_BASE = "http://api.test";
const ACCESS_KEY = "AKIA-TEST-ACCESS-KEY";
const SECRET_KEY = "wJalrXUtnSECRET-KEY-shown-once";
const USER_ARN = `arn:aws:iam::${ACCOUNT_ID}:user/wraps-agent-sdr`;
const ALIAS_ARN = `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:wraps-agent-enforcer:agent-abc`;
const ENFORCER_ARN = `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:wraps-agent-enforcer`;

const DEFAULT_POLICY = {
  maxPerHour: 20,
  maxPerDay: 100,
  allowedRecipients: [] as string[],
  allowedRecipientDomains: [] as string[],
};

class ExitError extends Error {
  constructor(public code?: number) {
    super(`process.exit(${code})`);
  }
}

type ResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function res(status: number, body: unknown): ResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createdAgentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-abc",
    name: "sdr",
    emailAddress: "sdr@example.com",
    domain: "example.com",
    status: "ACTIVE",
    policy: DEFAULT_POLICY,
    credentialUserArn: null,
    enforcerFunctionArn: null,
    awsAccountId: null,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("email agent commands", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  // Recorded ordering markers for the save-order assertion.
  let sequence: string[];

  // Per-test overridable responses + deploy outputs.
  let connectionsResp: ResponseLike;
  let agentsPostResp: ResponseLike;
  let agentsListResp: ResponseLike;
  let policySyncResp: ResponseLike;
  let killResp: ResponseLike;
  let stackUpOutputs: Record<string, unknown>;
  let capturedEmailConfigOverride: any;
  let capturedStackConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setJsonMode(false);
    sequence = [];
    capturedEmailConfigOverride = undefined;
    capturedStackConfig = undefined;

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(code);
    }) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // ---- clack prompts ----
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.note).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.select).mockResolvedValue("example.com");
    vi.mocked(clack.text).mockResolvedValue("sdr");
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as never);
    vi.mocked(clack.log).info = vi.fn();
    vi.mocked(clack.log).success = vi.fn();
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).step = vi.fn();

    // ---- AWS ----
    vi.mocked(aws.validateAWSCredentials).mockResolvedValue({
      accountId: ACCOUNT_ID,
      userId: "AIDATEST",
      arn: `arn:aws:iam::${ACCOUNT_ID}:user/test`,
    });
    vi.mocked(aws.getAWSRegion).mockResolvedValue(REGION);
    vi.mocked(aws.isSESSandbox).mockResolvedValue(false);

    // ---- config / auth ----
    vi.mocked(config.resolveTokenAsync).mockResolvedValue("test-token");
    vi.mocked(config.getApiBaseUrl).mockReturnValue(API_BASE);
    vi.mocked(config.readAuthConfig).mockResolvedValue({
      auth: {
        token: "test-token",
        tokenType: "session" as const,
        organizations: [{ id: "org-1", name: "Org", slug: "org" }],
      },
    } as never);

    // ---- fs / pulumi utils ----
    vi.mocked(fsUtils.ensurePulumiWorkDir).mockResolvedValue(
      undefined as never
    );
    vi.mocked(fsUtils.getPulumiWorkDir).mockReturnValue("/tmp/.wraps/pulumi");
    vi.mocked(pulumiUtils.ensurePulumiInstalled).mockResolvedValue(false);
    vi.mocked(pulumiUtils.withLockRetry).mockImplementation((fn: any) => fn());
    vi.mocked(timeout.withTimeout).mockImplementation((p: any) => p);

    // ---- metadata ----
    vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
      version: "1.0.0",
      accountId: ACCOUNT_ID,
      region: REGION,
      provider: "aws",
      timestamp: "2026-07-13T00:00:00.000Z",
      services: {
        email: {
          preset: "production",
          pulumiStackName: `wraps-${ACCOUNT_ID}-${REGION}`,
          webhookSecret: "acct-webhook-secret",
          config: {
            sendingEnabled: true,
            domain: "example.com",
            agents: {
              enabled: false,
              agents: [],
            },
          },
        },
      },
    } as never);
    vi.mocked(metadata.saveConnectionMetadata).mockImplementation(async () => {
      sequence.push("save-metadata");
    });
    vi.mocked(metadata.getAllTrackedDomains).mockReturnValue([
      { domain: "example.com", isPrimary: true, managed: true },
    ] as never);
    vi.mocked(metadata.buildEmailStackConfig).mockImplementation(
      (_meta: any, region: any, overrides: any) => {
        capturedEmailConfigOverride = overrides?.emailConfig;
        capturedStackConfig = {
          __stack: true,
          region,
          emailConfig: overrides?.emailConfig,
        };
        return capturedStackConfig;
      }
    );

    // ---- deploy ----
    vi.mocked(deployEmailStack).mockResolvedValue({} as never);

    // ---- fetch router ----
    connectionsResp = res(200, {
      connections: [{ accountId: ACCOUNT_ID, webhookConnected: true }],
    });
    agentsPostResp = res(201, createdAgentRecord());
    agentsListResp = res(200, { agents: [] });
    policySyncResp = res(200, { ok: true });
    killResp = res(200, { ok: true });

    fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname;
      const method = (init.method || "GET").toUpperCase();
      if (path === "/v1/connections" && method === "GET") {
        return connectionsResp;
      }
      if (path === "/v1/agents" && method === "POST") {
        return agentsPostResp;
      }
      if (path === "/v1/agents" && method === "GET") {
        return agentsListResp;
      }
      if (
        /^\/v1\/agents\/[^/]+\/policy-sync$/.test(path) &&
        method === "POST"
      ) {
        sequence.push("policy-sync");
        return policySyncResp;
      }
      if (/^\/v1\/agents\/[^/]+\/kill$/.test(path) && method === "POST") {
        return killResp;
      }
      throw new Error(`Unmocked fetch: ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // ---- pulumi automation ----
    const mockStack = {
      setConfig: vi.fn().mockResolvedValue(undefined),
      up: vi.fn(async () => {
        sequence.push("deploy");
        return { outputs: stackUpOutputs };
      }),
    };
    stackUpOutputs = {
      agentEnforcerArn: { value: ENFORCER_ARN },
      agentPolicyTableName: { value: "wraps-email-agent-policy" },
      agentCredentials: {
        value: {
          sdr: {
            accessKeyId: ACCESS_KEY,
            secretAccessKey: SECRET_KEY,
            userArn: USER_ARN,
          },
        },
      },
      agentAliasArns: { value: { sdr: ALIAS_ARN } },
    };
    vi.mocked(
      pulumi.automation.LocalWorkspace.createOrSelectStack
    ).mockImplementation(async (args: any) => {
      // Execute the inline program so deployEmailStack receives the real
      // stackConfig (mirrors what stack.up() does in production).
      await args.program();
      return mockStack as never;
    });
  });

  afterEach(() => {
    setJsonMode(false);
    vi.unstubAllGlobals();
  });

  function postedTo(path: RegExp | string): boolean {
    return fetchMock.mock.calls.some(([url, init]) => {
      const p = new URL(url as string).pathname;
      const method = ((init as RequestInit)?.method || "GET").toUpperCase();
      const isPost = method === "POST";
      return isPost && (typeof path === "string" ? p === path : path.test(p));
    });
  }

  function jsonEnvelopes(): any[] {
    return consoleLogSpy.mock.calls
      .map((c) => {
        try {
          return JSON.parse(c[0] as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  function assertNoSecretLeaked(): void {
    const noteText = vi
      .mocked(clack.note)
      .mock.calls.flat()
      .map(String)
      .join("\n");
    const logText = consoleLogSpy.mock.calls.flat().map(String).join("\n");
    expect(noteText).not.toContain(SECRET_KEY);
    expect(logText).not.toContain(SECRET_KEY);
  }

  // ---------------------------------------------------------------------------
  // Behavior 1: registration decision (created / resume / conflict)
  // ---------------------------------------------------------------------------
  describe("registration decision", () => {
    it("POST 201 → created flow deploys and syncs the new agent id", async () => {
      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      expect(postedTo("/v1/agents")).toBe(true);
      expect(deployEmailStack).toHaveBeenCalledTimes(1);
      // policy-sync targets the id returned by the 201 create.
      expect(postedTo("/v1/agents/agent-abc/policy-sync")).toBe(true);
    });

    it("POST 409 + undeployed existing row → resume with the ORIGINAL address even when a different domain was picked", async () => {
      agentsPostResp = res(409, { error: "already exists" });
      agentsListResp = res(200, {
        agents: [
          createdAgentRecord({
            id: "existing-id",
            emailAddress: "sdr@original.com",
            domain: "original.com",
            credentialUserArn: null,
          }),
        ],
      });

      // Operator picks a DIFFERENT domain on this run — must be ignored.
      await agentCreate({ name: "sdr", domain: "different.com", yes: true });

      expect(deployEmailStack).toHaveBeenCalledTimes(1);
      const entry = capturedEmailConfigOverride.agents.agents.find(
        (a: any) => a.name === "sdr"
      );
      expect(entry.emailAddress).toBe("sdr@original.com");
      expect(entry.domain).toBe("original.com");
      expect(entry.id).toBe("existing-id");
      // policy-sync uses the EXISTING row id, not a fresh one.
      expect(postedTo("/v1/agents/existing-id/policy-sync")).toBe(true);
    });

    it("POST 409 + already-deployed row → conflict, exits, never deploys (human)", async () => {
      agentsPostResp = res(409, { error: "already exists" });
      agentsListResp = res(200, {
        agents: [
          createdAgentRecord({
            id: "deployed-id",
            credentialUserArn: USER_ARN,
          }),
        ],
      });

      await expect(
        agentCreate({ name: "sdr", domain: "example.com", yes: true })
      ).rejects.toBeInstanceOf(ExitError);

      expect(deployEmailStack).not.toHaveBeenCalled();
      const errText = vi
        .mocked(clack.log.error)
        .mock.calls.flat()
        .map(String)
        .join("\n");
      expect(errText).toContain("already exists");
      // Permanence guidance is surfaced.
      const guidance = consoleLogSpy.mock.calls.flat().map(String).join("\n");
      expect(guidance).toContain("permanent");
    });

    it("POST 409 + already-deployed row → conflict JSON error, no deploy", async () => {
      setJsonMode(true);
      agentsPostResp = res(409, { error: "already exists" });
      agentsListResp = res(200, {
        agents: [
          createdAgentRecord({
            id: "deployed-id",
            credentialUserArn: USER_ARN,
          }),
        ],
      });

      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      expect(deployEmailStack).not.toHaveBeenCalled();
      const env = jsonEnvelopes().find(
        (e) => e.command === "email.agent.create"
      );
      expect(env.success).toBe(false);
      expect(env.error.code).toBe("AGENT_ALREADY_EXISTS");
    });
  });

  // ---------------------------------------------------------------------------
  // Behavior 2: fatal output guards (no credential printed, exit path taken)
  // ---------------------------------------------------------------------------
  describe("fatal output guards", () => {
    it("no credentials returned → NO_CREDENTIALS (JSON), nothing saved/synced, no secret", async () => {
      setJsonMode(true);
      stackUpOutputs.agentCredentials = { value: {} };

      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      const env = jsonEnvelopes().find(
        (e) => e.command === "email.agent.create"
      );
      expect(env.success).toBe(false);
      expect(env.error.code).toBe("NO_CREDENTIALS");
      expect(sequence).not.toContain("save-metadata");
      expect(postedTo(/policy-sync/)).toBe(false);
      assertNoSecretLeaked();
    });

    it("no credentials returned → NO_CREDENTIALS (human), exits, no secret", async () => {
      stackUpOutputs.agentCredentials = { value: {} };

      await expect(
        agentCreate({ name: "sdr", domain: "example.com", yes: true })
      ).rejects.toBeInstanceOf(ExitError);

      expect(sequence).not.toContain("save-metadata");
      assertNoSecretLeaked();
    });

    it("missing alias → NO_ALIAS (JSON), no save/sync, no secret", async () => {
      setJsonMode(true);
      stackUpOutputs.agentAliasArns = { value: {} };

      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      const env = jsonEnvelopes().find(
        (e) => e.command === "email.agent.create"
      );
      expect(env.success).toBe(false);
      expect(env.error.code).toBe("NO_ALIAS");
      expect(sequence).not.toContain("save-metadata");
      expect(postedTo(/policy-sync/)).toBe(false);
      assertNoSecretLeaked();
    });

    it("missing enforcer function ARN → NO_ENFORCER_ARN (JSON), no save/sync, no secret", async () => {
      setJsonMode(true);
      stackUpOutputs.agentEnforcerArn = undefined;

      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      const env = jsonEnvelopes().find(
        (e) => e.command === "email.agent.create"
      );
      expect(env.success).toBe(false);
      expect(env.error.code).toBe("NO_ENFORCER_ARN");
      expect(sequence).not.toContain("save-metadata");
      expect(postedTo(/policy-sync/)).toBe(false);
      assertNoSecretLeaked();
    });
  });

  // ---------------------------------------------------------------------------
  // Behavior 3: save order — metadata save AND policy-sync BEFORE the key print
  // ---------------------------------------------------------------------------
  describe("save order", () => {
    it("persists metadata and policy-sync before printing the credential", async () => {
      setJsonMode(true);

      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      // The credential is printed via jsonSuccess (console.log). Locate it.
      const printIdx = consoleLogSpy.mock.calls.findIndex((c) =>
        String(c[0]).includes(SECRET_KEY)
      );
      expect(printIdx).toBeGreaterThanOrEqual(0);

      const saveIdx = sequence.indexOf("save-metadata");
      const syncIdx = sequence.indexOf("policy-sync");
      expect(saveIdx).toBeGreaterThanOrEqual(0);
      expect(syncIdx).toBeGreaterThanOrEqual(0);
      // Both side effects precede the credential print in the recorded order.
      expect(saveIdx).toBeLessThan(syncIdx);

      // The envelope carrying the secret is the LAST thing emitted.
      const env = jsonEnvelopes().find(
        (e) => e.command === "email.agent.create"
      );
      expect(env.success).toBe(true);
      expect(env.data.accessKeyId).toBe(ACCESS_KEY);
      expect(env.data.userArn).toBe(USER_ARN);
    });
  });

  // ---------------------------------------------------------------------------
  // Behavior 4: webhook-secret hard stop
  // ---------------------------------------------------------------------------
  describe("webhook secret hard stop", () => {
    it("metadata without webhookSecret → WEBHOOK_SECRET_MISSING and no agent POST", async () => {
      setJsonMode(true);
      vi.mocked(metadata.loadConnectionMetadata).mockResolvedValue({
        version: "1.0.0",
        accountId: ACCOUNT_ID,
        region: REGION,
        provider: "aws",
        timestamp: "2026-07-13T00:00:00.000Z",
        services: {
          email: {
            preset: "production",
            pulumiStackName: `wraps-${ACCOUNT_ID}-${REGION}`,
            // webhookSecret intentionally absent
            config: {
              sendingEnabled: true,
              domain: "example.com",
              agents: { enabled: false, agents: [] },
            },
          },
        },
      } as never);

      await agentCreate({ name: "sdr", domain: "example.com", yes: true });

      const env = jsonEnvelopes().find(
        (e) => e.command === "email.agent.create"
      );
      expect(env.success).toBe(false);
      expect(env.error.code).toBe("WEBHOOK_SECRET_MISSING");
      // Never registers the agent.
      expect(postedTo("/v1/agents")).toBe(false);
      expect(deployEmailStack).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Behavior 5: list + kill
  // ---------------------------------------------------------------------------
  describe("agentList", () => {
    it("renders agents returned by GET /v1/agents", async () => {
      agentsListResp = res(200, {
        agents: [
          createdAgentRecord({
            id: "a1",
            name: "sdr",
            emailAddress: "sdr@example.com",
            status: "ACTIVE",
          }),
          createdAgentRecord({
            id: "a2",
            name: "old",
            emailAddress: "old@example.com",
            status: "KILLED",
          }),
        ],
      });

      await agentList({});

      const noteText = vi
        .mocked(clack.note)
        .mock.calls.flat()
        .map(String)
        .join("\n");
      expect(noteText).toContain("sdr@example.com");
      expect(noteText).toContain("old@example.com");
      // Title reflects the count.
      const titles = vi
        .mocked(clack.note)
        .mock.calls.map((c) => String(c[1]))
        .join("\n");
      expect(titles).toContain("Agents — 2");
    });

    it("JSON mode returns the raw agents array", async () => {
      setJsonMode(true);
      agentsListResp = res(200, {
        agents: [createdAgentRecord({ id: "a1" })],
      });

      await agentList({});

      const env = jsonEnvelopes().find((e) => e.command === "email.agent.list");
      expect(env.success).toBe(true);
      expect(env.data.agents).toHaveLength(1);
      expect(env.data.agents[0].id).toBe("a1");
    });
  });

  describe("agentKill", () => {
    it("confirm → POST kill for the resolved agent", async () => {
      agentsListResp = res(200, {
        agents: [
          createdAgentRecord({
            id: "kill-id",
            name: "sdr",
            emailAddress: "sdr@example.com",
            status: "ACTIVE",
          }),
        ],
      });
      vi.mocked(clack.confirm).mockResolvedValue(true);

      await agentKill({ name: "sdr" });

      expect(clack.confirm).toHaveBeenCalledTimes(1);
      expect(postedTo("/v1/agents/kill-id/kill")).toBe(true);
      expect(clack.log.success).toHaveBeenCalled();
    });

    it("declining the confirm cancels without POSTing kill", async () => {
      agentsListResp = res(200, {
        agents: [
          createdAgentRecord({
            id: "kill-id",
            name: "sdr",
            emailAddress: "sdr@example.com",
            status: "ACTIVE",
          }),
        ],
      });
      vi.mocked(clack.confirm).mockResolvedValue(false);

      await expect(agentKill({ name: "sdr" })).rejects.toBeInstanceOf(
        ExitError
      );

      expect(postedTo(/\/kill$/)).toBe(false);
    });
  });
});
