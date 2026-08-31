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
    locations: z.array(locationSchema).min(1),
    periods: z.array(z.enum(periodIds)).min(1),
    movements: z.array(z.string().regex(SLUG)),
    genres: z.array(z.enum(genreIds)).min(1),
    speculative: z.boolean().optional(),
    tier: z.enum(["anchor", "major", "context"]),
    importanceReason: z.string().min(60, "importanceReason must be 2–4 substantive sentences"),
    readingEntry: z.string().regex(WORK_ID),
    readingEntryReason: z.string().min(30),
    readingOrder: z.array(z.string().regex(WORK_ID)).min(1),
    readingWarning: z.string().min(10).optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    difficultyReason: z.string().min(20),
    worksException: z.string().min(10).optional(),
    sourceIds: z.array(z.string().regex(SOURCE_ID)).min(1),
    reviewStatus: z.enum(["draft", "reviewed", "verified"]),
    reviewedAt: z.string().regex(ISO_DATE).optional()
  })
  .strict();

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

/** 작품 세계 — 여는 문장은 출처를, 번역은 '자체' 표시를, 판본은 출처를 반드시 갖는다 */
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
    summary: z.string().min(40, "summary must explain the link in 1–3 Korean sentences"),
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

export const positionsSchema = z
  .object({
    version: z.string().min(1),
    seed: z.number().int(),
    generatedAt: z.string().min(1),
    positions: z.record(z.string().regex(AUTHOR_ID), z.tuple([z.number(), z.number(), z.number()]))
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
    importanceReason: z.string().min(60),
    readingEntryReason: z.string().min(30),
    readingWarning: z.string().min(10).optional(),
    difficultyReason: z.string().min(20),
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
    summary: z.string().min(40)
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
