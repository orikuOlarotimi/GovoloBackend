const mongoose = require("mongoose");
const Destination = require("../models/Destination");
const Package = require("../models/Package");
const User = require("../models/User")

async function requireAdminUser(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "You must be logged in to perform this action",
    });
    return null;
  }

  const user = await User.findById(userId).select("rolePrivilege");
  if (!user) {
    res.status(401).json({
      success: false,
      message: "Account not found. Please log in again",
    });
    return null;
  }

  if (user.rolePrivilege !== "admin") {
    res.status(403).json({
      success: false,
      message: "You do not have permission to manage packages",
    });
    return null;
  }

  return user;
}

const PACKAGE_DESTINATION_FIELDS = "title mainImage location rating";

const addPackage = async (req, res) => {
  try {
    // --- Auth / role check first ---
    if (!req.user.id) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to perform this action",
      });
    }
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "user not found"
      })
    }
    if (user.rolePrivilege !== "admin") {
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

    if (String(destination.createdBy) !== String(req.user.id)) {
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
      destination: destination.id,
      price: numericPrice,
      duration: duration.trim(),
      groupSize: parsedGroupSize,
      included: parsedIncluded,
      addOns: parsedAddOns,
      createdBy: req.user.id,
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
    res.status(500).json({
      success: false,
      message: "Something went wrong while creating the package",
    });
  }
};

// ---------- GET /api/packages/mine ----------
const getMyPackages = async (req, res) => {
  try {
    const admin = await requireAdminUser(req, res);
    if (!admin) return;

    const packages = await Package.find({ createdBy: admin._id })
      .populate("destination", PACKAGE_DESTINATION_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: packages.length,
      packages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching your packages",
    });
  }
};

// ---------- GET /api/packages/mine/:id ----------
const getMyPackage = async (req, res) => {
  try {
    const admin = await requireAdminUser(req, res);
    if (!admin) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package id",
      });
    }

    const pkg = await Package.findOne({ _id: id, createdBy: admin._id })
      .populate(
        "destination",
        "title description mainImage images location rating",
      )
      .lean();

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.status(200).json({
      success: true,
      package: pkg,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the package",
    });
  }
};

// ---------- PATCH /api/packages/mine/:id ----------
const editPackage = async (req, res) => {
  try {
    const admin = await requireAdminUser(req, res);
    if (!admin) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package id",
      });
    }

    // Owner-only: someone else's package looks the same as a missing one
    const pkg = await Package.findOne({ _id: id, createdBy: admin._id });
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const { price, duration, groupSize, included, addOns } = req.body;

    const errors = [];
    const updates = {};

    // Rule: field not sent (undefined) -> untouched.
    //       sent but blank/invalid     -> error (every package field is required
    //       except the two lists, which are replaced as sent; [] clears them).
    const wasSent = (v) => v !== undefined;

    const parseField = (raw, label) => {
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        errors.push(`${label} must be valid JSON`);
        return undefined;
      }
    };

    // --- Price ---
    if (wasSent(price)) {
      const p = typeof price === "string" ? price.trim() : price;
      if (p === "" || p === null) {
        errors.push("Price is required");
      } else {
        const n = Number(p);
        if (!Number.isFinite(n) || n <= 0) {
          errors.push("Price must be a valid number greater than 0");
        } else {
          updates.price = n;
        }
      }
    }

    // --- Duration ---
    if (wasSent(duration)) {
      const d = typeof duration === "string" ? duration.trim() : "";
      if (!d) {
        errors.push("Duration is required and cannot be empty");
      } else {
        updates.duration = d;
      }
    }

    // --- Group size ---
    if (wasSent(groupSize)) {
      const g = parseField(groupSize, "Group size");
      if (g !== undefined) {
        const isWhole = (v) =>
          v !== "" && v != null && Number.isInteger(Number(v)) && Number(v) >= 1;

        if (!isWhole(g?.min)) {
          errors.push("Group size minimum must be a whole number of at least 1");
        }
        if (!isWhole(g?.max)) {
          errors.push("Group size maximum must be a whole number of at least 1");
        }
        if (isWhole(g?.min) && isWhole(g?.max)) {
          if (Number(g.min) > Number(g.max)) {
            errors.push("Group size minimum cannot be greater than maximum");
          } else {
            updates.groupSize = { min: Number(g.min), max: Number(g.max) };
          }
        }
      }
    }

    // --- Included (replaced as sent; [] clears it) ---
    if (wasSent(included)) {
      const list = parseField(included, "Included list");
      if (list !== undefined) {
        if (!Array.isArray(list)) {
          errors.push("Included list must be an array");
        } else {
          updates.included = list
            .filter((item) => typeof item === "string" && item.trim())
            .map((item) => item.trim());
        }
      }
    }

    // --- Add-ons (replaced as sent; [] clears it) ---
    if (wasSent(addOns)) {
      const list = parseField(addOns, "Add-ons");
      if (list !== undefined) {
        if (!Array.isArray(list)) {
          errors.push("Add-ons must be an array");
        } else {
          const cleanAddOns = [];
          list.forEach((a, i) => {
            const name = typeof a?.name === "string" ? a.name.trim() : "";
            const nothingFilled =
              !name &&
              (a?.price === undefined ||
                a?.price === null ||
                a?.price === "" ||
                Number(a.price) === 0);
            if (nothingFilled) return;

            const aPrice = Number(a?.price);
            if (!name) {
              errors.push(`Add-on #${i + 1} must have a name`);
            } else if (!Number.isFinite(aPrice) || aPrice <= 0) {
              errors.push(`Add-on #${i + 1} must have a price greater than 0`);
            } else {
              const unit =
                typeof a?.unit === "string" && a.unit.trim()
                  ? a.unit.trim()
                  : "/night";
              cleanAddOns.push({ name, price: aPrice, unit });
            }
          });
          updates.addOns = cleanAddOns;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    if (Object.keys(updates).length === 0) {
      const current = await pkg.populate(
        "destination",
        PACKAGE_DESTINATION_FIELDS,
      );
      return res.status(200).json({
        success: true,
        message: "No changes to save",
        package: current,
      });
    }

    const updated = await Package.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    ).populate("destination", PACKAGE_DESTINATION_FIELDS);

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      package: updated,
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
      message: "Something went wrong while updating the package",
    });
  }
};

// ---------- DELETE /api/packages/mine/:id ----------
const deleteMyPackage = async (req, res) => {
  try {
    const admin = await requireAdminUser(req, res);
    if (!admin) return;

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package id",
      });
    }

    const deleted = await Package.findOneAndDelete({
      _id: id,
      createdBy: admin._id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Package deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while deleting the package",
    });
  }
};

module.exports = {
  addPackage,
  getMyPackages,
  getMyPackage,
  editPackage,
  deleteMyPackage,
};
