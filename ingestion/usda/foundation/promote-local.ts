import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  fingerprintFoundationRejectAllowance,
  verifyFoundationRejectAllowance,
} from "../../contracts/foundation-reject-allowance.ts";
import {
  foundationPromotionApprovalContractVersion,
  foundationPromotionPolicyVersion,
} from "../../contracts/foundation-promotion-approval.ts";
import { isPlainObject } from "./canonical-json.ts";
import { runFoundationDryRun } from "./dry-run.ts";
import { serializeFoundationDryRunReport } from "./report.ts";
import { createFoundationStagingPlan } from "./staging.ts";

const argumentNames = new Set([
  "--approval",
  "--archive",
  "--json",
  "--manifest",
  "--reject-allowance",
  "--report",
]);

function fail(message: string): never {
  throw new Error(message);
}

function parseArguments(values: string[]) {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (
      !argumentNames.has(key) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      parsed.has(key)
    ) fail("Expected one value for each approved local-promotion argument.");
    parsed.set(key, value);
  }
  if (parsed.size !== argumentNames.size) {
    fail("--manifest, --archive, --json, --report, --reject-allowance, and --approval are required.");
  }
  return parsed;
}

function requireLocalUrl(value: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} is not a valid local URL.`);
  }
  if (!new Set(["127.0.0.1", "localhost", "host.docker.internal"]).has(parsed.hostname)) {
    fail(`Refusing to use a nonlocal ${label}.`);
  }
}

function verifyEnvironmentIsLocal() {
  for (const key of [
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]) {
    const value = process.env[key];
    if (value) requireLocalUrl(value, key);
  }
  const status = spawnSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
  });
  if (status.status !== 0) fail("Local Supabase is not running.");
  const apiUrl = status.stdout.match(/^API_URL="?([^"\n]+)"?$/m)?.[1];
  if (!apiUrl) fail("Local Supabase did not report an API URL.");
  requireLocalUrl(apiUrl, "Supabase API URL");
}

type LocalApprovalInput = {
  contract_version: "foundation-local-promotion-approval-input/v1";
  target_environment: "local";
  approver_identity: string;
  approval_reference: string;
  approval_timestamp: string;
  expires_at: string | null;
};

function parseLocalApprovalInput(input: unknown): LocalApprovalInput {
  if (!isPlainObject(input)) fail("Local approval input must be an object.");
  const keys = [
    "approval_reference",
    "approval_timestamp",
    "approver_identity",
    "contract_version",
    "expires_at",
    "target_environment",
  ];
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(keys)) {
    fail("Local approval input fields must be exact.");
  }
  if (
    input.contract_version !== "foundation-local-promotion-approval-input/v1" ||
    input.target_environment !== "local" ||
    typeof input.approver_identity !== "string" ||
    input.approver_identity !== input.approver_identity.trim() ||
    input.approver_identity.length === 0 ||
    input.approver_identity.length > 160 ||
    typeof input.approval_reference !== "string" ||
    input.approval_reference !== input.approval_reference.trim() ||
    input.approval_reference.length === 0 ||
    input.approval_reference.length > 200 ||
    typeof input.approval_timestamp !== "string" ||
    (input.expires_at !== null && typeof input.expires_at !== "string")
  ) fail("Local approval input is invalid.");
  return input as LocalApprovalInput;
}

function sqlJson(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function sqlText(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function createSql(input: {
  manifest: unknown;
  report: ReturnType<typeof runFoundationDryRun>["report"];
  plan: ReturnType<typeof createFoundationStagingPlan>;
  allowance: unknown;
  allowanceFingerprint: string;
  approval: LocalApprovalInput;
}) {
  const lines = [
    "\\set ON_ERROR_STOP on",
    "\\pset tuples_only on",
    "\\pset format unaligned",
    "\\o /dev/null",
    "begin;",
    "grant ingestion_operator, ingestion_approver to postgres;",
    "set local role ingestion_operator;",
    `select ingestion.register_source_release(${sqlJson(input.manifest)}) as release_id \\gset`,
    `select * from ingestion.begin_import_run(:'release_id'::uuid, ${sqlText(input.plan.logicalRunFingerprint)}, 'usda-foundation-importer/v2', 'phase-10d1-local-operator', 'phase-10d1-local-rehearsal', 'usda-foundation-mvp-v1') \\gset`,
    "select :'current_state' = 'completed' as already_completed \\gset",
    "\\if :already_completed",
    "select * from ingestion.get_completed_foundation_promotion_receipt(:'import_run_id'::uuid) \\gset",
    "commit;",
    "\\o",
    "select pg_catalog.jsonb_build_object('status','completed','retry',true,'promotion_approval_id',:'promotion_approval_id','promotion_receipt_id',:'promotion_receipt_id','receipt_fingerprint',:'receipt_fingerprint','inserted_food_count',:'inserted_food_count'::bigint,'inserted_nutrient_count',:'inserted_nutrient_count'::bigint,'inserted_portion_count',:'inserted_portion_count'::bigint)::text;",
    "\\else",
  ];

  for (const [index, raw] of input.plan.rawRecords.entries()) {
    lines.push(
      `select ingestion.stage_source_record(:'import_run_id'::uuid, ${sqlText(raw.sourceRowKey)}, ${sqlText(raw.payloadSha256)}, ${sqlJson(raw.rawPayload)}, now() + interval '7 days') as raw_id_${index} \\gset`,
    );
  }
  lines.push(
    "select * from ingestion.transition_import_run(:'import_run_id'::uuid, 'created', 'staged', 'phase-10d1-local-operator');",
  );
  const rawIndex = new Map(
    input.plan.rawRecords.map((raw, index) => [raw.sourceRowKey, index]),
  );
  for (const candidate of input.plan.candidates) {
    const index = rawIndex.get(candidate.sourceRowKey);
    if (index === undefined) fail("Candidate raw row is missing.");
    lines.push(
      `select ingestion.stage_candidate(:'import_run_id'::uuid, :'raw_id_${index}'::uuid, ${sqlText(candidate.sourceRowKey)}, ${candidate.conceptKey === null ? "null" : sqlText(candidate.conceptKey)}, ${sqlText(candidate.upstreamVersionKey)}, ${sqlText(candidate.normalizedContentSha256)}, ${sqlJson(candidate.normalizedCandidate)}, 'accepted', null, ${candidate.warningCount}, now() + interval '7 days');`,
    );
  }
  for (const item of input.plan.items) {
    lines.push(
      `select ingestion.record_import_run_item(:'import_run_id'::uuid, null, ${sqlText(item.sourceRowKey)}, ${sqlText(item.action)}, ${sqlText(item.outcome)}, ${item.category === null ? "null" : sqlText(item.category)}, null);`,
    );
  }
  lines.push(
    "reset role;",
    "set local role ingestion_approver;",
    `select * from ingestion.register_foundation_reject_allowance(${sqlJson(input.allowance)}) \\gset`,
    "reset role;",
    "set local role ingestion_operator;",
    `select * from ingestion.validate_foundation_run(:'import_run_id'::uuid, ${sqlJson(input.report)}, :'reject_allowance_id'::uuid, 'local') \\gset`,
    "select :'validation_state' = 'validated' as validation_ok \\gset",
    "\\if :validation_ok",
    "reset role;",
    "set local role ingestion_approver;",
    `select * from ingestion.approve_foundation_promotion(:'validation_receipt_id'::uuid, pg_catalog.jsonb_build_object('contract_version', ${sqlText(foundationPromotionApprovalContractVersion)}, 'validation_receipt_fingerprint', :'receipt_fingerprint', 'reject_allowance_fingerprint', ${sqlText(input.allowanceFingerprint)}, 'target_environment', 'local', 'approver_identity', ${sqlText(input.approval.approver_identity)}, 'approval_reference', ${sqlText(input.approval.approval_reference)}, 'approval_timestamp', ${sqlText(input.approval.approval_timestamp)}, 'expires_at', ${input.approval.expires_at === null ? "null" : sqlText(input.approval.expires_at)}, 'promotion_policy_version', ${sqlText(foundationPromotionPolicyVersion)})) \\gset`,
    "reset role;",
    "set local role ingestion_operator;",
    "select * from ingestion.promote_validated_foundation_run(:'promotion_approval_id'::uuid) \\gset",
    "select :'promotion_status' = 'completed' as promotion_ok \\gset",
    "\\if :promotion_ok",
    "select * from ingestion.promote_validated_foundation_run(:'promotion_approval_id'::uuid) \\gset",
    "\\endif",
    "reset role;",
    "revoke ingestion_operator, ingestion_approver from postgres;",
    "commit;",
    "\\o",
    "\\if :promotion_ok",
    "select pg_catalog.jsonb_build_object('status',:'promotion_status','retry',true,'promotion_approval_id',:'promotion_approval_id','promotion_receipt_id',:'promotion_receipt_id'::uuid,'receipt_fingerprint',:'receipt_fingerprint','inserted_food_count',:'inserted_food_count'::bigint,'inserted_nutrient_count',:'inserted_nutrient_count'::bigint,'inserted_portion_count',:'inserted_portion_count'::bigint,'failure_category',null)::text;",
    "\\else",
    "select pg_catalog.jsonb_build_object('status',:'promotion_status','retry',false,'promotion_approval_id',:'promotion_approval_id','inserted_food_count',0,'inserted_nutrient_count',0,'inserted_portion_count',0,'failure_category',:'failure_category')::text;",
    "\\endif",
    "\\else",
    "reset role;",
    "revoke ingestion_operator, ingestion_approver from postgres;",
    "commit;",
    "\\o",
    "select pg_catalog.jsonb_build_object('status','failed','failure_category',:'failure_category')::text;",
    "\\endif",
    "\\endif",
  );
  return `${lines.join("\n")}\n`;
}

try {
  verifyEnvironmentIsLocal();
  const argumentsMap = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(argumentsMap.get("--manifest")!, "utf8"));
  const allowanceInput = JSON.parse(
    readFileSync(argumentsMap.get("--reject-allowance")!, "utf8"),
  );
  const approvalInput = parseLocalApprovalInput(
    JSON.parse(readFileSync(argumentsMap.get("--approval")!, "utf8")),
  );
  const startedAt = performance.now();
  const dryRun = runFoundationDryRun({
    manifest,
    archiveBytes: readFileSync(argumentsMap.get("--archive")!),
    jsonText: readFileSync(argumentsMap.get("--json")!, "utf8"),
  });
  const allowance = verifyFoundationRejectAllowance({
    allowance: allowanceInput,
    dryRun,
    targetEnvironment: "local",
    today: new Date().toISOString().slice(0, 10),
  });
  const plan = createFoundationStagingPlan(dryRun);
  writeFileSync(
    argumentsMap.get("--report")!,
    serializeFoundationDryRunReport(dryRun.report),
    "utf8",
  );
  const config = readFileSync("supabase/config.toml", "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId) fail("Could not read the local Supabase project id.");
  const sql = createSql({
    manifest: dryRun.manifest,
    report: dryRun.report,
    plan,
    allowance,
    allowanceFingerprint: fingerprintFoundationRejectAllowance(allowance),
    approval: approvalInput,
  });
  const database = spawnSync(
    "docker",
    [
      "exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres",
      "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q",
    ],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (database.status !== 0) {
    process.stderr.write(database.stderr || "Local Foundation promotion failed.\n");
    process.exitCode = database.status ?? 1;
  } else {
    const output = database.stdout.trim().split(/\r?\n/).at(-1);
    if (!output) fail("Local promotion did not return a bounded receipt.");
    const receipt = JSON.parse(output) as { status?: string };
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify({
      contract: "foundation-local-promotion-execution/v1",
      report_fingerprint: dryRun.report.report_fingerprint,
      accepted_record_set_fingerprint:
        dryRun.report.accepted_record_set_fingerprint,
      rejected_record_set_fingerprint:
        dryRun.report.rejected_record_set_fingerprint,
      warning_record_set_fingerprint:
        dryRun.report.warning_record_set_fingerprint,
      source_count: dryRun.report.source_count,
      accepted_count: dryRun.report.accepted_count,
      rejected_count: dryRun.report.rejected_count,
      duration_ms: Number((performance.now() - startedAt).toFixed(3)),
      peak_rss_bytes: process.resourceUsage().maxRSS * 1_024,
    })}\n`);
    if (receipt.status !== "completed") process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Local Foundation promotion failed."}\n`,
  );
  process.exitCode = 1;
}
