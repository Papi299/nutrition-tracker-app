import assert from "node:assert/strict";
import test from "node:test";
import { validateDeploymentEnvironment } from "../lib/deployment/environment.mjs";

const syntheticRefs = {
  preview: "syntheticpreview001",
  staging: "syntheticstaging001",
  production: "syntheticproduction001",
};

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
  return {
    ACCOUNT_CLOSURE_CAPABILITY_SECRET:
      "synthetic-hosted-closure-secret-material-0000000000",
    APP_ENVIRONMENT: appEnvironment,
    APP_ORIGIN: `https://${appEnvironment}.synthetic.invalid`,
    AUTH_REAUTH_PROOF_SECRET:
      "synthetic-hosted-reauth-secret-material-1111111111",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_only",
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NODE_ENV: "production",
    PREVIEW_SUPABASE_PROJECT_REF: syntheticRefs.preview,
    PRODUCTION_SUPABASE_PROJECT_REF: syntheticRefs.production,
    STAGING_SUPABASE_PROJECT_REF: syntheticRefs.staging,
    SUPABASE_ENVIRONMENT: appEnvironment,
    SUPABASE_PROJECT_REF: projectRef,
    VERCEL_ENV: production ? "production" : "preview",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_TARGET_ENV: appEnvironment,
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

test("accepts valid Preview, staging, and Production configurations", () => {
  for (const environment of ["preview", "staging", "production"]) {
    assert.equal(validateDeploymentEnvironment(hostedEnvironment(environment)).ok, true);
  }
});

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
