// Read-only importer adapter. Every source object stays outside Git. Synthetic
// UUID bindings exercise source values only and NEVER prove historical identity.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fingerprintSourceReleaseManifest } from "../../ingestion/contracts/source-release-manifest.ts";
import { fingerprintFoundationRejectAllowance, verifyFoundationRejectAllowance } from "../../ingestion/contracts/foundation-reject-allowance.ts";
import { canonicalizeJson, fingerprintJson } from "../../ingestion/usda/foundation/canonical-json.ts";
import { runFoundationDryRun } from "../../ingestion/usda/foundation/dry-run.ts";
import { extractFoundationFull35Json } from "../../ingestion/usda/foundation/full35/archive.ts";
import { runFoundationFull35DryRun } from "../../ingestion/usda/foundation/full35/dry-run.ts";
import { full35MappingHash } from "../../ingestion/usda/foundation/full35/mapping.ts";
import { parseNormalizedFoundationFull35Candidate } from "../../ingestion/usda/foundation/full35/normalization.ts";
import { parseFoundationFull35Report } from "../../ingestion/usda/foundation/full35/report.ts";
import { reconcileFoundationFull35Exclusions, parseFoundationFull35ExclusionReconciliation } from "../../ingestion/usda/foundation/full35/exclusion-reconciliation.ts";
import { foundationNutrientMappingHash } from "../../ingestion/usda/foundation/nutrient-mapping.ts";

const names = ["--archive", "--manifest", "--allowance", "--public-ids", "--oracle", "--output"];
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  assert(names.includes(key) && value && !args.has(key), "Exact bounded arguments required");
  args.set(key, resolve(value));
}
assert.equal(args.size, names.length);
const json = path => JSON.parse(readFileSync(path, "utf8"));
const output = args.get("--output");
mkdirSync(output, { recursive: true });
const save = (name, value) => writeFileSync(join(output, name), canonicalizeJson(value) + "\n");
const manifest = json(args.get("--manifest"));
const historicalAllowance = json(args.get("--allowance"));
const oracle = json(args.get("--oracle"));
const publicIds = json(args.get("--public-ids"))[0].audit.public_fdc_ids.map(String).sort((a,b)=>Number(a)-Number(b));
assert.equal(publicIds.length, 353);
assert.equal(fingerprintSourceReleaseManifest(manifest), "ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0");
assert.equal(fingerprintFoundationRejectAllowance(historicalAllowance), "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a");
assert.equal(foundationNutrientMappingHash, "a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5");
assert.equal(full35MappingHash, "028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c");
// No historical UUIDs can be recovered from these source files or FDC IDs.
// Persist fresh random local fixture bindings separately and label their scope.
const identityFile = join(output, "synthetic-local-bindings.json");
const identities = existsSync(identityFile) ? json(identityFile) : publicIds.map(fdc_id => ({
  fdc_id, source_record_id: randomUUID(), source_version_id: randomUUID(), raw_content_sha256: oracle.raw_hashes[fdc_id],
}));
assert.deepEqual(identities.map(x=>x.fdc_id), publicIds);
for (const row of identities) assert.equal(row.raw_content_sha256, oracle.raw_hashes[row.fdc_id]);
save("synthetic-local-bindings.json", identities);
const offline = { manifest, archiveBytes: readFileSync(args.get("--archive")),
  expectedJsonSha256: oracle.custody.member_sha256, sourceReleaseId: "a2e1699b-6f72-4153-b2f1-5cbf30c53281", identities };
const current = runFoundationFull35DryRun(offline);
const legacy = runFoundationDryRun({ ...offline, jsonText: extractFoundationFull35Json(offline.archiveBytes, manifest.archive_name.replace(/\.zip$/, ".json")) });
verifyFoundationRejectAllowance({ allowance: historicalAllowance, dryRun: legacy, targetEnvironment: "production" });
save("legacy-report.json", legacy.report);
save("report-v3.synthetic-bindings.json", current.report);
save("candidates.synthetic-bindings.json", current.accepted);
const reconciliationInput = { offline, report: current.report, historicalAllowance };
const reconciliation = reconcileFoundationFull35Exclusions(reconciliationInput);
save("reconciliation.synthetic-bindings.json", reconciliation);
assert.equal(reconciliation.qualification_status, "exact_historical_exclusions_offline_unapproved");
assert.equal(reconciliation.executable, false);
assert.equal(current.report.qualification_status, "blocked");
assert.equal(current.accepted.length, 353);
assert.equal(current.rejected.length, 10);
assert.deepEqual(current.rejected.map(x=>Number(x.fdc_id)), [2727566,2727567,2727568,2727569,2727570,2727571,2727575,2727576,2747656,2747673]);
assert(current.rejected.every(x=>x.category === "negative_target_value"));
for (const row of current.archive.records) assert.equal(row.rawContentSha256, oracle.raw_hashes[String(row.raw.fdcId)]);
assert.deepEqual(current.accepted.map(x=>x.fdc_id), publicIds);
assert.equal(parseFoundationFull35Report(current.report, { ...current, identities }).report_fingerprint, current.report.report_fingerprint);
assert.equal(parseFoundationFull35ExclusionReconciliation(reconciliation, reconciliationInput).reconciliation_fingerprint, reconciliation.reconciliation_fingerprint);
const positions = [], evidence = [], inventory = [];
for (const candidate of current.accepted) {
  const raw = current.archive.records.find(x=>String(x.raw.fdcId) === candidate.fdc_id);
  assert.equal(parseNormalizedFoundationFull35Candidate(candidate, raw, current.source, candidate.record_identity).content_fingerprint, candidate.content_fingerprint);
  const legacyCandidate = legacy.accepted.find(x=>x.candidate.fdc_id === candidate.fdc_id).candidate;
  for (const state of Object.values(candidate.nutrients)) {
    const item = candidate.nutrient_evidence.find(x=>x.evidence_hash === state.evidence_hash);
    const row = { fdc_id: candidate.fdc_id, code: state.application_nutrient_code, value: state.value,
      source_id: item?.source_nutrient_id ?? null, source_unit: item?.source_unit ?? null,
      application_unit: state.application_unit, basis: state.basis, semantic: state.semantic,
      derivation_code: item?.derivation_code ?? null, derivation_description: item?.derivation_description ?? null,
      source_name: item?.source_nutrient_name ?? null, footnote: item?.footnote ?? null, loq: item?.loq ?? null,
      raw_field_path: item?.raw_field_path ?? null, raw_hash: raw.rawContentSha256, missing_reason: state.missing_reason };
    positions.push(row);
    if (["energy_kcal","protein_g","carbohydrates_g","fat_g"].includes(state.application_nutrient_code)) {
      const previous = legacyCandidate.nutrients[state.application_nutrient_code];
      assert.equal(previous.value, state.value);
      assert.equal(previous.semantic, state.semantic);
      assert.equal(previous.source_nutrient_id, item?.source_nutrient_id ?? null);
      assert.equal(previous.source_unit, item?.source_unit ?? null);
      assert.equal(previous.derivation_code, item?.derivation_code ?? null);
      assert.equal(previous.derivation_description, item?.derivation_description ?? null);
      assert.equal(previous.loq, item?.loq ?? null);
    }
    if (item) assert.equal(item.exact_conversion_factor, null);
  }
  for (const item of candidate.nutrient_evidence) {
    const { evidence_hash, ...body } = item;
    assert.equal(fingerprintJson(body), evidence_hash);
    evidence.push({fdc_id:candidate.fdc_id, ...item});
  }
  const { content_fingerprint, ...body } = candidate;
  assert.equal(fingerprintJson(body), content_fingerprint);
  assert.equal(fingerprintJson(candidate.nutrient_evidence), candidate.evidence_set_hash);
  inventory.push({ fdc_id:candidate.fdc_id, raw_hash:raw.rawContentSha256, candidate_hash:content_fingerprint,
    evidence_set_hash:candidate.evidence_set_hash, bytes:Buffer.byteLength(canonicalizeJson(candidate)),
    selected_energy_method:candidate.selected_energy_method, warning_categories:candidate.warning_categories });
}
const order = (a,b)=>Number(a.fdc_id)-Number(b.fdc_id) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
positions.sort(order);
save("actual-positions.synthetic-bindings.json", positions);
save("actual-evidence.synthetic-bindings.json", evidence);
save("candidate-inventory.synthetic-bindings.json", inventory);
const additions = positions.filter(x=>x.value !== null && !["energy_kcal","protein_g","carbohydrates_g","fat_g"].includes(x.code));
save("actual-additions.synthetic-bindings.json", additions);
const negative = [];
function rejected(label, operation) {
  try { const result = operation(); assert.notEqual(result.qualification_status,"exact_historical_exclusions_offline_unapproved"); negative.push({label,result:result.qualification_status}); }
  catch(error) { if (error.code === "ERR_ASSERTION") throw error; negative.push({label,error:error.category ?? error.name}); }
}
function reconcileOffline(next) { return reconcileFoundationFull35Exclusions({ ...reconciliationInput, offline: next, report: runFoundationFull35DryRun(next).report }); }
rejected("changed release UUID",()=>reconcileOffline({...offline, sourceReleaseId:randomUUID()}));
rejected("changed archive digest",()=>reconcileOffline({...offline,manifest:{...manifest,sha256:"f".repeat(64)}}));
rejected("altered accepted raw hash",()=>reconcileOffline({...offline,identities:identities.map((x,i)=>i===0?{...x,raw_content_sha256:"f".repeat(64)}:x)}));
rejected("missing accepted identity",()=>reconcileOffline({...offline,identities:identities.slice(1)}));
rejected("invalid historical allowance",()=>reconcileFoundationFull35Exclusions({...reconciliationInput,historicalAllowance:{...historicalAllowance,approval_reference:"changed"}}));
for (const [label, edit] of [
  ["wrong rejection ID",r=>{r.rejected_record_set[0].fdc_id="9999999";}],
  ["changed rejection category",r=>{r.rejected_record_set[0].category="trace_target_blocked";}],
  ["missing approved exclusion",r=>{r.rejected_record_set.pop();}],
  ["extra unexpected rejection",r=>{r.rejected_record_set.push({...r.rejected_record_set[0],fdc_id:"9999999"});}],
  ["altered rejected raw hash",r=>{r.rejected_record_set[0].raw_content_sha256="f".repeat(64);}],
]) rejected(label,()=>{
  const body=structuredClone(current.report); edit(body); delete body.report_fingerprint;
  return reconcileFoundationFull35Exclusions({...reconciliationInput,report:{...body,report_fingerprint:fingerprintJson(body)}});
});
rejected("tampered v3 report",()=>reconcileFoundationFull35Exclusions({...reconciliationInput,report:{...current.report,report_fingerprint:"f".repeat(64)}}));
rejected("forged rehashed reconciliation",()=>{
  const body=structuredClone(reconciliation); delete body.reconciliation_fingerprint;
  body.source_count=364;
  return parseFoundationFull35ExclusionReconciliation({...body,reconciliation_fingerprint:fingerprintJson(body)},reconciliationInput);
});
// A report cannot independently detect a different valid UUID mapping: freeze
// and compare externally. This is the historical evidence gap, not a nutrition pass.
const changedIdentity=structuredClone(identities); changedIdentity[0].source_version_id=randomUUID();
assert.notEqual(canonicalizeJson(changedIdentity),canonicalizeJson(identities));
negative.push({label:"altered accepted UUID vs frozen local identity inventory",result:"external_exact_set_comparison_rejects"});
save("official-context-negative-results.json",negative);
save("adapter-summary.json",{
  identity_scope:"authentic source, SYNTHETIC LOCAL UUID bindings; historical UUID qualification unavailable",
  historical_identity_qualified:false, release_identity:reconciliation.source_release_identity,
  manifest_fingerprint:current.source.manifest_fingerprint, allowance_fingerprint:reconciliation.original_allowance_fingerprint,
  mapping_hash:full35MappingHash, legacy_mapping_hash:foundationNutrientMappingHash,
  report_status:current.report.qualification_status, source_count:363,accepted_count:353,rejected_count:10,
  report_fingerprint:current.report.report_fingerprint, reconciliation_fingerprint:reconciliation.reconciliation_fingerprint,
  reconciliation_status:reconciliation.qualification_status, executable:false,
  accepted_identity_set_hash:current.source.accepted_identity_set_hash,
  observed_schema_fingerprint:current.archive.observedSchemaFingerprint, schema_contract_hash:current.archive.schemaContractHash,
  observed_schema:current.archive.observedSchema, maximum_raw_record_bytes:current.archive.maximumRawRecordBytes,
  maximum_candidate_bytes:Math.max(...inventory.map(x=>x.bytes)), candidate_inventory_hash:fingerprintJson(inventory),
  positions_count:positions.length, additions_count:additions.length, evidence_records:evidence.length,
  full35_coverage:current.report.coverage.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=="evidence"))),
  legacy_report_fingerprint:legacy.report.report_fingerprint, negative_results:negative,
});
process.stdout.write(JSON.stringify({accepted:current.accepted.length,rejected:current.rejected.length,positions:positions.length,additions:additions.length,identity_scope:"synthetic_local_bindings_only"})+"\n");
