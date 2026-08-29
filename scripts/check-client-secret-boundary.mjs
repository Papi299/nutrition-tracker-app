import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const authCanary = "phase11f-auth-proof-browser-boundary-canary-20260829";
const closureCanary = "phase11f-account-closure-browser-boundary-canary-20260829";
const canaries = [authCanary, closureCanary];
const sensitiveEnvironmentNames = [
  "AUTH_REAUTH_PROOF_SECRET",
  "ACCOUNT_CLOSURE_CAPABILITY_SECRET",
];
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx"]);
const publicPayloadExtensions = new Set([
  ".body",
  ".html",
  ".rsc",
  ".txt",
]);

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

function verifySourceBoundary(root) {
  const sourceRoots = ["app", "components", "lib"].map((path) => join(root, path));
  const violations = [];

  for (const file of sourceRoots.flatMap(filesUnder)) {
    if (!sourceExtensions.has(extname(file))) continue;
    const source = readFileSync(file, "utf8");

    if (/NEXT_PUBLIC_(?:AUTH_REAUTH_PROOF_SECRET|ACCOUNT_CLOSURE_CAPABILITY_SECRET)/.test(source)) {
      violations.push(`${relative(root, file)} assigns a server secret a public prefix`);
    }

    if (/^\s*["']use client["'];/m.test(source)) {
      for (const name of sensitiveEnvironmentNames) {
        if (source.includes(name)) {
          violations.push(`${relative(root, file)} references ${name} from a client module`);
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Source secret boundary violations:\n${violations.join("\n")}`);
  }
}

function publiclyDeliveredBuildFiles(root) {
  const staticRoot = join(root, ".next", "static");
  const serverRoots = [
    join(root, ".next", "server", "app"),
    join(root, ".next", "server", "pages"),
  ];
  const files = filesUnder(staticRoot);

  for (const file of serverRoots.flatMap(filesUnder)) {
    if (
      publicPayloadExtensions.has(extname(file)) ||
      file.includes("client-reference-manifest")
    ) {
      files.push(file);
    }
  }

  return files;
}

function verifyBuildBoundary(root) {
  const files = publiclyDeliveredBuildFiles(root);

  if (files.length === 0) {
    throw new Error("No browser/static production build artifacts were found to inspect.");
  }

  const leaks = [];

  for (const file of files) {
    const contents = readFileSync(file);
    if (canaries.some((canary) => contents.includes(Buffer.from(canary)))) {
      leaks.push(relative(root, file));
    }
  }

  if (leaks.length > 0) {
    throw new Error(`Server-only canary reached browser/static artifacts:\n${leaks.join("\n")}`);
  }

  console.log(
    `Client secret boundary PASSED: inspected ${files.length} browser/static build artifacts; server-only canaries were absent.`,
  );
}

function run() {
  const root = process.cwd();
  verifySourceBoundary(root);

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const buildArguments = ["run", "build"];

  if (process.argv.includes("--webpack")) {
    buildArguments.push("--", "--webpack");
  }

  const build = spawnSync(npm, buildArguments, {
    env: {
      ...process.env,
      ACCOUNT_CLOSURE_CAPABILITY_SECRET: closureCanary,
      APP_ORIGIN: "http://127.0.0.1:3100",
      AUTH_REAUTH_PROOF_SECRET: authCanary,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "phase11f-public-build-key",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    },
    stdio: "inherit",
  });

  if (build.error || build.status !== 0) {
    throw new Error("Production build failed during the client secret boundary regression.");
  }

  verifyBuildBoundary(root);
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Client secret boundary failed.");
  process.exitCode = 1;
}
