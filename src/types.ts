// Core domain types for Literary Planet.
// Data files under /literary-planet/data must conform to the Zod schemas in schema.ts,
// which mirror these types. Rendering code must never import data directly — it goes
// through src/data/load.ts so the data source can be swapped later.

export type PeriodId =
  // 2026-08-31 결정 (134): 고전 확장이 아래로 세 층을 연다. 최하층이
  // `roots 1850–1900` 이라 괴테·오스틴·발자크에게 정직한 층이 없었고,
  // 겹침 검사를 에러로 올린 뒤로는 그들을 **넣을 수 없었다**.
  | "antiquity-medieval"
  | "renaissance-baroque"
  | "enlightenment-romantic"
  | "roots"
  | "early-modernism"
  | "mid-century"
  | "late-postmodern"
  | "contemporary";

export type GenreId =
  | "fiction"
  | "poetry"
  | "drama"
  | "essay-criticism"
  // 2026-08-31 결정 (134). `epic` 은 일리아스·아이네이스·샤나메·마하바라타가
  // 갈 곳이 없어서, `history` 는 CPO 결재로 — 헤로도토스·사마천·플루타르코스를
  // 서울대 권장도서 100선이 문학으로 취급하고, 우리도 그렇게 한다.
  | "epic"
  | "history";

export type Tier = "anchor" | "major" | "context";

export type RelationType =
  | "documented_influence"
  | "translation"
  | "mentorship"
  | "dialogue"
  | "affinity"
  | "contrast";

export type EvidenceLevel = "documented" | "scholarly_consensus" | "editorial_inference";

export type ReviewStatus = "draft" | "reviewed" | "verified";

export type Gender = "female" | "male" | "other" | "unknown";

export type LocationRole = "birth" | "activity" | "exile" | "other";

export interface AuthorLocation {
  label: string;
  lat: number;
  lon: number;
  role: LocationRole;
  /** exactly one location per author is primary — used in geo mode */
  primary?: boolean;
  /** why this location was chosen as primary, when not obvious */
  note?: string;
}

export interface AuthorNames {
  ko: string;
  original: string;
  aliases: string[];
}

export interface Author {
  id: string;
  names: AuthorNames;
  /**
   * provider identifiers — the cross-corpus join key (never used as display).
   * Optional on drafts; required from reviewStatus 'reviewed' upward.
   */
  externalIds?: { wikidata: string };
  birthYear?: number;
  deathYear?: number;
  /** [from, to] — years of literary activity, not lifespan */
  activeRange: [number, number];
  /** representative year for timeline ordering (usually main-works midpoint) */
  anchorYear: number;
  gender: Gender;
  /** ISO 639-1 codes of primary writing languages */
  languages: string[];
  regions: string[];
  locations: AuthorLocation[];
  periods: PeriodId[];
  /**
   * 이 노드가 사람인가, 전승되는 텍스트 덩어리인가. 기본값 `person`.
   *
   * 2026-08-31 결정 (134). 목표 프레임의 20% 이상이 저자가 없다 — 길가메시·
   * 베오울프·롤랑의 노래·천일야화·향가·시경. **익명 작품에 가짜 저자 노드를
   * 만드는 것이 곧 지어내기이므로**, 그런 항목은 `corpus` 로 들어와 생몰년을
   * 비우고 `activeRange` 를 전승이 확인되는 구간으로 쓴다.
   */
  authorKind?: "person" | "corpus";
  movements: string[];
  genres: GenreId[];
  /** 사변소설·SF 계보 태그 (fiction 층 안의 독립 필터) */
  speculative?: boolean;
  tier: Tier;
  /** 왜 중요한가 — 구체적인 형식적·역사적 기여, 2–4문장 */
  importanceReason: string;
  /** work id of the recommended entry point */
  readingEntry: string;
  readingEntryReason?: string;
  /** ordered work ids; first item must equal readingEntry */
  readingOrder: string[];
  /** 피해야 할 잘못된 입문 경로 (있을 때만) */
  readingWarning?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  difficultyReason?: string;
  /** why fewer than 3 works are listed, when that is the case */
  worksException?: string;
  sourceIds: string[];
  reviewStatus: ReviewStatus;
  reviewedAt?: string;
}

/**
 * 작품 세계 (R12) — 책을 눌러 얻는 것이 한 문장(significance)뿐이던 자리에
 * 실물 자료로 쓴 한 장. 전부 출처를 달고, 여는 문장의 한국어는 **자체 번역**임을
 * 표시한다(기존 번역은 저작물이다).
 */
export interface WorkEdition {
  /** first-printing = 잡지·연감 첫 인쇄 · first-edition = 초판 단행본 */
  kind: "first-printing" | "first-edition";
  /** 잡지·연감 이름(first-printing 일 때) */
  venue?: string;
  publisher: string;
  place: string;
  year: number;
  month?: number;
  series?: string;
  note?: string;
  sourceIds: string[];
}

export interface WorkWorld {
  /** 여는 문장 — 원문 그대로(1–2문장)와 우리 번역 */
  opening: {
    original: string;
    ko: string;
    /** "self" = 이 프로젝트의 자체 번역. 다른 값은 아직 허용하지 않는다 */
    translation: "self";
    sourceId: string;
  };
  /** 집필 시기 — 서술형("1912년 9월 22–23일 밤") */
  written?: string;
  editions: WorkEdition[];
  /** 유고 출간 — 편집자와 경위 */
  posthumous?: { editor: string; note: string; sourceIds: string[] };
}

export interface Work {
  id: string;
  authorId: string;
  titleKo: string;
  titleOriginal: string;
  /** first publication year (original language) */
  year: number;
  /**
   * `year` 가 무엇인지. 생략 = `attested`(그 해에 나온 것이 확인됨).
   * 전승 문학에서 연도 한 칸은 "모른다"를 "안다"로 바꾸는 자리다 —
   * 길가메시·베오울프·향가에 확정 연도는 없다.
   */
  yearBasis?: "attested" | "composition-range" | "earliest-manuscript" | "first-print";
  genre: GenreId;
  speculative?: boolean;
  significance: string;
  sourceIds: string[];
  world?: WorkWorld;
}

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  direction: "directed" | "bidirectional";
  /** 0–1 relative strength; drives layout attraction and line emphasis */
  weight: number;
  /** 왜 연결했는가 — 1–3문장, 한국어 */
  summary: string;
  evidenceLevel: EvidenceLevel;
  sourceIds: string[];
  /**
   * 앵커 (R12) — 요약문이 지목하는 **구체적인 책·연도**. 산문을 파싱하지 않고 편집이
   * 손으로 적는다. 선이 하늘에서 작가의 서고로 내려올 때 어느 책·어느 연도 칸에
   * 닿는지를 정한다. 요약에 없는 사실은 적지 않는다(새 조사 0). 없으면 선은 이름에
   * 닿는다 — 그것도 정직한 독해다.
   */
  anchors?: RelationAnchor[];
}

export interface RelationAnchor {
  /** 관계의 어느 쪽 작가의 작품인가 — 보통 영향을 준 쪽 */
  workId?: string;
  /** 요약이 지목하는 연도(편지·서문·판본·에세이의 해) */
  year?: number;
}

export interface Source {
  id: string;
  title: string;
  publisherOrInstitution: string;
  /** https, domain-level or maintainer-verified only — never guessed deep links */
  url?: string;
  citation?: string;
  accessedAt?: string;
}

export interface Movement {
  id: string;
  ko: string;
  original?: string;
  description: string;
}

export interface TourStop {
  authorId: string;
  /** 2–4문장 안내 텍스트 */
  note: string;
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  stops: TourStop[];
}

/** @deprecated retired 2026-08-31 (결정 (135)) — kept only so old fixtures type-check until removed */
export interface PositionsFile {
  version: string;
  seed: number;
  generatedAt: string;
  /** author id → unit-sphere [x, y, z] */
  positions: Record<string, [number, number, number]>;
}

/**
 * One imagined-portrait record — data/portraits.json (thesis ④). The asset
 * lives at public/portraits/<authorId>.jpg as a grayscale plate.
 */
export interface PortraitEntry {
  authorId: string;
  mode: "face" | "object";
  rung: 1 | 2 | 3 | 4;
  motif: string | null;
  motifRationale: string | null;
  iconographyNote: string;
  prompt: string;
  seed: number;
  generatedAt: string;
  reviewStatus: "draft" | "reviewed";
}

// ---------------------------------------------------------------------------
// 판본 레이어 (2026-08-31) — data/editions.json
//
// `Work` 는 **작품**이지 판본이 아니다. 독자가 실제로 손에 넣는 것은 판본이고,
// 그 사실은 우리 코퍼스에 없었다(ISBN 0개). 이 레이어가 그 자리다.
//
// 기계 채움은 없다. 키 없는 공개 API 중 한국어 판본을 주는 것이 실측으로
// 없었고(구글 북스 익명 쿼터 소진 429 · 오픈라이브러리 한국어 판본 0),
// 하드 제약이 API 키를 금지한다. 그러므로 이 원장은 **손으로 검수해 넣고**,
// 넣지 않은 것은 넣지 않았다고 날짜와 함께 적는다.
// ---------------------------------------------------------------------------

/** 한국어(또는 그 밖의 언어) 판본 하나 — 검수된 것만 들어온다 */
export interface Edition {
  /** ISBN-13, 하이픈 없이. 체크섬이 맞아야 한다 */
  isbn13: string;
  /** 판본의 표제 (선집이면 작품명과 다를 수 있다) */
  title: string;
  publisher: string;
  /** 옮긴이 — 번역서가 아니면 생략 */
  translator?: string;
  year: number;
  /** BCP-47 기본 태그. 오늘은 "ko" 만 쓴다 */
  language: string;
  /** 원전 직역 / 중역 / 번안 — 번역서에는 반드시 적는다 */
  sourceTextBasis?: "original" | "relay" | "adaptation";
  /** 이 레코드를 어디서 확인했는가 — 사람이 읽는 한 줄 */
  verifiedFrom: string;
  /** 확인한 날짜 (YYYY-MM-DD) */
  verifiedAt: string;
  /** 절판·개정 같은 편집 메모 */
  note?: string;
}

/** data/editions.json — 작품 id → 검수된 판본들 */
export interface EditionsFile {
  version: string;
  /** 원장 전체를 마지막으로 훑은 날 — 부재를 날짜 붙은 사실로 만든다 */
  checkedAt: string;
  note: string;
  editions: Record<string, Edition[]>;
  /** 없음의 원장 — 찾지 못한 작품을 날짜·뒤진 곳과 함께 적는다 */
  absent?: Record<string, { checkedAt: string; searched: string[]; note?: string }>;
}

export interface RegistryEntry {
  id: string;
  ko: string;
  original: string;
  /** primary layer used for batching; authors may span more periods in their profile */
  layer: PeriodId;
  tier: Tier;
  batch: string;
}

// ---------------------------------------------------------------------------
// Translations — editorial content in additional locales. The default locale
// (ko) lives on the records themselves; every other locale is a pack under
// data/translations/<locale>/. Graph topology never depends on any of this.
// ---------------------------------------------------------------------------

export interface AuthorTranslation {
  id: string;
  /** display name in this locale (e.g. standard English romanization) */
  name: string;
  aliases?: string[];
  importanceReason: string;
  readingEntryReason?: string;
  readingWarning?: string;
  difficultyReason?: string;
  worksException?: string;
}

export interface WorkTranslation {
  id: string;
  /** established title in this locale (e.g. "Snow Country") */
  title: string;
  significance: string;
}

export interface RelationTranslation {
  id: string;
  summary: string;
}

export interface MovementTranslation {
  id: string;
  name: string;
  description: string;
}

export interface TourTranslation {
  id: string;
  title: string;
  description: string;
  /** parallel to the tour's stops array, same length */
  stopNotes: string[];
}

export interface LocalePack {
  locale: string;
  authors: AuthorTranslation[];
  works: WorkTranslation[];
  relations: RelationTranslation[];
  movements: MovementTranslation[];
  tours: TourTranslation[];
}

export interface Dataset {
  authors: Author[];
  works: Work[];
  relations: Relation[];
  sources: Source[];
  movements: Movement[];
  tours: Tour[];
  registry: RegistryEntry[];
  translations: LocalePack[];
  /** imagined-portrait editorial records, empty until the pilot */
  portraits: PortraitEntry[];
  /** 검수된 판본 원장 — 비어 있을 수 있고, 비어 있음도 사실이다 */
  editions: EditionsFile;
}

// ---------------------------------------------------------------------------
// Display registries (single source for labels used across UI + reports)
// ---------------------------------------------------------------------------

export const PERIOD_DEFS: ReadonlyArray<{
  id: PeriodId;
  ko: string;
  en: string;
  /** first-token style short forms for dense tables */
  shortKo: string;
  shortEn: string;
  range: [number, number];
  defaultOn: boolean;
  description: string;
  descriptionEn: string;
}> = [
  {
    id: "antiquity-medieval",
    ko: "고대·중세 –1400",
    en: "Antiquity & the Middle Ages –1400",
    shortKo: "고대·중세",
    shortEn: "Antiquity",
    range: [-3000, 1400],
    defaultOn: false,
    description:
      "서사시·비극·경전·기행이 문학의 형식을 처음 정한 시기. 저자가 없는 작품과 여러 세기에 걸쳐 전승된 텍스트가 여기 모인다.",
    descriptionEn:
      "When epic, tragedy, scripture and travel first fixed the forms of literature. Anonymous works and texts transmitted across centuries gather here."
  },
  {
    id: "renaissance-baroque",
    ko: "르네상스·바로크 1400–1700",
    en: "Renaissance & Baroque 1400–1700",
    shortKo: "르네상스",
    shortEn: "Renaissance",
    range: [1400, 1700],
    defaultOn: false,
    description: "인쇄술이 독자를 만들고, 희곡과 소설이 지금 우리가 아는 모양을 얻은 시기.",
    descriptionEn:
      "Print made readers, and drama and the novel took the shape we still recognise."
  },
  {
    id: "enlightenment-romantic",
    ko: "계몽·낭만 1700–1850",
    en: "Enlightenment & Romanticism 1700–1850",
    shortKo: "계몽·낭만",
    shortEn: "Enlightenment",
    range: [1700, 1850],
    defaultOn: false,
    description:
      "'세계문학'이라는 말이 이 시기에 만들어졌다. 소설이 지배 형식이 되고, 개인의 내면이 문학의 주제가 된다.",
    descriptionEn:
      "The phrase 'world literature' was coined here. The novel became the dominant form and the private self became a subject."
  },
  {
    id: "roots",
    ko: "뿌리층 1850–1900",
    en: "Roots 1850–1900",
    shortKo: "뿌리층",
    shortEn: "Roots",
    range: [1850, 1900],
    defaultOn: true,
    description: "20세기 문학을 가능하게 한 사실주의·상징주의·근대극·심리소설의 전사.",
    descriptionEn:
      "The prehistory that made 20th-century literature possible: realism, symbolism, modern drama, the psychological novel."
  },
  {
    id: "early-modernism",
    ko: "초기 모더니즘 1890–1945",
    en: "Early Modernism 1890–1945",
    shortKo: "초기",
    shortEn: "Early",
    range: [1890, 1945],
    defaultOn: true,
    description: "고도 모더니즘과 아방가르드, 동아시아 근대문학, 혁명과 식민지의 문학.",
    descriptionEn:
      "High modernism and the avant-garde, East Asian modern literature, the literature of revolution and colony."
  },
  {
    id: "mid-century",
    ko: "중기 현대문학 1930–1970",
    en: "Mid-Century 1930–1970",
    shortKo: "중기",
    shortEn: "Mid-Century",
    range: [1930, 1970],
    defaultOn: true,
    description: "전쟁 이후, 실존주의와 부조리, 탈식민주의, 라틴아메리카 붐의 전개.",
    descriptionEn:
      "After the wars: existentialism and the absurd, decolonization, the unfolding of the Latin American Boom."
  },
  {
    id: "late-postmodern",
    ko: "후기·포스트모던 1960–2000",
    en: "Late & Postmodern 1960–2000",
    shortKo: "후기",
    shortEn: "Late",
    range: [1960, 2000],
    defaultOn: true,
    description: "메타픽션, 사변소설, 기억문학, 후기 자본주의와 매체의 문학.",
    descriptionEn:
      "Metafiction, speculative fiction, the literature of memory, late capitalism and its media."
  },
  {
    id: "contemporary",
    ko: "21세기 후속층 1990–현재",
    en: "Contemporary 1990–present",
    shortKo: "21세기",
    shortEn: "Contemporary",
    range: [1990, 2026],
    defaultOn: false,
    description: "정전화가 진행 중인 확장층. 기본적으로 꺼져 있다.",
    descriptionEn: "An extension layer still being canonized. Off by default."
  }
];

export const GENRE_DEFS: ReadonlyArray<{
  id: GenreId;
  ko: string;
  en: string;
  defaultOn: boolean;
}> = [
  { id: "fiction", ko: "소설·단편", en: "Fiction", defaultOn: true },
  { id: "poetry", ko: "시", en: "Poetry", defaultOn: true },
  { id: "drama", ko: "희곡", en: "Drama", defaultOn: true },
  { id: "essay-criticism", ko: "에세이·비평", en: "Essay & criticism", defaultOn: true },
  { id: "epic", ko: "서사시", en: "Epic", defaultOn: true },
  { id: "history", ko: "역사·전기", en: "History & biography", defaultOn: true }
];

export const RELATION_DEFS: ReadonlyArray<{
  id: RelationType;
  ko: string;
  en: string;
  short: string;
  shortEn: string;
  direction: "directed" | "bidirectional";
  /** evidence levels this type may carry */
  levels: ReadonlyArray<EvidenceLevel>;
  sourcesRequired: boolean;
  /** line rendering: solid or dashed — never color alone */
  dashed: boolean;
  defaultOn: boolean;
  description: string;
  descriptionEn: string;
}> = [
  {
    id: "documented_influence",
    ko: "확인된 직접 영향",
    en: "Documented influence",
    short: "직접 영향",
    shortEn: "influence",
    direction: "directed",
    levels: ["documented", "scholarly_consensus"],
    sourcesRequired: true,
    dashed: false,
    defaultOn: true,
    description: "서신·인터뷰·회고록·명시적 독서 기록, 또는 학계가 반복적으로 다루는 계보.",
    descriptionEn:
      "Letters, interviews, memoirs, explicit reading records — or a lineage scholarship keeps returning to."
  },
  {
    id: "translation",
    ko: "번역·소개",
    en: "Translation & introduction",
    short: "번역",
    shortEn: "translation",
    direction: "directed",
    levels: ["documented"],
    sourcesRequired: true,
    dashed: false,
    defaultOn: true,
    description: "한 작가가 다른 작가를 번역하거나 자기 언어권에 소개한 확인된 사실.",
    descriptionEn:
      "A confirmed fact of one writer translating another, or introducing them to their own language."
  },
  {
    id: "mentorship",
    ko: "사사·후원",
    en: "Mentorship & patronage",
    short: "사사",
    shortEn: "mentorship",
    direction: "directed",
    levels: ["documented"],
    sourcesRequired: true,
    dashed: false,
    defaultOn: true,
    description: "스승-제자 관계, 편집자적 후원, 등단 지원 같은 확인된 인적 관계.",
    descriptionEn:
      "Confirmed personal relationships: teacher and student, editorial patronage, help into print."
  },
  {
    id: "dialogue",
    ko: "교류·논쟁",
    en: "Dialogue & debate",
    short: "대화",
    shortEn: "dialogue",
    direction: "bidirectional",
    levels: ["documented", "scholarly_consensus"],
    sourcesRequired: true,
    dashed: false,
    defaultOn: true,
    description: "동시대의 실질적 교류, 우정, 공개 논쟁, 비판적 대화.",
    descriptionEn: "Substantive contemporary exchange: friendship, public argument, critical dialogue."
  },
  {
    id: "affinity",
    ko: "형식적·주제적 친연성",
    en: "Formal & thematic affinity",
    short: "친연성",
    shortEn: "affinity",
    direction: "bidirectional",
    levels: ["scholarly_consensus", "editorial_inference"],
    sourcesRequired: false,
    dashed: true,
    defaultOn: true,
    description: "직접 접촉의 근거는 없으나 형식·주제·문제의식이 가까워 비교되는 관계. 이 지도의 편집적 판단이 포함된다.",
    descriptionEn:
      "No evidence of direct contact, but form, theme, or concern sit close enough to compare. Includes this map's editorial judgment."
  },
  {
    id: "contrast",
    ko: "대조·반대항",
    en: "Contrast & counterpoint",
    short: "대조",
    shortEn: "contrast",
    direction: "bidirectional",
    levels: ["scholarly_consensus", "editorial_inference"],
    sourcesRequired: false,
    dashed: true,
    defaultOn: false,
    description: "같은 문제에 반대 방향으로 답해 서로를 비추는 관계.",
    descriptionEn: "Writers who answer the same question in opposite directions, and so illuminate each other."
  }
];

export const EVIDENCE_LEVEL_KO: Record<EvidenceLevel, string> = {
  documented: "문서로 확인됨",
  scholarly_consensus: "학계에서 널리 논의됨",
  editorial_inference: "편집적 친연성 (이 지도의 판단)"
};

export const EVIDENCE_LEVEL_EN: Record<EvidenceLevel, string> = {
  documented: "Documented",
  scholarly_consensus: "Widely discussed in scholarship",
  editorial_inference: "Editorial affinity (this map's judgment)"
};

export const REVIEW_STATUS_KO: Record<ReviewStatus, string> = {
  draft: "초안 (검토 전)",
  reviewed: "검토됨 (기계 검증 + 편집 검토)",
  verified: "확증됨 (외부 검증)"
};

export const REVIEW_STATUS_EN: Record<ReviewStatus, string> = {
  draft: "Draft (pre-review)",
  reviewed: "Reviewed (machine checks + editorial review)",
  verified: "Verified (external verification)"
};

export const REGION_DEFS: ReadonlyArray<{ id: string; ko: string; en: string }> = [
  { id: "western-europe", ko: "서유럽", en: "Western Europe" },
  { id: "central-europe", ko: "중부유럽", en: "Central Europe" },
  { id: "eastern-europe", ko: "동유럽", en: "Eastern Europe" },
  { id: "russia", ko: "러시아", en: "Russia" },
  { id: "britain-ireland", ko: "영국·아일랜드", en: "Britain & Ireland" },
  { id: "nordic", ko: "북유럽", en: "Nordic countries" },
  { id: "iberia", ko: "이베리아", en: "Iberia" },
  { id: "italy", ko: "이탈리아", en: "Italy" },
  { id: "north-america", ko: "북미", en: "North America" },
  { id: "latin-america", ko: "라틴아메리카", en: "Latin America" },
  { id: "caribbean", ko: "카리브", en: "Caribbean" },
  { id: "east-asia", ko: "동아시아", en: "East Asia" },
  { id: "south-asia", ko: "남아시아", en: "South Asia" },
  { id: "middle-east-north-africa", ko: "중동·북아프리카", en: "Middle East & North Africa" },
  { id: "sub-saharan-africa", ko: "사하라 이남 아프리카", en: "Sub-Saharan Africa" },
  { id: "oceania", ko: "오세아니아", en: "Oceania" },
  // 2026-08-31 결정 (134) — 고전 확장이 필요로 하는 권역. 남아 있던 공백이
  // 우연이 아니라 20세기 코퍼스의 지문이었다.
  { id: "central-asia", ko: "중앙아시아", en: "Central Asia" },
  { id: "southeast-asia", ko: "동남아시아", en: "Southeast Asia" },
  { id: "anatolia", ko: "아나톨리아", en: "Anatolia" },
  { id: "mesoamerica", ko: "메소아메리카", en: "Mesoamerica" },
  { id: "andes", ko: "안데스", en: "The Andes" },
  { id: "east-africa", ko: "동아프리카", en: "East Africa" },
  { id: "horn-of-africa", ko: "아프리카의 뿔", en: "Horn of Africa" }
];

export const LANGUAGE_LABELS: Record<string, string> = {
  // ── 2026-08-31 결정 (134): 고전이 요구하는 언어 ──────────────────────────
  // 전부 실재하는 ISO 639 코드다. 코드를 발명하지 않는다 — 발명이 곧 지어내기다.
  // `zh` 하나가 상고 한문·문언·백화를 덮던 문제는 `lzh`(문언문)로 나눈다.
  // 같은 이유로 `ojp`(상대 일본어)·`okm`(중세 한국어)를 둔다.
  la: "라틴어",
  grc: "고대 그리스어",
  el: "그리스어",
  sa: "산스크리트",
  pi: "팔리어",
  ta: "타밀어",
  he: "히브리어",
  nl: "네덜란드어",
  tr: "튀르키예어",
  chg: "차가타이어",
  gez: "게에즈어",
  sw: "스와힐리어",
  nah: "나우아틀어",
  qu: "케추아어",
  haw: "하와이어",
  non: "고대 노르드어",
  enm: "중세 영어",
  ang: "고대 영어",
  fro: "고대 프랑스어",
  gmh: "중세 고지 독일어",
  lzh: "문언문(한문)",
  ojp: "상대 일본어",
  okm: "중세 한국어",
  ar: "아랍어",
  bn: "벵골어",
  cs: "체코어",
  de: "독일어",
  en: "영어",
  es: "스페인어",
  fa: "페르시아어",
  fr: "프랑스어",
  hi: "힌디어",
  it: "이탈리아어",
  ja: "일본어",
  ki: "기쿠유어",
  ko: "한국어",
  no: "노르웨이어",
  pl: "폴란드어",
  pt: "포르투갈어",
  ru: "러시아어",
  sv: "스웨덴어",
  ur: "우르두어",
  yi: "이디시어",
  zh: "중국어"
};

export const LANGUAGE_LABELS_EN: Record<string, string> = {
  la: "Latin",
  grc: "Ancient Greek",
  el: "Greek",
  sa: "Sanskrit",
  pi: "Pali",
  ta: "Tamil",
  he: "Hebrew",
  nl: "Dutch",
  tr: "Turkish",
  chg: "Chagatai",
  gez: "Geʽez",
  sw: "Swahili",
  nah: "Nahuatl",
  qu: "Quechua",
  haw: "Hawaiian",
  non: "Old Norse",
  enm: "Middle English",
  ang: "Old English",
  fro: "Old French",
  gmh: "Middle High German",
  lzh: "Literary Chinese",
  ojp: "Old Japanese",
  okm: "Middle Korean",
  ar: "Arabic",
  bn: "Bengali",
  cs: "Czech",
  de: "German",
  en: "English",
  es: "Spanish",
  fa: "Persian",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  ki: "Gikuyu",
  ko: "Korean",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ru: "Russian",
  sv: "Swedish",
  ur: "Urdu",
  yi: "Yiddish",
  zh: "Chinese"
};

export const GENDER_KO: Record<Gender, string> = {
  female: "여성",
  male: "남성",
  other: "기타",
  unknown: "미상"
};

export const GENDER_EN: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  unknown: "Unknown"
};

export const TIER_LABELS: Record<"ko" | "en", Record<Tier, string>> = {
  ko: { anchor: "앵커", major: "주요", context: "맥락" },
  en: { anchor: "Anchor", major: "Major", context: "Context" }
};
