// First-visit coach line (UX audit P0-2): one sentence that teaches the two
// core gestures, shown once, gone the moment the visitor learns by doing.

import { useEffect, useState } from "react";
import { useAppState, useT } from "./ctx.ts";
import { webglAvailable } from "../lib/webgl.ts";

const SEEN_KEY = "lp-hint-seen";

export function GlobeHint() {
  const state = useAppState();
  const t = useT();
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return true;
    }
  });

  // the first successful selection is the lesson — retire the hint
  useEffect(() => {
    if (!seen && state.selectedAuthorId) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* private mode — session-only */
      }
      setSeen(true);
    }
  }, [seen, state.selectedAuthorId]);

  // the hint teaches globe gestures — meaningless in the 2D fallback
  if (!webglAvailable || seen || state.selectedAuthorId || state.tourId) return null;
  return (
    <div className="globe-hint" role="status">
      <span>{t.onboardHint}</span>
      <button
        type="button"
        className="globe-hint__dismiss"
        aria-label={t.cancel}
        onClick={() => {
          try {
            localStorage.setItem(SEEN_KEY, "1");
          } catch {
            /* private mode */
          }
          setSeen(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
