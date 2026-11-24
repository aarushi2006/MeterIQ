
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "FATAL ERROR: JWT_SECRET is not defined in .env file. Server cannot start safely."
  );
  process.exit(1);
}

// Verify token and fetch the latest user details from MongoDB.
exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Not authorized, no token provided",
    });
  }

  const token = authHeader.slice(7).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User account no longer exists",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        message: "Your account has been deactivated. Contact the Controller.",
      });
    }

    // Always use the current database role, not the role stored in the JWT.
    req.user = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Session expired, please sign in again"
        : "Not authorized, token is invalid";

    return res.status(401).json({
      message,
      code: error.name,
    });
  }
};

// Restrict routes to the specified roles.
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role ${req.user?.role || "unknown"} is not authorized to access this resource`,
      });
    }

    return next();
  };
};
