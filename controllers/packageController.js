const mongoose = require("mongoose");
const Destination = require("../models/Destination");
const Package = require("../models/Package");

const addPackage = async (req, res) => {
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
        message: "You do not have permission to create a package",
      });
    }

    const {
      destination: destinationId,
      price,
      duration,
      groupSize, // { min, max } — object or JSON string, see note below
      included, // string[] — array or JSON string
      addOns, // [{ name, price, unit }] — array or JSON string
    } = req.body;

    const errors = [];

    // --- Destination ownership / publish checks ---
    if (!destinationId || !mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({
        success: false,
        message: "A valid destination id is required",
      });
    }

    const destination = await Destination.findById(destinationId);

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: "Destination not found",
      });
    }

    if (!destination.isPublished) {
      return res.status(400).json({
        success: false,
        message: "Cannot create a package for an unpublished destination",
      });
    }

    if (String(destination.createdBy) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only create packages for your own destinations",
      });
    }

    // --- Price ---
    let numericPrice;
    if (price === undefined || price === null || price === "") {
      errors.push("Price is required");
    } else {
      numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice <= 0) {
        errors.push("Price must be a valid number greater than 0");
      }
    }

    // --- Duration ---
    if (typeof duration !== "string" || duration.trim().length === 0) {
      errors.push("Duration is required and cannot be empty");
    }

    // --- Group size ---
    const parsedGroupSize =
      typeof groupSize === "string" ? JSON.parse(groupSize) : groupSize;

    if (
      !parsedGroupSize ||
      typeof parsedGroupSize.min !== "number" ||
      typeof parsedGroupSize.max !== "number"
    ) {
      errors.push("Group size must include a min and max number");
    } else if (parsedGroupSize.min > parsedGroupSize.max) {
      errors.push("Group size minimum cannot be greater than maximum");
    } else if (parsedGroupSize.min < 1) {
      errors.push("Group size minimum must be at least 1");
    }

    // --- Included (optional list) ---
    const parsedIncluded =
      typeof included === "string" ? JSON.parse(included) : included || [];

    if (!Array.isArray(parsedIncluded)) {
      errors.push("Included list must be an array");
    } else if (
      parsedIncluded.some((item) => typeof item !== "string" || !item.trim())
    ) {
      errors.push("Included list cannot contain empty entries");
    }

    // --- Add-ons (optional list) ---
    const parsedAddOns =
      typeof addOns === "string" ? JSON.parse(addOns) : addOns || [];

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

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const newPackage = await Package.create({
      destination: destination._id,
      price: numericPrice,
      duration: duration.trim(),
      groupSize: parsedGroupSize,
      included: parsedIncluded,
      addOns: parsedAddOns,
      createdBy: req.user._id,
      isPublished: true,
    });

    const populated = await newPackage.populate(
      "destination",
      "title mainImage location rating",
    );

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      package: populated,
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
      message: "Something went wrong while creating the package",
    });
  }
};

module.exports = addPackage;
