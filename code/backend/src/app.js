
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const mlService = require("./services/mlService");
require("dotenv").config();

const app = express();

if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
}

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Connect to MongoDB
connectDB();

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not configured.");
}

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }

      console.warn(`CORS: rejected origin ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json({ limit: "1mb" }));

const { apiLimiter, authLimiter } = require("./middleware/rateLimit");

// Routes
app.use("/api/auth", authLimiter, require("./routes/authRoutes"));
app.use("/api", apiLimiter);
app.use("/api/meters", require("./routes/meterRoutes"));
app.use("/api/anomalies", require("./routes/anomalyRoutes"));
app.use("/api/forecast", require("./routes/forecastRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/investigations", require("./routes/investigationRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));

// Render liveness check: confirms that the API process is responding.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "MeterIQ API",
    timestamp: new Date().toISOString(),
  });
});

// Detailed dependency health check for monitoring.
app.get("/api/health", async (req, res) => {
  try {
    const ml = await mlService.checkHealth();
    const mongoConnected = mongoose.connection.readyState === 1;

    const healthy = mongoConnected && ml.reachable;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        api: "up",
        mongodb: mongoConnected ? "connected" : "disconnected",
        ml: ml.reachable ? "up" : "down",
      },
      ml: ml.reachable
        ? { version: ml.version, status: ml.status }
        : { error: ml.error },
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      message: error.message,
    });
  }
});

// Unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API route ${req.method} ${req.originalUrl} was not found`,
  });
});

// Centralized error handler
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
