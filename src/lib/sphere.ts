// Pure spherical math shared by the layout script, renderer, and tests.

export type Vec3 = [number, number, number];

export function latLonToVec3(latDeg: number, lonDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

export function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize(v: Vec3): Vec3 {
  const n = norm(v);
  if (n === 0) return [0, 1, 0];
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/** angle in radians between two unit vectors */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
}

/** geodesic (great-circle) distance on the unit sphere */
export function geodesic(a: Vec3, b: Vec3): number {
  return angleBetween(a, b);
}

/** spherical linear interpolation between unit vectors */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const omega = angleBetween(a, b);
  if (omega < 1e-6) return normalize([...a] as Vec3);
  const so = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / so;
  const kb = Math.sin(t * omega) / so;
  return normalize([
    ka * a[0] + kb * b[0],
    ka * a[1] + kb * b[1],
    ka * a[2] + kb * b[2]
  ]);
}

/**
 * Points along the great-circle arc from a to b, lifted above the sphere.
 * Longer arcs rise higher so dense chords stay legible.
 */
export function arcPoints(a: Vec3, b: Vec3, segments: number, radius: number): Vec3[] {
  const omega = angleBetween(a, b);
  const maxLift = 0.018 + 0.1 * (omega / Math.PI);
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lift = 1 + maxLift * Math.sin(Math.PI * t);
    const p = slerp(a, b, t);
    pts.push(scale(p, radius * lift));
  }
  return pts;
}
