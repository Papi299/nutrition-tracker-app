import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { phase11hContract } from "../lib/deployment/environment.mjs";

const requiredVariableFields = [
  "name",
  "visibility",
  "requiredEnvironments",
  "ownerCategory",
  "purpose",
  "sourceBoundary",
  "rotation",
  "browserExposure",
  "vaultMatch",
];
const allowedVisibilities = new Set([
  "public browser",
  "server-only application",
  "local test only",
  "CI only",
  "operator-only",
]);
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const sourceRoots = ["app", "components", "e2e", "ingestion", "lib", "scripts", "tests"];
const extraSourceFiles = [
  "next.config.ts",
  "playwright.config.ts",
  "playwright.phase11d.config.ts",
  "playwright.unit.config.ts",
];

function fail(errors, message) {
  errors.push(message);
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function sourceFiles(root) {
  return [
    ...sourceRoots.flatMap((path) => filesUnder(join(root, path))),
    ...extraSourceFiles.map((path) => join(root, path)).filter(existsSync),
  ].filter((path) => sourceExtensions.has(extname(path)));
}

function literalEnvironmentReads(source) {
  const names = new Set();
  for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g)) {
    names.add(match[1]);
  }
  return names;
}

function inspectEnvironmentInventory(root, errors, variableNames) {
  for (const file of sourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    for (const name of literalEnvironmentReads(source)) {
      if (!variableNames.has(name)) {
        fail(errors, `${relative(root, file)} reads undocumented environment variable ${name}.`);
      }
    }
    if (/NEXT_PUBLIC_(?:AUTH_REAUTH_PROOF_SECRET|ACCOUNT_CLOSURE_CAPABILITY_SECRET)/.test(source)) {
      fail(errors, `${relative(root, file)} exposes a server-only application secret.`);
    }
  }
}

function inspectTemplate(root, errors) {
  const evidence = phase11hContract.releaseEvidencePacket;
  const templatePath = join(root, evidence.template);
  if (!existsSync(templatePath)) {
    fail(errors, `Missing release evidence template: ${evidence.template}.`);
    return;
  }

  let template;
  try {
    template = JSON.parse(readFileSync(templatePath, "utf8"));
  } catch {
    fail(errors, "Release evidence template must be valid JSON.");
    return;
  }

  const actualFields = Object.keys(template);
  if (
    actualFields.length !== evidence.requiredTopLevelFields.length ||
    evidence.requiredTopLevelFields.some((field, index) => actualFields[index] !== field)
  ) {
    fail(errors, "Release evidence template top-level fields must match the authoritative contract in order.");
  }
  if (template.schemaVersion !== phase11hContract.schemaVersion) {
    fail(errors, "Release evidence template schemaVersion must match the contract.");
  }
  if (template.status !== "TEMPLATE_NOT_EXECUTED") {
    fail(errors, "Release evidence template must not claim execution.");
  }
  if (template.authorization?.productionAuthorized !== false) {
    fail(errors, "Release evidence template must not authorize Production.");
  }

  const serialized = JSON.stringify(template);
  const prohibitedValuePatterns = [
    /sb_secret_[A-Za-z0-9_-]+/,
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  ];
  if (prohibitedValuePatterns.some((pattern) => pattern.test(serialized))) {
    fail(errors, "Release evidence template contains credential or personal-data-shaped content.");
  }
}

function inspectRunbook(root, errors) {
  const runbook = phase11hContract.runbook;
  const runbookPath = join(root, runbook.document);
  if (!existsSync(runbookPath)) {
    fail(errors, `Missing canonical runbook: ${runbook.document}.`);
    return;
  }
  const source = readFileSync(runbookPath, "utf8");
  for (const section of runbook.requiredSections) {
    if (!source.includes(`## ${section}`)) {
      fail(errors, `Canonical runbook is missing required section: ${section}.`);
    }
  }
}

function inspectWorkflow(root, errors) {
  const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  if (!workflow.includes("npm run test:deployment-contract")) {
    fail(errors, "CI must run the Phase 11H deployment contract tests.");
  }
  if (/\bvercel\s+(?:deploy|--prod|promote|rollback)|supabase\s+(?:link|db\s+push)/i.test(workflow)) {
    fail(errors, "CI must not contain a deployment or remote Supabase workflow.");
  }
}

export function validateRepositoryContract(root = process.cwd()) {
  const errors = [];
  const contract = phase11hContract;
  const expectedEnvironments = ["local", "test", "preview", "staging", "production"];
  if (JSON.stringify(Object.keys(contract.applicationEnvironments)) !== JSON.stringify(expectedEnvironments)) {
    fail(errors, "Application environments must be exactly local, test, preview, staging, and production.");
  }
  if (contract.status !== "IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING") {
    fail(errors, "The repository contract must not claim external validation or finding closure.");
  }

  const names = new Set();
  for (const variable of contract.environmentVariables) {
    if (
      Object.keys(variable).length !== requiredVariableFields.length ||
      requiredVariableFields.some((field, index) => Object.keys(variable)[index] !== field)
    ) {
      fail(errors, `${variable.name ?? "Unknown variable"} has an invalid metadata shape.`);
      continue;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(variable.name)) {
      fail(errors, `Invalid environment variable name: ${variable.name}.`);
    }
    if (names.has(variable.name)) fail(errors, `Duplicate environment variable: ${variable.name}.`);
    names.add(variable.name);
    if (!allowedVisibilities.has(variable.visibility)) {
      fail(errors, `${variable.name} has an invalid visibility classification.`);
    }
    if (variable.visibility === "public browser" && !variable.name.startsWith("NEXT_PUBLIC_")) {
      fail(errors, `${variable.name} is browser-visible without the explicit public prefix.`);
    }
    if (
      variable.name.startsWith("NEXT_PUBLIC_") &&
      variable.visibility !== "public browser"
    ) {
      fail(errors, `${variable.name} has a public prefix but is not classified public browser.`);
    }
    if (
      variable.name.startsWith("NEXT_PUBLIC_") &&
      /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN/.test(variable.name)
    ) {
      fail(errors, `${variable.name} uses a forbidden public secret name.`);
    }
    if (
      !Array.isArray(variable.requiredEnvironments) ||
      variable.requiredEnvironments.some((environment) => !expectedEnvironments.includes(environment))
    ) {
      fail(errors, `${variable.name} has invalid required environments.`);
    }
  }

  for (const name of [
    "APP_ENVIRONMENT",
    "SUPABASE_ENVIRONMENT",
    "SUPABASE_PROJECT_REF",
    "PREVIEW_SUPABASE_PROJECT_REF",
    "STAGING_SUPABASE_PROJECT_REF",
    "PRODUCTION_SUPABASE_PROJECT_REF",
    "APP_ORIGIN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "AUTH_REAUTH_PROOF_SECRET",
    "ACCOUNT_CLOSURE_CAPABILITY_SECRET",
    "VERCEL_ENV",
    "VERCEL_TARGET_ENV",
    "VERCEL_GIT_COMMIT_SHA",
  ]) {
    if (!names.has(name)) fail(errors, `Missing required contract variable: ${name}.`);
  }

  const databaseSecret = contract.databaseSecrets.find(
    (secret) => secret.name === "account_closure_capability_v1",
  );
  if (
    !databaseSecret ||
    databaseSecret.matchesApplicationVariable !== "ACCOUNT_CLOSURE_CAPABILITY_SECRET" ||
    databaseSecret.browserExposure !== "forbidden"
  ) {
    fail(errors, "The E5 application/Vault matching-secret contract is incomplete.");
  }

  if (
    contract.invitationRegister.maximumInitialIdentities !== 100 ||
    !contract.invitationRegister.atomicity.startsWith("No atomic transaction") ||
    !contract.invitationRegister.requiredFields.includes("environment") ||
    !contract.invitationRegister.requiredFields.includes("canonicalEmailIndex") ||
    !contract.invitationRegister.requiredFields.includes("controlledContactReference") ||
    !contract.invitationRegister.requiredFields.includes("attemptWindowCount") ||
    !contract.invitationRegister.requiredFields.includes("configurationCandidateIdentifier") ||
    !contract.invitationRegister.requiredFields.includes("operatorIdentity") ||
    !contract.invitationRegister.requiredFields.includes("reviewerIdentity")
  ) {
    fail(errors, "Restricted invitation-register capacity, binding, attribution, or atomicity is incomplete.");
  }

  inspectEnvironmentInventory(root, errors, names);
  inspectTemplate(root, errors);
  inspectRunbook(root, errors);
  inspectWorkflow(root, errors);
  return { errors, ok: errors.length === 0 };
}

export function runRepositoryContractValidation(root = process.cwd()) {
  const result = validateRepositoryContract(resolve(root));
  if (!result.ok) {
    throw new Error(`Phase 11H deployment contract validation FAILED:\n${result.errors.join("\n")}`);
  }
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    runRepositoryContractValidation();
    process.stdout.write(
      "Phase 11H deployment contract validation PASSED: environment isolation, inventory, runbook, evidence template, and CI boundary are complete.\n",
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Validation failed."}\n`);
    process.exitCode = 1;
  }
}
