const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/jwtServices");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

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
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    // 2. Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 5. Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // (optional) store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // 6. Send response
    res.status(201).json({
      message: "User registered successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  user,
};
