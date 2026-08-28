const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/jwtServices");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[A-Za-z]+$/;
const { sendOTPEmail } = require("../services/emailService");
const Otp = require("../models/Otp");

const calculateAge = require("../utils/calculateAge")

const registerUser = async (req, res) => {
  try {
    const firstName = req.body?.firstName?.trim();
    const lastName = req.body?.lastName?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const dob = req.body?.dob.trim();
    const city = req.body?.city?.trim();
    const country = req.body?.country?.trim();
    const gender = req.body?.gender.trim().toLowerCase();
    const password = req.body?.password?.trim();

    if (!firstName || firstName.length <= 1 || !nameRegex.test(firstName)) {
      return res.status(400).json({
        status: "error",
        message:
          "First name must be more than 1 letter and contain no numbers or symbols",
      });
    }

    if (!lastName || lastName.length <= 1 || !nameRegex.test(lastName)) {
      return res.status(400).json({
        status: "error",
        message:
          "Last name must be more than 1 letter and contain no numbers or symbols",
      });
    }

    if (!email || !emailRegex.test(email)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid email sequence" });
    }

    if (!city || city.length <= 1 || !nameRegex.test(city)) {
      return res.status(400).json({
        status: "error",
        message:
          "City must be more than 1 letter and contain no numbers or symbols",
      });
    }

    if (!country || country.length <= 1 || !nameRegex.test(country)) {
      return res.status(400).json({
        status: "error",
        message:
          "Country must be more than 1 letter and contain no numbers or symbols",
      });
    }

    if (!dob || isNaN(new Date(dob).getTime())) {
      return res
        .status(400)
        .json({ status: "error", message: "Date of birth is required" });
    }

    if (calculateAge(dob) <= 16) {
      return res.status(400).json({
        status: "error",
        message: "You must be older than 16 to sign up",
      });
    }

    const allowedGenders = ["male", "female", "other", "prefer_not_to_say"];
    if (!gender || !allowedGenders.includes(gender)) {
      return res
        .status(400)
        .json({ status: "error", message: "Please select a valid gender" });
    }

    if (!password || password.length <= 5) {
      return res.status(400).json({
        status: "error",
        message: "Password must be more than 5 characters",
      });
    }

    // 2. Check if user exists
    let user = await User.findOne({ email });

    // CASE 1: User exists but NOT verified
    if (user && user.status === "pending") {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otp, 10);

      await Otp.create({
        email,
        otp: hashedOtp,
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

    // CASE 2: Already verified user
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

    await User.create({
      firstName,
      lastName,
      email,
      dob,
      city,
      country,
      gender,
      password: hashedPassword,
      status: "pending",
    });

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(rawOtp, 10);

    await Otp.create({
      email,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await sendOTPEmail(email, rawOtp);

    res.status(201).json({
      success: true,
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
    const rememberMe = req.body.rememberMe === true; // coerce, don't trust truthy strings

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

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 5. Generate tokens
    const accessToken = generateAccessToken(user._id);

    const refreshTokenExpiry = rememberMe ? "30d" : "7d";
    const refreshToken = generateRefreshToken(user._id, refreshTokenExpiry);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    user.refreshToken = hashedRefreshToken;
    await user.save();

    // 6. Response — raw refreshToken sent directly, no cookie
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

const resendResetOtp = async (req, res) => {
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

    // Pending (unverified) users can't reset a password — they haven't
    // confirmed the email/phone belongs to them yet
    if (user.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Please verify your email before resetting your password",
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
       decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
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
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
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

const verifyResetOTP = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();

    // 1. Validate input presence
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // 2. Validate email format
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    // 3. Validate OTP format (adjust length to match how you generate it)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP format",
      });
    }

    // 4. Find user first — no point checking OTP for an account that doesn't exist
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    // 5. Block pending (unverified) users from resetting password
    if (user.status === "pending") {
      return res.status(400).json({
        success: false,
        status: "pending",
        action: "VERIFY_OTP",
        message: "Please verify your email before resetting your password",
      });
    }

    // 6. Find OTP record (latest one ideally)
    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // 7. Check expiry
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // 8. Check OTP match
    const isMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // 9. Delete OTP(s) — one-time use, don't let it be replayed
    await Otp.deleteMany({ email });

    // 11. Response
    return res.status(200).json({
      success: true,
      status: "otp_verified",
      action: "RESET_PASSWORD",
      message: "OTP verified. You may now reset your password."
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
  resendResetOtp,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  verifyOTP,
  verifyResetOTP,
};
