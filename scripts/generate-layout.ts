// Deterministic spherical force layout for the literary-affinity mode.
//
//   npm run layout:generate          incremental: frozen authors keep coords,
//                                    new authors placed among their neighbors
//   npm run layout:full              recompute everything, bump minor version
//
// Same data + same seed => identical output (guaranteed by seeded PRNG and
// sorted iteration order; verified by tests/layout.test.ts).

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections, DATA_DIR } from "./lib/load-node.ts";
import { mulberry32, hashString } from "../src/lib/rng.ts";
import {
  add,
  dot,
  geodesic,
  normalize,
  scale,
  sub,
  type Vec3
} from "../src/lib/sphere.ts";
import type { Author, Dataset, PositionsFile, Relation } from "../src/types.ts";

export const LAYOUT_SEED = 20260815;

const TYPE_WEIGHT: Record<Relation["type"], number> = {
  documented_influence: 1.0,
  mentorship: 1.0,
  translation: 0.85,
  dialogue: 0.75,
  affinity: 0.55,
  contrast: 0.35
};

interface WeightedEdge {
  a: string;
  b: string;
  w: number;
}

export function buildLayoutEdges(dataset: Dataset): WeightedEdge[] {
  const merged = new Map<string, WeightedEdge>();
  const put = (a: string, b: string, w: number) => {
    const [x, y] = a < b ? [a, b] : [b, a];
    const key = `${x}|${y}`;
    const cur = merged.get(key);
    if (cur) cur.w = Math.min(1.6, cur.w + w);
    else merged.set(key, { a: x, b: y, w });
  };

  for (const r of dataset.relations) {
    put(r.sourceId, r.targetId, TYPE_WEIGHT[r.type] * r.weight);
  }

  // soft tag affinity: shared movements/periods/languages pull gently, so the
  // sphere clusters by literary culture even where explicit edges are sparse
  const authors = [...dataset.authors].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = 0; i < authors.length; i++) {
    for (let j = i + 1; j < authors.length; j++) {
      const A = authors[i]!;
      const B = authors[j]!;
      let w = 0;
      const sharedMv = A.movements.filter((m) => B.movements.includes(m)).length;
      w += Math.min(0.4, sharedMv * 0.22);
      if (A.periods.some((p) => B.periods.includes(p))) w += 0.08;
      if (A.languages.some((l) => B.languages.includes(l))) w += 0.16;
      if (A.regions.some((r) => B.regions.includes(r))) w += 0.1;
      if (w > 0.12) put(A.id, B.id, w * 0.5);
    }
  }
  return [...merged.values()];
}

function seededPointOnSphere(id: string, seed: number): Vec3 {
  const rng = mulberry32(hashString(id) ^ seed);
  // uniform on sphere
  const u = rng() * 2 - 1;
  const phi = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(phi), u, s * Math.sin(phi)];
}

function tangentStep(p: Vec3, force: Vec3, step: number): Vec3 {
  // project force onto tangent plane at p, take a step, renormalize to sphere
  const radial = scale(p, dot(force, p));
  const tangent = sub(force, radial);
  return normalize(add(p, scale(tangent, step)));
}

export interface LayoutOptions {
  seed?: number;
  iterations?: number;
  /** ids whose positions are frozen (incremental mode) */
  frozen?: Map<string, Vec3>;
}

export function computeLayout(dataset: Dataset, opts: LayoutOptions = {}): Map<string, Vec3> {
  const seed = opts.seed ?? LAYOUT_SEED;
  const iterations = opts.iterations ?? 700;
  const frozen = opts.frozen ?? new Map<string, Vec3>();

  const authors = [...dataset.authors].sort((a, b) => (a.id < b.id ? -1 : 1));
  const ids = authors.map((a) => a.id);
  const edges = buildLayoutEdges(dataset);

  const pos = new Map<string, Vec3>();
  for (const a of authors) {
    const f = frozen.get(a.id);
    // frozen coords are copied verbatim — renormalizing would drift the last bit
    pos.set(a.id, f ? ([f[0], f[1], f[2]] as Vec3) : initialPosition(a, seed, frozen, edges));
  }

  const movable = ids.filter((id) => !frozen.has(id));
  if (movable.length === 0) return pos;

  const kAtt = 0.06;
  const kRep = 0.015;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;
    const step = 0.5 * cooling + 0.02;
    const forces = new Map<string, Vec3>();
    for (const id of movable) forces.set(id, [0, 0, 0]);

    // attraction along weighted edges
    for (const e of edges) {
      const pa = pos.get(e.a);
      const pb = pos.get(e.b);
      if (!pa || !pb) continue;
      const d = geodesic(pa, pb);
      const pull = kAtt * e.w * d;
      const dirAB = sub(pb, pa);
      const fa = forces.get(e.a);
      if (fa) forces.set(e.a, add(fa, scale(dirAB, pull)));
      const fb = forces.get(e.b);
      if (fb) forces.set(e.b, add(fb, scale(dirAB, -pull)));
    }

    // all-pairs repulsion (n=100–400: brute force is fine and deterministic)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ia = ids[i]!;
        const ib = ids[j]!;
        const pa = pos.get(ia)!;
        const pb = pos.get(ib)!;
        const d = geodesic(pa, pb) + 0.02;
        const push = kRep / (d * d);
        const dirAB = sub(pb, pa);
        const fa = forces.get(ia);
        if (fa) forces.set(ia, add(fa, scale(dirAB, -push)));
        const fb = forces.get(ib);
        if (fb) forces.set(ib, add(fb, scale(dirAB, push)));
      }
    }

    for (const id of movable) {
      pos.set(id, tangentStep(pos.get(id)!, forces.get(id)!, step));
    }
  }

  relaxCollisions(pos, movable, 0.045, 24);
  return pos;
}

/** new authors start at the weighted centroid of their already-placed neighbors */
function initialPosition(
  author: Author,
  seed: number,
  frozen: Map<string, Vec3>,
  edges: WeightedEdge[]
): Vec3 {
  if (frozen.size > 0) {
    let acc: Vec3 = [0, 0, 0];
    let total = 0;
    for (const e of edges) {
      const other = e.a === author.id ? e.b : e.b === author.id ? e.a : null;
      if (!other) continue;
      const p = frozen.get(other);
      if (!p) continue;
      acc = add(acc, scale(p, e.w));
      total += e.w;
    }
    if (total > 0.2) {
      const jitter = seededPointOnSphere(author.id, seed);
      return normalize(add(normalize(acc), scale(jitter, 0.05)));
    }
  }
  return seededPointOnSphere(author.id, seed);
}

function relaxCollisions(
  pos: Map<string, Vec3>,
  movable: string[],
  minDist: number,
  rounds: number
): void {
  const movableSet = new Set(movable);
  const ids = [...pos.keys()].sort();
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ia = ids[i]!;
        const ib = ids[j]!;
        const pa = pos.get(ia)!;
        const pb = pos.get(ib)!;
        const d = geodesic(pa, pb);
        if (d >= minDist) continue;
        const overlap = (minDist - d) / 2 + 0.002;
        const dir = d < 1e-5 ? seededPointOnSphere(ia + ib, 7) : sub(pb, pa);
        if (movableSet.has(ia)) {
          pos.set(ia, tangentStep(pa, dir, -overlap * 3));
          moved = true;
        }
        if (movableSet.has(ib)) {
          pos.set(ib, tangentStep(pb, dir, overlap * 3));
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

export function layoutQuality(dataset: Dataset, pos: Map<string, Vec3>): {
  meanLinked: number;
  meanRandom: number;
} {
  let linkedSum = 0;
  let linkedN = 0;
  for (const r of dataset.relations) {
    const a = pos.get(r.sourceId);
    const b = pos.get(r.targetId);
    if (!a || !b) continue;
    linkedSum += geodesic(a, b);
    linkedN++;
  }
  const ids = [...pos.keys()].sort();
  let randSum = 0;
  let randN = 0;
  const rng = mulberry32(42);
  for (let k = 0; k < 4000; k++) {
    const i = Math.floor(rng() * ids.length);
    const j = Math.floor(rng() * ids.length);
    if (i === j) continue;
    randSum += geodesic(pos.get(ids[i]!)!, pos.get(ids[j]!)!);
    randN++;
  }
  return {
    meanLinked: linkedN ? linkedSum / linkedN : NaN,
    meanRandom: randN ? randSum / randN : NaN
  };
}

// --- CLI -------------------------------------------------------------------

const isMain = process.argv[1]?.endsWith("generate-layout.ts");
if (isMain) {
  const full = process.argv.includes("--full");
  const raw = loadRawCollections();
  const { dataset, errors } = assembleDataset(raw, { allowPartial: true });
  if (!dataset) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  const prev = dataset.positions;
  const frozen = new Map<string, Vec3>();
  if (!full && prev.version !== "0.0.0") {
    const alive = new Set(dataset.authors.map((a) => a.id));
    for (const [id, p] of Object.entries(prev.positions)) {
      if (alive.has(id)) frozen.set(id, p);
    }
  }

  const pos = computeLayout(dataset, { seed: LAYOUT_SEED, frozen });
  const q = layoutQuality(dataset, pos);

  const version = full || prev.version === "0.0.0"
    ? bumpMinor(prev.version === "0.0.0" ? "0.0.0" : prev.version)
    : prev.version;
  const out: PositionsFile = {
    version,
    seed: LAYOUT_SEED,
    generatedAt: new Date().toISOString().slice(0, 10),
    positions: Object.fromEntries(
      [...pos.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([id, p]) => [id, [round6(p[0]), round6(p[1]), round6(p[2])] as Vec3])
    )
  };
  writeFileSync(join(DATA_DIR, "positions.v1.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    [
      `layout ${full ? "FULL" : "incremental"} → positions.v1.json (v${out.version}, seed ${LAYOUT_SEED})`,
      `authors placed  ${pos.size} (frozen kept: ${frozen.size})`,
      `mean geodesic   linked pairs ${q.meanLinked.toFixed(3)} rad vs random pairs ${q.meanRandom.toFixed(3)} rad`,
      q.meanLinked < q.meanRandom * 0.75
        ? "quality OK: linked pairs are markedly closer than random"
        : "quality WARNING: linked pairs not much closer than random — inspect weights"
    ].join("\n")
  );
}

function bumpMinor(v: string): string {
  const [maj = "1", min = "-1"] = v.split(".");
  if (v === "0.0.0") return "1.0.0";
  return `${maj}.${Number(min) + 1}.0`;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
