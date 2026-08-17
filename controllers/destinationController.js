const Destination = require("../models/Destination");
// const upload = require("../config/multer")
const {
  buildSrc,
  buildTransformationString,
  upload,
  getResponsiveImageAttributes,
} = require("@imagekit/javascript");

const getAllDestinations = async (req, res) => {
  try {
    // 1. Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;

    const skip = (page - 1) * limit;

    // 2. Query (only published)
    const destinations = await Destination.find({ isPublished: true })
      .select("title location price images description") // minimal fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 3. Total count (for frontend pagination)
    const total = await Destination.countDocuments({ isPublished: true });

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTopDestinations = async (req, res) => {
  try {
    const destinations = await Destination.find({
      isPublished: true,
    })
      .select("title location price images description rating")
      .sort({ "rating.average": -1 })
      .limit(8);

    res.status(200).json({
      success: true,
      count: destinations.length,
      destinations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addDestination = async (req, res) => {
  try {
    const { title, description, location, price, images, mainImage } =
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

    // --- Description ---
    if (typeof description !== "string" || description.trim().length === 0) {
      errors.push("Description is required and cannot be empty or whitespace");
    } else if (description.trim().length < 10) {
      errors.push("Description must be at least 10 characters long");
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
      if (Number.isNaN(numericPrice)) {
        errors.push("Price must be a valid number");
      } else if (numericPrice <= 0) {
        errors.push("Price must be greater than 0");
      } else if (!Number.isFinite(numericPrice)) {
        errors.push("Price must be a finite number");
      }
    }

    // --- Images (optional, but validate shape if provided) ---
    const mainImageFile = req.files?.mainImage?.[0];
    if (!mainImageFile) {
      errors.push("Main image is required");
    }

    // --- Gallery Images (optional, array) ---
    const galleryFiles = req.files?.images || [];
    if (galleryFiles.length > 10) {
      errors.push("You can upload a maximum of 10 gallery images");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const destination = await Destination.create({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      price: Number(price),
      images: images ? images.map((img) => img.trim()) : [],
      createdBy: req.user?._id
    });

    res.status(201).json({
      success: true,
      message: "Destination added successfully",
      destination,
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
      message: "Something went wrong while creating the destination",
    });
  }
};

module.exports = {
  getAllDestinations,
  getTopDestinations,
  addDestination,
};