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

const year = z.number().int().min(1700).max(2030);

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
    birthYear: year.optional(),
    deathYear: year.optional(),
    activeRange: z.tuple([year, year]),
    anchorYear: year,
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

export const workSchema = z
  .object({
    id: z.string().regex(WORK_ID),
    authorId: z.string().regex(AUTHOR_ID),
    titleKo: z.string().min(1),
    titleOriginal: z.string().min(1),
    year,
    genre: z.enum(genreIds),
    speculative: z.boolean().optional(),
    significance: z.string().min(30),
    sourceIds: z.array(z.string().regex(SOURCE_ID))
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
    sourceIds: z.array(z.string().regex(SOURCE_ID))
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
