// 한 도판이 독자에게 내미는 사실의 전부 — 문장 하나마다 고정 id(sid)를 붙인다. 붉은 인장의 게이트가 이것을 센다.
//
// 왜: 「검토됨」의 정의는 「쪽의 사실 주장을 하나씩 떼어 출처에 대봤다」인데, 원장의 필드 이름이 자유 문자열이라
// 기계가 문장과 원장을 잇지 못했다. 2026-09-24 감사: 검토된 38명의 문장 799개 중 157개(사실·평가 68개)가 원장에
// 한 번도 오르지 않았고, 게이트는 원장의 결론만 읽어 그것을 볼 수 없었다. 이제 원장의 주장은 자기가 덮는 문장의
// sid 를 적고, 게이트는 **지금 데이터의** 모든 sid 가 덮였는지 본다. 문장이 바뀌면 sid 가 바뀌어 다시 읽어야 한다.
import { createHash } from "node:crypto";
import type { Author, Relation, Work } from "../../src/types.ts";

export type Drawn = { sid: string; where: string; text: string };

/** 문장 나누기 — 마침표·물음표·느낌표(와 닫는 따옴표·괄호) 뒤. 결정론적이면 된다: 같은 글이면 같은 sid 다. */
export function sentencesOf(text: string | undefined): string[] {
  if (!text) return [];
  const parts = text.match(/[^.!?。]+(?:[.!?。]+["'”’)」』]*|$)\s*/g) ?? [text];
  return parts.map((p) => p.trim()).filter((p) => /[\p{L}\p{N}]/u.test(p));
}

export const sidOf = (where: string, text: string): string =>
  createHash("sha256").update(`${where}|${text.normalize("NFC").replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 12);

const push = (out: Drawn[], where: string, text: string | undefined): void => {
  for (const s of sentencesOf(text)) out.push({ sid: sidOf(where, s), where, text: s });
};
const fact = (out: Drawn[], where: string, text: string): void => {
  out.push({ sid: sidOf(where, text), where, text });
};

/**
 * 한 작가의 쪽과 그 작품 쪽들이 그리는 사실 문장 — 이 작가가 검토됨이 되려면 전부 덮여야 한다.
 * 관계 문장은 두 작가의 쪽에 다 그려지므로 두 작가 모두의 목록에 든다(어느 원장이 덮어도 된다).
 */
export function drawnFor(
  a: Author,
  works: ReadonlyArray<Work>,
  relations: ReadonlyArray<Relation>,
  nameOf: (id: string) => string
): Drawn[] {
  const out: Drawn[] = [];
  const life = a.birthYear === undefined ? `활동 ${a.activeRange.join("–")}` : `${a.birthYear}–${a.deathYear ?? ""}${a.lifeApprox ? " 무렵" : ""}`;
  fact(out, "author.facts", `${a.names.ko}(${a.names.original ?? ""}) · ${life} · ${a.languages.join("·")} · ${a.regions.join("·")}${a.movements.length ? ` · ${a.movements.join("·")}` : ""}`);
  push(out, "author.importanceReason", a.importanceReason);
  push(out, "author.readingEntryReason", a.readingEntryReason);
  push(out, "author.readingWarning", a.readingWarning);
  push(out, "author.difficultyReason", a.difficultyReason);
  for (const w of works) {
    fact(out, `work:${w.id}.facts`, `『${w.titleKo}』(${w.titleOriginal ?? ""}) · ${w.year}${w.yearBasis && w.yearBasis !== "attested" ? ` ${w.yearBasis}` : ""} · ${w.genre ?? ""}`);
    push(out, `work:${w.id}.significance`, w.significance);
    const world = (w as Work & { world?: { opening?: { original: string; ko: string }; editions?: Array<Record<string, unknown>> } }).world;
    if (world?.opening) fact(out, `work:${w.id}.opening`, `${world.opening.original} / ${world.opening.ko}`);
    for (const e of world?.editions ?? []) fact(out, `work:${w.id}.edition`, JSON.stringify(e));
  }
  for (const r of relations) {
    fact(out, `relation:${r.id}.facts`, `${nameOf(r.sourceId)} → ${nameOf(r.targetId)} · ${r.type} · ${r.direction} · ${r.evidenceLevel}`);
    push(out, `relation:${r.id}.summary`, r.summary);
  }
  return out;
}
