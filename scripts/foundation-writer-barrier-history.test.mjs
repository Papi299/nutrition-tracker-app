import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { FOUNDATION_WRITER_BARRIER_HISTORY as pin } from "./foundation-writer-barrier-history.mjs";
import { assertMigrationHistory, assertTrustedMigrationReplay, recoveryMigrationBoundary } from "./phase-11i-recovery-contract.mjs";

const files = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
const read = name => readFileSync(`supabase/migrations/${name}`);
const boundary = recoveryMigrationBoundary(undefined, false, pin.head);

test("writer barrier replays only the exact ordered 49 migrations", () => {
  assert.deepEqual(boundary, {count:49, head:pin.head});
  assertMigrationHistory(files.map(name => name.slice(0,14)));
  assert.deepEqual(assertTrustedMigrationReplay(files, boundary, read), files);
  for (const altered of [
    [...files.slice(0,-1), `${pin.head}_different.sql`],
    [...files.slice(0,45), ...files.slice(46)],
    [...files.slice(0,47), files[48], files[47]],
    [...files, "20270101000000_unreviewed.sql"],
  ]) {
    assert.throws(() => assertTrustedMigrationReplay(altered, boundary, read));
  }
  for (const filename of [files[0], files[47], pin.filename]) {
    assert.throws(() => assertTrustedMigrationReplay(files, boundary,
      name => name === filename ? Buffer.concat([read(name), Buffer.from("\n-- drift")]) : read(name)));
  }
});
