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
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";

const server = await serveDist();
const browser = await chromium.launch();
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
check("그 쪽에 담을 책이 서 있다", (await page.locator("#app select.state").count()) >= 1);
check("왜 지금 이 쪽인지 말한다", /이번 주에 열린 쪽|열린다|뿌리다|곁이다/.test(await appTxt()));

// 도감 계수 — 목표도 퍼센트도 연속일도 없다. 세계가 얼마나 열렸는가만.
const census = await page.locator(".census").innerText();
check("도감 계수가 만난 수와 전체를 말한다", /만난 작가\s*\d+\s*\/\s*\d+/.test(census), census.replace(/\n/g, " "));
check("목표·퍼센트·연속일이 없다", !/%|목표|연속|남았|달성/.test(census));

// 표시 하나가 세계를 켠다 — 준비도 엔진의 핵심 주장
await page.locator("#app select.state").first().selectOption("read");
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
check("연 이유가 사람 이름으로 말해진다", /읽었으니 이제 열린다|의 뿌리다|의 곁이다/.test(openedTxt));

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
check("비로그인이어도 상태 칸은 그대로 동작한다 — 로컬이 먼저다", (await page.locator("select.state").count()) >= 1);
const authTxt = await page.locator("#lp-auth").innerText();
check("저장되는 것이 무엇인지 한 줄로 말한다", /어떤 책을 어느 칸에/.test(authTxt) && /언제/.test(authTxt));
check("모듈 로드에 콘솔 에러 없음", errors.length === 0, errors.slice(0, 2).join(" | "));

// ─── 준비도 배지 — 스포티파이가 못 쓰는 문장 ─────────────────────────────
// "이 책은 당신이 읽은 것에 대한 답이다." 유사성이 아니라 선행 조건이고, 근거는
// 우리 관계 원장에 출처와 함께 있다. 사용자 0명에서도 돈다.
console.log("\n준비도");
await page.goto(`${server.origin}/authors/gabriel-garcia-marquez/`, { waitUntil: "load" });
await page.waitForTimeout(900);
check("아무것도 안 읽었으면 배지가 없다 — 추측하지 않는다", !(await page.locator("#lp-ready").isVisible()));

await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
await page.waitForTimeout(300);
await page.locator("select.state").first().selectOption("read");
await page.waitForTimeout(250);
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
const ids = (await (await fetch(`${server.origin}/sitemap.xml`)).text())
  .split("\n")
  .map((l) => l.match(/<loc>[^<]*\/authors\/([^/<]+)\/<\/loc>/)?.[1])
  .filter(Boolean);
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
const hasRecord = (await page.locator("ul.eds li").count()) > 0;
if (hasRecord) {
  check("검수된 판본은 ISBN 상품 주소로 나간다", (await page.locator('a[href*="wproduct.aspx?ISBN="]').count()) > 0);
} else {
  check("판본이 없으면 없다고 날짜와 함께 적는다", /아직 검수하지 않았다 \(\d{4}-\d{2}-\d{2} 확인\)/.test(body));
  check("판본을 주장하지 않는다 — 상품 딥링크 0", (await page.locator('a[href*="wproduct.aspx"]').count()) === 0);
  check("그래도 문은 열린다 — 검색 링크 3", (await page.locator('.doors a[href^="https://"]').count()) >= 3);
}
check("증언 블록이 살아 있다", body.includes("증언"));

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

console.log(`\nconsole errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join("\n"));
console.log(`\n${pass} passed · ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
