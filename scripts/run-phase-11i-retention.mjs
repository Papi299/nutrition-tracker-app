import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  assertBackupId,
  assertHash,
  assertRedactedEvidence,
  buildRetentionPlan,
} from "./phase-11i-recovery-contract.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value === "--apply") {
    args.set("apply", true);
  } else if (value.startsWith("--") && process.argv[index + 1]) {
    args.set(value.slice(2), process.argv[++index]);
  }
}

const rootInput = args.get("root") ?? process.env.PHASE11I_BACKUP_ROOT;
const now = args.get("now") ?? new Date().toISOString();
if (!rootInput) throw new Error("Retention backup root is required.");
const requestedRoot = resolve(rootInput);
if (lstatSync(requestedRoot).isSymbolicLink()) {
  throw new Error("Retention root cannot be a symlink.");
}
const root = realpathSync(requestedRoot);
if ((statSync(root).mode & 0o077) !== 0) {
  throw new Error("Retention root must be owner-restricted and cannot be a symlink.");
}

const entries = readdirSync(root);
for (const entry of entries) {
  if (
    entry.startsWith("phase11i-") &&
    !entry.endsWith(".archive.cms") &&
    !entry.endsWith(".manifest.json")
  ) {
    throw new Error(`Ambiguous Phase 11I artifact filename: ${entry}`);
  }
}

const artifacts = [];
const manifestPaths = new Map();
for (const entry of entries.filter((name) => name.endsWith(".manifest.json"))) {
  const manifestPath = join(root, entry);
  const manifestStat = lstatSync(manifestPath);
  if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
    throw new Error(`Retention refuses non-regular manifest: ${entry}`);
  }
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assertRedactedEvidence(manifest);
  assertBackupId(manifest.backupId);
  if (entry !== `${manifest.backupId}.manifest.json`) {
    throw new Error("Retention manifest filename does not match backup ID.");
  }
  const archivePath = join(root, `${manifest.backupId}.archive.cms`);
  const archiveStat = lstatSync(archivePath);
  if (archiveStat.isSymbolicLink() || !archiveStat.isFile()) {
    throw new Error("Retention archive is missing or not a regular file.");
  }
  assertHash(
    readFileSync(archivePath),
    manifest.encryptedArchiveSha256,
    "retained encrypted archive",
  );
  artifacts.push({
    backupId: manifest.backupId,
    completedAt: manifest.backupCompletedAt,
    isSymlink: false,
    path: archivePath,
    valid: true,
  });
  manifestPaths.set(archivePath, manifestPath);
}

const pairedArchiveNames = new Set(
  artifacts.map(({ path }) => basename(path)),
);
for (const entry of entries.filter((name) => name.endsWith(".archive.cms"))) {
  if (!pairedArchiveNames.has(entry)) {
    throw new Error(`Encrypted archive has no validated manifest pair: ${entry}`);
  }
}

const plan = buildRetentionPlan({ rootRealPath: root, artifacts, now });
if (args.get("apply")) {
  for (const archivePath of plan.deletePaths) {
    unlinkSync(archivePath);
    unlinkSync(manifestPaths.get(archivePath));
  }
}

process.stdout.write(
  `${JSON.stringify({
    mode: args.get("apply") ? "APPLY" : "DRY_RUN",
    root: basename(root),
    now,
    currentBackupId: plan.currentBackupId,
    deleteBackupIds: plan.deletePaths.map((path) =>
      basename(path).replace(/\.archive\.cms$/, ""),
    ),
    retainedBackupIds: plan.retainPaths.map((path) =>
      basename(path).replace(/\.archive\.cms$/, ""),
    ),
  })}\n`,
);
