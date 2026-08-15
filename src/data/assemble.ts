import { z } from "zod";
import {
  authorsFileSchema,
  worksFileSchema,
  relationsFileSchema,
  sourcesFileSchema,
  movementsFileSchema,
  toursFileSchema,
  positionsSchema,
  registrySchema
} from "../schema.ts";
import { RELATION_DEFS, PERIOD_DEFS } from "../types.ts";
import type { Author, Dataset, Relation, RelationType, Work } from "../types.ts";

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

  // --- uniqueness -----------------------------------------------------------
  checkUnique("author", authors.map((a) => a.id), errors);
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
    registry
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
