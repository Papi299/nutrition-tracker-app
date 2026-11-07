import { createHash } from "node:crypto";
import { FOUNDATION_WRITER_BARRIER_HISTORY, assertReviewedFoundationWriterBarrierFiles } from "./foundation-writer-barrier-history.mjs";

export const FULL35_OWNER_RELEASE_HISTORY = Object.freeze({
  count: 50,
  head: "20261107103000",
  filename: "20261107103000_foundation_full35_single_owner_release.sql",
  sqlSha256: "84bfb9e66cd4ac0c56c5e5ca83de032736bd460d66c7550aa4d11426645384dc",
  orderedFilenameSetSha256: "7e378fdc611ef6da36c238df7c55aebc6047f7138889fc1c6bce8104439838a7",
});

export function assertReviewedFull35OwnerReleaseFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FULL35_OWNER_RELEASE_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Full35 owner release history required.");
  }
  assertReviewedFoundationWriterBarrierFiles(files.slice(0, FOUNDATION_WRITER_BARRIER_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Full35 owner release SQL checksum mismatch.");
  }
}

export const FULL35_PORTION_SCOPE_HISTORY = Object.freeze({
  count: 51,
  head: "20261107153000",
  filename: "20261107153000_preserve_fractional_foundation_portion_scope.sql",
  sqlSha256: "f27c1ea930f19e215248ed7a7b1eca890776693346add748d2c3daf214c23e33",
  orderedFilenameSetSha256: "738c20c10903d40596dd71b629f533bf991d2b24f36791c527da62ca447a0006",
});

export function assertReviewedFull35PortionScopeFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FULL35_PORTION_SCOPE_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Full35 portion scope history required.");
  }
  assertReviewedFull35OwnerReleaseFiles(files.slice(0, FULL35_OWNER_RELEASE_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Full35 portion scope SQL checksum mismatch.");
  }
}

export const FULL35_VALIDATOR_REPAIR_HISTORY = Object.freeze({
  count: 52,
  head: "20261107213500",
  filename: "20261107213500_repair_full35_production_validator.sql",
  sqlSha256: "2662bb1d646450d5f49d2c32d456a5bfce8a81066b11dff1e638d249c2739ab9",
  orderedFilenameSetSha256: "39844ceb9d7b0e3b6d37fd62993b001cbeaf628862eb57a353e68d9d0ce42b1a",
});

export function assertReviewedFull35ValidatorRepairFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FULL35_VALIDATOR_REPAIR_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Full35 validator repair history required.");
  }
  assertReviewedFull35PortionScopeFiles(files.slice(0, FULL35_PORTION_SCOPE_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Full35 validator repair SQL checksum mismatch.");
  }
}
