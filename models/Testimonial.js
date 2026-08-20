const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
      default: "",
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },
  },
  { timestamps: true },
);

// Prevent the same user from rating the same destination more than once
testimonialSchema.index({ user: 1, destination: 1 }, { unique: true });

module.exports = mongoose.model("Testimonial", testimonialSchema);