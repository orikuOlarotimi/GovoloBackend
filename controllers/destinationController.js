const Destination = require("../models/Destination");

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

module.exports = {
  getAllDestinations,
};