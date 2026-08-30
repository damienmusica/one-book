import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};
const commit = (() => {
  // reproducibility ladder (5th review): env pin > live git > BUILD_COMMIT
  // file (written into source snapshots, where .git does not exist)
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT.trim();
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    try {
      return readFileSync(new URL("./BUILD_COMMIT", import.meta.url), "utf8").trim();
    } catch {
      return "unknown";
    }
  }
})();

// Relative base + hash routing: the built app works from any static path
// (GitHub Pages subpath, local file server) without rewrite rules.
export default defineConfig({
  base: "./",
  define: {
    __BUILD_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(commit)
  },
  plugins: [react()],
  // the paint worker dynamic-imports the eras chunk — ES-module workers only
  worker: { format: "es" },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      // 정문 교체 (2026-08-29, CPO): index.html 이 곧 성계다. universe.html 은
      // 같은 앱의 별칭 엔트리로 남는다 — 프로토콜·문서·하네스의 /universe
      // 딥링크가 살아 있어야 하므로. 행성 앱은 git 히스토리로 은퇴했다.
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        universe: new URL("./universe.html", import.meta.url).pathname,
        // B안(2D 성좌도) — 3안 비교 프로토타입 (판결 §5-1)
        chart: new URL("./chart.html", import.meta.url).pathname
      },
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
