import { z } from "zod";
import {
  authorsFileSchema,
  worksFileSchema,
  relationsFileSchema,
  sourcesFileSchema,
  movementsFileSchema,
  toursFileSchema,
  positionsSchema,
  registrySchema,
  territorySchema,
  authorTranslationsFileSchema,
  workTranslationsFileSchema,
  relationTranslationsFileSchema,
  movementTranslationsFileSchema,
  tourTranslationsFileSchema
} from "../schema.ts";
import { RELATION_DEFS, PERIOD_DEFS } from "../types.ts";
import type {
  Author,
  Dataset,
  LocalePack,
  Relation,
  RelationType,
  Territory,
  Work
} from "../types.ts";

/** locales whose pack, once present, must cover the entire dataset */
const COMPLETE_LOCALES = new Set(["en"]);

export interface RawCollections {
  /** file name → parsed JSON, for error attribution */
  authorFiles: Record<string, unknown>;
  workFiles: Record<string, unknown>;
  relationFiles: Record<string, unknown>;
  sourceFiles: Record<string, unknown>;
  movements: unknown;
  tours: unknown;
  positions: unknown;
  registry: unknown;
  /**
   * path relative to data/translations (e.g. "en/authors/roots.json",
   * "en/tours.json") → parsed JSON
   */
  translationFiles?: Record<string, unknown>;
  /** data/territory.v1.json (frozen terrain), when generated */
  territory?: unknown;
}

export interface AssembleResult {
  dataset: Dataset | null;
  errors: string[];
  warnings: string[];
}

const RELATION_ID_PREFIX: Record<RelationType, string> = {
  documented_influence: "influence",
  translation: "translation",
  mentorship: "mentorship",
  dialogue: "dialogue",
  affinity: "affinity",
  contrast: "contrast"
};

function zodIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map(
    (i) => `${file}: [${i.path.join(".") || "(root)"}] ${i.message}`
  );
}

function parseFiles<T>(
  files: Record<string, unknown>,
  schema: z.ZodType<T[]>,
  errors: string[]
): T[] {
  const out: T[] = [];
  for (const [file, raw] of Object.entries(files)) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) out.push(...parsed.data);
    else errors.push(...zodIssues(file, parsed.error));
  }
  return out;
}

function checkUnique(kind: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate ${kind} id: ${id}`);
    seen.add(id);
  }
}

function emptyPack(locale: string): LocalePack {
  return { locale, authors: [], works: [], relations: [], movements: [], tours: [] };
}

/** Group data/translations/<locale>/… files into per-locale packs. */
function parseTranslationFiles(
  files: Record<string, unknown>,
  errors: string[]
): LocalePack[] {
  const packs = new Map<string, LocalePack>();
  const packOf = (locale: string): LocalePack => {
    let p = packs.get(locale);
    if (!p) {
      p = emptyPack(locale);
      packs.set(locale, p);
    }
    return p;
  };
  for (const [path, raw] of Object.entries(files)) {
    const segs = path.split("/");
    const locale = segs[0] ?? "";
    const rest = segs.slice(1).join("/");
    const at = `translations/${path}`;
    if (!/^[a-z]{2}$/.test(locale)) {
      errors.push(`${at}: locale directory must be a two-letter code`);
      continue;
    }
    const pack = packOf(locale);
    if (rest.startsWith("authors/")) {
      const parsed = authorTranslationsFileSchema.safeParse(raw);
      if (parsed.success) pack.authors.push(...parsed.data);
      else errors.push(...zodIssues(at, parsed.error));
    } else if (rest.startsWith("works/")) {
      const parsed = workTranslationsFileSchema.safeParse(raw);
      if (parsed.success) pack.works.push(...parsed.data);
      else errors.push(...zodIssues(at, parsed.error));
    } else if (rest.startsWith("relations/")) {
      const parsed = relationTranslationsFileSchema.safeParse(raw);
      if (parsed.success) pack.relations.push(...parsed.data);
      else errors.push(...zodIssues(at, parsed.error));
    } else if (rest === "movements.json") {
      const parsed = movementTranslationsFileSchema.safeParse(raw);
      if (parsed.success) pack.movements.push(...parsed.data);
      else errors.push(...zodIssues(at, parsed.error));
    } else if (rest === "tours.json") {
      const parsed = tourTranslationsFileSchema.safeParse(raw);
      if (parsed.success) pack.tours.push(...parsed.data);
      else errors.push(...zodIssues(at, parsed.error));
    } else {
      errors.push(`${at}: unrecognized translation file location`);
    }
  }
  return [...packs.values()].sort((a, b) => a.locale.localeCompare(b.locale));
}

const CURRENT_YEAR = 2026;

export interface AssembleOptions {
  /**
   * During staged data generation: registry entries without author data and
   * missing layout positions degrade to warnings. Final validation runs strict.
   */
  allowPartial?: boolean;
}

export function assembleDataset(
  raw: RawCollections,
  opts: AssembleOptions = {}
): AssembleResult {
  const partial = opts.allowPartial === true;
  const errors: string[] = [];
  const warnings: string[] = [];

  const authors = parseFiles(raw.authorFiles, authorsFileSchema, errors);
  const works = parseFiles(raw.workFiles, worksFileSchema, errors);
  const relations = parseFiles(raw.relationFiles, relationsFileSchema, errors);
  const sources = parseFiles(raw.sourceFiles, sourcesFileSchema, errors);

  const movementsParsed = movementsFileSchema.safeParse(raw.movements);
  const toursParsed = toursFileSchema.safeParse(raw.tours);
  const positionsParsed = positionsSchema.safeParse(raw.positions);
  const registryParsed = registrySchema.safeParse(raw.registry);

  if (!movementsParsed.success) errors.push(...zodIssues("movements.json", movementsParsed.error));
  if (!toursParsed.success) errors.push(...zodIssues("tours.json", toursParsed.error));
  if (!positionsParsed.success) errors.push(...zodIssues("positions.v1.json", positionsParsed.error));
  if (!registryParsed.success) errors.push(...zodIssues("registry.json", registryParsed.error));

  if (errors.length > 0) {
    return { dataset: null, errors, warnings };
  }
  const movements = movementsParsed.success ? movementsParsed.data : [];
  const tours = toursParsed.success ? toursParsed.data : [];
  const positions = positionsParsed.success
    ? positionsParsed.data
    : { version: "0", seed: 0, generatedAt: "", positions: {} };
  const registry = registryParsed.success ? registryParsed.data : [];
  const translations = parseTranslationFiles(raw.translationFiles ?? {}, errors);

  // --- uniqueness -----------------------------------------------------------
  checkUnique("author", authors.map((a) => a.id), errors);
  checkUnique(
    "author wikidata QID",
    authors.map((a) => a.externalIds?.wikidata).filter((q): q is string => q !== undefined),
    errors
  );
  checkUnique("work", works.map((w) => w.id), errors);
  checkUnique("relation", relations.map((r) => r.id), errors);
  checkUnique("source", sources.map((s) => s.id), errors);
  checkUnique("movement", movements.map((m) => m.id), errors);
  checkUnique("tour", tours.map((t) => t.id), errors);
  checkUnique("registry", registry.map((r) => r.id), errors);

  const authorById = new Map(authors.map((a) => [a.id, a]));
  const sourceIds = new Set(sources.map((s) => s.id));
  const movementIds = new Set(movements.map((m) => m.id));
  const worksByAuthor = new Map<string, Work[]>();
  for (const w of works) {
    const list = worksByAuthor.get(w.authorId) ?? [];
    list.push(w);
    worksByAuthor.set(w.authorId, list);
  }

  // --- registry ↔ authors 1:1 ----------------------------------------------
  const registryIds = new Set(registry.map((r) => r.id));
  for (const r of registry) {
    if (!authorById.has(r.id)) {
      if (partial) warnings.push(`registry author not yet in data: ${r.id}`);
      else errors.push(`registry author missing from data: ${r.id}`);
    }
  }
  for (const a of authors) {
    if (registryIds.size > 0 && !registryIds.has(a.id))
      errors.push(`author not in registry: ${a.id}`);
  }

  // --- authors --------------------------------------------------------------
  for (const a of authors) {
    if (a.birthYear !== undefined && a.deathYear !== undefined && a.birthYear >= a.deathYear)
      errors.push(`${a.id}: birthYear >= deathYear`);
    const [from, to] = a.activeRange;
    if (from > to) errors.push(`${a.id}: activeRange reversed`);
    if (a.anchorYear < from || a.anchorYear > to)
      errors.push(`${a.id}: anchorYear ${a.anchorYear} outside activeRange [${from}, ${to}]`);
    if (a.birthYear !== undefined && from < a.birthYear + 8)
      errors.push(`${a.id}: activeRange starts implausibly early (before age 8)`);
    const lifeEnd = a.deathYear ?? CURRENT_YEAR;
    if (to > lifeEnd)
      errors.push(`${a.id}: activeRange ends after death/current year`);

    const primaries = a.locations.filter((l) => l.primary === true);
    if (primaries.length !== 1)
      errors.push(`${a.id}: exactly one primary location required (found ${primaries.length})`);

    for (const m of a.movements) {
      if (!movementIds.has(m)) errors.push(`${a.id}: unknown movement '${m}'`);
    }

    const authorWorks = worksByAuthor.get(a.id) ?? [];
    const workIds = new Set(authorWorks.map((w) => w.id));
    if (authorWorks.length < 3 && a.worksException === undefined)
      errors.push(
        `${a.id}: fewer than 3 works (${authorWorks.length}) without worksException note`
      );
    if (!workIds.has(a.readingEntry))
      errors.push(`${a.id}: readingEntry ${a.readingEntry} is not one of the author's works`);
    for (const wid of a.readingOrder) {
      if (!workIds.has(wid)) errors.push(`${a.id}: readingOrder references unknown work ${wid}`);
    }
    if (a.readingOrder[0] !== a.readingEntry)
      errors.push(`${a.id}: readingOrder must start with readingEntry`);
    checkUnique(`${a.id} readingOrder`, a.readingOrder, errors);

    for (const sid of a.sourceIds) {
      if (!sourceIds.has(sid)) errors.push(`${a.id}: unknown source ${sid}`);
    }
    if ((a.reviewStatus === "reviewed" || a.reviewStatus === "verified") && !a.reviewedAt)
      errors.push(`${a.id}: reviewStatus '${a.reviewStatus}' requires reviewedAt`);
    if (
      (a.reviewStatus === "reviewed" || a.reviewStatus === "verified") &&
      a.externalIds?.wikidata === undefined
    )
      errors.push(
        `${a.id}: reviewStatus '${a.reviewStatus}' requires externalIds.wikidata (run qc:backfill-qids)`
      );

    const lower = new Set([a.names.ko, a.names.original]);
    for (const alias of a.names.aliases) {
      if (lower.has(alias)) warnings.push(`${a.id}: alias duplicates a primary name: '${alias}'`);
    }

    // periods should overlap the author's active range (soft check)
    for (const p of a.periods) {
      const def = PERIOD_DEFS.find((d) => d.id === p);
      if (def && (to < def.range[0] || from > def.range[1]))
        warnings.push(`${a.id}: period '${p}' does not overlap activeRange [${from}, ${to}]`);
    }
  }

  // --- works ----------------------------------------------------------------
  for (const w of works) {
    const a = authorById.get(w.authorId);
    if (!a) {
      errors.push(`${w.id}: unknown authorId ${w.authorId}`);
      continue;
    }
    if (!w.id.startsWith(`${w.authorId}--`))
      errors.push(`${w.id}: work id must be '<authorId>--<slug>'`);
    if (a.birthYear !== undefined && w.year < a.birthYear + 10)
      errors.push(`${w.id}: published before author age 10 (${w.year})`);
    if (a.deathYear !== undefined && w.year > a.deathYear + 60)
      errors.push(`${w.id}: published more than 60y posthumously (${w.year}) — check year`);
    for (const sid of w.sourceIds) {
      if (!sourceIds.has(sid)) errors.push(`${w.id}: unknown source ${sid}`);
    }
  }

  // --- relations ------------------------------------------------------------
  const defByType = new Map(RELATION_DEFS.map((d) => [d.id, d]));
  const seenPairs = new Set<string>();
  for (const r of relations) {
    const def = defByType.get(r.type);
    if (!def) continue; // zod already rejected unknown types
    if (!authorById.has(r.sourceId)) errors.push(`${r.id}: unknown sourceId ${r.sourceId}`);
    if (!authorById.has(r.targetId)) errors.push(`${r.id}: unknown targetId ${r.targetId}`);
    if (r.sourceId === r.targetId) errors.push(`${r.id}: self-relation forbidden`);

    const expectedId = `${RELATION_ID_PREFIX[r.type]}--${r.sourceId}--${r.targetId}`;
    if (r.id !== expectedId)
      errors.push(`${r.id}: id must be '${expectedId}' (type/source/target mismatch)`);

    if (r.direction !== def.direction)
      errors.push(`${r.id}: type '${r.type}' requires direction '${def.direction}'`);
    if (!def.levels.includes(r.evidenceLevel))
      errors.push(
        `${r.id}: evidenceLevel '${r.evidenceLevel}' not allowed for type '${r.type}' (allowed: ${def.levels.join(", ")})`
      );
    if (def.sourcesRequired && r.sourceIds.length === 0)
      errors.push(`${r.id}: type '${r.type}' requires at least one source`);
    if (r.evidenceLevel !== "editorial_inference" && r.sourceIds.length === 0)
      errors.push(`${r.id}: evidenceLevel '${r.evidenceLevel}' requires at least one source`);
    for (const sid of r.sourceIds) {
      if (!sourceIds.has(sid)) errors.push(`${r.id}: unknown source ${sid}`);
    }
    if (r.evidenceLevel === "editorial_inference" && r.weight > 0.6)
      warnings.push(`${r.id}: editorial_inference with weight ${r.weight} > 0.6 — justify or lower`);

    const exact = `${r.type}:${r.sourceId}->${r.targetId}`;
    if (seenPairs.has(exact)) errors.push(`${r.id}: duplicate relation`);
    seenPairs.add(exact);
    const reverse = `${r.type}:${r.targetId}->${r.sourceId}`;
    if (seenPairs.has(reverse)) {
      if (def.direction === "bidirectional")
        errors.push(`${r.id}: bidirectional relation stored twice (reverse duplicate)`);
      else
        errors.push(
          `${r.id}: reverse duplicate of directed relation — mutual influence should be 'dialogue'`
        );
    }
  }

  // --- positions ------------------------------------------------------------
  const posIds = new Set(Object.keys(positions.positions));
  for (const a of authors) {
    const p = positions.positions[a.id];
    if (!p) {
      if (partial) warnings.push(`positions: not yet generated for ${a.id}`);
      else errors.push(`positions: missing coordinates for ${a.id}`);
      continue;
    }
    const norm = Math.hypot(p[0], p[1], p[2]);
    if (Math.abs(norm - 1) > 0.02)
      errors.push(`positions: ${a.id} not on unit sphere (|v|=${norm.toFixed(4)})`);
  }
  for (const pid of posIds) {
    if (!authorById.has(pid)) warnings.push(`positions: orphan coordinates for '${pid}'`);
  }

  // --- tours ----------------------------------------------------------------
  for (const t of tours) {
    for (const stop of t.stops) {
      if (!authorById.has(stop.authorId))
        errors.push(`tour ${t.id}: unknown author ${stop.authorId}`);
    }
  }

  // --- translations ---------------------------------------------------------
  const workIdSet = new Set(works.map((w) => w.id));
  const relationIdSet = new Set(relations.map((r) => r.id));
  const tourById = new Map(tours.map((t) => [t.id, t]));
  for (const pack of translations) {
    const L = `translations/${pack.locale}`;
    checkUnique(`${pack.locale} author translation`, pack.authors.map((x) => x.id), errors);
    checkUnique(`${pack.locale} work translation`, pack.works.map((x) => x.id), errors);
    checkUnique(`${pack.locale} relation translation`, pack.relations.map((x) => x.id), errors);
    checkUnique(`${pack.locale} movement translation`, pack.movements.map((x) => x.id), errors);
    checkUnique(`${pack.locale} tour translation`, pack.tours.map((x) => x.id), errors);

    for (const ta of pack.authors) {
      const a = authorById.get(ta.id);
      if (!a) {
        errors.push(`${L}: unknown author ${ta.id}`);
        continue;
      }
      // optional fields must mirror the source record exactly
      if (a.readingWarning !== undefined && ta.readingWarning === undefined)
        errors.push(`${L}/${ta.id}: missing readingWarning translation`);
      if (a.readingWarning === undefined && ta.readingWarning !== undefined)
        errors.push(`${L}/${ta.id}: readingWarning translation has no source field`);
      if (a.worksException !== undefined && ta.worksException === undefined)
        errors.push(`${L}/${ta.id}: missing worksException translation`);
      if (a.worksException === undefined && ta.worksException !== undefined)
        errors.push(`${L}/${ta.id}: worksException translation has no source field`);
    }
    for (const tw of pack.works) {
      if (!workIdSet.has(tw.id)) errors.push(`${L}: unknown work ${tw.id}`);
    }
    for (const tr of pack.relations) {
      if (!relationIdSet.has(tr.id)) errors.push(`${L}: unknown relation ${tr.id}`);
    }
    for (const tm of pack.movements) {
      if (!movementIds.has(tm.id)) errors.push(`${L}: unknown movement ${tm.id}`);
    }
    for (const tt of pack.tours) {
      const t = tourById.get(tt.id);
      if (!t) {
        errors.push(`${L}: unknown tour ${tt.id}`);
        continue;
      }
      if (tt.stopNotes.length !== t.stops.length)
        errors.push(
          `${L}/${tt.id}: stopNotes length ${tt.stopNotes.length} != stops length ${t.stops.length}`
        );
    }

    // a locale we ship must cover everything — half-translated modes are
    // dishonest UI; during staged generation this degrades to warnings
    if (COMPLETE_LOCALES.has(pack.locale)) {
      const sink = partial ? warnings : errors;
      const cover = (kind: string, have: Set<string>, want: string[]): void => {
        const missing = want.filter((id) => !have.has(id));
        if (missing.length > 0)
          sink.push(
            `${L}: incomplete ${kind} coverage — ${missing.length} missing (e.g. ${missing
              .slice(0, 3)
              .join(", ")})`
          );
      };
      cover("author", new Set(pack.authors.map((x) => x.id)), authors.map((a) => a.id));
      cover("work", new Set(pack.works.map((x) => x.id)), works.map((w) => w.id));
      cover("relation", new Set(pack.relations.map((x) => x.id)), relations.map((r) => r.id));
      cover("movement", new Set(pack.movements.map((x) => x.id)), movements.map((m) => m.id));
      cover("tour", new Set(pack.tours.map((x) => x.id)), tours.map((t) => t.id));
    }
  }

  // --- frozen terrain (optional until generated) ----------------------------
  let territory: Territory | null = null;
  if (raw.territory !== undefined && raw.territory !== null) {
    const t = territorySchema.safeParse(raw.territory);
    if (!t.success) {
      errors.push(...zodIssues("territory.v1.json", t.error));
    } else {
      for (const id of Object.keys(t.data.weights)) {
        if (!authorById.has(id)) errors.push(`territory.v1.json: unknown author in weights: ${id}`);
      }
      for (const id of Object.keys(t.data.areaShares)) {
        if (!authorById.has(id))
          errors.push(`territory.v1.json: unknown author in areaShares: ${id}`);
      }
      for (const a of authors) {
        if (!(a.id in t.data.weights))
          errors.push(`territory.v1.json: author missing from weights: ${a.id}`);
      }
      // baked geometry must be self-consistent — the renderer trusts it blindly
      const g = t.data.geometry;
      const authorIds = new Set(authors.map((a) => a.id));
      if (
        g.authors.length !== authorIds.size ||
        g.authors.some((id) => !authorIds.has(id))
      ) {
        errors.push(
          "territory.v1.json: geometry.authors must list exactly the corpus author ids"
        );
      }
      if (g.ownerRle.length !== g.gridHeight - 1) {
        errors.push(
          `territory.v1.json: ownerRle has ${g.ownerRle.length} rows, expected gridHeight-1 = ${g.gridHeight - 1}`
        );
      }
      g.ownerRle.forEach((row, j) => {
        let sum = 0;
        for (let k = 0; k + 1 < row.length; k += 2) {
          sum += row[k]!;
          const v = row[k + 1]!;
          if (v > g.authors.length)
            errors.push(`territory.v1.json: ownerRle row ${j} references owner ${v} out of range`);
        }
        if (sum !== g.gridWidth)
          errors.push(
            `territory.v1.json: ownerRle row ${j} sums to ${sum}, expected gridWidth = ${g.gridWidth}`
          );
      });
      const checkBounds = (lines: number[][], w: number, h: number, what: string): void => {
        for (const line of lines) {
          for (let k = 0; k + 1 < line.length; k += 2) {
            const x = line[k]!;
            const y = line[k + 1]!;
            if (x < 0 || x > w || y < 0 || y > h - 1) {
              errors.push(`territory.v1.json: ${what} point (${x}, ${y}) outside grid ${w}×${h}`);
              return;
            }
          }
        }
      };
      checkBounds(g.coast, g.gridWidth, g.gridHeight, "coast");
      checkBounds(g.boundaries, g.gridWidth, g.gridHeight, "boundary");
      checkBounds(g.waterlines.inner, g.waterlines.gridWidth, g.waterlines.gridHeight, "inner waterline");
      checkBounds(g.waterlines.outer, g.waterlines.gridWidth, g.waterlines.gridHeight, "outer waterline");
      territory = t.data as Territory;
    }
  }

  // --- movements usage ------------------------------------------------------
  const usedMovements = new Set(authors.flatMap((a) => a.movements));
  for (const m of movements) {
    if (!usedMovements.has(m.id)) warnings.push(`movement '${m.id}' has no members`);
  }

  // --- source usage ---------------------------------------------------------
  const usedSources = new Set<string>([
    ...authors.flatMap((a) => a.sourceIds),
    ...works.flatMap((w) => w.sourceIds),
    ...relations.flatMap((r) => r.sourceIds)
  ]);
  for (const s of sources) {
    if (!usedSources.has(s.id)) warnings.push(`source '${s.id}' is never referenced`);
  }

  const dataset: Dataset = {
    authors,
    works,
    relations,
    sources,
    movements,
    tours,
    positions,
    registry,
    translations,
    territory
  };
  return { dataset: errors.length === 0 ? dataset : null, errors, warnings };
}

/** Convenience accessors shared by app + scripts */
export function worksOf(dataset: Dataset, authorId: string): Work[] {
  return dataset.works
    .filter((w) => w.authorId === authorId)
    .sort((x, y) => x.year - y.year);
}

export function relationsOf(dataset: Dataset, authorId: string): Relation[] {
  return dataset.relations.filter((r) => r.sourceId === authorId || r.targetId === authorId);
}

export function authorOf(dataset: Dataset, id: string): Author | undefined {
  return dataset.authors.find((a) => a.id === id);
}
