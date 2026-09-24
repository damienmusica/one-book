// close-read 슬레이트 — 한 도판 페이지의 사실 주장이 나오는 필드 전부를 한 파일로. 조회 close-read 에이전트의 입력이다.
// 생성을 모르는 컨텍스트가 읽는다: 여기 있는 것은 결과물과 출처 사전뿐이다.
//
//   npx tsx scripts/closeread-slate.ts <outDir> <id,id,…>|--reviewed-without <ledger.json> [--prior a.json,b.json] [--only-uncovered a.json,b.json]
//
// drawn: 쪽이 그리는 문장 전부와 그 sid(scripts/lib/drawn.ts). close-read 의 주장은 덮는 문장의 sid 를 적어야 게이트가 센다.
// --prior: 이전 원장의 주장(출처·인용 포함) — 다시 쓸 수 있는 증거. 그대로 믿지 말고 다시 대본다.
// --only-uncovered: 그 원장들이 아직 덮지 못한 문장만 싣는다 — 고친 뒤 바뀐 문장을 덧읽을 때.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { drawnFor } from "./lib/drawn.ts";
import { uncoveredOf } from "./lib/closeread.ts";

const [outDir, sel, ledgerPath] = process.argv.slice(2);
const flag = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const readPlates = (list: string | undefined) => (list ? list.split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8")).plates ?? []) : []);
const prior = readPlates(flag("--prior"));
const onlyUncovered = flag("--only-uncovered") ? readPlates(flag("--only-uncovered")) : undefined;
if (!outDir || !sel) throw new Error("usage: closeread-slate <outDir> <ids|--reviewed-without ledger.json>");
const { dataset } = assembleDataset(loadRawCollections());
if (!dataset) throw new Error("코퍼스가 조립되지 않는다");
const inLedger = sel === "--reviewed-without" ? new Set<string>(JSON.parse(readFileSync(ledgerPath!, "utf8")).plates.map((p: { id: string }) => p.id)) : undefined;
const ids = inLedger
  ? dataset.authors.filter((a) => a.reviewStatus !== "draft" && (a.depth ?? "plate") === "plate" && !inLedger.has(a.id)).map((a) => a.id)
  : sel.split(",");
const src = new Map(dataset.sources.map((s) => [s.id, s]));
mkdirSync(outDir, { recursive: true });
// 관계는 두 작가에 걸친다. 둘 다 이 슬레이트에 있으면 출발 쪽이 주인이다 — 같은 관계를 두 컨텍스트가 따로 고치지 않게.
const chosen = new Set(ids);
const owner = (r: { sourceId: string; targetId: string }) => (chosen.has(r.sourceId) ? r.sourceId : r.targetId);
for (const id of ids) {
  const a = dataset.authors.find((x) => x.id === id);
  if (!a) throw new Error(`없는 작가: ${id}`);
  const works = dataset.works.filter((w) => w.authorId === id);
  const all = dataset.relations.filter((r) => r.sourceId === id || r.targetId === id);
  const rels = all.filter((r) => owner(r) === id);
  const elsewhere = all.filter((r) => owner(r) !== id).map((r) => `${r.id} (→ ${owner(r)} 의 슬레이트에서 본다)`);
  const name = (x: string) => dataset.authors.find((b) => b.id === x)?.names.ko ?? x;
  const srcIds = new Set([...a.sourceIds, ...works.flatMap((w) => w.sourceIds), ...rels.flatMap((r) => r.sourceIds)]);
  const slate = {
    id, page: `https://literary-planet.pages.dev/authors/${id}/`,
    author: {
      names: a.names, birthYear: a.birthYear, deathYear: a.deathYear, activeRange: a.activeRange, languages: a.languages,
      regions: a.regions, movements: a.movements, genres: a.genres,
      importanceReason: a.importanceReason, readingEntry: a.readingEntry, readingEntryReason: a.readingEntryReason,
      readingOrder: a.readingOrder, readingWarning: a.readingWarning, difficulty: a.difficulty, difficultyReason: a.difficultyReason,
      sourceIds: a.sourceIds
    },
    works: works.map((w) => ({ id: w.id, titleKo: w.titleKo, titleOriginal: w.titleOriginal, year: w.year, yearBasis: w.yearBasis, genre: w.genre, significance: w.significance, sourceIds: w.sourceIds })),
    relations: rels.map((r) => ({ id: r.id, type: r.type, from: `${r.sourceId} (${name(r.sourceId)})`, to: `${r.targetId} (${name(r.targetId)})`, evidenceLevel: r.evidenceLevel, summary: r.summary, anchors: r.anchors, sourceIds: r.sourceIds })),
    relationsCheckedElsewhere: elsewhere,
    drawn: (() => {
      // 관계 문장은 주인 슬레이트에만 — 다른 쪽이 읽는 관계까지 실으면 같은 선을 두 컨텍스트가 따로 판정한다.
      const d = drawnFor(a, works, rels, name);
      return onlyUncovered ? uncoveredOf(d, onlyUncovered) : d;
    })(),
    priorClaims: prior.filter((p: { id: string }) => p.id === id).flatMap((p: { claims?: unknown[] }) => p.claims ?? []),
    sources: Object.fromEntries([...srcIds].map((s) => [s, src.get(s) ?? "(정의 없음)"]))
  };
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(slate, null, 2) + "\n");
}
console.log(`슬레이트 ${ids.length} → ${outDir}`);
writeFileSync(join(outDir, "_ids.json"), JSON.stringify(ids) + "\n");
