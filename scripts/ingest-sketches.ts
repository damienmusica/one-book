// 스케치 인제스트 — 2026-09-04.
//
// 실루엣에게 한 문장을 준다: 왜 이 사람이 지도에 있는가. 그 한 줄이 빈 쪽을
// 읽고 싶은 쪽으로 바꾸고, 작가를 silhouette 에서 sketch 로 올린다.
//
//   npx tsx scripts/ingest-sketches.ts <candidates.json> [--write]
//   npx tsx scripts/ingest-sketches.ts <candidates.json> --rewrite [--write]
//
// `--rewrite` 는 **이미 스케치인 사람의 문장을 고친다.** QC 가 되돌려 보낸 것을 적용하는
// 경로다. 빈 문장을 주면 그 사람은 실루엣으로 내려간다 — 할 말이 없으면 없는 것이 정직하다.
//
// 입력: {sketches:[{id, importanceReason}]} 또는 그 배열
// 출력: data/authors/silhouette-*.json 을 **제자리에서** 고친다 — 스케치는 새 파일이
// 아니라 같은 사람의 승급이고, 사람을 두 파일에 두면 id 가 충돌한다.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";

const file = process.argv[2];
const write = process.argv.includes("--write");
const rewrite = process.argv.includes("--rewrite");
if (!file) throw new Error("usage: ingest-sketches <candidates.json> [--write]");

const raw = loadRawCollections();
const { dataset } = assembleDataset(raw);
if (!dataset) throw new Error("기존 코퍼스가 조립되지 않는다 — 먼저 그것부터 고쳐라");
const byId = new Map(dataset.authors.map((a) => [a.id, a]));

// 평가어 — 이 낱말들은 내용 없이 자리만 차지한다. 한 문장뿐인데 그중 하나가
// "위대한"이면 그 문장은 아무것도 말하지 않은 것이다.
const EMPTY = ["위대한", "뛰어난", "대표적인", "손꼽히는", "거장", "불멸의", "최고의", "가장 유명한"];
// 최초형은 그 사람에 대한 주장이 아니라 **그전에 살았던 모든 사람에 대한 주장**이고,
// 대개 앞선 사람을 확인하지 않고 쓰인다. 2026-09-04 적대적 QC 실측: 최초형을 담은
// 문장의 오류율 27.8% vs 그 밖 2.8% — 열 배다(docs/qc-sketch-wave.md).
// 금지하지는 않는다. 참인 최초형도 있고, 금지하면 문장이 더 모호한 표현으로 도망칠
// 뿐이다. **세는 것이 규율이다** — 세어서 보고하면 다음 QC 가 어디를 볼지 안다.
const SUPERLATIVE = /처음|최초|유일|가장 이른|첫 번째|시초|효시/;
const MIN = 30;
const MAX = 200;

type Raw = { id?: unknown; importanceReason?: unknown };
const parsed = JSON.parse(readFileSync(file, "utf8"));
const candidates: Raw[] = Array.isArray(parsed) ? parsed : ((parsed as { sketches: Raw[] }).sketches ?? []);

const dropped: { id: string; why: string }[] = [];
const accepted = new Map<string, string>();
const demoted = new Set<string>();

for (const c of candidates) {
  const id = String(c.id ?? "");
  const line = String(c.importanceReason ?? "").trim();
  const drop = (why: string) => dropped.push({ id: id || "(무명)", why });

  const a = byId.get(id);
  if (!a) { drop("작가가 코퍼스에 없다"); continue; }
  const depth = a.depth ?? "plate";
  if (rewrite ? depth !== "sketch" : depth !== "silhouette") { drop(`${depth} 다`); continue; }
  if (accepted.has(id) || demoted.has(id)) { drop("중복"); continue; }
  // 고쳐 쓸 말이 없다 — 그 사람은 실루엣으로 내려간다.
  if (rewrite && !line) { demoted.add(id); continue; }
  if (line.length < MIN) { drop(`너무 짧다 (${line.length}자)`); continue; }
  if (line.length > MAX) { drop(`한 문장이 아니다 (${line.length}자)`); continue; }
  // 문장 하나. 마침표가 여럿이면 둘 이상을 쓴 것이다(『』 안의 것은 세지 않는다).
  const stops = line.replace(/『[^』]*』/g, "").match(/[.!?。]/g)?.length ?? 0;
  if (stops > 1) { drop(`문장이 ${stops}개다`); continue; }
  const empty = EMPTY.find((w) => line.includes(w));
  if (empty) { drop(`평가어 (${empty})`); continue; }
  // 이름으로 시작하면 제목을 두 번 읽는 셈이다 — 이름은 이미 그 위에 있다.
  if (line.startsWith(a.names.ko)) { drop("이름으로 시작한다"); continue; }
  accepted.set(id, line);
}

const supers = [...accepted.values()].filter((l) => SUPERLATIVE.test(l)).length;
console.log(
  `${rewrite ? "고쳐 쓴 문장" : "스케치"} ${accepted.size}명` +
    (demoted.size ? ` · 실루엣으로 내림 ${demoted.size}명` : "") +
    ` · 버림 ${dropped.length} · 최초형 주장 ${supers}` +
    (accepted.size ? ` (${((supers / accepted.size) * 100).toFixed(1)}% — QC 는 여기부터 본다)` : "")
);
if (dropped.length) {
  const why = new Map<string, number>();
  for (const dd of dropped) {
    const k = dd.why.replace(/\(.*\)/, "").trim();
    why.set(k, (why.get(k) ?? 0) + 1);
  }
  console.log("버린 이유:");
  for (const [k, n] of [...why].sort((x, y) => y[1] - x[1])) console.log(`  ${n.toString().padStart(4)} ${k}`);
}
if (!rewrite) {
  const stillSil = dataset.authors.filter(
    (a) => (a.depth ?? "plate") === "silhouette" && !accepted.has(a.id)
  ).length;
  console.log(`한 문장을 받지 못한 실루엣 ${stillSil}`);
}

if (!write) {
  console.log("(--write 없이 실행 — 파일을 쓰지 않았다)");
  process.exit(0);
}

// 사람은 있던 파일에서 승급한다 — 새 파일로 옮기면 같은 id 가 두 곳에 선다.
let touched = 0;
for (const [path, list] of Object.entries(raw.authorFiles)) {
  const rows = list as Record<string, unknown>[];
  let changed = false;
  for (const row of rows) {
    const id = String(row.id);
    if (demoted.has(id)) {
      row.depth = "silhouette";
      delete row.importanceReason;
      changed = true;
      touched++;
      continue;
    }
    const line = accepted.get(id);
    if (!line) continue;
    row.depth = "sketch";
    row.importanceReason = line;
    changed = true;
    touched++;
  }
  if (changed) {
    writeFileSync(join(PKG_ROOT, "data", path.replace(/^authors\//, "authors/")), JSON.stringify(rows, null, 2) + "\n");
    console.log(`  → data/${path} (${rows.filter((r) => r.depth === "sketch").length} 스케치)`);
  }
}
console.log(`${rewrite ? "고침" : "승급"} ${touched}명`);
