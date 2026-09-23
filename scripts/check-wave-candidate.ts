// 웨이브 후보 한 장을 인제스트 규칙으로 미리 잰다 — 쓰지 않는다. 생성 에이전트가 자기 출력을 고치는 데 쓴다.
// 인제스트(ingest-silhouettes → ingest-sketches → ingest-plates)가 최종 판정이고, 이것은 그 앞의 거울이다.
//
//   npx tsx scripts/check-wave-candidate.ts <gen/<id>.json> [--slate qc/wave-kr-2026-09/slate.json]
import { readFileSync } from "node:fs";
import { loadRawCollections } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { GENRE_DEFS, LANGUAGE_LABELS, REGION_DEFS, RELATION_DEFS } from "../src/types.ts";

const file = process.argv[2];
const slatePath = process.argv.includes("--slate") ? process.argv[process.argv.indexOf("--slate") + 1]! : "qc/wave-kr-2026-09/slate.json";
if (!file) throw new Error("usage: check-wave-candidate <file>");
const c = JSON.parse(readFileSync(file, "utf8"));
const slate: { id: string; status: string }[] = JSON.parse(readFileSync(slatePath, "utf8"));
const { dataset } = assembleDataset(loadRawCollections());
if (!dataset) throw new Error("코퍼스가 조립되지 않는다");
const errs: string[] = [];
const err = (m: string) => errs.push(m);
const GENRES = new Set(GENRE_DEFS.map((g) => g.id as string));
const TYPES = new Map(RELATION_DEFS.map((t) => [t.id as string, t]));
const plate = c.plate ?? {};
const id = String(plate.id ?? "");
const me = slate.find((s) => s.id === id);
if (!me) err(`슬레이트에 없는 id: ${id}`);
const existing = dataset.authors.find((a) => a.id === id);
if (me?.status === "new") {
  if (existing) err("status new 인데 이미 코퍼스에 있다");
  const s = c.silhouette ?? {};
  if (s.id !== id) err("silhouette.id 가 plate.id 와 다르다");
  if (!s.names?.ko || !s.names?.original) err("silhouette 이름 누락");
  if (!(s.languages ?? []).length || (s.languages ?? []).some((l: string) => !(l in LANGUAGE_LABELS))) err(`언어 코드: ${JSON.stringify(s.languages)}`);
  if (!(s.regions ?? []).length || (s.regions ?? []).some((r: string) => !REGION_DEFS.some((d) => d.id === r))) err(`권역 코드: ${JSON.stringify(s.regions)}`);
  if (!Array.isArray(s.activeRange) || s.activeRange.length !== 2 || !s.activeRange.every(Number.isInteger)) err("activeRange");
  if (!/^Q\d+$/.test(String(s.wikidata ?? ""))) err("wikidata QID 없음");
} else if (me && !existing) err(`status ${me.status} 인데 코퍼스에 없다`);
const reason = String(plate.importanceReason ?? "").trim();
if (reason.length < 60 || reason.length > 450) err(`importanceReason 길이 ${reason.length} (60–450)`);
if (!(plate.genres ?? []).length || plate.genres.some((g: string) => !GENRES.has(g))) err(`genres ${JSON.stringify(plate.genres)}`);
if (!Number.isInteger(plate.difficulty) || plate.difficulty < 1 || plate.difficulty > 5) err("difficulty 1–5");
if (String(plate.difficultyReason ?? "").trim().length < 10) err("difficultyReason");
const works: any[] = plate.works ?? [];
if (works.length < 3) err(`작품 ${works.length} (3 이상)`);
const wids = new Set<string>();
for (const w of works) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*--[a-z0-9]+(-[a-z0-9]+)*$/.test(w.id) || !String(w.id).startsWith(`${id}--`)) err(`작품 id ${w.id}`);
  if (wids.has(w.id)) err(`작품 id 중복 ${w.id}`); wids.add(w.id);
  const prior = dataset.works.find((x) => x.id === w.id);
  if (prior && prior.authorId !== id) err(`${w.id} 는 다른 작가의 작품`);
  if (!prior && (!String(w.titleKo ?? "").trim() || !String(w.titleOriginal ?? "").trim())) err(`${w.id} 제목 누락`);
  if (String(w.significance ?? "").trim().length < 30) err(`${w.id} 의의 30자 미만`);
  if (!GENRES.has(w.genre)) err(`${w.id} 장르 ${w.genre}`);
  if (!Number.isInteger(w.year)) err(`${w.id} 연도`);
}
const order: string[] = plate.readingOrder ?? [];
if (!wids.has(plate.readingEntry)) err("입문작이 작품 목록에 없다");
if (order.length < 3 || order.length > 5) err(`입문 순서 ${order.length}편 (3–5)`);
if (order[0] !== plate.readingEntry) err("입문 순서 첫 항목 ≠ 입문작");
if (order.some((o) => !wids.has(o)) || new Set(order).size !== order.length) err("입문 순서에 모르는/중복 작품");
if (String(plate.readingEntryReason ?? "").trim().length < 10) err("입문 이유");
const srcIds = new Set(dataset.sources.map((s) => s.id));
const newSrc = new Map<string, any>((plate.newSources ?? []).map((s: any) => [s.id, s]));
for (const s of newSrc.values()) {
  if (!/^src--[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) err(`출처 id ${s.id}`);
  if (!String(s.title ?? "").trim() || !String(s.publisherOrInstitution ?? "").trim()) err(`${s.id} 제목·기관`);
  if (s.url && !/^https:\/\//.test(s.url)) err(`${s.id} url 은 https`);
}
const has = (s: string) => srcIds.has(s) || newSrc.has(s);
if (!(plate.sourceIds ?? []).length || plate.sourceIds.some((s: string) => !has(s))) err("프로필 출처 없음/미정의");
const plates = new Set(dataset.authors.filter((a) => (a.depth ?? "plate") === "plate").map((a) => a.id));
const wave = new Set(slate.map((s) => s.id));
const rels: any[] = plate.relations ?? [];
if (!rels.length) err("관계 0");
for (const r of rels) {
  const def = TYPES.get(r.type);
  if (!def) { err(`관계 종류 ${r.type}`); continue; }
  if (r.evidenceLevel === "editorial_inference") err("editorial_inference 금지");
  if (!(def.levels as readonly string[]).includes(r.evidenceLevel)) err(`${r.type} 에 ${r.evidenceLevel} 불가`);
  if (r.sourceId !== id && r.targetId !== id) err("관계의 한쪽은 이 작가");
  const other = r.sourceId === id ? r.targetId : r.sourceId;
  if (!plates.has(other) && !wave.has(other)) err(`관계 상대 ${other} 는 도판도 웨이브도 아니다`);
  if (String(r.summary ?? "").trim().length < 10) err("관계 요약");
  if (!(r.sourceIds ?? []).length || r.sourceIds.some((s: string) => !has(s))) err(`관계 출처 없음/미정의 (${r.sourceId}→${r.targetId})`);
  if (!(Number(r.weight) >= 0 && Number(r.weight) <= 1)) err("weight 0–1");
}
const ev: any[] = c.evidence ?? [];
if (ev.length < 8) err(`evidence ${ev.length}건 — 사실 문장마다 출처를 단다`);
if (ev.some((e) => !/^https?:\/\//.test(String(e.url ?? "")) || !String(e.quote ?? "").trim())) err("evidence 에 url·quote 없는 항목");
console.log(errs.length ? `NOT OK — ${errs.length}\n  - ${errs.join("\n  - ")}` : `OK — ${id}: 작품 ${works.length} · 관계 ${rels.length} · evidence ${ev.length}`);
process.exit(errs.length ? 1 : 0);
