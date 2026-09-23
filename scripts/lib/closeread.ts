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
