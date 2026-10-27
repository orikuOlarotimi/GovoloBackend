const Booking = require("../models/Bookings");
const mongoose = require("mongoose");
const Destination = require("../models/Destination");
const Package = require("../models/Package")

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{7,20}$/;


const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getAllBookings = async (req, res) => {
  try {
    // 1. Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 2. Query — only available bookings, highest rated first
    const bookings = await Booking.find({ isAvailable: true })
      .select("title location price days accommodation checkpoints tag rating")
      .sort({ "rating.average": -1, "rating.count": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 3. Total count (for frontend pagination)
    const total = await Booking.countDocuments({ isAvailable: true });

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching bookings",
    });
  }
};

const createBooking = async (req, res) => {
   try {
     // ASSUMPTION: your auth middleware sets req.user from the JWT
     const userId = req.user?.id;
     if (!userId || !mongoose.isValidObjectId(userId)) {
       return res.status(401).json({ success: false, message: "Unauthorized" });
     }

     const { destinationId, roomTypeId, guestDetails = {} } = req.body;

     if (typeof destinationId !== "string" || !destinationId.trim()) {
       return res.status(400).json({
         success: false,
         message: "Destination ID is required",
       });
     }

     // Validate roomTypeId
     if (typeof roomTypeId !== "string" || !roomTypeId.trim()) {
       return res.status(400).json({
         success: false,
         message: "Room type ID is required",
       });
     }

     // Validate guestDetails
     if (
       !guestDetails ||
       typeof guestDetails !== "object" ||
       Array.isArray(guestDetails) ||
       Object.keys(guestDetails).length === 0
     ) {
       return res.status(400).json({
         success: false,
         message: "Guest details are required",
       });
     }
     const { fullName, email, phone, specialRequests } = guestDetails;

     if (
       fullName == null ||
       String(fullName).trim() === "" ||
       email == null ||
       String(email).trim() === "" ||
       phone == null ||
       String(phone).trim() === ""
     ) {
       return res.status(400).json({
         success: false,
         message: "Full name, email, and phone are required",
       });
     }

     const guestFullName = String(fullName).trim();
     const guestEmail = String(email).trim().toLowerCase();
     const guestPhone = String(phone).trim();
     const guestSpecialRequests =
       specialRequests == null ? "" : String(specialRequests).trim();

     // Validate destination ID
     if (
       typeof destinationId !== "string" ||
       !mongoose.isValidObjectId(destinationId)
     ) {
       return res.status(400).json({
         success: false,
         message: "Invalid destination",
       });
     }

     // Validate room type ID
     if (
       typeof roomTypeId !== "string" ||
       !mongoose.isValidObjectId(roomTypeId)
     ) {
       return res.status(400).json({
         success: false,
         message: "Invalid room type",
       });
     }

     if (guestFullName.length < 2 || guestFullName.length > 100) {
       return res.status(400).json({
         success: false,
         message: "Full name must be between 2 and 100 characters",
       });
     }

     if (!EMAIL_REGEX.test(guestEmail)) {
       return res.status(400).json({
         success: false,
         message: "Invalid email address",
       });
     }

     if (!PHONE_REGEX.test(guestPhone)) {
       return res.status(400).json({
         success: false,
         message: "Invalid phone number",
       });
     }

     if (guestSpecialRequests.length > 500) {
       return res.status(400).json({
         success: false,
         message: "Special requests must not exceed 500 characters",
       });
     }

     if (
       req.body.adults === undefined ||
       req.body.adults === null ||
       req.body.adults === ""
     ) {
       return res.status(400).json({
         success: false,
         message: "Adults field is required",
       });
     }

     if (
       req.body.children === undefined ||
       req.body.children === null ||
       req.body.children === ""
     ) {
       return res.status(400).json({
         success: false,
         message: "Children field is required",
       });
     }

     if (
       typeof req.body.adults !== "number" ||
       typeof req.body.children !== "number"
     ) {
       return res.status(400).json({
         success: false,
         message: "Adults and children must be numbers",
       });
     }

     // Check that both values are whole numbers
     if (
       !Number.isInteger(req.body.adults) ||
       !Number.isInteger(req.body.children)
     ) {
       return res.status(400).json({
         success: false,
         message: "Adults and children must be whole numbers",
       });
     }

     // Check that both values are positive
     if (req.body.adults <= 0 || req.body.children < 0) {
       return res.status(400).json({
         success: false,
         message:
           "Adults must be greater than 0 and children cannot be negative",
       });
     }
     const adults = req.body.adults;
     const children = req.body.children;
     const totalGuests = adults + children;

     // Check the total number of guests
     if (totalGuests < 1) {
       return res.status(400).json({
         success: false,
         message: "Total guests must be greater than or equal to 1",
       });
     }

     // Check-in date is required
     if (req.body.checkIn == null || req.body.checkIn === "") {
       return res.status(400).json({
         success: false,
         message: "Check-in date is required",
       });
     }

     // Check-out date is required
     if (req.body.checkOut == null || req.body.checkOut === "") {
       return res.status(400).json({
         success: false,
         message: "Check-out date is required",
       });
     }

     // Parse dates
     const checkIn = parseDate(req.body.checkIn);
     const checkOut = parseDate(req.body.checkOut);

     // Validate date formats and values
     if (!checkIn) {
       return res.status(400).json({
         success: false,
         message: "Invalid check-in date",
       });
     }

     if (!checkOut) {
       return res.status(400).json({
         success: false,
         message: "Invalid check-out date",
       });
     }

     // Check-in cannot be in the past
     const today = new Date();
     today.setUTCHours(0, 0, 0, 0);

     if (checkIn < today) {
       return res.status(400).json({
         success: false,
         message: "Check-in date cannot be in the past",
       });
     }

     // Check-out must be after check-in
     if (checkOut <= checkIn) {
       return res.status(400).json({
         success: false,
         message: "Check-out must be after check-in",
       });
     }


     // ---- Load the destination and room type ----
     const destination = await Destination.findById(destinationId).lean();
     if (!destination || destination.isAvailable === false) {
       return res.status(404).json({
         success: false,
         message: "Destination not found or unavailable",
       });
     }

     // ASSUMPTION: room types live on destination.roomTypes, each with _id, name, price
     const roomType = destination.roomTypes?.find(
       (room) => String(room._id) === String(roomTypeId),
     );
     if (!roomType) {
       return res
         .status(400)
         .json({ success: false, message: "Room type not found" });
     }

     // ASSUMPTION: max group size is destination.accommodation.max
     const maxGuests = destination.groupSize?.max;
     if (maxGuests != null && totalGuests > maxGuests) {
       return res.status(400).json({
         success: false,
         message: `This destination allows a maximum of ${maxGuests} guests`,
       });
     }

     // ---- Server-side calculations (nothing here comes from the client) ----
     const days = Math.ceil((checkOut - checkIn) / MS_PER_DAY);
     const totalPrice = roomType.price * days;

     // ---- Create the pending booking ----
     const booking = await Booking.create({
       user: userId,
       destination: destination._id,
       destinationSnapshot: {
         title: destination.title,
         location: destination.location,
         image: destination.mainImage, // ASSUMPTION: a single image URL string
         createdBy: destination.createdBy,
       },
       checkIn,
       checkOut,
       days,
       guests: { adults, children, total: totalGuests },
       roomType: { name: roomType.name, price: roomType.price },
       guestDetails: {
         fullName: guestFullName,
         email: guestEmail,
         phone: guestPhone,
         specialRequests: guestSpecialRequests,
       },
       originalPrice: roomType.price,
       totalPrice,
       // status and paymentStatus use the schema defaults: "pending" / "unpaid"
     });

     return res.status(201).json({ success: true, booking });
   } catch (error) {
     if (error.name === "ValidationError") {
       return res.status(400).json({ success: false, message: error.message });
     }
     console.error("createBooking error:", error);
     return res
       .status(500)
       .json({ success: false, message: "Failed to create booking" });
   }
};
 

const createDestinationBooking = async (req, res) => {
  try {
    // ASSUMPTION: your auth middleware sets req.user from the JWT
    const userId = req.user?.id;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const fail = (message) => res.status(400).json({ success: false, message });

    const {
      destinationId,
      roomTypeId,
      guestDetails,
      adults,
      children,
      checkIn: rawCheckIn,
      checkOut: rawCheckOut,
      addOns = [],
    } = req.body;

    // ---- IDs ----
    if (typeof destinationId !== "string" || !destinationId.trim()) {
      return fail("Destination ID is required");
    }
    if (!mongoose.isValidObjectId(destinationId)) {
      return fail("Invalid destination");
    }
    if (typeof roomTypeId !== "string" || !roomTypeId.trim()) {
      return fail("Room type ID is required");
    }
    if (!mongoose.isValidObjectId(roomTypeId)) {
      return fail("Invalid room type");
    }

    // ---- Guest details ----
    if (
      !guestDetails ||
      typeof guestDetails !== "object" ||
      Array.isArray(guestDetails) ||
      Object.keys(guestDetails).length === 0
    ) {
      return fail("Guest details are required");
    }
    const { fullName, email, phone, specialRequests } = guestDetails;

    if (
      fullName == null ||
      String(fullName).trim() === "" ||
      email == null ||
      String(email).trim() === "" ||
      phone == null ||
      String(phone).trim() === ""
    ) {
      return fail("Full name, email, and phone are required");
    }

    const guestFullName = String(fullName).trim();
    const guestEmail = String(email).trim().toLowerCase();
    const guestPhone = String(phone).trim();
    const guestSpecialRequests =
      specialRequests == null ? "" : String(specialRequests).trim();

    if (guestFullName.length < 2 || guestFullName.length > 100) {
      return fail("Full name must be between 2 and 100 characters");
    }
    if (!EMAIL_REGEX.test(guestEmail)) return fail("Invalid email address");
    if (!PHONE_REGEX.test(guestPhone)) return fail("Invalid phone number");
    if (guestSpecialRequests.length > 500) {
      return fail("Special requests must not exceed 500 characters");
    }

    // ---- Guests ----
    if (adults === undefined || adults === null || adults === "") {
      return fail("Adults field is required");
    }
    if (children === undefined || children === null || children === "") {
      return fail("Children field is required");
    }
    if (typeof adults !== "number" || typeof children !== "number") {
      return fail("Adults and children must be numbers");
    }
    if (!Number.isInteger(adults) || !Number.isInteger(children)) {
      return fail("Adults and children must be whole numbers");
    }
    if (adults <= 0 || children < 0) {
      return fail(
        "Adults must be greater than 0 and children cannot be negative",
      );
    }
    const totalGuests = adults + children;

    // ---- Dates ----
    if (rawCheckIn == null || rawCheckIn === "") {
      return fail("Check-in date is required");
    }
    if (rawCheckOut == null || rawCheckOut === "") {
      return fail("Check-out date is required");
    }
    const checkIn = parseDate(rawCheckIn);
    const checkOut = parseDate(rawCheckOut);
    if (!checkIn) return fail("Invalid check-in date");
    if (!checkOut) return fail("Invalid check-out date");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (checkIn < today) return fail("Check-in date cannot be in the past");
    if (checkOut <= checkIn) return fail("Check-out must be after check-in");

    // ---- Add-ons payload (we only read the id) ----
    if (!Array.isArray(addOns)) return fail("Add-ons must be an array");

    const addOnIds = [];
    for (const item of addOns) {
      const id = item?.id;
      if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
        return fail("Invalid add-on");
      }
      if (!addOnIds.includes(id)) addOnIds.push(id);
    }

    // ---- Load destination, room type and add-ons ----
    const destination = await Destination.findById(destinationId).lean();
    if (!destination || destination.isPublished === false) {
      return res.status(404).json({
        success: false,
        message: "Destination not found or unavailable",
      });
    }

    const roomType = destination.roomTypes?.find(
      (room) => String(room._id) === roomTypeId,
    );
    if (!roomType) return fail("Room type not found");

    const maxGuests = destination.groupSize?.max;
    if (maxGuests != null && totalGuests > maxGuests) {
      return fail(`This destination allows a maximum of ${maxGuests} guests`);
    }

    const selectedAddOns = [];
    for (const id of addOnIds) {
      const found = destination.addOns?.find((a) => String(a._id) === id);
      if (!found) {
        return fail("One or more selected add-ons are not available");
      }
      selectedAddOns.push({ name: found.name, price: found.price });
    }

    // ---- Price: (room price + add-ons per night) × days ----
    const days = Math.ceil((checkOut - checkIn) / MS_PER_DAY);
    const addOnsPerNight = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = (roomType.price + addOnsPerNight) * days;

    // ---- Create the pending booking ----
    const booking = await Booking.create({
      user: userId,
      bookingType: "destination",
      destination: destination._id,
      destinationSnapshot: {
        title: destination.title,
        location: destination.location,
        image: destination.mainImage,
        createdBy: destination.createdBy,
      },
      checkIn,
      checkOut,
      days,
      guests: { adults, children, total: totalGuests },
      roomType: { name: roomType.name, price: roomType.price },
      addOns: selectedAddOns,
      guestDetails: {
        fullName: guestFullName,
        email: guestEmail,
        phone: guestPhone,
        specialRequests: guestSpecialRequests,
      },
      originalPrice: roomType.price,
      totalPrice,
    });

    return res.status(201).json({ success: true, booking });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("createDestinationBooking error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create booking" });
  }
};

const createPackageBooking = async (req, res) => {
  try {
    // ASSUMPTION: your auth middleware sets req.user from the JWT
    const userId = req.user?.id;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const fail = (message) => res.status(400).json({ success: false, message });

    const {
      packageId,
      guestDetails,
      adults,
      children,
      checkIn: rawCheckIn,
      checkOut: rawCheckOut,
      addOns = [],
    } = req.body;

    // ---- Package ID ----
    if (typeof packageId !== "string" || !packageId.trim()) {
      return fail("Package ID is required");
    }
    if (!mongoose.isValidObjectId(packageId)) return fail("Invalid package");

    // ---- Guest details ----
    if (
      !guestDetails ||
      typeof guestDetails !== "object" ||
      Array.isArray(guestDetails) ||
      Object.keys(guestDetails).length === 0
    ) {
      return fail("Guest details are required");
    }
    const { fullName, email, phone, specialRequests } = guestDetails;

    if (
      fullName == null ||
      String(fullName).trim() === "" ||
      email == null ||
      String(email).trim() === "" ||
      phone == null ||
      String(phone).trim() === ""
    ) {
      return fail("Full name, email, and phone are required");
    }

    const guestFullName = String(fullName).trim();
    const guestEmail = String(email).trim().toLowerCase();
    const guestPhone = String(phone).trim();
    const guestSpecialRequests =
      specialRequests == null ? "" : String(specialRequests).trim();

    if (guestFullName.length < 2 || guestFullName.length > 100) {
      return fail("Full name must be between 2 and 100 characters");
    }
    if (!EMAIL_REGEX.test(guestEmail)) return fail("Invalid email address");
    if (!PHONE_REGEX.test(guestPhone)) return fail("Invalid phone number");
    if (guestSpecialRequests.length > 500) {
      return fail("Special requests must not exceed 500 characters");
    }

    // ---- Guests ----
    if (adults === undefined || adults === null || adults === "") {
      return fail("Adults field is required");
    }
    if (children === undefined || children === null || children === "") {
      return fail("Children field is required");
    }
    if (typeof adults !== "number" || typeof children !== "number") {
      return fail("Adults and children must be numbers");
    }
    if (!Number.isInteger(adults) || !Number.isInteger(children)) {
      return fail("Adults and children must be whole numbers");
    }
    if (adults <= 0 || children < 0) {
      return fail(
        "Adults must be greater than 0 and children cannot be negative",
      );
    }
    const totalGuests = adults + children;

    // ---- Dates ----
    if (rawCheckIn == null || rawCheckIn === "") {
      return fail("Check-in date is required");
    }
    if (rawCheckOut == null || rawCheckOut === "") {
      return fail("Check-out date is required");
    }
    const checkIn = parseDate(rawCheckIn);
    const checkOut = parseDate(rawCheckOut);
    if (!checkIn) return fail("Invalid check-in date");
    if (!checkOut) return fail("Invalid check-out date");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (checkIn < today) return fail("Check-in date cannot be in the past");
    if (checkOut <= checkIn) return fail("Check-out must be after check-in");

    // ---- Add-ons payload (we only read the id) ----
    if (!Array.isArray(addOns)) return fail("Add-ons must be an array");

    const addOnIds = [];
    for (const item of addOns) {
      const id = item?.id;
      if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
        return fail("Invalid add-on");
      }
      if (!addOnIds.includes(id)) addOnIds.push(id);
    }

    // ---- Load package, then its destination ----
    const pkg = await Package.findById(packageId).lean();
    if (!pkg || pkg.isPublished === false) {
      return res.status(404).json({
        success: false,
        message: "Package not found or unavailable",
      });
    }

    const destination = await Destination.findById(pkg.destination).lean();
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: "The destination for this package no longer exists",
      });
    }

    // ---- Package rules ----
    const days = Math.ceil((checkOut - checkIn) / MS_PER_DAY);

    // pkg.duration is a string like "5 Days", so pull the number out
    const maxDays = parseInt(pkg.duration, 10);
    if (!Number.isNaN(maxDays) && days > maxDays) {
      return fail(`This package allows a maximum stay of ${maxDays} days`);
    }

    const maxGuests = pkg.groupSize?.max;
    if (maxGuests != null && totalGuests > maxGuests) {
      return fail(`This package allows a maximum of ${maxGuests} guests`);
    }

    // ---- Add-ons come from the package itself ----
    const selectedAddOns = [];
    for (const id of addOnIds) {
      const found = pkg.addOns?.find((a) => String(a._id) === id);
      if (!found) {
        return fail("One or more selected add-ons are not available");
      }
      selectedAddOns.push({ name: found.name, price: found.price });
    }

    // ---- Price: (package price + add-ons per night) × days ----
    const addOnsPerNight = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = (pkg.price + addOnsPerNight) * days;

    // ---- Create the pending booking ----
    const booking = await Booking.create({
      user: userId,
      bookingType: "package",
      package: pkg._id,
      destination: destination._id,
      destinationSnapshot: {
        title: destination.title,
        location: destination.location,
        image: destination.mainImage,
        createdBy: destination.createdBy,
      },
      checkIn,
      checkOut,
      days,
      guests: { adults, children, total: totalGuests },
      addOns: selectedAddOns,
      guestDetails: {
        fullName: guestFullName,
        email: guestEmail,
        phone: guestPhone,
        specialRequests: guestSpecialRequests,
      },
      originalPrice: pkg.price,
      totalPrice,
    });

    return res.status(201).json({ success: true, booking });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("createPackageBooking error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create booking" });
  }
};

module.exports = {
  getAllBookings,
  createBooking,
  createDestinationBooking,
  createPackageBooking,
};
