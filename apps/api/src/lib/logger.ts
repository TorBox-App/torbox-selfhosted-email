import pino from "pino";

type LogData = Record<string, unknown>;

const isDev = process.env.NODE_ENV === "development";

/**
 * Logs to stdout — Axiom ingestion via Vercel Log Drains.
 * pino.transport() is incompatible with bundled Lambda runtimes.
 */
const pinoLogger = pino({
  level: isDev ? "debug" : "info",
  base: { service: "wraps-api" },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

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

/** Flush Axiom transport — call before Lambda handler returns */
export function flushLogger(): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    pinoLogger.flush((err) => (err ? reject(err) : resolve()))
  );
}
