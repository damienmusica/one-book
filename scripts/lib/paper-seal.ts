// 종이와 인장 — 작가마다 바뀌는 시각 변수는 전부 이미 가진 데이터에서 결정론적으로 나온다.
// 손으로 고른 값은 0 이다. (설계와 근거: docs/design/2026-09/paper-seal/THESIS.md)
//
//  · 인장의 글자 = 원어 이름의 문자로. 한자·가나 → 이름 첫 글자(川·紫) / 한글 → 음절 초성(ㄱㅅㅇ) /
//    그 밖 → 성(姓)의 첫 자소, 대문자(K·А·م). 성은 보통 마지막 낱말이다 — 헝가리는 첫 낱말이고, Sr./Jr./Ⅱ 는
//    성이 아니며, 별칭·지명·부칭이 뒤에 붙는 옛 이름은 qc/seal-letters.json 이 판정한다.
//  · 인장의 상태 = 검토. 붉은 백문은 "출처에 대본 쪽", 연필 점선은 "아직 대보지 않은 쪽". 다른 작가를
//    가리키는 작은 인장은 먹색 — 한 쪽에 붉은 인장은 그 쪽 주인 하나다.
//  · 기울기 = FNV(slug) → ±4.5°. 같은 K 도 같은 자국이 아니다.
//  · 이름이 서는 방향 = 문자 체계. 한자·가나는 세로, 아랍·히브리는 RTL.

export type Script = "han" | "kana" | "hangul" | "latin" | "cyrillic" | "greek" | "arabic" | "hebrew" | "other";

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const graphemes = (s: string): string[] => [...seg.segment(s)].map((x) => x.segment);
const isLetter = (g: string): boolean => /\p{L}/u.test(g);
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function scriptOf(s: string): Script {
  const c = graphemes(s).find(isLetter) ?? "";
  if (/\p{Script=Han}/u.test(c)) return "han";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(c)) return "kana";
  if (/\p{Script=Hangul}/u.test(c)) return "hangul";
  if (/\p{Script=Latin}/u.test(c)) return "latin";
  if (/\p{Script=Cyrillic}/u.test(c)) return "cyrillic";
  if (/\p{Script=Greek}/u.test(c)) return "greek";
  if (/\p{Script=Arabic}/u.test(c)) return "arabic";
  if (/\p{Script=Hebrew}/u.test(c)) return "hebrew";
  return "other";
}

export type SealRule = { glyph?: string; familyFirst?: boolean };
const SUFFIX = /^(sr|jr|i{1,3}|iv|v)\.?$/i;
export function sealGlyphs(original: string, rule: SealRule = {}): { glyphs: string[]; script: Script } {
  const script = scriptOf(original);
  const letters = graphemes(original).filter(isLetter);
  if (rule.glyph) return { glyphs: [rule.glyph], script };
  if (!letters.length) return { glyphs: ["·"], script };
  if (script === "han" || script === "kana") return { glyphs: [letters[0]!], script };
  if (script === "hangul") {
    const cho = letters.filter((g) => g >= "가" && g <= "힣").map((g) => CHO[Math.floor((g.charCodeAt(0) - 0xac00) / 588)]!).slice(0, 4);
    return { glyphs: cho.length ? cho : [letters[0]!], script };
  }
  const words = original.split(/[\s\-]+/).filter((w) => graphemes(w).some(isLetter) && !SUFFIX.test(w));
  const family = (rule.familyFirst ? words[0] : words[words.length - 1]) ?? original;
  const g = graphemes(family).find(isLetter) ?? letters[0]!;
  return { glyphs: [["latin", "cyrillic", "greek"].includes(script) ? g.toLocaleUpperCase() : g], script };
}

const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h >>> 0;
};

let uid = 0;
/** 한 쪽 안에서 SVG id 가 겹치지 않게 — 쪽을 그리기 시작할 때 부른다. */
export const resetSealIds = (): void => { uid = 0; };

export function sealSvg(o: { id: string; nameKo: string; original: string; proved: boolean; tone?: "red" | "ink"; cls?: string; texture?: boolean; rule?: SealRule }): string {
  const { glyphs, script } = sealGlyphs(o.original || o.nameKo, o.rule);
  const h = fnv(o.id);
  const rot = (h % 900) / 100 - 4.5;
  const id = `s${++uid}`;
  // 문자마다 글자의 몸이 다르다: 아랍 낱글자는 꼬리와 함자가 위아래로 길어 작게·조금 위에, 히브리·타이·타밀은
  // 라틴 대문자 높이에 맞춰 키운다(2026-09-23 심사: 60 은 빈 돌 속의 작은 글자였다).
  const size = ({ han: 70, kana: 66, latin: 80, cyrillic: 78, greek: 76, hangul: 60, arabic: 62, hebrew: 74 } as Record<string, number>)[script] ?? 60;
  const dy = ({ latin: 4, cyrillic: 4, greek: 4, arabic: -5, hebrew: 2 } as Record<string, number>)[script] ?? -3; // 타이·타밀·벵골 모음 기호가 위아래로 뻗는다
  const pos: [number, number, number][] =
    glyphs.length === 1 ? [[50, 50 + dy, size]]
    : glyphs.length === 2 ? [[50, 30, 40], [50, 72, 40]]
    : ([[70, 30], [70, 72], [30, 30], [30, 72]] as [number, number][]).slice(0, glyphs.length).map(([x, y]) => [x, y, 38]); // 인장처럼: 오른쪽 줄부터, 위에서 아래로
  const texts = (extra: string): string =>
    glyphs.map((g, i) => `<text x="${pos[i]![0]}" y="${pos[i]![1]}" font-size="${pos[i]![2]}" text-anchor="middle" dominant-baseline="central" ${extra}>${esc(g)}</text>`).join("");
  const aria = esc(`${o.nameKo}의 인장 — ${glyphs.join("")}`);
  const style = `style="transform:rotate(${rot.toFixed(1)}deg)"`;
  if (!o.proved && o.tone !== "ink") {
    // 그린 것이지 새긴 것이 아니다 — 이 쪽은 아직 출처에 대보지 않았다.
    return `<svg class="seal pencil ${o.cls ?? ""}" viewBox="0 0 100 100" role="img" aria-label="${aria} (연필)" ${style}><defs><pattern id="${id}h" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-52)"><line x1="0" y1="0" x2="0" y2="3.4" stroke="var(--pencil)" stroke-width="1.5"/></pattern></defs><rect x="7" y="7" width="86" height="86" rx="7" fill="none" stroke="var(--pencil)" stroke-width="1.6" stroke-dasharray="4 3.2"/>${texts(`fill="url(#${id}h)" stroke="var(--pencil)" stroke-width=".5"`)}</svg>`;
  }
  const fill = o.tone === "ink" ? "var(--ink)" : "var(--seal)";
  const seed = h % 997;
  const filt = o.texture
    ? `<filter id="${id}f" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="${seed}" result="lo"/><feDisplacementMap in="SourceGraphic" in2="lo" scale="2.6" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="${seed + 7}" result="hi"/><feColorMatrix in="hi" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="a"/><feComponentTransfer in="a" result="m"><feFuncA type="table" tableValues="1 1 1 1 1 1 .96 .7 .25 0 0"/></feComponentTransfer><feComposite in="d" in2="m" operator="in"/></filter>`
    : "";
  return `<svg class="seal ${o.tone === "ink" ? "ink" : ""} ${o.cls ?? ""}" viewBox="0 0 100 100" role="img" aria-label="${aria}" ${style}><defs>${filt}<mask id="${id}m"><rect width="100" height="100" fill="#fff"/>${texts('fill="#000"')}</mask></defs><g${o.texture ? ` filter="url(#${id}f)"` : ""}><rect x="5" y="5" width="90" height="90" rx="8" fill="${fill}" mask="url(#${id}m)"/></g></svg>`;
}

/** 원어 이름이 서는 방향 — 세로(v) · RTL · 가로 */
export const nameStance = (original: string): "v" | "rtl" | "" => {
  const s = scriptOf(original);
  return s === "han" || s === "kana" ? "v" : s === "arabic" || s === "hebrew" ? "rtl" : "";
};
/** 제목·이름의 크기 계급 — 글자 수로. 짧은 제목은 크게 서고 긴 제목은 물러선다. */
export const sizeClass = (text: string): "xl" | "" | "m" => {
  const n = graphemes(text.replace(/\s+/g, "")).length;
  return n <= 3 ? "xl" : n >= 10 ? "m" : "";
};
