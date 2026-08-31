// dist/ 를 그대로 내주는 최소 정적 서버. 하네스와 손 확인이 같은 문을 쓴다.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export async function serveDist(distDir = path.join(ROOT, "dist")) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      let file = path.join(distDir, decodeURIComponent(url.pathname));
      // 디렉터리는 index.html — Cloudflare Pages 와 같은 규칙
      const s = await stat(file).catch(() => null);
      if (!s || s.isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

// 직접 실행하면 그냥 띄운다: npm run serve
if (process.argv[1] && process.argv[1].endsWith("serve.mjs")) {
  const s = await serveDist();
  console.log(`dist → ${s.origin}`);
}
