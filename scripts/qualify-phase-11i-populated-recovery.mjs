import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { captureBackup } from "./phase-11i-backup-pipeline.mjs";
import { restoreBackup } from "./phase-11i-restore-pipeline.mjs";
import { validateCompletedOwnerActivation, validateOwnerDatabase } from "./phase-11i-owner-validation.mjs";
import { assertRedactedEvidence, RECOVERY_TARGET, sha256 } from "./phase-11i-recovery-contract.mjs";

import { assertPublicVerificationSummary } from "./phase-11i-public-verification.mjs";
import { verifyGitHubArtifact } from "./verify-phase-11i-github-artifact.mjs";

const SYNTHETIC_IDENTITY = "PHASE_11I_SYNTHETIC_POPULATED_FIXTURE";
const sourceProject = "phase-11i-synthetic-populated-fixture";
const targetProject = "phase-11i-recovery-isolated";
const repositoryRoot = resolve(".");
const cli = join(repositoryRoot, "node_modules/.bin/supabase");
const reportPath = process.argv[2];
if (!reportPath || !reportPath.startsWith("/")) throw new Error("An absolute redacted report path is required.");
if (existsSync(reportPath)) throw new Error("Refusing to overwrite a qualification report.");
const startedAt = new Date().toISOString();
const root = mkdtempSync(join(tmpdir(), "p11a010-synthetic-"));
chmodSync(root, 0o700);
let commandsPassed = 0;
const startedProjects = [];
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 20 * 60 * 1000, maxBuffer: 128 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    // SQL, credentials, and Auth responses must not escape into evidence or console logs.
    const primary = (result.stderr ?? "").split(/\r?\n/).find((line) => line.startsWith("ERROR:"));
    if (primary) process.stderr.write(primary.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,"[SYNTHETIC_ID]") + "\n");
    throw new Error(`Synthetic local command failed: ${command} ${args[0] ?? ""} (exit ${result.status}).`);
  }
  return result.stdout ?? "";
}
function supabaseAt(directory) { return (args) => run(cli, [...args, "--workdir", directory]); }
function dbAt(project) { return (sql) => run("docker", ["exec", "-i", `supabase_db_${project}`, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-qAt", "-F", "\t"], { input: sql }).trim(); }
function rowsAt(db) { return (sql) => { const output = db(sql); return output ? output.split(/\r?\n/).map((line) => line.split("\t")) : []; }; }
function prepare(project, offset) {
  const directory = join(root, project);
  mkdirSync(join(directory, "supabase"), { recursive: true, mode: 0o700 });
  cpSync("supabase/migrations", join(directory, "supabase/migrations"), { recursive: true });
  cpSync("supabase/seed.sql", join(directory, "supabase/seed.sql"));
  cpSync("supabase/templates", join(directory, "supabase/templates"), { recursive: true });
  const config = readFileSync("supabase/config.toml", "utf8")
    .replace(/^project_id = .*$/m, `project_id = "${project}"`)
    .replace(/\b543(\d{2})\b/g, (_, suffix) => String(54300 + Number(suffix) + offset));
  writeFileSync(join(directory, "supabase/config.toml"), config, { mode: 0o600 });
  return directory;
}
function assertSyntheticSource({ projectRef, sourceEnvironment }) {
  assert.equal(projectRef, SYNTHETIC_IDENTITY);
  assert.equal(sourceEnvironment, "LocalSynthetic");
}
function assertSyntheticArtifact(backupId) {
  assert.match(backupId, /^phase11i-PHASE_11I_SYNTHETIC_POPULATED_FIXTURE-\d{8}T\d{6}Z-[a-f0-9]{8}$/);
}
const negativeResults = {};
try {
  const existing = run("docker", ["ps", "-a", "--format", "{{.Names}}"]);
  for (const project of [sourceProject, targetProject]) {
    if (existing.split(/\r?\n/).some((name) => name.endsWith(`_${project}`))) {
      throw new Error("Reserved synthetic/recovery container already exists; refusing to reuse it.");
    }
  }
  const sourceDirectory = prepare(sourceProject, 100);
  const targetDirectory = prepare(targetProject, 200);
  const sourceCli = supabaseAt(sourceDirectory);
  const targetCli = supabaseAt(targetDirectory);
  const excludes = "realtime,studio,postgres-meta,edge-runtime,logflare,vector,supavisor";
  process.stdout.write("Starting fresh local synthetic source with all 44 migrations.\n");
  startedProjects.push(sourceProject);
  sourceCli(["start", "--exclude", excludes]);
  const sourceDb = dbAt(sourceProject);
  const sourceRows = rowsAt(sourceDb);
  const status = JSON.parse(sourceCli(["status", "-o", "json"]));
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const password = randomBytes(32).toString("hex");
  const created = await client.auth.admin.createUser({ email: "owner-backup-fixture@example.invalid", password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Synthetic local Auth creation failed.");
  const owner = created.data.user.id;
  assert.match(owner, /^[a-f0-9-]{36}$/);
  // Local privileged fixture metadata models an invited owner; normal password flow creates volatile state.
  sourceDb(`update auth.users set invited_at=now() where id='${owner}';`);
  const signed = await client.auth.signInWithPassword({ email: "owner-backup-fixture@example.invalid", password });
  if (signed.error || !signed.data.session) throw new Error("Synthetic local password session failed.");
  const claims = JSON.parse(Buffer.from(signed.data.session.access_token.split(".")[1], "base64url").toString());
  const authed = (sql) => sourceDb(`begin; set local role authenticated; select set_config('request.jwt.claims','${JSON.stringify(claims)}',true); ${sql}; commit;`);
  authed("select public.complete_invited_account_activation(true,true)");
  authed("select * from public.persist_setup('Synthetic recovery owner','he','2026-09-30',2100,100,null,0)");
  const foodResult = authed(`select food_id from public.create_custom_food('11000000-0000-4000-8000-000000000001','Synthetic fixture food',null,'he','per_100g',100,'g','[{"code":"energy_kcal","amount":120},{"code":"protein_g","amount":6},{"code":"fat_g","amount":0}]','[{"alias_text":"Synthetic fixture alias","language_code":"en"}]')`);
  const food = foodResult.split(/\r?\n/).find((line) => /^[a-f0-9-]{36}$/.test(line));
  if (!food) throw new Error("Synthetic custom-food helper did not return a food.");
  authed(`select * from public.create_manual_diary_entry('11000000-0000-4000-8000-000000000002','2026-09-30','lunch','${food}','Synthetic fixture food',null,100,'g',120,6,null,0,null)`);
  authed(`insert into public.food_favorites(user_id,food_id) values ('${owner}','${food}')`);
  authed(`select * from public.persist_saved_meal(null,'Synthetic fixture meal','he','[{"position":1,"brand_name":null,"notes":null,"food_id":"${food}","food_name":"Synthetic fixture food","serving_quantity":100,"serving_unit":"g","calories":120,"protein_g":6,"carbohydrates_g":null,"fat_g":0}]')`);
  // Synthetic shared catalog volume crosses the old total gates without copying a real dataset.
  sourceDb(`insert into public.foods(id,source_id,source_food_id,food_type,name,is_public,data_quality)
    select ('33000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
      (select id from public.food_sources where code='manual'),'synthetic-shared-'||n,'generic','Synthetic shared fixture '||n,true,'user_provided'
    from generate_series(1,354) n;
    insert into public.food_nutrients(food_id,nutrient_id,amount,basis)
    select f.id,n.id,0,'per_100g' from public.foods f cross join public.nutrients n
    where f.source_food_id like 'synthetic-shared-%' and n.code in ('energy_kcal','protein_g','carbohydrates_g','fat_g');`);
  sourceDb(`select vault.create_secret('${randomBytes(32).toString("hex")}','account_closure_capability_v1');`);
  const source = validateOwnerDatabase(sourceRows);
  assert.equal(source.authCounts.users, 1);
  assert.ok(source.authCounts.identities >= 1);
  assert.ok(source.authCounts.sessions > 0);
  assert.ok(source.authCounts.refreshTokens > 0);
  assert.ok(Number(sourceDb("select count(*) from public.foods")) > 353);
  assert.ok(Number(sourceDb("select count(*) from public.food_nutrients")) > 1199);
  commandsPassed += 7;
  // Each mutation lives in its own transaction and is rolled back even on rejection.
  function rejected(label, mutation, operation = validateOwnerDatabase) {
    const mutatedRows = (sql) => {
      const output = sourceDb(`begin; ${mutation}; ${sql}; rollback;`);
      return output ? output.split(/\r?\n/).map((line) => line.split("\t")) : [];
    };
    assert.throws(() => operation(mutatedRows));
    negativeResults[label] = "PASS";
  }
  const foreign = "22000000-0000-4000-8000-000000000001";
  rejected("additionalAuthUser", `insert into auth.users(id) values ('${foreign}')`);
  rejected("foreignIdentity", `set local session_replication_role=replica; update auth.identities set user_id='${foreign}'`);
  rejected("foreignApplicationOwner", `set local session_replication_role=replica; update public.nutrition_targets set user_id='${foreign}'`);
  rejected("orphanIndirectChild", `set local session_replication_role=replica; update public.saved_meal_items set saved_meal_id='${foreign}'`);
  rejected("foreignCustomFood", `set local session_replication_role=replica; update public.foods set owner_user_id='${foreign}' where id='${food}'`);
  rejected("missingReferenceCode", "set local session_replication_role=replica; delete from public.nutrients where code='protein_g'");
  for (const [label, mutation] of [
    ["missingCompletedActivation", "delete from public.account_activations"],
    ["wrongActivationVersion", "update public.account_activations set eligibility_statement_version='obsolete'"],
    ["foreignActivationOwner", `set local session_replication_role=replica; update public.account_activations set user_id='${foreign}'`],
  ]) rejected(label, mutation, validateCompletedOwnerActivation);
  const cert = join(root, "recipient.crt");
  const key = join(root, "recipient.key");
  run("openssl", ["req", "-x509", "-newkey", "rsa:3072", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=P11A010 Synthetic Fixture"]);
  chmodSync(key, 0o600);
  const fingerprint = run("openssl", ["x509", "-in", cert, "-noout", "-fingerprint", "-sha256"]).trim().split("=").at(-1).replaceAll(":", "").toLowerCase();
  const backupRoot = join(root, "encrypted");
  mkdirSync(backupRoot, { mode: 0o700 });
  const options = {
    sourceIdentity: { projectRef: SYNTHETIC_IDENTITY, sourceEnvironment: "LocalSynthetic" },
    assertSourceIdentity: assertSyntheticSource, assertArtifactIdentity: assertSyntheticArtifact,
    assertRecipient: (actual) => assert.equal(actual, fingerprint),
    backupRootInput: backupRoot, recipientInput: cert, operator: "CodexSyntheticFixture",
    privateKey: key, project: { id: SYNTHETIC_IDENTITY, region: "LOCAL_DOCKER", status: "ACTIVE_HEALTHY", database: { version: "LOCAL_SUPABASE" } },
    authConfig: {}, rows: sourceRows, psqlBinary: "psql",
    runSupabase: (args) => sourceCli(args[0] === "db" && args[1] === "dump" ? [...args, "--local"] : args),
  };
  for (const [label, mutation] of [
    ["migrationMismatch", "delete from supabase_migrations.schema_migrations where version='20260927170418'"],
    ["unexpectedStorage", "insert into storage.buckets(id,name) values ('synthetic-scope','synthetic-scope')"],
    ["missingRls", "alter table public.profiles disable row level security"],
    ["anonymousMutationGrant", "grant insert on public.profiles to anon"],
    ["unsafeDefinerSearchPath", "alter function public.complete_invited_account_activation(boolean,boolean) set search_path=public"],
  ]) {
    const mutatedRows = (sql) => {
      const output = sourceDb(`begin; ${mutation}; ${sql}; rollback;`);
      return output ? output.split(/\r?\n/).map((line) => line.split("\t")) : [];
    };
    await assert.rejects(captureBackup({ ...options, rows: mutatedRows }));
    negativeResults[label] = "PASS";
  }
  process.stdout.write("Capturing populated synthetic owner with temporary CMS recipient.\n");
  const capture = await captureBackup(options);
  assert.deepEqual(readdirSync(backupRoot).sort(), [capture.archivePath.split("/").at(-1), capture.manifestPath.split("/").at(-1)].sort());
  const manifestBytes = readFileSync(capture.manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assertPublicVerificationSummary(manifest.publicVerificationSummary);
  assert.deepEqual(manifest.publicVerificationSummary, {
    schemaVersion: "phase-11i-public-verification-summary/v1",
    migration: { count: 44, head: "20260927170418" }, storage: { buckets: 0, objects: 0 },
    ownerState: { profile: "PERSONAL_USE_ONE_NON_DELETED_OWNER", authUserCount: 1,
      accountActivationCount: 1, ownershipValidation: "PASS" }, sourceCaptureConsistency: "PASS",
  });
  const verifierOptions = { backupRootInput: backupRoot, runnerTempInput: root,
    workspaceInput: repositoryRoot, githubSha: manifest.sourceCommit,
    assertSourceIdentity: assertSyntheticSource, assertArtifactIdentity: assertSyntheticArtifact,
    assertRecipient: options.assertRecipient };
  const verifiedArtifact = verifyGitHubArtifact(verifierOptions);
  assert.equal(verifiedArtifact.encryptedArchiveSha256, manifest.encryptedArchiveSha256);
  assert.equal(verifiedArtifact.manifestSha256, sha256(manifestBytes));
  // Run the real artifact-pair verifier against malformed synthetic outer manifests.
  for (const [label, change] of [
    ["missingPublicSummary", (m) => { delete m.publicVerificationSummary; }],
    ["wrongPublicMigrationCount", (m) => { m.publicVerificationSummary.migration.count = 43; }],
    ["wrongPublicMigrationHead", (m) => { m.publicVerificationSummary.migration.head = "wrong"; }],
    ["publicStorageNonzero", (m) => { m.publicVerificationSummary.storage.objects = 1; }],
    ["wrongPublicOwnerProfile", (m) => { m.publicVerificationSummary.ownerState.profile = "BOOTSTRAP"; }],
    ["wrongPublicOwnerCount", (m) => { m.publicVerificationSummary.ownerState.authUserCount = 2; }],
    ["wrongPublicActivationCount", (m) => { m.publicVerificationSummary.ownerState.accountActivationCount = 0; }],
    ["failedPublicOwnership", (m) => { m.publicVerificationSummary.ownerState.ownershipValidation = "FAIL"; }],
    ["failedPublicConsistency", (m) => { m.publicVerificationSummary.sourceCaptureConsistency = "FAIL"; }],
    ["unexpectedPublicSummaryKey", (m) => { m.publicVerificationSummary.extra = "unexpected"; }],
    ["outerDetailedTableCounts", (m) => { m.tableCounts = {}; }],
    ["publicOwnerUuid", (m) => { m.publicVerificationSummary.ownerState.ownerUuid = "opaque-synthetic"; }],
    ["publicDiaryNutritionMetadata", (m) => { m.publicVerificationSummary.ownerState.nutritionTargets = {}; }],
  ]) {
    const changed = structuredClone(manifest); change(changed);
    writeFileSync(capture.manifestPath, JSON.stringify(changed), { mode: 0o600 });
    try { assert.throws(() => verifyGitHubArtifact(verifierOptions)); negativeResults[label] = "PASS"; }
    finally { writeFileSync(capture.manifestPath, manifestBytes, { mode: 0o600 }); }
  }
  // Environment switches cannot make the executable accept a synthetic source.
  const cliVerification = spawnSync(process.execPath, [join(repositoryRoot, "scripts/verify-phase-11i-github-artifact.mjs")], {
    encoding: "utf8", env: { ...process.env, PHASE11I_BACKUP_ROOT: backupRoot,
      RUNNER_TEMP: root, GITHUB_WORKSPACE: repositoryRoot, GITHUB_SHA: manifest.sourceCommit,
      ALLOW_NON_PRODUCTION_SOURCE: "1", SKIP_PROJECT_CHECK: "1" },
  });
  assert.notEqual(cliVerification.status, 0);
  negativeResults.productionArtifactCliRejectsSyntheticIdentity = "PASS";
  commandsPassed += 6;
  process.stdout.write("Starting fresh isolated target and replaying encrypted recovery.\n");
  startedProjects.push(targetProject);
  targetCli(["start", "--exclude", excludes]);
  // Shared restore reads config from the isolated project, never from the source worktree.
  process.chdir(targetDirectory);
  const restored = restoreBackup({ archiveInput: capture.archivePath, manifestInput: capture.manifestPath,
    recipientInput: cert, privateKeyInput: key, reportInput: join(root, "restore-report.json"),
    targetIdentity: RECOVERY_TARGET, assertSourceIdentity: assertSyntheticSource,
    assertArtifactIdentity: assertSyntheticArtifact, assertRecipient: options.assertRecipient,
    runSupabase: targetCli });
  // Restore the same valid v1 artifact after removing only the additive outer field.
  // This exercises historical compatibility without altering the encrypted archive.
  const historicalManifest = structuredClone(manifest);
  delete historicalManifest.publicVerificationSummary;
  writeFileSync(capture.manifestPath, JSON.stringify(historicalManifest), { mode: 0o600 });
  let historicalRestored;
  try {
    historicalRestored = restoreBackup({ archiveInput: capture.archivePath, manifestInput: capture.manifestPath,
      recipientInput: cert, privateKeyInput: key, reportInput: join(root, "historical-restore-report.json"),
      targetIdentity: RECOVERY_TARGET, assertSourceIdentity: assertSyntheticSource,
      assertArtifactIdentity: assertSyntheticArtifact, assertRecipient: options.assertRecipient,
      runSupabase: targetCli });
    assert.deepEqual(historicalRestored.restoreSafeCounts, restored.restoreSafeCounts);
    commandsPassed++;
  } finally { writeFileSync(capture.manifestPath, manifestBytes, { mode: 0o600 }); }
  process.chdir(repositoryRoot);
  const targetDb = dbAt(targetProject);
  // Compare full selected rows including timestamps, snapshots, references, and opaque IDs in memory.
  const semanticQueries = {
    activation: `select row_to_json(t)::text from public.account_activations t where user_id='${owner}'`,
    profile: `select row_to_json(t)::text from public.profiles t where id='${owner}'`,
    target: `select row_to_json(t)::text from public.nutrition_targets t where user_id='${owner}'`,
    diary: "select row_to_json(t)::text from public.diary_entries t",
    customFood: `select row_to_json(t)::text from public.foods t where id='${food}'`,
    customNutrients: `select row_to_json(t)::text from public.food_nutrients t where food_id='${food}' order by id`,
    customAlias: `select row_to_json(t)::text from public.food_aliases t where food_id='${food}' order by id`,
    completionReceipt: "select row_to_json(t)::text from public.custom_food_creation_requests t",
    favorite: "select row_to_json(t)::text from public.food_favorites t",
    savedMeal: "select row_to_json(t)::text from public.saved_meals t",
    savedMealItem: "select row_to_json(t)::text from public.saved_meal_items t",
    durableAuthUser: "select row_to_json(t)::text from auth.users t",
    durableAuthIdentity: "select row_to_json(t)::text from auth.identities t",
  };
  const semanticRecovery = {};
  for (const [label, sql] of Object.entries(semanticQueries)) {
    const before = sourceDb(sql);
    assert.ok(before.length > 0, `Missing semantic fixture: ${label}`);
    if (targetDb(sql) !== before) throw new Error(`Semantic recovery differs: ${label}`);
    semanticRecovery[label] = true;
    commandsPassed++;
  }
  assert.equal(restored.authComparison.restore.sessions, 0);
  assert.equal(restored.authComparison.restore.refreshTokens, 0);
  commandsPassed += 2;
  const report = { schemaVersion: "p11a010-populated-synthetic-qualification/v1", sourceIdentity: SYNTHETIC_IDENTITY,
    startedAt, completedAt: new Date().toISOString(), result: "PASS", sourceSafeCounts: capture.sourceSafeCounts.tableCounts,
    restoreSafeCounts: restored.restoreSafeCounts, authComparison: restored.authComparison,
    ownershipIntegrity: restored.ownershipIntegrity, migrationHistory: restored.migrationHistory,
    roleComparison: restored.roleComparison, schemaComparison: restored.schemaComparison,
    semanticRecovery, negativeResults, behavioralAssertionsPassed: commandsPassed,
    negativeCasesPassed: Object.keys(negativeResults).length,
    publicVerificationSummary: manifest.publicVerificationSummary,
    publicManifestContainsDetailedCounts: false, githubArtifactVerification: "PASS",
    historicalManifestWithoutSummaryRestored: true,
    dumpTools: manifest.dumpTools,
    testedToolingSha256: Object.fromEntries([
      "phase-11i-recovery-contract.mjs", "phase-11i-backup-pipeline.mjs", "phase-11i-restore-pipeline.mjs",
      "phase-11i-owner-validation.mjs", "qualify-phase-11i-populated-recovery.mjs",
      "phase-11i-public-verification.mjs", "verify-phase-11i-github-artifact.mjs",
      "run-phase-11i-backup.mjs", "run-phase-11i-restore.mjs",
    ].map((name) => [name, sha256(readFileSync(join(repositoryRoot, "scripts", name)))])),
    storage: restored.storage, rlsComparison: restored.rlsComparison, grantComparison: restored.grantComparison,
    securityDefinerSearchPaths: restored.securityDefinerSearchPaths,
    encryption: manifest.encryption, encryptedArchiveSha256: manifest.encryptedArchiveSha256,
    plaintextArchiveSha256: manifest.plaintextArchiveSha256, contentManifestSha256: manifest.contentManifestSha256,
    archiveIntegrity: restored.archiveIntegrity, contentIntegrity: restored.contentIntegrity,
    postEncryptionDecryptVerification: manifest.postEncryptionDecryptVerification,
    plaintextTemporaryRemoved: true, durableDestinationCiphertextAndRedactedManifestOnly: true, syntheticPrivateKeyDestroyed: true,
    productionAccess: false, fixtureIdentifiersInEvidence: "OPAQUE_CATEGORY_LABELS_ONLY" };
  assertRedactedEvidence(report);
  // The report is only published after finally has destroyed keys, dumps and local stacks.
  writeFileSync(join(root, "safe-report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
} finally {
  process.chdir(repositoryRoot);
  let cleanupFailed = false;
  for (const project of startedProjects) {
    const result = spawnSync(cli, ["stop", "--project-id", project, "--no-backup"], { encoding: "utf8", timeout: 120000 });
    if (result.status !== 0) { cleanupFailed = true; process.stderr.write(`Local cleanup requires attention for ${project}.\n`); }
  }
  const safeReport = existsSync(join(root, "safe-report.json")) ? readFileSync(join(root, "safe-report.json")) : null;
  rmSync(root, { recursive: true, force: true });
  assert.equal(existsSync(root), false);
  if (cleanupFailed) throw new Error("Synthetic container cleanup failed; qualification report withheld.");
  if (safeReport) { writeFileSync(reportPath, safeReport, { mode: 0o600, flag: "wx" }); process.stdout.write("Synthetic encrypted populated recovery PASS; private key and plaintext removed.\n"); }
}
