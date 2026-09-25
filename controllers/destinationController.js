const Destination = require("../models/Destination");
// const upload = require("../config/multer")
const imagekit = require("../config/imagekit")
const verifyImageBuffer = require("../services/verifyImage")
const mongoose = require("mongoose");

const getAllDestinations = async (req, res) => {
  try {
    // 1. Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    // 2. Query (only published)
    const destinations = await Destination.find({ isPublished: true })
      .select("title location price mainImage description visits rating ") // minimal fields
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
      .select("title location price images description rating mainImage visits")
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
    // --- Auth / role check FIRST — before anything else runs ---
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to perform this action",
      });
    }

    if (req.user.rolePrivilege !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create a destination",
      });
    }

    const {
      title,
      description,
      location,
      price,
      duration,
      groupSize, // expected as JSON string: {"min": 2, "max": 12}
      tripHighlights, // JSON string: [{ title, description }]
      included, // JSON string: string[]
      notIncluded, // JSON string: string[]
      amenities, // JSON string: string[]
      itinerary, // JSON string: [{ day, title, description }]
      roomTypes, // JSON string: [{ name, description, price }]
      addOns, // JSON string: [{ name, price, unit }]
    } = req.body;

    const errors = [];

    // --- Helper: safely parse a JSON field from multipart form data ---
    function parseJsonField(raw, fieldName, fallback) {
      if (raw === undefined || raw === null || raw === "") return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        errors.push(`${fieldName} must be valid JSON`);
        return fallback;
      }
    }

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

    // --- Price (this is the Standard Room price) ---
    let numericPrice;
    if (price === undefined || price === null || price === "") {
      errors.push("Price is required");
    } else {
      numericPrice = Number(price);
      if (Number.isNaN(numericPrice)) {
        errors.push("Price must be a valid number");
      } else if (numericPrice <= 0) {
        errors.push("Price must be greater than 0");
      } else if (!Number.isFinite(numericPrice)) {
        errors.push("Price must be a finite number");
      }
    }

    // --- Duration (optional) ---
    if (duration !== undefined && typeof duration !== "string") {
      errors.push("Duration must be a string");
    }

    // --- Group size (optional, but validate shape if provided) ---
    const parsedGroupSize = parseJsonField(groupSize, "Group size", null);
    if (parsedGroupSize) {
      const { min, max } = parsedGroupSize;
      if (min !== undefined && (typeof min !== "number" || min < 1)) {
        errors.push("Group size minimum must be a positive number");
      }
      if (max !== undefined && (typeof max !== "number" || max < 1)) {
        errors.push("Group size maximum must be a positive number");
      }
      if (typeof min === "number" && typeof max === "number" && min > max) {
        errors.push("Group size minimum cannot be greater than maximum");
      }
    }

    // --- Trip highlights (required — at least one, matching the frontend) ---
    const parsedHighlights = parseJsonField(
      tripHighlights,
      "Trip highlights",
      [],
    );
    if (!Array.isArray(parsedHighlights) || parsedHighlights.length === 0) {
      errors.push("At least one trip highlight is required");
    } else {
      parsedHighlights.forEach((h, i) => {
        if (!h?.title?.trim() || !h?.description?.trim()) {
          errors.push(
            `Trip highlight #${i + 1} must have a title and description`,
          );
        }
      });
    }

    // --- Included / Not Included / Amenities (optional lists) ---
    const parsedIncluded = parseJsonField(included, "Included list", []);
    const parsedNotIncluded = parseJsonField(
      notIncluded,
      "Not included list",
      [],
    );
    const parsedAmenities = parseJsonField(amenities, "Amenities list", []);

    [
      ["Included list", parsedIncluded],
      ["Not included list", parsedNotIncluded],
      ["Amenities list", parsedAmenities],
    ].forEach(([label, arr]) => {
      if (!Array.isArray(arr)) {
        errors.push(`${label} must be an array`);
      } else if (arr.some((item) => typeof item !== "string" || !item.trim())) {
        errors.push(`${label} cannot contain empty entries`);
      }
    });

    // --- Itinerary (required — at least one day, matching the frontend) ---
    const parsedItinerary = parseJsonField(itinerary, "Itinerary", []);
    if (!Array.isArray(parsedItinerary) || parsedItinerary.length === 0) {
      errors.push("At least one itinerary day is required");
    } else {
      parsedItinerary.forEach((d, i) => {
        if (typeof d?.day !== "number") {
          errors.push(`Itinerary day #${i + 1} must have a valid day number`);
        }
        if (!d?.title?.trim()) {
          errors.push(`Itinerary day #${i + 1} must have a title`);
        }
      });
    }

    // --- Room types (required — Standard Room always exists, price must match top-level price) ---
    const parsedRoomTypes = parseJsonField(roomTypes, "Room types", []);
    if (!Array.isArray(parsedRoomTypes) || parsedRoomTypes.length === 0) {
      errors.push("At least one room type is required");
    } else {
      const standard = parsedRoomTypes[0];
      if (!standard || standard.name !== "Standard Room") {
        errors.push("The first room type must be Standard Room");
      } else if (
        numericPrice !== undefined &&
        standard.price !== numericPrice
      ) {
        errors.push("Standard Room price must match the destination price");
      }

      parsedRoomTypes.forEach((r, i) => {
        if (!r?.name?.trim()) {
          errors.push(`Room type #${i + 1} must have a name`);
        }
        if (typeof r?.price !== "number" || r.price <= 0) {
          errors.push(`Room type #${i + 1} must have a price greater than 0`);
        }
      });
    }

    // --- Add-ons (optional, but validate shape if provided) ---
    const parsedAddOns = parseJsonField(addOns, "Add-ons", []);
    if (!Array.isArray(parsedAddOns)) {
      errors.push("Add-ons must be an array");
    } else {
      parsedAddOns.forEach((a, i) => {
        if (!a?.name?.trim()) {
          errors.push(`Add-on #${i + 1} must have a name`);
        }
        if (typeof a?.price !== "number" || a.price <= 0) {
          errors.push(`Add-on #${i + 1} must have a price greater than 0`);
        }
      });
    }

    // --- Main image ---
    const mainImageFile = req.files?.mainImage?.[0];
    if (!mainImageFile) {
      errors.push("Main image is required");
    } else {
      const mainImageCheck = await verifyImageBuffer(mainImageFile.buffer);
      if (!mainImageCheck.valid) {
        errors.push(`Main image rejected: ${mainImageCheck.reason}`);
      }
    }

    // --- Gallery images (optional, max 8 — matches schema cap) ---
    const galleryFiles = req.files?.images || [];
    if (galleryFiles.length > 8) {
      errors.push("You can upload a maximum of 8 gallery images");
    }
    for (const file of galleryFiles) {
      const check = await verifyImageBuffer(file.buffer);
      if (!check.valid) {
        errors.push(
          `Gallery image "${file.originalname}" rejected: ${check.reason}`,
        );
      }
    }

    // --- Bail out if anything failed, with a guaranteed non-empty message ---
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0], // first error as the headline message for a toast
        errors,
      });
    }

    // --- Uploads (only reached once every check above has passed) ---
    const mainImageUpload = await imagekit.files.upload({
      file: mainImageFile.buffer.toString("base64"),
      fileName: mainImageFile.originalname,
      folder: "/destinations",
      useUniqueFileName: true,
    });

    const galleryUploads = await Promise.all(
      galleryFiles.map((file) =>
        imagekit.files.upload({
          file: file.buffer.toString("base64"),
          fileName: file.originalname,
          folder: "/destinations",
          useUniqueFileName: true,
        }),
      ),
    );

    const destination = await Destination.create({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      price: numericPrice,
      duration: duration?.trim(),
      groupSize: parsedGroupSize || undefined,
      tripHighlights: parsedHighlights,
      included: parsedIncluded,
      notIncluded: parsedNotIncluded,
      amenities: parsedAmenities,
      itinerary: parsedItinerary,
      roomTypes: parsedRoomTypes,
      addOns: parsedAddOns,
      mainImage: mainImageUpload.url,
      images: galleryUploads.map((img) => img.url),
      createdBy: req.user._id,
      isPublished: true,
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
        message: messages[0] || "Validation failed", // never empty
        errors: messages,
      });
    }

    console.log(error);
    res.status(500).json({
      success: false,
      // never send an empty/undefined message to the frontend toast
      message: "Something went wrong while creating the destination",
    });
  }
};

const getDestination = async (req, res) => {
  try {
    const id = req.params.id?.trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid destination id",
      });
    }

    const destination = await Destination.findOne({
      _id: id,
      isPublished: true,
    }).populate("createdBy", "name email"); // adjust field list to your User schema

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: "Destination not found",
      });
    }

    res.status(200).json({
      success: true,
      destination,
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// delete destinations and update destinations to be created 

module.exports = {
  getAllDestinations,
  getTopDestinations,
  addDestination,
  getDestination,
};
