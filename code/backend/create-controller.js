require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./src/models/User");

async function createController() {
  const {
    MONGODB_URI,
    CONTROLLER_EMAIL,
    CONTROLLER_PASSWORD,
    CONTROLLER_NAME,
  } = process.env;

  if (!MONGODB_URI || !CONTROLLER_EMAIL || !CONTROLLER_PASSWORD || !CONTROLLER_NAME) {
    throw new Error("Missing required Controller environment variables.");
  }

  if (CONTROLLER_PASSWORD.length < 12) {
    throw new Error("Controller password must be at least 12 characters.");
  }

  await mongoose.connect(MONGODB_URI);

  const email = CONTROLLER_EMAIL.trim().toLowerCase();
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.role === "admin") {
      console.log("Controller account already exists. No changes made.");
      return;
    }

    throw new Error("An account with this email already exists. No changes made.");
  }

  await User.create({
    fullName: CONTROLLER_NAME.trim(),
    email,
    password: CONTROLLER_PASSWORD,
    role: "admin",
    isActive: true,
  });

  console.log("Controller account created successfully.");
}

createController()
  .catch((error) => {
    console.error("Controller setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
