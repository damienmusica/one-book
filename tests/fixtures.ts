import type { Author, Dataset, Relation, Work } from "../src/types.ts";

let seq = 0;

export function makeAuthor(overrides: Partial<Author> & { id: string }): Author {
  return {
    names: { ko: `작가${++seq}`, original: `Author ${seq}`, aliases: [] },
    birthYear: 1900,
    deathYear: 1970,
    activeRange: [1925, 1965],
    anchorYear: 1940,
    gender: "unknown",
    languages: ["en"],
    regions: ["western-europe"],
    locations: [{ label: "도시", lat: 48.85, lon: 2.35, role: "activity", primary: true }],
    periods: ["mid-century"],
    movements: [],
    genres: ["fiction"],
    tier: "major",
    importanceReason:
      "테스트 픽스처를 위한 중요성 설명이다. 스키마가 요구하는 최소 길이를 만족시키기 위해 형식적 기여와 문학사적 위치를 서술하는 두 문장 이상을 채워 넣는다.",
    readingEntry: `${overrides.id}--w1`,
    readingEntryReason: "테스트 픽스처의 입문작 사유 설명이다. 분량과 접근성 기준을 서술한다.",
    readingOrder: [`${overrides.id}--w1`],
    difficulty: 3,
    difficultyReason: "테스트 픽스처의 난도 사유를 설명하는 충분히 긴 문장이다.",
    sourceIds: ["src--britannica"],
    reviewStatus: "draft",
    ...overrides
  };
}

export function makeWork(authorId: string, n: number, overrides: Partial<Work> = {}): Work {
  return {
    id: `${authorId}--w${n}`,
    authorId,
    titleKo: `작품 ${n}`,
    titleOriginal: `Work ${n}`,
    year: 1930 + n,
    genre: "fiction",
    significance: "테스트 픽스처 작품의 의의를 설명하는 문장이다. 최소 길이 요건을 채운다.",
    sourceIds: [],
    ...overrides
  };
}

export function makeRelation(
  sourceId: string,
  targetId: string,
  type: Relation["type"] = "documented_influence",
  overrides: Partial<Relation> = {}
): Relation {
  const prefix =
    type === "documented_influence" ? "influence" : type;
  const directed =
    type === "documented_influence" || type === "translation" || type === "mentorship";
  return {
    id: `${prefix}--${sourceId}--${targetId}`,
    sourceId,
    targetId,
    type,
    direction: directed ? "directed" : "bidirectional",
    weight: 0.7,
    summary:
      "테스트 픽스처 관계의 요약 설명이다. 근거 수준 구분과 최소 길이 요건을 검증하기 위해 존재하는 문장이다.",
    evidenceLevel:
      type === "affinity" || type === "contrast" ? "editorial_inference" : "documented",
    sourceIds: type === "affinity" || type === "contrast" ? [] : ["src--britannica"],
    ...overrides
  };
}

export function makeDataset(
  authors: Author[],
  relations: Relation[] = [],
  extra: Partial<Dataset> = {}
): Dataset {
  const works = authors.flatMap((a) => [1, 2, 3].map((n) => makeWork(a.id, n)));
  return {
    authors,
    works,
    relations,
    sources: [
      {
        id: "src--britannica",
        title: "Britannica",
        publisherOrInstitution: "Encyclopædia Britannica"
      }
    ],
    movements: [],
    tours: [],
    positions: {
      version: "1.0.0",
      seed: 1,
      generatedAt: "2026-08-15",
      positions: Object.fromEntries(authors.map((a, i) => {
        const phi = (i / Math.max(1, authors.length)) * Math.PI * 2;
        return [a.id, [Math.cos(phi), 0, Math.sin(phi)]];
      }))
    },
    registry: authors.map((a) => ({
      id: a.id,
      ko: a.names.ko,
      original: a.names.original,
      layer: a.periods[0] ?? "mid-century",
      tier: a.tier,
      batch: "test"
    })),
    ...extra
  };
}
