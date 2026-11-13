import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const workflowDirectory = ".github/workflows";
const reviewedPins = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["actions/upload-artifact", "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"],
  ["actions/download-artifact", "37930b1c2abaa49bbe596cd826c3c89aef350131"],
]);
const workflowExpectations = new Map([
  [
    "ci.yml",
    {
      timeout: 90, // Measured 70 minutes precede the remaining full engine/accessibility gate.
      node: 22,
      actions: new Map([
        ["actions/checkout", 8],
        ["actions/setup-node", 8],
        ["actions/upload-artifact", 8],
        ["actions/download-artifact", 1],
      ]),
    },
  ],
  [
    "phase-11i-production-backup.yml",
    {
      timeout: 20,
      node: 22,
      actions: new Map([
        ["actions/checkout", 1],
        ["actions/setup-node", 1],
        ["actions/upload-artifact", 1],
      ]),
    },
  ],
]);
const ciSteps = [
  "Check out repository",
  "Require main for manual dispatch",
  "Set up Node.js",
  "Install dependencies from lockfile",
  "Verify workflow supply-chain policy",
  "Enforce production dependency advisory policy",
  "Check repository hygiene",
  "Lint",
  "Type check",
  "Verify Phase 11H deployment and environment contract",
  "Verify Phase 11I recovery safety contract",
  "Verify security policy regressions",
  "Verify Phase 11 critical-journey evidence map",
  "Verify Phase 11G2 performance harness and evidence",
  "Run pure unit tests",
  "Build production application and verify client secret boundary",
  "Install Playwright Phase 11D engines",
  "Qualify isolated Full35 reprojection database",
  "Start local Supabase",
  "Verify hosted migration-role compatibility",
  "Replay migrations and seed locally",
  "Verify internal ingestion types",
  "Run local-only Playwright suite",
  "Run Phase 11D engine, viewport, and accessibility suite",
  "Verify Phase 11D evidence files",
  "Upload Phase 11D evidence",
  "Upload Playwright failure artifacts",
  "Stop local Supabase",
];

const reviewedAtomicDiaryJobs = `
  atomic_diary:
    name: Atomic diary persistence (\${{ matrix.order }})
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        order: [writer-first, diary-first]
    steps:
      - name: Check out exact atomic diary head
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 0
      - name: Set up atomic diary Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Qualify deterministic atomic serialization and compatibility
        env:
          FULL35_ATOMICITY_SCENARIO: \${{ matrix.order }}
          EXPECTED_HEAD: \${{ github.event.pull_request.head.sha || github.sha }}
        run: |
          test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
          npm ci
          sudo "$(command -v node)" scripts/configure-ci-apt.mjs
          npx playwright install --with-deps chromium
          npm run test:atomic-diary-local
          test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
      - name: Retain sanitized atomic diary evidence
        if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: atomic-diary-\${{ matrix.order }}-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: full35-app-evidence/
          if-no-files-found: error
          retention-days: 14

  atomic_diary_recovery:
    name: Atomic diary exact-history encrypted recovery
    runs-on: ubuntu-latest
    timeout-minutes: 85
    steps:
      - name: Check out exact atomic recovery head
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 0
      - name: Set up atomic recovery Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Qualify single-owner Full35 and encrypted recovery
        run: |
          npm ci
          node scripts/run-full35-recovery-local.mjs --scheduled-backup
      - name: Publish verified synthetic H56 ciphertext
        id: synthetic_h56
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: synthetic-h56-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: |
            \${{ runner.temp }}/full35-synthetic-pair/*.archive.cms
            \${{ runner.temp }}/full35-synthetic-pair/*.manifest.json
          if-no-files-found: error
          retention-days: 1
          compression-level: 0
      - name: Download the synthetic H56 artifact by ID
        uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7
        with:
          artifact-ids: \${{ steps.synthetic_h56.outputs.artifact-id }}
          path: \${{ runner.temp }}/full35-synthetic-readback
      - name: Verify downloaded synthetic H56 artifact
        run: node scripts/verify-full35-recovery-artifact-local.mjs --readback
      - name: Remove synthetic artifact staging
        if: always()
        run: rm -rf -- "$RUNNER_TEMP/full35-synthetic-pair" "$RUNNER_TEMP/full35-synthetic-readback"
      - name: Qualify encrypted migration 48 recovery and restored races
        run: npm run test:atomic-diary-recovery-local
      - name: Qualify encrypted migration 49 recovery and writer admission
        env:
          EXPECTED_HEAD: \${{ github.event.pull_request.head.sha || github.sha }}
        run: |
          test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
          npm run test:writer-barrier-recovery-local
      - name: Retain sanitized atomic recovery evidence
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: atomic-diary-recovery-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: |
            atomic-diary-recovery-evidence/
            writer-barrier-recovery-evidence/
            full35-owner-recovery-evidence/
          if-no-files-found: error
          retention-days: 14
`;

const reviewedAptCompatibilityJob = `
  apt_ubuntu26:
    name: Ubuntu 26.04 browser provisioning
    runs-on: ubuntu-26.04
    timeout-minutes: 20
    steps:
      - name: Check out compatibility probe
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - name: Set up compatibility Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
      - name: Verify Ubuntu 26.04 browser prerequisites
        run: |
          test "$(. /etc/os-release && echo "$VERSION_ID")" = 26.04
          npm ci
          node --test scripts/configure-ci-apt.test.mjs
          sudo "$(command -v node)" scripts/configure-ci-apt.mjs
          apt-config dump Acquire::Retries Acquire::http::Timeout Acquire::https::Timeout
          npx playwright install --with-deps chromium firefox webkit
          node --input-type=module - <<'NODE'
          import { chromium, firefox, webkit } from 'playwright';
          for (const engine of [chromium, firefox, webkit]) {
            const browser = await engine.launch();
            try {
              const page = await browser.newPage();
              await page.setContent('<title>APT compatibility probe</title>');
              if (await page.title() !== 'APT compatibility probe') throw new Error('Browser probe failed');
              console.log(\`\${engine.name()} launched: \${browser.version()}\`);
            } finally {
              await browser.close();
            }
          }
          NODE
          node --version
          docker version
          docker compose version
          npx supabase --version
`;

const reviewedActorIdentityJob = `
  actor_identity:
    name: Full35 durable actor identity
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - name: Check out actor qualification
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          fetch-depth: 0
      - name: Set up actor qualification Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Qualify isolated durable actor continuity
        run: |
          npm ci
          npm run test:full35-durable-actor-local
`;

const reviewedRecoveryAndCodeqlJobs = `
  full35_recovery:
    name: Full35 approved encrypted recovery
    runs-on: ubuntu-latest
    timeout-minutes: 50
    steps:
      - name: Check out recovery qualification
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          fetch-depth: 0
      - name: Set up recovery qualification Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Qualify approved encrypted migration 47 recovery
        run: |
          npm ci
          npm run test:full35-recovery-local
      - name: Retain sanitized approved recovery evidence
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: full35-approved-recovery-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: |
            full35-recovery-evidence/context.json
            full35-recovery-evidence/recovery-qualification.json
            full35-recovery-evidence/cleanup.json
          if-no-files-found: error
          retention-days: 14

  exact_head_codeql:
    name: Full35 exact-head CodeQL (\${{ matrix.language }})
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      fail-fast: false
      matrix:
        language: [actions, javascript-typescript, python]
    steps:
      - name: Check out exact CodeQL candidate
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 0
      - name: Set up CodeQL Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
      - name: Analyze exact head with pinned CodeQL CLI
        env:
          CODEQL_CANDIDATE_SHA: \${{ github.event.pull_request.head.sha || github.sha }}
          CODEQL_LANGUAGE: \${{ matrix.language }}
        run: node scripts/run-full35-exact-head-codeql.mjs "$CODEQL_LANGUAGE"
      - name: Retain exact-head CodeQL SARIF and provenance
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: full35-codeql-\${{ matrix.language }}-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: codeql-results/
          if-no-files-found: error
          retention-days: 14
`;

const reviewedApplicationJob = `
  full35_application:
    name: Full35 application qualification
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Check out exact application head
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 0
      - name: Set up application qualification Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 22
          cache: npm
      - name: Qualify isolated Full35 application behavior
        env:
          EXPECTED_HEAD: \${{ github.event.pull_request.head.sha || github.sha }}
          FULL35_APPROVED_SOURCE_ARCHIVE: \${{ runner.temp }}/full35-accepted-source.zip
        run: |
          test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
          npm ci
          sudo "$(command -v node)" scripts/configure-ci-apt.mjs
          npx playwright install --with-deps chromium
          curl --fail --location --retry 3 --max-time 60 --output "$FULL35_APPROVED_SOURCE_ARCHIVE" https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip
          node scripts/run-full35-app-local.mjs
          test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
      - name: Retain sanitized application qualification evidence
        if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: full35-application-\${{ github.run_id }}-\${{ github.run_attempt }}
          path: full35-app-evidence/
          if-no-files-found: error
          retention-days: 14
`;

function checkCiDispatchContract(workflow) {
  if (!workflow.endsWith(reviewedAtomicDiaryJobs)) fail("ci.yml must retain exact unconditional atomic diary and encrypted history gates");
  workflow = workflow.slice(0,-reviewedAtomicDiaryJobs.length);
  if (!workflow.endsWith(reviewedApplicationJob)) fail("ci.yml must retain the exact unconditional isolated application qualification and exact-head gate");
  workflow = workflow.slice(0, -reviewedApplicationJob.length);
  if (!workflow.endsWith(reviewedAptCompatibilityJob)) {
    fail("ci.yml must retain the exact bounded Ubuntu 26.04 browser-only compatibility probe");
  }
  workflow = workflow.slice(0, -reviewedAptCompatibilityJob.length);
  if (!workflow.endsWith(reviewedActorIdentityJob)) {
    fail("ci.yml must retain the exact unconditional bounded durable actor qualification job");
  }
  workflow = workflow.slice(0, -reviewedActorIdentityJob.length);
  if (!workflow.endsWith(reviewedRecoveryAndCodeqlJobs)) fail("ci.yml must retain exact unconditional encrypted recovery and exact-head CodeQL jobs");
  workflow = workflow.slice(0, -reviewedRecoveryAndCodeqlJobs.length);
  const triggerSection = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1];
  if (
    triggerSection !==
    "  pull_request:\n    branches: [main, codex/nutrition-usda-full35-reprojection-001, codex/nutrition-usda-full35-app-qual-001]\n  push:\n    branches: [main]\n  workflow_dispatch:\n\n"
  ) {
    fail("ci.yml must retain only main/Stage 4A PR, main push, and manual dispatch triggers");
  }
  if (
    !workflow.includes(
      "concurrency:\n  group: ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true",
    )
  ) {
    fail("ci.yml must retain the shared main concurrency boundary");
  }
  const jobHeader = workflow.match(/^jobs:\n  validate:\n([\s\S]*?)^    steps:/m)?.[1];
  if (
    jobHeader !== "    name: Validate\n    runs-on: ubuntu-latest\n    timeout-minutes: 90\n\n" ||
    (workflow.slice(workflow.indexOf("jobs:\n")).match(/^  [a-z][\w-]*:$/gm) ?? [])
      .map((line) => line.trim()).join() !== "validate:"
  ) {
    fail("ci.yml must retain one unconditional Validate job");
  }

  const matches = [...workflow.matchAll(/^      - name: (.+)$/gm)];
  const names = matches.map((match) => match[1]);
  if (JSON.stringify(names) !== JSON.stringify(ciSteps)) {
    fail("ci.yml must retain every reviewed Validate step in order");
  }
  const steps = new Map(
    matches.map((match, index) => [
      match[1],
      workflow.slice(match.index, matches[index + 1]?.index ?? workflow.length),
    ]),
  );
  const guard = steps.get("Require main for manual dispatch");
  if (
    !guard.includes("if: ${{ github.event_name == 'workflow_dispatch' }}") ||
    !guard.includes('if [ "$GITHUB_REF" != "refs/heads/main" ]; then') ||
    !guard.includes("exit 1")
  ) {
    fail("ci.yml manual dispatch must fail early outside refs/heads/main");
  }
  const checkout = steps.get("Check out repository");
  if (/^\s+ref:/m.test(checkout)) {
    fail("ci.yml checkout must use GitHub's workflow context SHA");
  }

  const hygiene = steps.get("Check repository hygiene");
  const hygieneLines = [
    "CI_EVENT_NAME: ${{ github.event_name }}",
    "CI_PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}",
    "CI_PUSH_BEFORE_SHA: ${{ github.event.before }}",
    "CI_HEAD_SHA: ${{ github.sha }}",
    'pull_request) base="$CI_PR_BASE_SHA" ;;',
    'push) base="$CI_PUSH_BEFORE_SHA" ;;',
    'workflow_dispatch) base="$CI_HEAD_SHA^" ;;',
    '[ -z "$base" ] || ! git rev-parse --verify --quiet "${base}^{commit}"',
    'git diff --check "$base..$CI_HEAD_SHA"',
  ];
  if (hygieneLines.some((line) => !hygiene.includes(line))) {
    fail("ci.yml repository hygiene must use resolvable event-specific bases");
  }
  if (!steps.get("Start local Supabase").includes("id: supabase")) {
    fail("ci.yml must identify local Supabase startup for safe teardown");
  }
  const recoveryStep = "      - name: Verify Phase 11I recovery safety contract\n" +
    "        timeout-minutes: 20\n        run: |\n" +
    "          npm run test:recovery-contract\n" +
    '          node scripts/qualify-phase-11i-populated-recovery.mjs "${RUNNER_TEMP}/phase11i-migration44.json"\n' +
    '          node scripts/qualify-phase-11i-populated-recovery.mjs "${RUNNER_TEMP}/phase11i-migration45.json" --nutrition-snapshots\n' +
    '          node scripts/qualify-phase-11i-populated-recovery.mjs "${RUNNER_TEMP}/phase11i-migration46.json" --serving-reference\n\n';
  if (steps.get("Verify Phase 11I recovery safety contract") !== recoveryStep) {
    fail("ci.yml must qualify encrypted recovery at all three reviewed migration boundaries");
  }
  const browserInstall =
    "      - name: Install Playwright Phase 11D engines\n" +
    "        run: |\n" +
    '          sudo "$(command -v node)" scripts/configure-ci-apt.mjs\n' +
    "          apt-config dump Acquire::Retries Acquire::http::Timeout Acquire::https::Timeout\n" +
    "          npx playwright install --with-deps chromium firefox webkit\n\n";
  if (steps.get("Install Playwright Phase 11D engines") !== browserInstall) {
    fail("ci.yml must retain the reviewed official Ubuntu archive and all browser engines/dependencies");
  }

  const full35Step = "      - name: Qualify isolated Full35 reprojection database\n" +
    "        run: npm run test:full35-reprojection-local\n\n";
  if (steps.get("Qualify isolated Full35 reprojection database") !== full35Step) {
    fail("ci.yml must retain the exact isolated Full35 database qualification");
  }

  const allowedConditions = new Map([
    ["Require main for manual dispatch", "if: ${{ github.event_name == 'workflow_dispatch' }}"],
    ["Verify Phase 11D evidence files", "if: ${{ always() && (steps.phase11d.outcome == 'success' || steps.phase11d.outcome == 'failure') }}"],
    ["Upload Phase 11D evidence", "if: ${{ always() && (steps.phase11d.outcome == 'success' || steps.phase11d.outcome == 'failure') }}"],
    ["Upload Playwright failure artifacts", "if: failure()"],
    ["Stop local Supabase", "if: ${{ always() && (steps.supabase.outcome == 'success' || steps.supabase.outcome == 'failure') }}"],
  ]);
  for (const [name, body] of steps) {
    const conditions = body.match(/^        if: .+$/gm) ?? [];
    const expected = allowedConditions.get(name);
    if (conditions.length !== (expected ? 1 : 0) || (expected && !conditions[0].includes(expected))) {
      fail(`ci.yml step ${name} has an unreviewed condition`);
    }
  }
}

function fail(message) {
  console.error(`Workflow security validation FAILED: ${message}`);
  process.exit(1);
}

const workflowFiles = readdirSync(workflowDirectory)
  .filter((name) => /\.ya?ml$/.test(name))
  .sort();
const expectedFiles = [...workflowExpectations.keys()].sort();
if (JSON.stringify(workflowFiles) !== JSON.stringify(expectedFiles)) {
  fail("workflow inventory contains an unreviewed or missing workflow");
}

for (const [workflowName, expectation] of workflowExpectations) {
  const workflow = readFileSync(join(workflowDirectory, workflowName), "utf8");
  const observedCounts = new Map();

  if (workflowName === "ci.yml") checkCiDispatchContract(workflow);

  if (!/^permissions:\n  contents: read$/m.test(workflow)) {
    fail(`${workflowName} top-level permissions must be exactly contents: read`);
  }
  if ((workflow.match(/^\s*permissions:/gm) ?? []).length !== 1) {
    fail(`${workflowName} must not add job- or step-level permission overrides`);
  }
  if (!new RegExp(`^    timeout-minutes: ${expectation.timeout}$`, "m").test(workflow)) {
    fail(`${workflowName} must retain its reviewed timeout`);
  }
  if (!new RegExp(`^          node-version: ${expectation.node}$`, "m").test(workflow)) {
    fail(`${workflowName} must retain Node.js ${expectation.node}`);
  }

  for (const [index, line] of workflow.split("\n").entries()) {
    if (!/^\s*uses:/.test(line)) continue;
    const match = line.match(
      /^\s*uses:\s*([^@\s]+)@([0-9a-f]{40})\s+#\s+(v\d+(?:\.\d+(?:\.\d+)?)?)\s*$/,
    );
    if (!match) {
      fail(`${workflowName} line ${index + 1} must use a full commit SHA and version comment`);
    }

    const [, action, sha, version] = match;
    const reviewed = reviewedPins.get(action);
    if (!reviewed) fail(`${workflowName} line ${index + 1} uses unreviewed action ${action}`);
    if (sha !== reviewed) {
      fail(`${workflowName} line ${index + 1} does not use the reviewed ${action} commit`);
    }
    if (version !== "v7") {
      fail(`${workflowName} line ${index + 1} must retain the reviewed v7 generation`);
    }
    observedCounts.set(action, (observedCounts.get(action) ?? 0) + 1);
  }

  for (const [action, expected] of expectation.actions) {
    if (observedCounts.get(action) !== expected) {
      fail(`${workflowName} must use ${action} exactly ${expected} time(s)`);
    }
  }
  for (const action of observedCounts.keys()) {
    if (!expectation.actions.has(action)) {
      fail(`${workflowName} contains unexpected action ${action}`);
    }
  }
}

console.log(
  "Workflow security validation PASSED: workflow inventory, least privilege, and reviewed immutable Action pins are exact.",
);
