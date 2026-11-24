import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `VITE_BASE_PATH` lets the same source build for different mount points.
// Vercel (and other root hosts) serve at "/"; a sub-path deploy can override it.
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: Number(process.env.PORT || 5173),
  },
  preview: {
    port: Number(process.env.PORT || 4173),
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
