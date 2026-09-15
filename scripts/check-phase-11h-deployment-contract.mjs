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
const exactShaPattern = /^[0-9a-f]{40}$/;

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
  if (
    template.productionReleaseAuthorized !== false ||
    template.authorization?.productionAuthorized !== false
  ) {
    fail(errors, "Release evidence template must not authorize Production.");
  }
  const evidencePolicy = validateEvidencePacket(template);
  errors.push(...evidencePolicy.errors);

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

function inspectVercelConfiguration(root, errors) {
  const path = join(root, phase11hContract.providerArchitecture.repositoryConfiguration.path);
  if (!existsSync(path)) {
    fail(errors, "Missing inert Vercel repository configuration.");
    return;
  }

  let configuration;
  try {
    configuration = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(errors, "vercel.json must be valid JSON.");
    return;
  }

  if (configuration.git?.deploymentEnabled !== false) {
    fail(errors, "vercel.json must disable all automatic Git deployments.");
  }
}

export function validateDeploymentPolicy(contract = phase11hContract) {
  const errors = [];
  const architecture = contract.providerArchitecture;
  const deploymentClasses = contract.deploymentClasses;
  const bootstrap = deploymentClasses?.PRODUCTION_BOOTSTRAP_ONLY;
  const release = deploymentClasses?.PRODUCTION_RELEASE;

  if (
    architecture?.vercelProjectCount !== 1 ||
    architecture?.topology !== "single-project" ||
    JSON.stringify(architecture?.applicationTargets) !==
      JSON.stringify(["preview", "staging", "production"])
  ) {
    fail(errors, "Phase 11H must retain one Vercel project with Preview, staging, and Production targets.");
  }
  if (
    architecture?.automaticGitDeployments !== false ||
    architecture?.repositoryConfiguration?.path !== "vercel.json" ||
    architecture?.repositoryConfiguration?.["git.deploymentEnabled"] !== false
  ) {
    fail(errors, "Automatic Git deployments must remain disabled in the provider and repository contract.");
  }
  for (const invariant of [
    "merge != deployment authorization",
    "push != deployment authorization",
    "CI success != deployment authorization",
  ]) {
    if (!architecture?.authorityInvariants?.includes(invariant)) {
      fail(errors, `Missing automatic-deployment authority invariant: ${invariant}.`);
    }
  }
  if (
    JSON.stringify(Object.keys(deploymentClasses ?? {})) !==
    JSON.stringify(["PREVIEW", "STAGING", "PRODUCTION_BOOTSTRAP_ONLY", "PRODUCTION_RELEASE"])
  ) {
    fail(errors, "Deployment classes must distinguish Preview, staging, Production bootstrap, and Production release.");
  }
  if (
    bootstrap?.applicationEnvironment !== "production" ||
    bootstrap?.vercelTarget !== "production" ||
    bootstrap?.maximumAuthorizedExecutions !== 1 ||
    bootstrap?.productionReleaseAuthorizedInEvidence !== false ||
    bootstrap?.invitationsAllowed !== false ||
    bootstrap?.realUsersAllowed !== false ||
    bootstrap?.betaEnrollmentAllowed !== false ||
    bootstrap?.externalLaunchCommunicationAllowed !== false ||
    bootstrap?.ordinaryProductionAccessAllowed !== false ||
    bootstrap?.deploymentProtectionBypassAllowed !== false ||
    bootstrap?.shareableLinksAllowed !== false ||
    bootstrap?.protectionExceptionsAllowed !== false ||
    bootstrap?.customProductionDomainAllowed !== false ||
    bootstrap?.findingClosureCredit !== false ||
    bootstrap?.phase11KLaunchCredit !== false ||
    bootstrap?.phase11JAcceptanceEligible !== false ||
    bootstrap?.subsequentProductionDeploymentsAllowed !== false
  ) {
    fail(errors, "PRODUCTION_BOOTSTRAP_ONLY must remain one-time, non-release, protected, and ineligible for users, invitations, domains, or acceptance credit.");
  }
  if (
    release?.applicationEnvironment !== "production" ||
    release?.vercelTarget !== "production" ||
    release?.productionReleaseAuthorizationRequired !== true ||
    release?.productionReleaseAuthorizedInEvidence !== true ||
    release?.freshAuthorizationRequired !== true ||
    release?.currentRecoveryQualificationRequired !== true ||
    release?.bootstrapAuthorizationIsInsufficient !== true
  ) {
    fail(errors, "PRODUCTION_RELEASE must require fresh release authorization and current recovery qualification independent of bootstrap.");
  }
  if (
    contract.productionBootstrapPolicy?.decision !== "DEC-031" ||
    contract.productionBootstrapPolicy?.classification !== "PRODUCTION_BOOTSTRAP_ONLY" ||
    contract.productionBootstrapPolicy?.authorizationRequiredLater !== true ||
    contract.productionBootstrapPolicy?.executedByThisRepositoryTask !== false
  ) {
    fail(errors, "The DEC-031 repository record must not execute or self-authorize the Production bootstrap.");
  }
  const bootstrapSource = contract.productionBootstrapPolicy?.sourceMethod;
  if (
    bootstrapSource?.type !== "vercel-git-source" ||
    bootstrapSource?.repository !== "Papi299/nutrition-tracker-app" ||
    bootstrapSource?.rawCliOrPrebuiltUploadAllowed !== false ||
    bootstrapSource?.gitConnectionOutsideBootstrapAuthorizationAllowed !== false ||
    !bootstrapSource?.candidateConstraint?.includes("authorized SHA and tree") ||
    !bootstrapSource?.postBootstrapGitState?.includes("git.deploymentEnabled=false")
  ) {
    fail(errors, "The Production bootstrap must be Git-sourced, exact-revision-bound, and automatic-deployment-disabled.");
  }
  if (
    contract.productionBootstrapPolicy?.identityBindings?.length !== 5 ||
    contract.productionBootstrapPolicy?.orderedBootstrapSteps?.length !== 16 ||
    !contract.productionBootstrapPolicy?.requiredEvidenceFields?.includes(
      "productionReleaseAuthorized",
    ) ||
    !contract.productionBootstrapPolicy?.requiredEvidenceFields?.includes(
      "execution.independentReviewer",
    )
  ) {
    fail(errors, "The Production bootstrap must retain exact identity, evidence, and deterministic ordering contracts.");
  }
  if (
    contract.trustedOriginPolicy?.activeOriginVariable !== "APP_ORIGIN" ||
    JSON.stringify(contract.trustedOriginPolicy?.registryVariables) !==
      JSON.stringify(["PREVIEW_APP_ORIGIN", "STAGING_APP_ORIGIN", "PRODUCTION_APP_ORIGIN"]) ||
    contract.trustedOriginPolicy?.providerBindings?.preview !== "VERCEL_URL" ||
    contract.trustedOriginPolicy?.providerBindings?.staging !== "VERCEL_BRANCH_URL" ||
    contract.trustedOriginPolicy?.providerBindings?.production !==
      "VERCEL_PROJECT_PRODUCTION_URL"
  ) {
    fail(errors, "APP_ORIGIN must remain target-bound to the origin registry and trusted Vercel metadata.");
  }
  for (const finding of ["P11A-010", "P11A-017", "P11A-018"]) {
    const disposition = contract.findingDispositions?.[finding];
    if (
      disposition?.status !== "OPEN" ||
      disposition?.implementationStage !==
        "IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING" ||
      disposition?.closureGate !== "Phase 11K"
    ) {
      fail(errors, `${finding} must remain OPEN at implementation-complete/external-validation-pending with Phase 11K closure.`);
    }
  }
  if (
    contract.findingDispositions?.allPhase11FindingsOpen !== true ||
    contract.findingDispositions?.phase11Status !== "INCOMPLETE"
  ) {
    fail(errors, "All 18 Phase 11 findings must remain OPEN and Phase 11 must remain INCOMPLETE.");
  }

  return { errors, ok: errors.length === 0 };
}

export function validateEvidencePacket(packet) {
  const errors = [];
  if (packet.schemaVersion !== phase11hContract.schemaVersion) {
    fail(errors, "Evidence schemaVersion must match the Phase 11H contract.");
  }
  if (packet.productionReleaseAuthorized !== packet.authorization?.productionAuthorized) {
    fail(errors, "Evidence production-release authorization declarations must agree.");
  }
  if (packet.bootstrap?.findingClosureCreditClaimed !== false) {
    fail(errors, "Deployment evidence cannot claim finding-closure credit before Phase 11K.");
  }
  if (packet.status === "TEMPLATE_NOT_EXECUTED") {
    if (packet.deploymentClass !== null || packet.productionReleaseAuthorized !== false) {
      fail(errors, "The unexecuted evidence template must have no deployment class or Production authorization.");
    }
    return { errors, ok: errors.length === 0 };
  }

  const definition = phase11hContract.deploymentClasses[packet.deploymentClass];
  if (!definition) {
    fail(errors, "Executed evidence must use a declared deployment class.");
    return { errors, ok: false };
  }
  if (
    packet.environment?.applicationEnvironment !== definition.applicationEnvironment ||
    packet.deployment?.target !== definition.vercelTarget ||
    packet.environment?.vercelTargetEnvironment !== definition.vercelTarget
  ) {
    fail(errors, "Evidence deployment class, application environment, and Vercel target must agree.");
  }
  if (packet.productionReleaseAuthorized !== definition.productionReleaseAuthorizedInEvidence) {
    fail(errors, "Evidence Production authorization must match the deployment class.");
  }
  if (
    packet.deployment?.projectIdentity == null ||
    packet.deployment?.projectIdentity !== packet.deployment?.expectedProjectIdentity
  ) {
    fail(errors, "Evidence must bind one exact expected Vercel project identity.");
  }

  if (packet.deploymentClass === "PRODUCTION_BOOTSTRAP_ONLY") {
    if (!packet.authorization?.bootstrapAuthorizationReference) {
      fail(errors, "Production bootstrap evidence requires its own exact authorization reference.");
    }
    if (packet.authorization?.productionAuthorizationReference != null) {
      fail(errors, "Production bootstrap evidence must not contain Production release authorization.");
    }
    if (
      !exactShaPattern.test(packet.candidate?.commit ?? "") ||
      !exactShaPattern.test(packet.candidate?.tree ?? "") ||
      !/^dpl_[A-Za-z0-9]+$/.test(packet.deployment?.deploymentIdentifier ?? "") ||
      !packet.deployment?.applicationOrigin ||
      packet.deployment?.applicationOrigin !== packet.deployment?.providerOriginAssertion ||
      packet.environment?.supabaseEnvironment !== "production" ||
      !packet.environment?.supabaseProjectReference ||
      !packet.environment?.configurationCandidateIdentifier ||
      !packet.execution?.operator ||
      !packet.execution?.independentReviewer ||
      packet.execution?.operator === packet.execution?.independentReviewer ||
      !packet.timestamps?.deploymentStartedAt ||
      !packet.timestamps?.verificationCompletedAt ||
      packet.bootstrap?.oneTimeExceptionVerified !== true ||
      !packet.bootstrap?.deploymentProtectionDisposition ||
      packet.bootstrap?.vercelAuthenticationVerified !== true ||
      packet.bootstrap?.protectionBypassConfigured !== false ||
      packet.bootstrap?.shareableLinksCreated !== false ||
      packet.bootstrap?.protectionExceptionsConfigured !== false ||
      packet.bootstrap?.automaticGitDeploymentsEnabled !== false ||
      packet.bootstrap?.customProductionDomainAttached !== false ||
      packet.bootstrap?.realUsersPresent !== false ||
      packet.bootstrap?.invitationsExecuted !== false ||
      packet.bootstrap?.betaEnrollmentExecuted !== false ||
      packet.bootstrap?.externalLaunchCommunicationExecuted !== false ||
      packet.bootstrap?.ordinaryProductionAccessEnabled !== false ||
      packet.bootstrap?.phase11JAcceptanceCreditClaimed !== false ||
      packet.bootstrap?.phase11KLaunchCreditClaimed !== false ||
      packet.bootstrap?.bootstrapSmokeResult !== "PASS"
    ) {
      fail(errors, "Production bootstrap evidence violates a one-time protection, exposure, domain, Git, invitation, or credit boundary.");
    }
  }

  if (packet.deploymentClass === "PRODUCTION_RELEASE") {
    if (!packet.authorization?.productionAuthorizationReference) {
      fail(errors, "Production release evidence requires a fresh Production authorization reference.");
    }
    if (
      packet.authorization?.productionAuthorizationReference ===
      packet.authorization?.bootstrapAuthorizationReference
    ) {
      fail(errors, "A bootstrap authorization cannot authorize the actual Production release.");
    }
    if (!packet.recovery?.incidentOrRecoveryQualificationReference) {
      fail(errors, "Production release evidence requires current recovery qualification.");
    }
  }

  return { errors, ok: errors.length === 0 };
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
  for (const reference of [
    "README.md",
    "docs/incident-response-runbook.md",
    "docs/phase-11e-auth-account-lifecycle-governance.md",
    "docs/phase-11b-launch-contract-and-acceptance-baseline.md",
  ]) {
    if (!existsSync(join(root, reference)) || !source.includes(reference.split("/").at(-1))) {
      fail(errors, `P11A-018 documentation reconciliation is missing ${reference}.`);
    }
  }
  if (
    !source.includes("P11A-018") ||
    !source.includes("IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING")
  ) {
    fail(errors, "P11A-018 must remain OPEN at the repository-complete/external-validation-pending stage.");
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
  const policy = validateDeploymentPolicy(contract);
  errors.push(...policy.errors);

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
    "DEPLOYMENT_CLASS",
    "SUPABASE_ENVIRONMENT",
    "SUPABASE_PROJECT_REF",
    "PREVIEW_SUPABASE_PROJECT_REF",
    "STAGING_SUPABASE_PROJECT_REF",
    "PRODUCTION_SUPABASE_PROJECT_REF",
    "APP_ORIGIN",
    "PREVIEW_APP_ORIGIN",
    "STAGING_APP_ORIGIN",
    "PRODUCTION_APP_ORIGIN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "AUTH_REAUTH_PROOF_SECRET",
    "ACCOUNT_CLOSURE_CAPABILITY_SECRET",
    "VERCEL_ENV",
    "VERCEL_TARGET_ENV",
    "EXPECTED_VERCEL_PROJECT_ID",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_PROJECT_ID",
    "VERCEL_DEPLOYMENT_ID",
    "VERCEL_GIT_PROVIDER",
    "VERCEL_GIT_REPO_OWNER",
    "VERCEL_GIT_REPO_SLUG",
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
  inspectVercelConfiguration(root, errors);
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
