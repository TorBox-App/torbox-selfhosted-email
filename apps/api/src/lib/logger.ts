type LogData = Record<string, unknown>;

export const log = {
  info(msg: string, data?: LogData) {
    console.info(JSON.stringify({ level: "info", msg, ...data }));
  },
  warn(msg: string, data?: LogData) {
    console.warn(JSON.stringify({ level: "warn", msg, ...data }));
  },
  error(msg: string, error?: unknown, data?: LogData) {
    console.error(
      JSON.stringify({ level: "error", msg, error: String(error), ...data })
    );
  },
};
