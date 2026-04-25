// controllers/otpController.js

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Otp = require("../models/Otp");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/jwtServices");

const verifyOTP = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();

    // 1. Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // 2. Find OTP record (latest one ideally)
    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // 3. Check expiry
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 4. Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 5. Check if already verified
    if (user.status === "verified") {
      return res.status(400).json({
        success: false,
        status: "verified",
        action: "LOGIN",
        message: "User already verified. Please login.",
      });
    }
    // 6. Update user status
    user.status = "verified";

    // 7. Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    user.refreshToken = hashedRefreshToken;

    await user.save();

    // 8. Delete OTP(s)
    await Otp.deleteMany({ email });

    // 9. Response
    return res.status(200).json({
      success: true,
      status: "verified",
      action: "ACCESS_GRANTED",
      message: "Account verified successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  verifyOTP,
};
