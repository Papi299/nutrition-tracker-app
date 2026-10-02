import { spawnSync } from "node:child_process";
import { captureBackup } from "./phase-11i-backup-pipeline.mjs";
import { createLinkedSourceTransport } from "./phase-11i-cli-transport.mjs";
import {
  assertProductionProjectMetadata,
  assertBackupId, assertEncryptionRecipient, assertProductionSource,
  assertRecipientCertificateFingerprint, fail, PRODUCTION_PROJECT_REF,
} from "./phase-11i-recovery-contract.mjs";

const sourceEnvironment = process.env.PHASE11I_SOURCE_ENVIRONMENT;
const recipientInput = process.env.PHASE11I_RECIPIENT_CERT;
assertProductionSource({ projectRef: PRODUCTION_PROJECT_REF, sourceEnvironment });
assertEncryptionRecipient(recipientInput);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 15 * 60 * 1_000,
    ...options,
  });
  if (result.status !== 0) {
    fail(`${command} ${args[0] ?? ""} failed (exit ${result.status}).`);
  }
  return result.stdout ?? "";
}

function runSupabase(args) {
  return run("npx", ["supabase", ...args]);
}

function findPsql() {
  for (const candidate of ["/opt/homebrew/opt/libpq/bin/psql", "psql"]) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  fail("psql is required for safe metadata inspection.");
}

const psqlBinary = findPsql();
const { rows, refreshSourceTransport } = createLinkedSourceTransport({ runSupabase, psqlBinary });
function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  if (process.platform === "darwin") {
    const result = spawnSync(
      "security",
      ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
      { encoding: "utf8" },
    );
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  fail("A Supabase access token is required for redacted provider metadata.");
}

async function managementJson(path) {
  const response = await fetch(`https://api.supabase.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!response.ok) fail(`Supabase Management API read failed (${response.status}).`);
  return response.json();
}

const project = await managementJson(`/v1/projects/${PRODUCTION_PROJECT_REF}`);
assertProductionProjectMetadata(project);
const result = await captureBackup({
  sourceIdentity: { projectRef: PRODUCTION_PROJECT_REF, sourceEnvironment },
  assertSourceIdentity: assertProductionSource,
  assertArtifactIdentity: assertBackupId,
  assertRecipient: assertRecipientCertificateFingerprint,
  backupRootInput: process.env.PHASE11I_BACKUP_ROOT,
  recipientInput,
  operator: process.env.PHASE11I_OPERATOR,
  privateKey: process.env.PHASE11I_RECOVERY_PRIVATE_KEY,
  project,
  authConfig: await managementJson(`/v1/projects/${PRODUCTION_PROJECT_REF}/config/auth`),
  rows, psqlBinary, refreshSourceTransport,
  runSupabase: (args) => runSupabase(args[0] === "db" && args[1] === "dump"
    ? [...args, "--linked"] : args),
});
process.stdout.write(`${JSON.stringify(result)}\n`);
