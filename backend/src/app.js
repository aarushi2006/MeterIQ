const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const mlService = require("./services/mlService");
require("dotenv").config();

const app = express();

// Connect to MongoDB. The connection helper logs failures but does not kill
// the process, so /health can report the actual state instead of the API
// disappearing without explanation.
connectDB();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/server-side requests that omit Origin.
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/meters", require("./routes/meterRoutes"));
app.use("/api/anomalies", require("./routes/anomalyRoutes"));
app.use("/api/forecast", require("./routes/forecastRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/investigations", require("./routes/investigationRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));

// Health check reports each dependency instead of a constant "healthy".
app.get("/health", async (req, res) => {
  const ml = await mlService.checkHealth();
  const mongoStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const mongoConnected = mongoose.connection.readyState === 1;

  res.status(mongoConnected && ml.reachable ? 200 : 503).json({
    status: mongoConnected && ml.reachable ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      api: "up",
      mongodb: mongoStates[mongoose.connection.readyState] || "unknown",
      ml: ml.reachable ? "up" : "down",
    },
    ml: ml.reachable ? { version: ml.version, status: ml.status } : { error: ml.error },
  });
});

// Fallback for unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route ${req.method} ${req.originalUrl} was not found` });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err.stack || err);
  }

  const payload = {
    message: err.message || "Internal Server Error",
  };

  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV !== "production" && status >= 500) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
});

module.exports = app;
