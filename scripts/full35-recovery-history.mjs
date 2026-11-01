import { readFileSync } from "node:fs";
import { fail, sha256 } from "./phase-11i-recovery-contract.mjs";

// Reviewed identity precondition only. This is deliberately NOT a new accepted
// recovery boundary: immutable actor OIDs still prevent behavioral recovery.
export const FULL35_REVIEWED_HISTORY = Object.freeze({
  count: 47,
  head: "20261031104559",
  predecessor: "20261029083108",
  filename: "20261031104559_foundation_full35_mapping_reprojection_v1.sql",
  sqlSha256: "907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703",
  orderedFilenameSetSha256: "2aecccbc04539984a2cf05a88b69108b8a0e0637c2aaa609277d80bbee7fafe5",
  orderedInventorySha256: "ce2ad2a1f3259430574a6c2ff9365f0b56b8baa5525931a16611fe29042ea5f8",
  recoveryQualified: false,
});
export function assertReviewedFull35Files(files, readMigration) {
  const inventory = JSON.parse(readFileSync(new URL("../docs/evidence/nutrition-usda-full35-reprojection-001/migration-inventory.json", import.meta.url))).migrations;
  const canonical = inventory.map(({ filename, ordinal, predecessor, sha256, version }) => ({ filename, ordinal, predecessor, sha256, version }));
  if (sha256(JSON.stringify(canonical)) !== FULL35_REVIEWED_HISTORY.orderedInventorySha256) fail("Reviewed Full35 inventory pin mismatch.");
  if (!Array.isArray(files) || files.length !== 47 || sha256(files.join("\n")) !== FULL35_REVIEWED_HISTORY.orderedFilenameSetSha256) {
    fail("Exact ordered 47-file Full35 inventory required.");
  }
  for (const [index, entry] of inventory.entries()) {
    if (entry.ordinal !== index + 1 || entry.filename !== files[index] ||
        entry.version !== files[index].slice(0, 14) || entry.predecessor !== (inventory[index - 1]?.version ?? null) ||
        sha256(readMigration(entry.filename)) !== entry.sha256) fail("Reviewed Full35 migration chain or SQL checksum mismatch.");
  }
}
