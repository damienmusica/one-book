// 화면을 찍는다 — 디자인 심사는 DOM 이 아니라 픽셀을 본다.
//   QA_CHANNEL=chrome node qa/shoot.mjs <outDir> '[["/authors/franz-kafka/",1280,900,"kafka-desk",true],["/",375,812,"front-mob"]]'
import { chromium } from "playwright";
import { serveDist } from "./serve.mjs";
const out = process.argv[2]; const list = JSON.parse(process.argv[3]);
const server = await serveDist(); const b = await chromium.launch(process.env.QA_CHANNEL ? { channel: process.env.QA_CHANNEL } : {});
for (const [path, w, h, name, full] of list) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: "ko-KR" });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`${server.origin}${path}`, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: !!full });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(name, "overflow-x", ov, errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "");
  await p.close();
}
await b.close(); await server.close?.(); process.exit(0);
