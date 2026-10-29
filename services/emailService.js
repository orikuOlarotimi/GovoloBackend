// services/emailService.js
const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;


const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();


const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendOTPEmail = async (email, otp) => {
  const sender = {
    email: process.env.EMAIL_FROM,
    name: "Travel App",
  };

  const receivers = [{ email }];

  try {
    await emailApi.sendTransacEmail({
      sender,
      to: receivers,
      subject: "Verify Your Account",
      htmlContent: `
        <h2>Your OTP is ${otp}</h2>
        <p>This code expires in 5 minutes.</p>
      `,
    });
  } catch (error) {
    console.error("Email error:", error.response?.body || error.message);
    throw new Error("Failed to send OTP email");
  }
};

const sendContactEmail = async ({ name, email, subject, message }) => {
  const sender = {
    email: process.env.EMAIL_FROM,
    name: "Travel App",
  };

  // the email goes to you, not to the customer
  const receivers = [{ email: process.env.CONTACT_RECEIVER_EMAIL }];

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  try {
    await emailApi.sendTransacEmail({
      sender,
      to: receivers,
      // so that hitting "Reply" in your inbox goes to the customer
      replyTo: { email, name },
      subject: subject
        ? `New contact message: ${subject.replace(/[\r\n]+/g, " ")}`
        : `New contact message from ${name.replace(/[\r\n]+/g, " ")}`,
      htmlContent: `
        <h2>New contact message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject || "No subject"}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });
  } catch (error) {
    console.error("Email error:", error.response?.body || error.message);
    throw new Error("Failed to send contact email");
  }
};


module.exports = { sendOTPEmail, sendContactEmail };
