import { fingerprintJson, type JsonValue } from "../canonical-json.ts";
import type {
  FoundationFinalProjectionEntry,
  FoundationLifecycleDiffClassification,
  FoundationLifecycleExecutionAction,
  FoundationLifecycleState,
  FoundationMissingDecision,
} from "./types.ts";

const hashPattern = /^[a-f0-9]{64}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function deriveFoundationLifecycleAction(input: {
  classification: FoundationLifecycleDiffClassification;
  missingDecision?: FoundationMissingDecision;
  hasExactAllowance?: boolean;
}): FoundationLifecycleExecutionAction {
  switch (input.classification) {
    case "new_concept":
      return "insert_new_concept";
    case "byte_identical_unchanged":
      return "no_op_byte_identical";
    case "semantically_unchanged_new_version":
      return "advance_source_version_reuse_projection";
    case "source_only_metadata":
      return "append_source_metadata_reuse_projection";
    case "projection_changing":
      return "replace_current_projection";
    case "reactivation":
      return "reactivate";
    case "missing_prior_concept":
      switch (input.missingDecision) {
        case "keep_active_pending_investigation":
        case "source_anomaly":
          return "keep_active_pending_investigation";
        case "defer":
          return "mark_missing_pending";
        case "archive":
          return "archive";
        case "supersede":
          return "supersede";
        default:
          throw new Error("Missing concepts require one current decision.");
      }
    case "rejected":
      if (input.hasExactAllowance) return "exclude_rejected";
      break;
    case "trace_blocked":
      if (input.hasExactAllowance) return "exclude_trace_blocked";
      break;
    case "unsupported":
      if (input.hasExactAllowance) return "exclude_unsupported";
      break;
    case "warning":
    case "new_version":
      throw new Error("Derived diff evidence is not a lifecycle action.");
    case "identity_conflict":
    case "manual_reconciliation_required":
      break;
  }
  throw new Error(`Blocked lifecycle classification: ${input.classification}.`);
}

export function fingerprintFoundationFinalProjection(input: {
  dataset_id: string;
  environment: "local" | "production";
  source_release_id: string;
  foods: readonly FoundationFinalProjectionEntry[];
}) {
  if (!uuidPattern.test(input.dataset_id) || !uuidPattern.test(input.source_release_id)) {
    throw new Error("Final projection requires lowercase UUID identities.");
  }
  const foods = input.foods.map((food) => {
    if (!uuidPattern.test(food.food_id) || !hashPattern.test(food.lifecycle_projection_hash)) {
      throw new Error("Final projection contains an invalid identity or hash.");
    }
    if (!new Set<FoundationLifecycleState>([
      "active", "missing_pending", "archived", "superseded",
    ]).has(food.lifecycle_state)) {
      throw new Error("Final projection contains an invalid lifecycle state.");
    }
    return { ...food };
  }).sort((left, right) => left.food_id.localeCompare(right.food_id, "en"));
  if (new Set(foods.map((food) => food.food_id)).size !== foods.length) {
    throw new Error("Final projection contains duplicate food UUIDs.");
  }
  return fingerprintJson({
    contract_version: "foundation-lifecycle-final-projection-set/v1",
    dataset_id: input.dataset_id,
    environment: input.environment,
    source_release_id: input.source_release_id,
    foods,
  } as JsonValue);
}
