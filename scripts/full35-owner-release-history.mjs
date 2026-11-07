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
