#!/usr/bin/env node
// Build the review package: everything an external reviewer (human or LLM)
// needs to evaluate the current visual state without running the app —
// WebM/PNG captures, metrics, event logs, a summary table, and repro
// commands. Complements (does not include) the source archive:
//   npm run qa:source-zip
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(ROOT, "artifacts");

if (!existsSync(artifacts)) {
  console.error("no artifacts/ yet — run `npm run qa:all` (or qa:capture) first");
  process.exit(1);
}

const scenes = [];
for (const dir of (await readdir(artifacts, { withFileTypes: true })).filter((d) => d.isDirectory())) {
  const manifestPath = path.join(artifacts, dir.name, "manifest.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const metrics = JSON.parse(
    await readFile(path.join(artifacts, dir.name, "metrics.json"), "utf8")
  );
  scenes.push({ dir: dir.name, manifest, metrics });
}
if (scenes.length === 0) {
  console.error("artifacts/ contains no scene manifests — run qa:capture first");
  process.exit(1);
}

const meta = scenes[0].metrics;
const fps = (m) => m.final?.frame?.avgFps ?? "—";
const lines = [
  `# Literary Planet — QA review bundle`,
  ``,
  `- app: v${meta.final?.app?.version} @${meta.final?.app?.commit} (${meta.final?.app?.layoutVersion})`,
  `- host: ${meta.host.platform}/${meta.host.arch}, node ${meta.host.node}, chromium ${meta.host.browser}`,
  `- gl: ${meta.gl ? `${meta.gl.webgl2 ? "WebGL2" : "WebGL1"} · ${meta.gl.renderer}` : "n/a"}`,
  `- hardware accelerated: ${meta.hardwareAccelerated}`,
  `- viewport: ${meta.viewport.width}×${meta.viewport.height} @ dpr ${meta.deviceScaleFactor}, locale ${meta.locale}`,
  ``,
  `| scene | status | beats | asserts | avg fps | console errors | blocked ext. requests |`,
  `|---|---|---|---|---|---|---|`,
  ...scenes.map(({ dir, manifest, metrics }) => {
    const ok = manifest.assertions.filter((a) => a.ok === true).length;
    const total = manifest.assertions.filter((a) => a.ok !== null).length;
    return `| ${dir} | ${manifest.status} | ${manifest.beats.length} | ${ok}/${total} | ${fps(metrics)} | ${manifest.consoleErrors} | ${manifest.blockedExternalRequests} |`;
  }),
  ``,
  `## Not implemented (declared, not staged)`,
  ...scenes.flatMap(({ dir, manifest }) =>
    manifest.assertions
      .filter((a) => a.notImplemented)
      .map((a) => `- ${dir}: ${a.name} — ${a.detail}`)
  ),
  ``,
  `## Reproduce`,
  "```bash",
  `npm ci && npm run build`,
  ...scenes.map(({ manifest }) => manifest.command),
  `npm run qa:bundle`,
  "```",
  ``
];
await writeFile(path.join(artifacts, "summary.md"), lines.join("\n"));

const version = meta.final?.app?.version ?? "0.0.0";
const commit = meta.final?.app?.commit ?? "unknown";
const zipName = `literary-planet-review-${version}-${commit}.zip`;
execFileSync("zip", ["-qr", zipName, "artifacts"], { cwd: ROOT });
console.log(`review bundle: ${zipName}`);
console.log(`summary: artifacts/summary.md`);
