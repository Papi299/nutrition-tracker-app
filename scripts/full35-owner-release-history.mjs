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

export const FULL35_RECEIPT_PERFORMANCE_HISTORY = Object.freeze({
  count: 53,
  head: "20261108073000",
  filename: "20261108073000_optimize_full35_receipt_fingerprint.sql",
  sqlSha256: "d2a7644096224879a0008f94cd19fd2aba0aedb2196c0c93e1f47943f7f8ce56",
  orderedFilenameSetSha256: "0e6b42ddb2ce463f73aaf29b79ef22c55631844ff4882054e2db9d2da467fe42",
});

export const FULL35_FINAL_AUTHORIZATION_ID = "21a76747-c907-4b67-b324-d384a685b111";

export function assertReviewedFull35ReceiptPerformanceFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FULL35_RECEIPT_PERFORMANCE_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Full35 receipt performance history required.");
  }
  assertReviewedFull35ValidatorRepairFiles(files.slice(0, FULL35_VALIDATOR_REPAIR_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Full35 receipt performance SQL checksum mismatch.");
  }
}

export const FULL35_OBSERVED_EXECUTION_HISTORY = Object.freeze({
  count: 54,
  head: "20261108110500",
  filename: "20261108110500_reduce_full35_execution_cost.sql",
  sqlSha256: "f7d83e693096a5206f09ee8cadf5a0865a2fa9e03fb98540d00dfe8ff2c211e0",
  orderedFilenameSetSha256: "0d7d374b17a7751cfafd53e4f38c39c34b82c0e0f7ff0e01f07f7f349d973136",
});

export const FULL35_OBSERVED_AUTHORIZATION_ID = "1040560a-303d-4b3c-bcba-270ac3a05b56";

export function assertReviewedFull35ObservedExecutionFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FULL35_OBSERVED_EXECUTION_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Full35 observed execution history required.");
  }
  assertReviewedFull35ReceiptPerformanceFiles(files.slice(0, FULL35_RECEIPT_PERFORMANCE_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Full35 observed execution SQL checksum mismatch.");
  }
}

export const FULL35_VALIDATOR_SPILL_HISTORY = Object.freeze({
  count: 55,
  head: "20261108182000",
  filename: "20261108182000_reduce_full35_validator_spills.sql",
  sqlSha256: "49bacbe4c0f8925621b4283918d518daa29b2958f5ed5cb98d5be09617110245",
  orderedFilenameSetSha256: "1a70003292a9df5e56ba29a1c316458106bc219e90be3be1c1c4e28159cc9879",
});

export const FULL35_SPILL_REPAIR_AUTHORIZATION_ID = "a8a5608a-750d-4d1d-b47f-e5f8d47d061a";

export function assertReviewedFull35ValidatorSpillFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FULL35_VALIDATOR_SPILL_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Full35 validator spill repair history required.");
  }
  assertReviewedFull35ObservedExecutionFiles(files.slice(0, FULL35_OBSERVED_EXECUTION_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Full35 validator spill repair SQL checksum mismatch.");
  }
}
