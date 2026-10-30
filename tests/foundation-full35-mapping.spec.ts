import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { canonicalizeJson, fingerprintJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import { foundationSafetyBounds } from "@/ingestion/usda/foundation/contract";
import { normalizeFoundationArchive, normalizeFoundationRecord, parseNormalizedFoundationCandidate } from "@/ingestion/usda/foundation/normalization";
import { foundationNutrientMapping, foundationNutrientMappingHash } from "@/ingestion/usda/foundation/nutrient-mapping";
import { FoundationValidationError, parseFoundationArchive } from "@/ingestion/usda/foundation/parser";
import { prepareFoundationProjection } from "@/ingestion/usda/foundation/projection";
import { createFoundationDryRunReport, serializeFoundationDryRunReport } from "@/ingestion/usda/foundation/report";
import { createFoundationStagingPlan } from "@/ingestion/usda/foundation/staging";
import type { FoundationDryRunResult } from "@/ingestion/usda/foundation/dry-run";
import { full35Mapping, full35MappingHash } from "@/ingestion/usda/foundation/full35/mapping";
import { normalizeFoundationFull35Record, parseNormalizedFoundationFull35Candidate } from "@/ingestion/usda/foundation/full35/normalization";
import { createFoundationFull35Report, fingerprintFull35IdentitySet, parseFoundationFull35Report, serializeFoundationFull35Report } from "@/ingestion/usda/foundation/full35/report";
import { nutrientCodesV1, nutrientManifestV1 } from "@/lib/nutrition-snapshots/manifest";
import { directTargets, syntheticFull35Context, syntheticFull35Record, syntheticNutrient } from "./fixtures/foundation-full35";
import legacy from "./fixtures/foundation-full35-legacy-golden.json";

function candidateFor(records: unknown[] = [syntheticFull35Record()]) {
  const context = syntheticFull35Context(records);
  return { ...context, candidate: normalizeFoundationFull35Record(context.archive.records[0], context.source, context.identities[0]) };
}
function failure(run: () => unknown, category: string) {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(FoundationValidationError);
  expect((caught as FoundationValidationError).category).toBe(category);
}
function rehash(value: Record<string, unknown>, field = "content_fingerprint") {
  const copy = structuredClone(value);
  delete copy[field];
  return { ...copy, [field]: fingerprintJson(copy as JsonValue) };
}

test("F35-01: accepted legacy mapping, candidate, and serialized v2 report remain byte-identical", () => {
  expect(legacy.captured_from_commit).toBe("7b71e03da6e0b683d6c28e1163258a2312c44c55");
  expect(foundationNutrientMappingHash).toBe("a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5");
  expect(canonicalizeJson(foundationNutrientMapping)).toBe(legacy.mappingCanonical);
  const archive = parseFoundationArchive(legacy.jsonText), normalized = normalizeFoundationArchive(archive);
  expect(normalized.accepted[0].candidate).toEqual(legacy.candidate);
  expect(normalized.accepted[0].candidate.content_fingerprint).toBe("9c2a762de73b059ac03c3d2a84101692c80fac492573d1e1cb6d56c38d5aacae");
  const report = createFoundationDryRunReport({ manifestFingerprint: "a".repeat(64), archive, ...normalized });
  expect(report).toEqual(legacy.report);
  expect(report.report_fingerprint).toBe("5af623042b389701e1b4f8586cbaaa5b96dfc57355893b370594b76c61647cd2");
  expect(serializeFoundationDryRunReport(report)).toBe(legacy.reportSerialization);
  expect(parseNormalizedFoundationCandidate(legacy.candidate)).toEqual(legacy.candidate);
});

test("F35-01/02: immutable mapping equals independent Python canonical golden and manifest order", () => {
  const bytes = readFileSync("tests/fixtures/foundation-full35-mapping-v2.canonical.json", "utf8").trimEnd();
  const hash = readFileSync("tests/fixtures/foundation-full35-mapping-v2.sha256", "utf8").trim();
  expect(hash).toBe("028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  expect(canonicalizeJson(full35Mapping)).toBe(bytes);
  expect(full35MappingHash).toBe(hash);
  expect(full35Mapping.mappings.map(m => m.application_nutrient_code)).toEqual(nutrientCodesV1);
  expect(full35Mapping.mappings.map(m => m.application_unit)).toEqual(nutrientManifestV1.map(m => m.unit));
  expect(full35Mapping.mappings.filter(m => m.classification === "direct")).toHaveLength(32);
  expect(full35Mapping.mappings.filter(m => m.classification === "unavailable")).toHaveLength(2);
  expect(full35Mapping.mappings.filter(m => m.classification === "held")).toHaveLength(1);
  const ids = full35Mapping.mappings.flatMap(m => m.sources.map(s => s.id));
  expect(ids).toHaveLength(33); expect(new Set(ids).size).toBe(33);
  expect(() => Object.assign(full35Mapping.numeric_policy, { round_to_fit: true })).toThrow();
  for (const [code, id, name] of directTargets) {
    expect(full35Mapping.mappings.find(m => m.application_nutrient_code === code)?.sources).toContainEqual({ id: String(id), name });
  }
});

for (const [code, id, name, unit] of directTargets) {
  test(`F35-03/08/09: ${code} positive, absent, zero and NC/AS semantics`, () => {
    for (const derivation of ["A", "NC", "AS"]) {
      const raw = syntheticFull35Record();
      raw.foodNutrients = [syntheticNutrient(id, name, unit, 0.1234)];
      Object.assign(raw.foodNutrients[0], { foodNutrientDerivation: { code: derivation, description: "Synthetic derivation" } });
      let c = candidateFor([raw]).candidate;
      expect(Object.keys(c.nutrients)).toEqual(nutrientCodesV1);
      expect(c.nutrients[code]).toMatchObject({ value: "0.1234", semantic: derivation === "A" ? "source_reported" : "source_calculated" });
      const evidence = c.nutrient_evidence.find(e => e.application_nutrient_code === code)!;
      expect(evidence).toMatchObject({ source_nutrient_id: String(id), source_nutrient_name: name, source_unit: unit, source_value: "0.1234", derivation_code: derivation, exact_conversion_factor: null });
      Object.assign(raw.foodNutrients[0], { amount: 0 });
      c = candidateFor([raw]).candidate;
      expect(c.nutrients[code]).toMatchObject({ value: "0", semantic: "explicit_zero" });
      expect(c.nutrient_evidence[0].derivation_code).toBe(derivation);
      raw.foodNutrients = [];
      c = candidateFor([raw]).candidate;
      expect(c.nutrients[code]).toMatchObject({ value: null, semantic: "missing", missing_reason: "source_absent", evidence_hash: null });
    }
  });
  test(`F35-03/10/11/12: ${code} wrong definition/unit, duplicate, malformed and negative fail`, () => {
    const changes: [Record<string, unknown>, string][] = [
      [{ nutrient: { id, name: "Wrong method", unitName: unit } }, "source_definition_mismatch"],
      [{ nutrient: { id, name, unitName: "IU" } }, "unsupported_target_unit"],
      [{ amount: -0.0001 }, "negative_target_value"],
      [{ amount: undefined }, "malformed_target_nutrient"],
      [{ amount: 0, loq: 0.1 }, "trace_target_blocked"],
      [{ amount: 1, loq: 0.1 }, "malformed_target_nutrient"],
      [{ amount: 0, loq: -0.1 }, "malformed_target_nutrient"],
    ];
    for (const [change, category] of changes) {
      const raw = syntheticFull35Record();
      raw.foodNutrients = [Object.assign(syntheticNutrient(id, name, unit), change)];
      failure(() => candidateFor([raw]), category);
    }
    const raw = syntheticFull35Record();
    const n = syntheticNutrient(id, name, unit);
    raw.foodNutrients = [n, structuredClone(n)];
    failure(() => candidateFor([raw]), "duplicate_target_nutrient");
  });
}

test("F35-04: specific precedence, general-only fallback, both evidence and invalid unused method", () => {
  const raw = syntheticFull35Record();
  let c = candidateFor([raw]).candidate;
  expect(c.selected_energy_method).toBe("atwater_specific_2048");
  expect(c.nutrient_evidence.filter(e => e.application_nutrient_code === "energy_kcal").map(e => e.source_nutrient_id)).toEqual(["2047", "2048"]);
  raw.foodNutrients = raw.foodNutrients.filter(n => n.nutrient.id !== 2048);
  c = candidateFor([raw]).candidate;
  expect(c.selected_energy_method).toBe("atwater_general_2047");
  expect(c.nutrients.energy_kcal.value).toBe("200.1234");
  for (const id of [2047, 2048]) {
    for (const change of [{ amount: undefined }, { amount: 0, footnote: "<0.1" }]) {
      const invalid = syntheticFull35Record();
      Object.assign(invalid.foodNutrients.find(n => n.nutrient.id === id)!, change);
      failure(() => candidateFor([invalid]), change.amount === 0 ? "trace_target_blocked" : "malformed_target_nutrient");
    }
  }
});

test("F35-05/06/07: excluded methods and held forms never substitute or synthesize", () => {
  const raw = syntheticFull35Record();
  raw.foodNutrients = [1008, 1062, 1050, 1085, 2033, 2000, 1329, 1330, 1331, 1104, 1105, 1110, 1111, 1112, 1113, 1183, 1184, 1185, 1177, 1186, 1187, 1190, 1235].map(id => syntheticNutrient(id, "Excluded synthetic alternative", "g", 0));
  const c = candidateFor([raw]).candidate;
  expect(Object.values(c.nutrients).every(n => n.value === null)).toBe(true);
  expect(c.nutrient_evidence).toHaveLength(0);
  expect(c.nutrients.added_sugars_g.missing_reason).toBe("unavailable_in_approved_source");
  expect(c.nutrients.folate_dfe_ug.missing_reason).toBe("unavailable_in_approved_source");
  expect(c.nutrients.vitamin_k_ug.missing_reason).toBe("semantic_hold");
  const selected = syntheticFull35Record(); selected.foodNutrients.push(...raw.foodNutrients);
  expect(candidateFor([selected]).candidate.nutrients.fiber_g.value).toBe("1.2345");
});

test("F35-12: only exact approved aliases; identity micrograms retain original token", () => {
  for (const [code, id, name, unit] of directTargets) {
    const targetUnit = unit === "µg" ? "ug" : unit as "g" | "mg" | "kcal";
    for (const token of full35Mapping.unit_aliases[targetUnit]) {
      const raw = syntheticFull35Record(); raw.foodNutrients = [syntheticNutrient(id, name, token, 1.2345)];
      const c = candidateFor([raw]).candidate;
      expect(c.nutrients[code].value).toBe("1.2345");
      expect(c.nutrient_evidence[0].source_unit).toBe(token);
    }
  }
  for (const token of ["μg", "mcg", "Ug", "ug ", "mg"]) {
    const raw = syntheticFull35Record(); raw.foodNutrients = [syntheticNutrient(1103, "Selenium, Se", token)];
    failure(() => candidateFor([raw]), "unsupported_target_unit");
  }
  const old = parseFoundationArchive(legacy.jsonText).records[0];
  const raw = structuredClone(old.raw) as Record<string, JsonValue>;
  const values = raw.foodNutrients as { nutrient: { unitName: string } }[]; values[1].nutrient.unitName = "G";
  failure(() => normalizeFoundationRecord(parseFoundationArchive(JSON.stringify({ FoundationFoods: [raw] })).records[0]), "unsupported_target_unit");
});

test("F35-10/13: exact reference decimals, range, lexeme drift and qualifiers", () => {
  for (const amount of [0, 0.0001, 1.005, 100.5, 9999999999.9999]) {
    const raw = syntheticFull35Record(); Object.assign(raw.foodNutrients[0], { amount, loq: 0, footnote: "Synthetic note" });
    const c = candidateFor([raw]).candidate;
    expect(c.nutrients.energy_kcal.value).toBe(String(amount));
    expect(c.nutrient_evidence.find(e => e.source_nutrient_id === "2048")).toMatchObject({ loq: "0", footnote: "Synthetic note" });
  }
  for (const [amount, category] of [[0.00001, "target_precision_exceeded"], [1.23456, "target_precision_exceeded"], [10000000000, "target_range_exceeded"]] as const) {
    const raw = syntheticFull35Record(); Object.assign(raw.foodNutrients[0], { amount });
    failure(() => candidateFor([raw]), category);
  }
  for (const [change, category] of [[{ amount: 0, footnote: "  <LOD" }, "trace_target_blocked"], [{ amount: 1, footnote: "<LOD" }, "malformed_target_nutrient"]] as const) {
    const raw = syntheticFull35Record(); Object.assign(raw.foodNutrients[0], change);
    failure(() => candidateFor([raw]), category);
  }
  for (const amount of [null, "1", NaN, Infinity]) {
    const raw = syntheticFull35Record(); Object.assign(raw.foodNutrients[0], { amount });
    failure(() => candidateFor([raw]), "schema_contract_mismatch");
  }
  const text = JSON.stringify({ FoundationFoods: [syntheticFull35Record()] }).replace('"amount":1.2345', '"amount":1.23450000000000001');
  failure(() => parseFoundationArchive(text), "exact_decimal_required");
});

test("F35-11/14: stable selections, raw order/path/hash custody, portions and unsupported metadata", () => {
  const first = candidateFor(), raw = syntheticFull35Record(); raw.foodNutrients.reverse();
  const second = candidateFor([raw]);
  const vector = (c: typeof first.candidate) => Object.values(c.nutrients).map(n => [n.application_nutrient_code, n.value, n.semantic]);
  expect(vector(second.candidate)).toEqual(vector(first.candidate));
  expect(second.candidate.record_identity.raw_content_sha256).not.toBe(first.candidate.record_identity.raw_content_sha256);
  expect(first.candidate.portion_candidates[0]).toMatchObject({ amount: "1", gram_weight: "120", measure_unit_name: "cup" });
  expect(first.candidate).not.toHaveProperty("serving_unit");
  expect(first.candidate.unsupported_nutrient_count).toBe(1);
  expect(first.archive.records[0].raw.foodNutrients).toHaveLength(34);
  expect(first.candidate.nutrient_evidence.every(e => /^FoundationFoods\[0\]\.foodNutrients\[\d+\]$/.test(e.raw_field_path))).toBe(true);
  expect(first.candidate.warning_categories.length).toBeLessThanOrEqual(foundationSafetyBounds.maximumWarningCategories);
});

test("v2 candidates require exact complete states, versions, evidence and independently bound raw identity", () => {
  const { candidate, archive, source, identities } = candidateFor();
  const parse = (value: unknown) => parseNormalizedFoundationFull35Candidate(value, archive.records[0], source, identities[0]);
  expect(parse(candidate)).toEqual(candidate);
  for (const field of ["candidate_contract_version", "importer_contract_version", "mapping_version", "mapping_hash"]) {
    failure(() => parse(rehash({ ...candidate, [field]: "unknown" })), "mapping_contract_mismatch");
  }
  const variants: Record<string, unknown>[] = [
    { ...candidate, extra: true },
    { ...candidate, nutrients: { energy_kcal: candidate.nutrients.energy_kcal } },
    { ...candidate, nutrients: { ...candidate.nutrients, extra: candidate.nutrients.protein_g } },
    { ...candidate, nutrients: { ...candidate.nutrients, protein_g: { ...candidate.nutrients.protein_g, application_nutrient_code: "energy_kcal" } } },
    { ...candidate, nutrients: { ...candidate.nutrients, fiber_g: { ...candidate.nutrients.fiber_g, value: "0" } } },
    { ...candidate, nutrient_evidence: [] },
    { ...candidate, nutrient_evidence: candidate.nutrient_evidence.map((e, i) => i === 0 ? { ...e, source_nutrient_id: "9999" } : e) },
    { ...candidate, record_identity: { ...candidate.record_identity, source_version_id: "00000000-0000-4000-8000-000000000500" } },
    { ...candidate, source_identity: { ...candidate.source_identity, archive_sha256: "d".repeat(64) } },
  ];
  for (const value of variants) failure(() => parse(rehash(value)), "evidence_mismatch");
  failure(() => parse({ ...candidate, content_fingerprint: "0".repeat(64) }), "evidence_mismatch");
  failure(() => parse({ ...candidate, unexpected: undefined }), "evidence_mismatch");
  failure(() => parseNormalizedFoundationCandidate(candidate), "normalized_candidate_invalid");
  expect(() => prepareFoundationProjection(candidate)).toThrow();
  failure(() => normalizeFoundationFull35Record(archive.records[0], source, undefined), "accepted_set_mismatch");
  failure(() => normalizeFoundationFull35Record(archive.records[0], source, { ...identities[0], raw_content_sha256: "d".repeat(64) }), "source_identity_mismatch");
  failure(() => parse({ ...candidate, name: "x".repeat(foundationSafetyBounds.maximumCandidateBytes) }), "normalized_candidate_too_large");
});

test("v3 reports account for every state, reject and evidence set in stable order", () => {
  const positive = syntheticFull35Record(), zero = syntheticFull35Record(9000010), absent = syntheticFull35Record(9000020);
  for (const n of zero.foodNutrients) if ("amount" in n) n.amount = 0;
  absent.foodNutrients = [];
  Object.assign(positive.foodNutrients.find(n => n.nutrient.id === 1003)!, { foodNutrientDerivation: { code: "NC", description: "Synthetic calculated" } });
  const context = syntheticFull35Context([positive, zero, absent]);
  const result = createFoundationFull35Report(context), report = result.report;
  expect(report.report_contract_version).toBe("foundation-dry-run-report/v3");
  expect(report.importer_contract_version).toBe("usda-foundation-importer/v3");
  expect(report).toMatchObject({ source_count: 3, accepted_count: 3, rejected_count: 0, executable: false, qualification_status: "offline_unapproved" });
  expect(report.coverage).toHaveLength(35);
  for (const row of report.coverage) {
    expect(row.present + row.missing + row.rejected_unqualified).toBe(3);
    if (row.classification === "direct") expect(row).toMatchObject({ present: 2, missing: 1, explicit_zero: 1 });
    else expect(row).toMatchObject({ present: 0, missing: 3, explicit_zero: 0 });
  }
  expect(report.coverage.find(c => c.application_nutrient_code === "protein_g")).toMatchObject({ source_calculated: 1, source_reported: 0 });
  const reordered = createFoundationFull35Report({ ...context, identities: [...context.identities].reverse(), archive: { ...context.archive, records: [...context.archive.records].reverse() } });
  expect(serializeFoundationFull35Report(reordered.report)).toBe(serializeFoundationFull35Report(report));
  expect(parseFoundationFull35Report(report, context)).toEqual(report);
  for (const change of [{ mapping_hash: "0".repeat(64) }, { report_contract_version: "unknown" }, { coverage: [] }, { accepted_count: 4 }]) {
    failure(() => parseFoundationFull35Report(rehash({ ...report, ...change }, "report_fingerprint"), context), "evidence_mismatch");
  }
  expect(() => createFoundationStagingPlan({ report } as unknown as FoundationDryRunResult)).toThrow("original mapping and report only");
  const invalid = syntheticFull35Record(); Object.assign(invalid.foodNutrients[0], { amount: 0, loq: 0.1 });
  const blocked = createFoundationFull35Report(syntheticFull35Context([invalid])).report;
  expect(blocked).toMatchObject({ accepted_count: 0, rejected_count: 1, qualification_status: "blocked" });
  expect(blocked.rejected_record_set[0].category).toBe("trace_target_blocked");
  expect(blocked.coverage.every(row => row.present + row.missing + row.rejected_unqualified === blocked.source_count)).toBe(true);
  failure(() => createFoundationFull35Report({ ...context, source: { ...context.source, accepted_identity_set_hash: "f".repeat(64) } }), "accepted_set_mismatch");
  expect(fingerprintFull35IdentitySet(context.identities)).toBe(context.source.accepted_identity_set_hash);
  failure(() => createFoundationFull35Report(syntheticFull35Context([positive, positive])), "accepted_set_mismatch");
  failure(() => createFoundationFull35Report({ ...context, archive: { ...context.archive, records: context.archive.records.map(r => ({ ...r, index: r.index + 20 })) } }), "source_identity_mismatch");
});
