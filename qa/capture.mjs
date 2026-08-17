#!/usr/bin/env node
// Automated 3D QA capture (docs/qa-harness.md).
//
//   npm run qa:capture -- --scene kafka [--output artifacts/kafka]
//                         [--renderer auto|hardware|swiftshader] [--overlay]
//   npm run qa:all
//
// Per scene it writes: frames/NNN-<beat>.png, recording.webm, metrics.json,
// events.json, scene-state.json, console.json, manifest.json (sha256).
// Exit codes: 0 pass · 2 assertion/console failure · 3 environment failure
// (WebGL unavailable etc. — reported in failure-report.json, never silently
// downgraded to 2D).
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { listFiles, serveDist, sha256 } from "./lib.mjs";
import { SCENES } from "./scenes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name) {
  return args.includes(`--${name}`);
}
function opt(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : dflt;
}
const sceneNames = flag("all")
  ? Object.keys(SCENES)
  : opt("scene", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
const rendererMode = opt("renderer", "auto"); // auto | hardware | swiftshader
const overlay = flag("overlay");
const distDir = path.resolve(ROOT, opt("dist", "dist"));
const outBase = path.resolve(ROOT, opt("output", "artifacts"));

if (sceneNames.length === 0) {
  console.error(`usage: qa:capture -- --scene <${Object.keys(SCENES).join("|")}> | --all`);
  process.exit(1);
}
for (const s of sceneNames) {
  if (!SCENES[s]) {
    console.error(`unknown scene "${s}" (have: ${Object.keys(SCENES).join(", ")})`);
    process.exit(1);
  }
}
if (!existsSync(path.join(distDir, "index.html"))) {
  console.error(`no build at ${distDir} — run \`npm run build\` first`);
  process.exit(1);
}

// --- canonical data for assertions (read from the repo, offline) ------------
async function loadRelations() {
  const dir = path.join(ROOT, "data", "relations");
  const map = new Map();
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    for (const r of JSON.parse(await readFile(path.join(dir, f), "utf8"))) map.set(r.id, r);
  }
  return map;
}
const relationsById = await loadRelations();
const tours = JSON.parse(await readFile(path.join(ROOT, "data", "tours.json"), "utf8"));
// canonical tectonic keyframes — scenes bind user-facing text to this file
const erasData = JSON.parse(
  await readFile(path.join(ROOT, "data", "territory.v1.eras.json"), "utf8")
);

// --- browser per renderer mode ----------------------------------------------
// hardware = headed Chromium on the host GPU. swiftshader = headless software
// rendering (deterministic, works displayless). auto = hardware first, then
// swiftshader — the §7 contract; the mode actually used is recorded in
// metrics.json, and SwiftShader numbers must never be read as GPU performance.
if (!["auto", "hardware", "swiftshader"].includes(rendererMode)) {
  console.error(`unknown renderer mode "${rendererMode}"`);
  process.exit(1);
}

const VIEWPORT = { width: 1920, height: 1080 };
const server = await serveDist(distDir);

async function launchBrowser() {
  const sw = { headless: true, args: ["--use-angle=swiftshader"] };
  if (rendererMode === "swiftshader") {
    return { browser: await chromium.launch(sw), launched: "swiftshader" };
  }
  try {
    return { browser: await chromium.launch({ headless: false }), launched: "hardware" };
  } catch (err) {
    if (rendererMode === "hardware") throw err; // explicit hardware: no silent fallback
    console.error(`hardware launch failed (${err.message}); falling back to swiftshader`);
    return { browser: await chromium.launch(sw), launched: "swiftshader-fallback" };
  }
}

let browser;
let launched;
try {
  ({ browser, launched } = await launchBrowser());
} catch (err) {
  await server.close();
  console.error(`browser launch failed (${rendererMode}): ${err.message}`);
  process.exit(3);
}

let worstExit = 0;

for (const sceneName of sceneNames) {
  const scene = SCENES[sceneName];
  const outDir = sceneNames.length === 1 && opt("output", null) && !flag("all")
    ? outBase
    : path.join(outBase, sceneName);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, "frames"), { recursive: true });

  const consoleLog = [];
  const violations = [];
  const beats = [];
  const stateSnapshots = [];
  const assertions = [];
  const notes = [];
  let beatIdx = 0;

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: "ko-KR",
    recordVideo: { dir: path.join(outDir, "video-tmp"), size: VIEWPORT },
    // scenes may pin reducedMotion, deviceScaleFactor, locale …
    ...(scene.contextOptions ?? {})
  });
  // visible cursor + click flash so review videos show the input, not just
  // its consequences (2026-08-16 review)
  await context.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const dot = document.createElement("div");
      dot.style.cssText =
        "position:fixed;z-index:99999;width:15px;height:15px;border:2px solid #ffd27a;" +
        "border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);" +
        "box-shadow:0 0 7px rgba(255,210,122,.8);left:-60px;top:-60px";
      document.body.appendChild(dot);
      window.addEventListener("pointermove", (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
      });
      window.addEventListener("pointerdown", () => {
        dot.style.background = "rgba(255,210,122,.55)";
      });
      window.addEventListener("pointerup", () => {
        dot.style.background = "transparent";
      });
    });
  });
  // QA scenes must not touch the network beyond the local bundle — this also
  // proves the build is fully self-contained (offline requirement).
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(server.origin)) return route.continue();
    violations.push(url);
    return route.abort();
  });
  const page = await context.newPage();
  // local asset log with timestamps: the demand-loading gates assert what was
  // requested WHEN (e.g. the eras chunk must not load before timeline intent)
  const requestLog = [];
  const captureStartedAt = Date.now();
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(server.origin)) return;
    requestLog.push({ t: Date.now() - captureStartedAt, path: url.slice(server.origin.length) });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleLog.push({ kind: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => consoleLog.push({ kind: "pageerror", text: String(err) }));
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(server.origin)) {
      consoleLog.push({ kind: "requestfailed", text: req.url() });
    }
  });

  const params = new URLSearchParams(scene.query ?? "");
  if (overlay) params.set("debug", "1");
  const qs = params.toString();
  const baseUrl = `${server.origin}/${qs ? `?${qs}` : ""}`;

  const ctx = {
    page,
    relationsById,
    tours,
    erasData,
    requests: () => [...requestLog],
    data: {},
    async goto(hash) {
      await page.goto(`${baseUrl}${hash}`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__lpQA !== undefined, undefined, { timeout: 10000 });
    },
    async settle(ms) {
      await page.waitForTimeout(ms);
    },
    async waitIdle(timeout = 10000) {
      await page.waitForFunction(
        () => {
          const m = window.__lpQA?.metrics();
          if (!m) return false;
          const r = m.renderer;
          if (!r) return true; // 2D fallback / non-globe pages have no renderer
          return !r.cameraAnimating && !r.modeTransition && !r.safeAreaSettling;
        },
        undefined,
        { timeout }
      );
      await page.waitForTimeout(300); // damping/label tail
    },
    async metrics() {
      return page.evaluate(() => window.__lpQA.metrics());
    },
    async events() {
      return page.evaluate(() => window.__lpQA.events());
    },
    async beat(name) {
      const file = `${String(beatIdx * 10).padStart(3, "0")}-${name}.png`;
      beatIdx++;
      await page.screenshot({ path: path.join(outDir, "frames", file) });
      const m = await this.metrics();
      beats.push({ file, name, at: new Date().toISOString() });
      stateSnapshots.push({ beat: name, metrics: m });
      // each beat's frame stats cover only its own segment — warm-up hitches
      // must not haunt every later number
      await page.evaluate(() => window.__lpQA.resetFrames());
    },
    async drag([x0, y0], [x1, y1]) {
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      }
      await page.mouse.up();
    },
    async wheel(x, y, deltaY) {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, deltaY);
    },
    assert(name, ok, detail) {
      assertions.push({ name, ok: Boolean(ok), detail });
      if (!ok) console.error(`  ✗ ${name}: ${detail}`);
      else console.log(`  ✓ ${name}${detail ? ` (${detail})` : ""}`);
    },
    notImplemented(name, why) {
      assertions.push({ name, ok: null, notImplemented: true, detail: why });
      notes.push(`not_implemented: ${name} — ${why}`);
      console.log(`  ◌ ${name}: not implemented (${why})`);
    }
  };

  console.log(`\n▶ scene ${sceneName} — ${scene.title} [renderer: ${rendererMode}]`);
  let sceneError = null;
  try {
    // environment gate: the 3D scenes require a live WebGL context
    if (sceneName !== "fallback-2d") {
      await ctx.goto("#/");
      const probe = await page.evaluate(() => window.__lpQA?.metrics().renderer ?? null);
      if (!probe) {
        throw Object.assign(new Error("WebGL unavailable in this environment"), { envFailure: true });
      }
    }
    await scene.run(ctx);
  } catch (err) {
    sceneError = err;
    console.error(`  scene error: ${err.message}`);
    try {
      await page.screenshot({ path: path.join(outDir, "frames", "999-error.png") });
    } catch {}
  }

  // release budget: placed labels must never overlap on screen (suppression
  // is the greedy pass doing its job; overlap is a real legibility failure —
  // only must-show labels can produce it, and at most a selected+hovered pair)
  {
    const worst = stateSnapshots.reduce(
      (mx, snap) => Math.max(mx, snap.metrics.renderer?.labelsOverlapping ?? 0),
      0
    );
    ctx.assert("label-overlap-budget", worst <= 2, `worst on-screen overlaps: ${worst} (budget 2)`);
  }

  // --- artifacts -------------------------------------------------------------
  let finalMetrics = null;
  let finalEvents = [];
  try {
    finalMetrics = await ctx.metrics();
    finalEvents = await ctx.events();
  } catch {}

  const gl = finalMetrics?.renderer?.gl ?? null;
  const envFailed = Boolean(sceneError?.envFailure);
  const appErrors = consoleLog.filter((c) => c.kind === "error" || c.kind === "pageerror");
  const failedAsserts = assertions.filter((a) => a.ok === false);
  const status = envFailed
    ? "env-failure"
    : sceneError || failedAsserts.length > 0 || appErrors.length > 0 || violations.length > 0
      ? "failed"
      : assertions.some((a) => a.notImplemented)
        ? "passed-with-gaps"
        : "passed";

  await writeFile(
    path.join(outDir, "metrics.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        scene: sceneName,
        status,
        host: {
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          node: process.version,
          browser: browser.version(),
          rendererMode,
          rendererLaunched: launched
        },
        gl,
        hardwareAccelerated: gl ? !/swiftshader|llvmpipe|software/i.test(gl.renderer) : null,
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        locale: "ko-KR",
        final: finalMetrics
      },
      null,
      2
    )
  );
  await writeFile(path.join(outDir, "events.json"), JSON.stringify(finalEvents, null, 2));
  await writeFile(path.join(outDir, "scene-state.json"), JSON.stringify(stateSnapshots, null, 2));
  await writeFile(
    path.join(outDir, "console.json"),
    JSON.stringify({ messages: consoleLog, blockedExternalRequests: violations }, null, 2)
  );
  await writeFile(path.join(outDir, "requests.json"), JSON.stringify(requestLog, null, 2));
  if (envFailed) {
    await writeFile(
      path.join(outDir, "failure-report.json"),
      JSON.stringify(
        {
          reason: "webgl-unavailable",
          rendererMode,
          message: sceneError.message,
          host: { platform: os.platform(), arch: os.arch(), browser: browser.version() },
          remedy:
            "retry with --renderer swiftshader; if that also fails, capture the 2D surface with --scene fallback-2d"
        },
        null,
        2
      )
    );
  }

  // close context to flush the video, then give it its contractual name
  const video = page.video();
  await context.close();
  if (video) {
    try {
      await rename(await video.path(), path.join(outDir, "recording.webm"));
    } catch {
      notes.push("recording.webm unavailable in this environment; PNG frames are authoritative");
    }
  }
  await rm(path.join(outDir, "video-tmp"), { recursive: true, force: true });

  const files = [];
  for (const f of await listFiles(outDir)) {
    files.push({ ...f, sha256: await sha256(path.join(outDir, f.path)) });
  }
  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        scene: sceneName,
        title: scene.title,
        status,
        command: `npm run qa:capture -- --scene ${sceneName} --renderer ${rendererMode}${overlay ? " --overlay" : ""}`,
        beats,
        assertions,
        notes,
        consoleErrors: appErrors.length,
        blockedExternalRequests: violations.length,
        error: sceneError ? String(sceneError.message) : null,
        files
      },
      null,
      2
    )
  );

  {
    const okN = assertions.filter((a) => a.ok === true).length;
    const gapN = assertions.filter((a) => a.notImplemented).length;
    const failN = assertions.filter((a) => a.ok === false).length;
    console.log(
      `  → ${status} · ${beats.length} beats · ${okN} pass${gapN ? ` / ${gapN} gap` : ""}${failN ? ` / ${failN} FAIL` : ""} · ${appErrors.length} console errors · ${outDir}`
    );
  }
  if (envFailed) worstExit = Math.max(worstExit, 3);
  else if (status === "failed") worstExit = Math.max(worstExit, 2);
}

await browser.close();
await server.close();
process.exit(worstExit);
