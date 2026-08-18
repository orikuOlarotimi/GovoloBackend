const Booking = require("../models/Bookings");

const getAllBookings = async (req, res) => {
  try {
    // 1. Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 2. Query — only available bookings, highest rated first
    const bookings = await Booking.find({ isAvailable: true })
      .select("title location price days accommodation checkpoints tag rating")
      .sort({ "rating.average": -1, "rating.count": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 3. Total count (for frontend pagination)
    const total = await Booking.countDocuments({ isAvailable: true });

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching bookings",
    });
  }
};

const createBooking = async (req, res) => {
  try {
    const { title, location, price, days, accommodation, checkpoints, tag } =
      req.body;

    const errors = [];

    // --- Title ---
    if (typeof title !== "string" || title.trim().length === 0) {
      errors.push("Title is required and cannot be empty or whitespace");
    } else if (title.trim().length < 3) {
      errors.push("Title must be at least 3 characters long");
    } else if (title.trim().length > 120) {
      errors.push("Title cannot exceed 120 characters");
    }

    // --- Location ---
    if (typeof location !== "string" || location.trim().length === 0) {
      errors.push("Location is required and cannot be empty or whitespace");
    }

    // --- Price ---
    if (price === undefined || price === null || price === "") {
      errors.push("Price is required");
    } else {
      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || !Number.isFinite(numericPrice)) {
        errors.push("Price must be a valid number");
      } else if (numericPrice <= 0) {
        errors.push("Price must be greater than 0");
      }
    }

    // --- Days ---
    if (days === undefined || days === null || days === "") {
      errors.push("Days is required");
    } else {
      const numericDays = Number(days);
      if (!Number.isInteger(numericDays)) {
        errors.push("Days must be a whole number");
      } else if (numericDays < 1) {
        errors.push("Days must be at least 1");
      }
    }

    // --- Accommodation (min/max) ---
    let accMin, accMax;
    if (
      !accommodation ||
      typeof accommodation !== "object" ||
      Array.isArray(accommodation)
    ) {
      errors.push("Accommodation must be an object with min and max values");
    } else {
      accMin = Number(accommodation.min);
      accMax = Number(accommodation.max);

      if (
        accommodation.min === undefined ||
        accommodation.min === null ||
        Number.isNaN(accMin)
      ) {
        errors.push("Accommodation minimum is required and must be a number");
      } else if (!Number.isInteger(accMin) || accMin < 1) {
        errors.push(
          "Accommodation minimum must be a whole number of at least 1",
        );
      }

      if (
        accommodation.max === undefined ||
        accommodation.max === null ||
        Number.isNaN(accMax)
      ) {
        errors.push("Accommodation maximum is required and must be a number");
      } else if (!Number.isInteger(accMax) || accMax < 1) {
        errors.push(
          "Accommodation maximum must be a whole number of at least 1",
        );
      }

      // Only compare min/max if both individually passed their own checks
      if (
        Number.isInteger(accMin) &&
        Number.isInteger(accMax) &&
        accMin > accMax
      ) {
        errors.push("Accommodation minimum cannot be greater than maximum");
      }
    }

    // --- Checkpoints (optional array of strings) ---
    if (checkpoints !== undefined) {
      if (!Array.isArray(checkpoints)) {
        errors.push("Checkpoints must be an array of strings");
      } else if (checkpoints.length > 20) {
        errors.push("You can list a maximum of 20 checkpoints");
      } else if (
        checkpoints.some(
          (cp) => typeof cp !== "string" || cp.trim().length === 0,
        )
      ) {
        errors.push("Each checkpoint must be a non-empty string");
      }
    }

    // --- Tag (optional single string) ---
    if (tag !== undefined && tag !== null && tag !== "") {
      if (typeof tag !== "string") {
        errors.push("Tag must be a string");
      } else if (tag.trim().length > 30) {
        errors.push("Tag cannot exceed 30 characters");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // --- Create ---
    const booking = await Booking.create({
      title: title.trim(),
      location: location.trim(),
      price: Number(price),
      days: Number(days),
      accommodation: {
        min: accMin,
        max: accMax,
      },
      checkpoints: checkpoints ? checkpoints.map((cp) => cp.trim()) : [],
      tag: tag && tag.trim().length > 0 ? tag.trim() : null,
      createdBy: req.user?._id,
      isAvailable: true,
    });

    res.status(201).json({
      success: true,
      booking,
      message: "booking created sucessfully",
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

    res.status(500).json({
      success: false,
      message: "Something went wrong while creating the booking",
    });
  }
};

module.exports = { getAllBookings, createBooking };
