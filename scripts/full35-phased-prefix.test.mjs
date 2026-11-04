import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assertBoundary, assertInstalledFingerprint, assertLocalTarget, assertPrefix, assertUnchangedRows,
  LOCAL_PROJECT, materializePrefix, POSTGRES_IMAGE } from "./full35-phased-prefix.mjs";
import reviewed from "../docs/evidence/nutrition-usda-full35-app-atomic-persistence-002/migration-inventory.json" with { type: "json" };
const root = resolve(new URL("..", import.meta.url).pathname);
const withPackage = fn => { const task = mkdtempSync(join(tmpdir(), "full35-prefix-test-"));
  try { const directory = join(task, "package"); materializePrefix(root, directory, 47); fn(directory); }
  finally { rmSync(task, { recursive: true, force: true }); } };
const ledger = count => reviewed.migrations.slice(0, count).map(e => ({ version: e.version, name: e.filename.slice(15, -4) }));
test("47 package contains exact predecessors and cannot admit 48", () => withPackage(directory => {
  const p = assertPrefix(directory, 47); assert.equal(p.files.length, 47); assert.equal(p.head, "20261031104559");
  assert.throws(() => assertPrefix(directory, 48));
}));
for (const [name, mutate] of [
  ["wrong project", directory => writeFileSync(join(directory, "supabase/config.toml"), 'project_id = "other"')],
  ["wrong environment", directory => { const p = join(directory, "prefix-manifest.json"), j = JSON.parse(readFileSync(p)); j.environment = "Production"; writeFileSync(p, JSON.stringify(j)); }],
  ["wrong SQL hash", directory => writeFileSync(join(directory, "supabase/migrations", reviewed.migrations[46].filename), "select 1;")],
  ["missing predecessor", directory => rmSync(join(directory, "supabase/migrations", reviewed.migrations[0].filename))],
  ["extra pending migration", directory => cpSync(join(root, "supabase/migrations", reviewed.migrations[47].filename), join(directory, "supabase/migrations", reviewed.migrations[47].filename))],
  ["reordered identity", directory => renameSync(join(directory, "supabase/migrations", reviewed.migrations[0].filename), join(directory, "supabase/migrations", "99999999999999_first.sql"))],
  ["linked project", directory => writeFileSync(join(directory, ".env"), "APP_ENVIRONMENT=Production")],
  ["alternate environment file", directory => writeFileSync(join(directory, ".env.production"), "APP_ENVIRONMENT=Production")],
  ["unexpected CLI config", directory => { const p = join(directory, "supabase/config.toml"); writeFileSync(p, readFileSync(p, "utf8") + "[db.migrations]\nenabled = false\n"); }],
]) test(name + " is rejected before any database command", () => withPackage(directory => { mutate(directory); assert.throws(() => assertPrefix(directory, 47)); }));
test("ledger checks exact version/name order and refuses a skipped boundary", () => {
  assertBoundary(ledger(46), 46); assertBoundary(ledger(47), 47); assertBoundary(ledger(48), 48);
  assert.throws(() => assertBoundary(ledger(48), 47)); const wrong = ledger(47); wrong.reverse(); assert.throws(() => assertBoundary(wrong, 47));
});
test("target guard refuses network, environment, identity, ports and persistent volumes", () => {
  const good = { environment: "LocalSynthetic", name: "nutrition-phased-003-cli", networkMode: "none", image: POSTGRES_IMAGE,
    privileged: false, portBindings: {}, mounts: [{ Type: "tmpfs" }], runNonce: "synthetic-nonce", labelNonce: "synthetic-nonce" };
  assertLocalTarget(good);
  for (const delta of [{ environment: "Production" }, { name: LOCAL_PROJECT }, { networkMode: "bridge" }, { image: "other" },
    { privileged: true }, { portBindings: { 5432: [] } }, { mounts: [{ Type: "volume" }] }, { labelNonce: "different" }])
    assert.throws(() => assertLocalTarget({ ...good, ...delta }));
});
test("data and installed-object drift cannot be hidden by equal counts", () => {
  assertUnchangedRows({ diary: "a" }, { diary: "a" }); assert.throws(() => assertUnchangedRows({ count: 1, hash: "a" }, { count: 1, hash: "b" }));
  assertInstalledFingerprint("a".repeat(64), "a".repeat(64)); assert.throws(() => assertInstalledFingerprint("a".repeat(64), "b".repeat(64)));
});
