import { readFileSync, writeFileSync } from "node:fs";
import {
  createFoundationProductionApprovalPacket,
  fingerprintFoundationProductionApprovalPacket,
} from "../../contracts/foundation-production-approval-packet.ts";
import { runFoundationDryRun } from "./dry-run.ts";
import { canonicalizeJson, type JsonValue } from "./canonical-json.ts";

const argumentNames = new Set([
  "--archive",
  "--expected-nutrients",
  "--json",
  "--manifest",
  "--packet",
  "--proposed-operator",
  "--required-approver",
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
      !argumentNames.has(key) || typeof value !== "string" ||
      value.startsWith("--") || parsed.has(key)
    ) fail("Expected one value for each production-packet argument.");
    parsed.set(key, value);
  }
  if (parsed.size !== argumentNames.size) {
    fail("All production-packet arguments are required.");
  }
  return parsed;
}

try {
  const args = parseArguments(process.argv.slice(2));
  const archiveBytes = readFileSync(args.get("--archive")!);
  const jsonText = readFileSync(args.get("--json")!, "utf8");
  const dryRun = runFoundationDryRun({
    manifest: JSON.parse(readFileSync(args.get("--manifest")!, "utf8")),
    archiveBytes,
    jsonText,
  });
  const expectedNutrientCount = Number(args.get("--expected-nutrients"));
  if (!Number.isSafeInteger(expectedNutrientCount) || expectedNutrientCount < 0) {
    fail("Expected nutrient count must be a nonnegative safe integer.");
  }
  const packet = createFoundationProductionApprovalPacket({
    dryRun,
    expectedNutrientCount,
    proposedOperatorIdentity: args.get("--proposed-operator")!,
    requiredApproverIdentity: args.get("--required-approver")!,
  });
  writeFileSync(
    args.get("--packet")!,
    `${canonicalizeJson(packet as JsonValue)}\n`,
    "utf8",
  );
  process.stdout.write(`${JSON.stringify({
    contract: packet.contract_version,
    packet_status: packet.packet_status,
    packet_fingerprint: fingerprintFoundationProductionApprovalPacket(packet),
    source_count: packet.counts.source,
    accepted_count: packet.counts.accepted,
    rejected_count: packet.counts.rejected,
    reject_allowance_status: "pending",
    backup_confirmation: packet.backup_confirmation,
    rollback_confirmation: packet.rollback_confirmation,
    approval_reference: packet.approval_reference,
  })}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Approval packet creation failed."}\n`,
  );
  process.exitCode = 1;
}
