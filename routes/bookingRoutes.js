const { getAllBookings, createBooking } = require("../controllers/bookingsController")
const express = require("express")
const { create } = require("../models/Bookings")
const protect = require("../midleware/authMiddleware")
const router = express.Router()


router.post("/", protect, createBooking)
router.get("/", getAllBookings)


module.exports = router;