
require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const mongoose = require("mongoose");

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";

let server;

async function startServer() {
  try {
    console.log("Connecting to MongoDB...");

    await connectDB();

    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB connection was not established.");
    }

    console.log("MongoDB connection verified.");

    server = app.listen(PORT, HOST, () => {
      console.log(`MeterIQ API listening on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("MeterIQ API startup failed:", error.message);
    process.exit(1);
  }
}

function shutdown(signal) {
  console.log(`${signal} received, shutting down MeterIQ API.`);

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    } catch (error) {
      console.error("Error closing MongoDB:", error.message);
    }

    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
