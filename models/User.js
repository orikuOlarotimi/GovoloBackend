const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
    avatar: {
      type: String,
      default:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALkAAACUCAMAAAD4QXiGAAAAY1BMVEX///8AAADf39/39/fa2trv7+/k5OT6+vpNTU3p6en09PTs7Oyvr69ycnKWlpbX19e6urpWVlaLi4s+Pj5cXFwbGxsmJiZhYWHLy8ufn599fX1mZmZGRkYyMjJsbGzDw8MNDQ1NUPHaAAAFC0lEQVR4nO2b2ZaiMBCGZV8EZBcCiu//lNMzVAIqSNEmIedMvssx7fzESm0pTieNRqPRaDQajUaj0Wg0mv8LzwrD0PKOlrEPy23SlnRlWXakTRvXOloQkiAiWWVMVBmJ3KNFIbDzzHjHz+2jhW3gxdWC7n87H6tsM1a0InskUla7HX8UbhixoiYz+BvCDaMfjha5xPBk4WXb2KZp2k17fbL29GiZ76ST8Cob5hZtDeXss+gwhSsMN6btenn79NLV9ONasV23e6rMj5YCvpeyQ1C8P9iRsOgTmysrXOZ4fKnKNkioKrKeYXmELsolKtvAxGliz6eMvXgd3fHw4zorh3VXVXLfARxHFmwsDEq1vLoFBlxtB8imQv04smjAlRPEWnjIuhGuCkML1osyXljbqmDpTonf8tMJDmnmCFaFgbrEtRD0jLtrtVgG2EXcoQshdVTBu8Cha5HLoWyKhWrCUYxSsDVDMy6/CdWEA5RgI7oNTypUEw5IALFHzs1UUe5BKrIV+Snn+/gHx0fRcBRyPyPXO5CnY9eLw/qlcgVC0SikxHYOg25HriCWUUiPPaGmr8oJPT3G7A/rFS83ZZTvDOcpWJdQTTigusxxhuvB8kSwKgwQzgucswj7fcmCSFyoQnFlzmVcXKlwiRFCsligVsOWx8eH0BM7c6guCmy5oUZflHpoRG1hlTvzM8HQ3tV2cUGLbVX6cyak3Ju9CNrfUKedSzd9Q9EFnlAJZz5iUUn+pyssm7bQC4Xu6CAa/Uhf3/UL6/2rEIUYrMF8W/N3Kf1dlDmeIyFr6xvdUnh07+xzRbqhjGCSZiT2s7jQTqYPO2zBKg23m9TVJGrOY+7onZuI1DPhKiQsL5yfrmxv15jkeU7i623+z+XxhfMCDjG2IArUzYuk9Ufdql3iMtw031BOUkUyrSfsdnvU4idSJcqkLECQF9uy/1EQpbxL8kDq/stDmSBqvR3MuvDLH6eYJMmPWyz94vXzKlUi57JfnKFP2tR2ph6G59hpS/znX4UoYO5pP1d0SwZzaT8tc0ieTkJxuIdM5jNQfRp8mLUIhvlDVseWF/M861FuT8ZdrjOjuR+Ye5nlTDfu509n2rPDhgDNKfYUETYjcaLJ3tGta87Y0wDu6gzUEi45eNfdyVR2zh947ST9gF132Y4X+0c+GuZlMum5gMdG4RAu5R2blSF32eE0+XLTJluTnMUM1Lf5v/21J2uTGk3ZSOgXZsp2XWaXMaRG3n/j1Vi3TuI1QAq2gpiW+wSdpHtIuwdwaBTETuOsQV9uKGT1Mqhfyb7+JuobJfkXmK4w6u93yqFtJDmbTo8nD+ukJ0bKWJcJVeWdR7+KzozUMlIvsHJODSs6jSzB0mlS3nH6PqiqJNwzUk/GK/BJu9ullxP8XpaA/CUW3ealgzX8bqngdgw92vNb4JL/wS+r9mop5uLBgeLZLAFn1YmdSQsffM/nX+gZFWvo8L/0PJs8AfhZsW8wQNWe8ywe6cs6Ytt1VxGnKeLtaJcAD8b3h20kjDDCEO5XRdw7NKEQWdTZ4MD4ptNOx99hvQLxjvML8LTrJHJ6JBKTkubio6ig0dREzIbMgc35tuZ/BaIE7i2w37Hz3SEs7ZhTiCxGY6HK75y/ds54Qrm/mArFKO8NmTOO98W889HRLRZC24sX0vs5/9vAc+73oq+lQ3PxjvlbPNNUbKROo9FoNBqNRqPRaDQajea/4w9BPTJYhc4LcwAAAABJRU5ErkJggg==",
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
