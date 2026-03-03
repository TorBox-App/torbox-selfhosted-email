import { Writable } from "node:stream";
import pino from "pino";

type LogData = Record<string, unknown>;

const isDev = process.env.NODE_ENV === "development";
const axiomToken = process.env.AXIOM_TOKEN;
const axiomDataset = process.env.AXIOM_DATASET ?? "wraps";

/**
 * In-process Axiom stream — buffers JSON log lines and sends via fetch().
 * No worker threads, no runtime module resolution. Flushed before Lambda returns.
 */
let axiomBuffer: string[] = [];

const axiomStream = new Writable({
  write(chunk, _enc, cb) {
    axiomBuffer.push(chunk.toString().trimEnd());
    cb();
  },
});

async function flushAxiom() {
  if (axiomBuffer.length === 0 || !axiomToken) return;
  const lines = axiomBuffer;
  axiomBuffer = [];
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {}
  }
  if (events.length === 0) return;
  await fetch(`https://api.axiom.co/v1/datasets/${axiomDataset}/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${axiomToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(events),
  }).catch(() => {});
}

const pinoLogger = pino(
  {
    level: isDev ? "debug" : "info",
    base: { service: "wraps-api" },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  axiomToken && !isDev
    ? pino.multistream([{ stream: process.stdout }, { stream: axiomStream }])
    : undefined
);

export const log = {
  info(msg: string, data?: LogData) {
    pinoLogger.info(data ?? {}, msg);
  },
  warn(msg: string, data?: LogData) {
    pinoLogger.warn(data ?? {}, msg);
  },
  error(msg: string, error?: unknown, data?: LogData) {
    const err =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { error: String(error) };
    pinoLogger.error({ err, ...data }, msg);
  },
};

/** Flush pino buffer + send Axiom batch — call before Lambda handler returns */
export async function flushLogger(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    pinoLogger.flush((err) => (err ? reject(err) : resolve()))
  );
  await flushAxiom();
}
