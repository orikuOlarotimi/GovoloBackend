require("dotenv").config();
const { logger } = require("../utils/logger");

const log = logger.child({ service: "api" });

log.info({ event: "log.test" }, "Logger test");
log.warn({ event: "log.test", userId: "abc123" }, "Warning test");
log.error({ err: new Error("Test error") }, "Error test");
log.info(
  {
    event: "redaction.test",
    password: "hunter2",
    token: "secret-token",
    req: { headers: { authorization: "Bearer abc" } },
  },
  "Redaction test",
);

// Give the background transport a moment to deliver before the process ends
setTimeout(() => process.exit(0), 2000);
