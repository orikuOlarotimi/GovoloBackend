const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // Who booked (from the JWT)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },

    // Reference only. The destination may be edited or deleted later,
    // so everything we need is snapshotted below.
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },

    addOns: [
      {
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 }, // per night
      },
    ],

    destinationSnapshot: {
      title: { type: String, required: true, trim: true },
      location: { type: String, required: true, trim: true },
      image: { type: String, required: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },

    bookingType: {
      type: String,
      enum: ["destination", "package"],
      default: "destination",
    },
    // Trip details
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 }, // computed on the server

    guests: {
      adults: { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 1 }, // computed on the server
    },

    // Snapshot of the room type chosen, so later admin edits don't change it
    roomType: {
      name: { type: String, trim: true },
      price: { type: Number, min: 0 },
    },

    // Contact details entered on the booking page
    guestDetails: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      specialRequests: { type: String, trim: true, default: "" },
    },

    // Pricing (always computed on the server, never taken from the frontend)
    originalPrice: { type: Number, required: true, min: 0 }, // destination's listed price at booking time
    totalPrice: { type: Number, required: true, min: 0 }, // calculated total

    // Lifecycle (payment will update these later)
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "expired"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);