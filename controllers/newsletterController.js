const Newsletter = require("../models/newsletter");
const { queueConfirmationEmail } = require("../services/emailJobs");
const { isValidUnsubscribeToken } = require("../utils/unsubscribeToken");
const { apiLogger } = require("../utils/logger");

// Every line from this file carries module: "newsletter"
const log = apiLogger.child({ module: "newsletter" });

const EMAIL_REGEX =
  /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

const subscribe = async (req, res) => {
  try {
    const { email } = req.body ?? {}; // no crash when the body is missing

    // Must be a non-empty string
    if (typeof email !== "string" || email.trim() === "") {
      log.info(
        { event: "newsletter.subscribe_rejected", reason: "missing_email" },
        "Subscribe rejected",
      );
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const normalized = email.trim().toLowerCase();

    if (normalized.length > 254 || !EMAIL_REGEX.test(normalized)) {
      log.info(
        { event: "newsletter.subscribe_rejected", reason: "invalid_email" },
        "Subscribe rejected",
      );
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    let subscriber = await Newsletter.findOne({ email: normalized });

    if (subscriber && subscriber.status === "subscribed") {
      // Already confirmed: don't send another email
      log.info(
        {
          event: "newsletter.already_subscribed",
          subscriberId: subscriber._id.toString(),
        },
        "Already subscribed",
      );
      return res.status(200).json({
        success: true,
        message: "You're already subscribed to goVolo updates.",
      });
    }

    // "new", "pending" (an earlier email never went out) or "unsubscribed"
    const previousStatus = subscriber ? subscriber.status : "new";

    if (subscriber) {
      // Either way they aren't subscribed until an email actually goes out
      subscriber.status = "pending";
      await subscriber.save();
    } else {
      subscriber = await Newsletter.create({
        email: normalized,
        status: "pending",
      });
    }

    const subscriberId = subscriber._id.toString();

    log.info(
      { event: "newsletter.subscribe_pending", subscriberId, previousStatus },
      "Subscriber waiting for confirmation email",
    );

    // Best effort: if queueing fails the subscriber simply stays pending,
    // and subscribing again retries
    queueConfirmationEmail(subscriber).catch((err) =>
      log.error(
        {
          event: "email.queue_failed",
          jobName: "newsletter-confirmation",
          subscriberId,
          err,
        },
        "Couldn't queue confirmation email",
      ),
    );

    return res.status(201).json({
      success: true,
      message: "Thanks! Check your inbox for a confirmation email.",
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      log.info(
        { event: "newsletter.subscribe_rejected", reason: "validation" },
        "Subscribe rejected",
      );
      return res.status(400).json({
        success: false,
        message: err.errors.email?.message || err.message,
      });
    }
    if (err.code === 11000) {
      // Two requests raced; the other one already saved it and queued the email.
      // The error isn't logged: it contains the email address.
      log.info(
        { event: "newsletter.subscribe_race" },
        "Duplicate subscribe request handled",
      );
      return res.status(200).json({
        success: true,
        message: "Thanks! Check your inbox for a confirmation email.",
      });
    }

    log.error({ event: "newsletter.subscribe_error", err }, "Subscribe failed");
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { id, token } = req.params;

    // The token is checked before the database is touched, so nobody can
    // use this endpoint to find out whether an id exists
    if (!/^[a-f0-9]{24}$/i.test(id) || !isValidUnsubscribeToken(id, token)) {
      // A warning: a real person rarely gets here, a tampered link does
      log.warn(
        { event: "newsletter.unsubscribe_rejected", reason: "invalid_link" },
        "Unsubscribe link rejected",
      );
      return res.status(400).json({
        success: false,
        message: "This unsubscribe link isn't valid",
      });
    }

    const subscriber = await Newsletter.findById(id).select("status");
    if (!subscriber) {
      log.info(
        {
          event: "newsletter.unsubscribe_rejected",
          reason: "not_found",
          subscriberId: id,
        },
        "Unsubscribe rejected",
      );
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }

    if (subscriber.status === "unsubscribed") {
      log.info(
        { event: "newsletter.already_unsubscribed", subscriberId: id },
        "Already unsubscribed",
      );
      return res
        .status(200)
        .json({ success: true, message: "You're already unsubscribed." });
    }

    // Works for "subscribed" and for "pending" alike
    await Newsletter.updateOne(
      { _id: id },
      { $set: { status: "unsubscribed" } },
    );

    log.info(
      {
        event: "newsletter.unsubscribed",
        subscriberId: id,
        previousStatus: subscriber.status,
      },
      "Subscriber unsubscribed",
    );

    return res.status(200).json({
      success: true,
      message:
        "You've been unsubscribed. You won't receive any more GoVolo emails.",
    });
  } catch (err) {
    log.error(
      { event: "newsletter.unsubscribe_error", err },
      "Unsubscribe failed",
    );
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
};
