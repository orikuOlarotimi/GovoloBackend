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
  updateAvatar,
  updateProfile,
} = require("../controllers/authControler");
const upload = require("../config/multer");

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
router.get("/me", protect, getMe)

router.patch("/me", protect, updateProfile);

router.patch(
  "/me/avatar",
  protect,
  upload.single("avatar"),
  (err, req, res, next) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be 2MB or smaller"
            : err.message,
      });
    }
    next();
  },
  updateAvatar,
);


module.exports = router;