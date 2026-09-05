// 도판 QC 슬레이트 — 승급된(또는 승급 후보인) 도판을 QC 가 읽을 텍스트 행으로 만든다.
//   npx tsx scripts/plate-qc-slate.ts <plates.json> <out.json> [batchSize]
// QC 는 생성을 모른다 — 여기서 주는 것은 결과물과 출처 사전뿐이다.
import { readFileSync, writeFileSync } from "node:fs";
import { loadRawCollections } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";

//   npx tsx scripts/plate-qc-slate.ts --batch plate-wave1 <out.json> [batchSize]   ← /data 에서 (재QC 용)
const args = process.argv.slice(2);
const fromBatch = args[0] === "--batch" ? args[1] : undefined;
const [inFile, outFile, sizeArg] = fromBatch ? [undefined, args[2], args[3]] : args;
if (!outFile || (!inFile && !fromBatch)) throw new Error("usage: plate-qc-slate (<plates.json> | --batch <registry batch>) <out.json> [batchSize]");
const size = Number(sizeArg ?? 6);
const raw = loadRawCollections();
const { dataset } = assembleDataset(raw);
if (!dataset) throw new Error("코퍼스 조립 실패");
const byId = new Map(dataset.authors.map((a) => [a.id, a]));
const src = new Map(dataset.sources.map((s) => [s.id, s]));

type Raw = Record<string, any>;
// 재QC: 고친 뒤의 데이터가 정본이다 — registry 의 batch 로 그 웨이브의 도판을 고르고
// 후보 JSON 과 같은 모양으로 다시 조립한다(작품·관계·출처는 데이터에서).
const fromData = (batch: string): Raw[] =>
  (raw.registry as Raw[]).filter((r) => r.batch === batch).map((r) => {
    const a = byId.get(r.id)!;
    const works = dataset.works.filter((w) => w.authorId === a.id);
    const relations = dataset.relations.filter((x) => x.sourceId === a.id || x.targetId === a.id);
    return { id: a.id, importanceReason: a.importanceReason, difficulty: a.difficulty, difficultyReason: a.difficultyReason,
      readingEntry: a.readingEntry, readingEntryReason: a.readingEntryReason, readingOrder: a.readingOrder, readingWarning: a.readingWarning,
      sourceIds: a.sourceIds, works, relations, newSources: [] };
  });
const plates: Raw[] = fromBatch
  ? fromData(fromBatch)
  : (() => { const parsed = JSON.parse(readFileSync(inFile!, "utf8")); return Array.isArray(parsed) ? parsed : parsed.plates ?? []; })();

// 새 출처는 웨이브 전체의 풀이다 — 한 배치가 한 문헌을 한 사람 밑에만 정의한다. 자기 것만 보면
// 실재하는 책이 "(정의 없음)"으로 QC 에 나가고, QC 는 그것을 sources:wrong 으로 돌려보낸다(실측 3건).
const pool = new Map<string, Raw>();
for (const p of plates) for (const s of p.newSources ?? []) if (!pool.has(s.id)) pool.set(s.id, s);
const rows = plates.map((p) => {
  const a = byId.get(p.id);
  const local = pool;
  const srcLine = (id: string) => {
    const s = src.get(id) ?? local.get(id);
    return s ? `${id} → ${s.title} (${s.publisherOrInstitution})` : `${id} → (정의 없음)`;
  };
  const allSrc = new Set<string>([...(p.sourceIds ?? []), ...(p.relations ?? []).flatMap((r: Raw) => r.sourceIds ?? [])]);
  const text = [
    `id: ${p.id}`,
    `이름: ${a?.names.ko ?? p.id} (${a?.names.original ?? ""}) · ${a?.birthYear ?? "?"}–${a?.deathYear ?? ""} · ${a?.languages.join(",")} · ${a?.regions.join(",")}`,
    `importanceReason: ${p.importanceReason}`,
    `difficulty ${p.difficulty}: ${p.difficultyReason}`,
    `readingEntry ${p.readingEntry}: ${p.readingEntryReason}`,
    `readingOrder: ${(p.readingOrder ?? []).join(" → ")}`,
    p.readingWarning ? `readingWarning: ${p.readingWarning}` : "",
    "works:",
    ...(p.works ?? []).map((w: Raw) => `  ${w.id} | ${w.titleKo} / ${w.titleOriginal} (${w.year}, ${w.genre}) — ${w.significance}`),
    "relations:",
    ...(p.relations ?? []).map((r: Raw) => `  ${r.type} ${r.sourceId} → ${r.targetId} [${r.evidenceLevel}, w=${r.weight}] — ${r.summary} (출처: ${(r.sourceIds ?? []).join(", ")})`),
    "sources cited:",
    ...[...allSrc].map((s) => `  ${srcLine(s)}`)
  ].filter(Boolean).join("\n");
  return { id: p.id, text };
});
const batches: typeof rows[] = [];
for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));
writeFileSync(outFile, JSON.stringify(batches));
console.log(`QC 슬레이트 ${rows.length}행 · ${batches.length}배치 × ${size}`);
