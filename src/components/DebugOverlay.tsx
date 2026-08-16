import { useEffect, useReducer, useState } from "react";
import { useAppState, useServices } from "./ctx.ts";
import { buildMetrics, instr } from "../lib/instrument.ts";

/**
 * Live metrics panel for maintainers and QA captures. Hidden in production by
 * default; shows via ?debug=1 or Cmd/Ctrl+Shift+D. Read-only and
 * pointer-transparent — it can never affect what it measures.
 */
export function DebugOverlay() {
  const state = useAppState();
  const { store, dataset } = useServices();
  const [visible, setVisible] = useState(instr.overlayVisible);
  const [, poll] = useReducer((n: number) => n + 1, 0);

  useEffect(() => instr.onOverlayChange(() => setVisible(instr.overlayVisible)), []);
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(poll, 500);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const m = buildMetrics(store, dataset) as {
    app: { version: string; commit: string; layoutVersion: string };
    visible: { authors: number; authorsTotal: number; relations: number; relationsTotal: number };
    frame: { avgFps: number; p95Ms: number; p99Ms: number } | null;
    renderer: Record<string, unknown> | null;
  };
  const r = m.renderer;
  const gl = r?.gl as { webgl2: boolean; vendor: string; renderer: string } | undefined;
  const events = instr.getEvents().slice(-6).reverse();

  const row = (label: string, value: unknown) => (
    <div className="debug-row" key={label}>
      <span className="debug-k">{label}</span>
      <span className="debug-v">{String(value ?? "—")}</span>
    </div>
  );

  return (
    <div className="debug-overlay" aria-hidden="true">
      <div className="debug-title">
        debug · v{m.app.version} @{m.app.commit} · {m.app.layoutVersion}
      </div>
      {row("fps avg / p95 / p99", m.frame ? `${m.frame.avgFps} / ${m.frame.p95Ms}ms / ${m.frame.p99Ms}ms` : "warming up")}
      {row("gl", gl ? `${gl.webgl2 ? "webgl2" : "webgl1"} · ${gl.renderer}` : "no renderer")}
      {row("draw / tris", r ? `${String(r.drawCalls)} / ${String(r.triangles)}` : "—")}
      {row("geom / tex", r ? `${String(r.geometries)} / ${String(r.textures)}` : "—")}
      {row("authors", `${m.visible.authors}/${m.visible.authorsTotal}`)}
      {row("relations", `${m.visible.relations}/${m.visible.relationsTotal}`)}
      {row(
        "labels shown / suppressed / overlap",
        r ? `${String(r.labelsShown)} / ${String(r.labelsSuppressed)} / ${String(r.labelsOverlapping)}` : "—"
      )}
      {row("flow sparks", r ? String(r.flowSparks) : "—")}
      {row("camera dist / lod", r ? `${String(r.cameraDistance)} / ${String(r.lod)}` : "—")}
      {row(
        "anim",
        r
          ? `${r.modeTransition ? "mode-transition " : ""}${r.cameraAnimating ? "camera" : ""}`.trim() || "idle"
          : "—"
      )}
      {row("mode / year", `${state.mode} / ${state.year}·${state.yearMode}`)}
      {row("selected", state.selectedAuthorId ?? "—")}
      {row("page / tour", `${state.page}${state.tourId ? ` / ${state.tourId}#${state.tourStop}` : ""}`)}
      <div className="debug-events">
        {events.map((e, i) => (
          <div className="debug-event" key={`${e.t}-${i}`}>
            <span className="debug-k">{(e.t / 1000).toFixed(1)}s</span>
            <span className="debug-v">
              {e.type}
              {"key" in e ? ` ${String(e.key)}=${String(e.to)}` : ""}
              {"sparks" in e ? ` ×${String(e.sparks)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
