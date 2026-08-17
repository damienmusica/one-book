// Core domain types for Literary Planet.
// Data files under /literary-planet/data must conform to the Zod schemas in schema.ts,
// which mirror these types. Rendering code must never import data directly — it goes
// through src/data/load.ts so the data source can be swapped later.

export type PeriodId =
  | "roots"
  | "early-modernism"
  | "mid-century"
  | "late-postmodern"
  | "contemporary";

export type GenreId = "fiction" | "poetry" | "drama" | "essay-criticism";

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
  movements: string[];
  genres: GenreId[];
  /** 사변소설·SF 계보 태그 (fiction 층 안의 독립 필터) */
  speculative?: boolean;
  tier: Tier;
  /** 왜 중요한가 — 구체적인 형식적·역사적 기여, 2–4문장 */
  importanceReason: string;
  /** work id of the recommended entry point */
  readingEntry: string;
  readingEntryReason: string;
  /** ordered work ids; first item must equal readingEntry */
  readingOrder: string[];
  /** 피해야 할 잘못된 입문 경로 (있을 때만) */
  readingWarning?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  difficultyReason: string;
  /** why fewer than 3 works are listed, when that is the case */
  worksException?: string;
  sourceIds: string[];
  reviewStatus: ReviewStatus;
  reviewedAt?: string;
}

export interface Work {
  id: string;
  authorId: string;
  titleKo: string;
  titleOriginal: string;
  /** first publication year (original language) */
  year: number;
  genre: GenreId;
  speculative?: boolean;
  significance: string;
  sourceIds: string[];
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

/** Frozen deterministic layout — data/positions.v1.json */
export interface PositionsFile {
  version: string;
  seed: number;
  generatedAt: string;
  /** author id → unit-sphere [x, y, z] */
  positions: Record<string, [number, number, number]>;
}

/**
 * Renderer-facing terrain bake inside data/territory.v1.json. Polylines are
 * flat [x0,y0,…] arrays in equirect grid coordinates (x wraps at gridWidth);
 * ownerRle rows are [count, value, …] with 0 = sea, k > 0 = authors[k−1].
 */
export interface TerritoryCities {
  /** [x, y] coast town where the reading enters; null for landlocked realms */
  port: [number, number] | null;
  portWork: string | null;
  towns: Array<{ id: string; x: number; y: number }>;
  /** reading route: port (or capital) → readingOrder towns, flat [x,y,…] */
  road: number[];
}

export interface TerritoryGeometry {
  gridWidth: number;
  gridHeight: number;
  authors: string[];
  coast: number[][];
  waterlines: {
    gridWidth: number;
    gridHeight: number;
    isoFactors: [number, number];
    inner: number[][];
    outer: number[][];
  };
  boundaries: number[][];
  ownerRle: number[][];
  cities: Record<string, TerritoryCities>;
}

/**
 * One imagined-portrait record — data/portraits.json (thesis ④). The asset
 * lives at public/portraits/<authorId>.jpg as a grayscale plate; the app maps
 * it to duotone tokens at render time.
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

/**
 * Plate-tectonics keyframes — data/territory.v1.eras.json (baked by
 * scripts/generate-territory-eras.ts). Each keyframe is a nested erosion of
 * the frozen v1 plate: same grid, ownerRle convention, and coast polyline
 * format; the tectonic contract (determinism, terminal identity, monotone
 * growth) is asserted at bake time and CI-gated by tests.
 */
export interface TerritoryEras {
  version: string;
  derivedFrom: string;
  seed: number;
  params: {
    gMin: number;
    foundingRamp: number;
    jitterRad: number;
    growth: string;
    erosion: string;
  };
  keyframes: Array<{ year: number; ownerRle: number[][]; coast: number[][] }>;
}

/** Frozen terrain — data/territory.v1.json (baked by scripts/generate-terrain.ts) */
export interface Territory {
  version: string;
  seed: number;
  generatedAt: string;
  params: {
    R0: number;
    tau: number;
    warpAmp: number;
    warpFreq: number;
    warpOctaves: number;
    kappa: string;
    areaWeight: string;
  };
  landFraction: number;
  weights: Record<string, number>;
  areaShares: Record<string, number>;
  geometry: TerritoryGeometry;
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
  readingEntryReason: string;
  readingWarning?: string;
  difficultyReason: string;
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
  positions: PositionsFile;
  registry: RegistryEntry[];
  translations: LocalePack[];
  /** frozen terrain bake, null until generated */
  territory: Territory | null;
  /** v2.5 plate-tectonics keyframes (nested erosion of the v1 plate), null until baked */
  territoryEras: TerritoryEras | null;
  /** imagined-portrait editorial records, empty until the pilot */
  portraits: PortraitEntry[];
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
  { id: "essay-criticism", ko: "에세이·비평", en: "Essay & criticism", defaultOn: true }
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
  { id: "oceania", ko: "오세아니아", en: "Oceania" }
];

export const LANGUAGE_LABELS: Record<string, string> = {
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
