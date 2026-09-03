// 스케치 인제스트 — 2026-09-04.
//
// 실루엣에게 한 문장을 준다: 왜 이 사람이 지도에 있는가. 그 한 줄이 빈 쪽을
// 읽고 싶은 쪽으로 바꾸고, 작가를 silhouette 에서 sketch 로 올린다.
//
//   npx tsx scripts/ingest-sketches.ts <candidates.json> [--write]
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
if (!file) throw new Error("usage: ingest-sketches <candidates.json> [--write]");

const raw = loadRawCollections();
const { dataset } = assembleDataset(raw);
if (!dataset) throw new Error("기존 코퍼스가 조립되지 않는다 — 먼저 그것부터 고쳐라");
const byId = new Map(dataset.authors.map((a) => [a.id, a]));

// 평가어 — 이 낱말들은 내용 없이 자리만 차지한다. 한 문장뿐인데 그중 하나가
// "위대한"이면 그 문장은 아무것도 말하지 않은 것이다.
const EMPTY = ["위대한", "뛰어난", "대표적인", "손꼽히는", "거장", "불멸의", "최고의", "가장 유명한"];
const MIN = 30;
const MAX = 200;

type Raw = { id?: unknown; importanceReason?: unknown };
const parsed = JSON.parse(readFileSync(file, "utf8"));
const candidates: Raw[] = Array.isArray(parsed) ? parsed : ((parsed as { sketches: Raw[] }).sketches ?? []);

const dropped: { id: string; why: string }[] = [];
const accepted = new Map<string, string>();

for (const c of candidates) {
  const id = String(c.id ?? "");
  const line = String(c.importanceReason ?? "").trim();
  const drop = (why: string) => dropped.push({ id: id || "(무명)", why });

  const a = byId.get(id);
  if (!a) { drop("작가가 코퍼스에 없다"); continue; }
  if ((a.depth ?? "plate") !== "silhouette") { drop(`이미 ${a.depth ?? "plate"} 다`); continue; }
  if (accepted.has(id)) { drop("중복"); continue; }
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

console.log(`스케치 ${accepted.size}명 · 버림 ${dropped.length}`);
if (dropped.length) {
  const why = new Map<string, number>();
  for (const dd of dropped) {
    const k = dd.why.replace(/\(.*\)/, "").trim();
    why.set(k, (why.get(k) ?? 0) + 1);
  }
  console.log("버린 이유:");
  for (const [k, n] of [...why].sort((x, y) => y[1] - x[1])) console.log(`  ${n.toString().padStart(4)} ${k}`);
}
const stillSil = dataset.authors.filter(
  (a) => (a.depth ?? "plate") === "silhouette" && !accepted.has(a.id)
).length;
console.log(`한 문장을 받지 못한 실루엣 ${stillSil}`);

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
    const line = accepted.get(String(row.id));
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
console.log(`승급 ${touched}명`);
