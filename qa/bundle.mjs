#!/usr/bin/env node
// Build the review package: everything an external reviewer (human or LLM)
// needs to evaluate AND run the current build — WebM/PNG captures, metrics,
// event logs, a summary table, the runnable static bundle (dist/, works
// offline: `npx serve dist`), a complete source archive with lockfile
// (git archive), before/after key frames when a baseline exists, and repro
// commands.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

// before/after key frames, when a preserved baseline exists
const beforeDir = path.join(ROOT, "artifacts-before");
const pairsDir = path.join(artifacts, "before-after");
if (existsSync(beforeDir)) {
  await rm(pairsDir, { recursive: true, force: true });
  await mkdir(pairsDir, { recursive: true });
  const KEY_FRAMES = [
    ["overview", "000-initial.png"],
    ["kafka", "010-constellation.png"],
    ["works-cities", "010-towns.png"],
    ["coordinate-transition", "020-geo.png"]
  ];
  for (const [scene, frame] of KEY_FRAMES) {
    const b = path.join(beforeDir, scene, "frames", frame);
    const a = path.join(artifacts, scene, "frames", frame);
    if (existsSync(b)) await copyFile(b, path.join(pairsDir, `${scene}--${frame.replace(".png", "")}--before.png`));
    if (existsSync(a)) await copyFile(a, path.join(pairsDir, `${scene}--${frame.replace(".png", "")}--after.png`));
  }
}

// complete source snapshot (tracked files + lockfile) via git archive —
// run from the repo root with a path filter; subtree-ish forms (HEAD:./)
// produce empty archives from a package subdirectory
const sourceZip = "literary-planet-source.zip";
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: ROOT })
  .toString()
  .trim();
execFileSync(
  "git",
  ["archive", "--format=zip", "-o", path.join(ROOT, sourceZip), "HEAD", "literary-planet"],
  { cwd: repoRoot }
);

await writeFile(
  path.join(ROOT, "REVIEW.md"),
  [
    `# Literary Planet review package — v${version} @${commit}`,
    ``,
    `- \`artifacts/\` — QA captures: per-scene frames, recording.webm, metrics/events/state/console JSON, sha256 manifest; \`artifacts/summary.md\` is the scoreboard${existsSync(pairsDir) ? "; `artifacts/before-after/` holds key-frame pairs" : ""}.`,
    `- \`dist/\` — the runnable app itself. No install, no network: \`npx serve dist\` (or any static server). QA runs with every non-localhost request blocked, so offline operation is machine-verified.`,
    `- \`${sourceZip}\` — complete tracked source + package-lock.json. Reproduce: unzip, \`npm ci && npm run build && npm run qa:all && npm run qa:bundle\`.`,
    ``,
    `Renderer modes: \`--renderer auto|hardware|swiftshader\` (auto = hardware first, SwiftShader fallback; the mode used is recorded in each metrics.json — never read SwiftShader numbers as GPU performance).`,
    ``
  ].join("\n")
);

const zipName = `literary-planet-review-${version}-${commit}.zip`;
await rm(path.join(ROOT, zipName), { force: true });
execFileSync("zip", ["-qr", zipName, "artifacts", "dist", sourceZip, "REVIEW.md"], { cwd: ROOT });
console.log(`review bundle: ${zipName} (artifacts + runnable dist + source zip + REVIEW.md)`);
console.log(`summary: artifacts/summary.md`);
