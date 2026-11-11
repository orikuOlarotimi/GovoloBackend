const { Queue } = require("bullmq");
const { connection } = require("../config/redis");

const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts: 3, // retry if sending fails
    backoff: { type: "exponential", delay: 5000 }, // 5s, 10s
    removeOnComplete: true,
    removeOnFail: 100, // keep last 100 failures for debugging
  },
});

module.exports = { emailQueue };
