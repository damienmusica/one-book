import { z } from "zod";
import {
  authorsFileSchema,
  worksFileSchema,
  relationsFileSchema,
  sourcesFileSchema,
  movementsFileSchema,
  toursFileSchema,
  portraitsSchema,
  editionsFileSchema,
  registrySchema,
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
  Work
} from "../types.ts";

/** locales whose pack, once present, must cover the entire dataset */
// 2026-08-31 결정 (135): 완전해야 하는 로케일이 없다. 한국어 우선 제품에서 작가마다
// 영어 팩 2,674자(작가 비용의 70%)를 필수로 걸어 둔 것은 누스피어에서 상속한 가정이었다.
// 번역은 있으면 싣고, 없으면 없다. 한 로케일 안에서의 부분 번역도 "반쪽 UI"가 아니라
// 그냥 아직 번역되지 않은 항목이다.
const COMPLETE_LOCALES = new Set<string>();

export interface RawCollections {
  /** file name → parsed JSON, for error attribution */
  authorFiles: Record<string, unknown>;
  workFiles: Record<string, unknown>;
  relationFiles: Record<string, unknown>;
  sourceFiles: Record<string, unknown>;
  movements: unknown;
  tours: unknown;
  registry: unknown;
  /**
   * path relative to data/translations (e.g. "en/authors/roots.json",
   * "en/tours.json") → parsed JSON
   */
  translationFiles?: Record<string, unknown>;
  /** data/portraits.json (imagined-portrait editorial records), when present */
  portraits?: unknown;
  /** data/editions.json (검수된 판본 원장), when present */
  editions?: unknown;
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
  const registryParsed = registrySchema.safeParse(raw.registry);

  if (!movementsParsed.success) errors.push(...zodIssues("movements.json", movementsParsed.error));
  if (!toursParsed.success) errors.push(...zodIssues("tours.json", toursParsed.error));
  if (!registryParsed.success) errors.push(...zodIssues("registry.json", registryParsed.error));

  if (errors.length > 0) {
    return { dataset: null, errors, warnings };
  }
  const movements = movementsParsed.success ? movementsParsed.data : [];
  const tours = toursParsed.success ? toursParsed.data : [];
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
    list.push(w as Dataset["works"][number]);
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
  // 레지스트리는 **배차 원장**이다 — 도판으로 그리기로 정한 작가가 거기 오른다.
  // 실루엣은 배차가 아니라 존재의 목록이므로 원장에 없어도 된다. 뒤집힌 쪽이 오류다:
  // 원장에 올랐는데 실루엣으로 남아 있으면, 그리기로 한 작가를 그리지 않은 것이다.
  for (const a of authors) {
    const depth = a.depth ?? "plate";
    if (depth === "silhouette") {
      if (registryIds.has(a.id)) errors.push(`registry author still a silhouette: ${a.id}`);
      continue;
    }
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

    // 등급별 교차검증. 실루엣은 **지도 위의 자리**라서 작품·입문 순서·장소를 요구하지
    // 않는다 — 요구하는 순간 다시 존재의 조건이 되고, 그게 100명에서 멈춘 이유였다.
    const depth = a.depth ?? "plate";
    for (const m of a.movements ?? []) {
      if (!movementIds.has(m)) errors.push(`${a.id}: unknown movement '${m}'`);
    }
    for (const sid of a.sourceIds ?? []) {
      if (!sourceIds.has(sid)) errors.push(`${a.id}: unknown source ${sid}`);
    }

    if (depth !== "silhouette") {
      const primaries = (a.locations ?? []).filter((l) => l.primary === true);
      if (primaries.length !== 1)
        errors.push(`${a.id}: exactly one primary location required (found ${primaries.length})`);
    }

    const authorWorks = worksByAuthor.get(a.id) ?? [];
    const workIds = new Set(authorWorks.map((w) => w.id));
    if (depth === "silhouette") {
      // 실루엣 작가도 책을 갖는다 — 단 그 책도 실루엣이다. 산문이 붙은 작품은
      // 작가가 도판일 때만 설 수 있다(작품이 작가보다 깊을 수 없다).
      for (const w of authorWorks) {
        if ((w.depth ?? "plate") !== "silhouette")
          errors.push(`${w.id}: 작가가 실루엣인데 작품이 ${w.depth ?? "plate"} 다 — 작가부터 올려라`);
      }
      if ((a.readingOrder ?? []).length > 0)
        errors.push(`${a.id}: 실루엣에는 입문 순서가 없다`);
    } else {
      if (authorWorks.length < 3 && a.worksException === undefined)
        errors.push(
          `${a.id}: fewer than 3 works (${authorWorks.length}) without worksException note`
        );
      if (a.readingEntry !== undefined && !workIds.has(a.readingEntry))
        errors.push(`${a.id}: readingEntry ${a.readingEntry} is not one of the author's works`);
      for (const wid of a.readingOrder ?? []) {
        if (!workIds.has(wid)) errors.push(`${a.id}: readingOrder references unknown work ${wid}`);
      }
      if ((a.readingOrder ?? []).length > 0 && a.readingOrder?.[0] !== a.readingEntry)
        errors.push(`${a.id}: readingOrder must start with readingEntry`);
      checkUnique(`${a.id} readingOrder`, a.readingOrder ?? [], errors);
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

    // 시대층은 활동 기간과 겹쳐야 한다 — **경고가 아니라 에러다.**
    //
    // 2026-08-31 고전 확장 조사가 이 자리를 지목했다: 시대층의 최하층이
    // `roots 1850–1900` 이라 괴테(활동 ~1832)·오스틴·발자크에게 정직한 층이
    // 없는데, 검증기가 enum 멤버십만 보고 통과시키면 **거짓 태그가 합법**이
    // 된다. 겹침 검사는 이미 여기 있었지만 경고였고, `validate-data.ts` 는
    // 경고에 exit 0 이다 — 즉 거짓말이 탐지된 뒤 무시되고 있었다.
    // 이제 막힌다. 새 시대층 없이 옛 작가를 밀어 넣는 길이 없어졌다.
    for (const p of a.periods) {
      const def = PERIOD_DEFS.find((d) => d.id === p);
      if (def && (to < def.range[0] || from > def.range[1]))
        errors.push(
          `${a.id}: period '${p}' (${def.range[0]}–${def.range[1]}) does not overlap activeRange [${from}, ${to}] — ` +
            `정직한 시대층이 없으면 층을 만들어야지, 있는 층에 밀어 넣으면 안 된다`
        );
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
    // 사후 60년은 **연도 오타를 잡는 검사**였지 문학사에 대한 주장이 아니었다.
    // 고전이 들어오자 참인 사실 7건을 거짓으로 판정했다 — 첼리니 자서전 1728,
    // 윤선도 고산유고 1798, 김시습 매월당집 1583. 전부 사후 편찬이 정상인 문학이다.
    // 그리고 그 7건은 전부 `yearBasis: first-print` 였다 — 데이터가 이미 "이 수는
    // 출간 연도다"라고 말하고 있었고 규칙이 그 선언을 읽지 않았다.
    const basis = w.yearBasis ?? "attested";
    if (basis === "attested" && a.deathYear !== undefined && w.year > a.deathYear + 60)
      errors.push(
        `${w.id}: published more than 60y posthumously (${w.year}) — check year, or say what that number is with yearBasis`
      );
    for (const sid of w.sourceIds ?? []) {
      if (!sourceIds.has(sid)) errors.push(`${w.id}: unknown source ${sid}`);
    }
    // 작품 세계: 모든 주장이 실재하는 출처를 가리키고, 판본은 발표 연도보다 앞설 수 없다
    if (w.world) {
      if (!sourceIds.has(w.world.opening.sourceId))
        errors.push(`${w.id}: world.opening cites unknown source ${w.world.opening.sourceId}`);
      for (const e of w.world.editions) {
        if (e.year < w.year)
          errors.push(`${w.id}: edition ${e.kind} ${e.year} precedes the work's publication year ${w.year}`);
        if (e.kind === "first-printing" && !e.venue)
          errors.push(`${w.id}: first-printing edition needs a venue`);
        for (const sid of e.sourceIds)
          if (!sourceIds.has(sid)) errors.push(`${w.id}: edition cites unknown source ${sid}`);
      }
      const first = w.world.editions.find((e) => e.kind === "first-edition");
      if (!first) errors.push(`${w.id}: world needs a first-edition entry`);
      if (w.world.posthumous) {
        if (a.deathYear === undefined || (first && first.year <= a.deathYear))
          errors.push(`${w.id}: posthumous claim but the first edition is not after the author's death`);
        for (const sid of w.world.posthumous.sourceIds)
          if (!sourceIds.has(sid)) errors.push(`${w.id}: posthumous cites unknown source ${sid}`);
      }
    }
  }

  const workById = new Map(works.map((w) => [w.id, w]));

  // --- relations ------------------------------------------------------------
  const defByType = new Map(RELATION_DEFS.map((d) => [d.id, d]));
  const seenPairs = new Set<string>();
  for (const r of relations) {
    const def = defByType.get(r.type);
    if (!def) continue; // zod already rejected unknown types
    if (!authorById.has(r.sourceId)) errors.push(`${r.id}: unknown sourceId ${r.sourceId}`);
    if (!authorById.has(r.targetId)) errors.push(`${r.id}: unknown targetId ${r.targetId}`);
    if (r.sourceId === r.targetId) errors.push(`${r.id}: self-relation forbidden`);

    // 앵커는 두 당사자 중 한 사람의 실재하는 작품만 가리킨다 — 제3자의 책에 닿는 선은 거짓말이다.
    //
    // 그리고 앵커는 **요약이 이미 지목한 것만** 승격한다(물량 트랙 ②의 규율).
    // 그 규율은 지금까지 산문으로만 있었고, 승격 웨이브마다 사람이 지키기로 한
    // 약속이었다 — 기존 앵커 25개가 전부 이 조건을 만족한다는 것을 확인하고
    // 규칙으로 세운다. 요약에 없는 연도나 책이 앵커로 들어오면 그것은 **새
    // 조사가 원장에 몰래 들어온 것**이고, 카드의 칩은 그것을 근거처럼 보이게
    // 한다. 요약을 고쳐서 통과시키는 것이 정당한 경로다(그때는 요약의 출처가
    // 그 사실을 뒷받침해야 한다).
    for (const an of r.anchors ?? []) {
      if (an.workId) {
        const w = workById.get(an.workId);
        if (!w) errors.push(`${r.id}: anchor names unknown work ${an.workId}`);
        else if (w.authorId !== r.sourceId && w.authorId !== r.targetId)
          errors.push(`${r.id}: anchor work ${an.workId} belongs to neither party`);
        else if (!r.summary.includes(w.titleKo) && !r.summary.includes(w.titleOriginal))
          errors.push(
            `${r.id}: anchor work ${an.workId} is not named in the summary ('${w.titleKo}')`
          );
      }
      if (an.year !== undefined && !r.summary.includes(String(an.year)))
        errors.push(`${r.id}: anchor year ${an.year} is not named in the summary`);
    }
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

  // --- 판본 원장 ------------------------------------------------------------
  // 원장은 비어 있어도 유효하다 — 비어 있음이 곧 "아직 검수하지 않았다"는
  // 사실이고, checkedAt 이 그 사실에 날짜를 붙인다.
  let editions: Dataset["editions"] = {
    version: "0",
    checkedAt: "unset",
    note: "data/editions.json 이 없다",
    editions: {}
  };
  if (raw.editions !== undefined && raw.editions !== null) {
    const e = editionsFileSchema.safeParse(raw.editions);
    if (!e.success) {
      errors.push(...zodIssues("editions.json", e.error));
    } else {
      editions = e.data;
      // 없음의 원장도 실재하는 작품만 가리켜야 한다 — 유령 작품의 부재를
      // 적어 두면 원장이 자기 크기로 거짓말한다.
      for (const workId of Object.keys(e.data.absent ?? {})) {
        if (!workById.has(workId)) errors.push(`editions.json: unknown work id '${workId}' (absent)`);
        else if (e.data.editions[workId])
          errors.push(`editions.json: ${workId} 는 판본이 있으면서 동시에 부재로 적혀 있다`);
      }
      const seen = new Set<string>();
      for (const [workId, list] of Object.entries(e.data.editions)) {
        if (!workById.has(workId)) {
          errors.push(`editions.json: unknown work id '${workId}'`);
          continue;
        }
        for (const ed of list) {
          if (seen.has(ed.isbn13)) errors.push(`editions.json: ISBN 중복 ${ed.isbn13}`);
          seen.add(ed.isbn13);
          const w = workById.get(workId)!;
          if (ed.year < w.year) {
            errors.push(
              `editions.json: ${workId} 판본 연도 ${ed.year} 가 작품 연도 ${w.year} 보다 앞선다`
            );
          }
        }
      }
    }
  }

  // --- imagined portraits (optional until the pilot) ------------------------
  let portraits: Dataset["portraits"] = [];
  if (raw.portraits !== undefined && raw.portraits !== null) {
    const p = portraitsSchema.safeParse(raw.portraits);
    if (!p.success) {
      errors.push(...zodIssues("portraits.json", p.error));
    } else {
      const seen = new Set<string>();
      for (const e of p.data.entries) {
        const a = authorById.get(e.authorId);
        if (!a) {
          errors.push(`portraits.json: unknown author ${e.authorId}`);
          continue;
        }
        if (seen.has(e.authorId))
          errors.push(`portraits.json: duplicate entry for ${e.authorId}`);
        seen.add(e.authorId);
        // the rights ladder's bright line, cross-checked against the corpus:
        // a living author (no deathYear) must never carry a generated face
        if (a.deathYear === undefined && e.mode === "face")
          errors.push(
            `portraits.json: ${e.authorId} is living — face portraits are prohibited (rung 3)`
          );
      }
      portraits = p.data.entries as Dataset["portraits"];
    }
  }

  // --- movements usage ------------------------------------------------------
  const usedMovements = new Set(authors.flatMap((a) => a.movements));
  for (const m of movements) {
    if (!usedMovements.has(m.id)) warnings.push(`movement '${m.id}' has no members`);
  }

  // --- source usage ---------------------------------------------------------
  const usedSources = new Set<string>([
    ...authors.flatMap((a) => a.sourceIds ?? []),
    ...works.flatMap((w) => w.sourceIds ?? []),
    ...works.flatMap((w) =>
      w.world
        ? [
            w.world.opening.sourceId,
            ...w.world.editions.flatMap((e) => e.sourceIds),
            ...(w.world.posthumous?.sourceIds ?? [])
          ]
        : []
    ),
    ...relations.flatMap((r) => r.sourceIds)
  ]);
  for (const s of sources) {
    if (!usedSources.has(s.id)) warnings.push(`source '${s.id}' is never referenced`);
  }

  const dataset: Dataset = {
    authors: authors as Dataset["authors"],
    works: works as Dataset["works"],
    relations,
    sources,
    movements,
    tours,
    registry,
    translations,
    portraits,
    editions
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
