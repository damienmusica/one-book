// close-read 원장의 "열린 주장" 판정 — 원장 도구와 검토 문지기가 같은 것을 쓴다.
type Raw = Record<string, any>;
export const SETTLED = new Set(["corrected", "narrowed", "removed", "relation-dropped"]);
// 「확정」인데 메모가 스스로 일부를 확인하지 못했다고 적은 주장 — 좁은 주장만 확정하고 옆의 오류를 메모로 흘린 자리.
// 2026-09-23 감사: 이런 확정 36건 중 표본 7건 가운데 5건의 지적 문구가 페이지에 그대로 남아 있었다.
// 해소(좁힘·고침·지움)가 있거나, 메모가 가리킨 부분이 페이지에 없다고 판정(accepted)돼야 닫힌다.
export const LEAK = /다만|확인되지 않|확인하지 못|찾지 못|확인 못|근거가 없|뒤집혀|어긋난/;
export const isLeak = (c: Raw): boolean => c.verdict === "confirmed" && LEAK.test(c.note ?? "");
export const isOpen = (c: Raw): boolean =>
  (c.verdict !== "confirmed" && !SETTLED.has(c.resolution)) || (isLeak(c) && !SETTLED.has(c.resolution) && c.resolution !== "accepted");

/**
 * 문장 덮개 — 지금 데이터의 문장(scripts/lib/drawn.ts)마다 원장의 주장이 있는가.
 *   덮인 문장: 그 sid 를 적은 주장이 있고, 그 주장들이 전부 닫혔다(확정·accepted). 또는 원장이 「사실 주장 없음」으로 적었다.
 *   덮이지 않은 문장: 주장이 없다 / 미결 주장이 있다 / 고치기로 판정한(corrected·narrowed·removed·relation-dropped) 문장이
 *   아직 그대로다 — 고침이 적용되면 문장이 바뀌어 sid 도 바뀌므로, 옛 sid 가 그대로 그려진다는 것은 고침이 안 됐다는 뜻이다
 *   (2026-09-24 감사: 원장이 「지웠다」고 한 문장 두 개가 붉은 인장 아래 그대로 있었다).
 * 관계 문장은 두 작가의 쪽에 그려지므로 어느 원장이 덮어도 된다 — 그래서 원장 전부를 받는다.
 */
export function uncoveredOf<T extends { sid: string }>(drawn: T[], plates: Raw[]): Array<T & { why: string }> {
  const bySid = new Map<string, Raw[]>();
  const noClaim = new Set<string>();
  for (const p of plates) {
    for (const c of p.claims ?? []) for (const s of c.sids ?? []) { const l = bySid.get(s) ?? []; l.push(c); bySid.set(s, l); }
    for (const s of Object.keys(p.noClaim ?? {})) noClaim.add(s);
  }
  const out: Array<T & { why: string }> = [];
  // 한 주장이 두 문장에 걸칠 수 있다 — 고침이 그 가운데 한 문장에 적용됐으면 고침은 적용된 것이다. 걸친 문장이 전부
  // 그대로일 때만 「고치기로 한 문장이 그대로」다(김연수: 칼럼 제목의 「?」에서 문장이 갈려, 고친 뒷문장만 바뀌었다).
  const live = new Set(drawn.map((d) => d.sid));
  const unapplied = (c: Raw): boolean => SETTLED.has(c.resolution) && (c.sids ?? []).every((s: string) => live.has(s));
  for (const d of drawn) {
    const cs = bySid.get(d.sid) ?? [];
    if (!cs.length) { if (!noClaim.has(d.sid)) out.push({ ...d, why: "원장에 없는 문장" }); continue; }
    if (cs.some(unapplied)) { out.push({ ...d, why: "고치기로 한 문장이 그대로 있다" }); continue; }
    if (cs.some(isOpen)) out.push({ ...d, why: "미결 주장" });
  }
  return out;
}
