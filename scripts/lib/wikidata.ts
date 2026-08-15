// Shared Wikidata client bits for the maintainer QC tools (crosscheck-dates,
// backfill-qids). LOCAL-ONLY NETWORK — these helpers must never be imported
// from build/runtime code (repo network boundary).

export const WD_UA = "LiteraryPlanet-QC/0.1 (maintainer tool; contact: repo owner)";

export interface WdSearchResult {
  search?: Array<{ id: string; label?: string; description?: string }>;
}

export interface WdEntities {
  entities?: Record<
    string,
    {
      claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { time?: string } } } }>>;
      labels?: Record<string, { value?: string }>;
      descriptions?: Record<string, { value?: string }>;
    }
  >;
}

export type WdClaims = NonNullable<NonNullable<WdEntities["entities"]>[string]["claims"]>;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Polite fetch: identifies itself, backs off on 429, throws on other errors. */
export async function wdJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": WD_UA } });
    if (res.status === 429 && attempt < 3) {
      await sleep(15000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  }
}

/** First year of a time-valued claim (e.g. P569 birth, P570 death). */
export function yearOf(claims: WdClaims | undefined, prop: string): number | undefined {
  const time = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value?.time;
  const m = time?.match(/^([+-]\d+)-/);
  return m?.[1] !== undefined ? Number(m[1]) : undefined;
}

export async function searchEntities(query: string): Promise<WdSearchResult> {
  return wdJson<WdSearchResult>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(query)}`
  );
}

export async function getClaims(qid: string): Promise<WdClaims | undefined> {
  const ent = await wdJson<WdEntities>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${qid}&props=claims&languages=en`
  );
  return ent.entities?.[qid]?.claims;
}
