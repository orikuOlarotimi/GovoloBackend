const router = require("express").Router()
const { addPackage, getMyPackages,
  getMyPackage,
  editPackage,
  deleteMyPackage, } = require("../controllers/packageController");
const protect = require("../midleware/authMiddleware");



router.post("/", protect, addPackage)
router.get("/mine", protect, getMyPackages);
router.get("/mine/:id", protect, getMyPackage);
router.patch("/mine/:id", protect, editPackage);
router.delete("/mine/:id", protect, deleteMyPackage);

module.exports = router