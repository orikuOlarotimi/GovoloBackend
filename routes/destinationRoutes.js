const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const protect = require("../midleware/authMiddleware");

const {
  getAllDestinations,
  getTopDestinations,
  addDestination,
} = require("../controllers/destinationController");

router.get("/", getAllDestinations);

router.get("/top-destinations", getTopDestinations);

router.post(
  "/",
  protect,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  (err, req, res, next) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  },
  addDestination,
);

module.exports = router;
