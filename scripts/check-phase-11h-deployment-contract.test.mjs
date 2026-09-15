import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  phase11hContract,
  validateDeploymentEnvironment,
} from "../lib/deployment/environment.mjs";
import {
  validateDeploymentPolicy,
  validateEvidencePacket,
} from "./check-phase-11h-deployment-contract.mjs";

const syntheticRefs = {
  preview: "syntheticpreview001",
  staging: "syntheticstaging001",
  production: "syntheticproduction001",
};
const syntheticOrigins = {
  preview: "https://preview-commit-synthetic.vercel.app",
  staging: "https://staging-git-acceptance-synthetic.vercel.app",
  production: "https://nutrition-tracker-synthetic.vercel.app",
};

function hostname(origin) {
  return new URL(origin).hostname;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function bootstrapEvidence() {
  const packet = JSON.parse(
    readFileSync(new URL("../deployment/release-evidence-template.json", import.meta.url), "utf8"),
  );
  packet.status = "EXECUTED_EVIDENCE";
  packet.deploymentClass = "PRODUCTION_BOOTSTRAP_ONLY";
  packet.candidate.commit = "a".repeat(40);
  packet.candidate.tree = "b".repeat(40);
  packet.deployment.deploymentIdentifier = "dpl_SyntheticDeployment001";
  packet.deployment.target = "production";
  packet.deployment.projectIdentity = "prj_SyntheticNutritionTracker001";
  packet.deployment.expectedProjectIdentity = "prj_SyntheticNutritionTracker001";
  packet.deployment.applicationOrigin = syntheticOrigins.production;
  packet.deployment.providerOriginAssertion = syntheticOrigins.production;
  packet.environment.applicationEnvironment = "production";
  packet.environment.vercelTargetEnvironment = "production";
  packet.environment.supabaseEnvironment = "production";
  packet.environment.supabaseProjectReference = syntheticRefs.production;
  packet.environment.configurationCandidateIdentifier = "synthetic-config-v1";
  packet.authorization.bootstrapAuthorizationReference =
    "synthetic-production-bootstrap-authorization";
  packet.execution.operator = "Synthetic Operator";
  packet.execution.independentReviewer = "Synthetic Reviewer";
  packet.timestamps.deploymentStartedAt = "2026-09-15T00:00:00Z";
  packet.timestamps.verificationCompletedAt = "2026-09-15T00:05:00Z";
  Object.assign(packet.bootstrap, {
    oneTimeExceptionVerified: true,
    deploymentProtectionDisposition: "All Deployments with Vercel Authentication",
    vercelAuthenticationVerified: true,
    protectionBypassConfigured: false,
    shareableLinksCreated: false,
    protectionExceptionsConfigured: false,
    automaticGitDeploymentsEnabled: false,
    customProductionDomainAttached: false,
    realUsersPresent: false,
    invitationsExecuted: false,
    betaEnrollmentExecuted: false,
    externalLaunchCommunicationExecuted: false,
    ordinaryProductionAccessEnabled: false,
    bootstrapSmokeResult: "PASS",
  });
  return packet;
}

function localEnvironment(overrides = {}) {
  return {
    ACCOUNT_CLOSURE_CAPABILITY_SECRET:
      "synthetic-local-closure-secret-material-000000000000",
    APP_ENVIRONMENT: "local",
    APP_ORIGIN: "http://127.0.0.1:3000",
    AUTH_REAUTH_PROOF_SECRET:
      "synthetic-local-reauth-secret-material-111111111111",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NODE_ENV: "development",
    SUPABASE_ENVIRONMENT: "local",
    SUPABASE_PROJECT_REF: "local",
    ...overrides,
  };
}

function hostedEnvironment(appEnvironment, overrides = {}) {
  const production = appEnvironment === "production";
  const projectRef = syntheticRefs[appEnvironment];
  const deploymentClass = {
    preview: "PREVIEW",
    production: "PRODUCTION_BOOTSTRAP_ONLY",
    staging: "STAGING",
  }[appEnvironment];
  return {
    ACCOUNT_CLOSURE_CAPABILITY_SECRET:
      "synthetic-hosted-closure-secret-material-0000000000",
    APP_ENVIRONMENT: appEnvironment,
    APP_ORIGIN: syntheticOrigins[appEnvironment],
    DEPLOYMENT_CLASS: deploymentClass,
    EXPECTED_VERCEL_PROJECT_ID: "prj_SyntheticNutritionTracker001",
    AUTH_REAUTH_PROOF_SECRET:
      "synthetic-hosted-reauth-secret-material-1111111111",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_only",
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NODE_ENV: "production",
    PREVIEW_SUPABASE_PROJECT_REF: syntheticRefs.preview,
    PREVIEW_APP_ORIGIN: syntheticOrigins.preview,
    PRODUCTION_SUPABASE_PROJECT_REF: syntheticRefs.production,
    PRODUCTION_APP_ORIGIN: syntheticOrigins.production,
    STAGING_SUPABASE_PROJECT_REF: syntheticRefs.staging,
    STAGING_APP_ORIGIN: syntheticOrigins.staging,
    SUPABASE_ENVIRONMENT: appEnvironment,
    SUPABASE_PROJECT_REF: projectRef,
    VERCEL_BRANCH_URL:
      appEnvironment === "staging"
        ? hostname(syntheticOrigins.staging)
        : `${appEnvironment}-branch-synthetic.vercel.app`,
    VERCEL_DEPLOYMENT_ID: "dpl_SyntheticDeployment001",
    VERCEL_ENV: production ? "production" : "preview",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_GIT_PROVIDER: "github",
    VERCEL_GIT_REPO_OWNER: "Papi299",
    VERCEL_GIT_REPO_SLUG: "nutrition-tracker-app",
    VERCEL_PROJECT_ID: "prj_SyntheticNutritionTracker001",
    VERCEL_PROJECT_PRODUCTION_URL: hostname(syntheticOrigins.production),
    VERCEL_TARGET_ENV: appEnvironment,
    VERCEL_URL:
      appEnvironment === "preview"
        ? hostname(syntheticOrigins.preview)
        : `${appEnvironment}-deployment-synthetic.vercel.app`,
    ...overrides,
  };
}

test("accepts a valid local configuration", () => {
  assert.equal(validateDeploymentEnvironment(localEnvironment()).ok, true);
});

test("accepts a valid CI/test configuration", () => {
  assert.equal(
    validateDeploymentEnvironment(
      localEnvironment({ APP_ENVIRONMENT: "test", NODE_ENV: "test" }),
    ).ok,
    true,
  );
});

test("accepts a valid Preview origin binding", () => {
  assert.equal(validateDeploymentEnvironment(hostedEnvironment("preview")).ok, true);
});

test("accepts a valid staging origin binding", () => {
  assert.equal(validateDeploymentEnvironment(hostedEnvironment("staging")).ok, true);
});

test("accepts a valid Production bootstrap origin binding", () => {
  assert.equal(validateDeploymentEnvironment(hostedEnvironment("production")).ok, true);
});

for (const [appEnvironment, wrongEnvironment] of [
  ["preview", "staging"],
  ["preview", "production"],
  ["staging", "preview"],
  ["staging", "production"],
  ["production", "preview"],
  ["production", "staging"],
]) {
  test(`rejects ${appEnvironment} with the ${wrongEnvironment} origin`, () => {
    const result = validateDeploymentEnvironment(
      hostedEnvironment(appEnvironment, {
        APP_ORIGIN: syntheticOrigins[wrongEnvironment],
      }),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /must match its declared origin-registry entry/);
  });
}

test("rejects Preview configured against the Production project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("preview", {
      NEXT_PUBLIC_SUPABASE_URL: `https://${syntheticRefs.production}.supabase.co`,
      SUPABASE_PROJECT_REF: syntheticRefs.production,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must not target the Production Supabase project/);
});

test("rejects staging configured against the Production project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("staging", {
      NEXT_PUBLIC_SUPABASE_URL: `https://${syntheticRefs.production}.supabase.co`,
      SUPABASE_PROJECT_REF: syntheticRefs.production,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must not target the Production Supabase project/);
});

test("rejects Production configured against a non-production project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      NEXT_PUBLIC_SUPABASE_URL: `https://${syntheticRefs.preview}.supabase.co`,
      SUPABASE_PROJECT_REF: syntheticRefs.preview,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Production must target the declared Production/);
});

test("rejects a missing required application environment identity", () => {
  const environment = localEnvironment();
  delete environment.APP_ENVIRONMENT;
  const result = validateDeploymentEnvironment(environment);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /APP_ENVIRONMENT must explicitly identify/);
});

test("rejects contradictory Vercel environment declarations", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("staging", { VERCEL_TARGET_ENV: "production" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /VERCEL_TARGET_ENV contradicts/);
});

test("rejects a project reference that does not match the public Supabase URL", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("preview", { SUPABASE_PROJECT_REF: "differentnonprod001" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must match NEXT_PUBLIC_SUPABASE_URL/);
});

test("rejects hosted insecure or loopback application origins", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("preview", { APP_ORIGIN: "http://127.0.0.1:3000" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Hosted APP_ORIGIN must use HTTPS/);
});

test("rejects a missing trusted hosted-origin assertion", () => {
  const environment = hostedEnvironment("preview");
  delete environment.VERCEL_URL;
  const result = validateDeploymentEnvironment(environment);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /VERCEL_URL is required/);
});

test("rejects an HTTP hosted origin even when the registry repeats it", () => {
  const insecureOrigin = "http://preview-commit-synthetic.vercel.app";
  const result = validateDeploymentEnvironment(
    hostedEnvironment("preview", {
      APP_ORIGIN: insecureOrigin,
      PREVIEW_APP_ORIGIN: insecureOrigin,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Hosted APP_ORIGIN must use HTTPS/);
});

test("rejects a loopback hosted origin even when the registry repeats it", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("staging", {
      APP_ORIGIN: "https://127.0.0.1",
      STAGING_APP_ORIGIN: "https://127.0.0.1",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /non-loopback/);
});

test("rejects a provider-origin contradiction", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("preview", {
      VERCEL_URL: "different-preview-synthetic.vercel.app",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /contradicts trusted provider assertion VERCEL_URL/);
});

test("rejects a Production bootstrap origin on a custom domain", () => {
  const customOrigin = "https://production.synthetic.invalid";
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      APP_ORIGIN: customOrigin,
      PRODUCTION_APP_ORIGIN: customOrigin,
      VERCEL_PROJECT_PRODUCTION_URL: hostname(customOrigin),
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must remain on the provider-owned vercel.app origin/);
});

test("rejects a mismatched Vercel project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("preview", {
      VERCEL_PROJECT_ID: "prj_DifferentSyntheticProject001",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must match EXPECTED_VERCEL_PROJECT_ID/);
});

test("rejects a hosted deployment with the wrong repository provenance", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("staging", {
      VERCEL_GIT_REPO_SLUG: "unrelated-repository",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must identify Papi299\/nutrition-tracker-app/);
});

test("rejects a service-role key in the browser-visible key slot", () => {
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const result = validateDeploymentEnvironment(
    localEnvironment({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `x.${payload}.y` }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must not contain a secret or service-role key/);
});

test("rejects hosted identity metadata in a local declaration", () => {
  const result = validateDeploymentEnvironment(
    localEnvironment({ VERCEL_TARGET_ENV: "preview" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /contradicts APP_ENVIRONMENT=local/);
});

test("accepts synthetic evidence for the bounded Production bootstrap only", () => {
  assert.equal(validateEvidencePacket(bootstrapEvidence()).ok, true);
});

test("rejects Production bootstrap evidence that claims release authorization", () => {
  const packet = bootstrapEvidence();
  packet.productionReleaseAuthorized = true;
  packet.authorization.productionAuthorized = true;
  assert.equal(validateEvidencePacket(packet).ok, false);
});

test("rejects Production bootstrap evidence that records an invitation", () => {
  const packet = bootstrapEvidence();
  packet.bootstrap.invitationsExecuted = true;
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /invitation/);
});

test("rejects Production bootstrap evidence that attaches a custom domain", () => {
  const packet = bootstrapEvidence();
  packet.bootstrap.customProductionDomainAttached = true;
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /domain/);
});

test("rejects any evidence packet that claims finding closure before Phase 11K", () => {
  const packet = bootstrapEvidence();
  packet.bootstrap.findingClosureCreditClaimed = true;
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /finding-closure credit/);
});

test("rejects Production bootstrap evidence that claims Phase 11J acceptance credit", () => {
  const packet = bootstrapEvidence();
  packet.bootstrap.phase11JAcceptanceCreditClaimed = true;
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /acceptance|credit|boundary/i);
});

test("rejects a Production release that reuses bootstrap authorization", () => {
  const packet = bootstrapEvidence();
  packet.deploymentClass = "PRODUCTION_RELEASE";
  packet.productionReleaseAuthorized = true;
  packet.authorization.productionAuthorized = true;
  packet.authorization.productionAuthorizationReference =
    packet.authorization.bootstrapAuthorizationReference;
  packet.recovery.incidentOrRecoveryQualificationReference = "synthetic-current-phase-11i";
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /cannot authorize the actual Production release/);
});

test("repository policy rejects automatic Git deployment enablement", () => {
  const contract = clone(phase11hContract);
  contract.providerArchitecture.automaticGitDeployments = true;
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Automatic Git deployments must remain disabled/);
});

test("repository policy rejects subsequent Production deployments under bootstrap", () => {
  const contract = clone(phase11hContract);
  contract.deploymentClasses.PRODUCTION_BOOTSTRAP_ONLY.subsequentProductionDeploymentsAllowed =
    true;
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PRODUCTION_BOOTSTRAP_ONLY/);
});

test("repository policy rejects collapsing bootstrap into Production release", () => {
  const contract = clone(phase11hContract);
  contract.deploymentClasses.PRODUCTION_BOOTSTRAP_ONLY.productionReleaseAuthorizedInEvidence =
    true;
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PRODUCTION_BOOTSTRAP_ONLY/);
});

test("repository policy rejects a raw CLI or prebuilt Production bootstrap", () => {
  const contract = clone(phase11hContract);
  contract.productionBootstrapPolicy.sourceMethod.rawCliOrPrebuiltUploadAllowed = true;
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Git-sourced, exact-revision-bound/);
});
