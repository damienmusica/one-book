import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawCollections } from "../../src/data/assemble.ts";

export const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA_DIR = join(PKG_ROOT, "data");

function readDirJson(dir: string, only?: string[]): Record<string, unknown> {
  const abs = join(DATA_DIR, dir);
  if (!existsSync(abs)) return {};
  const out: Record<string, unknown> = {};
  let files = readdirSync(abs).filter((f) => f.endsWith(".json")).sort();
  if (only) files = files.filter((f) => only.includes(f));
  for (const f of files) {
    try {
      out[`${dir}/${f}`] = JSON.parse(readFileSync(join(abs, f), "utf8"));
    } catch (e) {
      // report as a schema-shaped failure instead of crashing the whole run
      out[`${dir}/${f}`] = { __parse_error: String(e) };
    }
  }
  return out;
}

function readJson(file: string, fallback: unknown): unknown {
  const abs = join(DATA_DIR, file);
  if (!existsSync(abs)) return fallback;
  return JSON.parse(readFileSync(abs, "utf8"));
}

export function loadRawCollections(onlyBatch?: string, onlyRel?: string): RawCollections {
  const authorOnly = onlyBatch ? [`${onlyBatch}.json`] : undefined;
  const sourceOnly = onlyBatch ? ["core.json", `${onlyBatch}.json`] : undefined;
  const relOnly =
    onlyRel !== undefined ? [`${onlyRel}.json`] : onlyBatch ? [] : undefined;
  return {
    authorFiles: readDirJson("authors", authorOnly),
    workFiles: readDirJson("works", authorOnly),
    relationFiles: readDirJson("relations", relOnly),
    sourceFiles: readDirJson("sources", sourceOnly),
    movements: readJson("movements.json", []),
    tours: readJson("tours.json", []),
    positions: readJson("positions.v1.json", {
      version: "0.0.0",
      seed: 0,
      generatedAt: "unset",
      positions: {}
    }),
    registry: readJson("registry.json", [])
  };
}
