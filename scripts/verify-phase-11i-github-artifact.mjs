import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  assertBackupId,
  assertHash,
  assertProductionSource,
  assertRecipientCertificateFingerprint,
  assertRedactedEvidence,
  EXPECTED_RECIPIENT_CERT_SHA256,
  sha256,
} from "./phase-11i-recovery-contract.mjs";

function fail(message) {
  throw new Error(`GitHub artifact verification failed: ${message}`);
}

function assertChildPath(parent, child, label) {
  const pathFromParent = relative(parent, child);
  if (!pathFromParent || pathFromParent.startsWith("..") || isAbsolute(pathFromParent)) {
    fail(`${label} must remain inside the runner temporary directory.`);
  }
}

const backupRootInput = process.env.PHASE11I_BACKUP_ROOT;
const runnerTempInput = process.env.RUNNER_TEMP;
const workspaceInput = process.env.GITHUB_WORKSPACE;
if (!backupRootInput || !runnerTempInput || !workspaceInput) {
  fail("PHASE11I_BACKUP_ROOT, RUNNER_TEMP, and GITHUB_WORKSPACE are required.");
}
if (![backupRootInput, runnerTempInput, workspaceInput].every(isAbsolute)) {
  fail("Runner paths must be absolute.");
}

const backupRootRequested = resolve(backupRootInput);
const backupRootStat = lstatSync(backupRootRequested);
if (!backupRootStat.isDirectory() || backupRootStat.isSymbolicLink()) {
  fail("Backup root must be a regular non-symlink directory.");
}
if ((backupRootStat.mode & 0o777) !== 0o700) {
  fail("Backup root mode must be 0700.");
}

const backupRoot = realpathSync(backupRootRequested);
const runnerTemp = realpathSync(resolve(runnerTempInput));
const workspace = realpathSync(resolve(workspaceInput));
assertChildPath(runnerTemp, backupRoot, "Backup root");
const pathFromWorkspace = relative(workspace, backupRoot);
if (!pathFromWorkspace.startsWith("..") && !isAbsolute(pathFromWorkspace)) {
  fail("Backup root must remain outside the Git checkout.");
}

const entries = readdirSync(backupRoot, { withFileTypes: true });
if (entries.length !== 2 || entries.some((entry) => !entry.isFile())) {
  fail("Backup root must contain exactly two regular files.");
}
const archiveEntry = entries.find((entry) => entry.name.endsWith(".archive.cms"));
const manifestEntry = entries.find((entry) => entry.name.endsWith(".manifest.json"));
if (!archiveEntry || !manifestEntry) {
  fail("Expected one encrypted archive and one redacted manifest.");
}

const backupId = archiveEntry.name.slice(0, -".archive.cms".length);
assertBackupId(backupId);
if (manifestEntry.name !== `${backupId}.manifest.json`) {
  fail("Archive and manifest backup identities do not match.");
}

const archivePath = join(backupRoot, archiveEntry.name);
const manifestPath = join(backupRoot, manifestEntry.name);
for (const [label, path] of [
  ["archive", archivePath],
  ["manifest", manifestPath],
]) {
  const fileStat = lstatSync(path);
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || (fileStat.mode & 0o777) !== 0o600) {
    fail(`${label} must be a regular non-symlink file with mode 0600.`);
  }
  if (fileStat.size <= 0) fail(`${label} must be nonempty.`);
}

const manifestBytes = readFileSync(manifestPath);
let manifest;
try {
  manifest = JSON.parse(manifestBytes.toString("utf8"));
} catch {
  fail("Manifest is not valid JSON.");
}
assertRedactedEvidence(manifest);
assertProductionSource({
  projectRef: manifest.sourceProjectRef,
  sourceEnvironment: manifest.sourceEnvironment,
});
if (manifest.sourceRepository !== "Papi299/nutrition-tracker-app") {
  fail("Manifest source repository mismatch.");
}
if (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "")) {
  fail("Exact GitHub source SHA is required.");
}
if (manifest.sourceCommit !== process.env.GITHUB_SHA) {
  fail("Manifest source commit does not match the workflow head.");
}
if (manifest.backupId !== backupId) fail("Manifest backup identity mismatch.");
if (manifest.encryption?.format !== "CMS AuthEnvelopedData DER") {
  fail("Manifest encryption format mismatch.");
}
if (manifest.encryption?.privateKeyCommitted !== false) {
  fail("Manifest private-key boundary mismatch.");
}
assertRecipientCertificateFingerprint(manifest.encryption?.recipientCertificateSha256);
if (manifest.plaintextTemporaryRemoved !== true) {
  fail("Plaintext temporary-state cleanup was not attested.");
}
if (manifest.credentialScanStatus !== "REDACTED_MANIFEST_PASS") {
  fail("Manifest redaction scan did not pass.");
}

const archiveBytes = readFileSync(archivePath);
assertHash(archiveBytes, manifest.encryptedArchiveSha256, "encrypted archive");
if (statSync(archivePath).size !== manifest.encryptedArchiveBytes) {
  fail("Encrypted archive byte count mismatch.");
}

const cms = spawnSync(
  "openssl",
  ["cms", "-cmsout", "-print", "-inform", "DER", "-in", archivePath],
  { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 60_000 },
);
if (cms.status !== 0 || !cms.stdout.includes("id-smime-ct-authEnvelopedData")) {
  fail("Archive is not CMS AuthEnvelopedData.");
}

const result = {
  backupId,
  archivePath,
  manifestPath,
  encryptedArchiveSha256: sha256(archiveBytes),
  manifestSha256: sha256(manifestBytes),
  recipientCertificateSha256: EXPECTED_RECIPIENT_CERT_SHA256,
};
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `backup_id=${result.backupId}`,
      `archive_path=${result.archivePath}`,
      `manifest_path=${result.manifestPath}`,
      `archive_sha256=${result.encryptedArchiveSha256}`,
      `manifest_sha256=${result.manifestSha256}`,
      "",
    ].join("\n"),
  );
} else {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
