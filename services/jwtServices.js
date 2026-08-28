const jwt = require("jsonwebtoken");

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

const generateRefreshToken = (id, expiresIn = "7d") => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn });
};

module.exports = {
    generateAccessToken,
    generateRefreshToken
}