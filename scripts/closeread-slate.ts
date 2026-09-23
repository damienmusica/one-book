// close-read 슬레이트 — 한 도판 페이지의 사실 주장이 나오는 필드 전부를 한 파일로. 조회 close-read 에이전트의 입력이다.
// 생성을 모르는 컨텍스트가 읽는다: 여기 있는 것은 결과물과 출처 사전뿐이다.
//
//   npx tsx scripts/closeread-slate.ts <outDir> <id,id,…>|--reviewed-without <ledger.json>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";

const [outDir, sel, ledgerPath] = process.argv.slice(2);
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
    sources: Object.fromEntries([...srcIds].map((s) => [s, src.get(s) ?? "(정의 없음)"]))
  };
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(slate, null, 2) + "\n");
}
console.log(`슬레이트 ${ids.length} → ${outDir}`);
writeFileSync(join(outDir, "_ids.json"), JSON.stringify(ids) + "\n");
