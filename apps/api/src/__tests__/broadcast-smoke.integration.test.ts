/**
 * Broadcast Smoke Integration Test
 *
 * End-to-end smoke test for the batch-sender pipeline. Seeds contacts with
 * SES mailbox-simulator recipients, enqueues a real SQS job, and polls
 * `batch_send` until the live batch-sender Lambda marks it completed.
 *
 * Runs against REAL SST dev resources:
 *   - Real DB (apps/web/.env.local)
 *   - Real SQS batch queue + DLQ
 *   - Real batch-sender Lambda (running via `pnpm sst:dev`)
 *   - Real SES (sandbox is fine — simulator recipients are always allowed)
 *
 * AUTO-SKIPS unless RUN_BROADCAST_SMOKE=1. This is an explicit opt-in
 * because it requires operator-specific setup (a connected AWS account,
 * a verified SES identity, SST dev running). `pnpm test:integration` stays
 * green without any of that.
 *
 * Prerequisites when running:
 *   1. `pnpm sst:dev` in another terminal
 *   2. A connected `aws_account` row in the dev DB, with a role that can
 *      SES:SendBulkEmail + SES:GetAccount
 *   3. A verified SES sender identity (sandbox is fine — simulator
 *      recipients bypass the "must verify recipient domain" sandbox rule)
 *   4. Env vars:
 *        - RUN_BROADCAST_SMOKE=1          — opt-in flag (required)
 *        - BROADCAST_SMOKE_AWS_ACCOUNT_ID — id of the aws_account row
 *        - BROADCAST_SMOKE_SENDER         — verified SES from: address
 *        - BROADCAST_SMOKE_CONTACT_COUNT  — optional, default 2000 (40 chunks)
 *        - BROADCAST_SMOKE_TIMEOUT_MS     — optional, default 10 min
 *   5. Local AWS credentials (env or AWS_PROFILE) that can assume the role
 *      on the target aws_account
 *
 * Run it:
 *   RUN_BROADCAST_SMOKE=1 \
 *   BROADCAST_SMOKE_AWS_ACCOUNT_ID=<id> \
 *   BROADCAST_SMOKE_SENDER=<verified-identity> \
 *     pnpm --filter @wraps/api test:integration -- \
 *       src/__tests__/broadcast-smoke.integration.test.ts
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { fromEnv, fromIni } from "@aws-sdk/credential-providers";
import { awsAccount, batchSend, contact, db } from "@wraps/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// -----------------------------------------------------------------------------
// SST output loading
// -----------------------------------------------------------------------------

type SstOutputs = {
  apiUrl: string;
  batchQueueUrl: string;
  batchDlqUrl: string;
};

const sstOutputsPath = resolve(process.cwd(), "../../.sst/outputs.json");

function loadSstOutputs(): SstOutputs {
  if (!existsSync(sstOutputsPath)) {
    throw new Error(
      `SST outputs not found at ${sstOutputsPath}. Run "pnpm sst:dev" first.`
    );
  }
  const raw = JSON.parse(readFileSync(sstOutputsPath, "utf-8"));
  if (!raw.batchQueueUrl) {
    throw new Error(
      "batchQueueUrl not found in SST outputs. Is `pnpm sst:dev` running a recent enough build?"
    );
  }
  return raw as SstOutputs;
}

const RUN_SMOKE = process.env.RUN_BROADCAST_SMOKE === "1";

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const CONTACT_COUNT = Number(process.env.BROADCAST_SMOKE_CONTACT_COUNT ?? 2000);
const TIMEOUT_MS = Number(
  process.env.BROADCAST_SMOKE_TIMEOUT_MS ?? 10 * 60_000
);
const POLL_INTERVAL_MS = 5_000;

// SES mailbox simulator mix — plus-addressed so every row is unique at the
// contact table while still landing on the simulator.
const SIMULATOR_MIX: Array<{ address: string; weight: number }> = [
  { address: "success@simulator.amazonses.com", weight: 0.9 },
  { address: "bounce@simulator.amazonses.com", weight: 0.05 },
  { address: "complaint@simulator.amazonses.com", weight: 0.03 },
  { address: "suppressionlist@simulator.amazonses.com", weight: 0.02 },
];

function pickAddress(rng: number): string {
  let acc = 0;
  for (const entry of SIMULATOR_MIX) {
    acc += entry.weight;
    if (rng < acc) {
      return entry.address;
    }
  }
  return SIMULATOR_MIX[0].address;
}

// -----------------------------------------------------------------------------
// SQS client (same creds pattern as events.integration.test.ts)
// -----------------------------------------------------------------------------

const awsProfile = process.env.AWS_PROFILE ?? "default";
const sqs = new SQSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: async () => {
    try {
      return await fromEnv()();
    } catch {
      return await fromIni({ profile: awsProfile })();
    }
  },
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe.skipIf(!RUN_SMOKE)(
  "Broadcast Smoke (SES simulator + SST dev batch-sender)",
  () => {
    let outputs: SstOutputs;
    let awsAccountId: string;
    let organizationId: string;
    let sender: string;
    const seededContactIds: string[] = [];
    let batchId: string | null = null;

    beforeAll(async () => {
      outputs = loadSstOutputs();

      awsAccountId = process.env.BROADCAST_SMOKE_AWS_ACCOUNT_ID ?? "";
      if (!awsAccountId) {
        throw new Error(
          "BROADCAST_SMOKE_AWS_ACCOUNT_ID env var is required — set it to a connected aws_account row id from your dev DB."
        );
      }

      sender = process.env.BROADCAST_SMOKE_SENDER ?? "";
      if (!sender) {
        throw new Error(
          "BROADCAST_SMOKE_SENDER env var is required — set it to a verified SES identity."
        );
      }

      const [account] = await db
        .select()
        .from(awsAccount)
        .where(eq(awsAccount.id, awsAccountId))
        .limit(1);
      if (!account) {
        throw new Error(
          `aws_account row ${awsAccountId} not found. Connect an AWS account in the dashboard first.`
        );
      }
      organizationId = account.organizationId;
    }, 30_000);

    afterAll(async () => {
      if (seededContactIds.length > 0) {
        for (let i = 0; i < seededContactIds.length; i += 500) {
          await db
            .delete(contact)
            .where(inArray(contact.id, seededContactIds.slice(i, i + 500)))
            .catch(() => {
              // best-effort cleanup
            });
        }
      }
      if (batchId) {
        await db
          .delete(batchSend)
          .where(eq(batchSend.id, batchId))
          .catch(() => {
            // best-effort cleanup
          });
      }
    }, 60_000);

    it(
      "completes a multi-chunk email broadcast to SES simulator addresses",
      async () => {
        const tag = `smoke-${Date.now()}`;

        // 1. Seed contacts with simulator addresses (plus-addressed for
        //    uniqueness).
        const rows = Array.from({ length: CONTACT_COUNT }, (_, i) => {
          const base = pickAddress(Math.random());
          const email = base.replace("@", `+${tag}-${i}@`);
          return {
            organizationId,
            email,
            emailHash: createHash("sha256").update(email).digest("hex"),
            emailStatus: "active" as const,
            firstName: "Smoke",
            lastName: `Test-${i}`,
            properties: { smokeTag: tag },
          };
        });

        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const inserted = await db
            .insert(contact)
            .values(rows.slice(i, i + CHUNK))
            .returning({ id: contact.id });
          seededContactIds.push(...inserted.map((row) => row.id));
        }
        expect(seededContactIds.length).toBe(CONTACT_COUNT);

        // 2. Create the batch row directly — bypass the /v1/batch HTTP path
        //    so we don't need an API key in the test fixture. The worker
        //    reads awsAccountId from the DB, not the request.
        const [batch] = await db
          .insert(batchSend)
          .values({
            organizationId,
            awsAccountId,
            channel: "email",
            name: `Broadcast smoke ${tag}`,
            status: "queued",
            subject: `Wraps broadcast smoke test ${tag}`,
            from: sender,
            fromName: "Wraps Smoke",
            htmlContent:
              "<p>Hello {{contactFirstName|there}}, smoke test {{organizationName}}.</p>",
            totalRecipients: CONTACT_COUNT,
          })
          .returning();
        batchId = batch.id;

        // 3. Enqueue chunk 0 directly to the real SQS queue. The SST-dev
        //    Lambda picks it up and starts chunking. Subsequent chunks
        //    self-enqueue via the worker.
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: outputs.batchQueueUrl,
            MessageBody: JSON.stringify({
              batchId: batch.id,
              organizationId,
              awsAccountId,
              channel: "email",
              chunkIndex: 0,
            }),
          })
        );

        // 4. Poll until terminal or timeout.
        const expectedFinalChunkIndex = Math.ceil(CONTACT_COUNT / 50) - 1;
        const start = Date.now();
        let lastLog = start;
        let lastRow = batch;

        while (Date.now() - start < TIMEOUT_MS) {
          const [row] = await db
            .select()
            .from(batchSend)
            .where(eq(batchSend.id, batch.id))
            .limit(1);
          lastRow = row;

          if (Date.now() - lastLog > 10_000) {
            // eslint-disable-next-line no-console
            console.log(
              `[broadcast-smoke] batch=${batch.id} status=${row.status} chunkIndex=${row.lastChunkIndex} processed=${row.processedRecipients}/${row.totalRecipients} sent=${row.sent} failed=${row.failed}`
            );
            lastLog = Date.now();
          }

          if (row.status === "completed" || row.status === "failed") {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        // 5. Assertions — surface the heartbeat in the failure message so
        //    a stalled run is immediately diagnosable.
        const diagnosis = `status=${lastRow.status} lastChunkIndex=${lastRow.lastChunkIndex} lastChunkAt=${lastRow.lastChunkAt?.toISOString() ?? "null"} processed=${lastRow.processedRecipients}/${lastRow.totalRecipients} sent=${lastRow.sent} failed=${lastRow.failed}`;
        expect(lastRow.status, diagnosis).toBe("completed");
        expect(lastRow.processedRecipients, diagnosis).toBe(CONTACT_COUNT);
        expect(lastRow.lastChunkIndex, diagnosis).toBeGreaterThanOrEqual(
          expectedFinalChunkIndex
        );
        expect(lastRow.sent + lastRow.failed, diagnosis).toBe(CONTACT_COUNT);
      },
      TIMEOUT_MS + 60_000
    );
  }
);
