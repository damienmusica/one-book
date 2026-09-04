// 하나의 책 — 정적 표면 생성기. 이 파일이 제품의 전부다.
//
// 2026-08-31 철거(결정 (132)) 이후 이 레포에 번들러도 SPA 도 없다. 작가 100인·
// 작품 513편·관계 263건을 우리가 이미 소유한 큐레이션 산문으로 구운 **정적
// HTML** 이 제품이고, 이 스크립트가 그것을 굽는다.
//
//   tsx scripts/generate-static-pages.ts [--out dist]
//
// 하드 제약 준수: 정적 HTML 뿐. 계정·DB·외부 요청·추적 없음. 담기(읽고 싶음)는
// 방문자 브라우저의 localStorage(lp.universe.personal.v2)에만 남는다.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { GENRE_DEFS, LANGUAGE_LABELS, PERIOD_DEFS, REGION_DEFS } from "../src/types.ts";
import type { Author, Edition, Relation, Work } from "../src/types.ts";
import { EVIDENCE_KO, REL_KO, relationGlyph } from "../src/book/relations.ts";
import { READY_IDS, showsPhysicalRecord } from "../src/book/readiness.ts";

const BASE = "https://literary-planet.pages.dev";
const outArg = process.argv.indexOf("--out");
// resolve — join 은 절대 경로 인자를 이어 붙인다(`<root>/var/folders/…`).
// 그 버그 때문에 --out 이 조용히 엉뚱한 자리에 굽고 있었다.
const OUT = resolve(PKG_ROOT, outArg >= 0 ? (process.argv[outArg + 1] ?? "dist") : "dist");

// 출력을 먼저 비운다. 번들러가 하던 청소를 아무도 물려받지 않아, 첫 배포에서
// 은퇴한 진입점(universe.html · chart.html · 옛 assets 청크)이 dist 에 남은 채
// 함께 올라갔다 — 삭제한 표면이 프로덕션에서 200 을 반환했다. 생성기는 쓰기만
// 하고 지우지 않으므로, 지우는 것도 생성기의 일이다.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const edArg = process.argv.indexOf("--editions");
const rawCollections = loadRawCollections();
if (edArg >= 0 && process.argv[edArg + 1]) {
  rawCollections.editions = JSON.parse(readFileSync(resolve(process.argv[edArg + 1]!), "utf8"));
}
const { dataset, errors } = assembleDataset(rawCollections);
if (!dataset) throw new Error(`dataset failed: ${errors.join("; ")}`);
const d = dataset;
const byId = new Map(d.authors.map((a) => [a.id, a]));
const worksOf = (id: string): Work[] => d.works.filter((w) => w.authorId === id);
const relsOf = (id: string): Relation[] =>
  d.relations.filter((r) => r.sourceId === id || r.targetId === id);
const movementKo = (id: string): string => d.movements.find((m) => m.id === id)?.ko ?? id;
const regionKo = (id: string): string => REGION_DEFS.find((r) => r.id === id)?.ko ?? id;
const langKo = (id: string): string => LANGUAGE_LABELS[id] ?? id;
const genreKo = (id: string): string => GENRE_DEFS.find((g) => g.id === id)?.ko ?? id;
/**
 * 연도 한 칸. 고대가 318명 들어오면서 `-340`은 더 이상 읽히는 수가 아니게 됐다.
 * 기원전은 기원전이라고 쓴다 — 부호는 데이터의 것이지 독자의 것이 아니다.
 */
/** 깊이의 순서 — 도판이 가장 깊다. 「실루엣이 아닌 것」은 이제 도판을 뜻하지 않는다. */
const rank = (a: Author): number => ({ plate: 2, sketch: 1, silhouette: 0 })[a.depth ?? "plate"];
const yr = (n: number): string => (n < 0 ? `기원전 ${-n}` : String(n));
const span = (from: number, to: number | undefined): string =>
  to === undefined ? `${yr(from)}–` : from < 0 && to < 0 ? `기원전 ${-from}–${-to}` : `${yr(from)}–${yr(to)}`;


const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GLYPH: Record<string, string> = { out: "→", in: "←", both: "↔" };

// 연도 한 칸이 무엇인지 말한다. 전승 문학에서 이걸 적지 않으면 "모른다"가
// "안다"가 된다 — 길가메시·베오울프·향가에 확정 연도는 없다.
const YEAR_BASIS_KO: Record<string, string> = {
  attested: "",
  "composition-range": " 무렵(성립 시기 추정)",
  "earliest-manuscript": " (현존 최고 사본)",
  "first-print": " (초간)"
};

// ── 상태 사다리 (2026-08-31, CPO) ────────────────────────────────────────────
//
//   모르는 책 → 관심 있는 책 → 펼쳐본 책 → 구매한 책 → 읽은 책
//
// **「모르는 책」은 기본값이고 저장되지 않는다.** 사용자가 "나는 이걸 모른다"를
// 선언하는 제품은 세상에 없다 — 그건 나머지 전부의 여집합이니까. 그런데 그
// 여집합에 **이름을 붙이는 것**은 다른 얘기고, 그게 이 사다리의 핵심이다:
// 표시되지 않은 책은 빈칸이 아니라 아직 만나지 않은 책이다. 새 책을 볼 때마다
// 그 자리에서 한 칸 올리면 된다.
//
// 다섯 칸 전부 **독자의 선언**이다. 우리는 누가 무엇을 펼쳤는지 관측할 수 없고,
// 페이지를 열었다는 사실에서 그것을 추론하면 지어내는 것이 된다. 「읽은 책」은
// v2 의 `read` 를 이어받는 칸이다 — 그 기록을 버리지 않기 위해 사다리 끝에 둔다.
//
// 카운터·퍼센트·연속일은 없다. 독서에 대해 직접 측정된 유일한 개입이 그것을
// 금지한다(Etkin, JCR 2016: 페이지 카운터가 독서량을 올렸지만 즐거움을 떨어뜨렸고,
// 카운터를 떼자 그 집단이 오히려 덜 읽었다 — 3.75 vs 4.20, p=.034).
//
// 전송 없음: 값은 이 브라우저에만 남는다.
const RUNTIME_JS = `
var LP_STATES=[['','모르는 책'],['want','관심 있는 책'],['opened','펼쳐본 책'],['have','구매한 책'],['read','읽은 책']];
var LP_KEY='lp.reader.v3';
function lpLoad(){try{
  var raw=localStorage.getItem(LP_KEY);
  if(raw)return JSON.parse(raw);
  // v2 이관 — want/read 는 같은 작품 키에 대한 같은 주장이다. 타임스탬프를 보존해 옮긴다.
  var old=JSON.parse(localStorage.getItem('lp.universe.personal.v2')||'null');
  var p={v:3,state:{}};
  if(old){
    for(var k in (old.want||{}))p.state[k]={s:'want',at:old.want[k]};
    for(var k2 in (old.read||{}))p.state[k2]={s:'read',at:old.read[k2]};
    localStorage.setItem(LP_KEY,JSON.stringify(p));
  }
  return p;
}catch(e){return {v:3,state:{}};}}
function lpSave(p){try{localStorage.setItem(LP_KEY,JSON.stringify(p));}catch(e){}}
function lpMetric(name){try{var m=JSON.parse(localStorage.getItem('lp.metrics')||'{}');
if(!m[name]){m[name]=Date.now();localStorage.setItem('lp.metrics',JSON.stringify(m));}}catch(e){}}
function lpSet(id,s,el){var p=lpLoad();
  if(s)p.state[id]={s:s,at:Date.now()};else delete p.state[id];
  lpSave(p);
  if(el)el.setAttribute('data-state',s||'');
  lpMetric('firstMark');
  if(s==='want')lpMetric('firstWant');}
function lpPaint(){var p=lpLoad();
  var sels=document.querySelectorAll('select[data-work]');
  for(var i=0;i<sels.length;i++){var el=sels[i];var id=el.getAttribute('data-work');
    var cur=(p.state[id]&&p.state[id].s)||'';el.value=cur;el.setAttribute('data-state',cur);
    if(!el.getAttribute('data-bound')){el.setAttribute('data-bound','1');
      el.addEventListener('change',function(){lpSet(this.getAttribute('data-work'),this.value,this);});}}}
(function(){lpMetric('firstLoad');
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lpPaint);else lpPaint();})();
`.trim();

const CSS = `
:root{--bg:#14100a;--paper:#f0e7cd;--ink:#2b2015;--text:#ecdfc3;--dim:#b5aa90;--faint:#8f8674;
--brass:#cfa759;--brass-b:#e9c76f;--line:rgba(207,167,89,.22);--veil:rgba(20,16,10,.6)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Noto Serif KR','Apple SD Gothic Neo','Nanum Myeongjo','Malgun Gothic',serif;line-height:1.7;
padding:0 18px 80px;max-width:760px;margin:0 auto}
a{color:var(--brass-b);text-decoration:none}a:hover{text-decoration:underline}
header.site{display:flex;gap:14px;align-items:baseline;padding:22px 0 14px;border-bottom:1px solid var(--line);margin-bottom:26px}
header.site .brand{font-size:15px;letter-spacing:.3em;color:var(--text)}
header.site nav{margin-left:auto;font-size:12.5px;display:flex;gap:12px}
h1{font-size:27px;letter-spacing:.04em;margin:4px 0 2px}
.orig{color:var(--dim);font-size:14px;margin-bottom:6px}
.life{color:var(--dim);font-size:13px;margin-bottom:18px}
.why{font-size:15.5px;margin:0 0 22px;border-left:2px solid var(--brass);padding-left:14px}
h2{font-size:13px;letter-spacing:.22em;color:var(--faint);margin:30px 0 10px;font-weight:600}
ol.works,ul.works{list-style:none}
.works li{padding:9px 0;border-bottom:1px dashed var(--line)}
.works .t{font-size:15.5px}.works .y{color:var(--faint);font-size:12px;margin-left:7px}
.works .sig{color:var(--dim);font-size:13.5px;margin-top:3px}
.works .entrywhy{color:var(--text);font-size:13.5px;margin-top:3px}
.tag{font-size:10.5px;border:1px solid var(--line);border-radius:2px;padding:1px 6px;margin-left:7px;color:var(--dim);vertical-align:1px}
select.state{font:inherit;font-size:11px;letter-spacing:.05em;color:var(--faint);background:none;
border:1px solid var(--line);border-radius:2px;padding:2px 6px;margin-left:8px;cursor:pointer;
vertical-align:1px;-webkit-appearance:none;appearance:none}
select.state option{background:var(--bg);color:var(--text)}
/* 사다리를 오를수록 잉크가 진해진다. 숫자도 퍼센트도 없다 — 칸의 이름뿐이다. */
select.state[data-state="want"]{color:var(--brass-b);border-color:var(--brass-a55,rgba(207,167,89,.5))}
select.state[data-state="opened"]{color:var(--brass-b);border-color:var(--brass);background:rgba(207,167,89,.08)}
select.state[data-state="have"]{color:var(--text);border-color:var(--brass);background:rgba(207,167,89,.16)}
select.state[data-state="read"]{color:var(--paper);border-color:var(--brass-b);background:rgba(207,167,89,.28)}
ul.rels{list-style:none}
.rels li{padding:8px 0;border-bottom:1px dashed var(--line);font-size:14px}
.rels .g{color:var(--brass);margin-right:6px}.rels .rt{font-size:11px;color:var(--faint);margin:0 6px}
.rels .sum{color:var(--dim);font-size:13px;margin-top:2px}
.rels .ev{font-size:11px;color:var(--faint)}
.warn{border:1px solid var(--line);padding:10px 12px;font-size:13.5px;color:var(--dim);margin:16px 0}
.doors{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 4px}
.doors a{border:1px solid var(--brass);border-radius:2px;padding:7px 14px;font-size:13px}
blockquote.open{border-left:2px solid var(--brass);padding:6px 14px;margin:14px 0;font-size:15px}
blockquote.open .ko{color:var(--dim);font-size:13.5px;margin-top:4px}
blockquote.open .lbl{font-size:10.5px;color:var(--faint);letter-spacing:.1em}
.edrow{font-size:13px;color:var(--dim);padding:3px 0}
footer.site{margin-top:44px;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--faint)}
.idx{columns:2;column-gap:28px;font-size:14.5px}.idx li{padding:4px 0;list-style:none;break-inside:avoid}
.idx .y{color:var(--faint);font-size:11.5px;margin-left:6px}
.find{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:16px 0 4px}
.find input[type=search]{flex:1 1 100%;padding:11px 13px;font:inherit;font-size:15px;
  color:var(--text);background:rgba(207,167,89,.07);border:1px solid var(--line);border-radius:3px;
  -webkit-appearance:none;appearance:none}
.find input[type=search]::placeholder{color:var(--faint)}
.find input[type=search]:focus{outline:none;border-color:var(--brass-b);background:rgba(207,167,89,.12)}
.find select{flex:1 1 0;min-width:0;padding:9px 10px;font:inherit;font-size:13px;color:var(--dim);
  background:rgba(207,167,89,.05);border:1px solid var(--line);border-radius:3px}
.find select:focus{outline:none;border-color:var(--brass-b)}
.find #cnt{flex:0 0 auto;font-size:12px;color:var(--brass)}
details{margin:6px 0 2px}
details>summary{cursor:pointer;font-size:12.5px;letter-spacing:.12em;color:var(--faint);padding:4px 0}
details>summary:hover{color:var(--brass-b)}
ul.eds{list-style:none}
.eds li{padding:8px 0;border-bottom:1px dashed var(--line);font-size:14px}
.eds .pub{color:var(--text)}.eds .meta{color:var(--faint);font-size:12px;margin-left:6px}
.eds .isbn{color:var(--faint);font-size:11.5px;letter-spacing:.04em}
.absent{color:var(--dim);font-size:13.5px;margin:6px 0 10px}
.census{margin:26px 0 8px;padding-top:12px;border-top:1px dashed var(--line);color:var(--faint);font-size:12.5px;letter-spacing:.06em}
.census strong{color:var(--brass-b);font-weight:600}
/* 실루엣은 잉크가 옅다 — 만나지 않은 것의 모양 */
.silhouette h1{color:var(--dim)}
.silhouette .orig,.silhouette .life{color:var(--faint)}
.idx.sil a{color:var(--dim)}
/* 준비도 — 당신이 읽은 것이 이 사람을 열었다는 한 줄 */
.ready{margin:10px 0 16px;padding:8px 12px;border-left:2px solid var(--brass);background:rgba(207,167,89,.07);color:var(--brass-b);font-size:13.5px}
.literacy h3{font-size:11.5px;letter-spacing:.2em;color:var(--faint);margin:16px 0 6px;font-weight:600}
ul.meters{list-style:none;margin:0}
.meters li{display:flex;align-items:center;gap:10px;padding:3px 0;font-size:12.5px}
.meters .t{flex:0 0 108px;color:var(--dim)}
.meters .meter{flex:1;height:5px;background:rgba(207,167,89,.13);border-radius:3px;overflow:hidden}
.meters .meter i{display:block;height:100%;background:var(--brass);border-radius:3px}
.meters .y{flex:0 0 52px;text-align:right;color:var(--faint);font-size:11.5px}
.auth{margin:34px 0 0;padding-top:14px;border-top:1px dashed var(--line);font-size:13px}
.auth form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.auth input{flex:1 1 200px;min-width:0;font:inherit;font-size:14px;background:rgba(207,167,89,.07);
  border:1px solid var(--line);border-radius:3px;color:var(--text);padding:10px 12px;-webkit-appearance:none;appearance:none}
.auth input::placeholder{color:var(--faint)}
.auth input:focus{outline:none;border-color:var(--brass-b);background:rgba(207,167,89,.12)}
/* 사이트에 버튼은 이 하나뿐이다 — 문(.doors a)과 같은 옷을 입힌다. */
.auth button{flex:0 0 auto;font:inherit;font-size:13px;letter-spacing:.02em;color:var(--brass-b);
  background:none;border:1px solid var(--brass);border-radius:2px;padding:9px 15px;cursor:pointer;
  -webkit-appearance:none;appearance:none}
.auth button:hover{background:rgba(207,167,89,.12)}
.auth button:disabled{opacity:.5;cursor:default}
.auth .sig{flex:1 1 100%;color:var(--dim);font-size:12.5px;margin-top:6px}
@media(max-width:560px){.idx{columns:1}}
`.trim();

/**
 * 색인은 SEO 의 문제이지 탐험의 문제가 아니다. 검토되지 않은 쪽도 사람은 색인·검색·
 * 격자로 얼마든지 걸어 들어온다 — 다만 우리가 **검색엔진에 사실이라고 제출하지는**
 * 않는다. 스케치 1,363명의 한 문장은 아직 아무도 검증하지 않았다.
 * `follow` 는 남긴다: 크롤러가 격자를 걸어 도판에 닿는 길은 열어 둔다.
 */
function page(o: {
  title: string;
  desc: string;
  path: string;
  body: string;
  ld?: object;
  noindex?: boolean;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
${o.noindex ? `<meta name="robots" content="noindex,follow">` : ""}
<link rel="canonical" href="${BASE}${o.path}">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='2.6' fill='%23eccb82'/%3E%3Ccircle cx='7' cy='9' r='1.3' fill='%23cfa759'/%3E%3Ccircle cx='25' cy='11' r='1.1' fill='%23cfa759'/%3E%3Ccircle cx='22' cy='24' r='1.5' fill='%23cfa759'/%3E%3Cpath d='M7 9 L16 16 L25 11 M16 16 L22 24' stroke='%236a5a3a' stroke-width='.8' fill='none'/%3E%3C/svg%3E">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<style>${CSS}</style>
<script>${RUNTIME_JS}</script>
<script type="module" src="/book.js"></script>
${o.ld ? `<script type="application/ld+json">${JSON.stringify(o.ld)}</script>` : ""}
</head>
<body>
<header class="site">
  <a class="brand" href="/authors/">하나의 책</a>
  <nav><a href="/">첫 장</a><a href="/shelf/">서재</a><a href="/authors/">색인</a></nav>
</header>
${o.body}
<div id="lp-auth" class="auth" hidden></div>
<footer class="site">
  도판 ${d.authors.filter((a) => (a.depth ?? "plate") === "plate").length}인 검토${
    d.authors.some((a) => a.depth === "sketch")
      ? ` · 스케치 ${d.authors.filter((a) => a.depth === "sketch").length}인은 한 문장`
      : ""
  } · 실루엣 ${d.authors.filter((a) => (a.depth ?? "plate") === "silhouette").length}인은 이름과 자리 ·
  작품 ${d.works.length} · 관계 ${d.relations.length} · 출처 ${d.sources.length}. 지어내지 않는다: 없는 것은 없다고 적는다.
</footer>
</body>
</html>`;
}

const firstSentence = (s: string): string => s.match(/^.*?다\./)?.[0] ?? s;

// ── 구하기 (판본 레이어) ───────────────────────────────────────────────────
// 서점·도서관으로 나가는 문은 **결정론적 링크**다: 크롤링도 API 키도 없이,
// 제목과 작가 이름만으로 주소가 정해진다. 검수된 판본이 있으면 그 ISBN 의
// 상품 페이지로, 없으면 검색으로 — 그리고 없다는 사실을 날짜와 함께 적는다.
const q = (s: string): string => encodeURIComponent(s);
const ALADIN_ISBN = (isbn: string): string =>
  `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${isbn}`;
const ALADIN_SEARCH = (s: string): string =>
  `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${q(s)}`;
const KYOBO_SEARCH = (s: string): string => `https://search.kyobobook.co.kr/search?keyword=${q(s)}`;
const NL_SEARCH = (s: string): string => `https://www.nl.go.kr/NL/contents/search.do?kwd=${q(s)}`;

function acquireBlock(w: Work, a: Author | undefined): string {
  const eds: Edition[] = d.editions.editions[w.id] ?? [];
  const term = `${w.titleKo} ${a ? a.names.ko : ""}`.trim();
  if (eds.length) {
    return `<h2>구하기 — 검수된 판본 ${eds.length}</h2>
<ul class="eds">
${eds
  .map(
    (e) => `  <li><span class="pub">${esc(e.publisher)}</span>${e.translator ? `<span class="meta">${esc(e.translator)} 옮김</span>` : ""}<span class="meta">${e.year}</span>${e.title !== w.titleKo ? `<span class="meta">『${esc(e.title)}』 수록</span>` : ""}${e.sourceTextBasis && e.sourceTextBasis !== "original" ? `<span class="meta">${e.sourceTextBasis === "relay" ? "중역" : "번안·재화"}</span>` : ""}
    <div><a href="${ALADIN_ISBN(e.isbn13)}" rel="nofollow noopener">서점</a> · <a href="${NL_SEARCH(e.isbn13)}" rel="nofollow noopener">도서관</a> <span class="isbn">ISBN ${esc(e.isbn13)}</span></div>
    <p class="sig">${esc(e.verifiedFrom)} · ${esc(e.verifiedAt)} 확인${e.note ? ` — ${esc(e.note)}` : ""}</p></li>`
  )
  .join("\n")}
</ul>`;
  }
  // 없음의 원장이 이 작품을 이름으로 지목했다면, "아직 안 봤다"가 아니라
  // **"찾았고 없었다"**가 사실이다. 둘은 다른 문장이고 다른 날짜를 갖는다.
  const gone = d.editions.absent?.[w.id];
  if (gone) {
    return `<h2>구하기</h2>
<p class="absent">한국어 판본을 <strong>찾지 못했다</strong> — ${esc(gone.checkedAt)} 확인. 뒤진 곳: ${esc(gone.searched.join(" · "))}.${gone.note ? ` ${esc(gone.note)}` : ""}
이 작품은 지도에 남는다. 없는 것은 없다고 적는다.</p>
<div class="doors">
  <a href="${ALADIN_SEARCH(term)}" rel="nofollow noopener">그래도 찾아보기 — 알라딘</a>
  <a href="${NL_SEARCH(term)}" rel="nofollow noopener">국립중앙도서관</a>
</div>`;
  }
  // 코퍼스의 절반은 한국어 번역이 있는지조차 모르는 책이다. 한국어 제목으로만 검색을
  // 걸면 그 책들은 "없다"가 아니라 "찾을 수 없다"가 되고, 원제로 한 번 더 두드리면
  // 도서관 목록에는 대개 원서가 있다.
  const orig = (w.titleOriginal ?? "").trim();
  const origTerm = `${orig} ${a ? a.names.original : ""}`.trim();
  return `<h2>구하기</h2>
<p class="absent">한국어 판본을 아직 검수하지 않았다 (${esc(d.editions.checkedAt)} 확인). 아래는 검색으로 나가는 문이고, 우리가 확인한 판본이 아니다.</p>
<div class="doors">
  <a href="${ALADIN_SEARCH(term)}" rel="nofollow noopener">알라딘에서 찾기</a>
  <a href="${KYOBO_SEARCH(term)}" rel="nofollow noopener">교보문고에서 찾기</a>
  <a href="${NL_SEARCH(term)}" rel="nofollow noopener">국립중앙도서관에서 찾기</a>
${orig && orig !== w.titleKo ? `  <a href="${NL_SEARCH(origTerm)}" rel="nofollow noopener">원제로 찾기 — ${esc(orig)}</a>` : ""}
</div>`;
}

const STATE_OPTIONS = [
  ["", "모르는 책"],
  ["want", "관심 있는 책"],
  ["opened", "펼쳐본 책"],
  ["have", "구매한 책"],
  ["read", "읽은 책"]
] as const;

/** 사다리 한 칸. 기본값 「모르는 책」은 저장되지 않고, 이름만 갖는다. */
function stateControl(workId: string): string {
  const opts = STATE_OPTIONS.map(([v, ko]) => `<option value="${v}">${ko}</option>`).join("");
  return `<select class="state" data-work="${esc(workId)}" data-state="" aria-label="상태">${opts}</select>`;
}

// 관계 한 줄. 2026-08-31 실측: 배포된 작가 페이지 100/100 이 카드 부채 상한
// (880자)을 넘겼고 평균 2,332자·최대 4,519자·관계 블록 최대 18개였다 — 3D
// 카드를 정문에서 끌어내린 그 결함이 정적 페이지로 이주해 2.5배로 자라 있었다.
// 계측기(verify-journey)가 universe.html 만 열었기 때문에 아무도 재지 않았다.
// 증거가 지시하는 개입은 슬롯을 더 만드는 것이 아니라 **목록을 자르는 것**이다
// (위키백과: 신규 링크의 66%가 한 달간 클릭 0 · Upworthy: 고농도에서 +1SD 농도
// → CTR −9.9%). 하나만 펴고 나머지는 접는다.
function relRow(r: Relation | undefined, selfId: string): string {
  if (!r) return "";
  const otherId = r.sourceId === selfId ? r.targetId : r.sourceId;
  const other = byId.get(otherId);
  if (!other) return "";
  const g = GLYPH[relationGlyph(r, selfId)] ?? "·";
  return `<li><span class="g">${g}</span><a href="/authors/${esc(otherId)}/">${esc(other.names.ko)}</a><span class="rt">${esc(REL_KO[r.type] ?? r.type)}</span>
    <p class="sum">${esc(r.summary)} <span class="ev">${esc(EVIDENCE_KO[r.evidenceLevel] ?? r.evidenceLevel)} · 출처 ${r.sourceIds.length}건</span></p></li>`;
}

// 목록의 한 줄은 **한 문장**이다. 산문 전체는 그 작품의 페이지에 있고, 거기가
// 독자가 그 책 하나를 두고 결정하는 자리다 — 목록에서 문단을 겹쳐 쌓으면
// 농도만 올라가고 클릭은 내려간다(Upworthy 사전등록 메타분석: 고농도 맥락에서
// +1SD → CTR −9.9%).
/** 이어지는 한 사람 — 0건 경로가 있어서 순수 함수로 뺐다(유닛으로 잡힌다). */
export function relationsSection(rels: Relation[], selfId: string): string {
  if (!rels.length) {
    return `<p class="absent">아직 이 작가에게서 이어지는 선을 긋지 못했다. 관계는 출처가 있을 때만 그린다.</p>`;
  }
  return `<h2>이어지는 한 사람</h2>
<ul class="rels">${relRow(rels[0], selfId)}</ul>`;
}

function workRow(w: Work, entryWhy?: string): string {
  return `<li>
    <span class="t"><a href="/works/${esc(w.id)}/">${esc(w.titleKo)}</a></span><span class="y">${esc(yr(w.year))}</span>${w.world ? `<span class="tag">여는 문장</span>` : ""}${stateControl(w.id)}
    ${entryWhy ? `<p class="entrywhy">${esc(firstSentence(entryWhy))}</p>` : ""}
    ${w.significance ? `<p class="sig">${esc(firstSentence(w.significance))}</p>` : ""}
  </li>`;
}

// ── 동시대인 ────────────────────────────────────────────────────────────────
// 실루엣 1,365명을 세워놓고 문을 내지 않으면 그들은 색인에만 있는 이름이다. 문은
// **이미 데이터에 있는 것**으로 낸다: 같은 권역, 겹치는 활동 구간. 영향을 주장하지
// 않는다 — 주장에는 출처가 필요하고 우리에겐 그 출처가 없다. 같은 자리 같은 때에
// 있었다는 것은 주장이 아니라 우리가 이미 적어둔 두 좌표의 교차다.
// 권역별로 **활동 시작 연도 순** 줄. 이 줄이 격자의 뼈대다.
const byRegionYear = (() => {
  const m = new Map<string, Author[]>();
  for (const a of d.authors) for (const r of a.regions) m.set(r, (m.get(r) ?? []).concat([a]));
  for (const list of m.values()) list.sort((x, y) => x.activeRange[0] - y.activeRange[0] || x.id.localeCompare(y.id));
  return m;
})();
const idHash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/**
 * 겹침만으로 고르면 밀집 권역이 끊긴다. 영국·아일랜드 228명에서 "겹침 상위 8명"은
 * 활동 구간이 거의 같은 사람들이고, 그들이 서로만 가리키면 18세기 한 덩어리가 통째로
 * 섬이 된다 (실측: 1,465명 중 529명 도달 불가).
 *
 * 그래서 두 가지를 함께 낸다 — **겹침**(같은 때 가장 오래 함께 있었던 사람)과
 * **줄에서 바로 앞뒤**(권역을 활동 시작순으로 세웠을 때의 이웃). 뒤엣것이 각 권역을
 * 하나의 사슬로 꿰므로 어디서 걷기 시작해도 그 권역 전체에 닿는다.
 */
function contemporaries(a: Author, n = 10): Author[] {
  const [from, to] = a.activeRange;
  const pool = new Map<string, Author>();
  const chain: Author[] = [];
  for (const r of a.regions) {
    const line = byRegionYear.get(r) ?? [];
    const i = line.findIndex((b) => b.id === a.id);
    for (const b of line) if (b.id !== a.id) pool.set(b.id, b);
    if (i > 0) chain.push(line[i - 1]!);
    if (i >= 0 && i + 1 < line.length) chain.push(line[i + 1]!);
  }
  const overlap = [...pool.values()]
    .map((b) => ({ b, o: Math.min(to, b.activeRange[1]) - Math.max(from, b.activeRange[0]) }))
    .filter((x) => x.o >= 0)
    .sort(
      (x, y) =>
        y.o - x.o ||
        rank(y.b) - rank(x.b) ||
        idHash(a.id + x.b.id) - idHash(a.id + y.b.id)
    )
    .map((x) => x.b);
  const out = new Map<string, Author>();
  for (const b of chain) out.set(b.id, b);
  for (const b of overlap) { if (out.size >= n) break; out.set(b.id, b); }
  return [...out.values()].sort((x, y) => x.activeRange[0] - y.activeRange[0]);
}

function contemporariesSection(a: Author): string {
  const near = contemporaries(a);
  if (!near.length) return "";
  const row = (b: Author) =>
    `<li><span class="t"><a href="/authors/${esc(b.id)}/">${esc(b.names.ko)}</a></span>` +
    `<span class="y">${esc(span(b.activeRange[0], b.activeRange[1]))}</span>` +
    `${(b.depth ?? "plate") === "plate" ? `<span class="tag">도판</span>` : ""}</li>`;
  return `<details class="near"><summary>같은 자리, 같은 때 — ${near.length}명</summary>
<ul class="works">${near.map(row).join("\n")}</ul></details>`;
}

function authorPage(a: Author): string {
  const works = worksOf(a.id);
  const ordered = a.readingOrder
    .map((id) => works.find((w) => w.id === id))
    .filter((w): w is Work => Boolean(w));
  const rest = works.filter((w) => !a.readingOrder.includes(w.id)).sort((x, y) => x.year - y.year);
  const rels = relsOf(a.id).sort((x, y) => (y.weight ?? 0.7) - (x.weight ?? 0.7));
  const depth = a.depth ?? "plate";
  const life = `${a.birthYear === undefined ? "?" : span(a.birthYear, a.deathYear)} · ${a.languages.map(langKo).join("·")} · ${a.regions.map(regionKo).join("·")}${a.movements.length ? ` · ${a.movements.map(movementKo).join("·")}` : ""}`;
  // 난도는 아래에 이유와 함께 한 번 선다. 머리글에 숫자만 또 적으면 같은 것을 두 번
  // 읽히고, 그 자리는 예산에서 가장 값이 낮은 글자다.

  // ── 실루엣 (결정 (137)) ─────────────────────────────────────────────────
  // 지도 위의 자리다. 우리가 아는 것만 적고, 모르는 것은 **모른다고 적는다** —
  // 빈 페이지가 아니라 아직 채워지지 않은 페이지라고 말하는 것이 정직이다.
  // 도판이 아닌 쪽 — 실루엣과 스케치. 스케치는 **한 문장을 더한 실루엣**이다:
  // 왜 이 사람이 지도에 있는지 한 줄. 그 한 줄이 빈 쪽을 읽고 싶은 쪽으로 바꾼다.
  if (depth !== "plate") {
    const stillMissing =
      depth === "sketch"
        ? `<p class="absent"><strong>아직 스케치다.</strong> 왜 이 사람이 지도에 있는지 한 줄까지 안다.
입문 순서와 판본은 아직 우리가 놓지 않았다.</p>`
        : works.length
          ? `<p class="absent"><strong>아직 실루엣이다.</strong> 이 책들이 있다는 것과 언제 어느 말로 쓰였는지는 안다.
무엇이 이 사람을 그 자리에 세웠는지는 아직 우리가 읽지 않았다.</p>`
          : `<p class="absent"><strong>아직 실루엣이다.</strong> 이름과 자리는 안다 — 언제 어느 언어로 썼는지까지.
그 너머는 아직 우리가 읽지 않았다. 이 쪽은 비어 있는 것이 아니라 아직 채워지지 않았다.</p>`;
    const body = `
<article class="${depth}">
<h1>${esc(a.names.ko)}</h1>
<p class="orig">${esc(a.names.original)}</p>
<p class="life">${esc(life)} · 활동 ${esc(span(a.activeRange[0], a.activeRange[1]))}</p>
<p class="ready" id="lp-ready" data-author="${esc(a.id)}" hidden></p>
${a.importanceReason ? `<p class="why">${esc(a.importanceReason)}</p>` : ""}
${
  works.length
    ? `<h2>책 ${works.length}</h2>
<ul class="works">${[...works].sort((x, y) => x.year - y.year).map((w) => workRow(w)).join("\n")}</ul>
${stillMissing}`
    : stillMissing
}
${relationsSection(rels, a.id)}
${contemporariesSection(a)}
<div class="doors">
  <a href="/#${esc(a.id)}">책에서 이 자리 보기</a>
  <a href="/authors/">색인</a>
</div>
</article>`;
    return page({
      title: `${a.names.ko} — 하나의 책`,
      desc: a.importanceReason
        ? firstSentence(a.importanceReason)
        : `${a.names.ko}(${a.names.original}) — ${span(a.activeRange[0], a.activeRange[1])}. 「하나의 책」의 실루엣 항목.`,
      path: `/authors/${a.id}/`,
      body,
      noindex: true,
      ld: {
        "@context": "https://schema.org",
        "@type": "Person",
        name: a.names.original,
        alternateName: a.names.ko,
        birthDate: a.birthYear ? String(a.birthYear) : undefined,
        deathDate: a.deathYear ? String(a.deathYear) : undefined
      }
    });
  }

  const body = `
<article>
<h1>${esc(a.names.ko)}</h1>
<p class="orig">${esc(a.names.original)}</p>
<p class="life">${esc(life)}</p>
<p class="ready" id="lp-ready" data-author="${esc(a.id)}" hidden></p>
${a.importanceReason ? `<p class="why">${esc(a.importanceReason)}</p>` : ""}
<div class="doors">
  <a href="/#${esc(a.id)}">여기서 읽기 시작</a>
</div>
${ordered.length ? `<h2>입문 순서 ${ordered.length}</h2>` : ""}
<ol class="works">${ordered.map((w, i) => workRow(w, i === 0 ? a.readingEntryReason : undefined)).join("\n")}</ol>
${rest.length ? `<details><summary>그 밖의 작품 ${rest.length}</summary><ul class="works">${rest.map((w) => workRow(w)).join("\n")}</ul></details>` : ""}
${a.readingWarning ? `<p class="warn">주의 — ${esc(a.readingWarning)}</p>` : ""}
${a.difficulty ? `<p class="warn">난도 ${a.difficulty}/5${a.difficultyReason ? ` — ${esc(a.difficultyReason)}` : ""}</p>` : ""}
${relationsSection(rels, a.id)}
${
  rels.length > 1
    ? `<details><summary>나머지 관계 ${rels.length - 1} — 선이 그어진 이유</summary>
<ul class="rels">${rels.slice(1).map((r) => relRow(r, a.id)).join("\n")}</ul></details>`
    : ""
}
${contemporariesSection(a)}
<p class="life">출처 ${a.sourceIds.length}건</p>
</article>`;
  return page({
    title: `${a.names.ko} — 하나의 책`,
    desc: firstSentence(a.importanceReason),
    path: `/authors/${a.id}/`,
    body,
    ld: {
      "@context": "https://schema.org",
      "@type": "Person",
      name: a.names.original,
      alternateName: a.names.ko,
      birthDate: a.birthYear ? String(a.birthYear) : undefined,
      deathDate: a.deathYear ? String(a.deathYear) : undefined
    }
  });
}

function workPage(w: Work): string {
  const a = byId.get(w.authorId);
  const world = w.world;
  // 실물 기록은 **검수된 작가에게만** 선다 — 게이트는 readiness.ts 의 한 함수다
  // (인라인으로 두면 변이 스윕이 그 자리를 SURVIVED 로 잡는다: 오늘 실물
  //  데이터를 가진 작가가 전부 ready 라서 인라인 조건은 합성 없이 시험 불가).
  const verified = showsPhysicalRecord(w);
  // 증언의 결정 지점 배치(선행 연구 Ⅴ-2): 이 작품을 앵커로 지목한 관계 =
  // 작가가 작가에게 남긴 검토된 증언. BookTok 방정식(감정적 증언이 책을
  // 판다, 증거 최강)의 우리식 정직 번역 — 지어낸 것 0.
  const testimony = d.relations.filter((r) =>
    (r.anchors ?? []).some((an) => (an as { workId?: string }).workId === w.id)
  );
  const body = `
<article>
<h1>${esc(w.titleKo)}</h1>
<p class="orig">${esc(w.titleOriginal ?? "")}</p>
<p class="life">${a ? `<a href="/authors/${esc(a.id)}/">${esc(a.names.ko)}</a> · ` : ""}${esc(yr(w.year))}${YEAR_BASIS_KO[w.yearBasis ?? "attested"] ?? ""} · ${esc(genreKo(w.genre))} ${stateControl(w.id)}</p>
${
  w.significance
    ? `<p class="why">${esc(w.significance)}</p>`
    : `<p class="absent"><strong>아직 실루엣이다.</strong> 이 책이 있다는 것과 언제 어느 말로 쓰였는지는 안다.
그 너머 — 무엇이 이 책을 그 자리에 세웠는지 — 는 아직 우리가 읽지 않았다.</p>`
}
${
  verified && world
    ? `<blockquote class="open"><p>${esc(world.opening.original)}</p><p class="ko">${esc(world.opening.ko)}</p><span class="lbl">여는 문장 · 자체 번역</span></blockquote>
${world.written ? `<p class="edrow">집필 — ${esc(world.written)}</p>` : ""}
${world.editions.map((e) => `<p class="edrow">${e.kind === "first-edition" ? "초판" : "첫 인쇄"} — ${e.year}${e.month ? `. ${e.month}.` : ""} · ${esc(`${e.venue ? `${e.venue} · ` : ""}${e.publisher}, ${e.place}`)}${e.note ? ` — ${esc(e.note)}` : ""}</p>`).join("\n")}
${world.posthumous ? `<p class="edrow">유고 — ${esc(world.posthumous.note)}</p>` : ""}`
    : ""
}
${
  testimony.length
    ? `<h2>이 책을 지목한 작가들의 증언 ${testimony.length}</h2>
<ul class="rels">
${testimony
  .map((r) => {
    const witnessId = r.sourceId === w.authorId ? r.targetId : r.sourceId;
    const witness = byId.get(witnessId);
    if (!witness) return "";
    return `<li><a href="/authors/${esc(witnessId)}/"><strong>${esc(witness.names.ko)}</strong></a><span class="rt">${esc(REL_KO[r.type] ?? r.type)}</span>
    <p class="sum">${esc(r.summary)} <span class="ev">${esc(EVIDENCE_KO[r.evidenceLevel] ?? r.evidenceLevel)} · 출처 ${r.sourceIds.length}건</span></p></li>`;
  })
  .join("\n")}
</ul>`
    : ""
}
${acquireBlock(w, a)}
<div class="doors">
  ${a ? `<a href="/authors/${esc(a.id)}/">${esc(a.names.ko)}의 방으로</a>` : ""}
  ${a ? `<a href="/#${esc(a.id)}">이 작가에서 시작</a>` : ""}
</div>
${w.sourceIds.length ? `<p class="life">출처 ${w.sourceIds.length}건</p>` : ""}
</article>`;
  return page({
    title: `${w.titleKo}${a ? ` — ${a.names.ko}` : ""} · 하나의 책`,
    desc: w.significance
      ? firstSentence(w.significance)
      : `${w.titleKo}(${w.titleOriginal}) — ${a ? `${a.names.ko}, ` : ""}${w.year}. 「하나의 책」의 실루엣 항목.`,
    path: `/works/${w.id}/`,
    body,
    noindex: w.significance === undefined,
    ld: {
      "@context": "https://schema.org",
      "@type": "Book",
      name: w.titleOriginal ?? w.titleKo,
      alternateName: w.titleKo,
      datePublished: String(w.year),
      author: a ? { "@type": "Person", name: a.names.original } : undefined
    }
  });
}

function indexPage(): string {
  const sorted = [...d.authors].sort((x, y) => x.names.ko.localeCompare(y.names.ko, "ko"));
  const plates = sorted.filter((a) => (a.depth ?? "plate") === "plate");
  const sketches = sorted.filter((a) => a.depth === "sketch");
  const sils = sorted.filter((a) => (a.depth ?? "plate") === "silhouette");
  // 검색은 이미 페이지에 있는 것을 거른다 — 1,465행이 전부 정적 HTML 로 서 있으므로
  // 색인은 통째로 SEO 에 잡히고, 걸러내기는 DOM 순회 한 번이면 끝난다. 인덱스도,
  // 라이브러리도, 네트워크 왕복도 없다.
  // 사람은 작가 이름보다 책 제목을 더 자주 기억한다 — 「변신」을 치는 사람이 카프카를
  // 찾고 있다. 작품 제목(한국어·원어)까지 건초더미에 넣는다.
  const hay = (a: Author): string =>
    [
      a.names.ko,
      a.names.original,
      ...a.names.aliases,
      a.id.replace(/-/g, " "),
      ...worksOf(a.id).flatMap((w) => [w.titleKo, w.titleOriginal])
    ]
      .join(" ")
      .toLowerCase();
  const row = (a: Author): string =>
    `<li data-h="${esc(hay(a))}" data-r="${esc(a.regions.join(" "))}" data-p="${esc(a.periods.join(" "))}"><a href="/authors/${esc(a.id)}/">${esc(a.names.ko)}</a><span class="y">${esc(a.birthYear === undefined ? "?" : span(a.birthYear, a.deathYear))}</span></li>`;
  const regionsUsed = REGION_DEFS.filter((r) => d.authors.some((a) => a.regions.includes(r.id)));
  const periodsUsed = PERIOD_DEFS.filter((pd) => d.authors.some((a) => a.periods.includes(pd.id)));
  const body = `
<h1>색인 — 작가 ${d.authors.length}인</h1>
<p class="life">세계는 처음부터 전부 여기 있다. 도판 ${plates.length}인은 쪽이 채워졌고,${
  sketches.length ? ` 스케치 ${sketches.length}인은 한 문장을 얻었으며,` : ""
}
실루엣 ${sils.length}인은 이름과 자리로 서 있다 — 아직 만나지 않은 것의 모양이다.</p>
<div class="doors">
  <a href="/">책을 펴기</a>
</div>
<div class="find">
  <input type="search" id="q" placeholder="이름이나 책 제목으로 찾기" autocomplete="off" spellcheck="false">
  <select id="fr"><option value="">권역 전체</option>${regionsUsed.map((r) => `<option value="${esc(r.id)}">${esc(r.ko)}</option>`).join("")}</select>
  <select id="fp"><option value="">시대 전체</option>${periodsUsed.map((pd) => `<option value="${esc(pd.id)}">${esc(pd.ko)}</option>`).join("")}</select>
  <span id="cnt" class="y"></span>
</div>
<h2>도판 ${plates.length}</h2>
<ul class="idx">
${plates.map(row).join("\n")}
</ul>
${
  sketches.length
    ? `<h2>스케치 ${sketches.length}</h2>
<ul class="idx sk">
${sketches.map(row).join("\n")}
</ul>`
    : ""
}
${
  sils.length
    ? `<h2>실루엣 ${sils.length}</h2>
<ul class="idx sil">
${sils.map(row).join("\n")}
</ul>`
    : ""
}
<script>
(function(){
  var q=document.getElementById("q"), fr=document.getElementById("fr"), fp=document.getElementById("fp"),
      cnt=document.getElementById("cnt"), rows=[].slice.call(document.querySelectorAll(".idx>li")),
      heads=[].slice.call(document.querySelectorAll(".idx")).map(function(u){return u.previousElementSibling;});
  function run(){
    var s=q.value.trim().toLowerCase(), r=fr.value, p=fp.value, n=0;
    for(var i=0;i<rows.length;i++){
      var el=rows[i], ok=true;
      if(s&&el.getAttribute("data-h").indexOf(s)<0) ok=false;
      if(ok&&r&&(" "+el.getAttribute("data-r")+" ").indexOf(" "+r+" ")<0) ok=false;
      if(ok&&p&&(" "+el.getAttribute("data-p")+" ").indexOf(" "+p+" ")<0) ok=false;
      el.hidden=!ok; if(ok) n++;
    }
    // 한 칸도 남지 않은 절은 제목까지 접는다 — 빈 제목은 없는 것을 있다고 말한다
    [].slice.call(document.querySelectorAll(".idx")).forEach(function(u,j){
      var any=[].slice.call(u.children).some(function(c){return !c.hidden;});
      u.hidden=!any; if(heads[j]) heads[j].hidden=!any;
    });
    cnt.textContent = (s||r||p) ? n+"인" : "";
  }
  q.addEventListener("input",run); fr.addEventListener("change",run); fp.addEventListener("change",run);
})();
</script>`;
  return page({
    title: "색인 — 하나의 책",
    desc: `세계문학 작가 ${d.authors.length}인의 색인. 도판 ${plates.length}, 스케치 ${sketches.length}, 실루엣 ${sils.length}.`,
    path: "/authors/",
    body
  });
}

// ——— 서재 — 표시한 것이 모이는 자리 ———
//
// 도감은 모으는 것이고, 모은 것을 볼 자리가 없으면 표시는 그냥 사라진다. 상태 사다리를
// 다섯 칸으로 만들어놓고 그 칸들이 어디에도 모이지 않는 것이 지금까지의 결함이었다.
//
// 데이터는 독자의 브라우저에만 있다. 이 쪽은 빈 껍데기로 배포되고 책 이름은
// /works.json 에서 온다 — 서재를 여는 사람만 그 사전을 받는다.
function shelfPage(): string {
  const body = `
<h1>서재</h1>
<p class="life" id="shelf-sum">표시한 책이 여기 모인다. 이 기록은 이 브라우저 안에 있다.</p>
<div id="shelf"></div>
<div class="doors">
  <a href="/">책을 펴기</a>
  <a href="/authors/">색인</a>
</div>
<script type="module">
import { readerState, authorOf, yearKo } from "/atlas.js";
const KO = { read: "읽은 책", have: "구매한 책", opened: "펼쳐본 책", want: "관심 있는 책" };
const ORDER = ["read", "have", "opened", "want"];
const el = document.getElementById("shelf");
const sum = document.getElementById("shelf-sum");
const marks = Object.entries(readerState().state || {});
if (!marks.length) {
  el.innerHTML = '<p class="absent">아직 아무것도 표시하지 않았다. 책을 펴고 한 권을 ' +
    '「관심 있는 책」으로 옮기면 여기 선다.</p>';
} else {
  const dict = await fetch("/works.json").then((r) => r.json()).catch(() => ({}));
  const bucket = Object.fromEntries(ORDER.map((k) => [k, []]));
  for (const [id, m] of marks) if (bucket[m.s]) bucket[m.s].push([id, m.at]);
  const authors = new Set(marks.map(([id]) => authorOf(id)));
  sum.textContent =
    marks.length + "권 / " + Object.keys(dict).length + " · 작가 " + authors.size +
    "인. 이 기록은 이 브라우저 안에 있다.";
  el.innerHTML = ORDER.filter((k) => bucket[k].length)
    .map((k) => {
      const rows = bucket[k]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => {
          const w = dict[id];
          const t = w ? w[0] : id;
          const meta = w ? '<span class="y">' + w[2] + " · " + yearKo(w[1]) + "</span>" : "";
          return '<li><span class="t"><a href="/works/' + id + '/">' + t + "</a></span>" + meta + "</li>";
        })
        .join("");
      return "<h2>" + KO[k] + " " + bucket[k].length + '</h2><ul class="works">' + rows + "</ul>";
    })
    .join("");
}
</script>`;
  return page({
    title: "서재 — 하나의 책",
    desc: "표시한 책이 모이는 자리. 기록은 읽는 사람의 브라우저 안에 있다.",
    path: "/shelf/",
    body
  });
}

// ——— 첫 장 — 걸음마다 작가 하나, 인연을 골라 다음으로 ———
//
// 캡슐(1,465명의 이름·책·인연)은 HTML 에 박혀 있었다. 압축 후 214KB 였고, 그 전부를
// 매 방문마다 다시 받았다 — 한 사람을 보러 온 사람이. 이제 별도 파일로 나가고 이름에
// 내용 해시가 붙는다: 데이터가 그대로면 브라우저가 다시 받지 않는다. 주에 한 번 오는
// 제품에서 이 차이가 재방문 전체를 만든다.
let walkDataPath = "";
function walkPage(): string {
  const capsule = Object.fromEntries(
    d.authors.map((a) => {
      const works = worksOf(a.id);
      // 도판은 큐레이터가 정한 입문 순서로, 실루엣은 연도순으로. 실루엣에는
      // readingOrder 가 없고(있으면 안 되고), 그것만 읽으면 책 3권을 가진 작가가
      // 첫 장에서 빈손으로 열린다 — 열어도 담을 것이 없는 쪽이 된다.
      const byOrder = a.readingOrder
        .map((id) => works.find((w) => w.id === id))
        .filter((w): w is Work => Boolean(w));
      const ordered = (byOrder.length ? byOrder : [...works].sort((x, y) => x.year - y.year)).slice(0, 3);
      const hops = relsOf(a.id)
        .sort((x, y) => (y.weight ?? 0.7) - (x.weight ?? 0.7))
        .slice(0, 3)
        .map((r) => ({
          to: r.sourceId === a.id ? r.targetId : r.sourceId,
          g: GLYPH[relationGlyph(r, a.id)] ?? "·",
          t: REL_KO[r.type] ?? r.type,
          s: r.summary
        }));
      return [
        a.id,
        {
          ko: a.names.ko,
          or: a.names.original,
          life: `${a.birthYear === undefined ? "?" : span(a.birthYear, a.deathYear)} · ${a.languages.map(langKo).join("·")}`,
          why: a.importanceReason ? firstSentence(a.importanceReason) : "",
          depth: a.depth ?? "plate",
          entry: a.readingEntryReason,
          works: ordered.map((w) => ({ id: w.id, t: w.titleKo, y: w.year, s: w.significance ? firstSentence(w.significance) : "" })),
          hops
        }
      ];
    })
  );
  const STARTS = ["franz-kafka", "jorge-luis-borges", "virginia-woolf"].filter((id) => byId.has(id));
  walkDataPath = `/walk-${createHash("sha256").update(JSON.stringify(capsule)).digest("hex").slice(0, 10)}.json`;
  writeFileSync(join(OUT, walkDataPath.slice(1)), JSON.stringify(capsule));
  const body = `
<h1>하나의 책</h1>
<p class="life">모든 책을 품은 하나의 책. 세계는 처음부터 전부 여기 있고, 아직 만나지
않은 이름은 실루엣으로 서 있다. 읽은 것이 다음 것을 연다.</p>
<div id="app"></div>
<script>
var DATA={};
var STARTS=${JSON.stringify(STARTS)};
var trail=[];
function h(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function weekly(){
  // 유한 배달(선행 연구 Ⅴ-3): ISO 주차가 이번 주의 출발 작가를 결정한다 —
  // 매주 다른 길이 기다린다는 것이 "일주일 뒤 돌아온다"의 기제다.
  var ids=Object.keys(DATA).filter(function(k){return DATA[k].hops.length>=2;}).sort();
  var now=new Date();var jan=new Date(now.getFullYear(),0,1);
  var week=Math.floor(((now-jan)/86400000+jan.getDay())/7);
  return ids[(now.getFullYear()*53+week)%ids.length];
}
function render(id){
  var app=document.getElementById('app');
  if(!id){ openBook(app); return; }
  var a=DATA[id];if(!a){openBook(app);return;}
  var html='';
  if(trail.length>1){html+='<p class="life">'+trail.map(function(t){return h(DATA[t].ko);}).join(' \u2192 ')+'</p>';}
  html+='<h2 style="letter-spacing:.05em;font-size:22px;color:var(--text)">'+h(a.ko)+'</h2>';
  html+='<p class="orig">'+h(a.or)+' · '+h(a.life)+'</p>';
  if(a.depth==='silhouette'){
    html+='<p class="absent">아직 실루엣이다 — 이름과 자리만 안다. 이 사람의 쪽은 아직 비어 있다.</p>';
  } else if(a.why){ html+='<p class="why">'+h(a.why)+'</p>'; }
  if(a.works.length){
    html+='<h2>여기서 읽기 시작한다면</h2><ul class="works">'+a.works.map(function(w,i){
      return '<li><span class="t"><a href="/works/'+w.id+'/">'+h(w.t)+'</a></span><span class="y">'+w.y+'</span>'+
      lpControl(w.id)+
      (i===0&&a.entry?'<p class="entrywhy">'+h(a.entry)+'</p>':'')+
      '<p class="sig">'+h(w.s)+'</p></li>';}).join('')+'</ul>';
  }
  if(a.hops.length){
    html+='<h2>다음 걸음 — 인연을 골라라</h2><ul class="rels">'+a.hops.map(function(x){
      var o=DATA[x.to];if(!o)return '';
      return '<li><span class="g">'+x.g+'</span><a href="#'+x.to+'" data-go="'+x.to+'">'+h(o.ko)+'</a>'+
      '<span class="rt">'+h(x.t)+'</span><p class="sum">'+h(x.s)+'</p></li>';}).join('')+'</ul>';
  }
  html+='<div class="doors"><a href="/authors/'+id+'/">이 작가의 방(전체 기록)</a>'+
    '<a href="#" data-reopen="1">책을 다시 펴기</a></div>';
  app.innerHTML=html;
  lpPaint();
  window.scrollTo(0,0);
}

// ── 책이 열리는 쪽 ──────────────────────────────────────────────────────────
// 묻지 않는다. 책이 이미 어느 쪽에서 열려 있고, 그 쪽은 당신이 읽은 것에서 한 걸음
// 너머다. 표시가 아직 없으면 이번 주의 쪽이 열린다 — 매주 다른 쪽.
function openBook(app){
  app.innerHTML='<p class="sig">책을 펴는 중…</p>';
  import('/atlas.js').then(function(A){
    return A.graph().then(function(g){
      var lit=A.litAuthors(A.readerState());
      var open=A.openAt(g,lit);
      var c=A.census(g,lit);
      var html='';
      if(open){
        var a=DATA[open.id];
        var node=g.byId.get(open.id);
        var ko=a?a.ko:(node?node.k:open.id);
        var reason=open.first
          ? '이번 주에 열린 쪽'
          : (A.KIND_KO[open.kind]?A.KIND_KO[open.kind]((DATA[open.from]&&DATA[open.from].ko)||(g.byId.get(open.from)||{}).k||open.from):'');
        html+='<p class="sig">'+h(reason)+'</p>';
        html+='<h2 style="letter-spacing:.05em;font-size:22px;color:var(--text)">'+h(ko)+'</h2>';
        if(open.why){html+='<p class="why">'+h(open.why)+'</p>';}
        else if(a&&a.why){html+='<p class="why">'+h(a.why)+'</p>';}
        A.markSeen(open.id);
        if(a){
          if(a.works.length){
            html+='<ul class="works">'+a.works.map(function(w){
              return '<li><span class="t"><a href="/works/'+w.id+'/">'+h(w.t)+'</a></span><span class="y">'+w.y+'</span>'+lpControl(w.id)+
              '<p class="sig">'+h(w.s)+'</p></li>';}).join('')+'</ul>';
          }
          html+='<div class="doors"><a href="#'+open.id+'" data-go="'+open.id+'">이 쪽을 펴기</a>'+
            '<a href="#" data-reopen="1">다른 쪽</a></div>';
        } else {
          html+='<p class="absent">아직 실루엣이다 — 이름과 자리만 안다.</p>'+
            '<div class="doors"><a href="#" data-reopen="1">다른 쪽</a></div>';
        }
      }
      // 도감 계수 — 목표도 퍼센트도 없다. 세계가 얼마나 열렸는가만.
      // 도감 계수 + 문해의 지도. 지도는 접어 둔다 — 펼치는 것은 독자의 선택이고,
      // 접힌 것은 페이지 예산에 세지 않는다.
      html+='<p class="census">만난 작가 <strong>'+c.met+'</strong> / '+c.total+
        (c.openNow?' · 지금 열린 쪽 <strong>'+c.openNow+'</strong>':'')+'</p>';
      var L=A.literacy(g,lit);
      var bar=function(row){
        var pct=row.total?Math.round(row.met/row.total*100):0;
        return '<li><span class="t">'+h(row.ko)+'</span>'+
          '<span class="meter"><i style="width:'+pct+'%"></i></span>'+
          '<span class="y">'+row.met+'/'+row.total+'</span></li>';
      };
      html+='<details class="literacy"><summary>문해의 지도 — 어느 영역이 열려 있는가</summary>'+
        '<p class="sig">배지가 아니다. 어디를 지도 없이 읽을 수 있는지를 말한다.</p>'+
        '<h3>권역</h3><ul class="meters">'+L.regions.map(bar).join('')+'</ul>'+
        '<h3>시대</h3><ul class="meters">'+L.periods.map(bar).join('')+'</ul></details>';
      html+='<h2>아는 이름에서 펴기</h2>'+
        '<input id="anchor" list="authors" placeholder="좋아한 작가 이름" style="font:inherit;font-size:14px;background:none;border:1px solid var(--line);color:var(--text);padding:7px 11px;width:min(320px,100%)">'+
        '<datalist id="authors">'+Object.keys(DATA).map(function(k){return '<option value="'+h(DATA[k].ko)+'">';}).join('')+'</datalist>';
      app.innerHTML=html;
      lpPaint();
      var inp=document.getElementById('anchor');
      var jump=function(){
        var v=(inp.value||'').trim();if(!v)return;
        for(var k in DATA){if(DATA[k].ko===v||DATA[k].ko.indexOf(v)>=0||DATA[k].or.toLowerCase().indexOf(v.toLowerCase())>=0){go(k);return;}}
      };
      inp.addEventListener('change',jump);
      inp.addEventListener('keydown',function(e){if(e.key==='Enter')jump();});
    });
  }).catch(function(e){
    // 엔진이 없어도 책은 열린다 — 도판 하나를 결정론적으로.
    var ids=Object.keys(DATA).filter(function(k){return DATA[k].works.length;}).sort();
    var pick=ids[(new Date().getFullYear()*53+Math.floor(Date.now()/604800000))%ids.length];
    trail=[pick];render(pick);
  });
}
// 클릭 위임 — 인라인 핸들러는 TS 템플릿 안의 JS 문자열 안의 따옴표라 세 겹이 되고,
// 실제로 한 번 깨져 첫 장이 통째로 죽었다(2026-08-31). 마크업은 마크업으로 남긴다.
document.addEventListener('click',function(e){
  var g=e.target.closest&&e.target.closest('[data-go]');
  if(g){e.preventDefault();go(g.getAttribute('data-go'));return;}
  var r=e.target.closest&&e.target.closest('[data-reopen]');
  if(r){e.preventDefault();trail=[];render(null);}
});

function go(id){trail.push(id);history.replaceState(null,'','#'+id);render(id);}
function lpControl(id){
  var o='';for(var i=0;i<LP_STATES.length;i++)o+='<option value="'+LP_STATES[i][0]+'">'+LP_STATES[i][1]+'</option>';
  return '<select class="state" data-work="'+id+'" data-state="" aria-label="상태">'+o+'</select>';
}
function finish(){
  var app=document.getElementById('app');var p=lpLoad();var by={};var any=[];
  for(var k in p.state){var s=p.state[k].s;(by[s]=by[s]||[]).push(k);any.push(k);}
  var lines='';
  for(var i=1;i<LP_STATES.length;i++){var code=LP_STATES[i][0];var list=by[code]||[];
    if(!list.length)continue;
    lines+='<h2>'+LP_STATES[i][1]+' '+list.length+'</h2><p class="sig">'+
      list.map(function(k){return '<a href="/works/'+k+'/">'+k+'</a>';}).join(' · ')+'</p>';}
  app.innerHTML='<h2>오늘 여기까지</h2>'+
    (any.length?lines:'<p class="why">아직 표시한 책이 없다 — 괜찮다, 책은 닫히지 않는다.</p>')+
    '<div class="doors"><a href="#" data-reopen="1">다시 펴기</a><a href="/authors/">작가 색인</a></div>';
}
// 캡슐을 받고서 시작한다. 받지 못하면 첫 장은 빈 화면이 아니라 문장 하나를 남긴다.
fetch('${walkDataPath}').then(function(r){return r.json();}).then(function(j){
  DATA=j;
  var start=location.hash.replace('#','');
  if(start&&DATA[start]){trail=[start];render(start);}else{render(null);}
}).catch(function(){
  document.getElementById('app').innerHTML=
    '<p class="absent">책을 펴지 못했다 — 잠시 뒤 다시 시도해 주세요. ' +
    '<a href="/authors/">색인</a>은 지금도 열려 있다.</p>';
});
</script>`;
  return page({
    title: "하나의 책 — 세계문학의 지도",
    desc: `모든 책을 품은 하나의 책 — 호메로스에서 지금까지 작가 ${d.authors.length}인. 읽은 것이 다음 것을 연다. 도판 ${d.authors.filter((a) => (a.depth ?? "plate") === "plate").length}인은 전부 검토된 큐레이션이고, 작품 ${d.works.length}편이 그 안에 있다.`,
    path: "/",
    body
  });
}

// ——— 기입 ———
let authorPages = 0;
let workPages = 0;
for (const a of d.authors) {
  const dir = join(OUT, "authors", a.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), authorPage(a));
  authorPages++;
}
for (const w of d.works) {
  const dir = join(OUT, "works", w.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), workPage(w));
  workPages++;
}
mkdirSync(join(OUT, "authors"), { recursive: true });
writeFileSync(join(OUT, "authors", "index.html"), indexPage());
// 정문: 루트가 첫 장이다. /walk/ 는 옛 딥링크를 살려 두는 별칭.
// ── 그래프 캡슐 (결정 (137)) ────────────────────────────────────────────────
// 준비도 엔진이 브라우저에서 도는 데 필요한 전부. 산문 0자 — 이름·연도·권역·시대·
// 깊이와 엣지의 방향·유형·근거만. 1,300 노드가 60KB 안쪽이고 gzip 뒤엔 그 절반이다.
//
// 왜 클라이언트인가: 서버가 계산하면 "누가 무엇을 읽었는지"를 서버가 알아야 한다.
// 그래프는 공개 데이터이고 독자의 표시는 독자 것이므로, 그 둘이 만나는 자리는
// 독자의 브라우저다.
const authorIndex = new Map(d.authors.map((a, i) => [a.id, i]));
const capsule = {
  generatedAt: new Date().toISOString().slice(0, 10),
  authors: d.authors.map((a) => ({
    i: a.id,
    k: a.names.ko,
    o: a.names.original,
    b: a.birthYear ?? null,
    e: a.deathYear ?? null,
    y: a.anchorYear,
    r: a.regions[0] ?? "",
    l: a.languages[0] ?? "",
    p: a.periods,
    d: a.depth ?? "plate",
    t: a.tier,
    w: worksOf(a.id).length
  })),
  // 방향은 데이터 그대로: source → target = source 가 target 에게 영향을 주었다.
  edges: d.relations.map((r) => ({
    s: r.sourceId,
    t: r.targetId,
    y: r.type,
    d: r.direction === "directed" ? 1 : 0,
    v: r.evidenceLevel === "documented" ? 3 : r.evidenceLevel === "scholarly_consensus" ? 2 : 1,
    m: (r.summary ?? "").slice(0, 120)
  })),
  // 격자 — 정적 쪽의 "같은 자리, 같은 때"와 **같은 계산 결과**를 싣는다. 규칙을
  // 두 번 구현하면 두 표면이 조용히 갈라진다. 인덱스로 저장한다(id 문자열의 1/8).
  near: d.authors.map((a) => contemporaries(a).map((b) => authorIndex.get(b.id) ?? -1).filter((n) => n >= 0))
};
writeFileSync(join(OUT, "graph.json"), JSON.stringify(capsule));

// 서재의 책 사전 — 서재를 여는 사람만 받는다. [제목, 연도, 작가]
mkdirSync(join(OUT, "shelf"), { recursive: true });
writeFileSync(join(OUT, "shelf", "index.html"), shelfPage());
writeFileSync(
  join(OUT, "works.json"),
  JSON.stringify(
    Object.fromEntries(d.works.map((w) => [w.id, [w.titleKo, w.year, byId.get(w.authorId)?.names.ko ?? ""]]))
  )
);

// 번들러가 하던 일 — public/ 을 dist/ 로 옮긴다 (초상·육필·표지 원본)
const PUBLIC_DIR = join(PKG_ROOT, "public");
if (existsSync(PUBLIC_DIR)) cpSync(PUBLIC_DIR, OUT, { recursive: true });

mkdirSync(join(OUT, "walk"), { recursive: true });
writeFileSync(join(OUT, "walk", "index.html"), walkPage());
writeFileSync(join(OUT, "index.html"), walkPage());

// sitemap 은 "이것을 색인해 달라"는 제출이다. 검토된 것만 제출한다 — 나머지 쪽에는
// noindex 가 붙어 있으므로 두 신호가 같은 말을 한다.
const urls = [
  `${BASE}/`,
  `${BASE}/authors/`,
  `${BASE}/shelf/`,
  ...d.authors.filter((a) => (a.depth ?? "plate") === "plate").map((a) => `${BASE}/authors/${a.id}/`),
  ...d.works.filter((w) => w.significance !== undefined).map((w) => `${BASE}/works/${w.id}/`)
];
writeFileSync(
  join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`
);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

// 심층 커버리지 — 트립와이어 3(콘텐츠 상한)의 계기
const coverage = {
  generatedAt: new Date().toISOString(),
  authors: d.authors.length,
  authorDepthPages: authorPages,
  workPages,
  worksWithOpening: d.works.filter((w) => w.world).length,
  landable: READY_IDS.size,
  depthCoveragePct: Math.round((authorPages / d.authors.length) * 100),
  // 판본 커버리지 — 0 도 사실이고, checkedAt 이 그 사실에 날짜를 붙인다
  editionsCheckedAt: d.editions.checkedAt,
  worksWithEdition: Object.keys(d.editions.editions).length,
  editionRecords: Object.values(d.editions.editions).reduce((n, l) => n + l.length, 0),
  // 깊이 분포 — 도감이 얼마나 채워졌는가. 실루엣은 미완이 아니라 **지도**다.
  depths: d.authors.reduce<Record<string, number>>((m, a) => {
    const k = a.depth ?? "plate";
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {})
};
writeFileSync(join(OUT, "coverage.json"), JSON.stringify(coverage, null, 2) + "\n");
console.log(
  `정적 표면 — 작가 방 ${authorPages}/${d.authors.length} (${coverage.depthCoveragePct}%) · 작품 ${workPages} · ` +
    `도판 ${coverage.depths.plate ?? 0} · 실루엣 ${coverage.depths.silhouette ?? 0} · ` +
    `여는 문장 ${coverage.worksWithOpening} · 실물 ${coverage.landable} · ` +
    `판본 ${coverage.worksWithEdition}/${workPages}작품 ${coverage.editionRecords}건 (${coverage.editionsCheckedAt} 확인) · sitemap ${urls.length} urls`
);
