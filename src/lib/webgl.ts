/**
 * One-time WebGL capability probe. Deterministic per browser session, so a
 * module-level constant is enough for every consumer (globe, header controls,
 * timeline controls) to agree on whether the 3D map exists.
 *
 * `?nowebgl=1` forces the 2D fallback — kept in production so the fallback
 * path stays testable on any machine.
 */
function detect(): boolean {
  if (typeof window === "undefined") return false;
  // jsdom's getContext stub logs a scary not-implemented error; tests always
  // exercise the fallback path
  if (import.meta.env?.MODE === "test") return false;
  try {
    if (new URLSearchParams(window.location.search).has("nowebgl")) return false;
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export const webglAvailable = detect();
