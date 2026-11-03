import reviewed from "../docs/evidence/nutrition-usda-full35-app-atomic-persistence-002/migration-inventory.json" with { type: "json" };
import { createHash } from "node:crypto";
const sha256=value=>createHash("sha256").update(value).digest("hex");
const fail=message=>{throw new Error(message);};

// Closed complete history, generated from the actual CLI-created SQL bytes.
export const ATOMIC_DIARY_REVIEWED_HISTORY = Object.freeze({
  "count": 48,
  "head": "20261102181943",
  "filename": "20261102181943_atomic_food_diary_persistence_v1.sql",
  "sqlSha256": "f94401b3977e49744c983b3b49fe24fafc581a4dc1c57b71a95245e939c60766",
  "orderedFilenameSetSha256": "661d5444fdc94ce526b03fd285b05ae67e5f1de32ab1e3ace812f2639cdf36bd",
  "orderedInventorySha256": "4bd4dba279ddc8b2a5f64a8ff62ba1b0074fb5ffda4507a3a01efd13301bb563"
});
export function assertReviewedAtomicDiaryFiles(files, readMigration) {
  const canonical=reviewed.migrations.map(({filename,ordinal,predecessor,sha256,version})=>({filename,ordinal,predecessor,sha256,version}));
  const pin=ATOMIC_DIARY_REVIEWED_HISTORY;
  if(sha256(JSON.stringify(canonical))!==pin.orderedInventorySha256 || !Array.isArray(files) || files.length!==pin.count || sha256(files.join("\n"))!==pin.orderedFilenameSetSha256) fail("Exact ordered atomic diary history required.");
  for(const [i,e] of canonical.entries()) {
    if(e.ordinal!==i+1 || e.filename!==files[i] || e.version!==e.filename.slice(0,14) || e.predecessor!==(canonical[i-1]?.version??null) || sha256(readMigration(e.filename))!==e.sha256) fail("Atomic diary migration chain or SQL checksum mismatch.");
  }
}
