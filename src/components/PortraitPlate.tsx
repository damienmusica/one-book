// Imagined-portrait plate (thesis ④): the frontispiece figure of the detail
// panel. The frame and honesty cartouche are drawn by code; the plate itself
// is a grayscale asset mapped to duotone tokens at render time. Faces are
// labeled "imagined portrait", object emblems "emblematic still life" — the
// label is not optional (an imagined portrait that says so is a genre, not
// a lie).

import { useEffect, useRef, useState } from "react";
import { useServices, useT } from "./ctx.ts";
import { duotoneInto } from "../lib/duotone.ts";
import { lifeSpan } from "./bits.tsx";
import type { Author } from "../types.ts";

export function PortraitPlate({ author }: { author: Author }) {
  const { dataset } = useServices();
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const entry = dataset.portraits.find((p) => p.authorId === author.id);

  useEffect(() => {
    setFailed(false);
    if (!entry) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      if (canvasRef.current === canvas) duotoneInto(canvas, img);
    };
    img.onerror = () => setFailed(true);
    img.src = `${import.meta.env.BASE_URL}portraits/${author.id}.jpg`;
  }, [entry, author.id]);

  if (!entry || failed) return null;
  const label = entry.mode === "face" ? t.imaginedPortrait : t.emblemPortrait;
  return (
    <figure className="portrait-plate">
      <div className="portrait-plate__frame">
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <figcaption className="portrait-plate__cartouche">
        {lifeSpan(author, t)} · {label}
      </figcaption>
    </figure>
  );
}
