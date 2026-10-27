const { getAllBookings, createDestinationBooking, createPackageBooking } = require("../controllers/bookingsController")
const express = require("express")
const { create } = require("../models/Bookings")
const protect = require("../midleware/authMiddleware")
const router = express.Router()


router.post("/destination", protect, createDestinationBooking);
router.post("/package", protect, createPackageBooking);
router.get("/", getAllBookings)


module.exports = router;