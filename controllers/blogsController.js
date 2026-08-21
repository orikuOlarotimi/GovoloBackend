const Blog = require("../models/Blog");
const BlogClick = require("../models/BlogClick");

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


module.exports = { getAllBlogs, registerBlogClick };
