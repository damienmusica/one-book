// 초상 일람 — dev-only catalog at ?portraits, for VAD review of the imagined
// portrait pilot. Never ships (gated behind import.meta.env.DEV in App.tsx).

import { useEffect, useRef } from "react";
import { loadDataset } from "../data/load.ts";
import { duotoneInto } from "../lib/duotone.ts";
import { COLORS } from "../theme.ts";
import type { PortraitEntry } from "../types.ts";

function Plate({ entry, name, years }: { entry: PortraitEntry; name: string; years: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => duotoneInto(canvas, img);
    img.src = `${import.meta.env.BASE_URL}portraits/${entry.authorId}.jpg`;
  }, [entry.authorId]);
  return (
    <figure style={{ margin: 0, textAlign: "center", maxWidth: 280 }}>
      <div
        style={{
          border: `1px solid ${COLORS.lineAccent}`,
          outline: `1px solid ${COLORS.line}`,
          outlineOffset: 3,
          padding: 6,
          background: COLORS.surfaceRaised
        }}
      >
        <canvas ref={ref} style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
      <figcaption
        style={{
          marginTop: 8,
          fontStyle: "italic",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: COLORS.textDim
        }}
      >
        {name} · {years} — {entry.mode === "face" ? "상상 초상" : "상징 정물"} · rung {entry.rung}
      </figcaption>
    </figure>
  );
}

export default function PortraitCatalog() {
  const dataset = loadDataset();
  const byId = new Map(dataset.authors.map((a) => [a.id, a]));
  return (
    <main
      style={{
        background: COLORS.bg,
        height: "100vh",
        overflowY: "auto",
        padding: "32px 40px",
        fontFamily: "Georgia, 'Nanum Myeongjo', serif"
      }}
    >
      <h1 style={{ color: COLORS.text, fontSize: 22, letterSpacing: "0.2em" }}>
        문학의 행성 · 초상 일람{" "}
        <span style={{ color: COLORS.textFaint, fontSize: 13 }}>
          (dev · pilot {dataset.portraits.length})
        </span>
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 28,
          marginTop: 24
        }}
      >
        {dataset.portraits.map((p) => {
          const a = byId.get(p.authorId);
          if (!a) return null;
          const years = `${a.birthYear ?? "?"}–${a.deathYear ?? ""}`;
          return <Plate key={p.authorId} entry={p} name={a.names.ko} years={years} />;
        })}
      </div>
    </main>
  );
}
