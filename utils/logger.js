const pino = require("pino");

const isProd = process.env.NODE_ENV === "production";
const hasAxiom = Boolean(process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET);
const level = process.env.LOG_LEVEL || (isProd ? "info" : "debug");

const targets = [
  isProd
    ? { target: "pino/file", level, options: { destination: 1 } } // JSON to stdout
    : { target: "pino-pretty", level, options: { colorize: true } },
];

// Sent to Axiom whenever the credentials are present, so you can test from
// your own machine. Local lines are tagged env: "development" to filter them out.
if (hasAxiom) {
  targets.push({
    target: "@axiomhq/pino",
    level,
    options: {
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
      ...(process.env.AXIOM_EDGE && { edge: process.env.AXIOM_EDGE }),
    },
  });
}

const logger = pino(
  {
    level,
    base: { env: process.env.NODE_ENV || "development" },
    // These fields are replaced with "[redacted]" before anything is written
    redact: {
      paths: [
        "password",
        "token",
        "accessToken",
        "refreshToken",
        "otp",
        "unsubscribeToken",
        "*.password",
        "*.token",
        "*.accessToken",
        "*.refreshToken",
        "*.otp",
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
      ],
      censor: "[redacted]",
    },
  },
  pino.transport({ targets }),
);

const apiLogger = logger.child({ service: "api" });
const workerLogger = logger.child({ service: "worker" });

module.exports = { logger, apiLogger, workerLogger };
