import { fingerprintJson, type JsonValue } from "../canonical-json.ts";
import {
  parseNormalizedFoundationCandidate,
  type FoundationNormalizedCandidate,
  type NormalizedFoundationRecord,
} from "../normalization.ts";
import type { FoundationLifecycleCandidate } from "./types.ts";
import {
  foundationLifecycleOverlayPolicyVersion,
  foundationLifecycleOverlaySeed,
} from "../../../contracts/foundation-lifecycle-rehearsal.ts";

export type FoundationOverlayDeclaration = {
  synthetic_rehearsal_only: true;
  policy_version: typeof foundationLifecycleOverlayPolicyVersion;
  seed: typeof foundationLifecycleOverlaySeed;
  release_label: "Synthetic Lifecycle Release B" | "Synthetic Lifecycle Release C";
  role_ordinals: Record<string, number>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function candidate(
  source: FoundationNormalizedCandidate,
  mutate: (body: Omit<FoundationNormalizedCandidate, "content_fingerprint">) => void,
) {
  const { content_fingerprint: _ignored, ...original } = clone(source);
  void _ignored;
  mutate(original);
  const result = {
    ...original,
    content_fingerprint: fingerprintJson(original as JsonValue),
  };
  return parseNormalizedFoundationCandidate(result);
}

function lifecycleCandidate(
  normalized: FoundationNormalizedCandidate,
  rawPayloadHash: string,
): FoundationLifecycleCandidate {
  return {
    source_row_key: normalized.source_row_key,
    raw_payload_hash: rawPayloadHash,
    validation_status: "accepted",
    reject_category: null,
    normalized_candidate: normalized,
    possible_prior_source_record_ids: [],
  };
}

function changedHash(label: string) {
  return fingerprintJson({ synthetic_rehearsal_only: true, label });
}

function useSyntheticVersion(
  body: Omit<FoundationNormalizedCandidate, "content_fingerprint">,
  id: number,
  publicationDate = "2026-05-01",
) {
  const value = String(id);
  body.source_row_key = `fdc:${value}`;
  body.upstream_version_key = `fdc:${value}`;
  body.fdc_id = value;
  body.publication_date = publicationDate;
}

function sortedBaseline(records: readonly NormalizedFoundationRecord[]) {
  const values = records.filter((record) => record.candidate.concept_key !== null)
    .sort((left, right) => Buffer.compare(
      Buffer.from(left.candidate.concept_key!, "utf8"),
      Buffer.from(right.candidate.concept_key!, "utf8"),
    ));
  if (values.length !== 353) throw new Error("Verified baseline must contain 353 source-supplied concepts.");
  return values;
}

export function createReleaseBOverlay(
  records: readonly NormalizedFoundationRecord[],
) {
  const baseline = sortedBaseline(records);
  const roles = {
    semantic_new_version: 0,
    source_metadata: 1,
    name_change: 2,
    nutrient_change: 3,
    nutrient_added: 4,
    nutrient_removed: 5,
    explicit_zero: 6,
    warning_only: 7,
    multiple_warnings: 8,
    keep_active_missing: 9,
    missing_pending: 10,
    archive: 11,
    supersede: 12,
  } as const;
  const omitted = new Set<number>([
    roles.keep_active_missing, roles.missing_pending, roles.archive, roles.supersede,
  ]);
  const output: FoundationLifecycleCandidate[] = [];
  baseline.forEach((record, ordinal) => {
    if (omitted.has(ordinal)) return;
    let normalized = record.candidate;
    let rawHash = record.raw.rawContentSha256;
    if (ordinal === roles.semantic_new_version) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000001);
      });
      rawHash = changedHash("release-b-semantic-version");
    } else if (ordinal === roles.source_metadata) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000002);
        body.source_metadata.input_food_count += 1;
      });
      rawHash = changedHash("release-b-source-metadata");
    } else if (ordinal === roles.name_change) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000003);
        body.name = `${body.name} synthetic rehearsal update`;
      });
      rawHash = changedHash("release-b-name");
    } else if (ordinal === roles.nutrient_change) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000004);
        const nutrient = body.nutrients.protein_g;
        nutrient.value = nutrient.value === null ? "1" : String(Number(nutrient.value) + 1);
        nutrient.semantic = "source_reported";
        nutrient.source_nutrient_id ??= "1003";
        nutrient.source_unit = "g";
      });
      rawHash = changedHash("release-b-nutrient-change");
    } else if (ordinal === roles.nutrient_added) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000005);
        const missing = Object.values(body.nutrients).find((item) => item.semantic === "missing");
        const target = missing ?? body.nutrients.fat_g;
        target.value = "1";
        target.semantic = "source_reported";
        target.source_nutrient_id = target.application_nutrient_code === "energy_kcal" ? "2048" :
          target.application_nutrient_code === "protein_g" ? "1003" :
            target.application_nutrient_code === "carbohydrates_g" ? "1005" : "1004";
        target.source_unit = target.application_nutrient_code === "energy_kcal" ? "kcal" : "g";
      });
      rawHash = changedHash("release-b-nutrient-added");
    } else if (ordinal === roles.nutrient_removed) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000006);
        const present = Object.values(body.nutrients).find((item) => item.semantic !== "missing");
        if (!present) throw new Error("Nutrient-removal role requires one present nutrient.");
        Object.assign(present, {
          source_nutrient_id: null, source_unit: null, value: null,
          semantic: "missing", loq: null, derivation_code: null,
          derivation_description: null,
        });
      });
      rawHash = changedHash("release-b-nutrient-removed");
    } else if (ordinal === roles.explicit_zero) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000007);
        const present = Object.values(body.nutrients).find((item) => item.semantic !== "missing");
        if (!present) throw new Error("Explicit-zero role requires one present nutrient.");
        present.value = "0";
        present.semantic = "explicit_zero";
      });
      rawHash = changedHash("release-b-explicit-zero");
    } else if (ordinal === roles.warning_only || ordinal === roles.multiple_warnings) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, ordinal === roles.warning_only ? 990000008 : 990000009);
        const warnings = new Set(body.warning_categories);
        warnings.add("missing_portions");
        if (ordinal === roles.multiple_warnings) warnings.add("unsupported_nutrients_present");
        body.warning_categories = [...warnings].sort() as typeof body.warning_categories;
      });
      rawHash = changedHash(`release-b-warning-${ordinal}`);
    }
    output.push(lifecycleCandidate(normalized, rawHash));
  });

  const template = baseline[13].candidate;
  const newConcept = candidate(template, (body) => {
    body.source_row_key = "fdc:990000010";
    body.concept_key = "foundation:ndb:990000010";
    body.upstream_version_key = "fdc:990000010";
    body.fdc_id = "990000010";
    body.ndb_number = "990000010";
    body.name = "Synthetic rehearsal concept";
    body.publication_date = "2026-05-01";
    body.portion_candidates = [];
  });
  output.push(lifecycleCandidate(newConcept, changedHash("release-b-new-concept")));
  output.push({
    source_row_key: "synthetic:release-b-negative-reject",
    raw_payload_hash: changedHash("release-b-negative-reject"),
    validation_status: "rejected", reject_category: "negative_target_value",
    normalized_candidate: null, possible_prior_source_record_ids: [],
  });
  const trace = candidate(template, (body) => {
    body.source_row_key = "fdc:990000011"; body.concept_key = "foundation:ndb:990000011";
    body.upstream_version_key = "fdc:990000011"; body.fdc_id = "990000011";
    body.ndb_number = "990000011"; body.name = "Synthetic trace exclusion";
    Object.assign(body.nutrients.protein_g, {
      source_nutrient_id: "1003", source_unit: "g", value: null,
      semantic: "trace", loq: "0.1",
    });
  });
  output.push(lifecycleCandidate(trace, changedHash("release-b-trace")));
  const unsupported = candidate(template, (body) => {
    body.source_row_key = "fdc:990000012"; body.concept_key = "foundation:ndb:990000012";
    body.upstream_version_key = "fdc:990000012"; body.fdc_id = "990000012";
    body.ndb_number = "990000012"; body.name = "Synthetic unsupported exclusion";
    const target = body.nutrients.protein_g;
    target.source_nutrient_id = "1003"; target.source_unit = "mg";
    target.value ??= "1"; target.semantic = target.value === "0" ? "explicit_zero" : "source_reported";
  });
  output.push(lifecycleCandidate(unsupported, changedHash("release-b-unsupported")));

  return {
    declaration: {
      synthetic_rehearsal_only: true,
      policy_version: foundationLifecycleOverlayPolicyVersion,
      seed: foundationLifecycleOverlaySeed,
      release_label: "Synthetic Lifecycle Release B",
      role_ordinals: roles,
    } satisfies FoundationOverlayDeclaration,
    candidates: output,
    missing: {
      keep_active_pending_investigation: baseline[roles.keep_active_missing].candidate.concept_key!,
      defer: baseline[roles.missing_pending].candidate.concept_key!,
      archive: baseline[roles.archive].candidate.concept_key!,
      supersede: baseline[roles.supersede].candidate.concept_key!,
    },
  };
}

export function createReleaseCOverlay(
  records: readonly NormalizedFoundationRecord[],
  releaseB: ReturnType<typeof createReleaseBOverlay>,
) {
  const baseline = sortedBaseline(records);
  const roles = {
    second_source_version: 0,
    later_source_metadata: 3,
    corrective_projection: 2,
    warning_change: 7,
    archive_after_b: 14,
    reactivate_from_b: 11,
    omit_superseded: 12,
  } as const;
  const output: FoundationLifecycleCandidate[] = [];
  const releaseBByConcept = new Map(
    releaseB.candidates.filter((item) => item.normalized_candidate?.concept_key)
      .map((item) => [item.normalized_candidate!.concept_key!, item]),
  );
  baseline.forEach((record, ordinal) => {
    if (ordinal === roles.omit_superseded || ordinal === roles.archive_after_b) return;
    const releaseBItem = releaseBByConcept.get(record.candidate.concept_key!);
    let normalized = releaseBItem?.normalized_candidate ?? record.candidate;
    let rawHash = releaseBItem?.raw_payload_hash ?? record.raw.rawContentSha256;
    if (ordinal === roles.second_source_version) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000101, "2026-06-01");
      });
      rawHash = changedHash("release-c-second-source-version");
    } else if (ordinal === roles.later_source_metadata) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000102, "2026-06-01");
        body.source_metadata.input_food_count += 2;
      });
      rawHash = changedHash("release-c-later-metadata");
    } else if (ordinal === roles.corrective_projection) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000103, "2026-06-01");
        body.name = `${record.candidate.name} synthetic corrective update`;
      });
      rawHash = changedHash("release-c-corrective-projection");
    } else if (ordinal === roles.warning_change) {
      normalized = candidate(normalized, (body) => {
        useSyntheticVersion(body, 990000107, "2026-06-01");
        body.warning_categories = [...new Set([
          ...body.warning_categories, "unsupported_nutrients_present",
        ])].sort() as typeof body.warning_categories;
      });
      rawHash = changedHash("release-c-warning-change");
    }
    output.push(lifecycleCandidate(normalized, rawHash));
  });
  const bNew = releaseB.candidates.find(
    (item) => item.normalized_candidate?.concept_key === "foundation:ndb:990000010",
  );
  if (!bNew) throw new Error("Release B new concept is missing.");
  output.push(bNew);
  return {
    declaration: {
      synthetic_rehearsal_only: true,
      policy_version: foundationLifecycleOverlayPolicyVersion,
      seed: foundationLifecycleOverlaySeed,
      release_label: "Synthetic Lifecycle Release C",
      role_ordinals: roles,
    } satisfies FoundationOverlayDeclaration,
    candidates: output,
    missing: { archive: baseline[roles.archive_after_b].candidate.concept_key! },
  };
}
