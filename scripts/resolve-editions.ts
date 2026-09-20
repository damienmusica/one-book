// Find editions of works — Korean editions through Kakao book search or the National Library's ISBN registry
// (maintainer-local key), original-language editions through the national libraries of France (BnF), Germany
// (DNB), Japan (NDL) and the United States (Library of Congress), whose SRU/OpenSearch endpoints need no key.
//
//   npx tsx scripts/resolve-editions.ts --provider kakao|nlk|bnf|dnb|ndl|lc [--authors a,b | --works w1,w2 | --plates] [--limit N] --out <candidates.json>
//   npx tsx scripts/resolve-editions.ts --provider kakao --fixture <response.json> --work <workId>   (matching only, no network)
//
// Keys (kakao/nlk only) come from the environment or ~/.config/one-book/keys.env: KAKAO_REST_KEY, NLK_SEOJI_KEY.
// Output is a CANDIDATES ledger, not data/editions.json — promote-editions.ts applies the reader's rules, and the
// judgment field (sourceTextBasis) comes from a separate lookup pass. Aladin's OpenAPI closed to new keys 2026-09-04.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { isbn13Valid } from "../src/schema.js";

type Raw = Record<string, any>;
interface Item { title: string; author: string; translators: string[]; publisher: string; year: number; isbn13: string; language: string; category?: string; ebook?: boolean; status?: string; authorQuery?: boolean }
interface Provider {
  lang: string;                 // language of the editions this provider yields
  key?: string;                 // env name, when a key is needed
  issue?: string;
  source: string;               // what verifiedFrom will say
  search: (key: string | undefined, title: string, author: string | undefined) => Promise<Raw | string>;
  normalize: (raw: Raw | string) => Item[];
}
const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "one-book-resolve-editions/0.2 (maintainer-local; github.com/damienmusica/one-book)";

const KEYS_FILE = join(homedir(), ".config", "one-book", "keys.env");
function keyFor(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (existsSync(KEYS_FILE)) { const m = new RegExp(`^${name}=(.+)$`, "m").exec(readFileSync(KEYS_FILE, "utf8")); if (m?.[1]) return m[1].trim(); }
  return undefined;
}

// ── text helpers ─────────────────────────────────────────────────────────────────────────────────────────────
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[̀-ͯ]/g, "").replace(/[\s\p{P}\p{S}]+/gu, "");
const stripVolume = (t: string) => t.replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, " ").replace(/\s*(세트|전집|합본|상|중|하|\d+권?|[상중하]권)\s*$/u, "").trim();
const mainTitle = (t: string) => t.split(/\s+\/\s+/)[0]!.split(/\s+[:=]\s+/)[0]!.trim(); // "Madame Bovary / Flaubert : moeurs…" → "Madame Bovary"
// "978-3-328-11538-0 : EUR 10.00 (DE)" 처럼 가격이 따라오는 국립도서관 표기도 받는다 — ISBN 모양의 토큰을 먼저 뜯어낸다.
const isbn13Of = (s: string) => {
  const str = String(s);
  const m13 = /97[89][\d\- ]{10,17}/.exec(str); if (m13) { const d = m13[0].replace(/\D/g, ""); if (d.length === 13) return d; }
  const m10 = /\b\d[\d\- ]{7,12}[\dXx]\b/.exec(str); if (m10) { const d = m10[0].replace(/[^0-9Xx]/g, ""); if (/^\d{9}[\dXx]$/.test(d)) return isbn10to13(d); }
  const d = str.replace(/[^0-9Xx]/g, ""); if (/^\d{13}$/.test(d)) return d; if (/^\d{9}[\dXx]$/.test(d)) return isbn10to13(d);
  return "";
};
function isbn10to13(i10: string): string { const core = "978" + i10.slice(0, 9); let sum = 0; for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3); return core + ((10 - (sum % 10)) % 10); }
const xmlText = (block: string, tag: string): string[] => [...block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag.split(" ")[0]}>`, "g"))].map((m) => m[1]!.trim());
const unescapeXml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
// 자가출판·재간 공장 — 배제. 정본 시리즈의 순위는 promote-editions.ts 가 매긴다.
const POD = /유페이퍼|온이퍼브|크레용소프트|디즈비즈북스|해밀누리|스토리요|^한들$|부크크|e퍼플|위즈덤커넥트|recorded books|blackstone|naxos|tantor|brilliance|highbridge|\baudio\b|comicarts|\bbange\b|epubli|independently publish|john galt|ararauna|graded reader|lettura graduata|simplified|vereinfacht|klett sprachen|gröls|nexx verlag|hofenberg|jazzybee|null papier|boer verlag|henricus|vergangenheitsverlag|europäischer hochschulverlag|edition holzinger|contumax|sarastro|bibebook|la gibecière|éditions de londres|publie\.net|ebooks libres|books on demand|\bbod\b|createspace|independently published|\blulu\b|hansebooks|outlook verlag|legare street|alpha editions|wentworth press|forgotten books|kessinger|tredition|salzwasser|ligaran|culturea|e-artnow|musaicum|dodo press|general books|nabu press|bibliolife|lightning source|amazon|kindle|europäischer literaturverlag|reink|scholar select|palala|andesite|franklin classics|sagwan|trieste publishing|pinnacle press|blurb|createspace|publishing house of|hard press|hardpress|the classics us|read books|literary licensing|book jungle|echo library|digireads|spastic cat|lector house|maven|prabhat|yesterday's classics|throne classics/i;
async function getText(url: URL): Promise<string> { const r = await fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(`${url.host} ${r.status}`); return r.text(); }
// SRU 는 페이지를 준다 — 흔한 제목은 첫 50건이 재간 공장으로 차서 정본이 뒤에 온다. 최대 3쪽까지 이어 받아 하나로 합친다.
async function sruPages(u: URL, pageSize: number, pages = 3): Promise<string> {
  let out = ""; let start = 1;
  for (let i = 0; i < pages; i++) {
    u.searchParams.set("maximumRecords", String(pageSize)); u.searchParams.set("startRecord", String(start));
    const t = await getText(u); out += t;
    const n = Number(/numberOfRecords>(\d+)/.exec(t)?.[1] ?? 0); start += pageSize;
    if (start > n) break; await sleep(400);
  }
  return out;
}

// ── providers ────────────────────────────────────────────────────────────────────────────────────────────────
const PROVIDERS: Record<string, Provider> = {
  kakao: {
    lang: "ko", key: "KAKAO_REST_KEY", issue: "https://developers.kakao.com/console/app → 애플리케이션 추가 → 앱 키 → REST API 키",
    source: "카카오 책 검색 API · 제목·저자·ISBN-13 대조",
    async search(key, title, author) {
      const u = new URL("https://dapi.kakao.com/v3/search/book");
      if (author) u.searchParams.set("query", `${title} ${author}`); else { u.searchParams.set("target", "title"); u.searchParams.set("query", title); }
      u.searchParams.set("size", "50");
      const r = await fetch(u, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!r.ok) throw new Error(`kakao ${r.status} ${(await r.text()).slice(0, 120)}`);
      return r.json();
    },
    normalize(raw) {
      return ((raw as Raw).documents ?? []).map((d: Raw): Item => ({
        title: String(d.title ?? ""), author: (d.authors ?? []).join(", "), translators: (d.translators ?? []).map(String),
        publisher: String(d.publisher ?? ""), year: Number(String(d.datetime ?? "").slice(0, 4)), isbn13: isbn13Of(d.isbn ?? ""), language: "ko",
        ebook: /e-?book|전자책/i.test(String(d.title ?? "")), status: d.status ? String(d.status) : undefined,
      }));
    },
  },
  nlk: {
    lang: "ko", key: "NLK_SEOJI_KEY", issue: "https://www.nl.go.kr/seoji/ → 회원가입 → Open API → 인증키 신청",
    source: "국립중앙도서관 서지정보유통지원시스템 API · 제목·저자·ISBN-13 대조",
    async search(key, title, author) {
      const u = new URL("https://www.nl.go.kr/seoji/SearchApi.do");
      for (const [k, v] of Object.entries({ cert_key: key!, result_style: "json", page_no: "1", page_size: "50", title, ...(author ? { author } : {}) })) u.searchParams.set(k, v);
      const r = await fetch(u); if (!r.ok) throw new Error(`nlk ${r.status}`); return r.json();
    },
    normalize(raw) {
      return ((raw as Raw).docs ?? []).map((d: Raw): Item => {
        const author = String(d.AUTHOR ?? "");
        const translators = [...author.matchAll(/([^;,:]+?)\s*(?:옮김|역)(?=\s*[;,]|\s*$)/g)].map((m) => (m[1] ?? "").replace(/^(옮긴이|역자)\s*[:：]?\s*/, "").trim()).filter(Boolean);
        return { title: String(d.TITLE ?? ""), author, translators, publisher: String(d.PUBLISHER ?? ""), year: Number(String(d.PUBLISH_PREDATE ?? "").slice(0, 4)),
          isbn13: isbn13Of(d.EA_ISBN ?? ""), language: "ko", category: d.SUBJECT ? `KDC ${d.SUBJECT}` : undefined,
          ebook: /^\d5/.test(String(d.EA_ADD_CODE ?? "")) || /e-?book|전자책/i.test(String(d.TITLE ?? "")) };
      });
    },
  },
  bnf: {
    lang: "fr", source: "Bibliothèque nationale de France SRU · 제목·저자·ISBN-13 대조",
    async search(_k, title, author) {
      const u = new URL("https://catalogue.bnf.fr/api/SRU");
      const q = `bib.title all "${title.replace(/"/g, "")}"${author ? ` and bib.author all "${author.replace(/"/g, "")}"` : ""} and bib.doctype all "a"`;
      for (const [k, v] of Object.entries({ version: "1.2", operation: "searchRetrieve", query: q, recordSchema: "dublincore" })) u.searchParams.set(k, v);
      return sruPages(u, 50);
    },
    normalize(raw) {
      return [...String(raw).matchAll(/<oai_dc:dc[^>]*>([\s\S]*?)<\/oai_dc:dc>/g)].map((m) => m[1]!).map((b): Item => {
        const isbn = xmlText(b, "dc:identifier").map((x) => /ISBN\s*([0-9Xx -]+)/i.exec(x)?.[1] ?? "").map(isbn13Of).find(Boolean) ?? "";
        const title = unescapeXml(xmlText(b, "dc:title")[0] ?? "");
        return { title, author: unescapeXml(xmlText(b, "dc:creator").join(", ")), translators: [], publisher: unescapeXml((xmlText(b, "dc:publisher")[0] ?? "").replace(/\s*\([^)]*\)\s*$/, "")),
          year: Number((xmlText(b, "dc:date")[0] ?? "").slice(0, 4)), isbn13: isbn, language: "fr", ebook: /électronique|numérique/i.test(xmlText(b, "dc:type").join(" ")) };
      });
    },
  },
  dnb: {
    lang: "de", source: "Deutsche Nationalbibliothek SRU · 제목·저자·ISBN-13 대조",
    async search(_k, title, author) {
      const u = new URL("https://services.dnb.de/sru/dnb");
      const q = `tit="${title.replace(/"/g, "")}"${author ? ` and per=${author.replace(/"/g, "")}` : ""} and spr=ger and mat=books and jhr>=1950`;
      for (const [k, v] of Object.entries({ version: "1.1", operation: "searchRetrieve", query: q, recordSchema: "oai_dc" })) u.searchParams.set(k, v);
      return sruPages(u, 100);
    },
    normalize(raw) {
      return [...String(raw).matchAll(/<recordData>([\s\S]*?)<\/recordData>/g)].map((m) => m[1]!).map((b): Item => {
        const isbn = ([...b.matchAll(/<dc:identifier[^>]*xsi:type="tel:ISBN"[^>]*>([^<]*)</g)].map((m) => isbn13Of(m[1]!)).find(Boolean)) ?? "";
        // DNB 의 oai_dc 는 출판사를 비워 보내는 레코드가 있다(하나·피셔의 정본 판이 그렇다). ISBN 등록자 접두는
        // 출판사에 고정 배정된 사실이라 그것으로 채운다 — 없는 접두면 비워 두고, 승격은 빈 출판사를 올리지 않는다.
        let pub = unescapeXml((xmlText(b, "dc:publisher")[0] ?? "").split(/\s+:\s+/).pop() ?? "");
        if (!pub && isbn) pub = DE_REGISTRANT.find(([pre]) => isbn.startsWith("978" + pre))?.[1] ?? "";
        return { title: unescapeXml(xmlText(b, "dc:title")[0] ?? ""), author: unescapeXml(xmlText(b, "dc:creator").join(", ")).replace(/\s*\[[^\]]*\]/g, ""), translators: [], publisher: pub,
          year: Number((xmlText(b, "dc:date")[0] ?? "").slice(0, 4)), isbn13: isbn, language: "de", ebook: /online|elektronisch|e-?book/i.test(xmlText(b, "dc:type").join(" ") + xmlText(b, "dc:format").join(" ")) };
      });
    },
  },
  ndl: {
    lang: "ja", source: "国立国会図書館サーチ OpenSearch · 제목·저자·ISBN-13 대조",
    async search(_k, title, author) {
      // dpid=iss-ndl-opac — 국회도서관 자체 목록만. 통합검색은 중국어 번역판·외부 DB 가 앞을 채운다(실측: 200건 중 일본 ISBN 정확 제목 3 → 63).
      let out = "";
      for (let idx = 1; idx <= 401; idx += 200) {
        const u = new URL("https://ndlsearch.ndl.go.jp/api/opensearch");
        u.searchParams.set("title", title); if (author) u.searchParams.set("creator", author);
        u.searchParams.set("cnt", "200"); u.searchParams.set("idx", String(idx)); u.searchParams.set("dpid", "iss-ndl-opac");
        const t = await getText(u); out += t;
        const total = Number(/totalResults>(\d+)/.exec(t)?.[1] ?? 0); if (idx + 200 > total) break; await sleep(400);
      }
      return out;
    },
    normalize(raw) {
      return [...String(raw).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]!).map((b): Item => {
        const isbn = ([...b.matchAll(/<dc:identifier[^>]*xsi:type="dcndl:ISBN13?"[^>]*>([^<]*)</g)].map((m) => isbn13Of(m[1]!)).find(Boolean)) ?? "";
        return { title: unescapeXml(xmlText(b, "title")[0] ?? ""), author: unescapeXml(xmlText(b, "dc:creator").join(", ")), translators: [], publisher: unescapeXml(xmlText(b, "dc:publisher")[0] ?? ""),
          year: Number((xmlText(b, "dcterms:issued")[0] ?? "").replace(/^明(\d+)/, (_, n) => String(1867 + Number(n))).replace(/^大正?(\d+)/, (_, n) => String(1911 + Number(n))).replace(/^昭和?(\d+)/, (_, n) => String(1925 + Number(n))).replace(/^平成?(\d+)/, (_, n) => String(1988 + Number(n))).replace(/^令和?(\d+)/, (_, n) => String(2018 + Number(n))).slice(0, 4)),
          isbn13: isbn, language: "ja" };
      });
    },
  },
  lc: {
    lang: "en", source: "Library of Congress SRU · 제목·저자·ISBN-13 대조",
    async search(_k, title, author) {
      const u = new URL("http://lx2.loc.gov:210/lcdb");
      const q = `dc.title="${title.replace(/"/g, "")}"${author ? ` and dc.author=${author.replace(/"/g, "")}` : ""}`;
      for (const [k, v] of Object.entries({ version: "1.1", operation: "searchRetrieve", query: q, recordSchema: "marcxml" })) u.searchParams.set(k, v);
      return sruPages(u, 50);
    },
    normalize(raw) {
      const df = (rec: string, tag: string, code: string) => [...rec.matchAll(new RegExp(`<datafield tag="${tag}"[^>]*>([\\s\\S]*?)<\\/datafield>`, "g"))].flatMap((m) => [...m[1]!.matchAll(new RegExp(`<subfield code="${code}">([^<]*)<`, "g"))].map((s) => unescapeXml(s[1]!)));
      return [...String(raw).matchAll(/<record[^>]*>([\s\S]*?)<\/record>/g)].map((m) => m[1]!).map((rec): Item => {
        const isbn = df(rec, "020", "a").map(isbn13Of).find(Boolean) ?? "";
        const pub = (df(rec, "264", "b")[0] ?? df(rec, "260", "b")[0] ?? "").replace(/[,;:]\s*$/, "").trim();
        const date = (df(rec, "264", "c")[0] ?? df(rec, "260", "c")[0] ?? "").replace(/[^0-9]/g, "").slice(0, 4);
        const f008 = /<controlfield tag="008">([^<]*)</.exec(rec)?.[1] ?? "";
        const langCode = f008.slice(35, 38) || (df(rec, "041", "a")[0] ?? "");
        return { title: (df(rec, "245", "a")[0] ?? "").replace(/\s*[\/:;]\s*$/, ""), author: df(rec, "100", "a").join(", "), // 700 부출 표목에는 서문 필자·삽화가·편자가 섞여 있다. "tr" 부분일치는 illustrator 도 잡는다(실측) — 관계어가 translator 인 것만.
          translators: [...rec.matchAll(/<datafield tag="700"[^>]*>([\s\S]*?)<\/datafield>/g)].map((m) => m[1]!).filter((f) => /<subfield code="e">\s*translator/i.test(f) || /<subfield code="4">trl</.test(f)).map((f) => unescapeXml(/<subfield code="a">([^<]*)</.exec(f)?.[1] ?? "").replace(/[,.]\s*$/, "")).filter(Boolean), publisher: pub,
          year: Number(date), isbn13: isbn, language: langCode === "eng" ? "en" : langCode, ebook: /electronic|online resource|sound|audio|videodisc/i.test(df(rec, "300", "a").join(" ") + df(rec, "337", "a").join(" ") + df(rec, "338", "a").join(" ") + df(rec, "245", "h").join(" ")) || /graphic novel|comic/i.test(df(rec, "655", "a").join(" ")) };
      });
    },
  },
};
// 독일어권 주요 문학 출판사의 ISBN 등록자 접두(978-3-…). 등록자 접두 → 출판사는 ISBN 기관이 배정한 고정 사실이다.
const DE_REGISTRANT: [string, string][] = [["310", "S. Fischer"], ["3596", "Fischer Taschenbuch"], ["3446", "Hanser"], ["315", "Reclam"], ["3518", "Suhrkamp"], ["3423", "dtv"], ["3458", "Insel"], ["3257", "Diogenes"], ["3499", "Rowohlt"], ["3406", "C.H. Beck"], ["38353", "Wallstein"], ["3492", "Piper"], ["3717", "Manesse"], ["3462", "Kiepenheuer & Witsch"], ["3548", "Ullstein"], ["3630", "Luchterhand"], ["3608", "Klett-Cotta"], ["3455", "Hoffmann und Campe"], ["3351", "Aufbau"], ["3150", "Reclam"], ["3618", "Deutscher Klassiker Verlag"], ["3730", "Anaconda"]];
// ISBN 국가 접두로 언어를 한 번 더 건다 — NDL 이 중국어판을, BnF 가 다른 나라 판을 함께 내기도 한다.
// 979-11 도 한국이다. 480… 은 ISBN 이 아니라 유통 바코드인데 체크섬이 같아 스키마를 통과한다 — 여기서 막는다.
const ISBN_GROUP: Record<string, RegExp> = { ko: /^(97889|9791)/, fr: /^(9782|97910)/, de: /^(9783|97912)/, ja: /^9784/, en: /^978[01]/ };

// ── matching — same rule for every provider ─────────────────────────────────────────────────────────────────
export function matchItems(work: Raw, author: Raw, items: Item[], lang: string) {
  const wantTitle = norm(lang === "ko" ? work.titleKo ?? "" : work.titleOriginal ?? "");
  const koTokens = String(author.names?.ko ?? "").split(/\s+/).filter((t) => t.length >= 2);
  const origTokens = String(author.names?.original ?? "").split(/\s+/).filter((t) => t.length >= 3);
  const out: Raw[] = [];
  for (const it of items) {
    if (it.ebook) continue;
    if (lang === "ko" && /세트|전집|합본/.test(it.title)) continue;
    const t = norm(lang === "ko" ? stripVolume(it.title) : mainTitle(it.title));
    if (!wantTitle || !(t.startsWith(wantTitle) || t.includes(wantTitle) || (wantTitle.length >= 6 && wantTitle.includes(t) && t.length >= 6))) continue;
    const flatAuthor = norm(it.author);
    const authorOk = it.authorQuery === true
      || koTokens.some((k) => it.author.includes(k) || flatAuthor.includes(norm(k)))
      || origTokens.some((k) => flatAuthor.includes(norm(k)));
    if (!authorOk) continue;
    if (!isbn13Valid(it.isbn13)) continue;
    if (ISBN_GROUP[lang] && !ISBN_GROUP[lang]!.test(it.isbn13)) continue;
    if (!(it.year >= (lang === "ko" ? 1900 : 1950) && it.year <= new Date().getFullYear())) continue;
    if (POD.test(it.publisher)) continue;
    const tr = it.translators.filter(Boolean);
    out.push({
      workId: work.id, isbn13: it.isbn13, title: it.title.trim(), publisher: it.publisher.trim(), year: it.year, language: lang,
      ...(tr.length ? { translator: tr.join(", ") } : {}), ...(it.category ? { category: it.category } : {}), ...(it.status ? { status: it.status } : {}), exact: t === wantTitle,
      ...(/어린이|아동|청소년|주니어|키즈|만화|축약|다이제스트|리라이팅|가볍게 읽는|걸작선|한 권으로 읽는|논술|중학생|독후감|스파크노트|명저노트|해설서|jeunesse|junior|kinder|jugend|abridged|retold|study guide|erläuterungen|lektüreschlüssel|textanalyse|interpretation zu|graphic novel|少年|児童|子ども|こども/i.test((it.category ?? "") + it.title + " " + it.publisher) ? { note: "어린이·청소년·축약 표시 — 번안일 수 있다" } : {}),
    });
  }
  out.sort((a, b) => Number(b.exact) - Number(a.exact) || b.year - a.year);
  return out;
}

function loadAll() {
  const read = (d: string) => readdirSync(join("data", d)).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join("data", d, f), "utf8")) as Raw[]);
  const authors = read("authors"); const works = read("works");
  return { authors: new Map(authors.map((a) => [a.id, a])), works };
}

async function main() {
  const { authors, works } = loadAll();
  const pname = flag("--provider") ?? "kakao";
  const P = PROVIDERS[pname]; if (!P) throw new Error(`provider ${pname}? (${Object.keys(PROVIDERS).join("|")})`);
  if (flag("--fixture")) {
    const w = works.find((x) => x.id === flag("--work")); if (!w) throw new Error(`작품 ${flag("--work")} 없음`);
    const fx = readFileSync(flag("--fixture")!, "utf8");
    const items = P.normalize(fx.trim().startsWith("{") ? JSON.parse(fx) : fx);
    console.error(`[fixture] 정규화 ${items.length}건 · 표본 ${JSON.stringify(items.slice(0, 2))}`);
    console.log(JSON.stringify(matchItems(w, authors.get(w.authorId)!, items, P.lang), null, 1)); return;
  }
  const out = flag("--out"); if (!out) throw new Error("--out <candidates.json> 이 필요하다");
  const key = P.key ? keyFor(P.key) : undefined;
  if (P.key && !key) { console.error(`${pname} 키(${P.key})가 없다. 발급: ${P.issue}\n그 키를 ${KEYS_FILE} 에 ${P.key}=... 한 줄로 두거나 환경변수로 준다. 레포에는 절대 넣지 않는다.`); process.exit(2); }
  let todo = works;
  if (flag("--works")) { const s = new Set(flag("--works")!.split(",")); todo = works.filter((w) => s.has(w.id)); }
  else if (flag("--authors")) { const s = new Set(flag("--authors")!.split(",")); todo = works.filter((w) => s.has(w.authorId)); }
  else if (args.includes("--plates")) todo = works.filter((w) => { const a = authors.get(w.authorId); return a && (a.depth ?? "plate") === "plate"; });
  // 원어 공급자는 그 언어로 쓴 작가의 작품만 — 프랑스 국립도서관에서 카프카를 찾지 않는다.
  if (P.lang !== "ko") todo = todo.filter((w) => (authors.get(w.authorId)?.languages ?? []).includes(P.lang) && w.titleOriginal);
  if (flag("--limit")) todo = todo.slice(0, Number(flag("--limit")));
  console.log(`${pname}(${P.lang}): 작품 ${todo.length}편 조회`);
  const found: Record<string, Raw[]> = {}; const none: string[] = []; let calls = 0;
  for (const w of todo) {
    const a = authors.get(w.authorId); if (!a) { none.push(`${w.id}: 작가 없음`); continue; }
    try {
      let items: Item[];
      if (P.lang === "ko") {
        if (!w.titleKo) { none.push(`${w.id}: 한국어 제목 없음`); continue; }
        const raw = await P.search(key, w.titleKo, undefined); calls++;
        if (calls === 1) console.log(`  첫 응답 표본: ${JSON.stringify(raw).slice(0, 300)}`);
        items = P.normalize(raw);
        if (pname === "kakao" && a.names?.ko) {
          // 흔한 제목(『변신』·『우체국』)은 첫 50건에 정본 판이 안 들기도 하고, 표기가 다르면(나쓰메/나츠메) 저자를 못 잡는다 —
          // 성(마지막 토큰)을 붙인 전체 검색을 항상 한 번 더 하고 ISBN 으로 합친다. 풀네임은 표기 차이(라빈드라나트/라빈드라나드)로 빠진다.
          await sleep(350);
          const last = String(a.names.ko).trim().split(/\s+/).pop()!;
          const raw2 = await P.search(key, w.titleKo, last); calls++;
          const seen = new Set(items.map((it) => it.isbn13));
          for (const it of P.normalize(raw2)) if (!seen.has(it.isbn13)) items.push({ ...it, authorQuery: true });
        }
      } else {
        const surname = P.lang === "ja" ? String(a.names.original).replace(/\s+/g, "") : (String(a.names.original).trim().split(/\s+/).pop() ?? "");
        const raw = await P.search(undefined, mainTitle(w.titleOriginal), surname); calls++;
        if (calls === 1) console.log(`  첫 응답 표본: ${String(typeof raw === "string" ? raw : JSON.stringify(raw)).replace(/\s+/g, " ").slice(0, 300)}`);
        items = P.normalize(raw).map((it) => ({ ...it, authorQuery: true }));
      }
      const m = matchItems(w, a, items, P.lang);
      if (m.length) found[w.id] = m; else none.push(`${w.id}: 검색 ${items.length}건 중 일치 0`);
    } catch (e) { none.push(`${w.id}: ${(e as Error).message}`); if (/429|quota|한도/i.test(String(e))) break; }
    await sleep(P.lang === "ko" ? 350 : 700);
  }
  const ledger = { generatedAt: new Date().toISOString().slice(0, 10), provider: pname, language: P.lang, source: P.source, calls, found, none };
  writeFileSync(out, JSON.stringify(ledger, null, 2) + "\n");
  console.log(`후보 있음 ${Object.keys(found).length} · 없음 ${none.length} · 호출 ${calls} → ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
