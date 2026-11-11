const { Worker, UnrecoverableError } = require("bullmq");
const { connection } = require("../config/redis");
const Newsletter = require("../models/newsletter");
const { sendEmail } = require("../services/emailService");
const { buildUnsubscribeUrl } = require("../utils/unsubscribeToken");
const newsletterConfirmation = require("../emails/newsletterConfirmation");
const { isValidUnsubscribeToken } = require("../utils/unsubscribeToken");

// One handler per job name. These names must match services/emailJobs.js.
const handlers = {
  "newsletter-confirmation": async (job) => {
    const { subscriberId } = job.data;

    const subscriber = await Newsletter.findById(subscriberId)
      .select("email status")
      .lean();

    // Only a pending subscriber needs this email. If they're already
    // confirmed, unsubscribed in the meantime, or deleted: nothing to do
    if (!subscriber || subscriber.status !== "pending") {
      return { skipped: true };
    }

    const { subject, text, html } = newsletterConfirmation({
      unsubscribeUrl: buildUnsubscribeUrl(subscriberId),
    });

    await sendEmail({ to: subscriber.email, subject, text, html });

    // Only now, after Brevo accepted the email, do they count as subscribed.
    // The status filter means someone who unsubscribed in the meantime
    // isn't switched back on.
    await Newsletter.updateOne(
      { _id: subscriberId, status: "pending" },
      { $set: { status: "subscribed" } },
    );

    return { sent: true };
  },
};

const emailWorker = new Worker(
  "email",
  async (job) => {
    const handler = handlers[job.name];
    if (!handler) {
      // retrying can't fix a missing handler, so fail straight away
      throw new UnrecoverableError(`No handler for email job "${job.name}"`);
    }
    return handler(job);
  },
  { connection, concurrency: 5 },
);

emailWorker.on("completed", (job, result) =>
  console.log(`[email] ${job.name} #${job.id} done`, result),
);

emailWorker.on("failed", (job, err) =>
  console.error(
    `[email] ${job?.name} #${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`,
  ),
);

emailWorker.on("error", (err) =>
  console.error("[email] worker error:", err.message),
);

module.exports = emailWorker;
