const rateLimit = require("express-rate-limit");

// Behind Render/Railway/Fly the client IP arrives in X-Forwarded-For; the app
// enables `trust proxy` so express-rate-limit keys on the real address.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests from this address. Try again shortly." },
});

// Credential endpoints are the expensive ones to attack, so they get a much
// tighter budget than read-only analytics.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "Too many authentication attempts. Wait 15 minutes and try again.",
  },
});

module.exports = { apiLimiter, authLimiter };
