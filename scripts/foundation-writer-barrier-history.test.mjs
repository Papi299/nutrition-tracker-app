import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { FULL35_OWNER_RELEASE_HISTORY as owner, FULL35_PORTION_SCOPE_HISTORY as portionScope, FULL35_VALIDATOR_REPAIR_HISTORY as validatorRepair, FULL35_RECEIPT_PERFORMANCE_HISTORY as receiptPerformance } from "./full35-owner-release-history.mjs";
import { FOUNDATION_WRITER_BARRIER_HISTORY as pin } from "./foundation-writer-barrier-history.mjs";
import { assertMigrationHistory, assertTrustedMigrationReplay, recoveryMigrationBoundary } from "./phase-11i-recovery-contract.mjs";

const checkout = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
const files = checkout.filter(name => name.slice(0,14) <= pin.head);
const read = name => readFileSync(`supabase/migrations/${name}`);
const boundary = recoveryMigrationBoundary(undefined, false, pin.head);

test("writer barrier replays only the exact ordered 49 migrations", () => {
  assert.deepEqual(boundary, {count:49, head:pin.head});
  assertMigrationHistory(files.map(name => name.slice(0,14)));
  assert.deepEqual(assertTrustedMigrationReplay(files, boundary, read), files);
  assert.deepEqual(assertTrustedMigrationReplay(checkout, boundary, read), files);
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

test("single-owner recovery pins the exact migration 50 and still replays the H49 prefix", () => {
  const h50 = recoveryMigrationBoundary(undefined, false, owner.head);
  assert.deepEqual(h50, {count:50, head:owner.head});
  const ownerFiles = checkout.filter(name => name.slice(0,14) <= owner.head);
  assertMigrationHistory(ownerFiles.map(name => name.slice(0,14)), h50);
  assert.deepEqual(assertTrustedMigrationReplay(checkout, h50, read), ownerFiles);
  assert.deepEqual(assertTrustedMigrationReplay(checkout, boundary, read), files);
  assert.throws(() => assertTrustedMigrationReplay(files, h50, read));
  assert.throws(() => assertTrustedMigrationReplay(checkout, h50,
    name => name === owner.filename ? Buffer.concat([read(name), Buffer.from("\n-- drift")]) : read(name)));
});

test("fractional portion scope recovery admits only the reviewed H51 successor", () => {
  const h51 = recoveryMigrationBoundary(undefined, false, portionScope.head);
  assert.deepEqual(h51, {count:51, head:portionScope.head});
  assertMigrationHistory(checkout.slice(0,51).map(name => name.slice(0,14)), h51);
  assert.deepEqual(assertTrustedMigrationReplay(checkout, h51, read), checkout.slice(0,51));
  assert.throws(() => assertTrustedMigrationReplay(checkout.slice(0,50), h51, read));
  assert.throws(() => assertTrustedMigrationReplay(checkout, h51,
    name => name === portionScope.filename ? Buffer.concat([read(name), Buffer.from("\n-- drift")]) : read(name)));
});

test("Full35 validator repair recovery admits only the pinned H52 successor", () => {
  const h52 = recoveryMigrationBoundary(undefined, false, validatorRepair.head);
  assert.deepEqual(h52, {count:52, head:validatorRepair.head});
  assert.deepEqual(assertTrustedMigrationReplay(checkout, h52, read), checkout.slice(0,52));
  assert.throws(() => assertTrustedMigrationReplay(checkout.slice(0,51), h52, read));
  assert.throws(() => assertTrustedMigrationReplay(checkout, h52,
    name => name === validatorRepair.filename ? "altered migration" : read(name)));
});

test("Full35 receipt performance recovery pins migration 53 and keeps the H52 prefix", () => {
  const h53 = recoveryMigrationBoundary(undefined, false, receiptPerformance.head);
  assert.deepEqual(h53, {count:53, head:receiptPerformance.head});
  assert.deepEqual(assertTrustedMigrationReplay(checkout, h53, read), checkout);
  assert.throws(() => assertTrustedMigrationReplay(checkout.slice(0,52), h53, read));
  assert.throws(() => assertTrustedMigrationReplay(checkout, h53,
    name => name === receiptPerformance.filename ? "altered migration" : read(name)));
});
