// 실루엣 인제스트 — 결정 (137).
//
// 생성된 실루엣 후보를 받아 **고칠 수 있는 것은 고치고, 못 고치는 것은 버리고, 버린
// 이유를 적는다.** 통과시키지 않는다 — 지어내지 않는다는 여기서도 그대로다.
//
//   npx tsx scripts/ingest-silhouettes.ts <candidates.json> [--write]
//
// 입력: [{authors:[…]}] 또는 [{key, authors:[…]}] 또는 [ …authors ]
// 출력: data/authors/silhouette-<batch>.json (--write 일 때만)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { LANGUAGE_LABELS, PERIOD_DEFS, REGION_DEFS } from "../src/types.ts";

const file = process.argv[2];
const write = process.argv.includes("--write");
const keyArg = process.argv[process.argv.indexOf("--key") + 1];
const KEY = process.argv.includes("--key") && keyArg ? keyArg : "silhouettes";
if (!file) throw new Error("usage: ingest-silhouettes <candidates.json> [--write]");

// 이 실행이 쓸 파일은 **기존 코퍼스가 아니다**. 빼지 않으면 재실행이 자기 앞 결과를
// id 충돌로 전부 버리고 그 자리를 덮어쓴다 (실측: 1,273명 → 92명).
const raw = loadRawCollections();
const selfPath = `authors/silhouette-${KEY}.json`;
if (selfPath in raw.authorFiles) delete raw.authorFiles[selfPath];
const { dataset } = assembleDataset(raw);
if (!dataset) throw new Error("기존 코퍼스가 조립되지 않는다 — 먼저 그것부터 고쳐라");
const existing = new Set(dataset.authors.map((a) => a.id));
const existingKo = new Set(dataset.authors.map((a) => a.names.ko));
const LANGS = new Set(Object.keys(LANGUAGE_LABELS));
const REGIONS = new Set(REGION_DEFS.map((r) => r.id));
const NOW = 2026;

type Raw = Record<string, unknown>;
const parsed = JSON.parse(readFileSync(file, "utf8"));
const batches: { key: string; authors: Raw[] }[] = Array.isArray(parsed)
  ? parsed.every((x) => Array.isArray((x as Raw).authors))
    ? (parsed as { key: string; authors: Raw[] }[])
    : [{ key: KEY, authors: parsed as Raw[] }]
  : [{ key: String((parsed as Raw).key ?? KEY), authors: (parsed as { authors: Raw[] }).authors }];

const dropped: { id: string; why: string }[] = [];
const fixed: string[] = [];
const seen = new Set<string>();
const seenKo = new Map<string, string>(); // 한글명 → 먼저 차지한 id
const out: { key: string; authors: Raw[] }[] = [];

/**
 * 같은 id 가 여러 배치에서 오면 **합친다**. 병렬 생성은 경계에서 겹치게 마련이고,
 * 겹친 쪽이 더 많이 알고 있을 때 뒤엣것을 버리면 아는 것을 잃는다. 규칙은 하나다:
 * 먼저 온 값이 이기고, **먼저 온 쪽이 비어 있을 때만** 나중 값이 들어간다.
 * (실측 1,300명 중 25건이 겹쳤고 그중 4건은 한쪽만 생몰년을 알았다.)
 */
function mergeById(batches: { key: string; authors: Raw[] }[]): number {
  let merged = 0;
  for (const b of batches) {
    const first = new Map<string, Raw>();
    const keep: Raw[] = [];
    for (const a of b.authors ?? []) {
      const id = String(a.id ?? "");
      const prev = first.get(id);
      if (!prev) { first.set(id, a); keep.push(a); continue; }
      merged++;
      for (const [k, v] of Object.entries(a)) {
        if (v === undefined || v === null) continue;
        const cur = (prev as Raw)[k];
        if (cur === undefined || cur === null || (Array.isArray(cur) && cur.length === 0)) (prev as Raw)[k] = v;
      }
    }
    b.authors = keep;
  }
  return merged;
}
const mergedCount = mergeById(batches);

/** activeRange 에서 겹치는 시대층을 다시 계산한다 — 층은 관측이지 선택이 아니다. */
const periodsFor = (from: number, to: number): string[] =>
  PERIOD_DEFS.filter((p) => !(to < p.range[0] || from > p.range[1])).map((p) => p.id);

for (const b of batches) {
  const keep: Raw[] = [];
  for (const a of b.authors ?? []) {
    const id = String(a.id ?? "");
    const ko = String((a.names as Raw)?.ko ?? "");
    const drop = (why: string) => dropped.push({ id: id || ko || "(익명)", why });

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) { drop("id 형식"); continue; }
    if (existing.has(id)) { drop("기존 코퍼스와 id 충돌"); continue; }
    if (existingKo.has(ko)) { drop(`기존 코퍼스와 같은 사람으로 보인다 (${ko})`); continue; }
    if (seen.has(id)) { drop("배치 간 중복"); continue; }
    const owner = seenKo.get(ko);
    if (owner) { drop(`이 배치에서 ${owner} 와 같은 사람으로 보인다 (${ko})`); continue; }
    if (!ko || !String((a.names as Raw)?.original ?? "")) { drop("이름 누락"); continue; }

    const langs = (a.languages as string[] ?? []).filter((l) => LANGS.has(l));
    const regions = (a.regions as string[] ?? []).filter((r) => REGIONS.has(r));
    if (!langs.length) { drop(`언어 코드 미허용 (${JSON.stringify(a.languages)})`); continue; }
    if (!regions.length) { drop(`권역 미허용 (${JSON.stringify(a.regions)})`); continue; }
    if (langs.length !== (a.languages as string[]).length || regions.length !== (a.regions as string[]).length)
      fixed.push(`${id}: 미허용 언어/권역 제거`);

    const ar = a.activeRange as number[] | undefined;
    if (!Array.isArray(ar) || ar.length !== 2 || !Number.isInteger(ar[0]) || !Number.isInteger(ar[1])) {
      drop("activeRange 없음"); continue;
    }
    let [from, to] = ar as [number, number];
    if (from > to) { [from, to] = [to, from]; fixed.push(`${id}: activeRange 뒤집힘 교정`); }
    const birth = Number.isInteger(a.birthYear) ? (a.birthYear as number) : undefined;
    const death = Number.isInteger(a.deathYear) ? (a.deathYear as number) : undefined;
    if (birth !== undefined && from < birth + 8) { from = birth + 8; fixed.push(`${id}: 활동 시작을 생년+8 로`); }
    const lifeEnd = death ?? NOW;
    if (to > lifeEnd) { to = lifeEnd; fixed.push(`${id}: 활동 끝을 몰년으로`); }
    if (from > to) { drop("연도가 성립하지 않는다"); continue; }
    if (from < -3000 || to > 2030) { drop("연도가 범위 밖"); continue; }
    if (birth !== undefined && death !== undefined && birth >= death) { drop("생몰 역전"); continue; }

    let anchor = Number.isInteger(a.anchorYear) ? (a.anchorYear as number) : Math.round((from + to) / 2);
    if (anchor < from || anchor > to) { anchor = Math.round((from + to) / 2); fixed.push(`${id}: anchorYear 를 활동 구간 안으로`); }

    const periods = periodsFor(from, to);
    if (!periods.length) { drop("겹치는 시대층 없음"); continue; }
    const given = (a.periods as string[]) ?? [];
    if (given.length !== periods.length || given.some((p) => !periods.includes(p)))
      fixed.push(`${id}: 시대층을 활동 구간에서 재계산`);

    seen.add(id);
    seenKo.set(ko, id);
    keep.push({
      id,
      names: {
        ko,
        original: String((a.names as Raw).original),
        aliases: Array.isArray((a.names as Raw).aliases) ? (a.names as Raw).aliases : []
      },
      depth: "silhouette",
      ...(birth !== undefined ? { birthYear: birth } : {}),
      ...(death !== undefined ? { deathYear: death } : {}),
      activeRange: [from, to],
      anchorYear: anchor,
      gender: ["female", "male", "other", "unknown"].includes(String(a.gender)) ? a.gender : "unknown",
      languages: langs,
      regions,
      periods,
      movements: [],
      genres: [],
      locations: [],
      readingOrder: [],
      sourceIds: [],
      tier: ["anchor", "major", "context"].includes(String(a.tier)) ? a.tier : "context",
      reviewStatus: "draft"
    });
  }
  if (keep.length) out.push({ key: b.key, authors: keep });
}

const total = out.reduce((n, b) => n + b.authors.length, 0);
console.log(
  `실루엣 ${total}명 · 배치 ${out.length} · 병합 ${mergedCount} · 수리 ${fixed.length} · 버림 ${dropped.length}`
);
if (dropped.length) {
  const why = new Map<string, number>();
  for (const d of dropped) {
    const k = d.why.replace(/\(.*\)/, "").trim();
    why.set(k, (why.get(k) ?? 0) + 1);
  }
  console.log("버린 이유:");
  for (const [k, n] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)} ${k}`);
}

if (write) {
  for (const b of out) {
    const path = join(PKG_ROOT, "data", "authors", `silhouette-${b.key}.json`);
    writeFileSync(path, JSON.stringify(b.authors, null, 2) + "\n");
    console.log(`  → data/authors/silhouette-${b.key}.json (${b.authors.length})`);
  }
} else {
  console.log("(--write 없이 실행 — 파일을 쓰지 않았다)");
}
