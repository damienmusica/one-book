// Maintainer QC tool — cross-checks every author's birth/death year against
// Wikidata (P569/P570). LOCAL-ONLY NETWORK, run interactively; never part of
// build/CI (repo LLM/network boundary). Polite: sequential, 600ms spacing.
//
// Authors carry their QID in externalIds.wikidata (backfilled once by
// scripts/backfill-qids.ts), so the check fetches each entity directly —
// reproducible, no name-search ambiguity. Name search remains only as a
// fallback for drafts that have not been through backfill yet.
//
//   npm run qc:crosscheck-dates            # all authors
//   npm run qc:crosscheck-dates -- --only mid-asia
//
// Exit 2 on any mismatch. Known standing dispute: ralph-ellison birth year
// (data 1913 per post-Rampersad scholarship vs Wikidata 1914 self-reported) —
// see docs/qc-ledger.md; the tool still reports it, the ledger owns the call.

import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections } from "./lib/load-node.ts";
import { getClaims, searchEntities, sleep, yearOf } from "./lib/wikidata.ts";
import type { WdClaims } from "./lib/wikidata.ts";

import type { Author } from "../src/types.ts";

function compare(a: Author, qid: string, claims: WdClaims): { ok: boolean; line: string } {
  const born = yearOf(claims, "P569");
  const died = yearOf(claims, "P570");
  const bornOk = a.birthYear === undefined || born === a.birthYear;
  const diedOk = a.deathYear === undefined ? died === undefined : died === a.deathYear;
  if (bornOk && diedOk) {
    return { ok: true, line: `ok ${a.id}: ${qid} ${born}–${died ?? "living"}` };
  }
  return {
    ok: false,
    line: `!! ${a.id}: data ${a.birthYear ?? "?"}–${a.deathYear ?? "living"} vs ${qid} ${born ?? "?"}–${died ?? "living"}`
  };
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
    try {
      const qid = a.externalIds?.wikidata;
      if (qid) {
        const claims = await getClaims(qid);
        await sleep(600);
        if (!claims) {
          console.log(`?  ${a.id}: ${qid} has no claims on Wikidata`);
          unresolved++;
          continue;
        }
        const { ok, line } = compare(a, qid, claims);
        console.log(line);
        if (!ok) mismatches++;
        continue;
      }

      // fallback for pre-backfill drafts: resolve by name, match by dates
      const query = a.names.original.replace(/\s+/g, " ");
      const search = await searchEntities(query);
      await sleep(600);
      const candidates = search.search ?? [];
      if (candidates.length === 0) {
        console.log(`?  ${a.id}: no stored QID and no Wikidata match for '${query}'`);
        unresolved++;
        continue;
      }
      let verdict = `?  ${a.id}: no stored QID, no candidate matched years`;
      let matched = false;
      for (const cand of candidates) {
        const claims = await getClaims(cand.id);
        await sleep(600);
        if (!claims) continue;
        const { ok, line } = compare(a, cand.id, claims);
        verdict = `${line} (name-search fallback — run backfill-qids)`;
        if (ok) {
          matched = true;
          break;
        }
      }
      if (!matched && verdict.startsWith("!!")) mismatches++;
      else if (!matched) unresolved++;
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
