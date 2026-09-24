// 첫 장의 문과 색인이 이름을 견주는 규칙 — 한 벌이다. 브라우저에는 `fn.toString()` 으로 실려 간다.
//
// 왜 문자열이 아니라 함수인가: 이 규칙은 TS 템플릿 문자열 안의 JS 로 적혀 있었고, 템플릿이 정규식의 역슬래시를
// 먹었다(`[\s·.,\-_'’]` → `[s·.,-_'’]`). 문은 공백을 지우지 못하고 영문자 s 와 숫자를 지웠다 — 「조지오웰」은
// 「찾지 못했다」, 「1984」는 도판 193명 목록이 되었다(2026-09-24 감사). 진짜 코드로 두면 타입검사와 유닛이 본다.
//
// 그래서 이 파일의 함수는 바깥 이름을 참조하지 않는다 — 모듈 스코프도, import 도, 안에서 이름 붙인 함수
// 표현식도(tsx 의 keepNames 가 `__name(...)` 을 끼워 넣는다). tests/door.test.ts 가 떼어낸 문자열로 돌려 본다.

/** 이름 색인 한 줄: [id, 한국어 이름, 원어 이름, 깊이 첫 글자(p|s|i), 별칭?] */
export type NameRow = [string, string, string | undefined | null, string, string[]?];
/** 책 제목 한 줄: [한국어 제목, 이름 색인의 줄 번호] */
export type TitleRow = [string, number];
export type DoorResult =
  | { kind: "open"; id: string }
  | { kind: "title"; id: string; title: string }
  | { kind: "choose"; ids: string[] }
  | { kind: "near"; ids: string[] }
  | { kind: "none"; ids: string[] };

/** 비교용 키 — 대소문자·띄어쓰기·문장부호·발음 구별 기호를 지운다. 한글 음절은 그대로 둔다(NFKD 뒤 NFC). */
export function lpNorm(s: unknown): string {
  return String(s == null ? "" : s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/đ/g, "d")
    .replace(/ı/g, "i")
    .replace(/[\s\u00b7\u30fb.,\-_'’‘"“”「」『』()[\]:;!?]/g, "");
}

/**
 * 문에 친 말을 사람에게 잇는다. **여는 것은 확실할 때만**이다:
 *   이름·원어·별칭 전체가 같다 → 연다(여럿이면 고르게 한다)
 *   책 제목 전체가 같다 → 그 작가를 연다(작가가 여럿이면 고르게 한다)
 *   이름의 한 낱말 전체가 같다(「카프카」「하루키」「Hesse」) → 한 사람이면 연다, 여럿이면 고르게 한다
 *   그 밖의 비슷한 것(부분 일치·앞 세 글자) → 열지 않는다. 「그대로의 이름은 없다」와 함께 가까운 이름을 내민다
 * 비슷한 이름을 말없이 여는 것은 없는 사람을 있다고 말하는 것이다 — 「무라카미 류」가 하루키를 열었다.
 */
export function doorMatch(N: NameRow[], T: TitleRow[], v: string): DoorResult {
  const n = lpNorm(v);
  if (!n) return { kind: "none", ids: [] };
  const exact: number[] = [];
  const token: number[] = [];
  const near: number[] = [];
  // 키는 색인마다 한 번 만든다 — 질의마다 1,837명 × 이름 수만큼 정규화하면 한 번에 수십 ms 다.
  const cache = N as unknown as { __keys?: Array<Array<[string, string[]]>> };
  const K = cache.__keys || (cache.__keys = N.map((x) =>
    [x[1], x[2] || ""].concat(x[4] || []).filter(Boolean).map((name) => {
      const parts = String(name).split(/[\s\-‐·.]+/);
      return [lpNorm(name), parts.length > 1 ? parts.map(lpNorm) : []] as [string, string[]];
    })));
  for (let i = 0; i < N.length; i++) {
    let isExact = false;
    let isToken = false;
    let isNear = false;
    const keys = K[i]!;
    for (let j = 0; j < keys.length; j++) {
      const k = keys[j]![0];
      if (!k) continue;
      if (k === n) isExact = true;
      if (keys[j]![1].indexOf(n) >= 0) isToken = true;
      if (n.length >= 2 && k.indexOf(n) >= 0) isNear = true;
      if (n.length >= 4 && k.slice(0, 3) === n.slice(0, 3) && Math.abs(k.length - n.length) <= 2) isNear = true;
    }
    if (isExact) exact.push(i);
    else if (isToken) token.push(i);
    else if (isNear) near.push(i);
  }
  if (exact.length === 1) return { kind: "open", id: N[exact[0]!]![0] };
  if (exact.length > 1) return { kind: "choose", ids: doorOrder(N, exact) };
  const titled: number[] = [];
  const titleNear: number[] = [];
  let titleHit = "";
  const tcache = T as unknown as { __keys?: string[] };
  const TK = tcache.__keys || (tcache.__keys = T.map((x) => lpNorm(x[0])));
  for (let t = 0; t < T.length; t++) {
    const k = TK[t]!;
    if (!k) continue;
    if (k === n) { titled.push(T[t]![1]); titleHit = T[t]![0]; }
    else if (n.length >= 2 && k.indexOf(n) >= 0) titleNear.push(T[t]![1]);
  }
  const titledIds = doorOrder(N, titled);
  if (titledIds.length === 1) return { kind: "title", id: titledIds[0]!, title: titleHit };
  if (titledIds.length > 1) return { kind: "choose", ids: titledIds };
  if (token.length === 1) return { kind: "open", id: N[token[0]!]![0] };
  if (token.length > 1) return { kind: "choose", ids: doorOrder(N, token) };
  const guesses = doorOrder(N, near.concat(titleNear));
  return guesses.length ? { kind: "near", ids: guesses } : { kind: "none", ids: [] };
}

/** 고르는 목록의 순서 — 도판(쪽이 채워진 사람)을 앞에, 같은 사람은 한 번. 여는 규칙에는 깊이가 끼어들지 않는다. */
export function doorOrder(N: NameRow[], ix: number[]): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  const sorted = ix.slice().sort((a, b) => (N[a]![3] === "p" ? 0 : 1) - (N[b]![3] === "p" ? 0 : 1));
  for (let i = 0; i < sorted.length; i++) {
    const id = N[sorted[i]!]![0];
    if (!seen[id]) { seen[id] = true; out.push(id); }
  }
  return out;
}

/** 브라우저에 싣는 한 덩어리 — 세 함수의 원문. */
export const DOOR_JS = [lpNorm, doorOrder, doorMatch].map((f) => f.toString()).join("\n");

/**
 * 문이 받는 색인 — 이름 줄과 책 제목 줄. 사람은 작가보다 책을 더 자주 기억한다(「데미안」을 치는 사람은 헤세를 찾는다).
 * 제목은 한국어 제목만 싣는다 — 원제까지 실으면 문을 두드릴 때 받는 파일이 두 배가 된다(색인 쪽은 원제로도 찾는다).
 */
export function buildNameIndex(
  authors: ReadonlyArray<{ id: string; depth?: string; names: { ko: string; original?: string; aliases: string[] } }>,
  works: ReadonlyArray<{ authorId: string; titleKo: string }>
): { n: NameRow[]; t: TitleRow[] } {
  const row = new Map(authors.map((a, i) => [a.id, i]));
  const n: NameRow[] = authors.map((a) => [a.id, a.names.ko, a.names.original, (a.depth ?? "plate")[0], ...(a.names.aliases.length ? [a.names.aliases] : [])] as NameRow);
  const t: TitleRow[] = works.filter((w) => row.has(w.authorId)).map((w) => [w.titleKo, row.get(w.authorId)!] as TitleRow);
  return { n, t };
}
