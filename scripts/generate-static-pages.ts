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
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { loadRawCollections, PKG_ROOT } from "./lib/load-node.ts";
import { assembleDataset } from "../src/data/assemble.ts";
import { GENRE_DEFS, LANGUAGE_LABELS, PERIOD_DEFS, REGION_DEFS, REGION_NEIGHBORS } from "../src/types.ts";
import type { Author, Edition, Relation, Work } from "../src/types.ts";
import { EVIDENCE_KO, REL_KO, relationGlyph } from "../src/book/relations.ts";
import { READY_IDS, showsPhysicalRecord } from "../src/book/readiness.ts";
import { nameStance, resetSealIds, sealGlyphs, sealSvg, sizeClass, type SealRule } from "./lib/paper-seal.ts";
import { editionTitleNote, jsonForScript } from "./lib/html.ts";
import { buildNameIndex, DOOR_JS } from "./lib/door.ts";

const BASE = "https://literary-planet.pages.dev";
const outArg = process.argv.indexOf("--out");
// resolve — join 은 절대 경로 인자를 이어 붙인다(`<root>/var/folders/…`).
// 그 버그 때문에 --out 이 조용히 엉뚱한 자리에 굽고 있었다.
// ONE_BOOK_OUT — 유닛이 이 모듈을 import 할 때(관계 절 렌더) 저장소의 dist 를 지우고 다시 짓지 않게(2026-09-24 감사).
const OUT = resolve(PKG_ROOT, outArg >= 0 ? (process.argv[outArg + 1] ?? "dist") : (process.env.ONE_BOOK_OUT ?? "dist"));

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
// 실물 자산 — 서명·초판 표지. 전부 출처와 이용 조건이 적힌 것만(public/art/manifest.json). AI 초상은 쓰지 않는다.
type ArtEntry = {
  file: string; w: number; h: number; license?: string;
  // shows: 이 이미지가 실제로 무엇인가(초판 표지·초판 표제지·영역본 표지·수록본) — 「초판 표지」로 일괄해 적지 않는다(2026-09-24 감사:
  // 『나는 고양이로소이다』의 「초판 표지」는 1906년 영역본이었다). creator·licenseUrl: CC BY 가 요구하는 저작자 표시와 라이선스 링크.
  provenance?: { title?: string; collection?: string; licence?: string; creator?: string; licenseUrl?: string; pageUrl?: string; shows?: string; captionKo?: string; altKo?: string; commercialUse?: string };
};
const ART: Record<"marks" | "signatures" | "covers", Record<string, ArtEntry>> = JSON.parse(readFileSync(join(PKG_ROOT, "public", "art", "manifest.json"), "utf8"));
const signatureOf = (authorId: string): ArtEntry | undefined => ART.signatures[authorId] ?? ART.marks[authorId];
// 저작자 표시가 필요한 이미지(CC BY·BY-SA)인가 — 크레딧을 그릴 수 없는 자리(첫 장의 캡슐)에는 싣지 않는다.
const needsCredit = (e: ArtEntry): boolean => /CC[ -]BY/i.test(`${e.provenance?.licence ?? ""} ${e.license ?? ""}`);
// 크레딧 한 줄 — 라이선스(링크), 저작자, 원본 파일(링크). CC BY 는 이 셋을 요구한다.
const creditHtml = (e: ArtEntry): string => {
  const p = e.provenance ?? {};
  const lic = p.licence ?? e.license ?? "PD";
  const licHtml = p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" rel="license noopener">${esc(lic)}</a>` : esc(lic);
  const src = p.pageUrl ? `<a href="${esc(p.pageUrl)}" rel="noopener">원본 파일</a>` : "Wikimedia Commons";
  return `${licHtml}${p.creator && !lic.includes(p.creator) ? ` ${esc(p.creator)}` : ""} · ${src}`;
};
const coverShows = (c: ArtEntry): string => c.provenance?.shows ?? "초판 표지";
// 「출처 N건」은 그 N건이 무엇인지 보여 줘야 한다 — 706쪽이 수만 적고 이름을 한 번도 대지 않았다(2026-09-24 감사).
// 접어 둔다: 읽는 사람이 펼칠 때만 그려진다(글자 예산은 접힌 것을 세지 않는다).
const sourceById = new Map(d.sources.map((x) => [x.id, x]));
function sourcesDetails(ids: string[], cls = "srcs"): string {
  if (!ids.length) return "";
  const li = (id: string): string => {
    const x = sourceById.get(id);
    if (!x) return "";
    const title = x.url ? `<a href="${esc(x.url)}" rel="nofollow noopener">${esc(x.title)}</a>` : esc(x.title);
    return `<li>${title} — ${esc(x.publisherOrInstitution)}${x.citation ? ` · ${esc(x.citation)}` : ""}</li>`;
  };
  return `<details class="${cls}"><summary>출처 ${ids.length}건</summary><ol>${ids.map(li).join("")}</ol></details>`;
}
// 인장 글자 판정 원장 — 마지막 낱말이 성이 아닌 이름들. 헝가리 이름은 성이 앞에 선다.
// 판매 상태 — 서점 상품 페이지에서 확인한 것만(qc/edition-availability.json). 카카오의 판매 상태는 절판본도 정상판매라 한다.
const OUT_OF_PRINT = new Set(Object.entries<{ status?: string }>(JSON.parse(readFileSync(join(PKG_ROOT, "qc", "edition-availability.json"), "utf8")).byIsbn ?? {}).filter(([, v]) => v.status === "out-of-print").map(([k]) => k));
// 판매 확인 — 고정 원장(qc/edition-pins.json)의 판은 사람이 서점 상품 페이지에서 「지금 새 책으로 살 수 있다」를 확인했다.
// 표의 나머지 판은 이 작품의 판이 맞는지(제목·역자·ISBN)만 검수했다 — 두 말을 섞지 않는다(2026-09-24 감사: 머리 판의 4분의 1이 절판).
const SALE_CHECKED = new Map<string, string>(
  Object.values(JSON.parse(readFileSync(join(PKG_ROOT, "qc", "edition-pins.json"), "utf8")).byWork as Record<string, Array<{ isbn13: string; checkedAt?: string }>>)
    .flat()
    .map((p) => [p.isbn13, p.checkedAt ?? ""])
);
// 다권본의 나머지 권 — 표에는 1권 행 하나만 올라와 하권이 어디에도 없었다(86편).
const VOLUMES = new Map<string, Array<{ isbn13: string; volume: string }>>();
for (const list of Object.values(JSON.parse(readFileSync(join(PKG_ROOT, "qc", "edition-volumes.json"), "utf8")).byWork as Record<string, Array<{ isbn13: string; volume: string; set: string }>>))
  for (const v of list) VOLUMES.set(v.set, [...(VOLUMES.get(v.set) ?? []), { isbn13: v.isbn13, volume: v.volume }]);
const BASIS_ATTESTED: Record<string, boolean | undefined> = Object.fromEntries(
  Object.entries<{ attested?: boolean }>(JSON.parse(readFileSync(join(PKG_ROOT, "qc", "edition-basis.json"), "utf8")).byIsbn ?? {}).map(([k, v]) => [k, v.attested])
);
const SEAL_LETTERS: Record<string, { glyph: string; note: string }> = JSON.parse(readFileSync(join(PKG_ROOT, "qc", "seal-letters.json"), "utf8"));
const sealRule = (a: Author): SealRule => ({ glyph: SEAL_LETTERS[a.id]?.glyph, familyFirst: a.languages[0] === "hu" });
const proved = (a: Author): boolean => a.reviewStatus !== "draft";
const seal = (a: Author, o: { tone?: "red" | "ink"; cls?: string; texture?: boolean } = {}): string =>
  sealSvg({ id: a.id, nameKo: a.names.ko, original: a.names.original, proved: proved(a), rule: sealRule(a), ...o });
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
/** 문장 끝에서만 자른다. 첫 문장이 한도를 넘으면 그 문장은 통째로 둔다 — 중간에서 끊긴 이유는 이유가 아니다. */
function firstSentences(text: string, limit: number): string {
  const parts = text.match(/[^.!?。]+[.!?。]+["'”’)」』]*\s*/g) ?? [text];
  let out = "";
  for (const p of parts) { if (out && (out + p).length > limit) break; out += p; }
  return (out || text).trim();
}
const rank = (a: Author): number => ({ plate: 2, sketch: 1, silhouette: 0 })[a.depth ?? "plate"];
const yr = (n: number): string => (n < 0 ? `기원전 ${-n}` : String(n));
const span = (from: number, to: number | undefined): string =>
  to === undefined ? `${yr(from)}–` : from < 0 && to < 0 ? `기원전 ${-from}–${-to}` : `${yr(from)}–${yr(to)}`;


const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 첫 글자를 크게 앉히는 것은 한글 음절 둘로 시작할 때만 — 「1 / 969년」, 「『스 / 무 편의…」처럼 숫자·괄호를 쪼개지 않는다.
const ledeClass = (text: string): string => (/^[가-힣]{2}/.test(text) ? "lede cap" : "lede");

// 몰년이 없는 옛사람을 산 사람처럼 「966–」로 적지 않는다 — 태어난 지 110년이 넘었는데 몰년이 없으면 「–?」다.
const THIS_YEAR = new Date().getFullYear();
const lifeSpan = (a: Author): string =>
  a.birthYear === undefined
    ? `활동 ${span(a.activeRange[0], a.activeRange[1])}`
    : a.deathYear === undefined && a.birthYear < THIS_YEAR - 110
      ? `${yr(a.birthYear)}${a.lifeApprox ? " 무렵" : ""}–?`
      : `${span(a.birthYear, a.deathYear)}${a.lifeApprox ? " 무렵" : ""}`;

// lang 은 글자가 그 말의 문자일 때만 단다. 로마자로 적힌 제목에 ja 를, 키릴로 적힌 이름에 en 을 달면 읽어 주는
// 목소리가 틀린다. 오른쪽에서 읽는 문자에는 dir 도 단다(CSS direction 은 접근성 트리에 닿지 않는다).
const SCRIPT_OF: Record<string, RegExp> = {
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u, zh: /\p{Script=Han}/u, lzh: /\p{Script=Han}/u, ko: /[\p{Script=Hangul}\p{Script=Han}]/u,
  ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, be: /\p{Script=Cyrillic}/u, bg: /\p{Script=Cyrillic}/u, sr: /\p{Script=Cyrillic}/u, kk: /\p{Script=Cyrillic}/u, ky: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u, fa: /\p{Script=Arabic}/u, ur: /\p{Script=Arabic}/u, ps: /\p{Script=Arabic}/u, he: /\p{Script=Hebrew}/u, yi: /\p{Script=Hebrew}/u, syc: /\p{Script=Syriac}/u,
  el: /\p{Script=Greek}/u, grc: /\p{Script=Greek}/u, hi: /\p{Script=Devanagari}/u, mr: /\p{Script=Devanagari}/u, ne: /\p{Script=Devanagari}/u, sa: /\p{Script=Devanagari}/u,
  bn: /\p{Script=Bengali}/u, pa: /\p{Script=Gurmukhi}/u, gu: /\p{Script=Gujarati}/u, ta: /\p{Script=Tamil}/u, te: /\p{Script=Telugu}/u, kn: /\p{Script=Kannada}/u, ml: /\p{Script=Malayalam}/u,
  si: /\p{Script=Sinhala}/u, th: /\p{Script=Thai}/u, lo: /\p{Script=Lao}/u, km: /\p{Script=Khmer}/u, my: /\p{Script=Myanmar}/u, bo: /\p{Script=Tibetan}/u,
  am: /\p{Script=Ethiopic}/u, ti: /\p{Script=Ethiopic}/u, gez: /\p{Script=Ethiopic}/u, hy: /\p{Script=Armenian}/u, ka: /\p{Script=Georgian}/u, mn: /[\p{Script=Cyrillic}\p{Script=Mongolian}]/u
};
const langAttr = (text: string | undefined, lang: string | undefined): string => {
  if (!text || !lang) return "";
  const own = SCRIPT_OF[lang];
  const fits = own ? own.test(text) : /\p{Script=Latin}/u.test(text) && !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(text);
  if (!fits) return "";
  return ` lang="${esc(lang)}"${/[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/u.test(text) ? ' dir="rtl"' : ""}`;
};

const TESTIMONY_TYPES = new Set(["documented_influence", "mentorship", "translation"]);

// 연도 한 칸이 무엇인지 말한다. 전승 문학에서 이걸 적지 않으면 "모른다"가
// "안다"가 된다 — 길가메시·베오울프·향가에 확정 연도는 없다.
// 작가 쪽의 작품 줄은 연도만 찍었다 — 성립 시기 추정(『결박된 프로메테우스』 기원전 430)이 확증된 해처럼 읽혔다.
const YEAR_BASIS_SHORT: Record<string, string> = { attested: "", "composition-range": " 무렵", "earliest-manuscript": " 사본", "first-print": " 초간" };
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
function lpSave(p){try{localStorage.setItem(LP_KEY,JSON.stringify(p));return true;}catch(e){return false;}}
function lpMetric(name){try{var m=JSON.parse(localStorage.getItem('lp.metrics')||'{}');
if(!m[name]){m[name]=Date.now();localStorage.setItem('lp.metrics',JSON.stringify(m));}}catch(e){}}
function lpShelf(){try{return JSON.parse(localStorage.getItem('lp.shelf.v1')||'{}')||{};}catch(e){return {};}}
function lpSet(id,s,el){var p=lpLoad();
  if(s)p.state[id]={s:s,at:Date.now()};else delete p.state[id];
  // 저장소가 막힌 브라우저(사생활 보호 모드·저장 차단)에서는 누른 것이 아무 일도 안 한 것처럼 보였다 — 말한다.
  if(!lpSave(p)){var mk=el&&el.closest?el.closest('.mark'):null;
    if(mk&&!mk.querySelector('.mark-err')){var er=document.createElement('p');er.className='mark-err';er.setAttribute('role','status');
      er.textContent='이 브라우저가 표시를 저장하지 않는다 — 사생활 보호 모드나 사이트 데이터 차단을 끄면 남는다.';mk.appendChild(er);}
    return;}
  // 서재는 표시한 순간 들은 제목으로 첫 화면을 그린다 — 341KB 사전을 받은 뒤가 아니라.
  try{var sh=lpShelf();var m=el&&el.closest?el.closest('.mark'):null;
    if(s&&m&&m.getAttribute('data-t'))sh[id]=[m.getAttribute('data-t'),+m.getAttribute('data-y')||0,m.getAttribute('data-a')||''];
    else if(!s)delete sh[id];
    localStorage.setItem('lp.shelf.v1',JSON.stringify(sh));}catch(e){}
  if(el)el.setAttribute('data-state',s||'');
  lpMetric('firstMark');
  if(s==='want')lpMetric('firstWant');}
var LP_LABEL={want:'관심 있는 책',opened:'펼쳐본 책',have:'구매한 책',read:'읽은 책'};
function lpLadder(m){if(m.querySelector('.mark-ladder'))return;
  var d=document.createElement('div');d.className='mark-ladder';d.setAttribute('role','group');d.setAttribute('aria-label','상태');
  var h='';for(var i=1;i<LP_STATES.length;i++)h+='<button type="button" data-set="'+LP_STATES[i][0]+'">'+LP_STATES[i][1]+'</button>';
  d.innerHTML=h+'<button type="button" class="clear" data-set="">모르는 책</button>';m.appendChild(d);
  if(m.closest('#shelf'))return;
  var done=document.createElement('p');done.className='mark-done';done.innerHTML='<a href="/shelf/">서재</a>에 꽂혔다.';m.appendChild(done);}
function lpPaint(){var p=lpLoad();var any=false;
  var ms=document.querySelectorAll('.mark[data-work]');
  for(var i=0;i<ms.length;i++){var m=ms[i];var id=m.getAttribute('data-work');
    var cur=(p.state[id]&&p.state[id].s)||'';m.setAttribute('data-state',cur);if(cur)any=true;
    if(m.classList.contains('big')||cur)lpLadder(m);
    var main=m.querySelector('.mark-main');
    if(main){main.setAttribute('aria-pressed',cur?'true':'false');var lb=main.querySelector('.mark-label');var lt=LP_LABEL[cur]||'관심 있는 책';if(lb)lb.textContent=lt;
      // 한 쪽에 단추가 다섯이면 다섯이 다 「관심 있는 책」이라고만 말했다 — 어느 책인지 이름에 넣는다.
      var tt=m.getAttribute('data-t');if(tt)main.setAttribute('aria-label','「'+tt+'」 — '+lt);}
    var bs=m.querySelectorAll('.mark-ladder button');for(var j=0;j<bs.length;j++)bs[j].setAttribute('aria-pressed',bs[j].getAttribute('data-set')===cur&&cur?'true':'false');}
  if(document.body&&document.body.hasAttribute('data-work-page'))document.body.classList.toggle('has-mark',any);}
document.addEventListener('click',function(e){
  var op=document.querySelectorAll('.mark.open');for(var i=0;i<op.length;i++)if(!op[i].contains(e.target))op[i].classList.remove('open');
  var b=e.target.closest&&e.target.closest('.mark button');if(!b)return;
  var m=b.closest('.mark');var id=m.getAttribute('data-work');var cur=m.getAttribute('data-state')||'';
  if(b.classList.contains('mark-main')){if(!cur)lpSet(id,'want',m);else{lpLadder(m);m.classList.toggle('open');}}
  else{lpSet(id,b.getAttribute('data-set')||'',m);m.classList.remove('open');}
  lpPaint();});
(function(){lpMetric('firstLoad');
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lpPaint);else lpPaint();})();
`.trim();

// 스타일은 public/book.css 한 장이다(종이와 인장). 쪽마다 같은 30KB 를 박지 않는다 — 첫 요청 뒤로는 캐시가 든다.

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
  bodyAttr?: string;
}): string {
  resetSealIds();
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="only light">
<meta name="theme-color" content="#f0e7cd">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
${o.noindex ? `<meta name="robots" content="noindex,follow">` : ""}
<link rel="canonical" href="${BASE}${o.path}">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/book.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='2' width='28' height='28' rx='4' fill='%23b4271b'/%3E%3Cpath d='M9 10h14M9 16h14M9 22h9' stroke='%23f0e7cd' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${BASE}${o.path}">
<meta property="og:type" content="${o.path.startsWith("/works/") ? "book" : o.path.startsWith("/authors/") && o.path !== "/authors/" ? "profile" : "website"}">
<meta property="og:site_name" content="하나의 책">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${BASE}/icon-512.png">
<script>${RUNTIME_JS}</script>
<script type="module" src="/book.js"></script>
${o.ld ? `<script type="application/ld+json">${jsonForScript(o.ld)}</script>` : ""}
</head>
<body${o.bodyAttr ? ` ${o.bodyAttr}` : ""}>
<div class="wrap">
<header class="site">
  <a class="brand" href="/">하나의 책</a>
  <nav><a href="/"${o.path === "/" ? ' aria-current="page"' : ""}>첫 장</a><a href="/shelf/"${o.path === "/shelf/" ? ' aria-current="page"' : ""}>서재</a><a href="/authors/"${o.path === "/authors/" ? ' aria-current="page"' : ""}>색인</a></nav>
</header>
<div class="rule-head"></div>
${o.body}
<div id="lp-auth" class="auth" hidden></div>
<footer class="colophon">
  <div class="rule-foot"></div>
  <p class="motto">지어내지 않는다 — 없는 것은 없다고 적는다.</p>
${
  // 계수는 책의 앞붙이(첫 장·색인·서재)에 찍는다. 한 사람의 쪽마다 코퍼스 전체의 수를 다시 적으면 그 쪽의
  // 그려진 글자 예산을 그 사람이 아닌 것이 먹는다.
  ["/", "/authors/", "/shelf/"].includes(o.path)
    ? `<p class="counts"><a href="/privacy/">처리방침</a></p><p class="counts">검토 ${d.authors.filter((a) => a.reviewStatus !== "draft").length} · 도판 ${d.authors.filter((a) => (a.depth ?? "plate") === "plate").length} · 스케치 ${d.authors.filter((a) => a.depth === "sketch").length} · 실루엣 ${d.authors.filter((a) => (a.depth ?? "plate") === "silhouette").length} · 작품 ${d.works.length} · 관계 ${d.relations.length} · 출처 ${d.sources.length}</p>`
    : ""
}
</footer>
</div>
</body>
</html>`;
}

const firstSentence = (s: string): string => s.match(/^.*?다\./)?.[0] ?? s;

// ── 구하기 (판본 레이어) ───────────────────────────────────────────────────
// 서점·도서관으로 나가는 문은 **결정론적 링크**다: 크롤링도 API 키도 없이,
// 제목과 작가 이름만으로 주소가 정해진다. 검수된 판본이 있으면 그 ISBN 의
// 상품 페이지로, 없으면 검색으로 — 그리고 없다는 사실을 날짜와 함께 적는다.
// 판본 줄의 출처는 독자의 말로 적는다 — 「카카오 책 검색 API」「SRU」「국중도 MARC」는 우리 도구의 이름이다(2026-09-24 감사: 656쪽).
const readerSource = (from: string): string =>
  /^(카카오 책 검색|kakao book search)/i.test(from) ? "서점 목록과 제목·저자·ISBN 대조"
  : /^Library of Congress/.test(from) ? "미국 의회도서관 목록과 대조"
  : /^Bibliothèque nationale de France/.test(from) ? "프랑스 국립도서관 목록과 대조"
  : /^Deutsche Nationalbibliothek/.test(from) ? "독일 국립도서관 목록과 대조"
  : /^国立国会図書館/.test(from) ? "일본 국립국회도서관 목록과 대조"
  : from;
const readerNote = (note: string): string =>
  note
    .replace(/^추정 — /, "")
    .replace(/\((\d{4}-\d{2}-\d{2}) 입문작 판본 확인, ([^)]*)\)/g, "($1, $2로 확인)")
    .replace(/국중도 MARC|국중도 서지|국중도/g, "국립중앙도서관 서지");
const q = (s: string): string => encodeURIComponent(s);
const ALADIN_ISBN = (isbn: string): string =>
  `https://www.aladin.co.kr/shop/wproduct.aspx?ISBN=${isbn}`;
const ALADIN_SEARCH = (s: string): string =>
  `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${q(s)}`;
const KYOBO_SEARCH = (s: string): string => `https://search.kyobobook.co.kr/search?keyword=${q(s)}`;
const NL_SEARCH = (s: string): string => `https://www.nl.go.kr/NL/contents/search.do?kwd=${q(s)}`;

// 중역 판정에는 두 종류가 있다 — 책이나 출판사·도서관 기록이 스스로 밝힌 것과, 번역자의 이력에서 미룬 것.
// 실명 번역자에 대한 판정이므로 뒤의 것은 "추정"이라고 적는다.
// 추정인 판정은 원장의 note 가 「추정 — 」으로 시작한다(qc/edition-basis.json 의 attested=false).
/** 판본의 제목이 작품 제목과 다르면 그대로 보여 준다 — 분권("모비 딕 1")과 합본("변신·시골의사")을 숨기지 않는다. */
function acquireBlock(w: Work, a: Author | undefined): string {
  const eds: Edition[] = d.editions.editions[w.id] ?? [];
  const term = `${w.titleKo} ${a ? a.names.ko : ""}`.trim();
  if (eds.length) {
    // 한국어가 먼저, 그다음 원어, 그다음 나머지 — 독자의 언어에서 출발한다.
    const langs = [...new Set(eds.map((e) => e.language))].sort((x, y) => (x === "ko" ? -1 : y === "ko" ? 1 : 0));
    // 저본 칸은 비지 않는다 — 빈 칸은 "모른다"와 "원서다"를 같은 모양으로 그린다.
    const flag = (e: Edition): string => {
      if (a && a.languages.includes(e.language)) return "원서";
      // 책·출판사·도서관 기록이 스스로 밝힌 판정(attested)만 단정한다. 역자 이력에서 미룬 판정은 「추정」이다 —
      // 2026-09-23 감사: 「원전 직역」 266건 중 밝혀진 것은 52건이었고 나머지가 확정처럼 나가고 있었다.
      const inferred = BASIS_ATTESTED[e.isbn13] !== true || /^추정/.test(e.note ?? "");
      if (e.sourceTextBasis === "original") return inferred ? "원전 직역 추정" : "원전 직역";
      if (e.sourceTextBasis === "relay") return inferred ? "중역 추정" : "중역";
      if (e.sourceTextBasis) return "번안·재화";
      return "저본 미확인";
    };
    const group = (lang: string): string => {
      const list = eds.filter((e) => e.language === lang);
      const original = a ? a.languages.includes(lang) && lang !== "ko" : false;
      const head = lang === "ko" ? "한국어" : `${LANGUAGE_LABELS[lang] ?? lang}${original ? " 원서" : "판"}`;
      return `<tbody class="grp"><tr class="gh"><th colspan="6">${esc(head)} ${list.length}</th></tr>
${list.map((e) => `<tr class="ed"><td class="pub">${esc(e.publisher)}</td><td class="tr">${e.translator ? `${esc(e.translator)} 옮김` : ""}</td><td class="yr">${e.year}</td><td class="flag">${flag(e)}</td><td class="isbn">ISBN ${esc(e.isbn13)}${(VOLUMES.get(e.isbn13) ?? []).map((v) => `<span class="vol">${esc(v.volume)}권 ${esc(v.isbn13)}</span>`).join("")}${OUT_OF_PRINT.has(e.isbn13) ? ` <span class="oop">절판·품절 — 도서관에서</span>` : SALE_CHECKED.has(e.isbn13) ? ` <span class="ok">판매 확인 ${esc(SALE_CHECKED.get(e.isbn13) ?? "")}</span>` : ""}</td><td class="get"><a href="${ALADIN_ISBN(e.isbn13)}" rel="nofollow noopener">서점</a><a href="${NL_SEARCH(e.isbn13)}" rel="nofollow noopener">도서관</a>${e.language !== "ko" ? `<a href="https://search.worldcat.org/isbn/${esc(e.isbn13)}" rel="nofollow noopener">WorldCat</a>` : ""}</td></tr>
<tr class="why"><td colspan="6">${editionTitleNote(e, w)}${e.note ? esc(readerNote(e.note)) : ""}<span class="src">${esc(readerSource(e.verifiedFrom))} · ${esc(e.verifiedAt)}</span></td></tr>`).join("\n")}</tbody>`;
    };
    return `<section class="row"><h2 class="side label">구하기 — 검수된 판본 ${eds.length}</h2><div class="wide">
<p class="sig eds-note">검수는 이 작품의 판이 맞는지(제목·역자·ISBN)다. 지금 살 수 있는지는 「판매 확인」이 붙은 판만 우리가 서점에서 확인했다.</p>
<table class="eds"><thead><tr><th>출판사</th><th>옮긴이</th><th>연도</th><th>저본</th><th>ISBN</th><th></th></tr></thead>
${langs.map(group).join("\n")}</table></div></section>`;
  }
  // 없음의 원장이 이 작품을 이름으로 지목했다면, "아직 안 봤다"가 아니라
  // **"찾았고 없었다"**가 사실이다. 둘은 다른 문장이고 다른 날짜를 갖는다.
  const gone = d.editions.absent?.[w.id];
  if (gone) {
    return `<section class="row"><h2 class="side label">구하기</h2><div class="main">
<p class="absent">한국어 판본을 <strong>찾지 못했다</strong> — ${esc(gone.checkedAt)} 확인. 뒤진 곳: ${esc(gone.searched.join(" · "))}.${gone.note ? ` ${esc(gone.note)}` : ""}
이 작품은 지도에 남는다. 없는 것은 없다고 적는다.</p>
<div class="doors">
  <a class="go quiet" href="${ALADIN_SEARCH(term)}" rel="nofollow noopener">그래도 찾아보기 — 알라딘</a>
  <a class="go quiet" href="${NL_SEARCH(term)}" rel="nofollow noopener">국립중앙도서관</a>
</div></div></section>`;
  }
  // 코퍼스의 절반은 한국어 번역이 있는지조차 모르는 책이다. 한국어 제목으로만 검색을
  // 걸면 그 책들은 "없다"가 아니라 "찾을 수 없다"가 되고, 원제로 한 번 더 두드리면
  // 도서관 목록에는 대개 원서가 있다.
  const orig = (w.titleOriginal ?? "").trim();
  const origTerm = `${orig} ${a ? a.names.original : ""}`.trim();
  return `<section class="row"><h2 class="side label">구하기</h2><div class="main">
<p class="absent">한국어 판본을 아직 검수하지 않았다 (${esc(d.editions.checkedAt)} 기준). 아래는 검색으로 나가는 문이고, 우리가 확인한 판본이 아니다.</p>
<div class="doors">
  <a class="go quiet" href="${ALADIN_SEARCH(term)}" rel="nofollow noopener">알라딘에서 찾기</a>
  <a class="go quiet" href="${KYOBO_SEARCH(term)}" rel="nofollow noopener">교보문고에서 찾기</a>
  <a class="go quiet" href="${NL_SEARCH(term)}" rel="nofollow noopener">국립중앙도서관에서 찾기</a>
${orig && orig !== w.titleKo ? `  <a class="go quiet" href="${NL_SEARCH(origTerm)}" rel="nofollow noopener">원제로 찾기 — <span${langAttr(orig, a?.languages[0])}>${esc(orig)}</span></a>` : ""}
</div></div></section>`;
}

const STATE_OPTIONS = [
  ["", "모르는 책"],
  ["want", "관심 있는 책"],
  ["opened", "펼쳐본 책"],
  ["have", "구매한 책"],
  ["read", "읽은 책"]
] as const;

/** 사다리 한 칸. 기본값 「모르는 책」은 저장되지 않고, 이름만 갖는다. */
// 제품이 독자에게 청하는 단 하나의 행동이다 — 그래서 쪽에서 가장 큰 조작물이다(이전: 77×25px 드롭다운).
// 사다리의 나머지 칸은 누른 뒤에 열린다(런타임이 붙인다) — 접힌 것은 글자 예산에 세지 않는다.
const markMeta = (w: Work): string => ` data-t="${esc(w.titleKo)}" data-y="${w.year}" data-a="${esc(byId.get(w.authorId)?.names.ko ?? "")}"`;
function stateControl(workId: string, big = false, meta = ""): string {
  return `<div class="mark${big ? " big" : ""}" data-work="${esc(workId)}" data-state=""${meta}><button type="button" class="mark-main" aria-pressed="false"><span class="pip" aria-hidden="true"></span><span class="mark-label">관심 있는 책</span><span class="chev" aria-hidden="true">▾</span></button></div>`;
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
  const g = relationGlyph(r, selfId);
  return `<li>${seal(other, { tone: "ink", cls: "xs" })}<div class="who"><a href="/authors/${esc(otherId)}/">${esc(other.names.ko)}</a><span class="rt">${g} ${esc(REL_KO[r.type] ?? r.type)}</span></div>
    <p class="sum">${esc(r.summary)} <span class="ev">${esc(EVIDENCE_KO[r.evidenceLevel] ?? r.evidenceLevel)}</span></p>${sourcesDetails(r.sourceIds, "srcs rel")}</li>`;
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
  return `<ul class="rels lead">${relRow(rels[0], selfId)}</ul>`;
}

function coverOf(w: Work): string {
  const c = ART.covers[w.id];
  return c ? `<figure class="cover"><img src="/art/${esc(c.file)}" width="${c.w}" height="${c.h}" alt="${esc(c.provenance?.altKo ?? `『${w.titleKo}』 ${coverShows(c)}`)}" loading="lazy"></figure>` : "";
}
function workRow(w: Work, entryWhy?: string): string {
  return `<li>${coverOf(w)}<div class="head"><span class="t"><a href="/works/${esc(w.id)}/">${esc(w.titleKo)}</a></span><span class="y">${esc(yr(w.year))}${YEAR_BASIS_SHORT[w.yearBasis ?? "attested"] ?? ""}</span>${w.world ? `<span class="tag">여는 문장</span>` : ""}</div>
    ${entryWhy ? `<p class="entrywhy">${esc(firstSentence(entryWhy))}</p>` : ""}
    ${w.significance ? `<p class="sig">${esc(firstSentence(w.significance))}</p>` : ""}
    ${stateControl(w.id, false, markMeta(w))}
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
    .sort((x, y) => y.o - x.o || rank(y.b) - rank(x.b) || idHash(a.id + x.b.id) - idHash(a.id + y.b.id))
    .map((x) => x.b);
  const out = new Map<string, Author>();
  for (const b of chain) out.set(b.id, b);
  for (const b of overlap) { if (out.size >= n) break; out.set(b.id, b); }
  return [...out.values()].sort((x, y) => x.activeRange[0] - y.activeRange[0]);
}

/**
 * 이웃한 자리 — 같은 권역에서 이웃을 넉넉히 못 찾을 때만. 동남아 59명은 그 권역에
 * 도판이 없고 다른 권역과 겹치는 사람도 없어 격자에서 섬이었다(2026-09-04 실측).
 * 사람을 더 채워도 섬은 섬이었다 — 다리는 사람이 아니라 지리다. 인접은 REGION_NEIGHBORS
 * 의 지리 사실이고, 이 목록은 "같은 자리"와 **다른 소절**에 다른 문장으로 선다.
 */
const NEAR_ENOUGH = 6;
function neighbouring(a: Author, already: Author[], n = 6): Author[] {
  if (already.length >= NEAR_ENOUGH) return [];
  const [from, to] = a.activeRange;
  const skip = new Set([a.id, ...already.map((b) => b.id)]);
  const pool = new Map<string, Author>();
  for (const r of a.regions)
    for (const nb of REGION_NEIGHBORS[r] ?? [])
      for (const b of byRegionYear.get(nb) ?? []) if (!skip.has(b.id)) pool.set(b.id, b);
  return [...pool.values()]
    .map((b) => ({ b, o: Math.min(to, b.activeRange[1]) - Math.max(from, b.activeRange[0]) }))
    .filter((x) => x.o >= 0)
    .sort((x, y) => y.o - x.o || rank(y.b) - rank(x.b) || idHash(a.id + x.b.id) - idHash(a.id + y.b.id))
    .slice(0, n)
    .map((x) => x.b)
    .sort((x, y) => x.activeRange[0] - y.activeRange[0]);
}

function contemporariesSection(a: Author): string {
  const near = contemporaries(a);
  const beside = neighbouring(a, near);
  if (!near.length && !beside.length) return "";
  const row = (b: Author) =>
    `<li>${seal(b, { tone: "ink", cls: "xxs" })}<a href="/authors/${esc(b.id)}/">${esc(b.names.ko)}</a>` +
    `${(b.depth ?? "plate") === "plate" ? `<span class="tag">도판</span>` : ""}` +
    `<span class="y">${esc(lifeSpan(b))}</span></li>`;
  const head = near.length ? `같은 자리, 같은 때 — ${near.length}명` : `이웃한 자리, 같은 때 — ${beside.length}명`;
  return `<details class="near"><summary>${head}</summary>
${near.length ? `<ul class="near">${near.map(row).join("\n")}</ul>` : ""}
${beside.length && near.length ? `<h3 class="near-h">이웃한 자리 — ${beside.map((b) => regionKo(b.regions[0]!)).filter((v, i, arr) => arr.indexOf(v) === i).join("·")}</h3>` : ""}
${beside.length ? `<ul class="near">${beside.map(row).join("\n")}</ul>` : ""}</details>`;
}

/** 표제지 — 이름, 원어 이름(그 문자가 서는 방향대로), 서명이 있으면 서명, 그리고 인장 한 점. */
function titlePage(a: Author): string {
  const stance = nameStance(a.names.original);
  const sig = signatureOf(a.id);
  const life = [
    lifeSpan(a),
    a.languages.map(langKo).join("·"),
    a.regions.map(regionKo).join("·"),
    ...(a.movements.length ? [a.movements.map(movementKo).join("·")] : [])
  ];
  const depth = a.depth ?? "plate";
  const band = proved(a) ? "" : `<p class="unproved"><b>${depth === "plate" ? "도판" : depth === "sketch" ? "스케치" : "실루엣"}</b>${depth === "silhouette" ? "이름과 자리만 안다" : "아직 출처에 대보지 않은 쪽"}</p>`;
  return `${band}<header class="title-page">
<h1 class="name ${sizeClass(a.names.ko) === "m" ? "m" : ""}">${esc(a.names.ko)}</h1>
${a.names.original && a.names.original !== a.names.ko ? `<p class="orig ${stance}"${langAttr(a.names.original, a.languages[0])}>${esc(a.names.original)}</p>` : ""}
<div class="autograph${sig ? "" : " solo"}">${sig ? `<img src="/art/${esc(sig.file)}" width="${sig.w}" height="${sig.h}" alt="${esc(a.names.ko)}의 서명">` : ""}${seal(a, { texture: true })}</div>
<p class="imprint">${life.map((x) => `<span>${esc(x)}</span>`).join("")}</p>
</header>`;
}

function artCredits(a: Author, works: Work[]): string {
  const sig = signatureOf(a.id);
  const covers = works.map((w) => ART.covers[w.id]).filter((c): c is ArtEntry => Boolean(c));
  return [
    sig ? `<p class="credit">서명 — ${creditHtml(sig)}</p>` : "",
    ...covers.map((c) => `<p class="credit">${esc(coverShows(c))} — ${creditHtml(c)}</p>`)
  ].join("");
}

function authorPage(a: Author): string {
  const works = worksOf(a.id);
  const ordered = a.readingOrder
    .map((id) => works.find((w) => w.id === id))
    .filter((w): w is Work => Boolean(w));
  const rest = works.filter((w) => !a.readingOrder.includes(w.id)).sort((x, y) => x.year - y.year);
  const rels = relsOf(a.id).sort((x, y) => (y.weight ?? 0.7) - (x.weight ?? 0.7));
  const depth = a.depth ?? "plate";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: a.names.original,
    alternateName: a.names.ko,
    birthDate: a.birthYear !== undefined && a.birthYear > 0 ? String(a.birthYear) : undefined,
    deathDate: a.deathYear !== undefined && a.deathYear > 0 ? String(a.deathYear) : undefined
  };
  const doors = `<div class="doors"><a class="go quiet" href="/#${esc(a.id)}">책에서 이 자리 보기</a><a class="go quiet" href="/authors/">색인</a></div>`;
  const nearRow = contemporariesSection(a);

  // ── 실루엣과 스케치 (결정 (137)) ────────────────────────────────────────
  // 지도 위의 자리다. 우리가 아는 것만 적고, 모르는 것은 **모른다고 적는다**. 스케치는 한 문장을 더한
  // 실루엣이고, 그 한 문장은 아직 출처에 대보지 않았다 — 머리의 연필 띠와 연필 인장이 그것을 말한다.
  if (depth !== "plate") {
    const stillMissing =
      depth === "sketch"
        ? `<p class="absent"><strong>아직 스케치다.</strong> 왜 이 사람이 지도에 있는지 한 줄까지 안다 —
그 한 줄과 아래 연도는 <strong>아직 출처에 대보지 않았다.</strong> 입문 순서와 판본은 아직 우리가 놓지 않았다.</p>`
        : works.length
          ? `<p class="absent"><strong>아직 실루엣이다.</strong> 이 책들이 있다는 것과 언제 어느 말로 쓰였는지는 안다.
무엇이 이 사람을 그 자리에 세웠는지는 아직 우리가 읽지 않았다.</p>`
          : `<p class="absent"><strong>아직 실루엣이다.</strong> 이름과 자리는 안다 — 언제 어느 언어로 썼는지까지.
그 너머는 아직 우리가 읽지 않았다. 이 쪽은 비어 있는 것이 아니라 아직 채워지지 않았다.</p>`;
    const body = `
<article class="${depth === "sketch" ? "sketch" : "sketch silhouette"}">
${titlePage(a)}
<div class="sheet">
<section class="row"><div class="side"><p class="label">${depth === "sketch" ? "스케치" : "실루엣"}</p></div><div class="main">
<p class="ready" id="lp-ready" data-author="${esc(a.id)}" hidden></p>
${a.importanceReason ? `<p class="lede">${esc(a.importanceReason)}</p>` : ""}
${stillMissing}</div></section>
${works.length ? `<section class="row"><h2 class="side label">책 ${works.length}</h2><div class="main"><ul class="works plain">${[...works].sort((x, y) => x.year - y.year).map((w) => workRow(w)).join("\n")}</ul></div></section>` : ""}
<section class="row"><h2 class="side label">이어지는 사람</h2><div class="main">${relationsSection(rels, a.id)}</div></section>
${nearRow ? `<section class="row"><h2 class="side label">같은 자리</h2><div class="main">${nearRow}</div></section>` : ""}
<section class="row"><div class="side"></div><div class="main">${doors}</div></section>
</div>
</article>`;
    return page({
      title: `${a.names.ko} — 하나의 책`,
      desc: a.importanceReason
        ? firstSentence(a.importanceReason)
        : `${a.names.ko}(${a.names.original}) — ${span(a.activeRange[0], a.activeRange[1])}. 「하나의 책」의 실루엣 항목.`,
      path: `/authors/${a.id}/`,
      body,
      noindex: a.reviewStatus === "draft",
      ld
    });
  }

  // 난도는 이유와 함께 한 번, 방주에 선다. 머리글에 숫자만 또 적으면 같은 것을 두 번 읽힌다.
  const pips = a.difficulty ? `<span class="pips" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= a.difficulty! ? "on" : ""}"></i>`).join("")}</span>` : "";
  const body = `
<article>
${titlePage(a)}
<div class="sheet">
<section class="row"><div class="side"><p class="label">도판</p></div><div class="main">
<p class="ready" id="lp-ready" data-author="${esc(a.id)}" hidden></p>
${a.importanceReason ? `<p class="${ledeClass(a.importanceReason)}">${esc(a.importanceReason)}</p>` : ""}
<a class="go" href="/#${esc(a.id)}">여기서 읽기 시작</a></div></section>
<section class="row">${ordered.length ? `<h2 class="side label">입문 순서 ${ordered.length}</h2>` : `<div class="side"></div>`}<div class="main">
<ol class="works ord">${ordered.map((w, i) => workRow(w, i === 0 ? a.readingEntryReason : undefined)).join("\n")}</ol></div>
<aside class="aside">
${a.readingWarning ? `<div class="note"><p class="label">주의</p><p>${esc(a.readingWarning)}</p></div>` : ""}
${a.difficulty ? `<div class="note"><p class="label">난도 ${a.difficulty}/5${pips}</p>${a.difficultyReason ? `<p>${esc(a.difficultyReason)}</p>` : ""}</div>` : ""}
${artCredits(a, works)}</aside></section>
${rest.length ? `<section class="row"><div class="side"></div><div class="main"><details><summary>그 밖의 작품 ${rest.length}</summary><ul class="works plain">${rest.map((w) => workRow(w)).join("\n")}</ul></details></div></section>` : ""}
<section class="row"><h2 class="side label">이어지는 한 사람</h2><div class="main">${relationsSection(rels, a.id)}
${
  rels.length > 1
    ? `<details><summary>나머지 관계 ${rels.length - 1} — 선이 그어진 이유</summary>
<ul class="rels">${rels.slice(1).map((r) => relRow(r, a.id)).join("\n")}</ul></details>`
    : ""
}</div></section>
${nearRow ? `<section class="row"><h2 class="side label">같은 자리</h2><div class="main">${nearRow}</div></section>` : ""}
<section class="row"><div class="side"></div><div class="main">${sourcesDetails(a.sourceIds)}</div></section>
</div>
</article>`;
  return page({
    title: `${a.names.ko} — 하나의 책`,
    desc: firstSentence(a.importanceReason),
    noindex: a.reviewStatus === "draft",
    path: `/authors/${a.id}/`,
    body,
    ld
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
  // 「증언」은 이 책의 작가에게서 **나간** 방향 있는 관계 중 출처가 있는 것만이다 — 뒤의 작가가 이 책을 지목했다.
  // 이 책의 작가가 받은 영향(뿌리)과 방향 없는 관계(친연·대조·대화)는 증언이 아니라 「이 책에 이어진 사람」이다.
  // (2026-09-23 감사: 190건이 전부 증언 제목 아래 있었고, 참된 증언은 57건이었다.)
  const anchored = d.relations.filter((r) => (r.anchors ?? []).some((an) => (an as { workId?: string }).workId === w.id));
  const isTestimony = (r: Relation): boolean =>
    TESTIMONY_TYPES.has(r.type) && r.sourceId === w.authorId && r.evidenceLevel !== "editorial_inference" && r.sourceIds.length > 0;
  const testimony = anchored.filter(isTestimony);
  const linked = anchored.filter((r) => !isTestimony(r));
  const relList = (list: Relation[], head: string): string =>
    list.length
      ? `<section class="row"><h2 class="side label">${esc(head)}</h2><div class="main"><ul class="rels">
${list
  .map((r) => {
    const otherId = r.sourceId === w.authorId ? r.targetId : r.sourceId;
    const other = byId.get(otherId);
    if (!other) return "";
    const g = relationGlyph(r, w.authorId);
    return `<li>${seal(other, { tone: "ink", cls: "xs" })}<div class="who"><a href="/authors/${esc(otherId)}/">${esc(other.names.ko)}</a><span class="rt">${g} ${esc(REL_KO[r.type] ?? r.type)}</span></div>
    <p class="sum">${esc(r.summary)} <span class="ev">${esc(EVIDENCE_KO[r.evidenceLevel] ?? r.evidenceLevel)}</span></p>${sourcesDetails(r.sourceIds, "srcs rel")}</li>`;
  })
  .join("\n")}
</ul></div></section>`
      : "";
  const cover = ART.covers[w.id];
  const firstEd = world?.editions.find((e) => e.kind === "first-edition") ?? world?.editions[0];
  const stance = nameStance(w.titleOriginal ?? "");
  const body = `
<article>
<header class="title-page" style="position:relative">
<p class="label">${a ? `${seal(a, { cls: "xxs" })} &nbsp;<a href="/authors/${esc(a.id)}/">${esc(a.names.ko)}</a> · ` : ""}${esc(yr(w.year))}${YEAR_BASIS_KO[w.yearBasis ?? "attested"] ?? ""} · ${esc(genreKo(w.genre))}</p>
<h1 class="name ${sizeClass(w.titleKo)}">${esc(w.titleKo)}</h1>
${w.titleOriginal && w.titleOriginal !== w.titleKo ? `<p class="orig ${stance === "rtl" ? "rtl" : ""}"${langAttr(w.titleOriginal, a?.languages[0])}>${esc(w.titleOriginal)}</p>` : ""}
<span class="stamped" aria-hidden="true">서재에 꽂힌 책</span>
<div style="margin-top:clamp(24px,3.4vw,40px)">${stateControl(w.id, true, markMeta(w))}</div>
</header>
<div class="sheet">
<section class="row"><div class="side"></div><div class="main">
${
  w.significance
    ? `<p class="${ledeClass(w.significance)}">${esc(w.significance)}</p>`
    : `<p class="absent"><strong>아직 실루엣이다.</strong> 이 책이 있다는 것과 언제 어느 말로 쓰였는지는 안다.
그 너머 — 무엇이 이 책을 그 자리에 세웠는지 — 는 아직 우리가 읽지 않았다.</p>`
}
${verified && world ? `<blockquote class="opening"><p${langAttr(world.opening.original, a?.languages[0])}>${esc(world.opening.original)}</p><p class="ko">${esc(world.opening.ko)}</p><span class="label">여는 문장 · 자체 번역</span></blockquote>` : ""}</div>
${cover ? `<aside class="aside"><figure class="cover fig"><img src="/art/${esc(cover.file)}" width="${cover.w}" height="${cover.h}" alt="${esc(cover.provenance?.altKo ?? `『${w.titleKo}』 ${coverShows(cover)}`)}"><figcaption>${cover.provenance?.captionKo ? `${esc(cover.provenance.captionKo)}<br>` : firstEd && coverShows(cover) === "초판 표지" ? `초판 — ${firstEd.year} · ${esc(firstEd.publisher)}, ${esc(firstEd.place)}<br>` : ""}사진 ${creditHtml(cover)}</figcaption></figure></aside>` : ""}</section>
${
  verified && world
    ? `<section class="row"><div class="side"></div><div class="main"><table class="facts">
${world.written ? `<tr><th>집필</th><td>${esc(world.written)}</td></tr>` : ""}
${world.editions.map((e) => `<tr><th>${e.kind === "first-edition" ? "초판" : "첫 인쇄"}</th><td>${e.year}${e.month ? `. ${e.month}.` : ""} · ${esc(`${e.venue ? `${e.venue} · ` : ""}${e.publisher}, ${e.place}`)}${e.note ? ` — ${esc(e.note)}` : ""}</td></tr>`).join("\n")}
${world.posthumous ? `<tr><th>유고</th><td>${esc(world.posthumous.note)}</td></tr>` : ""}</table></div></section>`
    : ""
}
${
  relList(testimony, `이 책을 지목한 작가들의 증언 ${testimony.length}`)
}
${relList(linked, `이 책에 이어진 사람 ${linked.length}`)}
${acquireBlock(w, a)}
<section class="row"><div class="side"></div><div class="main"><div class="doors">
  ${a ? `<a class="go" href="/authors/${esc(a.id)}/">${esc(a.names.ko)}의 방으로</a>` : ""}
  ${a ? `<a class="go quiet" href="/#${esc(a.id)}">이 작가에서 시작</a>` : ""}
</div>
${w.sourceIds.length ? `<div style="margin-top:14px">${sourcesDetails(w.sourceIds)}</div>` : ""}</div></section>
</div>
</article>
<div class="dock"><div class="what"><b>${esc(w.titleKo)}</b>${a ? esc(a.names.ko) : ""}</div>${stateControl(w.id, false, markMeta(w))}</div>`;
  return page({
    title: `${w.titleKo}${a ? ` — ${a.names.ko}` : ""} · 하나의 책`,
    desc: w.significance
      ? firstSentence(w.significance)
      : `${w.titleKo}${w.titleOriginal && w.titleOriginal !== w.titleKo ? `(${w.titleOriginal})` : ""} — ${a ? `${a.names.ko}, ` : ""}${yr(w.year)}${YEAR_BASIS_SHORT[w.yearBasis ?? "attested"] ?? ""}. 「하나의 책」의 실루엣 항목.`,
    path: `/works/${w.id}/`,
    body,
    bodyAttr: 'data-work-page class="has-dock"',
    noindex: (a?.reviewStatus ?? "draft") === "draft",
    ld: {
      "@context": "https://schema.org",
      "@type": "Book",
      name: w.titleOriginal ?? w.titleKo,
      alternateName: w.titleKo,
      // 기원전·성립 추정 연도는 날짜가 아니다 — 「-458」을 datePublished 로 내보내지 않는다.
      datePublished: w.year > 0 && (w.yearBasis ?? "attested") !== "composition-range" ? String(w.year) : undefined,
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
      .filter(Boolean)
      .join("|");
  // 인장첩(印譜) — 줄마다 그 사람의 문자 한 글자. 1,806개의 SVG 는 색인을 1MB 넘게 만들므로 여기서는 글자 하나짜리
  // CSS 도장이다: 붉게 찍힌 것은 출처에 대본 쪽, 연필 점선은 아직 대보지 않은 쪽.
  const names = (a: Author): string => [a.names.ko, a.names.original, ...a.names.aliases].join(" ").toLowerCase();
  const titles = (a: Author): string => worksOf(a.id).map((w) => w.titleKo).join("|");
  const row = (a: Author): string =>
    `<li data-h="${esc(hay(a))}" data-n="${esc(names(a))}" data-t="${esc(titles(a))}" data-r="${esc(a.regions.join(" "))}" data-p="${esc(a.periods.join(" "))}"><a href="/authors/${esc(a.id)}/"><span class="chop${proved(a) ? "" : " d"}" aria-hidden="true">${esc(sealGlyphs(a.names.original || a.names.ko, sealRule(a)).glyphs[0] ?? "·")}</span><span class="k">${esc(a.names.ko)}</span>${a.names.original && a.names.original !== a.names.ko ? `<span class="o"${langAttr(a.names.original, a.languages[0])}>${esc(a.names.original)}</span>` : ""}<span class="y">${esc(lifeSpan(a))}</span><span class="hit"></span></a></li>`;
  const regionsUsed = REGION_DEFS.filter((r) => d.authors.some((a) => a.regions.includes(r.id)));
  const periodsUsed = PERIOD_DEFS.filter((pd) => d.authors.some((a) => a.periods.includes(pd.id)));
  const body = `
<header class="index-head">
<h1 class="name m">색인 <span class="n">${d.authors.length}</span></h1>
<p class="index-lede">도판 ${plates.length}인은 쪽이 채워졌고,${sketches.length ? ` 스케치 ${sketches.length}인은 한 문장을 얻었으며,` : ""} 실루엣 ${sils.length}인은 이름과 자리로 서 있다.</p>
<p class="none" id="none" role="status" hidden></p>
</header>
<div class="find">
  <div class="line"><input type="search" id="q" placeholder="이름이나 책 제목으로 찾기" autocomplete="off" spellcheck="false"></div>
  <div class="axes">
  <select id="fr" aria-label="권역"><option value="">권역 전체</option>${regionsUsed.map((r) => `<option value="${esc(r.id)}">${esc(r.ko)}</option>`).join("")}</select>
  <select id="fp" aria-label="시대"><option value="">시대 전체</option>${periodsUsed.map((pd) => `<option value="${esc(pd.id)}">${esc(pd.ko)}</option>`).join("")}</select>
  <span id="cnt"></span></div>
</div>
<p class="legend"><span><i class="chop" aria-hidden="true">印</i>출처에 대본 쪽</span><span><i class="chop d" aria-hidden="true">印</i>아직 대보지 않은 쪽</span></p>
<div class="album-h"><h2>도판 <span class="n">${plates.length}</span></h2></div>
<ul class="idx album">
${plates.map(row).join("\n")}
</ul>
${
  sketches.length
    ? `<div class="album-h"><h2>스케치 <span class="n">${sketches.length}</span></h2></div>
<ul class="idx album sk">
${sketches.map(row).join("\n")}
</ul>`
    : ""
}
${
  sils.length
    ? `<div class="album-h"><h2>실루엣 <span class="n">${sils.length}</span></h2></div>
<ul class="idx album sil">
${sils.map(row).join("\n")}
</ul>`
    : ""
}
<script>
${DOOR_JS}
(function(){
  var q=document.getElementById("q"), fr=document.getElementById("fr"), fp=document.getElementById("fp"),
      cnt=document.getElementById("cnt"), rows=[].slice.call(document.querySelectorAll(".idx>li")),
      heads=[].slice.call(document.querySelectorAll(".idx")).map(function(u){return u.previousElementSibling;});
  function run(){
    // 첫 장의 문과 같은 키로 견준다(scripts/lib/door.ts) — 띄어쓰기·악센트·점을 지운다. 「조지오웰」 「Jose Saramago」.
    var s=lpNorm(q.value.trim()), r=fr.value, p=fp.value, n=0;
    for(var i=0;i<rows.length;i++){
      var el=rows[i], ok=true;
      if(!el.__h)el.__h=(el.getAttribute("data-h")||"").split("|").map(lpNorm);
      if(s&&!el.__h.some(function(k){return k.indexOf(s)>=0;})) ok=false;
      if(ok&&r&&(" "+el.getAttribute("data-r")+" ").indexOf(" "+r+" ")<0) ok=false;
      if(ok&&p&&(" "+el.getAttribute("data-p")+" ").indexOf(" "+p+" ")<0) ok=false;
      el.hidden=!ok; if(ok) n++;
      // 책 제목으로 걸렸으면 어느 제목인지 보여 준다 — 오비디우스가 『변신』에 나오는 이유가 화면에 있어야 한다
      var hs=el.querySelector(".hit"), tt="";
      if(ok&&s&&lpNorm(el.getAttribute("data-n")||"").indexOf(s)<0){var ts=(el.getAttribute("data-t")||"").split("|");
        for(var j=0;j<ts.length;j++){if(lpNorm(ts[j]).indexOf(s)>=0){tt="『"+ts[j]+"』";break;}}}
      if(hs&&hs.textContent!==tt)hs.textContent=tt;
    }
    // 한 칸도 남지 않은 절은 제목까지 접는다 — 빈 제목은 없는 것을 있다고 말한다.
    // 절 제목의 수는 지금 보이는 수다 — 한 줄 위에 「도판 157」을 두고 아래에 한 사람만 세우지 않는다.
    [].slice.call(document.querySelectorAll(".idx")).forEach(function(u,j){
      var vis=[].slice.call(u.children).filter(function(c){return !c.hidden;}).length;
      u.hidden=!vis; if(heads[j]){heads[j].hidden=!vis;var hn=heads[j].querySelector(".n");
        if(hn){if(!hn.getAttribute("data-all"))hn.setAttribute("data-all",hn.textContent);hn.textContent=(s||r||p)?String(vis):hn.getAttribute("data-all");}}
    });
    cnt.textContent = (s||r||p) ? n+"인" : "";
    // 큰 제목의 수도 지금 보이는 수다. 0 이면 빈 화면이 아니라 문장이 선다 — 문에서 넘어온 독자가 서는 자리다.
    var hd=document.querySelector(".index-head .n"); if(hd){if(!hd.getAttribute("data-all"))hd.setAttribute("data-all",hd.textContent);hd.textContent=(s||r||p)?String(n):hd.getAttribute("data-all");}
    var none=document.getElementById("none");
    if(none){if(n===0&&(s||r||p)){none.textContent=(s?"「"+q.value.trim()+"」에 맞는 이름이 없다":"이 조건에 맞는 사람이 없다")+" — 책 제목이나 원어 이름으로도 찾는다. 스케치와 실루엣도 한 색인이다.";none.hidden=false;}else{none.hidden=true;}}
  }
  // 한글은 한 음절을 짓는 동안에도 input 이 온다 — 짓는 중에는 거르지 않는다(「이 이름은 없다」가 깜박인다).
  q.addEventListener("input",function(e){if(!e.isComposing)run();}); q.addEventListener("compositionend",run);
  fr.addEventListener("change",run); fp.addEventListener("change",run);
  try{var pq=new URLSearchParams(location.search).get("q");if(pq){q.value=pq;run();}}catch(e){}
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
<header class="title-page">
<h1 class="name m">서재</h1>
<p class="index-lede" id="shelf-sum">표시한 책이 여기 모인다. 이 기록은 이 브라우저 안에 있다.</p>
</header>
<div id="move-in" class="move-in" hidden></div>
<div id="shelf"></div>
<section class="move" id="move">
<h2>다른 브라우저로 옮기기</h2>
<p class="sig">표시는 이 브라우저 안에만 있다. 아이폰 사파리는 이 사이트를 7일 넘게 열지 않으면 지울 수 있고, 사생활 보호 창과
카카오톡 같은 앱 안 브라우저의 표시는 그 안에서 끝난다. 아래 주소를 자신에게 보내 두거나 다른 브라우저에서 열면, 그 주소를 연 곳에
같은 표시가 선다. 주소에는 책과 칸과 시각만 실리고, 서버를 거치지 않는다.</p>
<div class="doors"><button type="button" class="want" id="move-copy">옮기기 주소 복사</button><button type="button" class="want" id="move-share" hidden>보내기</button></div>
<p class="sig" id="move-msg" role="status"></p>
</section>
<div class="doors" style="margin-top:26px">
  <a class="go" href="/">책을 펴기</a>
  <a class="go quiet" href="/authors/">색인</a>
</div>
<script type="module">
import { readerState, authorOf, yearKo } from "/atlas.js";
const KO = { read: "읽은 책", have: "구매한 책", opened: "펼쳐본 책", want: "관심 있는 책" };
const ORDER = ["read", "have", "opened", "want"];
const TOTAL = ${d.works.length};
const el = document.getElementById("shelf");
const sum = document.getElementById("shelf-sum");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// 표시한 순간 들은 제목이 먼저다(lp.shelf.v1). 사전(works.json, 341KB)은 그 기억에 없는 책 — 다른 기기에서
// 표시한 책 — 이 있을 때만 받는다. 첫 화면이 "비어 있다"고 거짓말하던 것을 이렇게 막는다.
const heard = (() => { try { return JSON.parse(localStorage.getItem("lp.shelf.v1") || "{}") || {}; } catch { return {}; } })();
let dict = null;
const rowOf = (id) => heard[id] || (dict && dict[id]) || null;
const control = (id, w) => '<div class="mark" data-work="' + id + '" data-state=""' + (w ? ' data-t="' + esc(w[0]) + '" data-y="' + w[1] + '" data-a="' + esc(w[2]) + '"' : "") +
  '><button type="button" class="mark-main" aria-pressed="false"><span class="pip" aria-hidden="true"></span><span class="mark-label">관심 있는 책</span><span class="chev" aria-hidden="true">▾</span></button></div>';
function paint() {
  const marks = Object.entries(readerState().state || {});
  if (!marks.length) {
    sum.textContent = "표시한 책이 여기 모인다. 이 기록은 이 브라우저 안에 있다.";
    // 「아직 아무것도 표시하지 않았다」는 우리가 알 수 없는 말이다 — 다른 브라우저에서 했거나, 이 브라우저가 지웠을 수 있다.
    el.innerHTML = '<p class="absent">이 브라우저에는 아직 표시가 없다. 책을 펴고 한 권을 ' +
      '「관심 있는 책」으로 옮기면 여기 선다. 다른 브라우저에서 표시했다면 그곳의 <a href="#move">옮기기 주소</a>로 가져온다.</p>';
    return 0;
  }
  const bucket = Object.fromEntries(ORDER.map((k) => [k, []]));
  for (const [id, m] of marks) if (bucket[m.s]) bucket[m.s].push([id, m.at]);
  const authors = new Set(marks.map(([id]) => authorOf(id)));
  sum.textContent = marks.length + "권 / " + TOTAL + " · 작가 " + authors.size + "인. 이 기록은 이 브라우저 안에 있다.";
  let missing = 0;
  el.innerHTML = ORDER.filter((k) => bucket[k].length)
    .map((k) => {
      const rows = bucket[k]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => {
          const w = rowOf(id);
          if (!w) missing++;
          const t = w ? esc(w[0]) : id;
          const meta = w ? '<span class="y">' + esc(w[2]) + " · " + yearKo(w[1]) + "</span>" : "";
          return '<li><a href="/works/' + id + '/">' + t + "</a>" + meta + control(id, w) + "</li>";
        })
        .join("");
      return "<h2>" + KO[k] + " " + bucket[k].length + "</h2><ul>" + rows + "</ul>";
    })
    .join("");
  window.lpPaint && window.lpPaint();
  return missing;
}
if (paint() > 0) {
  dict = await fetch("/works.json").then((r) => r.json()).catch(() => ({}));
  paint();
}
// 서재는 읽기 전용이 아니다 — 읽은 책으로 옮기는 자리가 바로 여기다. 칸이 바뀌면 선반을 다시 짠다.
el.addEventListener("click", (e) => { if (e.target.closest(".mark-ladder button")) setTimeout(paint, 0); });

// ── 옮기기 주소 — 서버도 메일도 없이 표시를 다른 브라우저로 ───────────────────
// 주소의 # 뒤는 서버로 가지 않는다. 한 권 = 작품id~칸~시각(36진수), 쉼표로 잇는다.
const RK = "lp.reader.v3";
const LETTER = { want: "w", opened: "o", have: "h", read: "r" };
const FROM_LETTER = { w: "want", o: "opened", h: "have", r: "read" };
const readRaw = () => { try { return JSON.parse(localStorage.getItem(RK) || "null") || { v: 3, state: {} }; } catch { return { v: 3, state: {} }; } };
const moveUrl = () => {
  const st = readRaw().state || {};
  const body = Object.entries(st).filter(([, m]) => LETTER[m.s]).map(([id, m]) => id + "~" + LETTER[m.s] + "~" + Math.round(m.at).toString(36)).join(",");
  return location.origin + "/shelf/#m=" + body;
};
const msg = document.getElementById("move-msg");
document.getElementById("move-copy").addEventListener("click", async () => {
  const n = Object.keys(readRaw().state || {}).length;
  if (!n) { msg.textContent = "옮길 표시가 없다."; return; }
  const url = moveUrl();
  try { await navigator.clipboard.writeText(url); msg.textContent = n + "권의 옮기기 주소를 복사했다. 다른 브라우저의 주소창에 붙이거나 자신에게 보내 둔다."; }
  catch { msg.innerHTML = '복사하지 못했다 — 아래 주소를 길게 눌러 복사한다.<br><input readonly class="move-url" value="' + esc(url) + '">'; }
});
if (navigator.share) {
  const sh = document.getElementById("move-share");
  sh.hidden = false;
  sh.addEventListener("click", () => {
    if (!Object.keys(readRaw().state || {}).length) { msg.textContent = "옮길 표시가 없다."; return; }
    navigator.share({ title: "하나의 책 — 서재 옮기기", url: moveUrl() }).catch(() => {});
  });
}
// 주소로 들어온 표시 — 묻고 합친다. 같은 책이면 늦게 한 쪽이 이긴다(서버와 같은 규칙), 이 브라우저에서 지운 것은 되살리지 않는다.
if (location.hash.startsWith("#m=")) {
  const rows = location.hash.slice(3).split(",").map((x) => x.split("~")).filter((x) => x.length === 3 && /^[a-z0-9-]+--[a-z0-9-]+$/.test(x[0]) && FROM_LETTER[x[1]])
    .map(([id, l, t]) => ({ id, s: FROM_LETTER[l], at: parseInt(t, 36) })).filter((r) => r.at > 0 && r.at <= Date.now() + 300000);
  const box = document.getElementById("move-in");
  box.hidden = false;
  box.innerHTML = rows.length
    ? '<p class="sig">이 주소에 표시 ' + rows.length + '권이 실려 있다. 이 브라우저의 서재에 합칠까?</p><div class="doors"><button type="button" class="want" id="move-yes">합치기</button><button type="button" class="want" id="move-no">그만두기</button></div>'
    : '<p class="sig">이 주소에서 읽을 수 있는 표시가 없다.</p>';
  const done = (t) => { history.replaceState(null, "", location.pathname); box.innerHTML = '<p class="sig">' + t + "</p>"; };
  document.getElementById("move-yes")?.addEventListener("click", () => {
    const p = readRaw(); p.state = p.state || {}; let n = 0;
    for (const r of rows) {
      const cur = p.state[r.id], gone = p.gone && p.gone[r.id];
      if ((cur && cur.at >= r.at) || (gone && gone >= r.at)) continue;
      p.state[r.id] = { s: r.s, at: r.at }; if (p.gone) delete p.gone[r.id]; n++;
    }
    try { localStorage.setItem(RK, JSON.stringify(p)); done(n + "권을 합쳤다" + (rows.length > n ? " (" + (rows.length - n) + "권은 이 브라우저의 것이 더 늦어 그대로 두었다)" : "") + "."); }
    catch { done("이 브라우저는 저장을 막고 있어 합치지 못했다(사생활 보호 창·사이트 데이터 차단)."); }
    if (paint() > 0) fetch("/works.json").then((r) => r.json()).then((j) => { dict = j; paint(); }).catch(() => {});
  });
  document.getElementById("move-no")?.addEventListener("click", () => done("합치지 않았다."));
}
</script>`;
  return page({
    title: "서재 — 하나의 책",
    desc: "표시한 책이 모이는 자리. 기록은 읽는 사람의 브라우저 안에 있다.",
    path: "/shelf/",
    body
  });
}

// ——— 처리방침 — 로그인하는 독자에게서 무엇을 받는가 ———
// 로그인은 선택이고, 하지 않으면 서버에 아무것도 가지 않는다. 하는 사람에게는 무엇을, 왜, 어디에, 언제까지 두는지와
// 지우는 길을 한 쪽에 적는다. 운영자 창구는 래시힐앱스의 대외 문의 주소다(portfolio/ACCOUNTS.md).
function privacyPage(): string {
  const body = `
<header class="title-page">
<h1 class="name m">처리방침</h1>
<p class="index-lede">하나의 책이 독자에게서 받는 것과 그것을 지우는 길. 2026년 9월 24일부터.</p>
</header>
<section class="row"><h2 class="side label">받지 않는 것</h2><div class="main">
<p>로그인하지 않으면 서버에 아무것도 보내지 않는다. 표시(어떤 책을 어느 칸에 두었는지)는 이 브라우저의 저장소에만 있다.
광고·분석 도구·추적 쿠키는 쓰지 않는다. 쪽을 내주는 Cloudflare 는 접속 기록(IP 주소 등)을 자기 방침에 따라 처리하고, 우리는 그 기록을 받지 않는다.</p>
</div></section>
<section class="row"><h2 class="side label">로그인하면</h2><div class="main">
<p><b>받는 것</b> — 이메일 주소, 표시(작품, 칸, 시각), 표시를 바꾼 이력(같은 항목의 시간순 기록).</p>
<p><b>왜</b> — 다른 기기와 브라우저에서 같은 서재를 보게 하려고. 다른 목적으로 쓰지 않고, 누구에게도 넘기지 않는다.</p>
<p><b>언제까지</b> — 아래에서 지우거나 삭제를 요청할 때까지.</p>
<p><b>어디에</b> — Supabase Inc.(미국)의 데이터베이스, 저장 위치 싱가포르(AWS ap-southeast-1). 로그인 링크 메일도 Supabase 가 보낸다.
로그인 링크를 청하는 순간 이메일 주소가, 로그인한 뒤 표시가 그곳으로 전송된다(국외 이전). 로그인을 쓰지 않으면 이전되지 않는다.</p>
</div></section>
<section class="row"><h2 class="side label">지우기</h2><div class="main">
<div id="lp-erase"><p class="sig">로그인한 브라우저에서 이 쪽을 열면 서버의 기록을 내려받거나 지울 수 있다.</p></div>
<p>로그인 주소는 운영자의 다른 서비스와 함께 쓰는 인증 저장소에 있어 여기서 바로 지우지 않는다 — 아래 주소로 요청하면 지운다.
열람·정정·삭제·처리 정지도 같은 주소로 요청한다.</p>
</div></section>
<section class="row"><h2 class="side label">운영자</h2><div class="main">
<p>래시힐앱스(Lashhillapps) · 개인정보 보호책임자 겸 문의 <a href="mailto:lashhillapps@gmail.com">lashhillapps@gmail.com</a></p>
</div></section>`;
  return page({ title: "처리방침 — 하나의 책", desc: "하나의 책이 로그인한 독자에게서 받는 것, 두는 곳, 지우는 길.", path: "/privacy/", body });
}

// ——— 없는 쪽 ———
function notFoundPage(): string {
  const body = `
<header class="title-page">
<h1 class="name m">없는 쪽</h1>
<p class="index-lede">이 주소의 쪽은 이 책에 없다. 옮겨졌거나, 처음부터 없던 쪽이다.</p>
</header>
<div class="doors"><a class="go" href="/">첫 장</a><a class="go quiet" href="/authors/">색인에서 찾기</a></div>`;
  return page({ title: "없는 쪽 — 하나의 책", desc: "이 주소의 쪽은 없다.", path: "/404", body, noindex: true });
}

// ——— 첫 장 — 걸음마다 작가 하나, 인연을 골라 다음으로 ———
//
// 캡슐(1,465명의 이름·책·인연)은 HTML 에 박혀 있었다. 압축 후 214KB 였고, 그 전부를
// 매 방문마다 다시 받았다 — 한 사람을 보러 온 사람이. 이제 별도 파일로 나가고 이름에
// 내용 해시가 붙는다: 데이터가 그대로면 브라우저가 다시 받지 않는다. 주에 한 번 오는
// 제품에서 이 차이가 재방문 전체를 만든다.
let walkDataPath = "";
function walkPage(): string {
  const sealSl = (a: Author) => (SEAL_LETTERS[a.id] || a.languages[0] === "hu" ? sealGlyphs(a.names.original || a.names.ko, sealRule(a)).glyphs : undefined);
  const capsule = Object.fromEntries(
    d.authors.map((a) => {
      const works = worksOf(a.id);
      // 도판은 큐레이터가 정한 입문 순서로, 실루엣은 연도순으로. 실루엣에는
      // readingOrder 가 없고(있으면 안 되고), 그것만 읽으면 책 3권을 가진 작가가
      // 첫 장에서 빈손으로 열린다 — 열어도 담을 것이 없는 쪽이 된다.
      const byOrder = a.readingOrder
        .map((id) => works.find((w) => w.id === id))
        .filter((w): w is Work => Boolean(w));
      // 순서가 없는 사람(스케치·실루엣)은 한국어로 구할 수 있는 책을 앞에 — 첫 장에서 담을 수 없는 원서 셋만 내밀지 않는다.
      const hasKo = (w: Work): number => ((d.editions.editions[w.id] ?? []).some((e) => e.language === "ko") ? 1 : 0);
      const ordered = (byOrder.length ? byOrder : [...works].sort((x, y) => hasKo(y) - hasKo(x) || x.year - y.year)).slice(0, 3);
      const hops = relsOf(a.id)
        .sort((x, y) => (y.weight ?? 0.7) - (x.weight ?? 0.7))
        .slice(0, 3)
        .map((r) => {
          const to = r.sourceId === a.id ? r.targetId : r.sourceId;
          const o = byId.get(to);
          // 다음 걸음의 사람은 이름과 인장만 있으면 그려진다 — 그 사람의 캡슐을 따로 받지 않는다.
          return { to, k: o?.names.ko ?? to, o: o?.names.original, pv: o && proved(o) ? 1 : 0, sl: o ? sealSl(o) : undefined,
            g: relationGlyph(r, a.id), t: REL_KO[r.type] ?? r.type, s: r.summary };
        });
      return [
        a.id,
        {
          ko: a.names.ko,
          or: a.names.original,
          al: a.names.aliases.length ? a.names.aliases : undefined,
          sl: sealSl(a),
          life: `${lifeSpan(a)} · ${a.languages.map(langKo).join("·")}`,
          why: a.importanceReason ? firstSentence(a.importanceReason) : "",
          depth: a.depth ?? "plate",
          pv: proved(a) ? 1 : 0,
          // 저작자 표시가 필요한 서명은 첫 장에 싣지 않는다 — 캡슐에는 크레딧을 그릴 자리가 없다(움베르토 에코, CC BY 3.0).
          sg: (() => { const sg = signatureOf(a.id); return sg && !needsCredit(sg) ? sg.file : undefined; })(),
          entry: a.readingEntryReason ? firstSentence(a.readingEntryReason) : undefined,
          // 입문 순서가 있는 사람만 「여기서 읽기 시작한다면」이다. 연도순 목록에 그 제목을 달면 없는 추천을 지어낸다.
          ord: byOrder.length ? 1 : 0,
          nw: works.length,
          works: ordered.map((w) => ({ id: w.id, t: w.titleKo, y: w.year, yk: `${yr(w.year)}${YEAR_BASIS_SHORT[w.yearBasis ?? "attested"] ?? ""}`, s: w.significance ? firstSentence(w.significance) : "" })),
          hops
        }
      ];
    })
  );
  const STARTS = ["franz-kafka", "jorge-luis-borges", "virginia-woolf"].filter((id) => byId.has(id));
  // 첫 장이 받는 것은 한 사람이다. 1,806명분 캡슐(1.2MB)을 한 파일로 싣던 시절, 느린 망에서 이번 주의 쪽이 뜨기까지
  // 13초가 걸렸다(2026-09-23 실측). 작가마다 한 파일, 문의 이름 색인은 한 파일(내용 해시가 이름) — 입력칸을 누를 때 받는다.
  mkdirSync(join(OUT, "walk"), { recursive: true });
  for (const [id, c] of Object.entries(capsule)) writeFileSync(join(OUT, "walk", `${id}.json`), JSON.stringify(c));
  const nameIndex = buildNameIndex(d.authors, d.works);
  walkDataPath = `/walk-${createHash("sha256").update(JSON.stringify(nameIndex)).digest("hex").slice(0, 10)}.json`;
  writeFileSync(join(OUT, walkDataPath.slice(1)), JSON.stringify(nameIndex));
  // 첫인사의 적격 목록 — atlas.js firstOpen 과 같은 조건(도판 · 작품 있음 · 한국어 판본 있음). 그래프 없이 같은 사람이 열린다.
  const firstIds = d.authors
    .filter((a) => (a.depth ?? "plate") === "plate" && worksOf(a.id).length > 0 && worksOf(a.id).some((w) => (d.editions.editions[w.id] ?? []).some((e) => e.language === "ko")))
    .map((a) => a.id);
  const body = `
<div class="spread">
<section class="verso">
<h1 class="book-title">하나의 책</h1>
<p class="book-sub">세계문학의 지도</p>
<form class="door" id="door" autocomplete="off">
<label for="anchor">아는 이름에서 펴기</label>
<div class="line"><input id="anchor" list="authors" placeholder="좋아한 작가 이름" enterkeyhint="go"><button type="submit">책을 펴기</button></div>
<datalist id="authors"></datalist>
<p class="miss" id="miss" role="status"></p>
</form>
<p class="lede">모든 책을 품으려는 하나의 책. 지금 작가 ${d.authors.length}명이 들어와 있고, 아직 만나지
않은 이름은 실루엣으로 서 있다. 읽은 것이 다음 것을 연다.</p>
<p class="census" id="census"></p>
<div class="below" id="below"></div>
</section>
<section class="recto"><div id="app"><p class="sig">책을 펴는 중…</p></div></section>
</div>
<script>
var DATA={};var NAMES=null;var TITLES=[];
var FIRST=${JSON.stringify(firstIds)};var TOTAL=${d.authors.length};
var STARTS=${JSON.stringify(STARTS)};
function cap(id){if(DATA[id])return Promise.resolve(DATA[id]);
  return fetch('/walk/'+encodeURIComponent(id)+'.json').then(function(r){if(!r.ok)throw new Error('cap '+r.status);return r.json();}).then(function(j){DATA[id]=j;return j;});}
function names(){if(NAMES)return Promise.resolve(NAMES);
  return fetch('${walkDataPath}').then(function(r){if(!r.ok)throw new Error('names '+r.status);return r.json();}).then(function(j){NAMES=j.n;TITLES=j.t;
    document.getElementById('authors').innerHTML=j.n.map(function(x){return '<option value="'+h(x[1])+'">';}).join('');return NAMES;});}
function nameOf(id){if(DATA[id])return DATA[id].ko;if(NAMES)for(var i=0;i<NAMES.length;i++)if(NAMES[i][0]===id)return NAMES[i][1];return id;}
var trail=[];
// 속성 값에도 쓰인다(data-t·alt·option) — 따옴표까지 막는다.
function h(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
var DIR={'→':'이 쪽의 사람이 상대에게','←':'상대가 이 쪽의 사람에게','↔':'서로'};
// 인장 — 빌드의 sealSvg 와 같은 규칙의 작은 판(질감 필터 없음). 작가의 문자로 새기고 슬러그로 기운다.
var CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';var sealN=0;
function lpGlyphs(o){var L=Array.from(o||'').filter(function(c){return /\\p{L}/u.test(c);});if(!L.length)return ['·'];
  var c=L[0];if(/\\p{Script=Han}|\\p{Script=Hiragana}|\\p{Script=Katakana}/u.test(c))return [c];
  if(/\\p{Script=Hangul}/u.test(c))return L.filter(function(x){return x>='가'&&x<='힣';}).slice(0,4).map(function(x){return CHO[Math.floor((x.charCodeAt(0)-0xAC00)/588)];});
  var ws=(o||'').split(/[\\s\\-]+/).filter(function(w){return /\\p{L}/u.test(w);});var last=ws[ws.length-1]||o;
  var g=Array.from(last).filter(function(x){return /\\p{L}/u.test(x);})[0]||c;
  return [/\\p{Script=Latin}|\\p{Script=Cyrillic}|\\p{Script=Greek}/u.test(g)?g.toLocaleUpperCase():g];}
function lpSeal(id,o,pv,cls,tone,sl){var g=sl||(DATA[id]&&DATA[id].sl)||lpGlyphs(o);var hh=2166136261;for(var i=0;i<id.length;i++)hh=Math.imul(hh^id.charCodeAt(i),16777619)>>>0;
  var rot=((hh%900)/100-4.5).toFixed(1);var u='j'+(++sealN);
  var pos=g.length===1?[[50,52,72]]:g.length===2?[[50,30,40],[50,72,40]]:[[70,30,38],[70,72,38],[30,30,38],[30,72,38]];
  var tx=function(extra){return g.map(function(x,i){return '<text x="'+pos[i][0]+'" y="'+pos[i][1]+'" font-size="'+pos[i][2]+'" text-anchor="middle" dominant-baseline="central" '+extra+'>'+h(x)+'</text>';}).join('');};
  if(!pv&&tone!=='ink')return '<svg class="seal pencil '+(cls||'')+'" viewBox="0 0 100 100" role="img" aria-label="연필 인장" style="transform:rotate('+rot+'deg)"><rect x="7" y="7" width="86" height="86" rx="7" fill="none" stroke="var(--pencil)" stroke-width="1.6" stroke-dasharray="4 3.2"/>'+tx('fill="none" stroke="var(--pencil)" stroke-width="1.2"')+'</svg>';
  return '<svg class="seal '+(tone==='ink'?'ink ':'')+(cls||'')+'" viewBox="0 0 100 100" role="img" aria-label="인장" style="transform:rotate('+rot+'deg)"><defs><mask id="'+u+'"><rect width="100" height="100" fill="#fff"/>'+tx('fill="#000"')+'</mask></defs><rect x="5" y="5" width="90" height="90" rx="8" fill="'+(tone==='ink'?'var(--ink)':'var(--seal)')+'" mask="url(#'+u+')"/></svg>';}
function lpHead(id,a,label){
  return '<p class="label">'+h(label)+'</p><h2 class="name">'+h(a.ko)+'</h2>'+
    (a.or&&a.or!==a.ko?'<p class="orig">'+h(a.or)+'</p>':'')+'<p class="life">'+h(a.life)+'</p>'+
    '<div class="autograph'+(a.sg?'':' solo')+'">'+(a.sg?'<img src="/art/'+a.sg+'" alt="'+h(a.ko)+'의 서명">':'')+lpSeal(id,a.or||a.ko,a.pv)+'</div>';}
function lpWorks(a,withEntry){
  return '<ul class="works">'+a.works.map(function(w,i){
    return '<li><div class="head"><span class="t"><a href="/works/'+w.id+'/">'+h(w.t)+'</a></span><span class="y">'+h(w.yk||w.y)+'</span></div>'+
      (withEntry&&i===0&&a.entry?'<p class="entrywhy">'+h(a.entry)+'</p>':'')+
      (w.s?'<p class="sig">'+h(w.s)+'</p>':'')+lpControl(w.id,w.t,w.y,a.ko)+'</li>';}).join('')+'</ul>';}
function render(id,note,scroll){
  var app=document.getElementById('app');
  if(!id){ openBook(app); return; }
  cap(id).then(function(a){
  var html='';
  html+=lpHead(id,a,note||(trail.length>1?trail.map(nameOf).join(' → '):'책의 한 쪽'));
  if(a.depth==='silhouette'){
    html+='<p class="absent">아직 실루엣이다 — '+(a.works.length?'이름과 자리, 책의 목록만 안다.':'이름과 자리만 안다.')+' 이 사람의 쪽은 아직 비어 있다.</p>';
  } else if(a.why){ html+='<p class="lede">'+h(a.why)+'</p>'; }
  if(a.works.length){ html+='<h3 class="label" style="margin-top:26px">'+(a.ord?'여기서 읽기 시작한다면':'이 사람의 책'+(a.nw>a.works.length?' — '+a.nw+'권 중 '+a.works.length+'권':''))+'</h3>'+lpWorks(a,Boolean(a.ord)); }
  if(a.hops.length){
    html+='<h3 class="label" style="margin:26px 0 12px">다음 걸음 — 인연을 골라라</h3><ul class="rels">'+a.hops.map(function(x){
      return '<li>'+lpSeal(x.to,x.o||x.k,1,'xs','ink',x.sl)+'<div class="who"><a href="#'+x.to+'" data-go="'+x.to+'">'+h(x.k)+'</a>'+
      '<span class="rt"><span class="g" title="'+h(DIR[x.g]||'')+'" aria-label="'+h(DIR[x.g]||'')+'">'+h(x.g)+'</span> '+h(x.t)+'</span></div><p class="sum">'+h(x.s)+'</p></li>';}).join('')+'</ul>';
  }
  html+='<div class="doors" style="margin-top:22px"><a class="go" href="/authors/'+id+'/">이 작가의 방(전체 기록)</a>'+
    '<a class="go quiet" href="#" data-reopen="1">책을 다시 펴기</a></div>';
  app.innerHTML=html;
  lpPaint();
  // 고른 사람의 쪽으로 — 창의 맨 위로 올리면 폰에서는 문과 머리말만 보이고 그 사람은 접힌 선 아래에 있다.
  if(scroll)app.scrollIntoView({block:'start'});
  }).catch(function(){
    // 없는 쪽을 말없이 이번 주의 쪽으로 바꾸지 않는다.
    trail=[];history.replaceState(null,'',location.pathname);
    document.getElementById('miss').textContent='주소의 「'+id+'」 쪽은 이 책에 없다. 이번 주의 쪽을 편다.';
    openBook(app);});
}

// ── 책이 열리는 쪽 ──────────────────────────────────────────────────────────
// 묻지 않는다. 책이 이미 어느 쪽에서 열려 있고, 그 쪽은 당신이 읽은 것에서 한 걸음
// 너머다. 표시가 아직 없으면 이번 주의 쪽이 열린다 — 매주 다른 쪽.
function pageHtml(id,a,reason,why){
  var html=lpHead(id,a,reason);
  if(a.depth==='silhouette'&&!a.works.length)return html+'<p class="absent">아직 실루엣이다 — 이름과 자리만 안다.</p><div class="doors"><a class="go quiet" href="#" data-reopen="1">다른 쪽</a></div>';
  if(why||a.why)html+='<p class="lede">'+h(why||a.why)+'</p>';
  if(a.works.length)html+=lpWorks(a,false);
  return html+'<div class="doors"><a class="go" href="#'+id+'" data-go="'+id+'">이 쪽을 펴기</a><a class="go quiet" href="#" data-reopen="1">다른 쪽</a></div>';}
function censusLine(met,total,openNow){document.getElementById('census').innerHTML='만난 작가 <strong>'+met+'</strong> <span>/ '+total+'</span>'+(openNow?' · 지금 열린 쪽 <strong>'+openNow+'</strong>':'');}
// 문해의 지도 — 접혀 있다. 표시가 없는 독자에게는 펼칠 때 그래프를 받는다(접힌 것을 위해 첫 장을 무겁게 하지 않는다).
function literacyBlock(A,g,lit){
  var el=document.getElementById('below');
  // 「지도 없이 읽을 수 있는 곳」은 관심만으로 열리지 않는다 — 펼쳐 봤거나 샀거나 읽은 작가만 센다.
  var opened=new Map();if(lit)lit.forEach(function(v,k){if(v>=2)opened.set(k,v);});
  var fill=function(g2){var L=A.literacy(g2,opened);
    var bar=function(row){var pct=row.total?Math.round(row.met/row.total*100):0;
      return '<li><span class="t">'+h(row.ko)+'</span><span class="m"><i style="width:'+pct+'%"></i></span><span class="y">'+row.met+'/'+row.total+'</span></li>';};
    return '<p class="sig">배지가 아니다. 어디를 지도 없이 읽을 수 있는지를 말한다.</p>'+
      '<h3>권역</h3><ul class="meters">'+L.regions.map(bar).join('')+'</ul><h3>시대</h3><ul class="meters">'+L.periods.map(bar).join('')+'</ul>';};
  el.innerHTML='<details class="literacy"><summary>문해의 지도 — 어느 영역이 열려 있는가</summary><div class="lit-body">'+(g?fill(g):'')+'</div></details>';
  if(!g){var d=el.querySelector('details');d.addEventListener('toggle',function(){if(!d.open||d.getAttribute('data-filled'))return;d.setAttribute('data-filled','1');
    A.graph().then(function(g2){d.querySelector('.lit-body').innerHTML=fill(g2);});});}
}
function openBook(app){
  app.innerHTML='<p class="sig">책을 펴는 중…</p>';
  var marks=Object.keys((lpLoad().state)||{}).length;
  import('/atlas.js').then(function(A){
    var wk=A.isoWeek();var turn=0;
    try{var tv=JSON.parse(sessionStorage.getItem('lp.turn.v1')||'null');if(tv&&tv.wk===wk)turn=tv.n|0;}catch(_){}
    if(!marks){
      // 표시가 없는 독자 — 그래프 없이. 적격 목록(FIRST)과 주차만으로 atlas.openAt 과 같은 사람이 열린다.
      // 이번 주의 쪽은 한 주 동안 그 사람이다 — 주 중간의 배포가 적격 목록을 바꿔도 돌아온 독자의 쪽을 바꾸지 않는다.
      var pin=null;try{pin=JSON.parse(localStorage.getItem('lp.week.v1')||'null');}catch(_){}
      var id=pin&&pin.wk===wk&&pin.n===turn&&FIRST.indexOf(pin.id)>=0?pin.id:A.firstOpen(FIRST,wk,turn);
      try{localStorage.setItem('lp.week.v1',JSON.stringify({wk:wk,n:turn,id:id}));}catch(_){}
      censusLine(0,TOTAL,0);literacyBlock(A,null,null);
      if(!id){app.innerHTML='';return;}
      A.markSeen(id);
      return cap(id).then(function(a){app.innerHTML=pageHtml(id,a,'이번 주에 열린 쪽','');lpPaint();});
    }
    return A.graph().then(function(g){
      var lit=A.litAuthors(A.readerState());
      var open=A.openAt(g,lit,wk,turn);
      var c=A.census(g,lit);
      censusLine(c.met,c.total,c.openNow);literacyBlock(A,g,lit);
      if(!open){app.innerHTML='';return;}
      var reason=open.first?'이번 주에 열린 쪽'
        :(A.KIND_KO[open.kind]?A.KIND_KO[open.kind]((g.byId.get(open.from)||{}).k||open.from,lit.get(open.from)):'');
      A.markSeen(open.id);
      return cap(open.id).then(function(a){app.innerHTML=pageHtml(open.id,a,reason,open.why);lpPaint();});
    });
  }).catch(function(){
    app.innerHTML='<p class="absent">책을 펴지 못했다 — 잠시 뒤 다시 시도해 달라. '+'<a href="/authors/">색인</a>은 지금도 열려 있다.</p>';
  });
}
// 클릭 위임 — 인라인 핸들러는 TS 템플릿 안의 JS 문자열 안의 따옴표라 세 겹이 되고,
// 실제로 한 번 깨져 첫 장이 통째로 죽었다(2026-08-31). 마크업은 마크업으로 남긴다.
document.addEventListener('click',function(e){
  var g=e.target.closest&&e.target.closest('[data-go]');
  if(g){e.preventDefault();go(g.getAttribute('data-go'));return;}
  var r=e.target.closest&&e.target.closest('[data-reopen]');
  if(r){e.preventDefault();
    // 「다른 쪽」은 이번 주 순서의 다음 사람이다 — 같은 답을 다시 계산하는 버튼이 아니다.
    if(!trail.length){try{var wk2=0,n2=0;var tv2=JSON.parse(sessionStorage.getItem('lp.turn.v1')||'null');
      import('/atlas.js').then(function(A){wk2=A.isoWeek();n2=(tv2&&tv2.wk===wk2?(tv2.n|0):0)+1;
        sessionStorage.setItem('lp.turn.v1',JSON.stringify({wk:wk2,n:n2}));render(null);});return;}catch(_){}}
    trail=[];render(null);}
});

// 걸음마다 기록을 남긴다 — 폰의 뒤로 가기는 앞 사람에게 돌아가야지 책 밖으로 나가면 안 된다.
function go(id,note){if(trail[trail.length-1]!==id)trail.push(id);history.pushState({id:id},'','#'+id);document.getElementById('miss').textContent='';render(id,note,true);}
window.addEventListener('popstate',function(){var id=location.hash.replace('#','');
  if(!id){trail=[];render(null);return;}
  var at=trail.lastIndexOf(id);trail=at>=0?trail.slice(0,at+1):[id];render(id,null,true);});
${DOOR_JS}
document.getElementById('door').addEventListener('submit',function(e){e.preventDefault();
  var inp=document.getElementById('anchor');var miss=document.getElementById('miss');var v=(inp.value||'').trim();miss.textContent='';if(!v)return;
  // 규칙은 scripts/lib/door.ts — 확실할 때만 연다. 비슷한 이름은 「그대로의 이름은 없다」와 함께 내민다.
  var find='<a href="/authors/?q='+encodeURIComponent(v)+'">색인에서 다른 표기로 찾기</a>';
  names().then(function(N){
    var r=doorMatch(N,TITLES,v);
    var list=function(ids){return ids.slice(0,6).map(function(id){return '<a href="#'+id+'" data-go="'+id+'">'+h(nameOf(id))+'</a>';}).join(' · ');};
    if(r.kind==='open'){go(r.id);return;}
    if(r.kind==='title'){go(r.id,'『'+r.title+'』의 작가');return;}
    if(r.kind==='choose'){miss.innerHTML='「'+h(v)+'」 — 여럿이다. 고르라: '+list(r.ids);return;}
    if(r.kind==='near'){miss.innerHTML='「'+h(v)+'」 그대로의 이름은 이 책에 없다. 가까운 이름: '+list(r.ids)+' — 또는 '+find;return;}
    // 「없다」고 단정하지 않는다 — 이름·별칭·책 제목을 다 봤어도 우리가 모르는 표기일 수 있다.
    var c=v.charCodeAt(v.length-1),fin=c>=0xAC00&&c<=0xD7A3?(c-0xAC00)%28:0,ro=fin&&fin!==8?'으로':'로';
    miss.innerHTML='「'+h(v)+'」'+ro+'는 찾지 못했다 — 아직 이 책에 없는 이름이거나 다른 표기다. '+find;
  }).catch(function(){miss.innerHTML='이름 색인을 받지 못했다 — '+find;});});
function lpControl(id,t,y,a){
  return '<div class="mark" data-work="'+id+'" data-state="" data-t="'+h(t||'')+'" data-y="'+(y||0)+'" data-a="'+h(a||'')+'"><button type="button" class="mark-main" aria-pressed="false"><span class="pip" aria-hidden="true"></span><span class="mark-label">관심 있는 책</span><span class="chev" aria-hidden="true">▾</span></button></div>';
}
// 시작 — 주소에 사람이 있으면 그 쪽을, 없으면 책이 열린 쪽을. 이름 색인은 문을 두드릴 때 받는다.
(function(){var start=location.hash.replace('#','');
  if(start){trail=[start];render(start,null,true);}else{render(null);}
  document.getElementById('anchor').addEventListener('focus',function(){names().catch(function(){});},{once:true});})();
</script>`;
  return page({
    title: "하나의 책 — 세계문학의 지도",
    desc: `모든 책을 품으려는 하나의 책 — 호메로스에서 지금까지 작가 ${d.authors.length}인. 읽은 것이 다음 것을 연다. 검토된 ${d.authors.filter((a) => a.reviewStatus !== "draft").length}인이 큐레이션이고, 작품 ${d.works.length}편이 그 안에 있다.`,
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
    w: worksOf(a.id).length,
    // 한국어 판본이 검수된 작품 수 — 첫 장은 표시가 없는 독자에게 구할 수 있는 책이 있는 사람만 내민다.
    ke: worksOf(a.id).filter((w) => (d.editions.editions[w.id] ?? []).some((e) => e.language === "ko")).length
  })),
  // 방향은 데이터 그대로: source → target = source 가 target 에게 영향을 주었다.
  edges: d.relations.map((r) => ({
    s: r.sourceId,
    t: r.targetId,
    y: r.type,
    d: r.direction === "directed" ? 1 : 0,
    v: r.evidenceLevel === "documented" ? 3 : r.evidenceLevel === "scholarly_consensus" ? 2 : 1,
    // 이유 한 문장은 돌아온 독자가 받는 유일한 보상이다 — 120자에서 자르면 74%가 문장 중간에서 끊겼다.
    m: firstSentences(r.summary ?? "", 240)
  })),
  // 격자 — 정적 쪽의 "같은 자리, 같은 때"와 **같은 계산 결과**를 싣는다. 규칙을
  // 두 번 구현하면 두 표면이 조용히 갈라진다. 인덱스로 저장한다(id 문자열의 1/8).
  near: d.authors.map((a) => contemporaries(a).map((b) => authorIndex.get(b.id) ?? -1).filter((n) => n >= 0))
};
writeFileSync(join(OUT, "graph.json"), JSON.stringify(capsule));

// 서재의 책 사전 — 서재를 여는 사람만 받는다. [제목, 연도, 작가]
mkdirSync(join(OUT, "shelf"), { recursive: true });
writeFileSync(join(OUT, "shelf", "index.html"), shelfPage());
// 배포 확인용 — 라이브의 이 파일이 배포한 커밋이어야 한다(scripts/deploy.sh). 캡슐 이름은 이름이 바뀔 때만 바뀌어 증거가 못 됐다.
writeFileSync(join(OUT, "build.txt"), `${process.env.GITHUB_SHA ?? execSync("git rev-parse HEAD", { cwd: PKG_ROOT }).toString().trim()}\n`);
mkdirSync(join(OUT, "privacy"), { recursive: true });
writeFileSync(join(OUT, "privacy", "index.html"), privacyPage());
// 없는 주소는 없다고 말한다. 이 파일이 있으면 Pages 는 모르는 경로에 첫 장을 200 으로 내주던 SPA 대체를 끄고 404 를 준다.
writeFileSync(join(OUT, "404.html"), notFoundPage());
// 내용 해시가 이름인 파일만 오래 둔다 — 이름이 같으면 내용도 같다. 나머지(HTML·book.css·캡슐)는 매번 다시 묻는다.
writeFileSync(
  join(OUT, "_headers"),
  ["/walk-*.json", "/fonts/nskr-*.woff2"].map((p) => `${p}\n  Cache-Control: public, max-age=31536000, immutable\n`).join("\n")
);
writeFileSync(
  join(OUT, "works.json"),
  JSON.stringify(
    Object.fromEntries(d.works.map((w) => [w.id, [w.titleKo, w.year, byId.get(w.authorId)?.names.ko ?? ""]]))
  )
);

// 번들러가 하던 일 — public/ 을 dist/ 로 옮긴다 (초상·육필·표지 원본)
const PUBLIC_DIR = join(PKG_ROOT, "public");
// public/ 을 통째로 복사하되, 어느 쪽도 부르지 않는 것은 내보내지 않는다 — 특히 portraits/ 는 생성 모델이 그린
// "상상 초상"이고, 이 제품은 그것을 싣지 않는다. 주소로 닿기만 해도 실은 것이다.
const UNSHIPPED = ["portraits", "art/grounds", "art/archival"].map((d) => join(PUBLIC_DIR, d));
if (existsSync(PUBLIC_DIR)) cpSync(PUBLIC_DIR, OUT, { recursive: true, filter: (src) => !UNSHIPPED.some((d) => src === d || src.startsWith(d + "/")) });

mkdirSync(join(OUT, "walk"), { recursive: true });
writeFileSync(join(OUT, "walk", "index.html"), walkPage());
writeFileSync(join(OUT, "index.html"), walkPage());

// sitemap 은 "이것을 색인해 달라"는 제출이다. 검토된 것만 제출한다 — 나머지 쪽에는
// noindex 가 붙어 있으므로 두 신호가 같은 말을 한다.
const urls = [
  `${BASE}/`,
  `${BASE}/authors/`,
  `${BASE}/shelf/`,
  `${BASE}/privacy/`,
  // 깊이와 검토는 다른 축이다. 도판이어도 사람이 검토하지 않았으면 제출하지 않는다.
  ...d.authors.filter((a) => a.reviewStatus !== "draft").map((a) => `${BASE}/authors/${a.id}/`),
  ...d.works.filter((w) => byId.get(w.authorId)?.reviewStatus !== "draft").map((w) => `${BASE}/works/${w.id}/`)
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
