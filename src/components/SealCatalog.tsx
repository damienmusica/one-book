// 인보(印譜) — dev-only seal catalog at ?seals, for VAD review and carving QA.
// Never ships: the route is gated behind import.meta.env.DEV in App.tsx, so
// production builds drop this chunk entirely.

import { useEffect, useRef } from "react";
import { loadDataset } from "../data/load.ts";
import { sealGlyph } from "../lib/seal.ts";
import { paintSealTexture, SEAL_SIZE } from "../globe/seal-texture.ts";
import { COLORS } from "../theme.ts";
import type { Author } from "../types.ts";

const TIER_ORDER: Author["tier"][] = ["anchor", "major", "context"];

function SealCell({ author }: { author: Author }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stamp = paintSealTexture(sealGlyph(author.id, author.names.original), author.tier, author.id);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SEAL_SIZE, SEAL_SIZE);
    ctx.drawImage(stamp, 0, 0);
    // tint like the in-app sprite (material.color = text ink)
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(0, 0, SEAL_SIZE, SEAL_SIZE);
    ctx.globalCompositeOperation = "source-over";
  }, [author]);
  return (
    <figure style={{ margin: 0, textAlign: "center" }}>
      <canvas
        ref={ref}
        width={SEAL_SIZE}
        height={SEAL_SIZE}
        style={{ width: 96, height: 96 }}
        aria-label={`${author.names.ko} 인장`}
      />
      <figcaption style={{ color: COLORS.textDim, fontSize: 11, lineHeight: 1.3 }}>
        {author.names.ko}
      </figcaption>
    </figure>
  );
}

export default function SealCatalog() {
  const dataset = loadDataset();
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
        문학의 행성 · 인보 印譜 <span style={{ color: COLORS.textFaint, fontSize: 13 }}>(dev)</span>
      </h1>
      {TIER_ORDER.map((tier) => {
        const members = dataset.authors
          .filter((a) => a.tier === tier)
          .sort((a, b) => a.id.localeCompare(b.id));
        return (
          <section key={tier}>
            <h2 style={{ color: COLORS.brass, fontSize: 14, letterSpacing: "0.3em", marginTop: 28 }}>
              {tier === "anchor" ? "앵커 — 백문" : tier === "major" ? "메이저 — 주문" : "컨텍스트 — 주문 세선"}{" "}
              <span style={{ color: COLORS.textFaint }}>({members.length})</span>
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                gap: 14,
                marginTop: 12
              }}
            >
              {members.map((a) => (
                <SealCell key={a.id} author={a} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
