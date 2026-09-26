const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "destination",
      required: true,
    },

    price: {
      type: Number,
      required: true, // manually set by the admin — the discounted package price
    },

    duration: {
      type: String,
      required: true,
      trim: true, // e.g. "5 Days"
    },

    groupSize: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },

    included: [{ type: String, trim: true }],

    addOns: [
      {
        name: { type: String, trim: true, required: true },
        price: { type: Number, required: true },
        unit: { type: String, trim: true, default: "/night" },
      },
    ],

    isPublished: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Package", packageSchema);
