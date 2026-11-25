require("dotenv").config();
const mongoose = require("mongoose");
const { workerLogger: log } = require("../utils/logger");
const connectDB = require("../config/db");
const { checkEmailService } = require("../services/emailService");

const REQUIRED_ENV = [
  "MONGO_URI",
  "BREVO_API_KEY",
  "EMAIL_FROM",
  "APP_URL",
  "UNSUBSCRIBE_SECRET",
];

// A crash that nobody catches would otherwise leave no trace in Axiom
process.on("unhandledRejection", (reason) =>
  log.error(
    { event: "process.unhandled_rejection", err: reason },
    "Unhandled promise rejection",
  ),
);
process.on("uncaughtException", (err) => {
  log.fatal({ event: "process.uncaught_exception", err }, "Uncaught exception");
  setTimeout(() => process.exit(1), 1000); // let the line reach Axiom
});

async function start() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  await connectDB(log); // logs db.connected, and exits by itself on failure

  // Fails now, with a clear error, if the Brevo key is wrong,
  // instead of burning retries on every job
  await checkEmailService();
  log.info({ event: "worker.brevo_ready" }, "Brevo connection OK");

  const emailWorker = require("./emailWorker");
  await emailWorker.waitUntilReady();
  log.info({ event: "worker.ready", queue: "email" }, "Email worker listening");

  const shutdown = async (signal) => {
    log.info({ event: "worker.stopping", signal }, "Worker stopping");
    await emailWorker.close();
    await mongoose.disconnect();
    setTimeout(() => process.exit(0), 500); // let the last line reach Axiom
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  log.fatal({ event: "worker.start_failed", err }, "Worker failed to start");
  // Plain console as a fallback, in case the logger itself is the problem
  console.error("Worker failed to start:", err.message);
  setTimeout(() => process.exit(1), 1000);
});
