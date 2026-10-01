const express = require("express")
const router = express.Router()
const upload = require("../config/multer");
const protect = require("../midleware/authMiddleware");
const MAX_SECTIONS = 10; 

const blogUploadFields = [
  { name: "mainImage", maxCount: 1 },
  ...Array.from({ length: MAX_SECTIONS }, (_, i) => ({
    name: `sectionImages_${i}`,
    maxCount: 3, // matches the schema's per-section image cap
  })),
];


const {
  getAllBlogs,
  registerBlogClick,
  createBlog,
} = require("../controllers/blogsController");

// GET /api/blogs — paginated list, includes isTrending flag
router.get("/", getAllBlogs);

// PATCH /api/blogs/:id/click — registers a unique (per-visitorId) click, drives trending
router.patch("/:id/click", registerBlogClick);

router.post(
  "/",
  protect,
  upload.fields(blogUploadFields),
  (err, req, res, next) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  },
  createBlog,
);

module.exports = router;