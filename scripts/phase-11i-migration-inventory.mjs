import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const inventory = JSON.parse(readFileSync(new URL("../ops/recovery/nutrition-migration-inventory.json", import.meta.url)));
export const MIGRATION_INVENTORY = Object.freeze(inventory.migrations.map(entry => Object.freeze(entry)));
export const MIGRATION44_CAPSULE = Object.freeze(inventory.migration44Capsule);
const boundary = count => Object.freeze({ count, head: MIGRATION_INVENTORY[count - 1].version,
  versions: Object.freeze(MIGRATION_INVENTORY.slice(0, count).map(entry => entry.version)),
  historySha256: createHash("sha256").update(JSON.stringify(MIGRATION_INVENTORY.slice(0, count).map(entry => entry.version))).digest("hex"),
});
export const MIGRATION45_BOUNDARY = boundary(45);
export const MIGRATION44_BOUNDARY = boundary(44);

export function assertTrustedBoundary(value) {
  if (value !== MIGRATION45_BOUNDARY && value !== MIGRATION44_BOUNDARY) {
    throw new Error("Untrusted recovery migration boundary.");
  }
}

// This checks approved repository bytes. A hosted ledger is identity evidence,
// not cryptographic attestation of the SQL historically executed there.
export function assertRecoveryCheckout(directory, selected = MIGRATION45_BOUNDARY) {
  assertTrustedBoundary(selected);
  const files = readdirSync(directory).filter(name => name.endsWith(".sql")).sort();
  const expected = MIGRATION_INVENTORY.slice(0, selected.count);
  if (JSON.stringify(files) !== JSON.stringify(expected.map(entry => entry.filename))) {
    throw new Error("Recovery checkout migration inventory mismatch.");
  }
  for (const entry of expected) {
    const actual = createHash("sha256").update(readFileSync(join(directory, entry.filename))).digest("hex");
    if (actual !== entry.sha256) throw new Error("Recovery checkout migration checksum mismatch.");
  }
}

// Only the restore caller selects this fixed entry. Never infer it from an artifact.
export function selectRestoreBoundary(capsule) {
  if (capsule === undefined || capsule === "migration45") return MIGRATION45_BOUNDARY;
  if (capsule === "migration44") return MIGRATION44_BOUNDARY;
  throw new Error("Unsupported recovery capsule selection.");
}

export function assertCapsuleLock(checkoutRoot, selected) {
  assertTrustedBoundary(selected);
  if (selected !== MIGRATION44_BOUNDARY) return;
  const digest = createHash("sha256").update(readFileSync(join(checkoutRoot, "package-lock.json"))).digest("hex");
  if (digest !== MIGRATION44_CAPSULE.packageLockSha256) throw new Error("Migration44 capsule dependency lock mismatch.");
}
