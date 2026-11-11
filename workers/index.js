require("dotenv").config();
const mongoose = require("mongoose");
const { checkEmailService } = require("../services/emailService");

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Worker: MongoDB connected");

  // Fails now, with a clear error, if the Brevo key is wrong,
  // instead of burning retries on every job
  await checkEmailService();
  console.log("Worker: Brevo connection OK");

  const emailWorker = require("./emailWorker");
  console.log("Worker: listening for email jobs");

  const shutdown = async () => {
    await emailWorker.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
