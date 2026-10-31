// A valid ordinary lifecycle update prepared against the same synthetic head.
// The actual historical executor participates in the contention test.
import { attachContractFingerprint } from "../../ingestion/contracts/foundation-lifecycle";
import { fingerprintJson, type JsonValue } from "../../ingestion/usda/foundation/canonical-json";
import { normalizeFoundationRecord } from "../../ingestion/usda/foundation/normalization";
import { sqlJson, fixtureHash } from "./foundation-full35-reprojection";
import type { installSyntheticBaseline } from "./foundation-full35-reprojection";

export function prepareLegacyRace(fixture:ReturnType<typeof installSyntheticBaseline>,
  query:(sql:string,user?:string)=>string,operator:string,approver:string) {
  const head=JSON.parse(query(`select jsonb_build_object('id',current_dataset_projection_head_id,'version',current_head_version,'hash',current_projection_fingerprint)
    from ingestion.dataset_projection_current_heads where dataset_id='${fixture.datasetId}' and environment='local';`));
  const releaseId=query(`select ingestion.register_source_release(${sqlJson({contract_version:"source-release-manifest/v1",source_code:"usda",
    dataset_code:"usda_fdc_foundation",distributor_code:"usda_fdc_direct",transformation_code:null,
    original_release_identifier:"synthetic-full35-legacy-race",transformation_release_identifier:null,publication_date:"2026-05-01",
    acquisition_method:"official_bulk_download",official_url:"https://fdc.nal.usda.gov/synthetic-race",
    authorized_delivery_url:"https://fdc.nal.usda.gov/synthetic-race.zip",license_identifier:"CC0-1.0",
    attribution:"Cite USDA FoodData Central and retain the applicable release citation.",file_format:"json",
    schema_contract_version:"usda-fdc-foundation-json/v1",archive_name:"synthetic-race.zip",sha256:fixtureHash("legacy-race"),
    compressed_size:1,uncompressed_size:1,approval_reference:"synthetic-legacy-race",reject_policy_version:"usda-foundation-zero-unreviewed-rejects/v1"})});`,operator);
  const runId=query(`select import_run_id from ingestion.create_foundation_lifecycle_run('${releaseId}','release_update','${head.id}',
    'usda-foundation-importer/v2','usda-fdc-foundation-json/v1','usda-foundation-mvp-v1','usda-foundation-zero-unreviewed-rejects/v1',
    'foundation-release-diff/v1','foundation-lifecycle-policy/v1','local','${fixtureHash("legacy-race-run")}',
    'Synthetic legacy race operator','synthetic-legacy-race',null);`,operator);
  const sources=fixture.records.map(({record})=>({record:record.raw,raw_hash:record.rawContentSha256,candidate:normalizeFoundationRecord(record).candidate}));
  query(`begin; create temporary table race_source as select value s from jsonb_array_elements(${sqlJson(sources)});
    create temporary table race_staged as select s->'candidate'->>'source_row_key' source_row_key,
      ingestion.stage_source_record('${runId}',s->'candidate'->>'source_row_key',s->>'raw_hash',s->'record',now()+interval '1 day') id from race_source;
    select ingestion.transition_import_run('${runId}','created','staged','Synthetic legacy race operator');
    select ingestion.stage_candidate('${runId}',staged.id,s->'candidate'->>'source_row_key',s->'candidate'->>'concept_key',
      s->'candidate'->>'upstream_version_key',s->'candidate'->>'content_fingerprint',s->'candidate','accepted',null,
      jsonb_array_length(s->'candidate'->'warning_categories'),now()+interval '1 day')
    from race_source join race_staged staged on staged.source_row_key=s->'candidate'->>'source_row_key'; commit;`,operator);
  const release=JSON.parse(query(`select jsonb_build_object('manifest_fingerprint',manifest_fingerprint,'sha256',sha256) from ingestion.source_releases where id='${releaseId}';`));
  const scope=attachContractFingerprint({contract_version:"foundation-release-scope/v1",source_release_id:releaseId,dataset_id:fixture.datasetId,
    artifact_kind:"official_bulk_archive",scope_classification:"complete_snapshot",manifest_fingerprint:release.manifest_fingerprint,
    archive_sha256:release.sha256,evidence_references:["synthetic-only:legacy-race"],environment:"local",
    reviewer_identity:"Synthetic legacy race approver",approval_reference:"synthetic-legacy-race",
    approval_timestamp:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),supersedes_scope_evidence_id:null} as Record<string,JsonValue>);
  query(`select ingestion.register_foundation_release_scope_evidence(${sqlJson(scope)});`,approver);
  const report=JSON.parse(query(`select ingestion.recompute_foundation_release_diff_v1('${runId}');`));
  query(`select ingestion.register_foundation_release_diff_report('${runId}',${sqlJson(report)});`,operator);
  const validationId=query(`select validation_receipt_id from ingestion.validate_foundation_lifecycle_run('${runId}');`,operator);
  const planId=query(`select execution_plan_id from ingestion.prepare_foundation_lifecycle_execution_plan('${validationId}');`,operator);
  const body=JSON.parse(query(`select jsonb_build_object('contract_version','foundation-lifecycle-update-approval/v2',
    'validation_receipt_id',v.id,'validation_fingerprint',v.validation_fingerprint,'execution_plan_id',p.id,'execution_plan_fingerprint',p.plan_fingerprint,
    'release_diff_report_fingerprint',p.plan_contract->>'release_diff_report_fingerprint','prior_dataset_head_id',p.prior_dataset_projection_head_id,
    'prior_dataset_head_version',(p.plan_contract->>'current_dataset_head_version')::bigint,'prior_dataset_head_fingerprint',p.plan_contract->>'current_dataset_head_fingerprint',
    'current_scope_evidence_fingerprint',p.plan_contract->>'current_scope_evidence_fingerprint',
    'decision_set_fingerprint',ingestion.fingerprint_json_v1(p.decision_fingerprints),'allowance_set_fingerprint',ingestion.fingerprint_json_v1(p.allowance_fingerprints),
    'before_projection_fingerprint',p.before_projection_fingerprint,'after_projection_fingerprint',p.after_projection_fingerprint,
    'environment','local','approver_identity','Synthetic legacy race approver','approval_reference','synthetic-legacy-race',
    'approval_timestamp','${new Date(Date.now()-1000).toISOString()}','expires_at','${new Date(Date.now()+86400000).toISOString()}')
    from ingestion.lifecycle_validation_receipts v join ingestion.lifecycle_execution_plans p on p.validation_receipt_id=v.id where v.id='${validationId}' and p.id='${planId}';`));
  const approval=attachContractFingerprint(body as Record<string,JsonValue>);
  const approvalId=query(`select ingestion.register_foundation_lifecycle_update_approval('${validationId}',${sqlJson(approval)});`,approver);
  return {approvalId,runId,planId,reportHash:fingerprintJson(report)};
}
