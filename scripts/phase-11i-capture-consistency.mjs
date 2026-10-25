import { fail } from "./phase-11i-recovery-contract.mjs";

export const SYNTHETIC_CAPTURE_SCOPE = "LOCAL_SYNTHETIC_SINGLE_WRITER_TEST_ONLY";
export const CAPTURE_BLOCKER = "NUTRITION_002A_PRODUCTION_CAPTURE_CONSISTENCY_UNQUALIFIED";

// Counts do not attest a shared snapshot, unchanged values, or writer exclusion.
// There is deliberately no environment switch/attestation that enables Production.
export function assertCaptureImplementation(source) {
  if (source?.projectRef !== "PHASE_11I_SYNTHETIC_POPULATED_FIXTURE" ||
      source?.sourceEnvironment !== "LocalSynthetic") fail(CAPTURE_BLOCKER);
  return SYNTHETIC_CAPTURE_SCOPE;
}
