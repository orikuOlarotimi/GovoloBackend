// workers/index.js
require("dotenv").config();
const { workerLogger: log } = require("../utils/logger");
const { checkEmailService } = require("../services/emailService");

async function startWorker() {
  // DB is already connected by the API in this mode, so no connectDB here
  await checkEmailService();
  log.info({ event: "worker.brevo_ready" }, "Brevo connection OK");

  const emailWorker = require("./emailWorker");
  await emailWorker.waitUntilReady();
  log.info({ event: "worker.ready", queue: "email" }, "Email worker listening");

  return emailWorker; // the caller decides when to close it
}

module.exports = { startWorker };
