import pino from "pino";

// Only use the pino-pretty worker transport in explicit local development.
// In production and in serverless runtimes (where the transport's worker
// thread is not bundled), log plain JSON instead.
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
