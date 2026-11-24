
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

// Authentication
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", protect, authController.me);

// Controller-only user management
router.get(
  "/users",
  protect,
  authorize("admin"),
  authController.listUsers
);

router.post(
  "/users",
  protect,
  authorize("admin"),
  authController.createUser
);

router.patch(
  "/users/:id",
  protect,
  authorize("admin"),
  authController.updateUser
);

module.exports = router;
