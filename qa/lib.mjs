// Shared plumbing for the QA capture harness: a localhost static server for
// the built bundle, artifact hashing, and file walking. Node stdlib only —
// the harness must run anywhere the repo runs.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

/**
 * Serve a built dist/ directory on an ephemeral 127.0.0.1 port. No rewrites:
 * the app uses hash routing and a relative base, so plain static hosting is
 * the complete contract (the same property that keeps it shell-independent).
 */
export function serveDist(distDir) {
  const root = path.resolve(distDir);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.normalize(path.join(root, rel));
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        port,
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

export function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

/** recursive relative file list (sorted, stable) */
export async function listFiles(dir, base = dir) {
  const out = [];
  for (const name of (await readdir(dir)).sort()) {
    const p = path.join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await listFiles(p, base)));
    else out.push({ path: path.relative(base, p), bytes: s.size });
  }
  return out;
}
