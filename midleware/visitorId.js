// middlewares/visitorId.js
const crypto = require("crypto");

const VISITOR_COOKIE_NAME = "visitorId";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const assignVisitorId = (req, res, next) => {
  try {
    const existingId = req.cookies?.[VISITOR_COOKIE_NAME];

    if (existingId) {
      req.visitorId = existingId;
      return next();
    }

    const newId = crypto.randomUUID();

    res.cookie(VISITOR_COOKIE_NAME, newId, {
      maxAge: ONE_YEAR_MS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    req.visitorId = newId;
    next();
  } catch (error) {
    // Cookie handling failed for any reason — never block the request.
    // req.visitorId simply stays undefined; downstream code already
    // treats that as "don't count this click," not an error.
    req.visitorId = undefined;
    next();
  }
};

module.exports = assignVisitorId;
