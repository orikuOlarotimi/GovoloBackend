const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name must not exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true,
      maxlength: [254, "Email address is too long"],
    },

    // optional
    subject: {
      type: String,
      trim: true,
      default: "",
      maxlength: [150, "Subject must not exceed 150 characters"],
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [2000, "Message must not exceed 2000 characters"],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Contact", contactSchema);
    