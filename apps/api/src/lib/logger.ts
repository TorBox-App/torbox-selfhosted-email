import pino from "pino";

type LogData = Record<string, unknown>;

const isDev = process.env.NODE_ENV === "development";

function createTransport() {
  const token = process.env.AXIOM_TOKEN;
  if (token && !isDev) {
    return pino.transport({
      targets: [
        { target: "pino/file", options: { destination: 1 } },
        {
          target: "@axiomhq/pino",
          options: {
            dataset: process.env.AXIOM_DATASET ?? "wraps",
            token,
          },
        },
      ],
    });
  }
}

const pinoLogger = pino(
  {
    level: isDev ? "debug" : "info",
    base: { service: "wraps-api" },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  createTransport()
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

/** Flush Axiom transport — call before Lambda handler returns */
export function flushLogger(): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    pinoLogger.flush((err) => (err ? reject(err) : resolve()))
  );
}
