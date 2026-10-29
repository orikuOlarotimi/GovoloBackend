const Contact = require("../models/Contact");
const { sendContactEmail } = require("../services/emailService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createContact = async (req, res) => {
  try {
    const fail = (message) => res.status(400).json({ success: false, message });

    const { name, email, subject, message } = req.body;

    // ---- Required fields ----
    if (name == null || String(name).trim() === "") {
      return fail("Name is required");
    }
    if (email == null || String(email).trim() === "") {
      return fail("Email address is required");
    }
    if (message == null || String(message).trim() === "") {
      return fail("Message is required");
    }

    // ---- Type checks (stops objects or arrays being sent as values) ----
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string"
    ) {
      return fail("Name, email and message must be text");
    }
    if (subject != null && typeof subject !== "string") {
      return fail("Subject must be text");
    }

    // ---- Trim and clean ----
    const contactName = name.trim();
    const contactEmail = email.trim().toLowerCase();
    const contactSubject = subject == null ? "" : subject.trim();
    const contactMessage = message.trim();

    // ---- Validate ----
    if (contactName.length < 2 || contactName.length > 100) {
      return fail("Name must be between 2 and 100 characters");
    }
    if (contactEmail.length > 254 || !EMAIL_REGEX.test(contactEmail)) {
      return fail("Invalid email address");
    }
    if (contactSubject.length > 150) {
      return fail("Subject must not exceed 150 characters");
    }
    if (contactMessage.length < 10 || contactMessage.length > 2000) {
      return fail("Message must be between 10 and 2000 characters");
    }

    // ---- Save first so the message is never lost ----
    const contact = await Contact.create({
      name: contactName,
      email: contactEmail,
      subject: contactSubject,
      message: contactMessage,
    });

    // ---- Then try to email you ----
    try {
      await sendContactEmail({
        name: contactName,
        email: contactEmail,
        subject: contactSubject,
        message: contactMessage,
      });
    } catch (emailError) {
      // already saved, so we log it and still tell the customer it worked
      return res.status(502).json({
        success: false,
        message: emailError.message, // "Failed to send contact email"
        saved: true,
      });
    }
    return res.status(201).json({
      success: true,
      message: "Your message has been sent. We'll get back to you soon.",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.log(error)
    return res
      .status(500)
      .json({ success: false, message: "Failed to send your message" });
  }
};

module.exports = { createContact };
