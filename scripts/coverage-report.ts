// Aggregates the coverage/bias numbers published on the methodology page and
// writes docs/coverage-report.md. Offline; run after data changes.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import {
  EVIDENCE_LEVEL_KO,
  GENDER_KO,
  GENRE_DEFS,
  LANGUAGE_LABELS,
  PERIOD_DEFS,
  REGION_DEFS,
  RELATION_DEFS,
  REVIEW_STATUS_KO
} from "../src/types.ts";

const { dataset, errors } = assembleDataset(loadRawCollections(), { allowPartial: true });
if (!dataset) {
  console.error(errors.join("\n"));
  process.exit(1);
}

function tally<T>(items: T[], pick: (t: T) => string[]): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const it of items) for (const k of pick(it)) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

function section(
  title: string,
  rows: Array<[string, number]>,
  total: number,
  label: (k: string) => string
): string {
  const lines = rows.map(
    ([k, n]) => `| ${label(k)} | ${n} | ${((n / total) * 100).toFixed(1)}% |`
  );
  return [`### ${title}`, "", "| 항목 | 수 | 비율 |", "|---|---:|---:|", ...lines, ""].join("\n");
}

const a = dataset.authors;
const r = dataset.relations;
const regionKo = new Map<string, string>(REGION_DEFS.map((x) => [x.id, x.ko]));
const periodKo = new Map<string, string>(PERIOD_DEFS.map((x) => [x.id, x.ko]));
const genreKo = new Map<string, string>(GENRE_DEFS.map((x) => [x.id, x.ko]));
const relKo = new Map<string, string>(RELATION_DEFS.map((x) => [x.id, x.ko]));

const md = [
  "# Coverage Report — 문학의 행성",
  "",
  `생성일: ${new Date().toISOString().slice(0, 10)} · 이 파일은 \`npm run report:coverage\`가 생성한다.`,
  "",
  `작가 **${a.length}** · 작품 **${dataset.works.length}** · 관계 **${r.length}** · 출처 **${dataset.sources.length}** · 투어 **${dataset.tours.length}** · 좌표 v${dataset.positions.version}`,
  "",
  "어떤 정전도 중립적이지 않다. 아래 수치는 이 지도가 무엇을 과대·과소 대표하는지 공개한다.",
  "",
  section("지역 (작가는 복수 지역 가능)", tally(a, (x) => x.regions), a.length, (k) => regionKo.get(k) ?? k),
  section("언어 (집필 언어, 복수 가능)", tally(a, (x) => x.languages), a.length, (k) => LANGUAGE_LABELS[k] ?? k),
  section("젠더", tally(a, (x) => [x.gender]), a.length, (k) => GENDER_KO[k as keyof typeof GENDER_KO] ?? k),
  section("장르 (복수 가능)", tally(a, (x) => x.genres), a.length, (k) => genreKo.get(k) ?? k),
  section("시대층 (복수 가능)", tally(a, (x) => x.periods), a.length, (k) => periodKo.get(k) ?? k),
  section("티어", tally(a, (x) => [x.tier]), a.length, (k) => k),
  section("검토 상태", tally(a, (x) => [x.reviewStatus]), a.length, (k) => REVIEW_STATUS_KO[k as keyof typeof REVIEW_STATUS_KO] ?? k),
  section("관계 유형", tally(r, (x) => [x.type]), Math.max(1, r.length), (k) => relKo.get(k) ?? k),
  section(
    "관계 근거 수준",
    tally(r, (x) => [x.evidenceLevel]),
    Math.max(1, r.length),
    (k) => EVIDENCE_LEVEL_KO[k as keyof typeof EVIDENCE_LEVEL_KO] ?? k
  ),
  "### 관계 밀도",
  "",
  (() => {
    const deg = new Map<string, number>();
    for (const rel of r) {
      deg.set(rel.sourceId, (deg.get(rel.sourceId) ?? 0) + 1);
      deg.set(rel.targetId, (deg.get(rel.targetId) ?? 0) + 1);
    }
    const isolated = a.filter((x) => !deg.has(x.id));
    const sorted = [...deg.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
    return [
      `- 관계가 없는 작가: ${isolated.length}명${isolated.length > 0 ? ` (${isolated.map((x) => x.id).join(", ")})` : ""}`,
      `- 최다 연결: ${sorted.map(([id, n]) => `${id}(${n})`).join(", ")}`,
      "- 관계 수를 작가마다 균등하게 맞추지 않았다 — 적은 관계는 데이터 미완성 상태로 표시된다."
    ].join("\n");
  })(),
  ""
].join("\n");

const out = join(PKG_ROOT, "docs", "coverage-report.md");
writeFileSync(out, md);
console.log(`coverage report → docs/coverage-report.md (authors ${a.length}, relations ${r.length})`);
