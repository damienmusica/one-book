// The tectonic keyframes are the heaviest data file (~1.4MB raw) and only
// matter once the user touches the year fader's world — so they load as
// their own async chunk instead of riding the main bundle (5th review:
// main gzip grew 71% when the eras shipped eagerly). Validation lives here
// because this path bypasses assembleDataset; scripts and validate:data
// still validate the same file through assemble.

import { territoryErasSchema } from "../schema.ts";
import type { TerritoryEras } from "../types.ts";

let pending: Promise<TerritoryEras> | null = null;

export function loadTerritoryEras(): Promise<TerritoryEras> {
  pending ??= import("../../data/territory.v1.eras.json").then((mod) => {
    const parsed = territoryErasSchema.safeParse(mod.default);
    if (!parsed.success) {
      throw new Error(
        `territory.v1.eras.json invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`
      );
    }
    const years = parsed.data.keyframes.map((k) => k.year);
    if (!years.every((y, i) => i === 0 || y > years[i - 1]!)) {
      throw new Error("territory.v1.eras.json: keyframe years must be strictly increasing");
    }
    return parsed.data as TerritoryEras;
  });
  return pending;
}
