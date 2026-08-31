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
console.log("\n정문");
await page.goto(`${server.origin}/`, { waitUntil: "load" });
check("루트가 첫 장을 연다", ((await page.locator("h1").first().textContent()) ?? "").includes("하나의 책"));
const starts = await page.locator("#app .doors a").count();
check("입구에 출발점이 서 있다", starts >= 4, `출발 ${starts}`);
await page.locator("#app .doors a").nth(1).click();
await page.waitForTimeout(150);

// ─── 상태 사다리 ────────────────────────────────────────────────────────────
// 모르는 책 → 관심 있는 책 → 펼쳐본 책 → 구매한 책 → 읽은 책.
// 「모르는 책」은 **기본값이고 저장되지 않는다** — 이름은 있고 레코드는 없다.
const sel = page.locator("#app select.state").first();
check("작품마다 상태 칸이 선다", (await page.locator("#app select.state").count()) >= 1);
const labels = await sel.locator("option").allTextContents();
check(
  "사다리는 다섯 칸이고 기본값은 「모르는 책」이다",
  labels.join("|") === "모르는 책|관심 있는 책|펼쳐본 책|구매한 책|읽은 책" &&
    (await sel.inputValue()) === "",
  labels.join(" · ")
);
const store = () =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("lp.reader.v3") ?? "null");
    } catch {
      return null;
    }
  });
check("표시하기 전에는 아무것도 저장되지 않는다", (await store()) === null);

await sel.selectOption("want");
await page.waitForTimeout(120);
let p3 = await store();
const firstId = Object.keys(p3?.state ?? {})[0];
check("한 번의 선택이 작품 id 로 남는다", Object.keys(p3?.state ?? {}).length === 1, firstId ?? "없음");
check("칸 이름이 그대로 저장된다", p3?.state?.[firstId]?.s === "want");
check("칸을 오른 시각이 남는다", typeof p3?.state?.[firstId]?.at === "number");
check("올린 칸이 화면에 남는다", (await sel.getAttribute("data-state")) === "want");

await sel.selectOption("have");
await page.waitForTimeout(120);
p3 = await store();
check("사다리는 위로도 간다 — 구매한 책", p3?.state?.[firstId]?.s === "have");

await sel.selectOption("");
await page.waitForTimeout(120);
p3 = await store();
check("모르는 책으로 되돌리면 레코드가 사라진다", !(firstId in (p3?.state ?? {})));

// 새로고침 뒤에도 칸이 남는다 — 표시는 페이지가 아니라 독자의 것이다
await sel.selectOption("opened");
await page.waitForTimeout(120);
// 새로고침하면 해시가 그 작가를 다시 펴므로 클릭이 필요 없다
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(250);
check(
  "새로고침 뒤에도 칸이 서 있다",
  (await page.locator(`#app select.state[data-work="${firstId}"]`).inputValue()) === "opened"
);

// v2 이관 — 옛 기록을 버리지 않는다
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem(
    "lp.universe.personal.v2",
    JSON.stringify({ v: 2, want: { "franz-kafka--die-verwandlung": 111 }, read: { "natsume-soseki--kokoro": 222 } })
  );
});
await page.goto(`${server.origin}/works/franz-kafka--die-verwandlung/`, { waitUntil: "load" });
await page.waitForTimeout(150);
const migrated = await store();
check(
  "v2 의 want·read 가 타임스탬프째 이관된다",
  migrated?.state?.["franz-kafka--die-verwandlung"]?.s === "want" &&
    migrated?.state?.["franz-kafka--die-verwandlung"]?.at === 111 &&
    migrated?.state?.["natsume-soseki--kokoro"]?.s === "read" &&
    migrated?.state?.["natsume-soseki--kokoro"]?.at === 222,
  JSON.stringify(migrated?.state ?? {})
);
check(
  "이관된 칸이 작품 페이지에 그려진다",
  (await page.locator('select.state[data-work="franz-kafka--die-verwandlung"]').inputValue()) === "want"
);

// 카운터 금지 — 측정된 해악(Etkin JCR 2016)
const bodyText = await page.evaluate(() => document.body.innerText);
check(
  "진행 카운터·퍼센트·연속일이 없다",
  !/\d+\s*\/\s*\d+\s*권|\d+%|연속\s*\d+일|\d+권 남았/.test(bodyText)
);

await page.goto(`${server.origin}/`, { waitUntil: "load" });
const html = await page.content();
check("옛 이름이 남아 있지 않다", !html.includes("문학의 성계") && !html.includes("성좌 산책"), "성계/성좌 0");

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

console.log(`\nconsole errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join("\n"));
console.log(`\n${pass} passed · ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
