import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { assertMigrationHistory, assertTrustedMigrationReplay, recoveryMigrationBoundary } from "./phase-11i-recovery-contract.mjs";
import { assertReviewedFull35Files, FULL35_REVIEWED_HISTORY } from "./full35-recovery-history.mjs";

const files = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
const readMigration = name => readFileSync(`supabase/migrations/${name}`);
test("all 47 exact reviewed filenames, predecessor links and SQL bytes match", () => assertReviewedFull35Files(files, readMigration));
for (const [label, change] of [
  ["unknown count 48", names => names.push("20261101000000_unknown.sql")],
  ["missing predecessor", names => names.splice(45, 1)],
  ["reordered history", names => { [names[8], names[9]] = [names[9], names[8]]; }],
  ["different final filename", names => { names[46] = "20261031104559_other.sql"; }],
  ["wrong final version", names => { names[46] = "20261031104560_foundation_full35_mapping_reprojection_v1.sql"; }],
  ["duplicate version", names => { names[45] = names[44]; }],
  ["partial replay", names => names.pop()],
]) test(`${label} cannot match the reviewed Full35 source history`, () => {
  const changed = [...files]; change(changed);
  assert.throws(() => assertReviewedFull35Files(changed, readMigration), /Exact ordered/);
});
for (const index of [0, 43, 44, 45, 46]) test(`unreviewed SQL edit at ordinal ${index + 1} fails`, () => {
  assert.throws(() => assertReviewedFull35Files(files, name => name === files[index]
    ? Buffer.concat([readMigration(name), Buffer.from("\n-- tamper\n")]) : readMigration(name)), /SQL checksum/);
});
test("only exact corrected history 47 is an approved replay boundary", () => {
  const boundary = recoveryMigrationBoundary(undefined, false, FULL35_REVIEWED_HISTORY.head);
  assert.deepEqual(boundary, {count:47,head:"20261031104559"});
  assertMigrationHistory(files.map(name => name.slice(0, 14)), boundary);
  assert.deepEqual(assertTrustedMigrationReplay(files,boundary,readMigration), files);
  assert.throws(() => assertTrustedMigrationReplay([...files,"20261101000000_unknown.sql"],boundary,readMigration));
  assert.throws(() => assertMigrationHistory([...files.slice(0,46).map(name=>name.slice(0,14)),"20261031104560"]));
});
for (const count of [44, 45, 46]) test(`original reviewed history ${count} remains accepted`, () => {
  assertMigrationHistory(files.slice(0, count).map(name => name.slice(0, 14)));
});
