const mongoose = require("mongoose");

const blogClickSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: true,
      trim: true,
    },

    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
  },
  { timestamps: true },
);

blogClickSchema.index({ visitorId: 1, blog: 1 }, { unique: true });

module.exports = mongoose.model("BlogClick", blogClickSchema);
