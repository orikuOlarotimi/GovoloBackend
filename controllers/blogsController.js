const Blog = require("../models/Blogs");
const BlogClick = require("../models/BlogClick");
const imagekit = require("../config/imagekit");
const verifyImageBuffer = require("../services/verifyImage");

const getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const trendingBlog = await Blog.findOne({ isPublished: true })
      .sort({ visits: -1, createdAt: -1 })
      .select("_id");

    const blogs = await Blog.find({ isPublished: true })
      .select("title image tag details author visits createdAt")
      .populate("author", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Blog.countDocuments({ isPublished: true });

    const blogsWithTrending = blogs.map((blog) => {
      const blogObj = blog.toObject();
      blogObj.isTrending = trendingBlog
        ? trendingBlog._id.equals(blog._id)
        : false;
      return blogObj;
    });

    res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      count: blogs.length,
      blogs: blogsWithTrending,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong while fetching blogs",
    });
  }
};

const registerBlogClick = async (req, res) => {
  try {
    const { id } = req.params;
    const visitorId = req.visitorId; // set by cookie middleware — may be undefined if it failed

    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "A valid blog ID is required",
      });
    }
    const blog = await Blog.findById(id).select("visits");
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // No visitor ID available (cookie blocked/failed) — never block the user, just skip counting
    if (!visitorId) {
      return res.status(200).json({
        success: true,
        counted: false,
        visits: blog.visits,
      });
    }

    // Try to record this click — the unique index does the real dedup work
    try {
      await BlogClick.create({ visitorId, blog: id });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key = this visitor already clicked this blog before — not an error, just a no-op
        return res.status(200).json({
          success: true,
          counted: false,
          visits: blog.visits,
        });
      }
      throw err; // unexpected error — let the outer catch handle it
    }

    // First-ever click from this visitor for this blog — increment the counter
    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      { $inc: { visits: 1 } },
      { new: true },
    ).select("visits");

    res.status(200).json({
      success: true,
      counted: true,
      visits: updatedBlog.visits,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Something went wrong while registering the click",
    });
  }
};

const createBlog = async (req, res) => {
  try {
    const { title, tag, details } = req.body;
    const authorId = req.user?._id;

    const errors = [];

    // --- Auth check ---
    if (!authorId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to create a blog post",
      });
    }

    // --- Title ---
    if (typeof title !== "string" || title.trim().length === 0) {
      errors.push("Title is required and cannot be empty or whitespace");
    } else if (title.trim().length < 3) {
      errors.push("Title must be at least 3 characters long");
    } else if (title.trim().length > 150) {
      errors.push("Title cannot exceed 150 characters");
    }

    // --- Details ---
    if (typeof details !== "string" || details.trim().length === 0) {
      errors.push("Details is required and cannot be empty or whitespace");
    } else if (details.trim().length < 20) {
      errors.push("Details must be at least 20 characters long");
    }

    // --- Tag (optional) ---
    if (tag !== undefined && tag !== null && tag !== "") {
      if (typeof tag !== "string") {
        errors.push("Tag must be a string");
      } else if (tag.trim().length > 30) {
        errors.push("Tag cannot exceed 30 characters");
      }
    }

    // --- Image (required, single file) ---
    const imageFile = req.file; // assuming upload.single("image") on the route
    if (!imageFile) {
      errors.push("A blog image is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // --- Verify the image is genuinely an image (magic-byte check) ---
    const imageCheck = await verifyImageBuffer(imageFile.buffer);
    if (!imageCheck.valid) {
      return res.status(400).json({
        success: false,
        message: `Image rejected: ${imageCheck.reason}`,
      });
    }

    // --- Upload to ImageKit ---
    const imageUpload = await imagekit.files.upload({
      file: imageFile.buffer.toString("base64"),
      fileName: imageFile.originalname,
      folder: "/blogs",
      useUniqueFileName: true,
    });

    // --- Create ---
    const blog = await Blog.create({
      title: title.trim(),
      image: imageUpload.url,
      tag: tag && tag.trim().length > 0 ? tag.trim() : null,
      details: details.trim(),
      author: authorId,
      isPublished: true,
    });

    const populatedBlog = await blog.populate("author", "name");

    res.status(201).json({
      success: true,
      blog: populatedBlog,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Something went wrong while creating the blog post",
    });
  }
};

module.exports = { getAllBlogs, registerBlogClick, createBlog };
