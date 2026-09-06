const Destination = require("../models/Destination");
// const upload = require("../config/multer")
const imagekit = require("../config/imagekit")
const verifyImageBuffer = require("../services/verifyImage")

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
    } else {
      const mainImageCheck = await verifyImageBuffer(mainImageFile.buffer);

      if (!mainImageCheck.valid) {
        errors.push(`Main image rejected: ${mainImageCheck.reason}`);
      }
    }
    // --- Gallery Images (optional, array) ---
    const galleryFiles = req.files?.images || [];
    if (galleryFiles.length > 10) {
      errors.push("You can upload a maximum of 10 gallery images");
    }
    for (const file of galleryFiles) {
      const check = await verifyImageBuffer(file.buffer);
      if (!check.valid) {
        return res.status(400).json({
          success: false,
          message: `Gallery image "${file.originalname}" rejected: ${check.reason}`,
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }
    console.log("MAIN IMAGE FILE:", mainImageFile);
    console.log("BUFFER EXISTS:", !!mainImageFile?.buffer);
    console.log("BUFFER LENGTH:", mainImageFile?.buffer?.length);

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
      price: Number(price),
      mainImage: mainImageUpload.url,
      images: galleryUploads.map((img) => img.url),
      createdBy: req.user?._id,
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
        message: "Validation failed",
        errors: messages,
      });
    }
    console.log(error)
    res.status(500).json({
      success: false,
      message: "Something went wrong while creating the destination",
    });
  }
};  

 // delete destinations and update destinations to be created 

module.exports = {
  getAllDestinations,
  getTopDestinations,
  addDestination,
};
