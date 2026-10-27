const router = require("express").Router()
const {
  addPackage,
  getPackage,
  getMyPackages,
  getMyPackage,
  editPackage,
  deleteMyPackage,
  getAllPackages,
} = require("../controllers/packageController");
const protect = require("../midleware/authMiddleware");



router.post("/", protect, addPackage)
router.get("/", getAllPackages);
router.get("/mine", protect, getMyPackages);
router.get("/:id", getPackage);
router.get("/mine/:id", protect, getMyPackage);
router.patch("/mine/:id", protect, editPackage);
router.delete("/mine/:id", protect, deleteMyPackage);

module.exports = router