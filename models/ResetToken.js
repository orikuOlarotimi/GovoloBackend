const mongoose = require("mongoose");

const resetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL — Mongo auto-deletes once this time passes
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ResetToken", resetTokenSchema);
