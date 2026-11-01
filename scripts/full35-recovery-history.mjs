import reviewedInventory from "../docs/evidence/nutrition-usda-full35-reprojection-001/migration-inventory.json" with { type: "json" };
import { fail, sha256 } from "./phase-11i-recovery-contract.mjs";

// Closed corrected source identity. Qualification evidence is separate from this
// immutable allowlist; the defective predecessor digest is never accepted.
export const FULL35_REVIEWED_HISTORY = Object.freeze({
  count: 47,
  head: "20261031104559",
  predecessor: "20261029083108",
  filename: "20261031104559_foundation_full35_mapping_reprojection_v1.sql",
  sqlSha256: "086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af",
  orderedFilenameSetSha256: "2aecccbc04539984a2cf05a88b69108b8a0e0637c2aaa609277d80bbee7fafe5",
  orderedInventorySha256: "30d1fc8f91a41c2eb925fa802df68378b7b1b8356938adc159df54701ae35ade",
});
export function assertReviewedFull35Files(files, readMigration) {
  const inventory = reviewedInventory.migrations;
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
