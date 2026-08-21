const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
      trim: true,
    },

    tag: {
      type: String,
      trim: true,
      default: null,
    },

    details: {
      type: String,
      required: true,
    },

    author: {
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
