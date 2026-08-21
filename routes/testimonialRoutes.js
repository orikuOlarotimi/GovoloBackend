const express = require("express")
const protect = require("../midleware/authMiddleware")
const router = express.Router()

const {getAllTestimonials, createTestimonial } = require("../controllers/testimonialController")

router.get("/", getAllTestimonials)

router.post("/", protect, createTestimonial)

module.exports = router;