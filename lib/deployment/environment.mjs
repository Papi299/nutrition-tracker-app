import contract from "../../deployment/phase-11h-contract.json" with {
  type: "json",
};

const appEnvironments = contract.applicationEnvironments;
const hostedEnvironments = new Set(["preview", "staging", "production"]);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const shaPattern = /^[0-9a-f]{40}$/;
const projectRefPattern = /^[a-z0-9]{8,40}$/;

function valueOf(environment, name) {
  const value = environment[name];
  return typeof value === "string" && value.trim() === value && value !== ""
    ? value
    : null;
}

function hasValue(environment, name) {
  return valueOf(environment, name) !== null;
}

function parseOrigin(value, name, errors) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      errors.push(`${name} must be an origin without credentials, path, query, or fragment.`);
      return null;
    }
    return url;
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
    return null;
  }
}

function publishableKeyIsForbidden(value) {
  if (/^(?:sb_secret_|service[_-]?role)/i.test(value)) return true;

  const segments = value.split(".");
  if (segments.length !== 3) return false;

  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export function validateDeploymentEnvironment(environment) {
  const errors = [];
  const appEnvironment = valueOf(environment, "APP_ENVIRONMENT");

  if (!appEnvironment || !(appEnvironment in appEnvironments)) {
    return {
      errors: [
        "APP_ENVIRONMENT must explicitly identify local, test, preview, staging, or production.",
      ],
      ok: false,
    };
  }

  const rule = appEnvironments[appEnvironment];
  const requiredNames = [
    "ACCOUNT_CLOSURE_CAPABILITY_SECRET",
    "APP_ORIGIN",
    "AUTH_REAUTH_PROOF_SECRET",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ENVIRONMENT",
    "SUPABASE_PROJECT_REF",
  ];

  if (hostedEnvironments.has(appEnvironment)) {
    requiredNames.push(
      "PREVIEW_SUPABASE_PROJECT_REF",
      "PRODUCTION_SUPABASE_PROJECT_REF",
      "STAGING_SUPABASE_PROJECT_REF",
      "VERCEL_ENV",
      "VERCEL_GIT_COMMIT_SHA",
      "VERCEL_TARGET_ENV",
    );
  }

  for (const name of requiredNames) {
    if (!hasValue(environment, name)) errors.push(`${name} is required for ${appEnvironment}.`);
  }

  if (errors.length > 0) return { errors, ok: false };

  const appOrigin = parseOrigin(valueOf(environment, "APP_ORIGIN"), "APP_ORIGIN", errors);
  const supabaseUrl = parseOrigin(
    valueOf(environment, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
    errors,
  );
  const supabaseEnvironment = valueOf(environment, "SUPABASE_ENVIRONMENT");
  const projectRef = valueOf(environment, "SUPABASE_PROJECT_REF");
  const previewProjectRef = valueOf(environment, "PREVIEW_SUPABASE_PROJECT_REF");
  const productionProjectRef = valueOf(environment, "PRODUCTION_SUPABASE_PROJECT_REF");
  const stagingProjectRef = valueOf(environment, "STAGING_SUPABASE_PROJECT_REF");
  const publishableKey = valueOf(environment, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const reauthenticationSecret = valueOf(environment, "AUTH_REAUTH_PROOF_SECRET");
  const closureSecret = valueOf(environment, "ACCOUNT_CLOSURE_CAPABILITY_SECRET");

  if (supabaseEnvironment !== rule.supabaseEnvironment) {
    errors.push(
      `SUPABASE_ENVIRONMENT must be ${rule.supabaseEnvironment} for ${appEnvironment}.`,
    );
  }

  if (publishableKeyIsForbidden(publishableKey)) {
    errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not contain a secret or service-role key.");
  }
  if (Buffer.byteLength(reauthenticationSecret, "utf8") < 32) {
    errors.push("AUTH_REAUTH_PROOF_SECRET must contain at least 32 bytes.");
  }
  if (Buffer.byteLength(closureSecret, "utf8") < 32) {
    errors.push("ACCOUNT_CLOSURE_CAPABILITY_SECRET must contain at least 32 bytes.");
  }
  if (reauthenticationSecret === closureSecret) {
    errors.push("The E3 and E5 application secrets must be distinct.");
  }

  if (hostedEnvironments.has(appEnvironment)) {
    if (appOrigin && (appOrigin.protocol !== "https:" || loopbackHosts.has(appOrigin.hostname))) {
      errors.push("Hosted APP_ORIGIN must use HTTPS and a non-loopback host.");
    }
    if (
      supabaseUrl &&
      (supabaseUrl.protocol !== "https:" ||
        !supabaseUrl.hostname.endsWith(".supabase.co") ||
        loopbackHosts.has(supabaseUrl.hostname))
    ) {
      errors.push("Hosted NEXT_PUBLIC_SUPABASE_URL must be an HTTPS project endpoint on supabase.co.");
    }
    if (
      !projectRefPattern.test(projectRef) ||
      !projectRefPattern.test(previewProjectRef) ||
      !projectRefPattern.test(stagingProjectRef) ||
      !projectRefPattern.test(productionProjectRef)
    ) {
      errors.push("Hosted Supabase project references must be 8-40 lowercase letters or digits.");
    }
    if (new Set([previewProjectRef, stagingProjectRef, productionProjectRef]).size !== 3) {
      errors.push("Preview, staging, and Production Supabase project references must be distinct.");
    }
    if (supabaseUrl && projectRef !== supabaseUrl.hostname.split(".")[0]) {
      errors.push("SUPABASE_PROJECT_REF must match NEXT_PUBLIC_SUPABASE_URL.");
    }
    const expectedProjectRef = {
      preview: previewProjectRef,
      production: productionProjectRef,
      staging: stagingProjectRef,
    }[appEnvironment];
    if (projectRef !== expectedProjectRef) {
      errors.push(`${appEnvironment} must target its declared isolated Supabase project.`);
    }
    if (
      rule.productionProjectRelationship === "must-differ" &&
      projectRef === productionProjectRef
    ) {
      errors.push(`${appEnvironment} must not target the Production Supabase project.`);
    }
    if (
      rule.productionProjectRelationship === "must-match" &&
      projectRef !== productionProjectRef
    ) {
      errors.push("Production must target the declared Production Supabase project.");
    }
    if (valueOf(environment, "VERCEL_ENV") !== rule.vercelEnvironment) {
      errors.push(`VERCEL_ENV contradicts APP_ENVIRONMENT=${appEnvironment}.`);
    }
    if (valueOf(environment, "VERCEL_TARGET_ENV") !== rule.vercelTargetEnvironment) {
      errors.push(`VERCEL_TARGET_ENV contradicts APP_ENVIRONMENT=${appEnvironment}.`);
    }
    if (!shaPattern.test(valueOf(environment, "VERCEL_GIT_COMMIT_SHA"))) {
      errors.push("VERCEL_GIT_COMMIT_SHA must bind the deployment to an exact Git commit.");
    }
    if (environment.NODE_ENV && environment.NODE_ENV !== "production") {
      errors.push("Hosted deployments require NODE_ENV=production.");
    }
  } else {
    if (appOrigin && !loopbackHosts.has(appOrigin.hostname)) {
      errors.push("Local/test APP_ORIGIN must be loopback-only.");
    }
    if (supabaseUrl && !loopbackHosts.has(supabaseUrl.hostname)) {
      errors.push("Local/test NEXT_PUBLIC_SUPABASE_URL must be loopback-only.");
    }
    if (projectRef !== "local") {
      errors.push("Local/test SUPABASE_PROJECT_REF must be local.");
    }
    for (const name of [
      "PRODUCTION_SUPABASE_PROJECT_REF",
      "PREVIEW_SUPABASE_PROJECT_REF",
      "STAGING_SUPABASE_PROJECT_REF",
      "VERCEL_ENV",
      "VERCEL_GIT_COMMIT_SHA",
      "VERCEL_TARGET_ENV",
    ]) {
      if (hasValue(environment, name)) {
        errors.push(`${name} contradicts APP_ENVIRONMENT=${appEnvironment}.`);
      }
    }
    if (appEnvironment === "test" && environment.NODE_ENV && environment.NODE_ENV !== "test") {
      errors.push("APP_ENVIRONMENT=test requires NODE_ENV=test when NODE_ENV is supplied.");
    }
  }

  return {
    appEnvironment,
    errors,
    ok: errors.length === 0,
    supabaseEnvironment,
    supabaseProjectRef: projectRef,
  };
}

export function assertDeploymentEnvironment(environment) {
  const result = validateDeploymentEnvironment(environment);
  if (!result.ok) {
    throw new Error(`Phase 11H environment contract failed:\n${result.errors.join("\n")}`);
  }
  return result;
}

export { contract as phase11hContract };
