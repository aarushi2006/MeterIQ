
const User = require("../models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not configured.");
  process.exit(1);
}

function issueToken(user) {
  return jwt.sign(
    { id: user._id },
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
    isActive: user.isActive !== false,
  };
}

// Disable public registration.
exports.signup = async (req, res) => {
  return res.status(403).json({
    message: "Registration is disabled. Contact the MeterIQ Controller.",
  });
};

// Login with automatically assigned database role.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        message: "Your account is deactivated. Contact the Controller.",
      });
    }

    return res.json({
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed." });
  }
};

// Get authenticated user.
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user || user.isActive === false) {
      return res.status(401).json({
        message: "Account unavailable.",
      });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    return res.status(401).json({ message: "Invalid session." });
  }
};

// Logout.
exports.logout = (req, res) => {
  return res.json({ message: "Logged out successfully." });
};

// Controller: list all users.
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });

    return res.json({
      users: users.map(publicUser),
    });
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({
      message: "Unable to load users.",
    });
  }
};

// Controller: create Analyst or Supervisor.
exports.createUser = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body || {};

    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Full name, email and password are required.",
      });
    }

    if (!["analyst", "supervisor"].includes(role)) {
      return res.status(400).json({
        message: "Role must be analyst or supervisor.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      role,
      isActive: true,
    });

    return res.status(201).json({
      message: "User account created successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      message: "Unable to create account.",
    });
  }
};

// Controller: update user role or account status.
exports.updateUser = async (req, res) => {
  try {
    const { role, isActive } = req.body || {};

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Controller accounts cannot be modified here.",
      });
    }

    if (role !== undefined) {
      if (!["analyst", "supervisor"].includes(role)) {
        return res.status(400).json({
          message: "Role must be analyst or supervisor.",
        });
      }

      user.role = role;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be true or false.",
        });
      }

      user.isActive = isActive;
    }

    await user.save();

    return res.json({
      message: "User updated successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      message: "Unable to update account.",
    });
  }
};
