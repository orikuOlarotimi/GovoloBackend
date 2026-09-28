const router = require("express").Router()
const { addPackage } = require("../controllers/packageController");
const protect = require("../midleware/authMiddleware");



router.post("/", protect, addPackage)

module.exports = router