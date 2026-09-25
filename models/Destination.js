const mongoose = require("mongoose");

const destinationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true, // standard room / default price, shown on cards and listings
    },

    mainImage: {
      type: String,
      required: true,
      trim: true,
    },

    images: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 8,
        message: "A destination can have at most 8 gallery images",
      },
    },

    duration: {
      type: String,
      trim: true, // e.g. "5 Days / 4 Nights"
    },

    groupSize: {
      min: { type: Number },
      max: { type: Number },
    },

    tripHighlights: [
      {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
      },
    ],

    included: [{ type: String, trim: true }],

    notIncluded: [{ type: String, trim: true }],

    amenities: [{ type: String, trim: true }],

    itinerary: [
      {
        day: { type: Number, required: true },
        title: { type: String, trim: true, required: true },
        description: { type: String, trim: true },
      },
    ],

    roomTypes: [
      {
        name: { type: String, trim: true, required: true },
        description: { type: String, trim: true },
        price: { type: Number, required: true },
      },
    ],

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
    },

    visits: {
      type: Number,
      default: 0,
    },

    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },

      count: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  { timestamps: true },
);

destinationSchema.index({ "rating.average": -1 });

module.exports = mongoose.model("destination", destinationSchema);
