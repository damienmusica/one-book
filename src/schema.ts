import { z } from "zod";
import {
  GENRE_DEFS,
  PERIOD_DEFS,
  REGION_DEFS,
  RELATION_DEFS,
  LANGUAGE_LABELS
} from "./types.ts";
import type { GenreId, PeriodId, RelationType } from "./types.ts";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUTHOR_ID = SLUG;
const WORK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELATION_ID =
  /^(influence|translation|mentorship|dialogue|affinity|contrast)--[a-z0-9-]+--[a-z0-9-]+$/;
const SOURCE_ID = /^src--[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const periodIds = PERIOD_DEFS.map((p) => p.id) as [PeriodId, ...PeriodId[]];
const genreIds = GENRE_DEFS.map((g) => g.id) as [GenreId, ...GenreId[]];
const relationTypes = RELATION_DEFS.map((r) => r.id) as [RelationType, ...RelationType[]];
const regionIds = new Set(REGION_DEFS.map((r) => r.id));
const languageCodes = new Set(Object.keys(LANGUAGE_LABELS));

// ── 연도 (2026-08-31, 결정 (134) — 고전 확장) ────────────────────────────────
//
// 하나였던 `year`(1700–2030)가 셰익스피어·세르반테스·무라사키를 Zod 단계에서
// 죽이고 있었다. 그리고 그 선은 문학적 경계가 아니라 사고였다 — 루소(1712)는
// 통과하고 **볼테르(1694)는 실패**했다.
//
// 그렇다고 일괄로 풀면 안 된다. 같은 상수가 **초간 연도**에도 걸려 있어서,
// 하한을 -3000 으로 내리면 초판이 기원전 800년이라고 적어도 통과한다. 오늘
// 오타를 잡던 검사가 약해지는 것이다. 그래서 타입을 나눈다 — `editionSchema.year`
// 가 이미 `min(1900)` 으로 분리돼 있었다는 선례를 따른다.
//
//   lifeYear   생몰·활동·기준 연도. 기원전을 음수로 적는다(호메로스 -750 등).
//   workYear   작품의 연도. 전승 문학은 `yearBasis` 로 그 수가 무엇인지 말한다.
//   printYear  인쇄본이 나온 해. 구텐베르크 이전은 없다.
const lifeYear = z.number().int().min(-3000).max(2030);
const workYear = z.number().int().min(-3000).max(2030);
const printYear = z.number().int().min(1400).max(2030);

/** 뒤 호환용 별칭 — 관계 앵커의 연도는 작품 연도와 같은 축이다 */
const year = workYear;

export const locationSchema = z
  .object({
    label: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    role: z.enum(["birth", "activity", "exile", "other"]),
    primary: z.boolean().optional(),
    note: z.string().min(1).optional()
  })
  .strict();

// ── 깊이 등급 (2026-09-04, 결정 (137)) ──────────────────────────────────────
//
// **존재는 공짜고, 깊이는 점진적이다.**
//
// 2026-08-15 부터 이 코퍼스는 "작가 1인 = 산문 3,742자 + 작품 3편 + 출처 + 입문 순서"를
// 존재의 조건으로 요구했다. 그 조건이 세계문학을 100명에서 멈춰 세웠다 — 큐레이션이
// 모자라서가 아니라 **바닥이 존재를 막았기 때문**이다.
//
// 도감은 반대로 작동한다. 151마리는 첫날부터 전부 거기 있고, 만나지 않은 것은 실루엣으로
// 보인다. 당신은 모르는 것의 **모양**을 안다. 그래서 세 등급을 둔다:
//
//   silhouette  이름·생몰·언어·권역·시대. 작품 0편, 산문 0자. **지도 위의 자리.**
//   sketch      + 왜 중요한가 한 문장 + 대표작 몇 편.
//   plate       현행 100인 — 입문 순서·난도·경고·출처까지 갖춘 도판.
//
// 정직성은 그대로다: 실루엣은 **실루엣이라고 화면에 적는다**. 우리가 아는 것만 말하고,
// 모르는 것은 모른다고 적는다. 줄인 것은 정직성이 아니라 **입장 요건**이다.
export const DEPTHS = ["silhouette", "sketch", "plate"] as const;
export type Depth = (typeof DEPTHS)[number];

export const authorSchema = z
  .object({
    id: z.string().regex(AUTHOR_ID),
    names: z
      .object({
        ko: z.string().min(1),
        original: z.string().min(1),
        aliases: z.array(z.string().min(1))
      })
      .strict(),
    // tool-populated (scripts/backfill-qids.ts resolves live); generators must
    // never invent QIDs from memory. Optional on drafts, required for reviewed+
    // (enforced in assemble).
    externalIds: z.object({ wikidata: z.string().regex(/^Q\d+$/) }).strict().optional(),
    /** 생략 = plate (기존 100인). 아래 superRefine 이 등급별 요건을 건다. */
    depth: z.enum(DEPTHS).optional(),
    birthYear: lifeYear.optional(),
    deathYear: lifeYear.optional(),
    // 사람이 아닌 항목(익명 전승)은 `corpus`. 그때 생몰년은 비고 activeRange 가
    // 전승 확인 구간이 된다 — 없는 저자를 만들어 넣지 않기 위한 유일한 장치다.
    authorKind: z.enum(["person", "corpus"]).optional(),
    activeRange: z.tuple([lifeYear, lifeYear]),
    anchorYear: lifeYear,
    gender: z.enum(["female", "male", "other", "unknown"]),
    languages: z
      .array(z.string().refine((c) => languageCodes.has(c), { message: "unknown language code" }))
      .min(1),
    regions: z
      .array(z.string().refine((r) => regionIds.has(r), { message: "unknown region id" }))
      .min(1),
    locations: z.array(locationSchema).default([]),
    periods: z.array(z.enum(periodIds)).min(1),
    movements: z.array(z.string().regex(SLUG)).default([]),
    genres: z.array(z.enum(genreIds)).default([]),
    speculative: z.boolean().optional(),
    tier: z.enum(["anchor", "major", "context"]),
    // 2026-08-31 결정 (135): 바닥은 "문장 하나"다. 60자(2–4문장)·30자·20자는 백과사전
    // 항목의 바닥이었고, 그 바닥이 작가 1인 = 3,742자를 만들어 16일간 관계 순증 0을
    // 낳았다. 목적은 독서 안내다 — 한 줄의 이유가 없는 것보다 낫고, 네 문장은 나중에
    // 자란다. 검증기는 형태(비어 있지 않음)만 보고 깊이는 편집이 본다.
    importanceReason: z.string().min(10).optional(),
    readingEntry: z.string().regex(WORK_ID).optional(),
    readingEntryReason: z.string().min(10).optional(),
    readingOrder: z.array(z.string().regex(WORK_ID)).default([]),
    readingWarning: z.string().min(10).optional(),
    difficulty: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .optional(),
    difficultyReason: z.string().min(10).optional(),
    worksException: z.string().min(10).optional(),
    sourceIds: z.array(z.string().regex(SOURCE_ID)).default([]),
    reviewStatus: z.enum(["draft", "reviewed", "verified"]),
    reviewedAt: z.string().regex(ISO_DATE).optional()
  })
  .strict()
  .superRefine((a, ctx) => {
    const depth: Depth = a.depth ?? "plate";
    const need = (cond: boolean, path: string, msg: string) => {
      if (!cond) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: msg });
    };
    if (depth === "silhouette") {
      // 실루엣은 **검수된 것이 아니다.** 검수를 주장하려면 도판이어야 한다.
      need(a.reviewStatus === "draft", "reviewStatus", "silhouette 은 draft 여야 한다 — 검수를 주장하지 않는다");
      need(a.readingOrder.length === 0, "readingOrder", "silhouette 에는 입문 순서가 없다 (작품이 없다)");
      need(a.readingEntry === undefined, "readingEntry", "silhouette 에는 입문작이 없다");
      return;
    }
    // sketch 이상 — 왜 중요한가는 있어야 한다
    need(a.importanceReason !== undefined, "importanceReason", `${depth} 는 importanceReason 이 필요하다`);
    if (depth === "plate") {
      need(a.locations.length > 0, "locations", "plate 는 장소가 필요하다");
      need(a.genres.length > 0, "genres", "plate 는 장르가 필요하다");
      need(a.difficulty !== undefined, "difficulty", "plate 는 난도가 필요하다");
      need(a.sourceIds.length > 0, "sourceIds", "plate 는 출처가 필요하다");
      need(a.readingEntry !== undefined, "readingEntry", "plate 는 입문작이 필요하다");
      need(a.readingOrder.length > 0, "readingOrder", "plate 는 입문 순서가 필요하다");
    }
  });



const workEditionSchema = z
  .object({
    kind: z.enum(["first-printing", "first-edition"]),
    venue: z.string().min(1).optional(),
    publisher: z.string().min(1),
    place: z.string().min(1),
    year: printYear,
    month: z.number().int().min(1).max(12).optional(),
    series: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    sourceIds: z.array(z.string().regex(SOURCE_ID)).min(1)
  })
  .strict();

export const workWorldSchema = z
  .object({
    opening: z
      .object({
        original: z.string().min(10),
        ko: z.string().min(5),
        translation: z.literal("self"),
        sourceId: z.string().regex(SOURCE_ID)
      })
      .strict(),
    written: z.string().min(2).optional(),
    editions: z.array(workEditionSchema).min(1),
    posthumous: z
      .object({
        editor: z.string().min(1),
        note: z.string().min(10),
        sourceIds: z.array(z.string().regex(SOURCE_ID)).min(1)
      })
      .strict()
      .optional()
  })
  .strict();

export const workSchema = z
  .object({
    id: z.string().regex(WORK_ID),
    authorId: z.string().regex(AUTHOR_ID),
    titleKo: z.string().min(1),
    titleOriginal: z.string().min(1),
    year: workYear,
    // 그 수가 무엇인지 말한다. 전승 문학에서 연도 한 칸은 "모른다"를 "안다"로
    // 바꾸는 자리다 — 길가메시·베오울프·향가에 확정 연도는 없다. 생략하면
    // `attested`(그 해에 나온 것이 확인됨)로 읽는다.
    yearBasis: z
      .enum(["attested", "composition-range", "earliest-manuscript", "first-print"])
      .optional(),
    genre: z.enum(genreIds),
    speculative: z.boolean().optional(),
    significance: z.string().min(30),
    sourceIds: z.array(z.string().regex(SOURCE_ID)),
    world: workWorldSchema.optional()
  })
  .strict();

export const relationSchema = z
  .object({
    id: z.string().regex(RELATION_ID),
    sourceId: z.string().regex(AUTHOR_ID),
    targetId: z.string().regex(AUTHOR_ID),
    type: z.enum(relationTypes),
    direction: z.enum(["directed", "bidirectional"]),
    weight: z.number().min(0).max(1),
    // 관계는 이 제품의 핵심 가치인데 그 엣지가 가장 비싸서 263에서 멈췄다(결정 (135)).
    // 한 줄이면 선을 그을 수 있다. 근거 수준은 그대로 요구한다 — 그건 enum 하나라 싸고,
    // 정직성은 길이가 아니라 그 한 칸에 있다.
    summary: z.string().min(10),
    evidenceLevel: z.enum(["documented", "scholarly_consensus", "editorial_inference"]),
    sourceIds: z.array(z.string().regex(SOURCE_ID)),
    anchors: z
      .array(
        z
          .object({ workId: z.string().regex(WORK_ID).optional(), year: year.optional() })
          .strict()
          .refine((a) => a.workId !== undefined || a.year !== undefined, "an anchor names a work or a year")
      )
      .optional()
  })
  .strict();

export const sourceSchema = z
  .object({
    id: z.string().regex(SOURCE_ID),
    title: z.string().min(1),
    publisherOrInstitution: z.string().min(1),
    url: z.string().url().startsWith("https://").optional(),
    citation: z.string().min(1).optional(),
    accessedAt: z.string().regex(ISO_DATE).optional()
  })
  .strict();

export const movementSchema = z
  .object({
    id: z.string().regex(SLUG),
    ko: z.string().min(1),
    original: z.string().min(1).optional(),
    description: z.string().min(20)
  })
  .strict();

export const tourSchema = z
  .object({
    id: z.string().regex(SLUG),
    title: z.string().min(1),
    description: z.string().min(20),
    stops: z
      .array(
        z
          .object({
            authorId: z.string().regex(AUTHOR_ID),
            note: z.string().min(60, "tour note must be 2–4 sentences")
          })
          .strict()
      )
      .min(4)
      .max(12)
  })
  .strict();


// --- 판본 원장 (2026-08-31) ------------------------------------------------
// 지어내지 않는다의 기계 판본: ISBN 은 체크섬이 맞아야 하고, 모든 레코드는
// **어디서 확인했는지와 언제 확인했는지**를 들고 와야 한다. 확인 없이 들어온
// 판본은 존재하지 않는 판본이다.

/** ISBN-13 체크섬 — 마지막 자리는 앞 12자리가 정한다 */
export function isbn13Valid(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

export const editionSchema = z
  .object({
    isbn13: z.string().refine(isbn13Valid, { message: "ISBN-13 체크섬이 맞지 않는다" }),
    title: z.string().min(1),
    publisher: z.string().min(1),
    translator: z.string().min(1).optional(),
    year: z.number().int().min(1900).max(2100),
    language: z.string().min(2),
    /**
     * 이 판본이 무엇에서 왔는가. 2026-08-31 결정 (134).
     *
     * `original` 원전 직역 · `relay` 중역(제3언어를 경유) · `adaptation` 번안·재화.
     * 이걸 적지 않으면 "한국어로 읽을 수 있다"는 표시 자체가 독자를 속인다 —
     * 조사 실측: 김난주 겐지=세토우치 현대어역의 중역, 부희령 샤나메=Zimmern
     * 영역 축약, 윤준 루바이야트=FitzGerald 번안, 임호경 천일야화=갈랑 프랑스어판.
     * 번역서에는 필수다(원어가 한국어면 생략).
     */
    sourceTextBasis: z.enum(["original", "relay", "adaptation"]).optional(),
    verifiedFrom: z.string().min(4),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().min(1).optional()
  })
  .strict();

export const editionsFileSchema = z
  .object({
    version: z.string().min(1),
    checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().min(1),
    editions: z.record(z.string(), z.array(editionSchema).min(1)),
    /**
     * **없음의 원장** (2026-08-31 결정 (134), CPO: "판본 없는 작가도 남겨").
     *
     * 한국어 판본을 찾지 못한 작품은 지도에서 지우지 않는다 — 이름을 두고
     * "찾지 못했다"를 **날짜와 어디를 뒤졌는지와 함께** 적는다. 산문으로 적으면
     * 기계가 못 읽고 늙은 확인이 스스로 드러나지 않으므로 타입을 준다.
     *
     * `searched` 는 실제로 뒤진 목록의 이름이다. 한 곳만 뒤지고 "없음"이라
     * 적는 것이 이 원장이 막으려는 바로 그 일이다(실측: 서양의 "없음" 99건은
     * 2종 전집만 본 판정이었고, 다섯 계열을 더 보자 몰리에르·라신·스위프트가
     * 되돌아왔다).
     */
    absent: z
      .record(
        z.string(),
        z
          .object({
            checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            searched: z.array(z.string().min(2)).min(2, "한 곳만 뒤지고 없다고 적지 않는다"),
            note: z.string().min(1).optional()
          })
          .strict()
      )
      .optional()
  })
  .strict();

/** data/portraits.json — editorial iconography records (thesis ④-3) */
export const portraitsSchema = z
  .object({
    version: z.string().min(1),
    model: z.string().min(1),
    postProcess: z.string().min(1),
    entries: z.array(
      z
        .object({
          authorId: z.string().regex(AUTHOR_ID),
          mode: z.enum(["face", "object"]),
          /** rights ladder rung (thesis ④-2): 1 PD, 2 copyright-photo era, 3 living, 4 no iconography */
          rung: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
          motif: z.string().min(1).nullable(),
          motifRationale: z.string().min(20).nullable(),
          iconographyNote: z.string().min(20),
          prompt: z.string().min(60),
          seed: z.number().int(),
          generatedAt: z.string().regex(ISO_DATE),
          reviewStatus: z.enum(["draft", "reviewed"])
        })
        .strict()
        .refine((e) => (e.rung >= 3 ? e.mode === "object" : true), {
          message: "rung 3–4 requires an object portrait (no generated faces)"
        })
        .refine((e) => (e.mode === "object" ? e.motif !== null && e.motifRationale !== null : true), {
          message: "object portraits need a motif and its editorial rationale"
        })
    )
  })
  .strict();

export const registrySchema = z.array(
  z
    .object({
      id: z.string().regex(AUTHOR_ID),
      ko: z.string().min(1),
      original: z.string().min(1),
      layer: z.enum(periodIds),
      tier: z.enum(["anchor", "major", "context"]),
      batch: z.string().min(1)
    })
    .strict()
);

// --- translations (data/translations/<locale>/…) ---------------------------

export const authorTranslationSchema = z
  .object({
    id: z.string().regex(AUTHOR_ID),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    importanceReason: z.string().min(10),
    readingEntryReason: z.string().min(10).optional(),
    readingWarning: z.string().min(10).optional(),
    difficultyReason: z.string().min(10).optional(),
    worksException: z.string().min(10).optional()
  })
  .strict();

export const workTranslationSchema = z
  .object({
    id: z.string().regex(WORK_ID),
    title: z.string().min(1),
    significance: z.string().min(30)
  })
  .strict();

export const relationTranslationSchema = z
  .object({
    id: z.string().regex(RELATION_ID),
    summary: z.string().min(10)
  })
  .strict();

export const movementTranslationSchema = z
  .object({
    id: z.string().regex(SLUG),
    name: z.string().min(1),
    description: z.string().min(20)
  })
  .strict();

export const tourTranslationSchema = z
  .object({
    id: z.string().regex(SLUG),
    title: z.string().min(1),
    description: z.string().min(20),
    stopNotes: z.array(z.string().min(60))
  })
  .strict();

export const authorTranslationsFileSchema = z.array(authorTranslationSchema);
export const workTranslationsFileSchema = z.array(workTranslationSchema);
export const relationTranslationsFileSchema = z.array(relationTranslationSchema);
export const movementTranslationsFileSchema = z.array(movementTranslationSchema);
export const tourTranslationsFileSchema = z.array(tourTranslationSchema);

export const authorsFileSchema = z.array(authorSchema);
export const worksFileSchema = z.array(workSchema);
export const relationsFileSchema = z.array(relationSchema);
export const sourcesFileSchema = z.array(sourceSchema);
export const movementsFileSchema = z.array(movementSchema);
export const toursFileSchema = z.array(tourSchema);
