const express = require("express");
const protect = require("../midleware/authMiddleware");
const router = express.Router();

const {
  registerUser,
  loginUser,
  logoutUser,
  resendOtp,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  verifyOTP,
} = require("../controllers/authControler");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", protect, logoutUser);

// OTP
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOtp);

// Password recovery
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Token
router.post("/refresh-token", refreshTokenHandler);


module.exports = router;
