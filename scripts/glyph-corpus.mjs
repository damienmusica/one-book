// 배포본이 실제로 그리는 글자의 전집 — dist/ 의 HTML 텍스트와 JSON(캡슐·색인 사전)에 한 번이라도
// 나오는 문자 하나하나. 폰트 서브셋(scripts/subset-fonts.sh)의 입력이다.
//
//   node scripts/glyph-corpus.mjs            → 문자들을 한 줄 텍스트로 stdout 에
//   node scripts/glyph-corpus.mjs --bold     → 굵게(600) 그려질 수 있는 글자만: 이름·제목·생성기와 런타임의 문장
//   node scripts/glyph-corpus.mjs --count    → 문자 종류별 개수만
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const set = new Set();
let files = 0;
if (process.argv.includes("--bold")) {
  // 본문 산문은 400 으로만 그려진다. 600 은 이름·제목·표제·단추·표 머리 — 데이터에서는 이름과 제목,
  // 코드에서는 생성기·런타임에 박힌 문장 전부(어느 것이 굵게 그려질지 코드로 가르지 않고 다 담는다).
  const g = JSON.parse(readFileSync(join(DIST, "graph.json"), "utf8"));
  for (const a of g.authors) for (const ch of `${a.k ?? ""}${a.o ?? ""}`) set.add(ch);
  const w = JSON.parse(readFileSync(join(DIST, "works.json"), "utf8"));
  for (const k in w) for (const ch of `${w[k][0]}${w[k][2]}`) set.add(ch);
  for (const f of ["scripts/generate-static-pages.ts", "scripts/lib/paper-seal.ts", "public/atlas.js", "public/book.js"]) {
    for (const ch of readFileSync(join(ROOT, f), "utf8")) set.add(ch);
  }
  files = 4;
} else {
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const f = join(dir, name);
      if (statSync(f).isDirectory()) walk(f);
      else if (name.endsWith(".html") || name.endsWith(".json")) {
        files++;
        // 태그 이름만 벗긴다. 속성값(alt·aria-label)은 화면에 그려질 수 있으니 남긴다.
        const text = readFileSync(f, "utf8").replace(/<\/?[a-zA-Z][^\s>]*/g, " ");
        for (const ch of text) set.add(ch);
      }
    }
  })(DIST);
}
// 화면에 늘 있는 것: 아스키 인쇄 문자 전부. 데이터에 없어도 런타임 문장이 쓴다.
for (let c = 0x20; c < 0x7f; c++) set.add(String.fromCodePoint(c));
const chars = [...set].filter((c) => c.codePointAt(0) >= 0x20 && !/\s/.test(c)).sort();

if (process.argv.includes("--count")) {
  const cat = { hangul: 0, cjk: 0, kana: 0, latin: 0, other: 0 };
  for (const c of chars) {
    const k = c.codePointAt(0);
    if (k >= 0xac00 && k <= 0xd7a3) cat.hangul++;
    else if ((k >= 0x4e00 && k <= 0x9fff) || (k >= 0x3400 && k <= 0x4dbf) || (k >= 0xf900 && k <= 0xfaff)) cat.cjk++;
    else if (k >= 0x3040 && k <= 0x30ff) cat.kana++;
    else if (k < 0x250) cat.latin++;
    else cat.other++;
  }
  console.log(JSON.stringify({ files, glyphs: chars.length, ...cat }));
} else {
  process.stdout.write(chars.join(""));
}
