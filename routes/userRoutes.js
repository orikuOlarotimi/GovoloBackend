const express = require("express");
const protect = require("../midleware/authMiddleware");
const router = express.Router();

const {
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
  getMe,
} = require("../controllers/authControler");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout",  logoutUser);

// OTP
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOtp);

router.post("/verify-reset-otp", verifyResetOTP);
router.post("/resend-reset-otp", resendResetOtp)


// Password recovery
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Token
router.post("/refresh-token", refreshTokenHandler);
router.get("/me", protect, getMe )


module.exports = router;