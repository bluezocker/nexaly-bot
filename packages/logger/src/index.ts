import pino from "pino";

export function createLogger(name: string, level = "info") {
  return pino({
    name,
    level,
    base: { service: name, app: "nexaly" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
