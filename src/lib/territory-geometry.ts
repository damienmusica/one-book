// Baked-terrain geometry helpers shared by the offline baker (scripts/lib/
// terrain.ts) and the renderer-side texture painter. Pure math, no DOM.
//
// Baked polylines are flat [x0,y0,x1,y1,…] arrays in equirect grid
// coordinates with x wrapped into [0, gridWidth); consumers unwrap across the
// horizontal seam before drawing or measuring.

export type FlatLine = number[];

/**
 * Unwrap a flat polyline's x coordinates across the horizontal seam: each
 * step takes the representative of the next x closest to the previous one,
 * so the result is continuous (and may leave [0, width)). A closed loop that
 * does not encircle a pole returns to its exact starting x.
 */
export function unwrapFlatX(line: FlatLine, width: number): FlatLine {
  const out = line.slice();
  for (let k = 2; k < out.length; k += 2) {
    const prev = out[k - 2]!;
    let x = out[k]!;
    while (x - prev > width / 2) x -= width;
    while (prev - x > width / 2) x += width;
    out[k] = x;
  }
  return out;
}

/** net horizontal winding of an unwrapped closed loop, in whole wraps */
export function loopWinding(unwrapped: FlatLine, width: number): number {
  return Math.round((unwrapped[unwrapped.length - 2]! - unwrapped[0]!) / width);
}

/** iterate the [count, value] pairs of one RLE row as (x0, count, value) */
export function eachRun(
  row: number[],
  fn: (x0: number, count: number, value: number) => void
): void {
  let x = 0;
  for (let k = 0; k + 1 < row.length; k += 2) {
    const count = row[k]!;
    fn(x, count, row[k + 1]!);
    x += count;
  }
}

// --- grid ↔ sphere ----------------------------------------------------------
// The bake grid is aligned with three.js SphereGeometry UVs: column x ↦
// φ = 2πx/width with p = [−cosφ·cosLat, sinLat, sinφ·cosLat], row y ↦
// lat = 90° − 180°·y/(height−1). These two are exact inverses.

export function gridToVec3(
  x: number,
  y: number,
  width: number,
  height: number
): [number, number, number] {
  const phi = (x / width) * Math.PI * 2;
  const lat = Math.PI / 2 - (y / (height - 1)) * Math.PI;
  const cosLat = Math.cos(lat);
  return [-Math.cos(phi) * cosLat, Math.sin(lat), Math.sin(phi) * cosLat];
}

export function vec3ToGrid(
  p: readonly [number, number, number],
  width: number,
  height: number
): [number, number] {
  let phi = Math.atan2(p[2], -p[0]);
  if (phi < 0) phi += Math.PI * 2;
  const lat = Math.asin(Math.max(-1, Math.min(1, p[1])));
  return [(phi / (Math.PI * 2)) * width, ((Math.PI / 2 - lat) / Math.PI) * (height - 1)];
}
