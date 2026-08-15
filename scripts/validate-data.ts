import { assembleDataset } from "../src/data/assemble.ts";
import { loadRawCollections } from "./lib/load-node.ts";

const args = process.argv.slice(2);
const allowPartial = args.includes("--allow-partial");
const onlyIdx = args.indexOf("--only");
const onlyBatch = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
const onlyRelIdx = args.indexOf("--only-rel");
const onlyRel = onlyRelIdx >= 0 ? args[onlyRelIdx + 1] : undefined;
const { dataset, errors, warnings } = assembleDataset(
  loadRawCollections(onlyBatch, onlyRel),
  { allowPartial: allowPartial || onlyBatch !== undefined || onlyRel !== undefined }
);

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

if (dataset) {
  const byStatus = new Map<string, number>();
  for (const a of dataset.authors) {
    byStatus.set(a.reviewStatus, (byStatus.get(a.reviewStatus) ?? 0) + 1);
  }
  const byLevel = new Map<string, number>();
  for (const r of dataset.relations) {
    byLevel.set(r.evidenceLevel, (byLevel.get(r.evidenceLevel) ?? 0) + 1);
  }
  console.log(
    [
      "",
      `authors    ${dataset.authors.length}  (${[...byStatus].map(([k, v]) => `${k}: ${v}`).join(", ") || "none"})`,
      `works      ${dataset.works.length}`,
      `relations  ${dataset.relations.length}  (${[...byLevel].map(([k, v]) => `${k}: ${v}`).join(", ") || "none"})`,
      `sources    ${dataset.sources.length}`,
      `movements  ${dataset.movements.length}`,
      `tours      ${dataset.tours.length}`,
      `positions  ${Object.keys(dataset.positions.positions).length} (v${dataset.positions.version})`,
      `warnings   ${warnings.length}`
    ].join("\n")
  );
}

if (errors.length > 0) {
  console.error(`\nvalidation FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log("\nvalidation OK");
