const User = require("../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "FATAL ERROR: JWT_SECRET is not defined in .env file. Server cannot start safely."
  );
  process.exit(1);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

function issueToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  };
}

exports.signup = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body || {};

    if (!email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "Email, password, and full name are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (String(password).length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    // Roles are assigned by the server. Public signup can only create analysts.
    if (role && role !== "analyst") {
      return res
        .status(403)
        .json({ message: "Cannot sign up for privileged roles" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const user = new User({
      email: normalizedEmail,
      password,
      fullName: String(fullName).trim(),
      role: "analyst",
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User account no longer exists" });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(401).json({ message: "Invalid session" });
  }
};

exports.logout = (req, res) => {
  // Tokens are stateless JWTs; the client discards the token. This endpoint
  // exists so clients have a single, explicit logout call.
  res.json({ message: "Logged out successfully" });
};
