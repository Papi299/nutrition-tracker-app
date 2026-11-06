import { createHash } from "node:crypto";
import { ATOMIC_DIARY_REVIEWED_HISTORY, assertReviewedAtomicDiaryFiles } from "./atomic-diary-recovery-history.mjs";

export const FOUNDATION_WRITER_BARRIER_HISTORY = Object.freeze({
  count: 49,
  head: "20261106101256",
  filename: "20261106101256_foundation_diary_writer_barrier.sql",
  sqlSha256: "c2a54ca4f3fc20871ddd283190f091126f8207b4cf17e78676196db586d53323",
  orderedFilenameSetSha256: "5a0e40ca7c84b7c8aa4fadd83e5f07535b7b3e7a4ba55f249325d51df3ee285a",
});

export function assertReviewedFoundationWriterBarrierFiles(files, readMigration) {
  const { count, filename, sqlSha256 } = FOUNDATION_WRITER_BARRIER_HISTORY;
  if (!Array.isArray(files) || files.length !== count || files.at(-1) !== filename) {
    throw new Error("Exact ordered Foundation writer barrier history required.");
  }
  assertReviewedAtomicDiaryFiles(files.slice(0, ATOMIC_DIARY_REVIEWED_HISTORY.count), readMigration);
  if (createHash("sha256").update(readMigration(filename)).digest("hex") !== sqlSha256) {
    throw new Error("Foundation writer barrier SQL checksum mismatch.");
  }
}
