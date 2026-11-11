const Newsletter = require("../models/newsletter");
const { queueConfirmationEmail } = require("../services/emailJobs");
const { isValidUnsubscribeToken } = require("../utils/unsubscribeToken");

const EMAIL_REGEX =
  /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

const subscribe = async (req, res) => {
  try {
    const { email } = req.body ?? {}; // no crash when the body is missing

    // One check instead of two: must be a non-empty string
    if (typeof email !== "string" || email.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const normalized = email.trim().toLowerCase();

    if (normalized.length > 254 || !EMAIL_REGEX.test(normalized)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    let subscriber = await Newsletter.findOne({ email: normalized });

    if (subscriber && subscriber.status === "subscribed") {
      // Already confirmed: don't send another email
      return res.status(200).json({
        success: true,
        message: "You're already subscribed to goVolo updates.",
      });
    }

    if (subscriber) {
      // "pending": an earlier confirmation email never went out
      // "unsubscribed": coming back
      // Either way they aren't subscribed until an email actually goes out
      subscriber.status = "pending";
      await subscriber.save();
    } else {
      subscriber = await Newsletter.create({
        email: normalized,
        status: "pending",
      });
    }

    // Best effort: if queueing fails the subscriber simply stays pending,
    // and subscribing again retries
    queueConfirmationEmail(subscriber).catch((err) =>
      console.error("Couldn't queue confirmation email:", err),
    );

    return res.status(201).json({
      success: true,
      message: "Thanks! Check your inbox for a confirmation email.",
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: err.errors.email?.message || err.message,
      });
    }
    if (err.code === 11000) {
      // Two requests raced; the other one already saved it and queued the email
      return res.status(200).json({
        success: true,
        message: "Thanks! Check your inbox for a confirmation email.",
      });
    }
    console.error("Subscribe error:", err);
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
      return res.status(400).json({
        success: false,
        message: "This unsubscribe link isn't valid",
      });
    }

    const subscriber = await Newsletter.findById(id).select("status");
    if (!subscriber) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }

    if (subscriber.status === "unsubscribed") {
      return res
        .status(200)
        .json({ success: true, message: "You're already unsubscribed." });
    }

    // Works for "subscribed" and for "pending" alike
    await Newsletter.updateOne(
      { _id: id },
      { $set: { status: "unsubscribed" } },
    );

    return res.status(200).json({
      success: true,
      message:
        "You've been unsubscribed. You won't receive any more GoVolo emails.",
    });
  } catch (err) {
    console.error("Unsubscribe error:", err);
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
