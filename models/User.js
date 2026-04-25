const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String, // optional but useful
    },
    status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
