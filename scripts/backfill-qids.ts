// Maintainer tool — resolves each author's Wikidata QID (name search + strict
// birth/death-year match) and writes it into data/authors/*.json as
// externalIds.wikidata. LOCAL-ONLY NETWORK, run interactively; never part of
// build/CI (repo network boundary). Idempotent: authors that already carry a
// QID are skipped.
//
// Matching ladder per author:
//   1. exact  — birth year equal; death year equal (living authors: candidate
//               must have no death claim)
//   2. ~tol   — birth within ±1 AND death year exactly equal. Catches the one
//               known scholarly dispute (Ellison b.1913 vs Wikidata 1914,
//               d.1994 exact — see docs/qc-ledger.md); logged with `~` for
//               maintainer eyes.
//   Anything else is left untouched and reported.
//
//   npm run qc:backfill-qids            # resolve + write
//   npm run qc:backfill-qids -- --dry   # resolve + report, write nothing

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaims, searchEntities, sleep, yearOf } from "./lib/wikidata.ts";

const AUTHORS_DIR = fileURLToPath(new URL("../data/authors/", import.meta.url));

interface RawAuthor {
  id: string;
  names: { ko: string; original: string; aliases: string[] };
  birthYear?: number;
  deathYear?: number;
  externalIds?: { wikidata?: string };
  [key: string]: unknown;
}

interface Candidate {
  qid: string;
  born?: number;
  died?: number;
}

function matchExact(a: RawAuthor, c: Candidate): boolean {
  if (c.born === undefined || c.born !== a.birthYear) return false;
  if (a.deathYear === undefined) return c.died === undefined; // living: WD must agree
  return c.died === a.deathYear;
}

function matchTolerant(a: RawAuthor, c: Candidate): boolean {
  if (c.born === undefined || a.birthYear === undefined) return false;
  if (Math.abs(c.born - a.birthYear) > 1) return false;
  if (a.deathYear === undefined) return c.died === undefined;
  return c.died === a.deathYear;
}

/** Rebuild the object with externalIds placed right after names, for readable JSON. */
function withQid(a: RawAuthor, qid: string): RawAuthor {
  const out: RawAuthor = { id: a.id, names: a.names, externalIds: { wikidata: qid } };
  for (const [k, v] of Object.entries(a)) {
    if (k === "id" || k === "names" || k === "externalIds") continue;
    out[k] = v;
  }
  return out;
}

async function resolveAuthor(a: RawAuthor): Promise<{ qid?: string; note: string }> {
  const query = a.names.original.replace(/\s+/g, " ");
  const search = await searchEntities(query);
  await sleep(600);
  const candidates: Candidate[] = [];
  for (const cand of search.search ?? []) {
    const claims = await getClaims(cand.id);
    await sleep(600);
    if (!claims) continue;
    candidates.push({ qid: cand.id, born: yearOf(claims, "P569"), died: yearOf(claims, "P570") });
  }
  const exact = candidates.find((c) => matchExact(a, c));
  if (exact) return { qid: exact.qid, note: `ok ${a.id}: ${exact.qid} (${exact.born}–${exact.died ?? "living"})` };
  const tol = candidates.find((c) => matchTolerant(a, c));
  if (tol) {
    return {
      qid: tol.qid,
      note: `~  ${a.id}: ${tol.qid} tolerance match — data ${a.birthYear}–${a.deathYear ?? "living"} vs WD ${tol.born}–${tol.died ?? "living"}`
    };
  }
  const seen = candidates.map((c) => `${c.qid} ${c.born ?? "?"}–${c.died ?? "?"}`).join(", ") || "none";
  return { note: `!! ${a.id}: unresolved — data ${a.birthYear}–${a.deathYear ?? "living"}; candidates: ${seen}` };
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry");
  let resolved = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const file of readdirSync(AUTHORS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(AUTHORS_DIR, file);
    const arr = JSON.parse(readFileSync(path, "utf8")) as RawAuthor[];
    let changed = false;
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]!;
      if (a.externalIds?.wikidata) {
        skipped++;
        continue;
      }
      const { qid, note } = await resolveAuthor(a);
      console.log(note);
      if (qid) {
        arr[i] = withQid(a, qid);
        changed = true;
        resolved++;
      } else {
        unresolved++;
      }
    }
    if (changed && !dry) {
      writeFileSync(path, JSON.stringify(arr, null, 2) + "\n");
      console.log(`-- wrote ${file}`);
    }
  }

  console.log(`\nresolved ${resolved}, already had ${skipped}, unresolved ${unresolved}${dry ? " (dry run)" : ""}`);
  if (unresolved > 0) process.exit(2);
}

await main();
