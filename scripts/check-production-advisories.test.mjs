import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAuditReport } from "./check-production-advisories.mjs";

function report(vulnerabilities = {}, counts = {}) {
  return {
    auditReportVersion: 2,
    metadata: {
      vulnerabilities: {
        critical: 0,
        high: 0,
        low: 0,
        moderate: 0,
        ...counts,
      },
    },
    vulnerabilities,
  };
}

test("passes a clean production report", () => {
  assert.deepEqual(evaluateAuditReport(report()), {
    counts: { critical: 0, high: 0, low: 0, moderate: 0 },
    status: "passed",
  });
});

test("does not block a production moderate advisory", () => {
  const result = evaluateAuditReport(
    report(
      {
        example: {
          isDirect: false,
          severity: "moderate",
          via: [],
        },
      },
      { moderate: 1 },
    ),
  );

  assert.equal(result.status, "passed");
  assert.equal(result.counts.moderate, 1);
});

test("blocks every high or critical production package without a generic allowlist", () => {
  const result = evaluateAuditReport(
    report({
      direct: {
        isDirect: true,
        severity: "critical",
        via: [
          { url: "https://github.com/advisories/GHSA-1111-2222-3333" },
        ],
      },
      transitive: {
        isDirect: false,
        severity: "high",
        via: [],
      },
    }),
  );

  assert.deepEqual(result, {
    blocking: [
      {
        advisories: ["GHSA-1111-2222-3333"],
        direct: true,
        name: "direct",
        severity: "critical",
      },
      {
        advisories: [],
        direct: false,
        name: "transitive",
        severity: "high",
      },
    ],
    status: "blocked",
  });
});

test("distinguishes advisory-service errors from a passing audit", () => {
  assert.deepEqual(
    evaluateAuditReport({ error: { code: "ENOAUDIT" } }),
    {
      reason: "npm advisory service returned ENOAUDIT",
      status: "indeterminate",
    },
  );
});

test("fails closed on an unknown audit schema", () => {
  assert.equal(evaluateAuditReport({ auditReportVersion: 3 }).status, "indeterminate");
  assert.equal(
    evaluateAuditReport({
      auditReportVersion: 2,
      metadata: { vulnerabilities: { critical: 0, high: 0, low: 0, moderate: 0 } },
      vulnerabilities: { incomplete: { severity: "high" } },
    }).status,
    "indeterminate",
  );
});
