const { Worker, UnrecoverableError } = require("bullmq");
const { connection } = require("../config/redis");
const Newsletter = require("../models/newsletter");
const { sendEmail } = require("../services/emailService");
const { buildUnsubscribeUrl } = require("../utils/unsubscribeToken");
const newsletterConfirmation = require("../emails/newsletterConfirmation");
const { workerLogger } = require("../utils/logger");

// One handler per job name. These names must match services/emailJobs.js.
const handlers = {
  "newsletter-confirmation": async (job, log) => {
    const { subscriberId } = job.data;

    const subscriber = await Newsletter.findById(subscriberId)
      .select("email status")
      .lean();

    // Only a pending subscriber needs this email. If they're already
    // confirmed, unsubscribed in the meantime, or deleted: nothing to do
    if (!subscriber || subscriber.status !== "pending") {
      log.info(
        {
          event: "email.skipped",
          subscriberId,
          reason: subscriber ? `status_${subscriber.status}` : "not_found",
        },
        "Confirmation email skipped",
      );
      return { skipped: true };
    }

    const { subject, text, html } = newsletterConfirmation({
      unsubscribeUrl: buildUnsubscribeUrl(subscriberId),
    });

    const startedAt = Date.now();
    await sendEmail({ to: subscriber.email, subject, text, html });
    log.info(
      {
        event: "email.sent",
        template: "newsletter-confirmation",
        subscriberId,
        durationMs: Date.now() - startedAt,
      },
      "Confirmation email sent",
    );

    // Only now, after Brevo accepted the email, do they count as subscribed.
    // The status filter means someone who unsubscribed in the meantime
    // isn't switched back on.
    await Newsletter.updateOne(
      { _id: subscriberId, status: "pending" },
      { $set: { status: "subscribed" } },
    );
    log.info(
      { event: "newsletter.subscribed", subscriberId },
      "Subscriber confirmed",
    );

    return { sent: true };
  },
};

const emailWorker = new Worker(
  "email",
  async (job) => {
    // Every line logged during this job carries its id and name
    const log = workerLogger.child({ jobId: job.id, jobName: job.name });

    const handler = handlers[job.name];
    if (!handler) {
      // retrying can't fix a missing handler, so fail straight away
      throw new UnrecoverableError(`No handler for email job "${job.name}"`);
    }
    return handler(job, log);
  },
  { connection, concurrency: 5 },
);

emailWorker.on("failed", (job, err) => {
  const attempts = job?.opts?.attempts ?? 1;
  const attemptsMade = job?.attemptsMade ?? 0;
  const willRetry =
    attemptsMade < attempts && !(err instanceof UnrecoverableError);

  // A failure that will be retried is a warning. Only the last one is an error.
  workerLogger[willRetry ? "warn" : "error"](
    {
      event: "email.job_failed",
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade,
      attempts,
      willRetry,
      err,
    },
    willRetry ? "Email job failed, will retry" : "Email job failed permanently",
  );
});

emailWorker.on("error", (err) =>
  workerLogger.error(
    { event: "worker.error", queue: "email", err },
    "Email worker error",
  ),
);

module.exports = emailWorker;
