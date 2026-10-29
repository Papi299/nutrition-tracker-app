import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

const [directory, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert.ok(isAbsolute(directory) && isAbsolute(output) && !existsSync(output));
assert.match(process.env.CANDIDATE_SHA ?? '', /^[a-f0-9]{40}$/);
assert.ok(['javascript-typescript', 'actions'].includes(process.env.ANALYSIS_LANGUAGE));
const files = readdirSync(directory).filter(name => name.endsWith('.sarif'));
assert.equal(files.length, 1, 'Exactly one CodeQL SARIF result is required per language');
const path = join(directory, files[0]);
assert.ok(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
const bytes = readFileSync(path), sarif = JSON.parse(bytes);
assert.equal(sarif.version, '2.1.0');
assert.equal(sarif.runs?.length, 1);
const run = sarif.runs[0];
assert.equal(run.tool?.driver?.name, 'CodeQL');
assert.ok(Array.isArray(run.results));
const rules = (run.tool.driver.rules?.length ?? 0) + (run.tool.extensions ?? []).reduce((sum, extension) => sum + (extension.rules?.length ?? 0), 0);
assert.ok(rules > 0, 'An empty analysis cannot qualify');
assert.ok(run.invocations?.length > 0 && run.invocations.every(i => i.executionSuccessful === true));
const report = {
  schemaVersion: 'nutrition-002g-codeql/v1',
  sourceCommit: process.env.CANDIDATE_SHA,
  language: process.env.ANALYSIS_LANGUAGE,
  result: run.results.length === 0 ? 'PASS' : 'FAIL_FINDINGS_REQUIRE_REVIEW',
  findings: run.results.length,
  rules,
  sarifSha256: createHash('sha256').update(bytes).digest('hex'),
  codeScanningUploaded: false,
  recoveryEligible: false,
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
assert.equal(report.findings, 0, 'CodeQL findings require review before the declared scope can pass');
