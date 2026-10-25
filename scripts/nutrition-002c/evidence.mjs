import { hash, IMPLEMENTATION } from './capture.mjs';
import { digest, reject } from './local-postgres.mjs';

const KEYS = ['schemaVersion','implementation','sourceCodeSha256','migrationBoundary','relationalScope','restrictedEvidenceSha256','encryptedArchiveSha256','providerRecovery','eligibility','producerProvenance'];
export function buildLocalEvidence(proof,ciphertext) {
  return {
    schemaVersion:'nutrition-coherent-capture-local-evidence/v1',
    implementation:IMPLEMENTATION,
    sourceCodeSha256:digest(proof.source),
    migrationBoundary:proof.boundary,
    relationalScope:'APPLICATION_AND_FOUR_DURABLE_AUTH_TABLES',
    restrictedEvidenceSha256:hash(JSON.stringify(proof)),
    encryptedArchiveSha256:hash(ciphertext),
    providerRecovery:'SEPARATE_OBLIGATIONS_UNQUALIFIED',
    eligibility:'LOCAL_COMPONENT_ONLY_NOT_RECOVERY_ELIGIBLE',
    producerProvenance:'UNATTESTED_LOCAL_TEST',
  };
}

// Offline integrity is intentionally weaker than live capture validation. The
// verifier cannot reconstruct the original exporter session, prove publication
// admission, or infer a trusted producer merely from recipient encryption.
export function verifyLocalEvidence(publicEvidence,proof,ciphertext,trustedSourceDigest) {
  if (JSON.stringify(Object.keys(publicEvidence).sort()) !== JSON.stringify([...KEYS].sort())) reject('N002C_PUBLIC_EVIDENCE_FIELDS_DENIED');
  const expected = buildLocalEvidence(proof,ciphertext);
  if (JSON.stringify(publicEvidence) !== JSON.stringify(expected) ||
      publicEvidence.sourceCodeSha256 !== digest(trustedSourceDigest) || ![44,45].includes(proof.boundary)) reject('N002C_OFFLINE_INTEGRITY_FAILED');
  return { integrity:'PASS_LOCAL_ONLY', captureSessionReestablished:false, recoveryEligible:false, producerAuthenticated:false };
}
