import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Relative base + hash routing: the built app works from any static path
// (GitHub Pages subpath, local file server) without rewrite rules.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          react: ["react", "react-dom"]
        }
      }
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
    setupFiles: ["tests/setup.ts"]
  }
});
