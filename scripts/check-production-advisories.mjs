import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const blockingSeverities = new Set(["critical", "high"]);

function advisoryIds(vulnerability) {
  const ids = new Set();

  for (const via of vulnerability.via ?? []) {
    if (!via || typeof via !== "object" || typeof via.url !== "string") continue;
    const match = via.url.match(/GHSA-[0-9a-z-]+/i);
    if (match) ids.add(match[0].toUpperCase());
  }

  return [...ids].sort();
}

export function evaluateAuditReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return { reason: "npm audit did not return an object report", status: "indeterminate" };
  }

  if (report.error) {
    const code =
      typeof report.error === "object" && report.error !== null
        ? report.error.code
        : undefined;
    return {
      reason: code
        ? `npm advisory service returned ${String(code)}`
        : "npm advisory service returned an error",
      status: "indeterminate",
    };
  }

  const counts = report.metadata?.vulnerabilities;
  const requiredCounts = ["critical", "high", "moderate", "low"];
  const validCounts =
    counts &&
    typeof counts === "object" &&
    requiredCounts.every(
      (severity) =>
        Number.isInteger(counts[severity]) && counts[severity] >= 0,
    );
  const validVulnerabilities =
    report.vulnerabilities &&
    typeof report.vulnerabilities === "object" &&
    !Array.isArray(report.vulnerabilities) &&
    Object.values(report.vulnerabilities).every(
      (vulnerability) =>
        vulnerability &&
        typeof vulnerability === "object" &&
        !Array.isArray(vulnerability) &&
        ["info", "low", "moderate", "high", "critical"].includes(
          vulnerability.severity,
        ) &&
        Array.isArray(vulnerability.via),
    );

  if (
    report.auditReportVersion !== 2 ||
    !validCounts ||
    !validVulnerabilities
  ) {
    return {
      reason: "npm audit report schema was not recognized",
      status: "indeterminate",
    };
  }

  const blocking = Object.entries(report.vulnerabilities)
    .filter(([, vulnerability]) =>
      blockingSeverities.has(vulnerability?.severity),
    )
    .map(([name, vulnerability]) => ({
      advisories: advisoryIds(vulnerability),
      direct: Boolean(vulnerability.isDirect),
      name,
      severity: vulnerability.severity,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (blocking.length > 0) return { blocking, status: "blocked" };

  return {
    counts: {
      critical: Number(counts?.critical ?? 0),
      high: Number(counts?.high ?? 0),
      low: Number(counts?.low ?? 0),
      moderate: Number(counts?.moderate ?? 0),
    },
    status: "passed",
  };
}

function run() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const audit = spawnSync(npm, ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (audit.error) {
    console.error("Production dependency advisory gate INDETERMINATE: npm audit could not start.");
    process.exitCode = 2;
    return;
  }

  let report;

  try {
    report = JSON.parse(audit.stdout);
  } catch {
    console.error(
      "Production dependency advisory gate INDETERMINATE: npm audit returned non-JSON output.",
    );
    process.exitCode = 2;
    return;
  }

  const result = evaluateAuditReport(report);

  if (result.status === "indeterminate") {
    console.error(`Production dependency advisory gate INDETERMINATE: ${result.reason}.`);
    process.exitCode = 2;
    return;
  }

  if (result.status === "blocked") {
    console.error(
      "Production dependency advisory gate FAILED: critical/high production dependency findings remain.",
    );
    for (const finding of result.blocking) {
      const ids = finding.advisories.length
        ? ` [${finding.advisories.join(", ")}]`
        : "";
      console.error(`- ${finding.name}: ${finding.severity}${ids}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Production dependency advisory gate PASSED: critical=${result.counts.critical}, high=${result.counts.high}, moderate=${result.counts.moderate}, low=${result.counts.low}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
