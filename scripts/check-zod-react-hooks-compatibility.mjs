import assert from "node:assert/strict";
import { Session } from "node:inspector";
import { createRequire } from "node:module";

// Read-only diagnostics against the installed plugin and the complete repository config.
// Profile the unmodified packages to prove the Zod-backed compiler paths actually run.
const session = new Session();
session.connect();
const post = (method, params = {}) => new Promise((resolve, reject) => {
  session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
});
await post("Profiler.enable");
await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
const require = createRequire(`${process.cwd()}/package.json`);
const { ESLint } = require("eslint");
const hooks = require("eslint-plugin-react-hooks");
const hooksVersion = require("eslint-plugin-react-hooks/package.json").version;
assert.equal(hooksVersion, "7.1.1");
const eslint = new ESLint({ cwd: process.cwd() });
const config = await eslint.calculateConfigForFile("components/zod-compatibility.jsx");
assert.ok(config.plugins["react-hooks"]);
const configuredRules = Object.fromEntries(Object.entries(config.rules)
  .filter(([name]) => name.startsWith("react-hooks/")));
assert.ok(configuredRules["react-hooks/immutability"][0] > 0);
const normalize = messages => messages.map(({ ruleId, severity, messageId, message, line, column, endLine, endColumn, fatal }) =>
  ({ ruleId, severity, messageId, message, line, column, endLine, endColumn, fatal }));
const cases = [];
const valid = `"use client";
import {useState} from "react";
export function Example(){const [value]=useState(0); return <span>{value}</span>;}`;
const fixtures = [
  ["legitimate-component", valid, null],
  ["conditional-hook", `"use client";
import {useState} from "react";
export function Example({enabled}) { if(enabled){useState(0);} return <span/>; }`, "rules-of-hooks"],
  ["missing-effect-dependency", `"use client";
import {useEffect} from "react";
export function Example({value}) { useEffect(()=>{console.log(value);},[]); return <span/>; }`, "exhaustive-deps"],
  ["prop-mutation", `"use client";
export function Example({item}) { item.value=1; return <span>{item.value}</span>; }`, "immutability"],
  ["impure-render", `"use client";
export function Example(){return <span>{Date.now()}</span>;}`, "purity"],
  ["ref-read-in-render", `"use client";
import {useRef} from "react";
export function Example(){const ref=useRef(0); return <span>{ref.current}</span>;}`, "refs"],
  ["unconditional-state-update", `"use client";
import {useState} from "react";
export function Example(){const [value,setValue]=useState(0); setValue(1); return <span>{value}</span>;}`, "set-state-in-render"],
];
for (const [name, source, expectedRule] of fixtures) {
  const [result] = await eslint.lintText(source, { filePath: `components/zod-${name}.jsx` });
  assert.equal(result.fatalErrorCount, 0, name);
  if (expectedRule) assert.ok(result.messages.some(message => message.ruleId === `react-hooks/${expectedRule}`), name);
  else assert.deepEqual(result.messages, [], name);
  cases.push({ name, messages: normalize(result.messages) });
}
const options = [
  ["target", { target: "19" }, null],
  ["environment", { environment: { validateNoVoidUseMemo: true } }, null],
  ["external-gating", { gating: { source: "./feature", importSpecifierName: "isEnabled" } }, null],
  ["dynamic-gating", { dynamicGating: { source: "./feature" } }, null],
  ["custom-opt-outs", { customOptOutDirectives: ["use no memo"] }, null],
  ["invalid-target", { target: "20" }, "Not a valid target"],
  ["invalid-environment", { environment: { validateNoVoidUseMemo: "true" } }, "Error in validating environment config"],
  ["invalid-external-gating", { gating: { source: 1 } }, "Could not parse external function"],
  ["invalid-dynamic-gating", { dynamicGating: { source: 1 } }, "Could not parse dynamic gating"],
  ["invalid-custom-opt-outs", { customOptOutDirectives: [42] }, "Could not parse custom opt out directives"],
];
for (const [name, value, expectedError] of options) {
  const instance = new ESLint({ cwd: process.cwd(), overrideConfig: {
    rules: { "react-hooks/immutability": ["error", value] },
  } });
  let observed;
  try {
    const [result] = await instance.lintText(valid, { filePath: `components/zod-${name}.jsx` });
    assert.equal(result.fatalErrorCount, 0, name);
    assert.deepEqual(result.messages, [], name);
    observed = { name, messages: [] };
  } catch (error) {
    if (!expectedError) throw error;
    assert.equal(error.name, "ReactCompilerError", name);
    assert.ok(error.message.includes(expectedError), name);
    observed = { name, expectedConfigurationError: { name: error.name, message: error.message } };
  }
  if (expectedError) assert.ok(observed.expectedConfigurationError, `${name} must reject invalid config`);
  cases.push(observed);
}
const invalidFlatConfig = new ESLint({ cwd: process.cwd(), overrideConfig: {
  rules: { "react-hooks/immutability": ["error", 42] },
} });
await assert.rejects(() => invalidFlatConfig.lintText(valid, { filePath: "components/zod-invalid-rule-schema.jsx" }), /should be object/);
cases.push({ name: "invalid-eslint-option-schema", rejected: true });
const coverage = await post("Profiler.takePreciseCoverage");
await post("Profiler.stopPreciseCoverage");
session.disconnect();
const pluginCoverage = coverage.result.find(entry => entry.url.endsWith("eslint-plugin-react-hooks.development.js"));
assert.ok(pluginCoverage, "unmodified development plugin coverage must be present");
const exercisedFunctions = {};
for (const name of ["parseEnvironmentConfig", "validateEnvironmentConfig", "parsePluginOptions", "parseTargetConfig", "tryParseExternalFunction", "runReactCompilerImpl"]) {
  const fn = pluginCoverage.functions.find(entry => entry.functionName === name);
  assert.ok(fn?.ranges[0].count > 0, `${name} must execute`);
  exercisedFunctions[name] = fn.ranges[0].count;
}
const errorFormatter = coverage.result.find(entry => entry.url.endsWith("zod-validation-error/v4/index.js"));
const fromZodError = errorFormatter?.functions.find(entry => entry.functionName === "fromZodError");
assert.ok(fromZodError?.ranges[0].count > 0, "Zod validation errors must reach the installed formatter");
console.log(JSON.stringify({
  node: process.version,
  zod: require("zod/package.json").version,
  hooks: hooksVersion,
  pluginMetadataVersion: hooks.meta.version,
  configuredRules,
  cases,
  exercisedFunctions,
  zodErrorFormatterCalls: fromZodError.ranges[0].count,
  result: "PASS",
}, null, 2));
