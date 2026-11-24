const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const mlService = require("./services/mlService");
require("dotenv").config();

const app = express();

// Hosted platforms terminate TLS at their proxy, so Express needs to trust one
// hop to see the real client IP (rate limiting) and protocol (secure cookies).
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
}

// Security headers. crossOriginResourcePolicy is disabled because the API only
// serves JSON/CSV and never embeds third-party assets.
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Connect to MongoDB. The connection helper logs failures but does not kill
// the process, so /health can report the actual state instead of the API
// disappearing without explanation.
connectDB();

if (!process.env.JWT_SECRET) {
  console.warn(
    "JWT_SECRET is not set. Authentication cannot work; set it in the environment before serving traffic."
  );
}

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
      // Reject by omitting the CORS headers (the browser blocks the response)
      // instead of throwing, which would surface as a 500 for a policy decision.
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

// Health check reports each dependency instead of a constant "healthy".
// Exposed at both /health (platform probes) and /api/health (client probing
// `{API_BASE_URL}/health` without special-casing the root path).
async function healthHandler(req, res) {
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
}

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

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
