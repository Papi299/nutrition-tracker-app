// Local qualification/package assertions only. No database or provider client.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertReviewedAtomicDiaryFiles } from "./atomic-diary-recovery-history.mjs";
import reviewed from "../docs/evidence/nutrition-usda-full35-app-atomic-persistence-002/migration-inventory.json" with { type: "json" };

export const LOCAL_PROJECT = "full35-phased-003-local";
export const LOCAL_CONTAINERS = ["nutrition-phased-003-cli", "nutrition-phased-003-reference"];
export const POSTGRES_IMAGE = "sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518";
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = message => { throw new Error(message); };
const pins = reviewed.migrations;
const localConfig = `project_id = "${LOCAL_PROJECT}"\n[api]\nenabled = false\n[db]\nmajor_version = 17\n[db.seed]\nenabled = false\n`;

export function assertAcceptedSource(source) {
  const directory = join(source, "supabase/migrations");
  const names = readdirSync(directory).filter(name => name.endsWith(".sql")).sort();
  assertReviewedAtomicDiaryFiles(names, name => readFileSync(join(directory, name)));
  for (const name of names) if (lstatSync(join(directory, name)).isSymbolicLink()) fail("Migration symlink forbidden.");
  return names;
}

export function assertLocalTarget(target) {
  if (target.environment !== "LocalSynthetic" || !LOCAL_CONTAINERS.includes(target.name) ||
      target.networkMode !== "none" || target.image !== POSTGRES_IMAGE || target.privileged !== false ||
      Object.keys(target.portBindings ?? {}).length ||
      (target.mounts ?? []).some(mount => mount.Type !== "tmpfs") ||
      !target.runNonce || target.labelNonce !== target.runNonce) fail("Isolated local target required.");
}

export function assertBoundary(ledger, count) {
  if (![46, 47, 48].includes(count) || ledger.length !== count) fail("Exact schema boundary required.");
  for (const [index, row] of ledger.entries()) {
    const expected = pins[index];
    if (row.version !== expected.version || row.name !== expected.filename.slice(15, -4)) fail("Ordered migration identity mismatch.");
  }
}

export function materializePrefix(source, destination, count) {
  if (![46, 47, 48].includes(count)) fail("Only original 46/47/48 prefixes are supported.");
  assertAcceptedSource(source);
  if (existsSync(destination)) fail("Refusing to overwrite an operator package.");
  const directory = join(destination, "supabase/migrations");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const entry of pins.slice(0, count)) writeFileSync(join(directory, entry.filename),
    readFileSync(join(source, "supabase/migrations", entry.filename)), { mode: 0o600 });
  // No linked ref, environment file, roles, seed, Vault entry or API surface.
  writeFileSync(join(destination, "supabase/config.toml"),
    localConfig, { mode: 0o600 });
  const manifest = { schemaVersion: "full35-local-prefix/v1", environment: "LocalSynthetic",
    project: LOCAL_PROJECT, count, head: pins[count - 1].version,
    files: pins.slice(0, count).map(({ filename, sha256: hash }) => ({ filename, sha256: hash })) };
  writeFileSync(join(destination, "prefix-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  assertPrefix(destination, count);
  return manifest;
}

export function assertPrefix(directory, count) {
  if (![46, 47, 48].includes(count)) fail("Unsupported prefix.");
  const root = join(directory, "supabase");
  const config = readFileSync(join(root, "config.toml"), "utf8");
  if (config !== localConfig) fail("Wrong local project or configuration policy.");
  const allowed = new Set(["prefix-manifest.json", "supabase", "supabase/config.toml", "supabase/migrations",
    ...pins.slice(0, count).map(entry => "supabase/migrations/" + entry.filename)]);
  const inspect = (path, relative = "") => {
    for (const name of readdirSync(path)) {
      const key = relative ? relative + "/" + name : name, file = join(path, name), info = lstatSync(file);
      if (!allowed.has(key) || info.isSymbolicLink()) fail("Unexpected operator package input.");
      if (info.isDirectory()) inspect(file, key);
    }
  };
  inspect(directory);
  const manifest = JSON.parse(readFileSync(join(directory, "prefix-manifest.json"), "utf8"));
  if (manifest.environment !== "LocalSynthetic" || manifest.project !== LOCAL_PROJECT || manifest.count !== count ||
      manifest.head !== pins[count - 1].version) fail("Package environment/boundary mismatch.");
  const names = readdirSync(join(root, "migrations")).sort();
  const expected = pins.slice(0, count);
  if (names.length !== count || manifest.files.length !== count) fail("Extra pending migration or missing predecessor.");
  for (const [index, entry] of expected.entries()) {
    const file = join(root, "migrations", entry.filename);
    if (names[index] !== entry.filename || lstatSync(file).isSymbolicLink() || sha256(readFileSync(file)) !== entry.sha256 ||
        manifest.files[index].filename !== entry.filename || manifest.files[index].sha256 !== entry.sha256)
      fail("Prefix order, predecessor or SQL hash mismatch.");
  }
  return manifest;
}

export function assertUnchangedRows(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) fail("Unexpected Foundation or owner-history mutation.");
}

export function assertInstalledFingerprint(expected, observed) {
  if (!/^[a-f0-9]{64}$/.test(expected) || expected !== observed) fail("Installed object fingerprint mismatch.");
}

// Does not execute migrations. The runner alone holds the fixed local transport.
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [source, destination, count] = process.argv.slice(2);
  if (!source || !destination || !count || process.argv.length !== 5) fail("Usage: source destination count.");
  materializePrefix(source, destination, Number(count));
}
