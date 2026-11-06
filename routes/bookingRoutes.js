const {
  getAllBookings,
  createDestinationBooking,
  createPackageBooking,
  getMyBookings,
  getBookingById,
  deleteBooking,
  getAdminBookings,
  respondToBooking,
} = require("../controllers/bookingsController");
const express = require("express")
const protect = require("../midleware/authMiddleware")
const router = express.Router()


router.post("/destination", protect, createDestinationBooking);
router.post("/package", protect, createPackageBooking);
router.get("/", getAllBookings)
router.get("/mine", protect, getMyBookings);
router.get("/admin", protect, getAdminBookings);
router.patch("/admin/:id/respond", protect, respondToBooking);
router.get("/:id", protect, getBookingById);
router.delete("/:id", protect, deleteBooking);

module.exports = router;