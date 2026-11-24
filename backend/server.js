const app = require("./src/app");
require("dotenv").config();

const PORT = Number(process.env.PORT || 5050);
// Hosted platforms require binding to all interfaces; local development can
// stay on loopback by setting HOST explicitly.
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`MeterIQ API listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing HTTP server.`);
  server.close(() => process.exit(0));
  // Do not hang forever if a connection will not drain.
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
