import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertCapsuleLock, assertRecoveryCheckout, MIGRATION44_BOUNDARY, MIGRATION44_CAPSULE } from "./phase-11i-migration-inventory.mjs";

function git(args) {
  const result = spawnSync("git", args, { maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("Fixed historical capsule source is unavailable locally.");
  return result.stdout;
}

// Materialize only the reviewed source constant; artifact text never reaches git.
// This command does not install dependencies, start a service or perform a restore.
export function prepareMigration44Capsule(destination) {
  if (!isAbsolute(destination ?? "") || existsSync(destination)) throw new Error("A new absolute capsule directory is required.");
  if (git(["rev-parse", `${MIGRATION44_CAPSULE.source}^{tree}`]).toString().trim() !== MIGRATION44_CAPSULE.tree) {
    throw new Error("Historical capsule tree mismatch.");
  }
  const archive = git(["archive", "--format=tar", MIGRATION44_CAPSULE.source]);
  mkdirSync(destination, { mode: 0o700 });
  try {
    const result = spawnSync("tar", ["-xf", "-", "-C", destination], { input: archive });
    if (result.status !== 0) throw new Error("Historical capsule extraction failed.");
    assertRecoveryCheckout(join(destination, "supabase/migrations"), MIGRATION44_BOUNDARY);
    assertCapsuleLock(destination, MIGRATION44_BOUNDARY);
    return { capsule: "migration44", source: MIGRATION44_CAPSULE.source, tree: MIGRATION44_CAPSULE.tree,
      migrationCount: 44, migrationHead: MIGRATION44_BOUNDARY.head, installed: false, restored: false };
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error("Specify only a new absolute capsule directory.");
  process.stdout.write(`${JSON.stringify(prepareMigration44Capsule(process.argv[2]))}\n`);
}
