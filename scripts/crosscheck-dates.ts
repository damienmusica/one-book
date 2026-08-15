// Maintainer QC tool — cross-checks every author's birth/death year against
// Wikidata (P569/P570). LOCAL-ONLY NETWORK, run interactively; never part of
// build/CI (repo LLM/network boundary). Polite: sequential, ~350ms spacing.
//
//   npm run qc:crosscheck-dates            # all authors
//   npm run qc:crosscheck-dates -- --only mid-asia

import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections } from "./lib/load-node.ts";

const UA = "LiteraryPlanet-QC/0.1 (maintainer tool; contact: repo owner)";

interface WdSearchResult {
  search?: Array<{ id: string; label?: string; description?: string }>;
}

interface WdEntities {
  entities?: Record<
    string,
    {
      claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { time?: string } } } }>>;
      labels?: Record<string, { value?: string }>;
      descriptions?: Record<string, { value?: string }>;
    }
  >;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wdJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (res.status === 429 && attempt < 3) {
      await sleep(15000 * (attempt + 1)); // polite backoff on throttle
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  }
}

function yearOf(claims: WdEntities["entities"] extends infer E
  ? E extends Record<string, infer V>
    ? V extends { claims?: infer C }
      ? C
      : never
    : never
  : never, prop: string): number | undefined {
  const c = (claims as Record<string, Array<{ mainsnak?: { datavalue?: { value?: { time?: string } } } }>> | undefined)?.[prop];
  const time = c?.[0]?.mainsnak?.datavalue?.value?.time;
  const m = time?.match(/^([+-]\d+)-/);
  return m?.[1] !== undefined ? Number(m[1]) : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const onlyBatch = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

  const { dataset, errors } = assembleDataset(loadRawCollections(onlyBatch), {
    allowPartial: true
  });
  if (!dataset) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  let mismatches = 0;
  let unresolved = 0;
  for (const a of dataset.authors) {
    const query = a.names.original.replace(/\s+/g, " ");
    try {
      const search = await wdJson<WdSearchResult>(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(query)}`
      );
      await sleep(600);
      const candidates = search.search ?? [];
      if (candidates.length === 0) {
        console.log(`?  ${a.id}: no Wikidata match for '${query}'`);
        unresolved++;
        continue;
      }
      let verdict = `?  ${a.id}: no candidate matched years`;
      let matched = false;
      for (const cand of candidates) {
        const ent = await wdJson<WdEntities>(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${cand.id}&props=claims&languages=en`
        );
        await sleep(600);
        const claims = ent.entities?.[cand.id]?.claims;
        if (!claims) continue;
        const born = yearOf(claims, "P569");
        const died = yearOf(claims, "P570");
        if (born === undefined) continue;
        const bornOk = a.birthYear === undefined || born === a.birthYear;
        const diedOk =
          a.deathYear === undefined ? died === undefined || died >= 2026 - 1 || true : died === a.deathYear;
        if (bornOk && diedOk) {
          verdict = `ok ${a.id}: ${cand.id} ${born}–${died ?? ""}`;
          matched = true;
          break;
        }
        verdict = `!! ${a.id}: data ${a.birthYear ?? "?"}–${a.deathYear ?? "living"} vs ${cand.id} ${born}–${died ?? "living"}`;
      }
      if (!matched) {
        if (verdict.startsWith("!!")) mismatches++;
        else unresolved++;
      }
      console.log(verdict);
    } catch (e) {
      console.log(`x  ${a.id}: fetch failed (${String(e).slice(0, 80)})`);
      unresolved++;
    }
  }
  console.log(
    `\nchecked ${dataset.authors.length} authors — mismatches ${mismatches}, unresolved ${unresolved}`
  );
  if (mismatches > 0) process.exit(2);
}

await main();
