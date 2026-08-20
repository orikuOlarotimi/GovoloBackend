const Testimonial = require("../models/Testimonial")

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

module.exports = { getAllTestimonials };
