import { spawnSync } from "node:child_process";
import { restoreBackup } from "./phase-11i-restore-pipeline.mjs";
import {
  assertBackupId, assertProductionSource, assertRecipientCertificateFingerprint, fail,
} from "./phase-11i-recovery-contract.mjs";
const result = restoreBackup({
  archiveInput: process.env.PHASE11I_ARCHIVE,
  manifestInput: process.env.PHASE11I_MANIFEST,
  recipientInput: process.env.PHASE11I_RECIPIENT_CERT,
  privateKeyInput: process.env.PHASE11I_RECOVERY_PRIVATE_KEY,
  reportInput: process.env.PHASE11I_RESTORE_REPORT,
  targetIdentity: process.env.PHASE11I_RESTORE_TARGET,
  assertSourceIdentity: assertProductionSource,
  assertArtifactIdentity: assertBackupId,
  assertRecipient: assertRecipientCertificateFingerprint,
  runSupabase: (args) => {
    const result = spawnSync("npx", ["supabase", ...args], {
      encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 20 * 60 * 1000,
    });
    if (result.status !== 0) fail("Local Supabase recovery command failed.");
    return result.stdout ?? "";
  },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
