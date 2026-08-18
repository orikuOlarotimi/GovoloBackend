const { getAllBookings, createBooking } = require("../controllers/bookingsController")
const express = require("express")
const { create } = require("../models/Bookings")
const router = express.Router()


router.post("/", createBooking)
router.get("/", getAllBookings)


module.exports = router;