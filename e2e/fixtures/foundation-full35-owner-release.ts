import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fingerprintJson } from "../../ingestion/usda/foundation/canonical-json";
import {
  buildMappingPlan, fingerprintMappingPlan, reprojectionContracts,
  type Full35OwnerAuthority, type MappingPlan,
} from "../../ingestion/usda/foundation/reprojection/contracts";
import { actorInput, type ActorQuery } from "./foundation-full35-actor-identity";
import { fixtureHash, fixtureId, installSyntheticBaseline } from "./foundation-full35-reprojection";

export const full35OwnerLogin = "full35_release_owner";

export function syntheticOwnerRelease(q: ActorQuery, fixture: ReturnType<typeof installSyntheticBaseline>, authorizationId = fixtureId(999915)) {
  const scope = JSON.parse(q("select ingestion.get_foundation_full35_owner_scope_v1('local')", full35OwnerLogin));
  const token = fixtureId(999916);
  // The recovery test deliberately runs at a reviewed historical boundary.
  const migrations: string[] = JSON.parse(q(`select json_agg(version||'_'||name||'.sql' order by version)
    from supabase_migrations.schema_migrations`));
  const plan = buildMappingPlan<Full35OwnerAuthority>({
    operation_kind: "reprojection", dataset_id: fixture.datasetId, environment: "local",
    source_release_id: fixture.releaseId, mapping_version_id: scope.mapping.id, before_snapshot: scope.before_snapshot,
    actor_authority: { contract_version: reprojectionContracts.ownerAuthority, authorization_id: authorizationId, cluster_id: scope.cluster_id },
    operator_oid: scope.owner_oid, operator_login: scope.owner_login,
    approval_requirements: { owner_oid: scope.owner_oid, not_before: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 7_200_000).toISOString() },
    implementation: {
      database_contract_hash: scope.database_contract_hash,
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
      migrations: migrations.map(filename => ({
        filename, version: filename.slice(0, 14),
        sha256: createHash("sha256").update(readFileSync(`supabase/migrations/${filename}`)).digest("hex"),
      })),
      contract_versions: { parser: "usda-fdc-foundation-json/v1", importer: "usda-foundation-importer/v3",
        candidate: "foundation-normalized-candidate/v2", mapping: "usda-foundation-full35-direct-v2",
        projection: "foundation-lifecycle-projection/v2" },
    },
    qualification: { ...fixture.source,
      historical_allowance_fingerprint: "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",
      rejected: JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json", "utf8")).source_inspection.rejected_records,
      source_qualification_hash: fixtureHash("owner release oracle") },
    recovery_requirements: { qualification_hash: fixtureHash("synthetic H50 recovery"), production_ready: false },
    rejected_receipt_id: null, records: fixture.records,
  });
  function authorize(candidate = plan) {
    return `insert into ingestion.foundation_owner_authorization
      (id,project_ref,environment,dataset_id,source_release_id,mapping_version_id,prior_head_id,prior_head_hash,
       plan_hash,diff_hash,recovery_evidence_hash,cluster_id,owner_oid,owner_login_fingerprint,
       owner_name,authorization_reference,retry_token,expires_at)
      values('${authorizationId}','PHASE_11I_SYNTHETIC_POPULATED_FIXTURE','local','${plan.dataset_id}',
        '${plan.source_release_id}','${plan.mapping_version_id}','${plan.before_snapshot.head.id}',
        '${plan.before_snapshot.head.fingerprint}','${fingerprintMappingPlan(candidate)}','${fingerprintJson(candidate.diff)}',
        '${plan.recovery_requirements.qualification_hash}','${scope.cluster_id}',${scope.owner_oid},
        '${scope.owner_login_fingerprint}','Synthetic fixture owner','synthetic single owner authorization',
        '${token}','${plan.approval_requirements.expires_at}');`;
  }
  function execute(candidate: MappingPlan<Full35OwnerAuthority> = plan, retryToken = token) {
    return `select ingestion.execute_foundation_full35_owner_v1('${authorizationId}',${actorInput(candidate)},'${retryToken}');`;
  }
  return { plan, authorize, execute, authorizationId, token,
    receipt: `select ingestion.get_foundation_full35_owner_receipt_v1('${authorizationId}','${token}');` };
}
