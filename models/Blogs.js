const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    mainImage: {
      type: String,
      required: true,
      trim: true,
    },

    tags: {
      type: [String],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one tag is required",
      },
    },

    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },

    // First entry is the main content; the rest are sub-contents.
    // Table of contents = these titles, in order — not stored separately.
    sections: {
      type: [
        {
          title: { type: String, required: true, trim: true },
          content: { type: String, required: true, trim: true },
          images: {
            type: [
              {
                url: { type: String, required: true },
                caption: { type: String, trim: true },
              },
            ],
            validate: {
              validator: (arr) => arr.length <= 3,
              message: "A section can have at most 3 images",
            },
          },
        },
      ],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one content section is required",
      },
    },

    quickFacts: [{ type: String, trim: true }],

    readTimeMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    visits: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

blogSchema.index({ isPublished: 1, createdAt: -1 });
blogSchema.index({ isPublished: 1, visits: -1, createdAt: -1 });

module.exports = mongoose.model("Blog", blogSchema);
