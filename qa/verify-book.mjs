// 하나의 책 — 계약 하네스.
//
// 이 파일이 존재하는 이유는 실측 하나다: 정적 표면 616쪽은 배포되는 내내
// **브라우저 계약이 0개**였고(계측기 verify-journey 는 지금은 없는 SPA 만
// 열었다), 그동안 작가 페이지 100/100 이 카드 부채 상한 880자를 넘겨 평균
// 2,332자·최대 4,519자로 자라 있었다. 상태 단언이 픽셀을 증명하지 못한 자리를
// 다섯 번 겪은 뒤에 세우는 자다 — 그래서 여기서 재는 것은 DOM 노드가 아니라
// **그려진 글자**(innerText)다. 접힌 <details> 는 세지 않는다. 접혔으니까.
//
//   node qa/verify-book.mjs
import { readdirSync } from "node:fs";
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";
import { decodePng, countPixels } from "./png.mjs";

const server = await serveDist();
// 번들 브라우저 캐시가 없는 기계에서는 설치된 크롬으로 돈다: QA_CHANNEL=chrome node qa/verify-book.mjs
const browser = await chromium.launch(process.env.QA_CHANNEL ? { channel: process.env.QA_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: "ko-KR" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};
// 그려진 글자를 센다. `innerText` 는 렌더된 텍스트를 주지만 **닫힌 <select> 의
// 선택되지 않은 <option> 까지 포함한다** — 화면에는 선택된 한 칸만 그려지는데도.
// 상태 사다리를 붙이자마자 이 차이가 작가당 +130자로 나타났고, 예산이 화면이
// 아니라 DOM 을 재기 시작했다. 그래서 안 그려지는 옵션만 빼고 센다. (특례를
// 늘리는 대신 빼는 근거를 여기 적는다 — 자기 자를 무르는 방법은 이것뿐이다.)
const visible = () =>
  page.evaluate(() => {
    const hidden = [...document.querySelectorAll("select")].reduce((n, sel) => {
      for (const o of sel.options) if (!o.selected) n += (o.textContent ?? "").trim().length + 1;
      return n;
    }, 0);
    return Math.max(0, document.body.innerText.replace(/\s+/g, " ").trim().length - hidden);
  });

// 상태 칸은 이제 <select> 가 아니라 눌리는 인주다: 한 번 누르면 「관심 있는 책」, 그 뒤로는 사다리가 열린다.
// 계약은 사람이 하는 대로 누른다 — localStorage 를 직접 쓰면 칸이 죽어도 초록이다.
const setMark = async (m, state) => {
  if (!(await m.getAttribute("data-state"))) await m.locator(".mark-main").click();
  if (state === "want") return;
  const step = m.locator(`.mark-ladder button[data-set="${state}"]`);
  if (!(await step.isVisible())) await m.locator(".mark-main").click();
  await step.click();
};

// ─── 정문 ────────────────────────────────────────────────────────────────────
console.log("\n정문 — 책은 묻지 않고 열린다");
await page.goto(`${server.origin}/`, { waitUntil: "load" });
check("루트가 첫 장을 연다", ((await page.locator("h1").first().textContent()) ?? "").includes("하나의 책"));
await page.waitForTimeout(1200);
const appTxt = () => page.locator("#app").innerText();

// 결정 (137): 도감은 묻지 않는다. 예전 첫 장은 "어디서 시작할까"로 독자에게 결정을
// 떠넘겼다 — 다음 책을 못 고르는 사람에게 고르라고 묻는 화면이었다.
check("어디서 시작할지 묻지 않는다", !/어디서 시작할까/.test(await appTxt()));
check("표시가 없어도 책이 어느 쪽에서 열려 있다", (await page.locator("#app h2").count()) >= 1);
check("그 쪽에 담을 책이 서 있다", (await page.locator("#app .mark .mark-main").count()) >= 1);
check("왜 지금 이 쪽인지 말한다", /이번 주에 열린 쪽|열린다|뿌리다|곁이다/.test(await appTxt()));

// 도감 계수 — 분모는 지도고 퍼센트는 절망이다(3,752 중 3 = 0.08%). 연속일은 강요.
// "만난 작가 N / 전체"는 있고, %·연속·목표·달성 문구는 없다 (2026-09-04 개정 규칙).
const census = await page.locator(".census").innerText();
check("도감 계수가 만난 수와 전체를 말한다", /만난 작가\s*\d+\s*\/\s*\d+/.test(census), census.replace(/\n/g, " "));
check("연속일·퍼센트·목표 문구가 없다 — 분모는 있다", !/%|목표|연속|남았|달성/.test(census) && /\/\s*\d/.test(census));

// 표시 하나가 세계를 켠다 — 준비도 엔진의 핵심 주장
// 한 번 누르면 관심 있는 책이다 — 사다리를 열 줄 몰라도 표시는 남는다.
await page.locator("#app .mark .mark-main").first().click();
const oneTap = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("lp.reader.v3") ?? "{}").state ?? {}).map((m) => m.s).join(","));
check("한 번 누르면 「관심 있는 책」이 된다", oneTap === "want", oneTap);
await setMark(page.locator("#app .mark").first(), "read");
await page.waitForTimeout(300);
const readerLit = await page.evaluate(() => {
  try {
    const p = JSON.parse(localStorage.getItem("lp.reader.v3") ?? "null");
    return Object.keys(p?.state ?? {}).length;
  } catch {
    return -1;
  }
});
check("표시가 작품 id 로 남는다", readerLit === 1, `표시 ${readerLit}`);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1400);
const after = await page.locator(".census").innerText();
check("읽은 뒤에는 만난 수가 오른다", /만난 작가\s*[1-9]/.test(after), after.replace(/\n/g, " "));
check("읽은 것이 다음 것을 연다 — 지금 열린 쪽이 생긴다", /지금 열린 쪽\s*\d+/.test(after), after.replace(/\n/g, " "));
const openedTxt = await appTxt();
// 네 문장뿐이고 넷은 서로 다른 근거다 — 셋은 출처 있는 엣지, 넷째는 좌표의 교차.
// 어느 주냐에 따라 셋 중 하나이거나 넷째다(세 주에 한 주는 이웃의 주).
check(
  "연 이유가 사람 이름으로 말해진다",
  /읽었으니 이제 열린다|의 뿌리다|의 곁이다|같은 때, 같은 자리에 있었다/.test(openedTxt),
  (openedTxt.match(/.{0,24}(열린다|뿌리다|곁이다|있었다)/) ?? [""])[0]
);

// 문해의 지도 — 도감의 "박사"는 모은 개수가 아니라 열린 영역이다.
check("문해의 지도가 접힌 채로 있다", (await page.locator("details.literacy").count()) === 1);
await page.locator(".literacy summary").click();
await page.waitForTimeout(200);
const meters = await page.locator(".meters li").count();
check("권역과 시대로 나뉜다", meters >= 10, `${meters}행`);
const litTxt = await page.locator(".literacy").innerText();
check("점수가 아니라 지도라고 말한다", /지도 없이 읽을 수 있는지/.test(litTxt));
check("읽은 권역이 채워진다", /\b1\/\d+/.test(litTxt), litTxt.split("\n").slice(4, 6).join(" "));
await page.evaluate(() => localStorage.clear());

// ─── 도감 지키기 (결정 (136)) — 로그인은 관문이 아니다 ─────────────────────
console.log("\n도감 지키기");
await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
await page.waitForTimeout(400);
check("로그인 상자가 모듈에 의해 채워진다 (비로그인 = 이메일 폼)", (await page.locator("#lp-auth form#lp-login input[type=email]").count()) === 1);
// 접혀 있다 — 모든 쪽 바닥의 글자 예산을 로그인이 먹지 않는다. 사람이 하듯 펼치고 잰다.
check("로그인 상자는 접힌 한 줄이다", (await page.locator("#lp-auth details.auth-d:not([open])").count()) === 1);
await page.locator("#lp-auth summary").click();
check("비로그인이어도 상태 칸은 그대로 동작한다 — 로컬이 먼저다", (await page.locator(".mark.big .mark-main").count()) === 1);
const authTxt = await page.locator("#lp-auth").innerText();
check("저장되는 것이 무엇인지 한 줄로 말한다", /어떤 책을 어느 칸에/.test(authTxt) && /언제/.test(authTxt));
check("모듈 로드에 콘솔 에러 없음", errors.length === 0, errors.slice(0, 2).join(" | "));
// 매직링크는 이 쪽으로 돌아와야 한다. GoTrue 는 돌아올 주소를 쿼리(redirect_to)에서만 읽는다 — 본문에만 두면 토큰이
// 이 Supabase 프로젝트의 Site URL(다른 앱)로 갈 수 있었다(2026-09-23 감사). 실제 서버는 부르지 않고 가로챈다.
{
  let otpUrl = "";
  await page.route("**/auth/v1/otp**", (r) => { otpUrl = r.request().url(); r.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
  await page.locator("#lp-login input[type=email]").fill("reader@example.org");
  await page.locator("#lp-login button[type=submit]").click();
  await page.waitForTimeout(300);
  const rt = new URL(otpUrl || "http://x/").searchParams.get("redirect_to") ?? "";
  check("매직링크 요청이 돌아올 쪽을 redirect_to 로 보낸다", rt.endsWith("/works/franz-kafka--die-verwandlung/"), rt || "(redirect_to 없음)");
  await page.unroute("**/auth/v1/otp**");
  // 기본 메일러가 팀 밖 주소를 거절하면, 서버 원문(JSON)이 아니라 사람의 문장으로 말한다.
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(300);
  await page.locator("#lp-auth summary").click();
  await page.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 400, contentType: "application/json", body: '{"code":400,"error_code":"email_address_not_authorized","msg":"Email address reader@example.org not authorized"}' }));
  await page.locator("#lp-login input[type=email]").fill("reader@example.org");
  await page.locator("#lp-login button[type=submit]").click();
  await page.waitForTimeout(300);
  const refusal = await page.locator("#lp-auth").innerText();
  check("메일 발송 거절을 원문 없이 사람의 말로 전한다", /보낼 수 없다/.test(refusal) && !/\{|error_code|not authorized/.test(refusal), refusal.slice(0, 60));
  await page.unroute("**/auth/v1/otp**");
  // 토큰이 있다는 것은 도감이 서버에 있다는 뜻이 아니다 — 서버가 거절하면 그렇다고 말한다.
  await page.evaluate(() => localStorage.setItem("lp.session.v1", JSON.stringify({ access_token: "x", refresh_token: "y", expires_at: Date.now() + 3600e3 })));
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 401, contentType: "application/json", body: '{"message":"JWT invalid"}' }));
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(600);
  const syncTxt = await page.locator("#lp-auth").innerText();
  check("서버가 거절하면 「서버에도 있다」고 말하지 않는다", !/서버에도 있다/.test(syncTxt) && /닿지 못했다/.test(syncTxt), syncTxt.slice(0, 50));
  await page.unroute("**/rest/v1/**");
  await page.evaluate(() => localStorage.clear());
}

// ─── 준비도 배지 — 스포티파이가 못 쓰는 문장 ─────────────────────────────
// "이 책은 당신이 읽은 것에 대한 답이다." 유사성이 아니라 선행 조건이고, 근거는
// 우리 관계 원장에 출처와 함께 있다. 사용자 0명에서도 돈다.
console.log("\n준비도");
await page.goto(`${server.origin}/authors/gabriel-garcia-marquez/`, { waitUntil: "load" });
await page.waitForTimeout(900);
check("아무것도 안 읽었으면 배지가 없다 — 추측하지 않는다", !(await page.locator("#lp-ready").isVisible()));

await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
await page.waitForTimeout(300);
await setMark(page.locator(".mark.big"), "read");
await page.waitForTimeout(250);
check("찍힌 자리가 보인다 — 칸의 글자가 바뀐다", /읽은 책/.test(await page.locator(".mark.big .mark-label").innerText()));
// 2026-09-23 독자 걸음: 표시 전 = 검은 단추, 표시 후 = 옅은 테두리 — 뒤집혀 읽혔다. 표시된 것은 인주색이다.
const stampBg = await page.locator(".mark.big .mark-main").evaluate((b) => getComputedStyle(b).backgroundColor);
check("표시된 칸은 인주색으로 찍힌다", stampBg === "rgb(180, 39, 27)", stampBg);
await page.goto(`${server.origin}/authors/gabriel-garcia-marquez/`, { waitUntil: "load" });
await page.waitForTimeout(1100);
const badge = await page.locator("#lp-ready").innerText();
check("읽은 뒤에는 왜 열렸는지 사람 이름으로 말한다", /카프카를 읽었으니 이제 열린다/.test(badge), badge.slice(0, 60));
check("그 이유가 관계 원장의 실제 문장이다", badge.length > 60, `${badge.length}자`);

await page.goto(`${server.origin}/authors/franz-kafka/`, { waitUntil: "load" });
await page.waitForTimeout(900);
check("이미 만난 사람에게는 열 것이 없다고 말한다", /이미 만난 사람/.test(await page.locator("#lp-ready").innerText()));
await page.evaluate(() => localStorage.clear());

// ─── 작가 페이지: 정보 폭탄 상한 ─────────────────────────────────────────────
// 예산은 3D 카드에서 물려받은 880자가 아니다. 그 수는 패널의 수였고 페이지에는
// 근거가 없다. 페이지의 예산은 여기서 새로 정한다: **접힌 것을 뺀 그려진 글자**.
console.log("\n작가 페이지 — 그려진 글자 예산");
// 표본은 거짓말한다. 5인을 재면 최악이 1,437자로 보이지만 100인을 재면 1,708자다
// — 그래서 **전수**로 잰다. 상한은 오늘의 실측 최댓값 바로 위에 못 박은 래칫이고,
// 값은 내려갈 수만 있다.
const BUDGET = 1750;
// 전수는 **배포본 디렉토리**에서 센다. sitemap 에서 뽑던 시절 sitemap 이 도판만 담게 되자
// 이 계약이 조용히 100인으로 줄었다 — 스케치 1,611쪽이 안 재진 채 초록이었다.
const ids = readdirSync(new URL("../dist/authors/", import.meta.url))
  .filter((n) => !n.endsWith(".html"));
const corpusSize = (await (await fetch(`${server.origin}/graph.json`)).json()).authors.length;
check("예산은 전수를 잰다 — 코퍼스 크기와 같다", ids.length === corpusSize, `${ids.length} / ${corpusSize}`);
const measured = [];
for (const id of ids) {
  await page.goto(`${server.origin}/authors/${id}/`, { waitUntil: "load" });
  measured.push([id, await visible()]);
}
measured.sort((a, b) => a[1] - b[1]);
const n = measured.length;
const avg = Math.round(measured.reduce((s, m) => s + m[1], 0) / n);
const over = measured.filter((m) => m[1] > BUDGET);
check(
  `그려진 글자 ≤ ${BUDGET}자 — 작가 ${n}인 전수`,
  n > 0 && over.length === 0,
  `평균 ${avg} · 중앙값 ${measured[Math.floor(n / 2)][1]} · 최대 ${measured[n - 1][1]} (${measured[n - 1][0]})`
);

await page.goto(`${server.origin}/authors/james-joyce/`, { waitUntil: "load" });
const relShown = await page.locator("ul.rels > li:visible").count();
check("펼쳐진 관계는 하나다", relShown === 1, `보이는 관계 ${relShown}`);
const folds = await page.locator("details").count();
check("나머지는 접혀 있다", folds >= 1, `접힘 ${folds}`);
await page.locator("details > summary").first().click();
await page.waitForTimeout(120);
check("접힘은 열린다 — 기록은 사라지지 않았다", (await page.locator("ul.rels > li:visible").count()) > 1);

// ─── 작품 페이지: 구하기(판본 레이어) ────────────────────────────────────────
console.log("\n작품 페이지 — 구하기");
await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
const acq = (await page.locator("h2", { hasText: "구하기" }).count()) > 0;
check("구하기 블록이 선다", acq);
const body = await page.evaluate(() => document.body.innerText);
const hasRecord = (await page.locator("table.eds tbody tr").count()) > 0;
if (hasRecord) {
  check("검수된 판본은 ISBN 상품 주소로 나간다", (await page.locator('a[href*="wproduct.aspx?ISBN="]').count()) > 0);
  // 저본 칸이 비면 "원서"와 "모른다"가 같은 모양이다 — 독자가 번역을 고르는 단 하나의 칸이다.
  const flags = await page.locator("table.eds td.flag").allInnerTexts();
  check("저본 칸은 한 칸도 비지 않는다", flags.length > 0 && flags.every((t) => t.trim().length > 0), flags.join(" · "));
  // 역자 이력에서 미룬 판정은 단정하지 않는다 — 김연경 『죄와 벌』(민음사)은 판본 확인에서 역자 이력으로 판정했다(2026-09-24).
  await page.goto(`${server.origin}/works/fyodor-dostoevsky--prestuplenie-i-nakazanie/`, { waitUntil: "load" });
  const row = await page.locator("table.eds tr.ed", { hasText: "9788937462849" }).innerText().catch(() => "");
  check("이력으로 미룬 저본 판정은 「추정」이라고 적는다", /원전 직역 추정/.test(row), row.replace(/\s+/g, " ").slice(0, 70));
  await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
} else {
  check("판본이 없으면 없다고 날짜와 함께 적는다", /아직 검수하지 않았다 \(\d{4}-\d{2}-\d{2} 기준\)/.test(body));
  check("판본을 주장하지 않는다 — 상품 딥링크 0", (await page.locator('a[href*="wproduct.aspx"]').count()) === 0);
  check("그래도 문은 열린다 — 검색 링크 3", (await page.locator('.doors a[href^="https://"]').count()) >= 3);
}
check("증언 블록이 살아 있다", body.includes("증언"));
// 증언은 뒤의 작가가 이 책을 지목한 것뿐이다. 『인간 실격』에 도스토옙스키를 「증언」으로 세우던 것은 방향이 거꾸로였다
// (2026-09-23 감사: 190건 중 참된 증언 57). 뿌리와 곁은 「이 책에 이어진 사람」에 선다.
{
  await page.goto(`${server.origin}/works/osamu-dazai--ningen-shikkaku/`, { waitUntil: "load" });
  const heads = await page.locator("h2.side").allInnerTexts();
  check("『인간 실격』에 도스토옙스키는 증언이 아니라 이어진 사람이다", !heads.some((h) => /증언/.test(h)) && heads.some((h) => /이 책에 이어진 사람/.test(h)), heads.join(" | "));
  await page.goto(`${server.origin}/works/fyodor-dostoevsky--prestuplenie-i-nakazanie/`, { waitUntil: "load" });
  const wit = await page.locator("section.row", { has: page.locator("h2", { hasText: "증언" }) }).innerText().catch(() => "");
  check("『죄와 벌』의 증언은 이 책을 지목한 뒤의 작가다 — 다자이", /다자이/.test(wit), wit.split("\n").slice(0, 2).join(" "));
}
// 2026-09-23 견고성 심사: 긴 출판사 이름(nowrap)이 판본 있는 556쪽 중 28쪽을 옆으로 끌었다 — 최악 다섯을 손 안 폭에서 잰다.
{
  const ctx375 = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "ko-KR" });
  const p375 = await ctx375.newPage();
  const worst = ["william-shakespeare--sonnets", "ts-eliot--the-waste-land", "henry-lawson--the-drovers-wife", "roald-dahl--charlie-and-the-chocolate-factory", "jrr-tolkien--the-hobbit"];
  const over = [];
  for (const id of worst) {
    const res = await p375.goto(`${server.origin}/works/${id}/`, { waitUntil: "load" });
    if (!res || res.status() !== 200) { over.push(`${id}: HTTP ${res?.status()}`); continue; }
    const ov = await p375.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 0) over.push(`${id}: +${ov}px`);
  }
  check("긴 출판사 이름도 손 안에서 줄을 바꾼다 — 옆으로 새는 쪽 0", over.length === 0, over.join(" · ") || `${worst.length}쪽 모두 0`);
  await p375.goto(`${server.origin}/works/flannery-oconnor--mystery-and-manners/`, { waitUntil: "load" });
  const pubs = await p375.locator("table.eds td.pub").allInnerTexts();
  check("출판사 칸에 목록의 찌꺼기(주소·괄호)가 없다", pubs.length > 0 && pubs.every((t) => !/^[\(\[]/.test(t) && !/WC1N/.test(t)), pubs.join(" · "));
  await ctx375.close();
}

// ─── 죽은 표면으로 가는 링크가 없다 ──────────────────────────────────────────
console.log("\n철거 확인");
// 철거는 dist 에서도 철거여야 한다. 첫 배포에서 이것이 거짓이었다 — 생성기가
// 출력을 비우지 않아 은퇴한 진입점이 dist 에 남은 채 함께 올라갔고, 프로덕션의
// /universe.html 이 옛 앱을 반환했다. 링크가 없는 것과 파일이 없는 것은 다르다.
//
// 주의 — **프로덕션에서 200 은 증거가 아니다**: Cloudflare Pages 는 없는 경로에
// 404 대신 `index.html` 을 돌려준다. 그래서 배포 확인은 상태 코드가 아니라
// **돌아온 제목**으로 한다. 여기(로컬 serve.mjs)는 404 를 돌려주므로 파일의
// 부재를 그대로 잰다.
for (const gone of ["/universe.html", "/chart.html", "/assets/main-oOTPV1Du.js"]) {
  const res = await fetch(`${server.origin}${gone}`);
  check(`${gone} 는 배포본에 없다`, res.status === 404, `HTTP ${res.status}`);
}
for (const p of ["/", "/authors/", "/authors/franz-kafka/", "/works/franz-kafka--die-verwandlung/"]) {
  await page.goto(`${server.origin}${p}`, { waitUntil: "load" });
  const dead = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && (h.includes("universe.html") || h.includes("chart.html")))
  );
  check(`${p} 에 죽은 표면 링크 0`, dead.length === 0, dead.join(" "));
}

// ─── 격자 도달성 ────────────────────────────────────────────────────────────
// "세계는 처음부터 전부 여기 있다"는 걸어서 닿을 때만 참이다. 배포본의 격자 링크를
// 그대로 읽어 도판 100인에서 출발해 전원에 닿는지 잰다. 실측 이력: 겹침만 → 529명 섬,
// 연대순 사슬 → 3명, 얇은 권역을 채우자 59명(전원 동남아 — 사람을 채워도 섬은 섬),
// 권역 인접 다리 → 0. 이 수는 파이프라인에서만 알 수 있고 브라우저 계약이 지킨다.
console.log("\n격자 — 걸어서 전원에 닿는다");
{
  const { readFileSync } = await import("node:fs");
  const dir = new URL("../dist/authors/", import.meta.url);
  const g = JSON.parse(readFileSync(new URL("../dist/graph.json", import.meta.url), "utf8"));
  const depth = new Map(g.authors.map((a) => [a.i, a.d]));
  const und = new Map();
  const link = (a, b) => { (und.get(a) ?? und.set(a, new Set()).get(a)).add(b); (und.get(b) ?? und.set(b, new Set()).get(b)).add(a); };
  for (const id of readdirSync(dir).filter((n) => !n.endsWith(".html"))) {
    const html = readFileSync(new URL(`${id}/index.html`, dir), "utf8");
    const m = html.match(/<details class="near">([\s\S]*?)<\/details>/);
    if (!m) continue;
    for (const [, to] of m[1].matchAll(/href="\/authors\/([^/"]+)\/"/g)) link(id, to);
  }
  const seen = new Set([...depth].filter(([, d]) => d === "plate").map(([i]) => i));
  let q = [...seen], hops = 0;
  while (q.length) { const nx = []; for (const x of q) for (const y of und.get(x) ?? []) if (!seen.has(y)) { seen.add(y); nx.push(y); } q = nx; if (nx.length) hops++; }
  const iso = [...depth.keys()].filter((i) => !seen.has(i));
  check("도판에서 격자로 전원에 닿는다", iso.length === 0, `${seen.size}/${depth.size} · 못 닿음 ${iso.length}${iso.length ? " (" + iso.slice(0, 3).join(", ") + ")" : ""}`);
  check("가장 먼 사람도 30홉 안이다", hops <= 30, `최장 ${hops}홉`);
}

// ─── 색인 허가 ───────────────────────────────────────────────────────────────
// 색인은 SEO 의 문제이지 탐험의 문제가 아니다. 스케치 1,363명의 한 문장은 아직 아무도
// 검증하지 않았고, 그것을 검색엔진에 사실이라고 제출하지는 않는다.
console.log("\n색인 허가 — 검토된 것만 제출한다");
{
  const robots = async (p) => {
    const h = await (await fetch(`${server.origin}${p}`)).text();
    return /name="robots" content="noindex/.test(h);
  };
  // 검토는 깊이가 아니다 — 검토된 도판은 색인되고, 검토 전 도판(원장 재심 중)은 색인되지 않는다. 예시는 데이터에서 고른다
  // (카프카를 박아 두었더니 재심으로 draft 가 되자 계약이 거짓말했다).
  const { readFileSync: rf, readdirSync: rd } = await import("node:fs");
  const AU = rd(new URL("../data/authors/", import.meta.url)).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(rf(new URL(`../data/authors/${f}`, import.meta.url), "utf8")));
  const revPlate = AU.find((a) => (a.depth ?? "plate") === "plate" && a.reviewStatus !== "draft");
  const draftPlate = AU.find((a) => (a.depth ?? "plate") === "plate" && a.reviewStatus === "draft");
  check("검토된 도판 작가 쪽은 색인된다", (await robots(`/authors/${revPlate.id}/`)) === false, revPlate.id);
  check("검토 전 도판 작가 쪽은 색인하지 않는다", await robots(`/authors/${draftPlate.id}/`), draftPlate.id);
  check("스케치 작가 쪽은 색인하지 않는다", await robots("/authors/qu-yuan/"));
  check("검토된 도판의 작품 쪽은 색인된다", (await robots(`/works/${revPlate.readingEntry}/`)) === false, revPlate.readingEntry);
  check("실루엣 작품 쪽은 색인하지 않는다", await robots("/works/qu-yuan--lisao/"));
  check("색인과 첫 장은 색인된다", (await robots("/authors/")) === false && (await robots("/")) === false);
  const sm = await (await fetch(`${server.origin}/sitemap.xml`)).text();
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("sitemap 이 검토되지 않은 쪽을 제출하지 않는다", !locs.some((u) => u.includes("/authors/qu-yuan/")), `${locs.length} urls`);
  // 검토된 작가는 전부 제출한다 — 수는 첫 장 푸터가 찍는 검토 수와 같아야 한다(100 으로 박아 두면
  // 검토가 늘 때마다 계약이 거짓말한다).
  const indexHtml = await (await fetch(`${server.origin}/`)).text();
  const reviewedN = Number((indexHtml.match(/검토 ([\d,]+)/) ?? [])[1]?.replace(/,/g, ""));
  const smAuthors = locs.filter((u) => /\/authors\/[^/]+\/$/.test(u)).length;
  check("검토된 작가는 전부 제출한다 — 푸터의 검토 수와 같다", reviewedN > 0 && smAuthors === reviewedN, `sitemap ${smAuthors} · 푸터 ${reviewedN}`);
  // 한 사람(굴원)만 보는 계약은 필터가 "검토됨"에서 "도판"으로 바뀌어도 초록이었다(2026-09-23 변이 실측 — draft 인
  // 아리스토텔레스가 제출됐다). 배포본 전수를 양방향으로 대조한다: 제출된 쪽은 noindex 가 아니고, noindex 가 아닌 쪽은
  // (canonical 이 자기 자신이면) 제출돼 있다.
  {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const DIST = new URL("../dist/", import.meta.url).pathname;
    const pathOf = (u) => new URL(u).pathname;
    const inMap = new Set(locs.map(pathOf));
    const submittedNoindex = [], indexableMissing = [];
    (function walk(dir, rel) {
      for (const n of readdirSync(dir)) {
        const f = join(dir, n);
        if (statSync(f).isDirectory()) { walk(f, rel + n + "/"); continue; }
        if (n !== "index.html") continue;
        const h = readFileSync(f, "utf8");
        const noindex = /name="robots" content="noindex/.test(h);
        const canon = (h.match(/rel="canonical" href="([^"]+)"/) ?? [])[1];
        if (inMap.has(rel) && noindex) submittedNoindex.push(rel);
        if (!noindex && canon && pathOf(canon) === rel && !inMap.has(rel)) indexableMissing.push(rel);
      }
    })(DIST, "/");
    check("sitemap 에 제출된 쪽은 하나도 noindex 가 아니다", submittedNoindex.length === 0, submittedNoindex.slice(0, 3).join(" ") || `${inMap.size} urls`);
    check("색인되는 쪽은 전부 sitemap 에 있다", indexableMissing.length === 0, indexableMissing.slice(0, 3).join(" ") || "누락 0");
  }
  // 사람은 여전히 걸어 들어온다 — noindex 는 탐험을 막지 않는다
  await page.goto(`${server.origin}/authors/`, { waitUntil: "load" });
  await page.locator("#q").fill("굴원");
  await page.waitForTimeout(120);
  check("색인하지 않는 쪽도 사람은 찾을 수 있다", (await page.locator(".idx > li:not([hidden])").count()) >= 1);
}

// ─── 첫 장의 무게 ────────────────────────────────────────────────────────────
// 캡슐이 HTML 에 박혀 있을 때 첫 장은 압축 후 214KB 였고, 한 사람을 보러 온 사람이
// 1,465명분을 매 방문 다시 받았다. 주에 한 번 오는 제품에서 그것이 재방문 전체다.
console.log("\n첫 장 — 한 사람을 보러 온 사람에게 1,465명을 보내지 않는다");
{
  const res = await fetch(`${server.origin}/`);
  const html = await res.text();
  check("첫 장 HTML 이 40KB 아래다", html.length < 40000, `${Math.round(html.length / 1024)}KB`);
  const m = html.match(/\/walk-[0-9a-f]{10}\.json/);
  check("캡슐은 내용 해시가 이름인 별도 파일이다", Boolean(m), m?.[0] ?? "(없음)");
  const cap = await fetch(`${server.origin}${m[0]}`);
  check("그 파일이 실제로 선다", cap.ok, `HTTP ${cap.status}`);
  // 첫 방문 독자(표시 없음)는 이번 주의 한 사람만 받는다 — 그래프(수백 KB)도 이름 색인도 입력 전에는 받지 않는다.
  // 2026-09-23 실측: 캡슐 1.2MB + 그래프 605KB 를 먼저 받아 느린 망에서 첫 쪽이 13초 뒤에 떴다.
  {
    const got = [];
    const on = (r) => { const u = r.url(); if (/\.json(\?|$)/.test(u)) got.push(u.replace(server.origin, "")); };
    await page.evaluate(() => localStorage.clear());
    page.on("request", on);
    await page.goto(`${server.origin}/`, { waitUntil: "networkidle" });
    page.off("request", on);
    const heavy = got.filter((u) => /graph\.json|\/walk-[0-9a-f]+\.json/.test(u));
    check("첫 방문 독자는 입력 전에 그래프도 이름 색인도 받지 않는다 — 한 사람의 캡슐뿐", heavy.length === 0 && got.some((u) => /^\/walk\/[a-z0-9-]+\.json$/.test(u)), got.join(" "));
    check("그래도 이번 주의 쪽이 선다", (await page.locator("#app h2").count()) === 1 && /이번 주에 열린 쪽/.test(await page.locator("#app").innerText()));
  }
  // 캡슐을 못 받는 날에도 빈 화면을 주지 않는다
  await page.route("**/walk/**", (r) => r.abort());
  await page.route("**/walk-*.json", (r) => r.abort());
  await page.goto(`${server.origin}/`, { waitUntil: "load" });
  await page.waitForTimeout(700);
  const fallback = await page.locator("#app").innerText();
  check("캡슐을 못 받아도 빈 화면이 아니다", /책을 펴지 못했다/.test(fallback), fallback.slice(0, 40));
  check("그 문장이 나갈 문을 준다", (await page.locator("#app a[href='/authors/']").count()) === 1);
  await page.unroute("**/walk-*.json");
  await page.unroute("**/walk/**");
}

// ─── 서재 ────────────────────────────────────────────────────────────────────
// 도감은 모으는 것이고, 모은 것을 볼 자리가 없으면 표시는 그냥 사라진다.
console.log("\n서재 — 표시한 것이 모이는 자리");
await page.goto(`${server.origin}/shelf/`, { waitUntil: "load" });
await page.waitForTimeout(600);
// 「아직 아무것도 표시하지 않았다」는 우리가 알 수 없다 — 다른 브라우저에서 했거나 이 브라우저가 지웠을 수 있다.
check("아무 표시도 없으면 빈 목록이 아니라 문장이 선다 — 이 브라우저에 없다고만", /이 브라우저에는 아직 표시가 없다/.test(await page.locator("#shelf").innerText()));
await page.evaluate(() => {
  const now = Date.now();
  localStorage.setItem("lp.reader.v3", JSON.stringify({ v: 3, state: {
    "franz-kafka--die-verwandlung": { s: "read", at: now },
    "qu-yuan--lisao": { s: "want", at: now - 1000 },
    "orhan-pamuk--kar": { s: "have", at: now - 2000 }
  }}));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
const shelfTxt = await page.locator("#shelf").innerText();
check("표시한 책이 제목으로 선다", /변신/.test(shelfTxt) && /이소/.test(shelfTxt) && /눈/.test(shelfTxt), shelfTxt.split("\n")[1]);
check("칸별로 나뉜다 — 사다리가 목록이 된다", /읽은 책 1/.test(shelfTxt) && /구매한 책 1/.test(shelfTxt) && /관심 있는 책 1/.test(shelfTxt));
check("기원전이 기원전으로 적힌다", /기원전 300/.test(shelfTxt) && !/-300/.test(shelfTxt));
check("전체 대비를 말한다 — 도감이다", /3권 \/ \d{3,}/.test(await page.locator("#shelf-sum").innerText()), await page.locator("#shelf-sum").innerText());
const shelfLinks = await page.evaluate(() => [...document.querySelectorAll("#shelf a")].map((a) => a.getAttribute("href")));
check("각 책이 그 작품 쪽으로 나간다", shelfLinks.length === 3 && shelfLinks.every((h) => h.startsWith("/works/")), shelfLinks.join(" "));
// 표시할 때 들은 제목이 있으면 사전(works.json)을 받지 않고도 첫 화면이 선다 — 2026-09-23 심사가 잡은
// "표시한 책이 있는데 비어 있다고 먼저 말하는" 깜빡임의 반대 증명: 사전을 끊어도 제목이 선다.
await page.evaluate(() => localStorage.setItem("lp.shelf.v1", JSON.stringify({
  "franz-kafka--die-verwandlung": ["변신", 1915, "프란츠 카프카"],
  "qu-yuan--lisao": ["이소", -300, "굴원"],
  "orhan-pamuk--kar": ["눈", 2002, "오르한 파묵"]
})));
await page.route("**/works.json", (r) => r.abort());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
const heardTxt = await page.locator("#shelf").innerText();
check("사전을 못 받아도 표시한 책은 제목으로 선다 — 표시할 때 들었다", /변신/.test(heardTxt) && /이소/.test(heardTxt) && /눈/.test(heardTxt) && !/아직 아무것도/.test(heardTxt), heardTxt.split("\n").slice(0, 3).join(" / "));
await page.unroute("**/works.json");
// 서재는 읽기 전용이 아니다 — 「구매한 책」을 「읽은 책」으로 옮기는 자리가 바로 여기다.
await setMark(page.locator('#shelf .mark[data-work="orhan-pamuk--kar"]'), "read");
await page.waitForTimeout(300);
const moved = await page.locator("#shelf").innerText();
check("서재에서 칸을 옮기면 선반이 다시 짜인다", /읽은 책 2/.test(moved) && !/구매한 책 \d/.test(moved), (moved.match(/(읽은|구매한|관심 있는) 책 \d/g) ?? []).join(" · "));
await page.evaluate(() => { localStorage.removeItem("lp.reader.v3"); localStorage.removeItem("lp.shelf.v1"); });

// ─── 색인의 찾기 ─────────────────────────────────────────────────────────────
// 100인일 때 색인은 한 화면이었다. 1,465인에서는 스크롤이고, 스크롤은 CPO 가 3D
// 정문에서 이미 기각한 것이다 — "탐색 자체가 거의 불가능하다".
console.log("\n색인 — 1,465인에서 이름을 찾는다");
await page.goto(`${server.origin}/authors/`, { waitUntil: "load" });
const visibleRows = () => page.locator(".idx > li:not([hidden])").count();
const allRows = await page.locator(".idx > li").count();
check("색인이 전원을 정적으로 담는다", allRows >= 1400, `${allRows}행`);
await page.locator("#q").fill("카프카");
await page.waitForTimeout(120);
const kafka = await visibleRows();
check("이름을 치면 그 이름만 남는다", kafka >= 1 && kafka <= 5, `${kafka}인`);
check("남은 것이 실제로 그 사람이다", /카프카/.test(await page.locator(".idx > li:not([hidden])").first().innerText()));
await page.locator("#q").fill("변신");
await page.waitForTimeout(120);
const byTitle = await page.locator(".idx > li:not([hidden])").count();
check("책 제목으로도 그 작가를 찾는다", byTitle >= 1 && byTitle <= 20, `${byTitle}인`);
// 첫 행이 아니라 "결과 안에" — 『변신 이야기』(오비디우스)도 정직하게 나온다.
check("그 작가들 중에 카프카가 있다", /카프카/.test(await page.locator(".idx > li:not([hidden])").allInnerTexts().then((a) => a.join(" "))));
check("제목으로 걸린 사람은 어느 제목인지 보인다 — 오비디우스 옆에 『변신 이야기』", /『변신 이야기』/.test(await page.locator(".idx > li:not([hidden])").allInnerTexts().then((a) => a.join(" "))));
await page.locator("#q").fill("Sappho");
await page.waitForTimeout(120);
check("원어·로마자로도 찾는다", (await visibleRows()) >= 1, `${await visibleRows()}인`);
await page.locator("#q").fill("");
await page.locator("#fr").selectOption("east-asia");
await page.waitForTimeout(120);
const ea = await visibleRows();
check("권역으로 좁힌다", ea > 10 && ea < allRows, `동아시아 ${ea}인`);
await page.locator("#fp").selectOption("antiquity-medieval");
await page.waitForTimeout(120);
const eaAnc = await visibleRows();
check("시대와 함께 좁힌다 — 두 조건은 곱해진다", eaAnc > 0 && eaAnc < ea, `동아시아·고대 ${eaAnc}인`);
await page.locator("#q").fill("zzzzz");
await page.waitForTimeout(120);
check("하나도 없으면 절 제목까지 접는다", (await page.locator(".idx:not([hidden])").count()) === 0);
check("하나도 없으면 빈 화면이 아니라 문장이 선다 — 큰 제목의 수도 0 이다", /맞는 이름이 없다/.test(await page.locator("#none").innerText()) && (await page.locator("#none").isVisible()) && (await page.locator(".index-head .n").innerText()).trim() === "0");
await page.goto(`${server.origin}/authors/?q=${encodeURIComponent("카프카")}`, { waitUntil: "load" });
await page.waitForTimeout(150);
check("첫 장의 문이 넘긴 이름(?q=)으로 색인이 바로 좁혀진다", (await page.locator("#q").inputValue()) === "카프카" && (await visibleRows()) >= 1 && (await visibleRows()) <= 5);
// 색인 검색칸의 지우기 단추는 브라우저 기본 파랑이었다 — 사이트에서 유일한 팔레트 밖 색. 계산 스타일은 가짜
// 요소를 답하지 않으므로 그려진 픽셀을 센다: 칸의 오른쪽 끝에 무언가 그려져 있고(단추가 있다), 파란 픽셀은 0.
{
  // 프로그램으로 넣은 값에는 크롬이 지우기 단추를 그리지 않는다 — 사람처럼 친다.
  await page.locator("#q").fill("카프카");
  await page.waitForTimeout(150);
  const box = await page.locator("#q").boundingBox();
  const png = decodePng(await page.screenshot({ clip: box }));
  const strip = (pred) => { let n = 0; for (let y = 0; y < png.height; y++) for (let x = Math.max(0, png.width - 44); x < png.width; x++) { const [r, g, b] = png.at(x, y); if (pred(r, g, b)) n++; } return n; };
  const drawn = strip((r, g, b) => Math.abs(r - 0xf7) + Math.abs(g - 0xf0) + Math.abs(b - 0xdc) > 60 && Math.abs(r - 0xf0) + Math.abs(g - 0xe7) + Math.abs(b - 0xcd) > 60);
  // 단추가 있는 오른쪽 띠만 센다. 칸 전체를 세면 운영체제마다 다른 글자 안티앨리어싱까지 파랑으로 잡힌다(CI 리눅스 78 픽셀).
  const blue = strip((r, g, b) => b > r + 30 && b > g + 20);
  check("검색칸 지우기 단추가 팔레트 안에 있다 — 그려져 있고, 파란 픽셀 0", drawn > 20 && blue === 0, `그려진 픽셀 ${drawn} · 단추 띠의 파란 픽셀 ${blue}`);
}

// ─── 밖으로 나가지 않는다 ─────────────────────────────────────────────────────
// 이 제품은 독자의 표시를 밖으로 내보내지 않는다고 말한다. 폰트 CDN 한 줄이면 그 말이
// 모든 쪽에서 반만 참이 된다 — 독자의 IP 가 매 방문 제3자에게 간다.
console.log("\n제3자 — 한 곳도 부르지 않는다");
{
  const seen = [];
  const onReq = (r) => seen.push(r.url());
  page.on("request", onReq);
  for (const path of ["/", "/authors/", "/authors/franz-kafka/", "/works/franz-kafka--die-verwandlung/"]) {
    await page.goto(`${server.origin}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(400);
  }
  page.off("request", onReq);
  const outside = [...new Set(seen.filter((u) => !u.startsWith(server.origin) && !u.startsWith("data:")))];
  check("네 쪽 어디도 제3자를 부르지 않는다", outside.length === 0, outside.slice(0, 4).join(" "));
  await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").length;
  });
  check("본문 활자가 실제로 실려 있다", faces > 0, `${faces} 페이스`);
  const sharp = await page.evaluate(() => document.body.innerText.includes("Weißen"));
  check("라틴 확장 글자가 제 모양으로 온다 — ß", sharp);
  // 2026-09-23 실측: 색인 한 쪽이 Google 서브셋 78조각 4.1MB 를 받았다. 이제 전집 한 벌(두 굵기)이다 —
  // 전집 밖 글자는 조각으로 떨어져도 된다(깨지지 않고 느려질 뿐). 그래서 조각 수가 아니라 바이트를 잰다.
  const fontBytes = async (path) => {
    const got = [];
    const on = (r) => { if (r.url().includes("/fonts/")) got.push(r); };
    page.on("response", on);
    await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
    page.off("response", on);
    let n = 0; for (const r of got) n += (await r.body().catch(() => Buffer.alloc(0))).length;
    return { files: got.length, kb: Math.round(n / 1024), subset: got.filter((r) => /\/fonts\/nskr-/.test(r.url())).length };
  };
  const fx = await fontBytes("/authors/");
  check("색인이 받는 활자는 1MB 아래다 (전집 한 벌)", fx.kb < 1024 && fx.subset >= 2, `${fx.files}개 ${fx.kb}KB · 전집 ${fx.subset}`);
  const fk = await fontBytes("/authors/franz-kafka/");
  check("작가 쪽도 같은 한 벌을 쓴다 — 조각을 더 받지 않는다", fk.kb < 1024 && fk.files <= 6, `${fk.files}개 ${fk.kb}KB`);
  // 그리스 이름 58/58 이 가운데서 글꼴이 바뀌었다(ά 는 KR 폰트에 없다). 이제 한 이름은 한 글꼴이다 — 실제로 그린 글꼴을 CDP 로 묻는다.
  await page.goto(`${server.origin}/authors/plato/`, { waitUntil: "networkidle" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".title-page .orig" });
  const { fonts: platformFonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  const fams = [...new Set(platformFonts.map((f) => f.familyName))];
  check("Πλάτων 은 한 글꼴로 그려진다 — ά 가 시스템 글꼴로 떨어지지 않는다", fams.length === 1 && platformFonts.every((f) => f.isCustomFont), platformFonts.map((f) => `${f.familyName}:${f.glyphCount}`).join(" "));
  await cdp.detach();
  // 인장 글자는 성이다 — 별칭(Venerabilis)·존칭(Magnus)·부칭이 아니라. 헝가리는 성이 앞에 선다.
  const sealLetter = async (id) => { await page.goto(`${server.origin}/authors/${id}/`, { waitUntil: "load" }); return (await page.locator(".title-page .seal").getAttribute("aria-label")) ?? ""; };
  check("베다의 인장은 B 다 — Venerabilis 의 V 가 아니라", /— B\b/.test(await sealLetter("bede")), await sealLetter("bede"));
  check("케르테스 임레의 인장은 K 다 — 헝가리는 성이 앞에 선다", /— K\b/.test(await sealLetter("imre-kertesz")), await sealLetter("imre-kertesz"));
  check("세르반테스의 인장은 C 다", /— C\b/.test(await sealLetter("miguel-de-cervantes")), await sealLetter("miguel-de-cervantes"));
}

// ─── 첫 장의 문 — 표시가 없는 독자 (2026-09-20 독자 걸음 평가가 라이브에서 재현한 결함) ──
console.log("\n첫 장의 문 — 표시가 없는 독자");
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "ko-KR" });
  const p2 = await ctx.newPage();
  await p2.goto(`${server.origin}/`, { waitUntil: "load" });
  await p2.waitForSelector("#app h2");
  const first = (await p2.locator("#app h2").first().innerText()).trim();
  const names = new Set([first]);
  for (let i = 0; i < 4; i++) {
    await p2.locator('[data-reopen]', { hasText: "다른 쪽" }).first().click();
    await p2.waitForFunction((prev) => document.querySelector("#app h2") && document.querySelector("#app h2").innerText.trim() !== prev, [...names].pop(), { timeout: 5000 }).catch(() => {});
    names.add((await p2.locator("#app h2").first().innerText()).trim());
  }
  check("「다른 쪽」을 누르면 다른 사람이 열린다 — 표시가 하나도 없어도", names.size >= 4, [...names].join(" → "));
  // 첫인사의 책은 한국어로 구할 수 있어야 한다 — 아니면 15분 안에 표시할 책이 없다.
  await p2.goto(`${server.origin}/`, { waitUntil: "load" });
  await ctx.clearCookies();
  await p2.evaluate(() => sessionStorage.clear());
  await p2.reload({ waitUntil: "load" });
  await p2.waitForSelector("#app ul.works a");
  const hrefs = await p2.locator("#app ul.works a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  let withEdition = 0;
  // 「한국어 N」 묶음이 있어야 한다 — 「검수된 판본 N」은 영어 원서 한 줄만 있어도 맞았다(2026-09-24 감사: 합성 위반이 통과).
  for (const h of hrefs) { const html = await (await fetch(`${server.origin}${h}`)).text(); if (/<tr class="gh"><th colspan="6">한국어 [1-9]/.test(html)) withEdition++; }
  check("첫인사로 내민 책 가운데 한국어 판본이 검수된 것이 있다", withEdition > 0, `${withEdition} / ${hrefs.length}`);
  // 문은 별칭을 안다 — 「도스토예프스키」는 우리 데이터에 있는 이름이고, 「없다」고 말하면 거짓이다.
  await p2.locator("#anchor").fill("도스토예프스키");
  await p2.locator("#door button[type=submit]").click();
  await p2.waitForTimeout(400);
  const doorName = (await p2.locator("#app h2").first().innerText()).trim();
  check("옛 표기로도 그 사람이 열린다 — 도스토예프스키 → 도스토옙스키", /도스토옙스키/.test(doorName) && (await p2.locator("#miss").innerText()).trim() === "", doorName);
  const crumb = (await p2.locator("#app .label").first().innerText()).trim();
  check("문으로 연 첫 쪽의 꼬리표가 같은 이름을 두 번 적지 않는다", !/(.+) → \1$/.test(crumb), crumb);
  await p2.locator("#anchor").fill("zzqx없는이름");
  await p2.locator("#door button[type=submit]").click();
  await p2.waitForTimeout(200);
  check("없는 이름에는 「없다」가 아니라 「못 찾았다」와 색인으로 가는 문", /찾지 못했다/.test(await p2.locator("#miss").innerText()) && (await p2.locator('#miss a[href^="/authors/?q="]').count()) === 1);

  // 작품 쪽, 손 안에서: 독(dock)의 화살표는 사다리를 연다. 도장은 제목을 덮지 않는다.
  await p2.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
  await p2.waitForTimeout(300);
  await p2.locator(".dock .mark-main").click();
  await p2.waitForTimeout(150);
  await p2.locator(".dock .mark-main").click();
  await p2.waitForTimeout(150);
  check("독의 단추를 다시 누르면 사다리가 그 위로 선다", await p2.locator(".dock .mark-ladder").isVisible());
  await p2.locator('.dock .mark-ladder button[data-set="read"]').click();
  await p2.waitForTimeout(200);
  check("독의 사다리로 칸이 옮겨진다", /읽은 책/.test(await p2.locator(".dock .mark-label").innerText()));
  const boxes = await p2.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    return { stamp: r(".stamped"), title: r("h1.name") };
  });
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  check("도장이 제목 위에 찍히지 않는다 — 제목 아래 제자리", boxes.stamp.w > 0 && !overlap(boxes.stamp, boxes.title), JSON.stringify(boxes));
  await p2.evaluate(() => { localStorage.removeItem("lp.reader.v3"); localStorage.removeItem("lp.shelf.v1"); });

  // 서명과 인장은 겹치지 않는다 — 진짜 서명만 싣는 쪽에서 서명의 끝 글자를 인장이 먹고 있었다.
  await p2.goto(`${server.origin}/authors/franz-kafka/`, { waitUntil: "load" });
  const sigBoxes = await p2.evaluate(() => {
    const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    return { sig: r(".autograph img"), seal: r(".autograph .seal") };
  });
  check("서명과 인장이 겹치지 않는다", sigBoxes.sig.x + sigBoxes.sig.w <= sigBoxes.seal.x, `서명 끝 ${Math.round(sigBoxes.sig.x + sigBoxes.sig.w)} · 인장 시작 ${Math.round(sigBoxes.seal.x)}`);
  // 연필(아직 대보지 않은 쪽)은 종이 위에서 3:1 은 넘는다 — 1,650행의 신뢰 신호가 가장 흐린 것이어서는 안 된다.
  const pencilRatio = await p2.evaluate(() => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue("--pencil").trim();
    const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
    const lum = (h) => { const c = h.replace("#", ""); const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    return (lum(paper) + 0.05) / (lum(hex) + 0.05);
  });
  check("연필 인장의 대비가 3:1 을 넘는다", pencilRatio >= 3, pencilRatio.toFixed(2) + ":1");
  // 200% 글자 크기에서도 첫 장은 옆으로 새지 않는다 — 저시력 독자가 처음 보는 것이 잘린 상표여서는 안 된다.
  await p2.goto(`${server.origin}/`, { waitUntil: "load" });
  await p2.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await p2.waitForTimeout(200);
  const zoomOverflow = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("200% 글자에서 첫 장이 옆으로 새지 않는다", zoomOverflow <= 0, `${zoomOverflow}px`);
  await ctx.close();
}

// ─── 저장소가 막힌 브라우저 ─────────────────────────────────────────────────
// 사생활 보호 모드처럼 localStorage 가 예외를 던지면 「관심 있는 책」은 조용히 아무것도 하지 않았다(2026-09-23 감사).
console.log("\n저장소가 막힌 브라우저 — 누른 것이 사라지지 않는다");
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "ko-KR" });
  await ctx.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } }); });
  const p3 = await ctx.newPage();
  const pe = []; p3.on("pageerror", (e) => pe.push(String(e)));
  await p3.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
  await p3.locator(".mark.big .mark-main").click();
  await p3.waitForTimeout(200);
  check("저장하지 못하면 그렇다고 말한다", /저장하지 않는다/.test(await p3.locator(".mark.big").innerText()), (await p3.locator(".mark.big .mark-err").innerText().catch(() => "(문장 없음)")));
  check("저장소가 막혀도 쪽이 죽지 않는다 — 스크립트 오류 0", pe.length === 0, pe.slice(0, 2).join(" | "));
  await ctx.close();
}

// ─── 2026-09-24 전수 감사가 찾은 것 — 다시 깨지지 않게 ─────────────────────
console.log("\n전수 감사 — 문·화살표·뒤로 가기·없는 쪽·옮기기");
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "ko-KR", permissions: [] });
  const p4 = await ctx.newPage();
  const pe = []; p4.on("pageerror", (e) => pe.push(String(e)));
  await p4.goto(`${server.origin}/`, { waitUntil: "load" });
  await p4.waitForSelector("#app h2");
  const door = async (v) => {
    await p4.locator("#anchor").fill(v);
    await p4.locator("#door button[type=submit]").click();
    await p4.waitForTimeout(500);
    return { hash: await p4.evaluate(() => location.hash), h2: (await p4.locator("#app h2").first().innerText()).trim(), miss: (await p4.locator("#miss").innerText()).trim(), label: (await p4.locator("#app .label").first().innerText()).trim() };
  };
  // 문의 규칙이 역슬래시를 잃어 공백을 못 지우고 s 와 숫자를 지웠다 — 「조지오웰」은 찾지 못했고 「1984」는 도판 193명이었다.
  let r = await door("조지오웰");
  check("붙여 쓴 이름이 연다 — 조지오웰", r.hash === "#george-orwell", JSON.stringify(r));
  r = await door("1984");
  check("책 제목이 그 작가를 연다 — 1984 → 조지 오웰, 꼬리표가 그렇게 말한다", r.hash === "#george-orwell" && /『1984』의 작가/.test(r.label), JSON.stringify(r));
  r = await door("무라카미 류");
  check("비슷한 이름은 열지 않는다 — 무라카미 류는 하루키가 아니다", r.hash !== "#haruki-murakami" && /그대로의 이름은 이 책에 없다/.test(r.miss) && /무라카미 하루키/.test(r.miss), JSON.stringify(r));
  r = await door("카프카");
  check("이름의 한 낱말이 한 사람이면 연다 — 카프카", r.hash === "#franz-kafka", r.hash);
  // 걸음마다 기록이 남는다 — 폰의 뒤로 가기가 앞 사람에게 돌아간다.
  const hop = p4.locator("#app .rels a[data-go]").first();
  const hopTo = await hop.getAttribute("data-go");
  await hop.click(); await p4.waitForTimeout(500);
  check("다음 걸음이 그 사람을 연다", (await p4.evaluate(() => location.hash)) === `#${hopTo}`, hopTo);
  await p4.goBack(); await p4.waitForTimeout(500);
  check("뒤로 가기는 앞 사람에게 돌아간다 — 책 밖으로 나가지 않는다", (await p4.evaluate(() => location.hash)) === "#franz-kafka" && /프란츠 카프카/.test(await p4.locator("#app h2").first().innerText()), await p4.evaluate(() => location.href));
  // 첫 장의 연도는 정적 쪽과 같은 말이다 — 「-750」이 아니라 「기원전 750 무렵」.
  await p4.goto(`${server.origin}/#homer`, { waitUntil: "load" }); await p4.waitForSelector("#app h2");
  const ys = await p4.locator("#app ul.works .y").allInnerTexts();
  check("첫 장이 기원전 연도를 날것으로 적지 않는다", ys.length > 0 && ys.every((y) => !/^-\d/.test(y)) && ys.some((y) => /기원전/.test(y)), ys.join(" · "));
  // 입문 순서가 없는 사람에게 「여기서 읽기 시작한다면」을 달지 않는다.
  await p4.goto(`${server.origin}/#stephen-king`, { waitUntil: "load" }); await p4.waitForSelector("#app h2");
  check("스케치의 책 목록을 입문 추천처럼 부르지 않는다", !/여기서 읽기 시작한다면/.test(await p4.locator("#app").innerText()), (await p4.locator("#app h3").first().innerText()));
  // 없는 쪽은 없다고 말한다.
  await p4.goto(`${server.origin}/#nobody-here`, { waitUntil: "load" }); await p4.waitForTimeout(800);
  check("주소의 없는 사람을 말없이 이번 주의 쪽으로 바꾸지 않는다", /쪽은 이 책에 없다/.test(await p4.locator("#miss").innerText()));
  const nf = await fetch(`${server.origin}/404.html`);
  check("없는 경로에 내줄 404 쪽이 있다", nf.ok && /없는 쪽/.test(await nf.text()));
  check("첫 장 스크립트 오류 0", pe.length === 0, pe.slice(0, 2).join(" | "));
  // 관계의 방향 — 「·」만 그려져 누가 누구에게 영향을 주었는지 알 수 없었다.
  await p4.goto(`${server.origin}/authors/homer/`, { waitUntil: "load" });
  const outG = await p4.locator(".rels .rt").allInnerTexts();
  await p4.goto(`${server.origin}/authors/james-joyce/`, { waitUntil: "load" });
  const inG = await p4.locator(".rels li", { hasText: "호메로스" }).locator(".rt").allInnerTexts();
  check("방향 있는 관계는 출발 쪽에 →, 도착 쪽에 ← 로 그려진다", outG.some((t) => t.startsWith("→")) && inG.some((t) => t.startsWith("←")), `${outG[0]} / ${inG[0]}`);
  // 한 쪽의 단추 다섯이 다 「관심 있는 책」이라고만 말하지 않는다.
  const labels = await p4.locator(".works .mark-main").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") || ""));
  check("상태 단추의 이름에 책 제목이 있다", labels.length > 0 && labels.every((l) => /^「.+」 — /.test(l)), labels[0]);
  // 옮기기 주소 — 서버 없이 다른 브라우저로.
  await p4.evaluate(() => localStorage.setItem("lp.reader.v3", JSON.stringify({ v: 3, state: { "franz-kafka--die-verwandlung": { s: "read", at: Date.now() - 5000 }, "homer--odysseia": { s: "want", at: Date.now() - 9000 } } })));
  await p4.goto(`${server.origin}/shelf/`, { waitUntil: "load" }); await p4.waitForTimeout(400);
  await p4.locator("#move-copy").click(); await p4.waitForTimeout(300);
  const moveUrl = await p4.evaluate(() => { const i = document.querySelector(".move-url"); return i ? i.value : ""; }) || await p4.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check("서재가 옮기기 주소를 낸다", /\/shelf\/#m=.+/.test(moveUrl), moveUrl.slice(0, 80));
  const other = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "ko-KR" });
  const p5 = await other.newPage();
  await p5.goto(moveUrl.replace(/^https?:\/\/[^/]+/, server.origin), { waitUntil: "load" }); await p5.waitForTimeout(400);
  check("다른 브라우저가 그 주소를 열면 합칠지 묻는다", /2권이 실려 있다/.test(await p5.locator("#move-in").innerText()));
  await p5.locator("#move-yes").click(); await p5.waitForTimeout(500);
  const moved = await p5.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("lp.reader.v3") || "{}").state || {}));
  check("합치면 같은 표시가 선다", moved.length === 2 && moved.includes("franz-kafka--die-verwandlung"), moved.join(" "));
  // 청하지 않은 로그인 — 주소에 실린 토큰을 받지 않는다.
  await p5.goto(`${server.origin}/works/franz-kafka--die-verwandlung/#access_token=aaa&refresh_token=bbb&expires_in=3600`, { waitUntil: "load" }); await p5.waitForTimeout(500);
  check("청하지 않은 로그인 링크의 토큰을 받지 않는다", (await p5.evaluate(() => localStorage.getItem("lp.session.v1"))) === null && /청한 로그인이 아니라서/.test(await p5.locator("#lp-auth").innerText()));
  await other.close();
  await ctx.close();
}
{
  const html = await (await fetch(`${server.origin}/`)).text();
  check("강제 다크 모드를 끈다 — color-scheme only light", /name="color-scheme" content="only light"/.test(html));
  const build = await fetch(`${server.origin}/build.txt`);
  check("배포 확인용 build.txt 가 커밋을 적는다", build.ok && /^[0-9a-f]{40}\n$/.test(await build.text()));
  // 첫 글자를 크게 앉히는 것은 한글 음절로 시작할 때만.
  let badCap = 0, seenCap = 0;
  for (const dir of ["authors", "works"]) for (const id of readdirSync(new URL(`../dist/${dir}/`, import.meta.url)).filter((n) => !n.endsWith(".html"))) {
    const h = await (await fetch(`${server.origin}/${dir}/${id}/`)).text();
    for (const m of h.matchAll(/<p class="lede cap">([^<]{0,2})/g)) { seenCap++; if (!/^[가-힣]{2}/.test(m[1])) badCap++; }
  }
  check("큰 첫 글자가 숫자·괄호를 쪼개지 않는다", seenCap > 0 && badCap === 0, `${badCap} / ${seenCap}`);
}

console.log(`\nconsole errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join("\n"));
console.log(`\n${pass} passed · ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
