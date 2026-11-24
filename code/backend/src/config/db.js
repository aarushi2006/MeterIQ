const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/meteriq");
    console.log("MongoDB Connected...");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    console.error("Authentication and investigation persistence will be unavailable until MongoDB is reachable.");
  }
};

module.exports = connectDB;
