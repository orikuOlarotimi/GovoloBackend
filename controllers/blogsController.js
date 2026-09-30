const Blog = require("../models/Blogs");
const BlogClick = require("../models/BlogClick");
const imagekit = require("../config/imagekit");
const verifyImageBuffer = require("../services/verifyImage");
const mongoose = require("mongoose");
const User = require("../models/User");

const isBlank = (v) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

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
    // --- Auth check ---
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to perform this action",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.rolePrivilege !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to create a blog post",
      });
    }

    const {
      title,
      tags, // JSON string: string[]
      shortDescription,
      sections, // JSON string: [{ title, content, images: [{ caption }] }]
      quickFacts, // JSON string: string[]
      readTimeMinutes,
    } = req.body;

    const errors = [];

    // --- Helper: safely parse a JSON field from multipart form data ---
    function parseJsonField(raw, fieldName, fallback) {
      if (isBlank(raw)) return fallback;
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        errors.push(`${fieldName} must be valid JSON`);
        return fallback;
      }
    }

    // ===== REQUIRED FIELDS =====

    // --- Title ---
    if (typeof title !== "string" || title.trim().length === 0) {
      errors.push("Title is required and cannot be empty or whitespace");
    }

    // --- Tags (at least one) ---
    const parsedTags = parseJsonField(tags, "Tags", []);
    let cleanTags = [];
    if (!Array.isArray(parsedTags)) {
      errors.push("Tags must be an array");
    } else {
      cleanTags = parsedTags
        .filter((t) => !isBlank(t) && typeof t === "string")
        .map((t) => t.trim());
      if (cleanTags.length === 0) {
        errors.push("At least one tag is required");
      }
    }

    // --- Short description ---
    if (
      typeof shortDescription !== "string" ||
      shortDescription.trim().length === 0
    ) {
      errors.push("Short description is required and cannot be empty");
    }

    // --- Read time ---
    let numericReadTime;
    if (isBlank(readTimeMinutes)) {
      errors.push("Estimated read time is required");
    } else {
      numericReadTime = Number(readTimeMinutes);
      if (!Number.isFinite(numericReadTime) || numericReadTime < 1) {
        errors.push("Estimated read time must be a number of at least 1");
      }
    }

    // --- Main image ---
    const mainImageFile = req.files?.mainImage?.[0];
    if (!mainImageFile) {
      errors.push("Main image is required");
    } else {
      const mainImageCheck = await verifyImageBuffer(mainImageFile.buffer);
      if (!mainImageCheck.valid) {
        errors.push(`Main image rejected: ${mainImageCheck.reason}`);
      }
    }

    // --- Sections (first is required; rest are optional) ---
    // Section images arrive as files under sectionImages_0, sectionImages_1, ...
    // (one field per section index), so each section can carry its own
    // set of up to 3 images without them getting mixed up across sections.
    const parsedSections = parseJsonField(sections, "Sections", []);
    const cleanSections = [];

    if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
      errors.push("The main content section is required");
    } else {
      for (let i = 0; i < parsedSections.length; i++) {
        const section = parsedSections[i];
        const isFirst = i === 0;

        const nothingFilled =
          !isFirst && isBlank(section?.title) && isBlank(section?.content);
        if (nothingFilled) continue; // empty optional section — skip it

        if (isBlank(section?.title)) {
          errors.push(
            isFirst
              ? "The main content section must have a title"
              : `Section #${i + 1} must have a title`,
          );
          continue;
        }
        if (isBlank(section?.content)) {
          errors.push(
            isFirst
              ? "The main content section must have body content"
              : `Section #${i + 1} must have body content`,
          );
          continue;
        }

        // --- Images for this section (optional, max 3) ---
        const sectionImageFiles = req.files?.[`sectionImages_${i}`] || [];
        if (sectionImageFiles.length > 3) {
          errors.push(`Section #${i + 1} can have at most 3 images`);
        }

        const captions = Array.isArray(section?.imageCaptions)
          ? section.imageCaptions
          : [];

        const sectionImageChecks = [];
        for (const file of sectionImageFiles) {
          const check = await verifyImageBuffer(file.buffer);
          if (!check.valid) {
            errors.push(
              `Image "${file.originalname}" in section #${i + 1} rejected: ${check.reason}`,
            );
          } else {
            sectionImageChecks.push(file);
          }
        }

        cleanSections.push({
          title: section.title.trim(),
          content: section.content.trim(),
          _pendingImages: sectionImageChecks, // uploaded after validation passes
          _captions: captions,
        });
      }
    }

    // --- Quick facts (optional) ---
    const parsedQuickFacts = parseJsonField(quickFacts, "Quick facts", []);
    let cleanQuickFacts = [];
    if (!Array.isArray(parsedQuickFacts)) {
      errors.push("Quick facts must be an array");
    } else {
      cleanQuickFacts = parsedQuickFacts
        .filter((f) => !isBlank(f) && typeof f === "string")
        .map((f) => f.trim());
    }

    // --- Bail out if anything failed ---
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    // --- Uploads (only reached once every check has passed) ---
    const mainImageUpload = await imagekit.files.upload({
      file: mainImageFile.buffer.toString("base64"),
      fileName: mainImageFile.originalname,
      folder: "/blogs",
      useUniqueFileName: true,
    });

    const finalSections = await Promise.all(
      cleanSections.map(async (section) => {
        const uploads = await Promise.all(
          section._pendingImages.map((file) =>
            imagekit.files.upload({
              file: file.buffer.toString("base64"),
              fileName: file.originalname,
              folder: "/blogs",
              useUniqueFileName: true,
            }),
          ),
        );

        const images = uploads.map((img, idx) => {
          const entry = { url: img.url };
          const caption = section._captions[idx];
          if (!isBlank(caption)) entry.caption = String(caption).trim();
          return entry;
        });

        const result = { title: section.title, content: section.content };
        if (images.length) result.images = images;
        return result;
      }),
    );

    // --- Build the document: required fields first, optional only if present ---
    const doc = {
      title: title.trim(),
      mainImage: mainImageUpload.url,
      tags: cleanTags,
      shortDescription: shortDescription.trim(),
      sections: finalSections,
      readTimeMinutes: numericReadTime,
      createdBy: user._id,
      isPublished: true,
    };

    if (cleanQuickFacts.length) doc.quickFacts = cleanQuickFacts;

    const blog = await Blog.create(doc);

    res.status(201).json({
      success: true,
      message: "Blog post created successfully",
      blog,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Validation failed",
        errors: messages,
      });
    }

    console.log(error);
    res.status(500).json({
      success: false,
      message: "Something went wrong while creating the blog post",
    });
  }
};

module.exports = { getAllBlogs, registerBlogClick, createBlog };
