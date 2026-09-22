const mongoose = require("mongoose");

const adminRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // the admin who approved/rejected it
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AdminRequest", adminRequestSchema);
