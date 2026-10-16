import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  phase11hContract,
  registryLifecycleForDeployment,
  validateDeploymentEnvironment,
} from "../lib/deployment/environment.mjs";
import {
  validateDeploymentPolicy,
  validateEvidencePacket,
} from "./check-phase-11h-deployment-contract.mjs";

const reviewedProductionRef = phase11hContract.releaseProfiles.PERSONAL_USE_FREE_TIER
  .hostedTopology.productionDatabaseAuth.projectRef;
// Production identity is reviewed public metadata; all secrets, non-Production
// projects and provider assertions are synthetic. No fixture makes a request.
const fixtureRefs = {
  preview: "syntheticpreview001",
  staging: "syntheticstaging001",
  production: reviewedProductionRef,
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
  packet.environment.supabaseProjectReference = fixtureRefs.production;
  packet.environment.configurationCandidateIdentifier = "synthetic-config-v1";
  packet.environment.previewRegistryDisposition = "NOT_YET_PROVISIONED";
  packet.environment.stagingRegistryDisposition = "NOT_YET_PROVISIONED";
  packet.environment.productionRegistryDisposition = "VERIFIED";
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

function deviceTestEnvironment(overrides = {}) {
  return localEnvironment({
    APP_ENVIRONMENT: "device-test",
    APP_ORIGIN: "https://nutrition-j3.example-tailnet.ts.net",
    NODE_ENV: "production",
    ...overrides,
  });
}

function hostedEnvironment(appEnvironment, overrides = {}) {
  const production = appEnvironment === "production";
  const projectRef = fixtureRefs[appEnvironment];
  const deploymentClass =
    overrides.DEPLOYMENT_CLASS ??
    {
      preview: "PREVIEW",
      production: "PRODUCTION_BOOTSTRAP_ONLY",
      staging: "STAGING",
    }[appEnvironment];
  const registry = {};
  for (const registryEnvironment of registryLifecycleForDeployment(deploymentClass)
    .requiredRegistryEnvironments) {
    registry[`${registryEnvironment.toUpperCase()}_SUPABASE_PROJECT_REF`] =
      fixtureRefs[registryEnvironment];
    registry[`${registryEnvironment.toUpperCase()}_APP_ORIGIN`] =
      syntheticOrigins[registryEnvironment];
  }
  const providerOriginVariable =
    phase11hContract.applicationEnvironments[appEnvironment].originProviderVariable;
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
    ...registry,
    SUPABASE_ENVIRONMENT: appEnvironment,
    SUPABASE_PROJECT_REF: projectRef,
    VERCEL_DEPLOYMENT_ID: "dpl_SyntheticDeployment001",
    VERCEL_ENV: production ? "production" : "preview",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_GIT_PROVIDER: "github",
    VERCEL_GIT_REPO_OWNER: "Papi299",
    VERCEL_GIT_REPO_SLUG: "nutrition-tracker-app",
    VERCEL_PROJECT_ID: "prj_SyntheticNutritionTracker001",
    VERCEL_TARGET_ENV: appEnvironment,
    [providerOriginVariable]: hostname(syntheticOrigins[appEnvironment]),
    ...overrides,
  };
}

function assertHostedNegative(appEnvironment, overrides, expectedError, deploymentClass) {
  const baseline = hostedEnvironment(appEnvironment,
    deploymentClass ? { DEPLOYMENT_CLASS: deploymentClass } : {});
  const valid = validateDeploymentEnvironment(baseline);
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  const result = validateDeploymentEnvironment({ ...baseline, ...overrides });
  assert.equal(result.ok, false, "Unsafe configuration must fail from a passing baseline.");
  assert.match(result.errors.join("\n"), expectedError);
  return result;
}

const productionRegistryPinError =
  /PRODUCTION_SUPABASE_PROJECT_REF must match the reviewed source-controlled Production identity/;

for (const appEnvironment of ["preview", "staging"]) {
  for (const replacementProductionRef of [
    "differentproduction001",
    fixtureRefs[appEnvironment],
    "a".repeat(40),
  ]) {
    test(`rejects coordinated ${appEnvironment} relabeling with Production registry ${replacementProductionRef}`, () => {
      const environmentPrefix = appEnvironment.toUpperCase();
      const origin = `https://${appEnvironment}-coordinated-synthetic.vercel.app`;
      const providerVariable =
        phase11hContract.applicationEnvironments[appEnvironment].originProviderVariable;
      const result = assertHostedNegative(appEnvironment, {
        APP_ORIGIN: origin,
        [`${environmentPrefix}_APP_ORIGIN`]: origin,
        [providerVariable]: hostname(origin),
        NEXT_PUBLIC_SUPABASE_URL: `https://${reviewedProductionRef}.supabase.co`,
        SUPABASE_PROJECT_REF: reviewedProductionRef,
        [`${environmentPrefix}_SUPABASE_PROJECT_REF`]: reviewedProductionRef,
        PRODUCTION_SUPABASE_PROJECT_REF: replacementProductionRef,
        PRODUCTION_APP_ORIGIN: "https://production-registry-relabelled-synthetic.vercel.app",
      }, productionRegistryPinError);
      assert.match(result.errors.join("\n"), /must not target the Production Supabase project/);
      assert.doesNotMatch(result.errors.join("\n"), /is required|contradicts|must be distinct/);
    });
  }

  test(`rejects ${appEnvironment} relabeling the Production registry while retaining an isolated backend`, () => {
    assertHostedNegative(appEnvironment, {
      PRODUCTION_SUPABASE_PROJECT_REF: "differentproduction001",
    }, productionRegistryPinError);
  });

  test(`rejects ${appEnvironment} with active and declared non-Production identities both equal to Production`, () => {
    const prefix = appEnvironment.toUpperCase();
    const result = assertHostedNegative(appEnvironment, {
      NEXT_PUBLIC_SUPABASE_URL: `https://${reviewedProductionRef}.supabase.co`,
      SUPABASE_PROJECT_REF: reviewedProductionRef,
      [`${prefix}_SUPABASE_PROJECT_REF`]: reviewedProductionRef,
    }, /must not target the Production Supabase project/);
    assert.match(result.errors.join("\n"), /hosted Supabase project references must be distinct/);
  });
}

for (const deploymentClass of ["PRODUCTION_BOOTSTRAP_ONLY", "PRODUCTION_RELEASE"]) {
  for (const replacementRef of ["differentproduction001", fixtureRefs.preview]) {
    test(`rejects ${deploymentClass} coherently replacing its active and declared Production project with ${replacementRef}`, () => {
      const result = assertHostedNegative("production", {
        NEXT_PUBLIC_SUPABASE_URL: `https://${replacementRef}.supabase.co`,
        SUPABASE_PROJECT_REF: replacementRef,
        PRODUCTION_SUPABASE_PROJECT_REF: replacementRef,
      }, productionRegistryPinError, deploymentClass);
      assert.match(result.errors.join("\n"), /Production must target the declared Production Supabase project/);
      assert.doesNotMatch(result.errors.join("\n"), /is required|contradicts|must be distinct/);
    });

    test(`rejects ${deploymentClass} relabeling only its Production registry to ${replacementRef}`, () => {
      assertHostedNegative("production", {
        PRODUCTION_SUPABASE_PROJECT_REF: replacementRef,
      }, productionRegistryPinError, deploymentClass);
    });
  }
}

for (const appEnvironment of ["preview", "staging", "production"]) {
  for (const invalidProductionRef of ["INVALID_REF", "short", "a".repeat(41)]) {
    test(`rejects ${appEnvironment} with malformed Production registry ${invalidProductionRef}`, () => {
      assertHostedNegative(appEnvironment, {
        PRODUCTION_SUPABASE_PROJECT_REF: invalidProductionRef,
      }, productionRegistryPinError);
    });
  }

  const ref = fixtureRefs[appEnvironment];
  for (const [description, url, expectedError] of [
    ["a different project", "https://differentendpoint001.supabase.co", /must match NEXT_PUBLIC_SUPABASE_URL|exact HTTPS project endpoint/],
    ["an extra hostname label", `https://${ref}.extra.supabase.co`, /exact HTTPS project endpoint/],
    ["an extra leading hostname label", `https://extra.${ref}.supabase.co`, /exact HTTPS project endpoint/],
    ["a missing hostname label", "https://supabase.co", /exact HTTPS project endpoint/],
    ["a malformed hostname", "https://.supabase.co", /exact HTTPS project endpoint/],
    ["an unrelated hostname", `https://${ref}.supabase.co.example.invalid`, /exact HTTPS project endpoint/],
    ["HTTP", `http://${ref}.supabase.co`, /exact HTTPS project endpoint/],
    ["an unexpected port", `https://${ref}.supabase.co:8443`, /exact HTTPS project endpoint/],
    ["an explicit default port", `https://${ref}.supabase.co:443`, /exact HTTPS project endpoint/],
    ["credentials", `https://user:password@${ref}.supabase.co`, /without credentials|exact HTTPS project endpoint/],
    ["a path", `https://${ref}.supabase.co/rest/v1`, /without credentials, path, query, or fragment|exact HTTPS project endpoint/],
    ["a query", `https://${ref}.supabase.co?project=synthetic`, /without credentials, path, query, or fragment|exact HTTPS project endpoint/],
    ["a fragment", `https://${ref}.supabase.co#synthetic`, /without credentials, path, query, or fragment|exact HTTPS project endpoint/],
    ["a trailing slash", `https://${ref}.supabase.co/`, /exact HTTPS project endpoint/],
    ["an uppercase hostname", `https://${ref.toUpperCase()}.supabase.co`, /exact HTTPS project endpoint/],
    ["a backslash-normalized URL", `https://${ref}.supabase.co\\`, /exact HTTPS project endpoint/],
    ["a non-URL value", "not-an-endpoint", /valid absolute URL|exact HTTPS project endpoint/],
  ]) {
    test(`rejects ${appEnvironment} Supabase endpoint with ${description}`, () => {
      assertHostedNegative(appEnvironment, { NEXT_PUBLIC_SUPABASE_URL: url }, expectedError);
    });
  }

  test(`rejects ${appEnvironment} without the active project identity`, () => {
    assertHostedNegative(appEnvironment, { SUPABASE_PROJECT_REF: undefined },
      /SUPABASE_PROJECT_REF is required/);
  });

  for (const name of ["PRODUCTION_SUPABASE_PROJECT_REF", "PRODUCTION_APP_ORIGIN"]) {
    test(`rejects ${appEnvironment} with a partial Production registry missing ${name}`, () => {
      assertHostedNegative(appEnvironment, { [name]: undefined }, new RegExp(`${name} is required`));
    });
  }
}

for (const [description, overrides, expectedError] of [
  ["a mismatched provider target", { VERCEL_ENV: "production" }, /VERCEL_ENV contradicts/],
  ["a mismatched target environment", { VERCEL_TARGET_ENV: "production" }, /VERCEL_TARGET_ENV contradicts/],
  ["a mismatched deployment class", { DEPLOYMENT_CLASS: "STAGING" }, /DEPLOYMENT_CLASS contradicts/],
  ["an unknown deployment class", { DEPLOYMENT_CLASS: "UNREVIEWED" }, /DEPLOYMENT_CLASS contradicts/],
  ["a missing reauthentication secret", { AUTH_REAUTH_PROOF_SECRET: undefined }, /AUTH_REAUTH_PROOF_SECRET is required/],
  ["a missing closure secret", { ACCOUNT_CLOSURE_CAPABILITY_SECRET: undefined }, /ACCOUNT_CLOSURE_CAPABILITY_SECRET is required/],
  ["a short reauthentication secret", { AUTH_REAUTH_PROOF_SECRET: "short" }, /AUTH_REAUTH_PROOF_SECRET must contain at least 32 bytes/],
  ["a short closure secret", { ACCOUNT_CLOSURE_CAPABILITY_SECRET: "short" }, /ACCOUNT_CLOSURE_CAPABILITY_SECRET must contain at least 32 bytes/],
  ["reused server secrets", { AUTH_REAUTH_PROOF_SECRET: "synthetic-hosted-closure-secret-material-0000000000" }, /E3 and E5 application secrets must be distinct/],
  ["a public secret key", { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic_only" }, /must not contain a secret or service-role key/],
  ["an untrusted Git provider", { VERCEL_GIT_PROVIDER: "untrusted" }, /must identify Papi299\/nutrition-tracker-app/],
  ["an incorrect repository owner", { VERCEL_GIT_REPO_OWNER: "unrelated-owner" }, /must identify Papi299\/nutrition-tracker-app/],
  ["a non-hex commit", { VERCEL_GIT_COMMIT_SHA: "g".repeat(40) }, /must bind the deployment to an exact Git commit/],
  ["a short commit", { VERCEL_GIT_COMMIT_SHA: "a".repeat(39) }, /must bind the deployment to an exact Git commit/],
]) {
  test(`rejects Preview with ${description}`, () => {
    assertHostedNegative("preview", overrides, expectedError);
  });
}

for (const secretName of ["AUTH_REAUTH_PROOF_SECRET", "ACCOUNT_CLOSURE_CAPABILITY_SECRET"]) {
  test(`rejects local public configuration reusing ${secretName}`, () => {
    const environment = localEnvironment();
    const valid = validateDeploymentEnvironment(environment);
    assert.equal(valid.ok, true, valid.errors.join("\n"));
    const result = validateDeploymentEnvironment({
      ...environment,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment[secretName],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not reuse a server-only application secret.",
    ]);
  });

  for (const [appEnvironment, deploymentClass] of [
    ["preview", "PREVIEW"],
    ["production", "PRODUCTION_BOOTSTRAP_ONLY"],
    ["production", "PRODUCTION_RELEASE"],
  ]) {
    test(`rejects ${deploymentClass} public configuration reusing ${secretName}`, () => {
      const environment = hostedEnvironment(appEnvironment, { DEPLOYMENT_CLASS: deploymentClass });
      const result = assertHostedNegative(appEnvironment, {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment[secretName],
      }, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not reuse a server-only application secret/, deploymentClass);
      assert.equal(result.errors.length, 1);
    });
  }
}

for (const includeBranchAssertion of [false, true]) {
  test(`rejects a coherent but unverified stable Preview alias${includeBranchAssertion ? " even with a matching branch assertion" : ""}`, () => {
    const stableOrigin = "https://stable-preview-synthetic.vercel.app";
    assertHostedNegative("preview", {
      APP_ORIGIN: stableOrigin,
      PREVIEW_APP_ORIGIN: stableOrigin,
      ...(includeBranchAssertion ? { VERCEL_BRANCH_URL: hostname(stableOrigin) } : {}),
    }, /contradicts trusted provider assertion VERCEL_URL/);
  });
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

test("accepts a private device-test origin with a loopback-only local backend", () => {
  const result = validateDeploymentEnvironment(deviceTestEnvironment());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.appOrigin, "https://nutrition-j3.example-tailnet.ts.net");
  assert.equal(result.supabaseEnvironment, "local");
  assert.equal(result.supabaseProjectRef, "local");
  assert.equal(result.appEnvironment, "device-test");
  assert.equal(
    validateDeploymentEnvironment(deviceTestEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "http://[::1]:54321",
    })).ok,
    true,
  );
  assert.equal(
    validateDeploymentEnvironment(deviceTestEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    })).ok,
    true,
  );
});

for (const [name, overrides] of Object.entries({
  "HTTP app origin": { APP_ORIGIN: "http://nutrition-j3.example-tailnet.ts.net" },
  "loopback app origin": { APP_ORIGIN: "https://localhost" },
  "public app origin": { APP_ORIGIN: "https://nutrition.example.com" },
  "incomplete tailnet hostname": { APP_ORIGIN: "https://example-tailnet.ts.net" },
  "nonstandard app port": { APP_ORIGIN: "https://nutrition-j3.example-tailnet.ts.net:8443" },
  "malformed app origin": { APP_ORIGIN: "not-an-origin" },
  "credential-bearing app origin": {
    APP_ORIGIN: "https://user:pass@nutrition-j3.example-tailnet.ts.net",
  },
  "app origin path": { APP_ORIGIN: "https://nutrition-j3.example-tailnet.ts.net/path" },
  "app origin query": { APP_ORIGIN: "https://nutrition-j3.example-tailnet.ts.net/?x=1" },
  "app origin fragment": { APP_ORIGIN: "https://nutrition-j3.example-tailnet.ts.net/#x" },
  "Production Supabase URL": {
    NEXT_PUBLIC_SUPABASE_URL: "https://hskfanrqwtqknzpquwhg.supabase.co",
  },
  "other hosted Supabase URL": {
    NEXT_PUBLIC_SUPABASE_URL: "https://syntheticpreview001.supabase.co",
  },
  "LAN Supabase URL": { NEXT_PUBLIC_SUPABASE_URL: "http://192.168.1.4:54321" },
  "tailnet Supabase URL": { NEXT_PUBLIC_SUPABASE_URL: "http://100.64.0.4:54321" },
  "tailnet hostname Supabase URL": {
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example-tailnet.ts.net",
  },
  "non-local project ref": { SUPABASE_PROJECT_REF: "syntheticpreview001" },
  "hosted Supabase class": { SUPABASE_ENVIRONMENT: "preview" },
  "Vercel environment": { VERCEL_ENV: "preview" },
  "Vercel Production environment": { VERCEL_ENV: "production" },
  "Vercel target environment": { VERCEL_TARGET_ENV: "production" },
  "Vercel deployment metadata": { VERCEL_REGION: "iad1" },
  "Production registry identity": {
    PRODUCTION_SUPABASE_PROJECT_REF: "hskfanrqwtqknzpquwhg",
  },
  "Production origin registry": {
    PRODUCTION_APP_ORIGIN: "https://nutrition.example.com",
  },
  "deployment class": { DEPLOYMENT_CLASS: "PREVIEW" },
  "insecure cookie mode": { NODE_ENV: "development" },
})) {
  test(`rejects device-test with ${name}`, () => {
    const result = validateDeploymentEnvironment(deviceTestEnvironment(overrides));
    assert.equal(result.ok, false, name);
  });
}

test("header-like process values cannot redefine the device-test canonical origin", () => {
  const result = validateDeploymentEnvironment(deviceTestEnvironment({
    HOST: "attacker.example",
    HTTP_HOST: "attacker.example",
    HTTP_ORIGIN: "https://attacker.example",
    HTTP_X_FORWARDED_HOST: "attacker.example",
  }));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.appOrigin, "https://nutrition-j3.example-tailnet.ts.net");
});

test("current client components have no direct Supabase runtime import", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
    }
  }
  for (const directory of ["app", "components", "lib"]) visit(join(root, directory));
  for (const path of files) {
    const relativePath = relative(root, path);
    const source = readFileSync(path, "utf8");
    if (!["lib/supabase/client.ts", "lib/supabase/index.ts"].includes(relativePath)) {
      assert.doesNotMatch(source, /\bcreateBrowserClient\b/, relativePath);
    }
    if (!/^\s*["']use client["'];/m.test(source)) continue;
    for (const statement of source.match(/import\s+[^;]+;/g) ?? []) {
      if (/^import\s+type\b/.test(statement)) continue;
      assert.doesNotMatch(
        statement,
        /from\s+["'](?:@supabase\/|@\/lib\/supabase(?:\/|["']))/,
        relativePath,
      );
    }
  }
});

test("activates the DEC-035 personal-use free-tier profile", () => {
  assert.equal(phase11hContract.activeReleaseProfile, "PERSONAL_USE_FREE_TIER");
  const profile = phase11hContract.releaseProfiles.PERSONAL_USE_FREE_TIER;
  assert.deepEqual(profile.authoritativeFullStackNonProductionEnvironments, [
    "local",
    "test",
  ]);
  assert.deepEqual(profile.requiredHostedApplicationTargets, ["production"]);
  assert.deepEqual(profile.requiredHostedSupabaseEnvironments, ["production"]);
  assert.deepEqual(profile.requiredPaidProviderEntitlements, []);
  assert.equal(profile.providerPurchaseAuthorized, false);
  assert.deepEqual(profile.hostedTopology, {
    productionApplication: { provider: "Vercel", plan: "Hobby" },
    productionDatabaseAuth: {
      provider: "Supabase",
      plan: "Free",
      projectRef: "hskfanrqwtqknzpquwhg",
    },
  });
  assert.deepEqual(profile.protectedUnrelatedProjects, [
    {
      provider: "Supabase",
      projectRef: "lioxtgiputfniqbktcsz",
      projectName: "academic-papers-index",
      nutritionTrackerUseAllowed: false,
      mutationAuthorized: false,
    },
  ]);
});

test("retains DEC-026 staging as an inactive coherent capability", () => {
  const profile = phase11hContract.releaseProfiles.FULL_MULTI_ENVIRONMENT;
  assert.equal(profile.decision, "DEC-026");
  assert.equal(profile.status, "HISTORICAL_INACTIVE_CAPABILITY");
  assert.deepEqual(profile.requiredHostedApplicationTargets, [
    "preview",
    "staging",
    "production",
  ]);
  assert.equal(validateDeploymentEnvironment(hostedEnvironment("staging")).ok, true);
});

test("personal-use Production release requires only the Production registry identity", () => {
  assert.deepEqual(registryLifecycleForDeployment("PRODUCTION_RELEASE"), {
    requiredRegistryEnvironments: ["production"],
    optionalRegistryEnvironments: ["preview", "staging"],
  });
  const environment = hostedEnvironment("production", {
    DEPLOYMENT_CLASS: "PRODUCTION_RELEASE",
  });
  for (const name of [
    "PREVIEW_SUPABASE_PROJECT_REF",
    "STAGING_SUPABASE_PROJECT_REF",
    "PREVIEW_APP_ORIGIN",
    "STAGING_APP_ORIGIN",
  ]) {
    assert.equal(name in environment, false, `${name} must not be required by DEC-035`);
  }
  assert.equal(validateDeploymentEnvironment(environment).ok, true);
});

for (const appEnvironment of ["local", "test"]) {
  test(`rejects ${appEnvironment} configured with the Production Supabase identity`, () => {
    const result = validateDeploymentEnvironment(
      localEnvironment({
        APP_ENVIRONMENT: appEnvironment,
        NODE_ENV: appEnvironment === "test" ? "test" : "development",
        NEXT_PUBLIC_SUPABASE_URL: `https://${fixtureRefs.production}.supabase.co`,
        PRODUCTION_SUPABASE_PROJECT_REF: fixtureRefs.production,
        SUPABASE_ENVIRONMENT: "production",
        SUPABASE_PROJECT_REF: fixtureRefs.production,
      }),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /loopback-only|must be local|contradicts/);
  });
}

test("accepts Preview with Preview and Production registry identities but no staging identity", () => {
  const environment = hostedEnvironment("preview");
  assert.equal("STAGING_SUPABASE_PROJECT_REF" in environment, false);
  assert.equal("STAGING_APP_ORIGIN" in environment, false);
  assert.equal(validateDeploymentEnvironment(environment).ok, true);
});

test("accepts staging with staging and Production registry identities but no Preview identity", () => {
  const environment = hostedEnvironment("staging");
  assert.equal("PREVIEW_SUPABASE_PROJECT_REF" in environment, false);
  assert.equal("PREVIEW_APP_ORIGIN" in environment, false);
  assert.equal(validateDeploymentEnvironment(environment).ok, true);
});

test("accepts Production bootstrap with only the real Production registry identity", () => {
  const environment = hostedEnvironment("production");
  for (const name of [
    "PREVIEW_SUPABASE_PROJECT_REF",
    "STAGING_SUPABASE_PROJECT_REF",
    "PREVIEW_APP_ORIGIN",
    "STAGING_APP_ORIGIN",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
  ]) {
    assert.equal(name in environment, false, `${name} must not be a bootstrap prerequisite`);
  }
  assert.equal(validateDeploymentEnvironment(environment).ok, true);
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
      NEXT_PUBLIC_SUPABASE_URL: `https://${fixtureRefs.production}.supabase.co`,
      SUPABASE_PROJECT_REF: fixtureRefs.production,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must not target the Production Supabase project/);
});

test("rejects staging configured against the Production project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("staging", {
      NEXT_PUBLIC_SUPABASE_URL: `https://${fixtureRefs.production}.supabase.co`,
      SUPABASE_PROJECT_REF: fixtureRefs.production,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must not target the Production Supabase project/);
});

test("rejects Production configured against a non-production project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      NEXT_PUBLIC_SUPABASE_URL: `https://${fixtureRefs.preview}.supabase.co`,
      SUPABASE_PROJECT_REF: fixtureRefs.preview,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Production must target the declared Production/);
});

test("rejects a Production current project that differs from its Production registry entry", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      NEXT_PUBLIC_SUPABASE_URL: "https://differentproduction001.supabase.co",
      SUPABASE_PROJECT_REF: "differentproduction001",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Production must target the declared Production/);
});

test("rejects a Production Supabase URL and current project-ref mismatch", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      NEXT_PUBLIC_SUPABASE_URL: "https://differentproduction001.supabase.co",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must match NEXT_PUBLIC_SUPABASE_URL/);
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

test("rejects a Production bootstrap origin that differs from its Production registry entry", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      APP_ORIGIN: "https://different-production-synthetic.vercel.app",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must match its declared origin-registry entry/);
});

test("rejects a Production bootstrap origin that differs from the provider Production origin", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      VERCEL_PROJECT_PRODUCTION_URL: "different-production-synthetic.vercel.app",
    }),
  );
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /contradicts trusted provider assertion VERCEL_PROJECT_PRODUCTION_URL/,
  );
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

for (const [name, optionalRegistry] of [
  ["Preview", "preview"],
  ["staging", "staging"],
]) {
  test(`rejects optional ${name} project identity equal to Production`, () => {
    const result = validateDeploymentEnvironment(
      hostedEnvironment("production", {
        [`${optionalRegistry.toUpperCase()}_SUPABASE_PROJECT_REF`]: fixtureRefs.production,
        [`${optionalRegistry.toUpperCase()}_APP_ORIGIN`]: syntheticOrigins[optionalRegistry],
      }),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /supplied hosted Supabase project references/);
  });
}

test("rejects duplicate optional non-Production project identities", () => {
  const duplicateRef = "syntheticoptional001";
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      PREVIEW_SUPABASE_PROJECT_REF: duplicateRef,
      PREVIEW_APP_ORIGIN: syntheticOrigins.preview,
      STAGING_SUPABASE_PROJECT_REF: duplicateRef,
      STAGING_APP_ORIGIN: syntheticOrigins.staging,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /supplied hosted Supabase project references/);
});

test("rejects duplicate optional non-Production origins", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      PREVIEW_SUPABASE_PROJECT_REF: fixtureRefs.preview,
      PREVIEW_APP_ORIGIN: syntheticOrigins.preview,
      STAGING_SUPABASE_PROJECT_REF: fixtureRefs.staging,
      STAGING_APP_ORIGIN: syntheticOrigins.preview,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /supplied hosted application origins/);
});

test("rejects an invalid optional project identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      PREVIEW_SUPABASE_PROJECT_REF: "INVALID_REF",
      PREVIEW_APP_ORIGIN: syntheticOrigins.preview,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PREVIEW_SUPABASE_PROJECT_REF must be/);
});

for (const [description, origin] of [
  ["an HTTP", "http://preview-commit-synthetic.vercel.app"],
  ["a loopback", "https://127.0.0.1"],
]) {
  test(`rejects ${description} optional hosted origin`, () => {
    const result = validateDeploymentEnvironment(
      hostedEnvironment("production", {
        PREVIEW_SUPABASE_PROJECT_REF: fixtureRefs.preview,
        PREVIEW_APP_ORIGIN: origin,
      }),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /PREVIEW_APP_ORIGIN must use HTTPS and a non-loopback host/);
  });
}

test("rejects a half-populated optional registry identity", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      PREVIEW_SUPABASE_PROJECT_REF: fixtureRefs.preview,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PREVIEW_APP_ORIGIN is required/);
});

test("accepts optional isolated Preview and staging identities on a personal-use Production release", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      DEPLOYMENT_CLASS: "PRODUCTION_RELEASE",
      PREVIEW_SUPABASE_PROJECT_REF: fixtureRefs.preview,
      PREVIEW_APP_ORIGIN: syntheticOrigins.preview,
      STAGING_SUPABASE_PROJECT_REF: fixtureRefs.staging,
      STAGING_APP_ORIGIN: syntheticOrigins.staging,
    }),
  );
  assert.equal(result.ok, true);
});

test("rejects a personal-use Production release with Preview bound to Production", () => {
  const result = validateDeploymentEnvironment(
    hostedEnvironment("production", {
      DEPLOYMENT_CLASS: "PRODUCTION_RELEASE",
      PREVIEW_SUPABASE_PROJECT_REF: fixtureRefs.production,
      PREVIEW_APP_ORIGIN: syntheticOrigins.preview,
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /hosted Supabase project references must be distinct/);
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

test("rejects evidence that does not identify the active release profile", () => {
  const packet = bootstrapEvidence();
  packet.releaseProfile = "FULL_MULTI_ENVIRONMENT";
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /active release profile/);
});

test("rejects evidence that treats hosted staging as required by the personal profile", () => {
  const packet = bootstrapEvidence();
  packet.profile.hostedStagingDisposition = "REQUIRED";
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /profile requirements/);
});

test("rejects bootstrap evidence that omits an optional registry disposition", () => {
  const packet = bootstrapEvidence();
  packet.environment.previewRegistryDisposition = null;
  const result = validateEvidencePacket(packet);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /optional preview registry identity/);
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

test("accepts separately authorized personal-use Production evidence without hosted Preview or staging", () => {
  const packet = bootstrapEvidence();
  packet.deploymentClass = "PRODUCTION_RELEASE";
  packet.productionReleaseAuthorized = true;
  packet.authorization.productionAuthorized = true;
  packet.authorization.productionAuthorizationReference =
    "synthetic-separate-production-release-authorization";
  packet.recovery.incidentOrRecoveryQualificationReference =
    "synthetic-current-phase-11i";
  assert.equal(validateEvidencePacket(packet).ok, true);
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

test("repository policy rejects weakening the Production release registry lifecycle", () => {
  const contract = clone(phase11hContract);
  contract.deploymentClasses.PRODUCTION_RELEASE.registryLifecycle = {
    requiredRegistryEnvironments: ["production"],
    optionalRegistryEnvironments: ["preview", "staging"],
  };
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PRODUCTION_RELEASE.*lifecycle-accurate/);
});

test("repository policy rejects requiring hosted staging in the active profile", () => {
  const contract = clone(phase11hContract);
  contract.releaseProfiles.PERSONAL_USE_FREE_TIER.requiredHostedApplicationTargets = [
    "staging",
    "production",
  ];
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PERSONAL_USE_FREE_TIER/);
});

test("repository policy rejects requiring paid provider entitlements", () => {
  const contract = clone(phase11hContract);
  contract.releaseProfiles.PERSONAL_USE_FREE_TIER.requiredPaidProviderEntitlements = [
    "Vercel Pro",
  ];
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /PERSONAL_USE_FREE_TIER/);
});

test("repository policy rejects a raw CLI or prebuilt Production bootstrap", () => {
  const contract = clone(phase11hContract);
  contract.productionBootstrapPolicy.sourceMethod.rawCliOrPrebuiltUploadAllowed = true;
  const result = validateDeploymentPolicy(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Git-sourced, exact-revision-bound/);
});
