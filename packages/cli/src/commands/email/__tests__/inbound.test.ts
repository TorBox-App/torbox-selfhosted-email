import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInboundDNSRecords } from "../../../utils/dns/create-records.js";
import { setJsonMode } from "../../../utils/shared/json-output.js";

// Mock clack
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  log: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
  },
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
}));

// Mock AWS credentials so the command never touches real STS
vi.mock("../../../utils/shared/aws.js", () => ({
  getAWSRegion: vi.fn().mockResolvedValue("us-east-1"),
  validateAWSCredentials: vi.fn().mockResolvedValue({
    accountId: "123456789012",
    userId: "AIDATEST",
    arn: "arn:aws:iam::123456789012:user/test",
  }),
}));

// Mock metadata load/save; keep the real mutators (addInboundDomainToMetadata etc.)
vi.mock("../../../utils/shared/metadata.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../utils/shared/metadata.js")>();
  return {
    ...actual,
    loadConnectionMetadata: vi.fn(),
    saveConnectionMetadata: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock receipt rule helpers so the command never touches real SES
vi.mock("../../../utils/email/receipt-rules.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../utils/email/receipt-rules.js")
    >();
  return {
    ...actual,
    addDomainToReceiptRule: vi.fn().mockResolvedValue(undefined),
    removeDomainFromReceiptRule: vi.fn().mockResolvedValue(undefined),
    getReceiptRuleDomains: vi.fn().mockResolvedValue([]),
  };
});

// Mock DNS detection/creation so the command doesn't touch the network
vi.mock("../../../utils/dns/index.js", () => ({
  detectAvailableDNSProviders: vi
    .fn()
    .mockResolvedValue([{ provider: "manual", detected: true }]),
  getDNSCredentials: vi.fn().mockResolvedValue({
    valid: true,
    credentials: { provider: "manual" },
  }),
  createInboundDNSRecordsForProvider: vi
    .fn()
    .mockResolvedValue({ success: true, recordsCreated: 0 }),
  deleteInboundDNSRecordsForProvider: vi.fn().mockResolvedValue({
    deleted: [],
    skipped: [],
    supported: true,
    errors: [],
  }),
  buildInboundDNSRecords: vi.fn().mockReturnValue([]),
  formatManualDNSInstructions: vi.fn().mockReturnValue(""),
  getDNSProviderDisplayName: vi.fn().mockReturnValue("Manual"),
}));

import { inboundAdd, inboundRemove } from "../inbound.js";

const baseMetadata = {
  version: "1.0.0",
  accountId: "123456789012",
  region: "us-east-1",
  provider: "other" as const,
  timestamp: "2024-01-01T00:00:00.000Z",
  services: {
    email: {
      config: {
        domain: "example.com",
        inbound: {
          enabled: true,
          subdomain: "in",
          receivingDomain: "in.example.com",
          bucketName: "wraps-inbound-123456789012-us-east-1",
        },
        inboundDomains: [
          {
            subdomain: "in",
            receivingDomain: "in.example.com",
            parentDomain: "example.com",
            addedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        additionalDomains: [],
      },
      preset: "starter" as const,
      deployedAt: "2024-01-01T00:00:00.000Z",
      pulumiStackName: "wraps-123456789012-us-east-1",
    },
  },
};

function cloneMetadata(
  overrides?: (m: typeof baseMetadata) => void
): typeof baseMetadata {
  const copy = JSON.parse(JSON.stringify(baseMetadata)) as typeof baseMetadata;
  overrides?.(copy);
  return copy;
}

// A handful of tests below need `createInboundDNSRecordsForProvider` to
// actually be invoked so the receivingDomain argument can be inspected. That
// call only happens when the account already has a non-"manual" DNS provider
// on file — otherwise `--yes` short-circuits provider selection to "manual"
// and the command falls back to printing manual instructions instead.
function cloneMetadataWithDnsProvider(): typeof baseMetadata {
  return cloneMetadata((m) => {
    (m.services.email as { dnsProvider?: string }).dnsProvider = "cloudflare";
  });
}

describe("inboundAdd smoke test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJsonMode(false);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  it("resolves without throwing for a basic add", async () => {
    const { loadConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockResolvedValue(cloneMetadata());

    await expect(
      inboundAdd({
        subdomain: "support",
        domain: "example.com",
        yes: true,
        json: true,
      })
    ).resolves.toBeUndefined();
  });
});

describe("inboundAdd receiving domain resolution", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setJsonMode(false);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const { loadConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockImplementation(async () =>
      cloneMetadataWithDnsProvider()
    );
  });

  it("uses the given --subdomain", async () => {
    const { createInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    await inboundAdd({
      subdomain: "support",
      domain: "example.com",
      yes: true,
    });

    expect(vi.mocked(createInboundDNSRecordsForProvider)).toHaveBeenCalledWith(
      expect.anything(),
      "support.example.com",
      "us-east-1",
      "example.com"
    );
  });

  it("defaults to 'inbound' with --yes and no --subdomain", async () => {
    const { createInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    await inboundAdd({ domain: "example.com", yes: true });

    expect(vi.mocked(createInboundDNSRecordsForProvider)).toHaveBeenCalledWith(
      expect.anything(),
      "inbound.example.com",
      "us-east-1",
      "example.com"
    );
  });

  it("uses the parent domain itself when --root is passed", async () => {
    const { createInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    await inboundAdd({ root: true, domain: "example.com", yes: true });

    expect(vi.mocked(createInboundDNSRecordsForProvider)).toHaveBeenCalledWith(
      expect.anything(),
      "example.com",
      "us-east-1",
      "example.com"
    );
  });

  // NOTE: characterization only — `root` silently overrides `subdomain` today.
  // Plan 311 makes this combination an error. Update this test when it lands.
  it("--root silently overrides --subdomain when both are passed", async () => {
    const { createInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    await inboundAdd({
      subdomain: "support",
      root: true,
      domain: "example.com",
      yes: true,
    });

    expect(vi.mocked(createInboundDNSRecordsForProvider)).toHaveBeenCalledWith(
      expect.anything(),
      "example.com",
      "us-east-1",
      "example.com"
    );
  });
});

describe("inboundAdd apex domain reachability", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setJsonMode(false);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const { loadConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    vi.mocked(loadConnectionMetadata).mockImplementation(async () =>
      cloneMetadataWithDnsProvider()
    );
  });

  // NOTE: characterization only — there is no preflight check for pre-existing
  // MX/SPF on the target domain today. Plan 308 adds one. This test asserts the
  // call happens; plan 308 changes it to assert the call is REFUSED.
  it("writes DNS records straight to the apex with no guard", async () => {
    const { createInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    await inboundAdd({ root: true, domain: "example.com", yes: true });

    expect(vi.mocked(createInboundDNSRecordsForProvider)).toHaveBeenCalledWith(
      expect.anything(),
      "example.com",
      expect.anything(),
      expect.anything()
    );
  });
});

describe("buildInboundDNSRecords", () => {
  it("returns exactly the inbound MX and SPF records for the receiving domain", () => {
    const records = buildInboundDNSRecords("support.example.com", "us-east-1");

    expect(records).toHaveLength(2);
    expect(records).toContainEqual({
      name: "support.example.com",
      type: "MX",
      value: "inbound-smtp.us-east-1.amazonaws.com",
      priority: 10,
      category: "inbound_mx",
    });
    expect(records).toContainEqual({
      name: "support.example.com",
      type: "TXT",
      value: "v=spf1 include:amazonses.com ~all",
      category: "inbound_spf",
    });
  });
});

describe("inboundRemove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJsonMode(false);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  // Sets a non-"manual" dnsProvider, mirroring cloneMetadataWithDnsProvider
  // above: DNS cleanup only runs (and only calls
  // deleteInboundDNSRecordsForProvider) when the account has a DNS provider
  // on file — otherwise it's treated as manual and skipped.
  function twoDomainMetadata(): typeof baseMetadata {
    return cloneMetadata((m) => {
      m.services.email.config.inboundDomains = [
        {
          subdomain: "in",
          receivingDomain: "in.example.com",
          parentDomain: "example.com",
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          subdomain: "support",
          receivingDomain: "support.example.com",
          parentDomain: "example.com",
          addedAt: "2024-01-02T00:00:00.000Z",
        },
      ];
      (m.services.email as { dnsProvider?: string }).dnsProvider = "cloudflare";
    });
  }

  it("calls removeDomainFromReceiptRule and saves metadata without the removed domain", async () => {
    const { loadConnectionMetadata, saveConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    const { removeDomainFromReceiptRule } = await import(
      "../../../utils/email/receipt-rules.js"
    );

    vi.mocked(loadConnectionMetadata).mockResolvedValue(twoDomainMetadata());

    await inboundRemove({ domain: "support.example.com", yes: true });

    expect(vi.mocked(removeDomainFromReceiptRule)).toHaveBeenCalledWith(
      "us-east-1",
      "support.example.com"
    );

    expect(vi.mocked(saveConnectionMetadata)).toHaveBeenCalled();
    const saved = vi.mocked(saveConnectionMetadata).mock.calls.at(-1)?.[0] as
      | typeof baseMetadata
      | undefined;
    expect(
      saved?.services.email?.config.inboundDomains?.map(
        (d) => d.receivingDomain
      )
    ).toEqual(["in.example.com"]);
  });

  it("deletes the DNS records inbound add created, via the resolved credentials", async () => {
    const { loadConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    const { getDNSCredentials, deleteInboundDNSRecordsForProvider } =
      await import("../../../utils/dns/index.js");

    vi.mocked(loadConnectionMetadata).mockResolvedValue(twoDomainMetadata());

    await inboundRemove({ domain: "support.example.com", yes: true });

    const resolvedCredentials =
      await vi.mocked(getDNSCredentials).mock.results[0]?.value;

    expect(vi.mocked(deleteInboundDNSRecordsForProvider)).toHaveBeenCalledWith(
      resolvedCredentials.credentials,
      "support.example.com",
      "us-east-1",
      "example.com"
    );
  });

  it("still saves metadata without the removed domain when DNS cleanup rejects", async () => {
    const { loadConnectionMetadata, saveConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    const { deleteInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    vi.mocked(loadConnectionMetadata).mockResolvedValue(twoDomainMetadata());
    vi.mocked(deleteInboundDNSRecordsForProvider).mockRejectedValueOnce(
      new Error("boom")
    );

    await inboundRemove({ domain: "support.example.com", yes: true });

    expect(vi.mocked(saveConnectionMetadata)).toHaveBeenCalled();
    const saved = vi.mocked(saveConnectionMetadata).mock.calls.at(-1)?.[0] as
      | typeof baseMetadata
      | undefined;
    expect(
      saved?.services.email?.config.inboundDomains?.map(
        (d) => d.receivingDomain
      )
    ).toEqual(["in.example.com"]);
  });

  it("never calls DNS cleanup and keeps the manual reminder when no dnsProvider is on file", async () => {
    const { loadConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    const { deleteInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    // Same two-domain shape as twoDomainMetadata(), but without the
    // dnsProvider override — this is what an account with no DNS provider
    // on file looks like.
    const metadata = cloneMetadata((m) => {
      m.services.email.config.inboundDomains = [
        {
          subdomain: "in",
          receivingDomain: "in.example.com",
          parentDomain: "example.com",
          addedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          subdomain: "support",
          receivingDomain: "support.example.com",
          parentDomain: "example.com",
          addedAt: "2024-01-02T00:00:00.000Z",
        },
      ];
    });
    vi.mocked(loadConnectionMetadata).mockResolvedValue(metadata);

    await inboundRemove({ domain: "support.example.com", yes: true });

    expect(
      vi.mocked(deleteInboundDNSRecordsForProvider)
    ).not.toHaveBeenCalled();

    const printedReminder = vi
      .mocked(console.log)
      .mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("Remember to remove the MX and SPF DNS records")
      );
    expect(printedReminder).toBe(true);
  });

  it("includes dnsDeleted in the --json payload", async () => {
    const { loadConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    const { deleteInboundDNSRecordsForProvider } = await import(
      "../../../utils/dns/index.js"
    );

    vi.mocked(loadConnectionMetadata).mockResolvedValue(twoDomainMetadata());
    vi.mocked(deleteInboundDNSRecordsForProvider).mockResolvedValueOnce({
      deleted: ["MX support.example.com"],
      skipped: [],
      supported: true,
      errors: [],
    });

    setJsonMode(true);
    await inboundRemove({ domain: "support.example.com", yes: true });
    setJsonMode(false);

    const jsonCall = vi
      .mocked(console.log)
      .mock.calls.map((call) => call[0])
      .find(
        (arg) => typeof arg === "string" && arg.includes("email.inbound.remove")
      );

    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall as string);
    expect(parsed.data.dnsDeleted).toEqual(["MX support.example.com"]);
  });

  it("refuses to remove the last remaining domain", async () => {
    const { loadConnectionMetadata, saveConnectionMetadata } = await import(
      "../../../utils/shared/metadata.js"
    );
    const { removeDomainFromReceiptRule } = await import(
      "../../../utils/email/receipt-rules.js"
    );

    // baseMetadata carries a single inboundDomains entry: in.example.com
    vi.mocked(loadConnectionMetadata).mockResolvedValue(cloneMetadata());

    await inboundRemove({ domain: "in.example.com", yes: true });

    expect(vi.mocked(removeDomainFromReceiptRule)).not.toHaveBeenCalled();
    expect(vi.mocked(saveConnectionMetadata)).not.toHaveBeenCalled();

    const clack = await import("@clack/prompts");
    expect(vi.mocked(clack.log.error)).toHaveBeenCalledWith(
      expect.stringContaining("Cannot remove the last inbound domain")
    );
  });
});
