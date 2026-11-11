const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    status: {
      type: String,
      enum: ["pending", "subscribed", "unsubscribed"], // "pending" is new
      default: "pending", // was "subscribed"
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Newsletter", newsletterSchema);
