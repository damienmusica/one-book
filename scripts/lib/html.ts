// 쪽을 짓는 데 쓰는 작은 순수 함수들 — 생성기를 통째로 불러오지 않고 단위로 잰다.
import type { Edition, Work } from "../../src/types.ts";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** <script> 안에 넣을 JSON. JSON.stringify 는 < 를 그대로 두므로, 제목 하나에 "</script>" 가 들어오면 스크립트 밖으로 나간다. */
export const jsonForScript = (o: unknown): string =>
  JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

// 도서관 목록의 제목에는 책임 표시(" / 저자 ; 서문 …")가 붙어 온다 — 그것은 제목이 아니다. 비교는 대소문자·악센트·
// 문장부호를 벗기고 한다: 『Finnegans wake』는 『Finnegans Wake』를 담은 선집이 아니다(2026-09-23 실측 318행 오표시).
export const catalogueTitle = (t: string): string => t.split(/\s+\/\s+/)[0]!.trim();
const titleKey = (t: string): string => t.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** 판본의 제목이 작품 제목과 다르면 그대로 보여 준다 — 분권("모비 딕 1")과 합본("변신·시골의사")을 숨기지 않는다. */
export function editionTitleNote(e: Pick<Edition, "title" | "language">, w: Pick<Work, "titleKo" | "titleOriginal">): string {
  const base = e.language === "ko" ? w.titleKo : (w.titleOriginal ?? w.titleKo);
  if (!e.title) return "";
  const shown = catalogueTitle(e.title);
  if (titleKey(shown) === titleKey(base)) return "";
  return `<span class="meta">『${esc(shown)}』${titleKey(shown).startsWith(titleKey(base)) ? "" : " 수록"}</span>`;
}
