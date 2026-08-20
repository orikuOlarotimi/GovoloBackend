const Testimonial = require("../models/Testimonial")
const Destination = require("../models/Destination");

const getAllTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({})
      .sort({ createdAt: -1 }) // most recent testimonials first
      .limit(4)
      .populate("user", "name") 
      .populate("destination", "title location mainImage");

    res.status(200).json({
      success: true,
      count: testimonials.length,
      testimonials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching testimonials",
    });
  }
};

const createTestimonial = async (req, res) => {
  try {
    const { destinationId, rating, comment } = req.body;
    const userId = req.user?._id;

    const errors = [];

    // --- Auth check ---
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to leave a rating",
      });
    }

    // --- Only verified users can leave testimonials ---
    if (req.user.status !== "verified") {
      return res.status(403).json({
        success: false,
        message: "Only verified users can leave a rating",
      });
    }

    // --- destinationId ---
    if (!destinationId || typeof destinationId !== "string") {
      errors.push("A valid destination is required");
    }

    // --- rating ---
    let numericRating;
    if (rating === undefined || rating === null || rating === "") {
      errors.push("Rating is required");
    } else {
      numericRating = Number(rating);
      if (Number.isNaN(numericRating) || !Number.isInteger(numericRating)) {
        errors.push("Rating must be a whole number");
      } else if (numericRating < 1 || numericRating > 5) {
        errors.push("Rating must be between 1 and 5");
      }
    }

    // --- comment (optional) ---
    if (comment !== undefined && typeof comment !== "string") {
      errors.push("Comment must be a string");
    } else if (comment && comment.trim().length > 500) {
      errors.push("Comment cannot exceed 500 characters");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // --- Confirm destination actually exists ---
    const destination = await Destination.findById(destinationId);
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: "Destination not found",
      });
    }

    // --- Upsert: create if none exists, update if it does ---
    const existingTestimonial = await Testimonial.findOne({
      user: userId,
      destination: destinationId,
    });

    let testimonial;
    let statusCode;

    if (existingTestimonial) {
      existingTestimonial.rating = numericRating;
      existingTestimonial.comment = comment ? comment.trim() : "";
      testimonial = await existingTestimonial.save();
      statusCode = 200;
    } else {
      testimonial = await Testimonial.create({
        user: userId,
        destination: destinationId,
        rating: numericRating,
        comment: comment ? comment.trim() : "",
      });
      statusCode = 201;
    }

    // --- Recalculate destination's rating.average and rating.count ---
    const stats = await Testimonial.aggregate([
      { $match: { destination: destination._id } },
      {
        $group: {
          _id: "$destination",
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    const newAverage = stats.length > 0 ? stats[0].average : 0;
    const newCount = stats.length > 0 ? stats[0].count : 0;

    destination.rating.average = Math.round(newAverage * 10) / 10; // round to 1 decimal
    destination.rating.count = newCount;
    await destination.save();

    const populatedTestimonial = await testimonial.populate([
      { path: "user", select: "name" },
      { path: "destination", select: "title location mainImage" },
    ]);

    res.status(statusCode).json({
      success: true,
      message: existingTestimonial ? "Rating updated" : "Rating submitted",
      testimonial: populatedTestimonial,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid destination ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Something went wrong while submitting the rating",
    });
  }
};

module.exports = { getAllTestimonials, createTestimonial };
