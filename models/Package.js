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
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
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

packageSchema.index({
  isPublished: 1,
  "rating.average": -1,
  "rating.count": -1,
  createdAt: -1,
});

module.exports = mongoose.model("Package", packageSchema);
