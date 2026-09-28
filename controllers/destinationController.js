const Destination = require("../models/Destination");
// const upload = require("../config/multer")
const imagekit = require("../config/imagekit")
const verifyImageBuffer = require("../services/verifyImage")
const mongoose = require("mongoose");
const isBlank = (v) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

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
    // --- Auth / role check first ---
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
      groupSize, // JSON string: {"min": 2, "max": 12}
      tripHighlights, // JSON string: [{ title, description }]
      included, // JSON string: string[]
      notIncluded, // JSON string: string[]
      amenities, // JSON string: string[]
      itinerary, // JSON string: [{ title, description }]
      roomTypes, // JSON string: [{ name, description, price }]
      addOns, // JSON string: [{ name, price, unit }]
    } = req.body;

    const errors = [];

    // --- Helpers ---
    function parseJsonField(raw, fieldName, fallback) {
      if (isBlank(raw)) return fallback;
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        errors.push(`${fieldName} must be valid JSON`);
        return fallback;
      }
    }

    // Returns trimmed, non-blank strings only
    function cleanStringList(raw, label) {
      const arr = parseJsonField(raw, label, []);
      if (!Array.isArray(arr)) {
        errors.push(`${label} must be an array`);
        return [];
      }
      if (arr.some((i) => !isBlank(i) && typeof i !== "string")) {
        errors.push(`${label} must only contain text`);
        return [];
      }
      return arr.filter((i) => !isBlank(i)).map((i) => i.trim());
    }

    // ===== REQUIRED FIELDS =====

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

    // --- Price (Standard Room price) ---
    let numericPrice;
    if (isBlank(price)) {
      errors.push("Price is required");
    } else {
      numericPrice = Number(price);
      if (!Number.isFinite(numericPrice)) {
        errors.push("Price must be a valid number");
        numericPrice = undefined;
      } else if (numericPrice <= 0) {
        errors.push("Price must be greater than 0");
      }
    }

    // --- Group size (min and max both required, min <= max) ---
    const parsedGroupSize = parseJsonField(groupSize, "Group size", null);
    let cleanGroupSize;
    if (!parsedGroupSize) {
      errors.push("Group size (minimum and maximum) is required");
    } else {
      const min = Number(parsedGroupSize.min);
      const max = Number(parsedGroupSize.max);
      const minValid =
        !isBlank(parsedGroupSize.min) && Number.isInteger(min) && min >= 1;
      const maxValid =
        !isBlank(parsedGroupSize.max) && Number.isInteger(max) && max >= 1;

      if (!minValid) {
        errors.push(
          "Group size minimum is required and must be a whole number of at least 1",
        );
      }
      if (!maxValid) {
        errors.push(
          "Group size maximum is required and must be a whole number of at least 1",
        );
      }
      if (minValid && maxValid) {
        if (min > max) {
          errors.push("Group size minimum cannot be greater than maximum");
        } else {
          cleanGroupSize = { min, max };
        }
      }
    }

    // --- Room types (Standard Room required; extra rooms optional) ---
    const parsedRoomTypes = parseJsonField(roomTypes, "Room types", []);
    const cleanRoomTypes = [];
    if (!Array.isArray(parsedRoomTypes) || parsedRoomTypes.length === 0) {
      errors.push("Standard Room is required");
    } else {
      const [standard, ...others] = parsedRoomTypes;

      if (
        typeof standard?.name !== "string" ||
        standard.name.trim() !== "Standard Room"
      ) {
        errors.push("The first room type must be Standard Room");
      } else if (
        numericPrice !== undefined &&
        Number(standard.price) !== numericPrice
      ) {
        errors.push("Standard Room price must match the destination price");
      } else if (numericPrice !== undefined) {
        const entry = { name: "Standard Room", price: numericPrice };
        if (!isBlank(standard.description)) {
          entry.description = String(standard.description).trim();
        }
        cleanRoomTypes.push(entry);
      }

      others.forEach((r, i) => {
        const nothingFilled =
          isBlank(r?.name) &&
          isBlank(r?.description) &&
          (isBlank(r?.price) || Number(r.price) === 0);
        if (nothingFilled) return; // empty row — skip it

        const rPrice = Number(r?.price);
        if (isBlank(r?.name)) {
          errors.push(`Room type #${i + 2} must have a name`);
        } else if (!Number.isFinite(rPrice) || rPrice <= 0) {
          errors.push(`Room type #${i + 2} must have a price greater than 0`);
        } else {
          const entry = { name: String(r.name).trim(), price: rPrice };
          if (!isBlank(r.description)) {
            entry.description = String(r.description).trim();
          }
          cleanRoomTypes.push(entry);
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

    // ===== OPTIONAL FIELDS (only kept if they have a value) =====

    // --- Duration ---
    let cleanDuration;
    if (!isBlank(duration)) {
      if (typeof duration !== "string") {
        errors.push("Duration must be text");
      } else {
        cleanDuration = duration.trim();
      }
    }

    // --- Trip highlights (skip empty rows; partial rows are an error) ---
    const parsedHighlights = parseJsonField(
      tripHighlights,
      "Trip highlights",
      [],
    );
    const cleanHighlights = [];
    if (!Array.isArray(parsedHighlights)) {
      errors.push("Trip highlights must be an array");
    } else {
      parsedHighlights.forEach((h, i) => {
        if (isBlank(h?.title) && isBlank(h?.description)) return;
        if (isBlank(h?.title) || isBlank(h?.description)) {
          errors.push(
            `Trip highlight #${i + 1} must have both a title and description`,
          );
          return;
        }
        cleanHighlights.push({
          title: String(h.title).trim(),
          description: String(h.description).trim(),
        });
      });
    }

    // --- Simple lists ---
    const cleanIncluded = cleanStringList(included, "Included list");
    const cleanNotIncluded = cleanStringList(notIncluded, "Not included list");
    const cleanAmenities = cleanStringList(amenities, "Amenities list");

    // --- Itinerary (skip empty rows, day numbers assigned by the server) ---
    const parsedItinerary = parseJsonField(itinerary, "Itinerary", []);
    const cleanItinerary = [];
    if (!Array.isArray(parsedItinerary)) {
      errors.push("Itinerary must be an array");
    } else {
      parsedItinerary.forEach((d, i) => {
        if (isBlank(d?.title) && isBlank(d?.description)) return;
        if (isBlank(d?.title)) {
          errors.push(`Itinerary entry #${i + 1} must have a title`);
          return;
        }
        const entry = {
          day: cleanItinerary.length + 1,
          title: String(d.title).trim(),
        };
        if (!isBlank(d.description)) {
          entry.description = String(d.description).trim();
        }
        cleanItinerary.push(entry);
      });
    }

    // --- Add-ons (skip empty rows) ---
    const parsedAddOns = parseJsonField(addOns, "Add-ons", []);
    const cleanAddOns = [];
    if (!Array.isArray(parsedAddOns)) {
      errors.push("Add-ons must be an array");
    } else {
      parsedAddOns.forEach((a, i) => {
        if (isBlank(a?.name) && isBlank(a?.price)) return;

        const aPrice = Number(a?.price);
        if (isBlank(a?.name)) {
          errors.push(`Add-on #${i + 1} must have a name`);
        } else if (!Number.isFinite(aPrice) || aPrice <= 0) {
          errors.push(`Add-on #${i + 1} must have a price greater than 0`);
        } else {
          const entry = { name: String(a.name).trim(), price: aPrice };
          if (!isBlank(a.unit)) entry.unit = String(a.unit).trim();
          cleanAddOns.push(entry);
        }
      });
    }

    // --- Gallery images (optional, max 8) ---
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

    // --- Bail out if anything failed ---
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    // --- Uploads (only reached once every check has passed) ---
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

    // --- Build the document: required fields first, optional only if present ---
    const doc = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      price: numericPrice,
      groupSize: cleanGroupSize,
      roomTypes: cleanRoomTypes,
      mainImage: mainImageUpload.url,
      createdBy: req.user._id,
      isPublished: true,
    };

    if (cleanDuration) doc.duration = cleanDuration;
    if (cleanHighlights.length) doc.tripHighlights = cleanHighlights;
    if (cleanIncluded.length) doc.included = cleanIncluded;
    if (cleanNotIncluded.length) doc.notIncluded = cleanNotIncluded;
    if (cleanAmenities.length) doc.amenities = cleanAmenities;
    if (cleanItinerary.length) doc.itinerary = cleanItinerary;
    if (cleanAddOns.length) doc.addOns = cleanAddOns;
    if (galleryUploads.length)
      doc.images = galleryUploads.map((img) => img.url);

    const destination = await Destination.create(doc);

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
        message: messages[0] || "Validation failed",
        errors: messages,
      });
    }

    console.log(error);
    res.status(500).json({
      success: false,
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
