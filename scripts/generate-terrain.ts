// P0 terrain prototype (thesis v2 §⑦) — offline, deterministic, renderer-free.
// Renders a double-hemisphere orthographic debug plate (SVG) from the frozen
// affinity layout + §②-2 area weights; on --freeze, writes data/territory.v1.json.
//
//   npm run terrain:plate                    # writes docs/plates/p0-terrain.svg
//   npm run terrain:plate -- --n 400         # coarser/finer raster
//   npm run terrain:plate -- --R0 0.12 --tau 0.5 --warp 0.1
//   npm run terrain:plate -- --freeze        # also freeze data/territory.v1.json

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { normalize } from "../src/lib/sphere.ts";
import type { Vec3 } from "../src/lib/sphere.ts";
import { COLORS, PERIOD_TINT } from "../src/theme.ts";
import {
  DEFAULT_PARAMS,
  bakeGeometry,
  boundarySegments,
  buildKernels,
  computeWeights,
  landAreas,
  marchingSquares,
  orthoBasis,
  rasterizeHemisphere,
  stitchSegments,
  type AuthorKernel,
  type TerrainParams
} from "./lib/terrain.ts";
import { territorySchema } from "../src/schema.ts";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const params: TerrainParams = {
  ...DEFAULT_PARAMS,
  R0: Number(arg("R0") ?? DEFAULT_PARAMS.R0),
  tau: Number(arg("tau") ?? DEFAULT_PARAMS.tau),
  warpAmp: Number(arg("warp") ?? DEFAULT_PARAMS.warpAmp),
  warpFreq: Number(arg("freq") ?? DEFAULT_PARAMS.warpFreq)
};
const N = Number(arg("n") ?? 640);
const FREEZE = process.argv.includes("--freeze");

// the generator rebuilds the territory file — never validate against (or
// depend on) its own previous output
const rawCollections = loadRawCollections();
rawCollections.territory = undefined;
const { dataset, errors } = assembleDataset(rawCollections, {});
if (!dataset) {
  console.error(errors.slice(0, 10).join("\n"));
  process.exit(1);
}

const seeds = new Map<string, Vec3>();
for (const [id, p] of Object.entries(dataset.positions.positions)) {
  seeds.set(id, normalize(p));
}
const weights = computeWeights(dataset);
const kernels = buildKernels(seeds, weights, params);
const authorById = new Map(dataset.authors.map((a) => [a.id, a]));

// front view: mass centroid of all seeds; back view: antipode
let mx = 0, my = 0, mz = 0;
for (const [id, p] of seeds) {
  const w = weights.get(id) ?? 1;
  mx += p[0] * w; my += p[1] * w; mz += p[2] * w;
}
const front = normalize([mx, my, mz]);
const back: Vec3 = [-front[0], -front[1], -front[2]];

console.log(`terrain P0 — seed ${params.seed}, R0 ${params.R0}, tau ${params.tau}, warp ${params.warpAmp}@${params.warpFreq}, grid ${N}`);

const { shares, landFraction } = landAreas(kernels, params);
console.log(`land fraction: ${(landFraction * 100).toFixed(1)}%  territories with land: ${shares.size}/100`);

// gate ③ readout: does the area hierarchy follow the editorial tiers?
const tierMean = (tier: string) => {
  const ids = dataset.authors.filter((a) => a.tier === tier).map((a) => a.id);
  const vals = ids.map((id) => shares.get(id) ?? 0);
  return vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
};
console.log(
  `mean land share — anchor ${(tierMean("anchor") * 1e4).toFixed(2)}‱  major ${(tierMean("major") * 1e4).toFixed(2)}‱  ratio ${(tierMean("anchor") / (tierMean("major") || 1)).toFixed(2)}`
);
const landless = dataset.authors.filter((a) => !shares.has(a.id)).map((a) => a.id);
if (landless.length > 0) console.log(`landless authors (${landless.length}): ${landless.slice(0, 8).join(", ")}${landless.length > 8 ? "…" : ""}`);

// --- SVG plate ---------------------------------------------------------------

const R = 340; // hemisphere disc radius in px
const MARGIN = 46;
const GAP = 70;
const WIDTH = MARGIN * 2 + R * 4 + GAP;
const HEIGHT = MARGIN * 2 + R * 2 + 56;
const COAST = "#8e733f";

function toPx(g: number, n: number, c: number, off: number): number {
  return off + ((g / (n - 1)) * 2 - 1) * R + 0; // grid coord → [-R, R] around center handled by caller
}

function hemiSvg(forward: Vec3, cxPx: number, cyPx: number, label: string): string {
  const grid = rasterizeHemisphere(forward, kernels, params, N);
  const px = (p: [number, number]) =>
    `${(cxPx + ((p[0] / (N - 1)) * 2 - 1) * R).toFixed(1)},${(cyPx + ((p[1] / (N - 1)) * 2 - 1) * R).toFixed(1)}`;

  const pathOf = (lines: Array<Array<[number, number]>>, close: boolean) =>
    lines
      .filter((l) => l.length > 3)
      .map((l) => "M" + l.map(px).join("L") + (close ? "Z" : ""))
      .join("");

  const coastLines = stitchSegments(marchingSquares(grid, params.tau));
  const water1 = stitchSegments(marchingSquares(grid, params.tau * 0.72));
  const water2 = stitchSegments(marchingSquares(grid, params.tau * 0.5));
  const bounds = boundarySegments(grid, params.tau);

  const landPath = pathOf(coastLines, true);
  const boundPath = bounds
    .map(([a, b]) => `M${px(a)}L${px(b)}`)
    .join("");

  // graticule: 30° circles + crosshair of the orthographic view — instrument
  // chrome (thesis D1), NOT field contours. VAD P0 condition, resolved at code
  // level: the only field iso-lines drawn anywhere are the coast (tau) and the
  // two waterlines (0.72*tau, 0.5*tau); land satisfies F >= tau everywhere, so
  // sub-tau waterline contours cannot mathematically enter land, and no
  // height/relief layer exists. Nothing here leaks into P1 by accident — P1
  // draws only baked coast/boundary geometry.
  let grat = "";
  for (let k = 1; k <= 2; k++) {
    grat += `<circle cx="${cxPx}" cy="${cyPx}" r="${(R * Math.sin((k * 30 * Math.PI) / 180)).toFixed(1)}" fill="none" stroke="${COLORS.line}" stroke-opacity="0.35" stroke-width="0.7"/>`;
  }
  grat += `<line x1="${cxPx - R}" y1="${cyPx}" x2="${cxPx + R}" y2="${cyPx}" stroke="${COLORS.line}" stroke-opacity="0.35" stroke-width="0.7"/>`;
  grat += `<line x1="${cxPx}" y1="${cyPx - R}" x2="${cxPx}" y2="${cyPx + R}" stroke="${COLORS.line}" stroke-opacity="0.35" stroke-width="0.7"/>`;

  // capitals + labels for territories visible on this hemisphere
  const { right, up } = orthoBasis(forward);
  let capitals = "";
  let labels = "";
  const visible: Array<{ id: string; u: number; v: number; share: number }> = [];
  for (const k of kernels) {
    const d = k.seed[0] * forward[0] + k.seed[1] * forward[1] + k.seed[2] * forward[2];
    if (d < 0.05) continue;
    const u = k.seed[0] * right[0] + k.seed[1] * right[1] + k.seed[2] * right[2];
    const v = k.seed[0] * up[0] + k.seed[1] * up[1] + k.seed[2] * up[2];
    visible.push({ id: k.id, u, v, share: shares.get(k.id) ?? 0 });
  }
  for (const s of visible) {
    const a = authorById.get(s.id);
    if (!a) continue;
    const x = cxPx + s.u * R;
    const y = cyPx + s.v * R;
    const tint = PERIOD_TINT[a.periods[0] ?? "early-modernism"];
    const size = a.tier === "anchor" ? 5 : 3.2;
    capitals += `<rect x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" width="${size}" height="${size}" fill="${tint}" stroke="${COLORS.bg}" stroke-width="0.6" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  const top = visible.sort((a, b) => b.share - a.share).slice(0, 14);
  for (const s of top) {
    const a = authorById.get(s.id);
    if (!a) continue;
    const x = cxPx + s.u * R;
    const y = cyPx + s.v * R;
    labels += `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-family="Georgia, 'Nanum Myeongjo', serif" font-size="10.5" fill="${COLORS.textDim}">${a.names.ko}</text>`;
  }

  return `
  <g>
    <circle cx="${cxPx}" cy="${cyPx}" r="${R}" fill="${COLORS.surface}" stroke="${COLORS.lineAccent}" stroke-opacity="0.7" stroke-width="1.4"/>
    ${grat}
    <clipPath id="clip-${label}"><circle cx="${cxPx}" cy="${cyPx}" r="${R}"/></clipPath>
    <g clip-path="url(#clip-${label})">
      <path d="${pathOf(water2, false)}" fill="none" stroke="${COLORS.lineAccent}" stroke-opacity="0.15" stroke-width="0.8"/>
      <path d="${pathOf(water1, false)}" fill="none" stroke="${COLORS.lineAccent}" stroke-opacity="0.3" stroke-width="0.8"/>
      <path d="${landPath}" fill="${COLORS.surfaceRaised}" fill-rule="evenodd"/>
      <path d="${boundPath}" stroke="${COLORS.line}" stroke-opacity="0.55" stroke-width="0.7" fill="none"/>
      <path d="${pathOf(coastLines, false)}" fill="none" stroke="${COAST}" stroke-width="1.3"/>
      ${capitals}
      ${labels}
    </g>
    <text x="${cxPx}" y="${cyPx + R + 24}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="12" fill="${COLORS.textFaint}" letter-spacing="0.15em">${label}</text>
  </g>`;
}

const c1x = MARGIN + R;
const c2x = MARGIN + R * 3 + GAP;
const cy = MARGIN + R;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.bg}"/>
  ${hemiSvg(front, c1x, cy, "hemisphaerium primum")}
  ${hemiSvg(back, c2x, cy, "hemisphaerium alterum")}
  <text x="${WIDTH / 2}" y="${HEIGHT - 14}" text-anchor="middle" font-family="Georgia, 'Nanum Myeongjo', serif" font-size="13" fill="${COLORS.textDim}" letter-spacing="0.22em">문학의 행성 · 지형 시험 인쇄 P0 — seed ${params.seed} · R0 ${params.R0} · τ ${params.tau} · warp ${params.warpAmp}/${params.warpFreq} · land ${(landFraction * 100).toFixed(1)}%</text>
</svg>
`;

const platesDir = join(PKG_ROOT, "docs", "plates");
mkdirSync(platesDir, { recursive: true });
const out = join(platesDir, "p0-terrain.svg");
writeFileSync(out, svg);
console.log(`plate: ${out} (${(svg.length / 1024).toFixed(0)} KB)`);

if (FREEZE) {
  // P1: bake the renderer-facing geometry from the same field. Deterministic —
  // re-baking the same seed+params is a byte-identical no-op (except the date).
  // P3: works ride along as towns/ports/roads inside their author's territory.
  const t0 = Date.now();
  const worksByAuthor = new Map<string, string[]>();
  for (const a of dataset.authors) {
    const order = a.readingOrder;
    const rest = dataset.works
      .filter((w) => w.authorId === a.id && !order.includes(w.id))
      .sort((x, y) => x.year - y.year || x.id.localeCompare(y.id))
      .map((w) => w.id);
    worksByAuthor.set(a.id, [...order, ...rest]);
  }
  const geometry = bakeGeometry(kernels, params, undefined, {
    worksByAuthor,
    readingEntry: new Map(dataset.authors.map((a) => [a.id, a.readingEntry])),
    readingOrder: new Map(dataset.authors.map((a) => [a.id, a.readingOrder]))
  });
  const nPts = (lines: number[][]) => lines.reduce((s, l) => s + l.length / 2, 0);
  const cityVals = Object.values(geometry.cities ?? {});
  console.log(
    `bake: coast ${geometry.coast.length} loops/${nPts(geometry.coast)} pts · ` +
      `waterlines ${geometry.waterlines.inner.length}+${geometry.waterlines.outer.length} loops/` +
      `${nPts(geometry.waterlines.inner) + nPts(geometry.waterlines.outer)} pts · ` +
      `boundaries ${geometry.boundaries.length} lines/${nPts(geometry.boundaries)} pts · ` +
      `rle ${geometry.ownerRle.length} rows · ` +
      `towns ${cityVals.reduce((s, c) => s + c.towns.length, 0)} / ports ${cityVals.filter((c) => c.port).length} / landlocked ${cityVals.filter((c) => !c.port && c.towns.length > 0).length} ` +
      `(${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );

  const territory = {
    version: "1.2.0",
    seed: params.seed,
    generatedAt: new Date().toISOString().slice(0, 10),
    params: {
      R0: params.R0,
      tau: params.tau,
      warpAmp: params.warpAmp,
      warpFreq: params.warpFreq,
      warpOctaves: params.warpOctaves,
      kappa: "ln2/(1-cos(R0*sqrt(W)))",
      areaWeight: "tierBase(anchor 2.4, major 1.0, context 0.55) * (1 + 0.3 * degreeHat)"
    },
    landFraction: Number(landFraction.toFixed(4)),
    weights: Object.fromEntries([...weights.entries()].sort().map(([k, v]) => [k, Number(v.toFixed(4))])),
    areaShares: Object.fromEntries([...shares.entries()].sort().map(([k, v]) => [k, Number(v.toFixed(6))])),
    geometry
  };

  // header stays human-reviewable (indented); the geometry subtree is compact —
  // pretty-printing 40k coordinates would put each number on its own line
  const { geometry: geom, ...head } = territory;
  const out = JSON.stringify(head, null, 2).replace(
    /\n}\s*$/,
    `,\n  "geometry": ${JSON.stringify(geom)}\n}`
  );
  const parsed = territorySchema.safeParse(JSON.parse(out));
  if (!parsed.success) {
    console.error("freeze aborted — payload fails territorySchema:");
    console.error(parsed.error.issues.slice(0, 5));
    process.exit(1);
  }
  const tOut = join(PKG_ROOT, "data", "territory.v1.json");
  // **얼어 있는 것은 지형이 아니라 파라미터다.** validate-data 는 작품이 늘면
  // "re-bake territory" 를 시키는데, 이 생성기의 DEFAULT_PARAMS 는 동결 당시의
  // 값이 아니다(동결 R0 0.085·tau 0.62·warp 0.12 vs 기본 0.11·0.5·0.1). 그래서
  // 시키는 대로 `--freeze` 만 돌리면 **다른 행성이 덮어써진다** — 실측:
  // landFraction 0.3229 → 0.6675, 소유권 셀 전면 재배치. 작품 한 편을 더한
  // 사람이 대륙을 갈아엎게 두지 않는다. 기존 동결본이 있으면 그 params 와
  // 대조하고, 다르면 **거부하고 정확한 명령을 알려 준다**(--force-params 로만 뚫린다).
  if (existsSync(tOut) && !process.argv.includes("--force-params")) {
    const prev = JSON.parse(readFileSync(tOut, "utf8")) as {
      params?: Record<string, unknown>;
    };
    const pp = prev.params ?? {};
    const drift = (["R0", "tau", "warpAmp", "warpFreq", "warpOctaves"] as const).filter(
      (k) => pp[k] !== undefined && pp[k] !== params[k]
    );
    if (drift.length) {
      console.error(
        `freeze aborted — 동결본과 파라미터가 다르다: ${drift
          .map((k) => `${k} ${String(pp[k])} → ${String(params[k])}`)
          .join(" · ")}`
      );
      console.error(
        `  같은 행성을 다시 구우려면: npm run terrain:plate -- --freeze --R0 ${String(
          pp.R0
        )} --tau ${String(pp.tau)} --warp ${String(pp.warpAmp)}`
      );
      console.error("  의도적으로 새 행성을 구우려면 --force-params 를 붙인다.");
      process.exit(1);
    }
  }
  writeFileSync(tOut, out + "\n");
  console.log(`frozen: ${tOut} (${(out.length / 1024).toFixed(0)} KB)`);
}
