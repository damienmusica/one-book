import { assembleDataset } from "./assemble.ts";
import type { Dataset } from "../types.ts";
import { latLonToVec3, normalize } from "../lib/sphere.ts";
import type { Vec3 } from "../lib/sphere.ts";

function stripDefaults(mods: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, mod] of Object.entries(mods)) {
    out[path.split("/").slice(-2).join("/")] = (mod as { default: unknown }).default;
  }
  return out;
}

let cached: Dataset | null = null;

/**
 * Loads and validates the bundled dataset. Data errors throw — the build runs
 * `validate:data` first, so a throw here means a stale/hand-edited bundle.
 */
export function loadDataset(): Dataset {
  if (cached) return cached;
  const raw = {
    authorFiles: stripDefaults(
      import.meta.glob("../../data/authors/*.json", { eager: true }) as Record<string, unknown>
    ),
    workFiles: stripDefaults(
      import.meta.glob("../../data/works/*.json", { eager: true }) as Record<string, unknown>
    ),
    relationFiles: stripDefaults(
      import.meta.glob("../../data/relations/*.json", { eager: true }) as Record<string, unknown>
    ),
    sourceFiles: stripDefaults(
      import.meta.glob("../../data/sources/*.json", { eager: true }) as Record<string, unknown>
    ),
    movements: (singleJson(import.meta.glob("../../data/movements.json", { eager: true }))),
    tours: singleJson(import.meta.glob("../../data/tours.json", { eager: true })),
    positions: singleJson(import.meta.glob("../../data/positions.v1.json", { eager: true })),
    registry: singleJson(import.meta.glob("../../data/registry.json", { eager: true }))
  };
  // pre-freeze dev state (placeholder positions) loads leniently; a shipped
  // bundle has frozen positions and validates strictly
  const positions = raw.positions as { version?: string } | null;
  const allowPartial = positions?.version === "0.0.0";
  const { dataset, errors } = assembleDataset(raw, { allowPartial });
  if (!dataset) {
    throw new Error(`dataset invalid:\n${errors.slice(0, 20).join("\n")}`);
  }
  cached = dataset;
  return dataset;
}

function singleJson(mods: Record<string, unknown>): unknown {
  const first = Object.values(mods)[0];
  return (first as { default: unknown } | undefined)?.default ?? null;
}

/** author id → unit vector for the literary-affinity sphere */
export function semanticPositions(dataset: Dataset): Map<string, Vec3> {
  const map = new Map<string, Vec3>();
  for (const [id, p] of Object.entries(dataset.positions.positions)) {
    map.set(id, normalize(p));
  }
  return map;
}

/**
 * author id → unit vector from the primary location in real geography.
 * Dense clusters (e.g. central Europe) get a deterministic minimum-displacement
 * relaxation so overlapping cities stay readable as individual stars —
 * standard cartographic displacement, disclosed on the methodology page.
 */
export function geoPositions(dataset: Dataset): Map<string, Vec3> {
  const map = new Map<string, Vec3>();
  for (const a of dataset.authors) {
    const primary = a.locations.find((l) => l.primary) ?? a.locations[0];
    if (primary) map.set(a.id, latLonToVec3(primary.lat, primary.lon));
  }
  relaxGeoOverlaps(map, 0.045, 40);
  return map;
}

export function relaxGeoOverlaps(
  map: Map<string, Vec3>,
  minDist: number,
  rounds: number
): void {
  const ids = [...map.keys()].sort();
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ia = ids[i]!;
        const ib = ids[j]!;
        const a = map.get(ia)!;
        const b = map.get(ib)!;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const d = Math.hypot(dx, dy, dz); // chord ≈ angle for small separations
        if (d >= minDist) continue;
        moved = true;
        // deterministic tie-break for exactly coincident cities
        const [ux, uy, uz] =
          d < 1e-6 ? [0.7, 0.3, 0.64] : [dx / d, dy / d, dz / d];
        const push = (minDist - d) / 2 + 0.001;
        map.set(ia, normalize([a[0] - ux * push, a[1] - uy * push, a[2] - uz * push]));
        map.set(ib, normalize([b[0] + ux * push, b[1] + uy * push, b[2] + uz * push]));
      }
    }
    if (!moved) break;
  }
}
