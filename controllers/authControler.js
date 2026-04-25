const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/jwtServices");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { sendOTPEmail } = require("../services/emailService");
const Otp = require("../models/Otp");

const registerUser = async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password?.trim();

    if (!name || name.length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Name is required" });
    }

    if (!email || email.length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Email is required" });
    }

    if (!password || password.length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Password is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 6 characters",
      });
    }

    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid email format" });
    }
    // 2. Check if user exists
    let user = await User.findOne({ email });

    // 🔁 CASE 1: User exists but NOT verified
    if (user && user.status === "pending") {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await Otp.create({
        email,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await sendOTPEmail(email, otp);

      return res.status(200).json({
        success: true,
        status: "pending",
        action: "VERIFY_OTP",
        message: "OTP resent. Please verify your account",
      });
    }

    // ❌ CASE 2: Already verified user
    if (user && user.status === "verified") {
      return res.status(400).json({
        success: true,
        status: "verified",
        action: "LOGIN",
        message: "User already exists. Please login",
      });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const person = await User.create({
      name,
      email,
      password: hashedPassword,
      status: "pending",
    });

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // hash OTP
    const hashedOtp = await bcrypt.hash(rawOtp, 10);
    await Otp.create({
      email,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await sendOTPEmail(email, rawOtp);

    // 6. Send response
    res.status(201).json({
      success: "true",
      status: "pending",
      action: "VERIFY_OTP",
      message: "User created. Please verify your email",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });
    }

    // 2. Find user
    const user = await User.findOne({ email });

    // 3. Generic error if user not found
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.status !== "verified") {
      return res.status(403).json({
        success: false,
        status: user.status,
        action: "VERIFY_OTP",
        message: "Please verify your account first",
      });
    }
    // 4. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(isMatch);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 5. Check account status
    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        status: "pending",
        action: "VERIFY_OTP",
        message: "Please verify your email before logging in",
      });
    }

    // 6. Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    user.refreshToken = hashedRefreshToken;
    await user.save();

    // 7. Response
    return res.status(200).json({
      success: true,
      status: "verified",
      action: "ACCESS_GRANTED",
      message: "Login successful",
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

const logoutUser = async (req, res) => {
  try {
    const userId = req.user?.id; // from auth middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.refreshToken = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid email format" });
    }

    const user = await User.findOne({ email });

    // ❌ Don't reveal too much info
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "If the account exists, an OTP has been sent",
      });
    }

    if (user.status === "verified") {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please login.",
      });
    }

    // Delete old OTPs
    await Otp.deleteMany({ email });

    // Generate new OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(rawOtp, 10);

    await Otp.create({
      email,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOTPEmail(email, rawOtp);

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "Account does not exist",
      });
    }

    await Otp.deleteMany({ email });

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(rawOtp, 10);

    await Otp.create({
      email,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOTPEmail(email, rawOtp);

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();
    const newPassword = req.body.password?.trim();

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword < 6) {
      return res.status(400).json({
        success: false,
        message: "password must be more than 6 characters",
      });
    }

    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    await Otp.deleteMany({ email });

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const refreshTokenHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer")) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    const refreshToken = authHeader.split(" ")[1];

    // 1. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // 2. Find user
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Session not found",
      });
    }
    if (user.status !== "verified") {
      return res.status(403).json({
        success: false,
        message: "Account not active",
      });
    }

    // 3. Compare hashed token
    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // 4. Generate new tokens (ROTATION)
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    user.refreshToken = hashedRefreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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
  registerUser,
  loginUser,
  logoutUser,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  verifyOTP,
};
