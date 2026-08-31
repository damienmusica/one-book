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

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import type { Author, Edition, Relation, Work } from "../src/types.ts";
import { EVIDENCE_KO, REL_KO, relationGlyph } from "../src/book/relations.ts";
import { READY_IDS, showsPhysicalRecord } from "../src/book/readiness.ts";

const BASE = "https://literary-planet.pages.dev";
const outArg = process.argv.indexOf("--out");
const OUT = join(PKG_ROOT, outArg >= 0 ? (process.argv[outArg + 1] ?? "dist") : "dist");

const { dataset, errors } = assembleDataset(loadRawCollections());
if (!dataset) throw new Error(`dataset failed: ${errors.join("; ")}`);
const d = dataset;
const byId = new Map(d.authors.map((a) => [a.id, a]));
const worksOf = (id: string): Work[] => d.works.filter((w) => w.authorId === id);
const relsOf = (id: string): Relation[] =>
  d.relations.filter((r) => r.sourceId === id || r.targetId === id);
const movementKo = (id: string): string => d.movements.find((m) => m.id === id)?.ko ?? id;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GLYPH: Record<string, string> = { out: "→", in: "←", both: "↔" };

// 담기 저장소 + 성과 계측(첫 로드·첫 담기 타임스탬프 — 낯선-눈
// 테스트의 보조 계기다. 전송 없음: 값은 이 브라우저에만 남는다).
const RUNTIME_JS = `
(function(){try{var m=JSON.parse(localStorage.getItem('lp.metrics')||'{}');
if(!m.firstLoad){m.firstLoad=Date.now();localStorage.setItem('lp.metrics',JSON.stringify(m));}}catch(e){}})();
function lpWant(id,btn){try{var k='lp.universe.personal.v2';
var p=JSON.parse(localStorage.getItem(k)||'{"v":2,"read":{},"want":{}}');
if(p.want[id]){delete p.want[id];btn.classList.remove('on');btn.textContent='읽고 싶음';}
else{p.want[id]=Date.now();btn.classList.add('on');btn.textContent='담아 둠 ✓';
var m=JSON.parse(localStorage.getItem('lp.metrics')||'{}');
if(!m.firstWant){m.firstWant=Date.now();localStorage.setItem('lp.metrics',JSON.stringify(m));}}
localStorage.setItem(k,JSON.stringify(p));}catch(e){}}
(function(){try{var p=JSON.parse(localStorage.getItem('lp.universe.personal.v2')||'null');
if(!p)return;document.querySelectorAll('[data-want]').forEach(function(b){
if(p.want&&p.want[b.getAttribute('data-want')]){b.classList.add('on');b.textContent='담아 둠 ✓';}});}catch(e){}})();
`.trim();

const CSS = `
:root{--bg:#14100a;--paper:#f0e7cd;--ink:#2b2015;--text:#ecdfc3;--dim:#b5aa90;--faint:#8f8674;
--brass:#cfa759;--brass-b:#e9c76f;--line:rgba(207,167,89,.22);--veil:rgba(20,16,10,.6)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Noto Serif KR',serif;line-height:1.7;
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
button.want{font:inherit;font-size:11px;letter-spacing:.05em;color:var(--dim);background:none;
border:1px solid var(--line);border-radius:2px;padding:2px 8px;margin-left:8px;cursor:pointer;white-space:nowrap;vertical-align:1px}
button.want.on{background:rgba(207,167,89,.16);color:var(--text);border-color:var(--brass)}
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
details{margin:6px 0 2px}
details>summary{cursor:pointer;font-size:12.5px;letter-spacing:.12em;color:var(--faint);padding:4px 0}
details>summary:hover{color:var(--brass-b)}
ul.eds{list-style:none}
.eds li{padding:8px 0;border-bottom:1px dashed var(--line);font-size:14px}
.eds .pub{color:var(--text)}.eds .meta{color:var(--faint);font-size:12px;margin-left:6px}
.eds .isbn{color:var(--faint);font-size:11.5px;letter-spacing:.04em}
.absent{color:var(--dim);font-size:13.5px;margin:6px 0 10px}
@media(max-width:560px){.idx{columns:1}}
`.trim();

function page(o: {
  title: string;
  desc: string;
  path: string;
  body: string;
  ld?: object;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${BASE}${o.path}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='2.6' fill='%23eccb82'/%3E%3Ccircle cx='7' cy='9' r='1.3' fill='%23cfa759'/%3E%3Ccircle cx='25' cy='11' r='1.1' fill='%23cfa759'/%3E%3Ccircle cx='22' cy='24' r='1.5' fill='%23cfa759'/%3E%3Cpath d='M7 9 L16 16 L25 11 M16 16 L22 24' stroke='%236a5a3a' stroke-width='.8' fill='none'/%3E%3C/svg%3E">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<style>${CSS}</style>
${o.ld ? `<script type="application/ld+json">${JSON.stringify(o.ld)}</script>` : ""}
</head>
<body>
<header class="site">
  <a class="brand" href="/authors/">하나의 책</a>
  <nav><a href="/">첫 장</a><a href="/authors/">색인</a></nav>
</header>
${o.body}
<footer class="site">
  작가 ${d.authors.length}인 · 작품 ${d.works.length}편 · 관계 ${d.relations.length}건 · 출처 ${d.sources.length}건 —
  전부 검토된 큐레이션이다. 지어내지 않는다: 없는 것은 없다고 적는다.
</footer>
<script>${RUNTIME_JS}</script>
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
    (e) => `  <li><span class="pub">${esc(e.publisher)}</span>${e.translator ? `<span class="meta">${esc(e.translator)} 옮김</span>` : ""}<span class="meta">${e.year}</span>${e.title !== w.titleKo ? `<span class="meta">『${esc(e.title)}』 수록</span>` : ""}
    <div><a href="${ALADIN_ISBN(e.isbn13)}" rel="nofollow noopener">서점</a> · <a href="${NL_SEARCH(e.isbn13)}" rel="nofollow noopener">도서관</a> <span class="isbn">ISBN ${esc(e.isbn13)}</span></div>
    <p class="sig">${esc(e.verifiedFrom)} · ${esc(e.verifiedAt)} 확인${e.note ? ` — ${esc(e.note)}` : ""}</p></li>`
  )
  .join("\n")}
</ul>`;
  }
  return `<h2>구하기</h2>
<p class="absent">한국어 판본을 아직 검수하지 않았다 (${esc(d.editions.checkedAt)} 확인). 아래는 검색으로 나가는 문이고, 우리가 확인한 판본이 아니다.</p>
<div class="doors">
  <a href="${ALADIN_SEARCH(term)}" rel="nofollow noopener">알라딘에서 찾기</a>
  <a href="${KYOBO_SEARCH(term)}" rel="nofollow noopener">교보문고에서 찾기</a>
  <a href="${NL_SEARCH(term)}" rel="nofollow noopener">국립중앙도서관에서 찾기</a>
</div>`;
}

function wantBtn(workId: string): string {
  return `<button class="want" data-want="${esc(workId)}" onclick="lpWant('${esc(workId)}',this)">읽고 싶음</button>`;
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
function workRow(w: Work, entryWhy?: string): string {
  return `<li>
    <span class="t"><a href="/works/${esc(w.id)}/">${esc(w.titleKo)}</a></span><span class="y">${w.year}</span>${w.world ? `<span class="tag">여는 문장</span>` : ""}${wantBtn(w.id)}
    ${entryWhy ? `<p class="entrywhy">${esc(firstSentence(entryWhy))}</p>` : ""}
    <p class="sig">${esc(firstSentence(w.significance))}</p>
  </li>`;
}

function authorPage(a: Author): string {
  const works = worksOf(a.id);
  const ordered = a.readingOrder
    .map((id) => works.find((w) => w.id === id))
    .filter((w): w is Work => Boolean(w));
  const rest = works.filter((w) => !a.readingOrder.includes(w.id)).sort((x, y) => x.year - y.year);
  const rels = relsOf(a.id).sort((x, y) => (y.weight ?? 0.7) - (x.weight ?? 0.7));
  const life = `${a.birthYear ?? "?"}–${a.deathYear ?? ""} · ${a.languages.join("·")} · ${a.regions.join("·")}${a.movements.length ? ` · ${a.movements.map(movementKo).join("·")}` : ""} · 난도 ${a.difficulty}/5`;
  const body = `
<article>
<h1>${esc(a.names.ko)}</h1>
<p class="orig">${esc(a.names.original)}</p>
<p class="life">${esc(life)}</p>
<p class="why">${esc(a.importanceReason)}</p>
<div class="doors">
  <a href="/#${esc(a.id)}">여기서 읽기 시작</a>
</div>
<h2>입문 순서 ${ordered.length}</h2>
<ol class="works">${ordered.map((w, i) => workRow(w, i === 0 ? a.readingEntryReason : undefined)).join("\n")}</ol>
${rest.length ? `<details><summary>그 밖의 작품 ${rest.length}</summary><ul class="works">${rest.map((w) => workRow(w)).join("\n")}</ul></details>` : ""}
${a.readingWarning ? `<p class="warn">주의 — ${esc(a.readingWarning)}</p>` : ""}
<p class="warn">난도 ${a.difficulty}/5 — ${esc(a.difficultyReason)}</p>
<h2>이어지는 한 사람</h2>
<ul class="rels">${relRow(rels[0], a.id)}</ul>
${
  rels.length > 1
    ? `<details><summary>나머지 관계 ${rels.length - 1} — 선이 그어진 이유</summary>
<ul class="rels">${rels.slice(1).map((r) => relRow(r, a.id)).join("\n")}</ul></details>`
    : ""
}
<p class="life">출처 ${a.sourceIds.length}건 · ${esc(a.reviewStatus)}${a.reviewedAt ? ` · ${esc(a.reviewedAt)}` : ""}</p>
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
<p class="life">${a ? `<a href="/authors/${esc(a.id)}/">${esc(a.names.ko)}</a> · ` : ""}${w.year} · ${esc(w.genre ?? "")} ${wantBtn(w.id)}</p>
<p class="why">${esc(w.significance)}</p>
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
<p class="life">출처 ${w.sourceIds.length}건</p>
</article>`;
  return page({
    title: `${w.titleKo}${a ? ` — ${a.names.ko}` : ""} · 하나의 책`,
    desc: firstSentence(w.significance),
    path: `/works/${w.id}/`,
    body,
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
  const body = `
<h1>작가 ${d.authors.length}인</h1>
<p class="life">20세기 세계문학 — 발자국이 검토된 이들만. 각 방은 입문 순서·관계·난도를 싣는다.</p>
<div class="doors">
  <a href="/">여기서 시작</a>
</div>
<ul class="idx">
${sorted.map((a) => `<li><a href="/authors/${esc(a.id)}/">${esc(a.names.ko)}</a><span class="y">${a.birthYear ?? "?"}–${a.deathYear ?? ""}</span></li>`).join("\n")}
</ul>`;
  return page({
    title: "작가 색인 — 하나의 책",
    desc: `20세기 세계문학 작가 ${d.authors.length}인의 큐레이션 색인 — 입문 순서, 관계의 이유, 난도.`,
    path: "/authors/",
    body
  });
}

// ——— 첫 장 — 걸음마다 작가 하나, 인연을 골라 다음으로 ———
function walkPage(): string {
  const capsule = Object.fromEntries(
    d.authors.map((a) => {
      const works = worksOf(a.id);
      const ordered = a.readingOrder
        .map((id) => works.find((w) => w.id === id))
        .filter((w): w is Work => Boolean(w))
        .slice(0, 3);
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
          life: `${a.birthYear ?? "?"}–${a.deathYear ?? ""} · ${a.languages.join("·")}`,
          why: firstSentence(a.importanceReason),
          entry: a.readingEntryReason,
          works: ordered.map((w) => ({ id: w.id, t: w.titleKo, y: w.year, s: firstSentence(w.significance) })),
          hops
        }
      ];
    })
  );
  const STARTS = ["franz-kafka", "jorge-luis-borges", "virginia-woolf"].filter((id) => byId.has(id));
  const body = `
<h1>하나의 책</h1>
<p class="life">모든 책을 품은 하나의 책. 조종은 없다 — 걸음마다 작가 하나가 서고,
인연을 골라 다음으로 건넌다. 읽고 싶은 책이 생기면 담아라. 그게 전부다.</p>
<div id="app"></div>
<script>
var DATA=${JSON.stringify(capsule)};
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
  if(!id){
    var wk=weekly();
    app.innerHTML='<h2>어디서 시작할까</h2>'+
      '<div class="doors"><a href="#'+wk+'" onclick="go(\\''+wk+'\\');return false">이번 주의 길 — '+h(DATA[wk].ko)+'</a>'+
      STARTS.map(function(s){
      return '<a href="#'+s+'" onclick="go(\\''+s+'\\');return false">'+h(DATA[s].ko)+'</a>';}).join('')+'</div>'+
      '<h2 style="margin-top:22px">아는 작가에서 시작</h2>'+
      '<input id="anchor" list="authors" placeholder="좋아한 작가 이름" style="font:inherit;font-size:14px;background:none;border:1px solid var(--line);color:var(--text);padding:7px 11px;width:min(320px,100%)">'+
      '<datalist id="authors">'+Object.keys(DATA).map(function(k){return '<option value="'+h(DATA[k].ko)+'">';}).join('')+'</datalist>';
    var inp=document.getElementById('anchor');
    var jump=function(){
      var v=(inp.value||'').trim();if(!v)return;
      for(var k in DATA){if(DATA[k].ko===v||DATA[k].ko.indexOf(v)>=0||DATA[k].or.toLowerCase().indexOf(v.toLowerCase())>=0){go(k);return;}}
    };
    inp.addEventListener('change',jump);
    inp.addEventListener('keydown',function(e){if(e.key==='Enter')jump();});
    return;
  }
  var a=DATA[id];if(!a){render(null);return;}
  var html='';
  if(trail.length>1){html+='<p class="life">'+trail.map(function(t){return h(DATA[t].ko);}).join(' → ')+'</p>';}
  html+='<h2 style="letter-spacing:.05em;font-size:22px;color:var(--text)">'+h(a.ko)+'</h2>';
  html+='<p class="orig">'+h(a.or)+' · '+h(a.life)+'</p>';
  html+='<p class="why">'+h(a.why)+'</p>';
  html+='<h2>여기서 읽기 시작한다면</h2><ul class="works">'+a.works.map(function(w,i){
    return '<li><span class="t"><a href="/works/'+w.id+'/">'+h(w.t)+'</a></span><span class="y">'+w.y+'</span>'+
    '<button class="want" data-want="'+w.id+'" onclick="lpWant(\\''+w.id+'\\',this)">읽고 싶음</button>'+
    (i===0&&a.entry?'<p class="entrywhy">'+h(a.entry)+'</p>':'')+
    '<p class="sig">'+h(w.s)+'</p></li>';}).join('')+'</ul>';
  html+='<h2>다음 걸음 — 인연을 골라라</h2><ul class="rels">'+a.hops.map(function(x){
    var o=DATA[x.to];if(!o)return '';
    return '<li><span class="g">'+x.g+'</span><a href="#'+x.to+'" onclick="go(\\''+x.to+'\\');return false">'+h(o.ko)+'</a>'+
    '<span class="rt">'+h(x.t)+'</span><p class="sum">'+h(x.s)+'</p></li>';}).join('')+'</ul>';
  html+='<div class="doors"><a href="/authors/'+id+'/">이 작가의 방(전체 기록)</a>'+
    '<a href="#" onclick="finish();return false">오늘 여기까지</a></div>';
  app.innerHTML=html;
  try{var p=JSON.parse(localStorage.getItem('lp.universe.personal.v2')||'null');
  if(p&&p.want)document.querySelectorAll('[data-want]').forEach(function(b){
  if(p.want[b.getAttribute('data-want')]){b.classList.add('on');b.textContent='담아 둠 ✓';}});}catch(e){}
  window.scrollTo(0,0);
}
function go(id){trail.push(id);history.replaceState(null,'','#'+id);render(id);}
function finish(){
  var app=document.getElementById('app');var n=0,items=[];
  try{var p=JSON.parse(localStorage.getItem('lp.universe.personal.v2')||'null');
  if(p&&p.want){for(var k in p.want){n++;items.push(k);}}}catch(e){}
  app.innerHTML='<h2>오늘 담은 것</h2><p class="why">담은 책 '+n+'권. '+
  (n?'담은 것들: '+items.map(function(k){return '<a href="/works/'+k+'/">'+k+'</a>';}).join(' · '):
  '아직 없다 — 괜찮다, 책은 닫히지 않는다.')+'</p>'+
  '<div class="doors"><a href="#" onclick="trail=[];render(null);return false">다시 펴기</a><a href="/authors/">작가 색인</a></div>';
}
var start=location.hash.replace('#','');
if(start&&DATA[start]){trail=[start];render(start);}else{render(null);}
</script>`;
  return page({
    title: "하나의 책 — 20세기 세계문학",
    desc: "모든 책을 품은 하나의 책 — 걸음마다 작가 하나, 인연을 골라 다음으로. 읽고 싶은 책을 담는다. 작가 100인·작품 513편, 전부 검토된 큐레이션.",
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
// 번들러가 하던 일 — public/ 을 dist/ 로 옮긴다 (초상·육필·표지 원본)
const PUBLIC_DIR = join(PKG_ROOT, "public");
if (existsSync(PUBLIC_DIR)) cpSync(PUBLIC_DIR, OUT, { recursive: true });

mkdirSync(join(OUT, "walk"), { recursive: true });
writeFileSync(join(OUT, "walk", "index.html"), walkPage());
writeFileSync(join(OUT, "index.html"), walkPage());

const urls = [
  `${BASE}/`,
  `${BASE}/authors/`,
  ...d.authors.map((a) => `${BASE}/authors/${a.id}/`),
  ...d.works.map((w) => `${BASE}/works/${w.id}/`)
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
  editionRecords: Object.values(d.editions.editions).reduce((n, l) => n + l.length, 0)
};
writeFileSync(join(OUT, "coverage.json"), JSON.stringify(coverage, null, 2) + "\n");
console.log(
  `정적 표면 — 작가 방 ${authorPages}/${d.authors.length} (${coverage.depthCoveragePct}%) · 작품 ${workPages} · ` +
    `여는 문장 ${coverage.worksWithOpening} · 실물 ${coverage.landable} · ` +
    `판본 ${coverage.worksWithEdition}/${workPages}작품 ${coverage.editionRecords}건 (${coverage.editionsCheckedAt} 확인) · sitemap ${urls.length} urls`
);
