// services/emailService.js
const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;


const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

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

module.exports = { sendOTPEmail };
