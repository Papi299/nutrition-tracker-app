// Offline actual-identity adapter. No database/provider client or credential use.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fingerprintSourceReleaseManifest } from "../../ingestion/contracts/source-release-manifest.ts";
import { verifyFoundationRejectAllowance, fingerprintFoundationRejectAllowance } from "../../ingestion/contracts/foundation-reject-allowance.ts";
import { canonicalizeJson, fingerprintJson } from "../../ingestion/usda/foundation/canonical-json.ts";
import { runFoundationDryRun } from "../../ingestion/usda/foundation/dry-run.ts";
import { extractFoundationFull35Json } from "../../ingestion/usda/foundation/full35/archive.ts";
import { runFoundationFull35DryRun } from "../../ingestion/usda/foundation/full35/dry-run.ts";
import { parseNormalizedFoundationFull35Candidate } from "../../ingestion/usda/foundation/full35/normalization.ts";
import { parseFoundationFull35Report } from "../../ingestion/usda/foundation/full35/report.ts";
import { reconcileFoundationFull35Exclusions, parseFoundationFull35ExclusionReconciliation } from "../../ingestion/usda/foundation/full35/exclusion-reconciliation.ts";
import { full35MappingHash } from "../../ingestion/usda/foundation/full35/mapping.ts";
import { foundationNutrientMappingHash } from "../../ingestion/usda/foundation/nutrient-mapping.ts";

process.umask(0o077);
const args = new Map();
const required = ["--archive", "--manifest", "--allowance", "--oracle", "--inventory", "--inventory-sha256", "--output"];
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  assert(required.includes(key) && value && !args.has(key), "Exact arguments required");
  args.set(key, key === "--inventory-sha256" ? value : resolve(value));
}
assert.equal(args.size, required.length);
const json = path => JSON.parse(readFileSync(path, "utf8"));
const inventory = json(args.get("--inventory"));
assert.equal(statSync(args.get("--inventory")).mode & 0o077, 0);
assert.equal(inventory.classification, "AUTHORITATIVE_EXISTING_PUBLIC_CATALOG_IDENTITIES");
assert.equal(inventory.project_id, "hskfanrqwtqknzpquwhg");
assert.equal(inventory.region, "eu-west-1");
assert.deepEqual(inventory.current_head, {dataset_id:"0890fd0c-0b19-4360-8088-6b1bd6be6000",environment:"production",
  fingerprint:"2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69",id:"2562de58-1c1c-4ce4-acca-3dd468cc045c",version:1});
const tupleFields = ["fdc_id", "food_id", "source_record_id", "source_version_id", "source_release_id", "raw_content_sha256"];
assert.deepEqual(inventory.tuple_fields, tupleFields);
const rows = [...inventory.rows].sort((a,b)=>Number(a.fdc_id)-Number(b.fdc_id));
assert.equal(rows.length, 353);
assert.equal(fingerprintJson(rows.map(row=>tupleFields.map(key=>row[key]))), args.get("--inventory-sha256"));
assert.equal(inventory.canonical_tuple_set_sha256, args.get("--inventory-sha256"));
for (const key of tupleFields.slice(0,4)) assert.equal(new Set(rows.map(row=>row[key])).size, 353);
const manifest = json(args.get("--manifest")), historicalAllowance = json(args.get("--allowance")), oracle = json(args.get("--oracle"));
assert.equal(fingerprintSourceReleaseManifest(manifest), "ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0");
assert.equal(fingerprintFoundationRejectAllowance(historicalAllowance), "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a");
assert.equal(full35MappingHash, "028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c");
assert.equal(foundationNutrientMappingHash, "a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5");
const identities = rows.map(row=>{
  assert.equal(row.source_release_id, "a2e1699b-6f72-4153-b2f1-5cbf30c53281");
  assert.equal(row.raw_content_sha256, oracle.raw_hashes[row.fdc_id]);
  return Object.fromEntries(["fdc_id", "source_record_id", "source_version_id", "raw_content_sha256"].map(key=>[key,row[key]]));
});
const bindings = new Map(identities.map(row=>[row.fdc_id,row]));
const offline = {manifest,archiveBytes:readFileSync(args.get("--archive")),expectedJsonSha256:oracle.custody.member_sha256,
  sourceReleaseId:"a2e1699b-6f72-4153-b2f1-5cbf30c53281",identities};
const current = runFoundationFull35DryRun(offline);
const legacy = runFoundationDryRun({...offline,jsonText:extractFoundationFull35Json(offline.archiveBytes, manifest.archive_name.replace(/\.zip$/, ".json"))});
verifyFoundationRejectAllowance({allowance:historicalAllowance,dryRun:legacy,targetEnvironment:"production"});
const context = {offline,report:current.report,historicalAllowance};
const reconciliation = reconcileFoundationFull35Exclusions(context);
assert.equal(reconciliation.qualification_status, "exact_historical_exclusions_offline_unapproved");
assert.equal(reconciliation.executable, false);
assert.equal(current.report.qualification_status, "blocked");
assert.equal(current.accepted.length, 353);
assert.equal(current.rejected.length, 10);
assert.deepEqual(current.rejected.map(row=>Number(row.fdc_id)), [2727566,2727567,2727568,2727569,2727570,2727571,2727575,2727576,2747656,2747673]);
assert(current.rejected.every(row=>row.category === "negative_target_value"));
for (const raw of current.archive.records) assert.equal(raw.rawContentSha256, oracle.raw_hashes[String(raw.raw.fdcId)]);
assert.deepEqual(current.accepted.map(row=>row.fdc_id), rows.map(row=>row.fdc_id));
parseFoundationFull35Report(current.report, {...current,identities});
parseFoundationFull35ExclusionReconciliation(reconciliation, context);
const positions=[], evidence=[], candidateInventory=[];
for (const candidate of current.accepted) {
  const raw=current.archive.records.find(row=>String(row.raw.fdcId) === candidate.fdc_id);
  // Context comes from the frozen authoritative inventory, never the candidate itself.
  assert.deepEqual(candidate.record_identity, bindings.get(candidate.fdc_id));
  parseNormalizedFoundationFull35Candidate(candidate,raw,current.source,bindings.get(candidate.fdc_id));
  const expectedEnergy=oracle.positions.find(row=>row.fdc_id === candidate.fdc_id && row.code === "energy_kcal");
  assert.equal(candidate.selected_energy_method, expectedEnergy.source_id === null ? null : {"2048":"atwater_specific_2048","2047":"atwater_general_2047"}[expectedEnergy.source_id]);
  const expectedPath=oracle.positions.find(row=>row.fdc_id === candidate.fdc_id && row.raw_field_path !== null).raw_field_path.split(".foodNutrients")[0];
  assert.equal(candidate.raw_record_path, expectedPath);
  const before=legacy.accepted.find(row=>row.candidate.fdc_id === candidate.fdc_id).candidate;
  for (const state of Object.values(candidate.nutrients)) {
    const item=candidate.nutrient_evidence.find(row=>row.evidence_hash === state.evidence_hash);
    positions.push({fdc_id:candidate.fdc_id,code:state.application_nutrient_code,value:state.value,
      source_id:item?.source_nutrient_id ?? null,source_unit:item?.source_unit ?? null,application_unit:state.application_unit,
      basis:state.basis,semantic:state.semantic,derivation_code:item?.derivation_code ?? null,
      derivation_description:item?.derivation_description ?? null,source_name:item?.source_nutrient_name ?? null,
      footnote:item?.footnote ?? null,loq:item?.loq ?? null,raw_field_path:item?.raw_field_path ?? null,
      raw_hash:raw.rawContentSha256,missing_reason:state.missing_reason});
    if (["energy_kcal","protein_g","carbohydrates_g","fat_g"].includes(state.application_nutrient_code)) {
      const previous=before.nutrients[state.application_nutrient_code];
      for (const key of ["value","semantic"]) assert.equal(previous[key],state[key]);
      for (const key of ["source_nutrient_id","source_unit","derivation_code","derivation_description","loq"]) assert.equal(previous[key],item?.[key] ?? null);
    }
  }
  evidence.push(...candidate.nutrient_evidence.map(item=>({fdc_id:candidate.fdc_id,...item})));
  candidateInventory.push({fdc_id:candidate.fdc_id,raw_hash:raw.rawContentSha256,candidate_hash:candidate.content_fingerprint,
    evidence_set_hash:candidate.evidence_set_hash,bytes:Buffer.byteLength(canonicalizeJson(candidate)),
    selected_energy_method:candidate.selected_energy_method,warning_categories:candidate.warning_categories});
}
positions.sort((a,b)=>Number(a.fdc_id)-Number(b.fdc_id) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
const additions=positions.filter(row=>row.value !== null && !["energy_kcal","protein_g","carbohydrates_g","fat_g"].includes(row.code));
// Rehash a wrong-identity candidate while preserving every nutrient value/count.
const altered=structuredClone(current.accepted[0]);
altered.record_identity.source_version_id=identities[1].source_version_id;
delete altered.content_fingerprint;
altered.content_fingerprint=fingerprintJson(altered);
assert.deepEqual(altered.nutrients,current.accepted[0].nutrients);
const alteredRaw=current.archive.records.find(row=>String(row.raw.fdcId) === altered.fdc_id);
assert.throws(()=>parseNormalizedFoundationFull35Candidate(altered,alteredRaw,current.source,bindings.get(altered.fdc_id)));
const output=args.get("--output");
assert(relative(resolve(".ingestion-workspace"), output).split("/")[0] !== "..", "Use an ignored local results path");
mkdirSync(output,{mode:0o700});
assert.equal(statSync(output).mode & 0o077,0);
const save=(name,value)=>writeFileSync(join(output,name),canonicalizeJson(value)+"\n",{mode:0o600,flag:"wx"});
save("candidates.actual-identities.json",current.accepted);
save("report-v3.actual-identities.json",current.report);
save("reconciliation.actual-identities.json",reconciliation);
save("legacy-report.json",legacy.report);
save("actual-positions.json",positions);save("actual-additions.json",additions);save("actual-evidence.json",evidence);
save("candidate-inventory.actual-identities.json",candidateInventory);
save("adapter-summary.json",{identity_scope:"AUTHORITATIVE_EXISTING_PUBLIC_CATALOG_IDENTITIES",historical_identity_qualified:true,
  canonical_tuple_set_sha256:inventory.canonical_tuple_set_sha256,accepted_identity_set_hash:current.source.accepted_identity_set_hash,
  report_fingerprint:current.report.report_fingerprint,reconciliation_fingerprint:reconciliation.reconciliation_fingerprint,
  reconciliation_status:reconciliation.qualification_status,executable:false,source_count:363,accepted_count:353,rejected_count:10,
  positions_count:positions.length,additions_count:additions.length,evidence_records:evidence.length,
  contextual_candidates_verified:353,contextual_report_verified:true,contextual_reconciliation_verified:true,
  independent_energy_method_labels_verified:353,independent_raw_record_paths_verified:353,
  rehashed_wrong_identity_candidate_refused:true,nutrient_counts_unchanged_in_negative:true,
  legacy_report_fingerprint:legacy.report.report_fingerprint,candidate_inventory_hash:fingerprintJson(candidateInventory),
  observed_schema:current.archive.observedSchema,observed_schema_fingerprint:current.archive.observedSchemaFingerprint,
  maximum_raw_record_bytes:current.archive.maximumRawRecordBytes});
// Compatibility aliases let the ORIGINAL independent comparator run unchanged.
// These filenames do not classify their contents; every binding here is actual.
for (const [alias,target] of Object.entries({"actual-positions.synthetic-bindings.json":"actual-positions.json",
  "actual-additions.synthetic-bindings.json":"actual-additions.json","actual-evidence.synthetic-bindings.json":"actual-evidence.json",
  "candidates.synthetic-bindings.json":"candidates.actual-identities.json","report-v3.synthetic-bindings.json":"report-v3.actual-identities.json",
  "reconciliation.synthetic-bindings.json":"reconciliation.actual-identities.json","candidate-inventory.synthetic-bindings.json":"candidate-inventory.actual-identities.json"})) symlinkSync(target,join(output,alias));
process.stdout.write(JSON.stringify({accepted:353,rejected:10,positions:positions.length,additions:additions.length,
  contextual_candidates:353,rehashed_wrong_identity_candidate_refused:true,identity_scope:inventory.classification})+"\n");
