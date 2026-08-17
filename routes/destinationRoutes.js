const express = require("express");
const router = express.Router();

const {
  getAllDestinations,
  getTopDestinations
} = require("../controllers/destinationController");


router.get("/", getAllDestinations)

router.get("/top-destinations", getTopDestinations)

module.exports = router
