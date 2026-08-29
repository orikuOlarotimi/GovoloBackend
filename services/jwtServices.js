const jwt = require("jsonwebtoken");
const RESET_TOKEN_EXPIRY_MINUTES = 15;

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

const generateRefreshToken = (id, expiresIn = "7d") => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn });
};

function generateResetToken(user) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    purpose: "password_reset",
  };

  return jwt.sign(payload, process.env.RESET_TOKEN_SECRET, {
    expiresIn: `${RESET_TOKEN_EXPIRY_MINUTES}m`,
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
};