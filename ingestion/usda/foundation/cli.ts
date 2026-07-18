import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { runFoundationDryRun } from "./dry-run.ts";
import { serializeFoundationDryRunReport } from "./report.ts";

const allowedArguments = new Set([
  "--archive",
  "--json",
  "--manifest",
  "--report",
]);

function parseArguments(values: string[]) {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (
      !allowedArguments.has(key) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      parsed.has(key)
    ) {
      throw new Error("Expected one value for each approved dry-run argument.");
    }
    parsed.set(key, value);
  }
  if (parsed.size !== allowedArguments.size) {
    throw new Error("--manifest, --archive, --json, and --report are required.");
  }
  return parsed as Map<string, string>;
}

try {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(
    readFileSync(argumentsMap.get("--manifest") as string, "utf8"),
  ) as unknown;
  const archiveBytes = readFileSync(argumentsMap.get("--archive") as string);
  const jsonText = readFileSync(argumentsMap.get("--json") as string, "utf8");
  const startedAt = performance.now();
  const result = runFoundationDryRun({ manifest, archiveBytes, jsonText });
  const dryRunDurationMs = performance.now() - startedAt;
  const reportStartedAt = performance.now();
  const reportBytes = serializeFoundationDryRunReport(result.report);
  const reportGenerationDurationMs = performance.now() - reportStartedAt;
  writeFileSync(argumentsMap.get("--report") as string, reportBytes, "utf8");

  process.stderr.write(
    `${JSON.stringify({
      contract: "foundation-dry-run-execution/v1",
      input_bytes: Buffer.byteLength(jsonText, "utf8"),
      record_count: result.report.source_count,
      dry_run_duration_ms: Number(dryRunDurationMs.toFixed(3)),
      records_per_second: Number(
        (result.report.source_count / (dryRunDurationMs / 1_000)).toFixed(3),
      ),
      report_generation_duration_ms: Number(
        reportGenerationDurationMs.toFixed(3),
      ),
      peak_rss_bytes: process.resourceUsage().maxRSS * 1_024,
      maximum_raw_record_bytes: result.report.maximum_raw_record_bytes,
      maximum_normalized_candidate_bytes:
        result.report.maximum_normalized_candidate_bytes,
      report_fingerprint: result.report.report_fingerprint,
    })}\n`,
  );

  if (result.rejected.length > 0) {
    process.stderr.write("Dry run contains unreviewed record rejects.\n");
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Foundation dry run failed."}\n`,
  );
  process.exitCode = 1;
}
