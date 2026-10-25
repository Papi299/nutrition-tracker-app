import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { assertMigrationHistory, recoveryMigrationBoundary, PRODUCTION_PROJECT_REF } from "./phase-11i-recovery-contract.mjs";
import { assertRecoveryCheckout, assertCapsuleLock, MIGRATION45_BOUNDARY as boundary, MIGRATION44_BOUNDARY as old,
  MIGRATION44_CAPSULE, MIGRATION_INVENTORY, selectRestoreBoundary } from "./phase-11i-migration-inventory.mjs";
import { assertCaptureImplementation, CAPTURE_BLOCKER } from "./phase-11i-capture-consistency.mjs";
import { prepareMigration44Capsule } from "./prepare-phase-11i-migration44-capsule.mjs";

const exact = boundary.versions;
test("all45 exact ordered versions and SQL bytes agree", () => {
  assertMigrationHistory(exact);
  assertRecoveryCheckout("supabase/migrations");
  assert.equal(MIGRATION_INVENTORY.at(-1).sha256, "d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc");
});
for (const [label, mutate] of [
  ["44", v => v.slice(0, -1)], ["missing", v => v.filter((_, i) => i !== 10)],
  ["duplicate", v => v.map((x, i) => i === 10 ? v[9] : x)],
  ["substituted interior preserving count/head/order", v => v.map((x, i) => i === 10 ? String(BigInt(x) + 1n) : x)],
  ["reordered", v => { [v[9], v[10]] = [v[10], v[9]]; return v; }],
  ["extra", v => [...v, "99999999999999"]], ["future head", v => [...v.slice(0, -1), "99999999999999"]],
]) test(`strict45 rejects ${label}`, () => assert.throws(() => assertMigrationHistory(mutate([...exact]))));
test("caller-defined count/head/history cannot redefine trust", () => {
  assert.throws(() => assertMigrationHistory(exact, { ...boundary }));
  assert.equal(selectRestoreBoundary(), boundary);
  assert.equal(selectRestoreBoundary("migration44"), old);
  for (const selector of ["2617a60", {}, 44, "latest", "auto"]) assert.throws(() => selectRestoreBoundary(selector));
  assert.throws(() => assertMigrationHistory(old.versions));
  assertMigrationHistory(old.versions, selectRestoreBoundary("migration44"));
});
test("synthetic opt-in cannot enable Production capture or change inventory", () => {
  const local = { projectRef: "PHASE_11I_SYNTHETIC_POPULATED_FIXTURE", sourceEnvironment: "LocalSynthetic" };
  assert.equal(recoveryMigrationBoundary(local, true), boundary);
  assertCaptureImplementation(local);
  for (const source of [undefined, { ...local, projectRef: PRODUCTION_PROJECT_REF }, { ...local, sourceEnvironment: "Production" }]) {
    assert.throws(() => recoveryMigrationBoundary(source, true));
    assert.throws(() => assertCaptureImplementation(source), new RegExp(CAPTURE_BLOCKER));
  }
});
test("Production executable refuses before credentials/provider access, despite bypass variables", () => {
  const result = spawnSync(process.execPath, ["scripts/run-phase-11i-backup.mjs"], { encoding: "utf8", env: {
    ...process.env, PHASE11I_SOURCE_ENVIRONMENT: "Production", ALLOW_NON_PRODUCTION_SOURCE: "1",
    PHASE11I_RECOVERY_CAPSULE: "migration44", SOURCE_CAPTURE_CONSISTENCY: "PASS",
  } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(CAPTURE_BLOCKER));
});
test("fixed complete44 capsule differs from capture checkout; never modifies current45", () => {
  const root = mkdtempSync(join(tmpdir(), "nutrition-002a-capsule-test-"));
  try {
    const dest = join(root, "historical");
    const prepared = prepareMigration44Capsule(dest);
    assert.equal(prepared.source, MIGRATION44_CAPSULE.source);
    assert.equal(prepared.tree, MIGRATION44_CAPSULE.tree);
    assertRecoveryCheckout(join(dest, "supabase/migrations"), old);
    assertCapsuleLock(dest, old);
    assert.throws(() => assertRecoveryCheckout(join(dest, "supabase/migrations"), boundary));
    assert.throws(() => assertRecoveryCheckout("supabase/migrations", old));
    assert.throws(() => prepareMigration44Capsule(dest));
    // Backup creation from approved app source50716d3 is distinct from replay2617a60.
    assert.notEqual(JSON.parse(readFileSync("ops/recovery/nutrition-migration-inventory.json")).approvedApplicationSource, prepared.source);
    assertRecoveryCheckout("supabase/migrations", boundary);
    writeFileSync(join(dest, "package-lock.json"), "{}");
    assert.throws(() => assertCapsuleLock(dest, old));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("edited SQL rejected even with exact filenames/history", () => {
  const root = mkdtempSync(join(tmpdir(), "nutrition-002a-checkout-test-"));
  try {
    cpSync("supabase/migrations", root, { recursive: true });
    writeFileSync(join(root, MIGRATION_INVENTORY[10].filename), "-- edited\n");
    assert.throws(() => assertRecoveryCheckout(root), /checksum/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
