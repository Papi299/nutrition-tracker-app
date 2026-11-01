import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { buildMappingPlan, fingerprintMappingPlan, type MappingScopeSnapshot, type MappingPlan } from "@/ingestion/usda/foundation/reprojection/contracts";
import { canonicalizeJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import { installSyntheticBaseline, fixtureId, fixtureHash, mappingId } from "./fixtures/foundation-full35-reprojection";
import { assertMigrationHistory, assertTrustedMigrationReplay, sha256 } from "../scripts/phase-11i-recovery-contract.mjs";

const operator = "full35_recovery_operator", approver = "full35_recovery_approver";
const password = "synthetic-full35-recovery-only";
const cli = resolve("node_modules/.bin/supabase");
const migrationInventory = JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-reprojection-001/migration-inventory.json", "utf8")).migrations;
const input = (value: unknown) => `'${canonicalizeJson(value as JsonValue).replaceAll("'", "''")}'::json`;
function database(container: string, sql: string, user = "supabase_admin") {
  if (!/^supabase_db_full35-recovery-(source|target)-[a-f0-9]{12}$/.test(container)) throw new Error("Fresh diagnostic local container required.");
  return execFileSync("docker", ["exec", "-e", `PGPASSWORD=${password}`, "-i", container, "psql",
    ...(user === "supabase_admin" ? [] : ["-h", "127.0.0.1"]), "-U", user, "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function command(executable: string, args: string[]) {
  const result = spawnSync(executable, args, { encoding: "utf8", timeout: 180_000, maxBuffer: 128 * 1024 * 1024 });
  // Raw dump SQL, private content and key material never enter logs or evidence.
  if (result.status !== 0) throw new Error(`Diagnostic ${executable} ${args[0]} failed (exit ${result.status}).`);
  return result.stdout.trim();
}

test("logical encrypted replay preserves receipts but cannot preserve their live actor OIDs", () => {
  const evidence = process.env.FULL35_EVIDENCE_DIR!;
  const { source, target, scratch, sourceDirectory } = JSON.parse(readFileSync(join(evidence, "diagnostic-input.json"), "utf8"));
  expect([scratch, evidence, sourceDirectory].every(p => p?.startsWith("/"))).toBe(true);
  expect(source).not.toBe(target);
  mkdirSync(scratch, { mode: 0o700 });
  const query = (sql: string, user?: string) => database(source, sql, user);
  const targetQuery = (sql: string, user?: string) => database(target, sql, user);
  const identitiesSql = `create role ${operator} login password '${password}'; create role ${approver} login password '${password}';
    grant ingestion_operator to ${operator}; grant ingestion_approver to ${approver};`;
  query(identitiesSql);
  // Normal unrelated target objects make equal numeric role OIDs non-portable.
  targetQuery("do $$ begin for i in 1..32 loop execute format('create role full35_recovery_padding_%s nologin',i); end loop; end $$;");
  targetQuery(identitiesSql);
  const roles = `select jsonb_agg(jsonb_build_object('name',rolname,'oid',oid::bigint,'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,
    'inherit',rolinherit,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'connection_limit',rolconnlimit,
    'operator',pg_has_role(oid,'ingestion_operator','member'),'approver',pg_has_role(oid,'ingestion_approver','member'),
    'reprojection_definer',pg_has_role(oid,'ingestion_reprojection_definer','member')) order by rolname)
    from pg_roles where rolname in ('${operator}','${approver}');`;
  const sourceRoles = JSON.parse(query(roles)), targetRoles = JSON.parse(targetQuery(roles));
  expect(sourceRoles.map(({ oid, ...attributes }: { oid: number }) => { void oid; return attributes; }))
    .toEqual(targetRoles.map(({ oid, ...attributes }: { oid: number }) => { void oid; return attributes; }));
  expect(sourceRoles.map((r: { oid: number }) => r.oid)).not.toEqual(targetRoles.map((r: { oid: number }) => r.oid));
  const fixture = installSyntheticBaseline(query);
  const migrationFiles = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
  expect(migrationFiles).toEqual(migrationInventory.map((m: { filename: string }) => m.filename));
  for (const migration of migrationInventory) expect(sha256(readFileSync(`supabase/migrations/${migration.filename}`))).toBe(migration.sha256);
  const ledgerSql = "select string_agg(version,',' order by version) from supabase_migrations.schema_migrations";
  expect(query(ledgerSql)).toBe(migrationInventory.map((m: { version: string }) => m.version).join(","));
  expect(targetQuery(ledgerSql)).toBe(query(ledgerSql));
  expect(() => assertMigrationHistory(migrationInventory.map((m: { version: string }) => m.version))).toThrow(/count mismatch/);
  // Keep the approved recovery boundary closed while this schema defect exists.
  expect(() => assertTrustedMigrationReplay(migrationFiles, { count: 47, head: "20261031104559" },
    (name: string) => readFileSync(`supabase/migrations/${name}`))).toThrow(/unsupported reviewed history/);
  const hashes = (sql: string) => createHash("sha256").update(query(sql)).digest("hex");
  const privateSql = `select jsonb_build_object(
    'diary',(select jsonb_agg(to_jsonb(t) order by id) from public.diary_entries t),
    'meals',(select jsonb_agg(to_jsonb(t) order by id) from public.saved_meal_items t),
    'recipes',(select jsonb_agg(to_jsonb(t) order by id) from public.recipe_ingredients t),
    'targets',(select jsonb_agg(to_jsonb(t) order by id) from public.nutrition_targets t),
    'receipts',(select jsonb_agg(to_jsonb(t) order by id) from public.manual_diary_entry_requests t));`;
  const privateHash = hashes(privateSql);
  const coreSql = "select to_jsonb(t)::text from public.food_nutrients t order by id;";
  const originalCore = query(coreSql);
  let originalReceipt: Record<string, unknown> | undefined;
  function plan(compensate: boolean) {
    return buildMappingPlan({ operation_kind: compensate ? "compensation" : "reprojection", dataset_id: fixture.datasetId, environment: "local",
      source_release_id: fixture.releaseId, mapping_version_id: mappingId,
      before_snapshot: JSON.parse(query("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->'before_snapshot';", operator)) as MappingScopeSnapshot,
      approval_requirements: { approver_oid: Number(query(`select oid from pg_roles where rolname='${approver}'`)),
        not_before: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString() },
      operator_oid: Number(query(`select oid from pg_roles where rolname='${operator}'`)), operator_login: operator,
      implementation: { database_contract_hash: query("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->>'database_contract_hash';", operator),
        commit: command("git", ["rev-parse", "HEAD"]), tree: command("git", ["rev-parse", "HEAD^{tree}"]),
        migrations: migrationInventory.map(({ filename, version, sha256 }: { filename: string; version: string; sha256: string }) => ({ filename, version, sha256 })),
        contract_versions: { parser: "usda-fdc-foundation-json/v1", importer: "usda-foundation-importer/v3", candidate: "foundation-normalized-candidate/v2",
          mapping: "usda-foundation-full35-direct-v2", projection: "foundation-lifecycle-projection/v2" } },
      qualification: { ...fixture.source, historical_allowance_fingerprint: "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",
        rejected: JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json", "utf8")).source_inspection.rejected_records,
        source_qualification_hash: fixtureHash("independent-synthetic-oracle") },
      recovery_requirements: { qualification_hash: fixtureHash("unqualified-local-recovery-diagnostic"), production_ready: false },
      rejected_receipt_id: compensate ? String(originalReceipt?.receipt_id) : null, records: fixture.records });
  }
  const operations: { kind: string; approval: string; retry: string; receipt: Record<string, unknown> }[] = [];
  function execute(body: MappingPlan, retry: string) {
    const kind = body.operation_kind;
    const id = query(`select ingestion.prepare_foundation_mapping_${kind}_v1(${input(body)},'${retry}');`, operator);
    const approval = query(`select ingestion.approve_foundation_mapping_${kind}_v1('${id}','${fingerprintMappingPlan(body)}',
      '${body.approval_requirements.expires_at}'::timestamptz,${input({ independent_review_hash: fixtureHash("recovery-diagnostic-review"),
        recovery_evidence_hash: body.recovery_requirements.qualification_hash, approval_reference: "synthetic-recovery-diagnostic" })});`, approver);
    const receipt = JSON.parse(query(`select ingestion.execute_foundation_mapping_${kind}_v1('${approval}','${retry}');`, operator));
    operations.push({ kind, approval, retry, receipt });
    return receipt;
  }
  const cert = join(scratch, "recipient.crt"), key = join(scratch, "recipient.key");
  command("openssl", ["req", "-x509", "-newkey", "rsa:3072", "-nodes", "-keyout", key, "-out", cert,
    "-days", "1", "-subj", "/CN=Full35 Synthetic Recovery Identity Diagnostic"]);
  chmodSync(key, 0o600);
  const outcomes: Record<string, unknown>[] = [];
  function checkpoint(label: string, expectedValues: number, expectedHead: number) {
    process.stdout.write(`Encrypted diagnostic checkpoint: ${label}.\n`);
    const content = join(scratch, "content"); mkdirSync(content, { mode: 0o700 });
    const authExclusions = query("select 'auth.'||tablename from pg_tables where schemaname='auth' and tablename not in ('users','identities','mfa_factors','webauthn_credentials') order by tablename").split("\n").join(",");
    for (const [filename, args] of [
      ["application-data.sql", ["--data-only", "--schema", "public,ingestion"]],
      ["roles.sql", ["--role-only"]],
      ["auth-durable-data.sql", ["--data-only", "--schema", "auth", "--exclude", authExclusions]],
    ] as const) command(cli, ["db", "dump", "--local", ...args, "--file", join(content, filename), "--workdir", sourceDirectory]);
    const roleDump = readFileSync(join(content, "roles.sql"), "utf8");
    expect(roleDump).toContain(`CREATE ROLE "${operator}"`);
    expect(roleDump).not.toContain("binary_upgrade_set_next_pg_authid_oid");
    const tar = join(scratch, "capture.tar"), archive = join(scratch, "capture.archive.cms"), decrypted = join(scratch, "decrypted.tar");
    command("tar", ["-cf", tar, "-C", content, "."]);
    command("openssl", ["cms", "-encrypt", "-binary", "-aes-256-gcm", "-outform", "DER", "-in", tar, "-out", archive, cert]);
    const archiveHash = sha256(readFileSync(archive)), plaintextHash = sha256(readFileSync(tar));
    // Inspect the DER header, not a hex rendering of the entire ciphertext.
    // The latter grows many times larger than populated Full35 plan history.
    const header = readFileSync(archive).subarray(0, 2048);
    expect(header.includes(Buffer.from("060b2a864886f70d0109100117", "hex"))).toBe(true); // AuthEnvelopedData
    expect(header.includes(Buffer.from("060960864801650304012e", "hex"))).toBe(true); // AES-256-GCM
    command("openssl", ["cms", "-decrypt", "-binary", "-inform", "DER", "-in", archive, "-recip", cert, "-inkey", key, "-out", decrypted]);
    expect(sha256(readFileSync(decrypted))).toBe(plaintextHash);
    rmSync(content, { recursive: true }); mkdirSync(content, { mode: 0o700 });
    command("tar", ["-xf", decrypted, "-C", content]);
    const tables = query("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','ingestion') order by 1").split("\n");
    expect(tables.every(name => /^(public|ingestion)\.[a-z_]+$/.test(name))).toBe(true);
    targetQuery(`set session_replication_role=replica; truncate ${tables.join(",")} cascade; truncate auth.users cascade;`);
    targetQuery(readFileSync(join(content, "auth-durable-data.sql"), "utf8"));
    targetQuery(readFileSync(join(content, "application-data.sql"), "utf8"));
    for (const table of [...tables, "auth.users"]) {
      const sql = `select to_jsonb(t)::text from ${table} t order by to_jsonb(t)::text collate "C"`;
      expect(targetQuery(sql), `Complete preserved rows: ${table}`).toBe(query(sql));
    }
    expect(targetQuery("select ingestion.fingerprint_mapping_database_contract_v1();"))
      .toBe(query("select ingestion.fingerprint_mapping_database_contract_v1();"));
    const countSql = `select jsonb_build_object('foods',(select count(*) from public.foods where is_public),
      'sources',(select count(*) from ingestion.source_record_versions),'values',(select count(*) from public.food_nutrients),
      'head',(select current_head_version from ingestion.dataset_projection_current_heads),
      'receipts',(select count(*) from ingestion.mapping_reprojection_receipts),
      'context',(select count(*) from ingestion.mapping_reprojection_execution_context));`;
    const counts = JSON.parse(targetQuery(countSql));
    expect(counts).toEqual({ foods: 353, sources: 353, values: expectedValues, head: expectedHead, receipts: operations.length, context: 0 });
    const history = JSON.parse(targetQuery(`select jsonb_build_object(
      'heads',(select jsonb_agg(head_version order by head_version) from ingestion.dataset_projection_heads),
      'v2_projections',(select count(*) from ingestion.food_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
      'v2_states',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
      'interpretations',(select count(*) from ingestion.source_mapping_interpretations));`));
    expect(history).toEqual({ heads: Array.from({ length: expectedHead }, (_, i) => i + 1),
      v2_projections: 353 * (expectedHead - 1), v2_states: 12355 * (expectedHead - 1), interpretations: expectedHead === 1 ? 0 : 353 });
    expect(targetQuery(`select count(*) from ingestion.food_projection_versions p where
      (projection_contract_version='foundation-lifecycle-projection/v1' and lifecycle_projection_hash <>
        ingestion.fingerprint_json_v1(ingestion.foundation_lifecycle_projection_version_body_v1(p.id))) or
      (projection_contract_version='foundation-lifecycle-projection/v2' and
        (projection_hash<>ingestion.fingerprint_mapping_json_v1(ingestion.mapping_projection_body_v2(p.id)) or
         lifecycle_projection_hash<>ingestion.mapping_lifecycle_hash_v2(ingestion.mapping_projection_body_v2(p.id))));`)).toBe("0");
    expect(hashes(privateSql)).toBe(privateHash);
    expect(sha256(targetQuery(privateSql))).toBe(privateHash);
    const failures = [];
    for (const operation of operations) {
      const sql = `select ingestion.execute_foundation_mapping_${operation.kind}_v1('${operation.approval}','${operation.retry}');`;
      expect(JSON.parse(query(sql, operator))).toEqual(operation.receipt);
      let message = "", state = "";
      try { targetQuery("\\set VERBOSITY verbose\n" + sql, operator); }
      catch (error) {
        const stderr = String((error as { stderr: Buffer }).stderr);
        message = stderr.includes("execution actor or approval scope mismatch") ? "execution actor or approval scope mismatch" : "unexpected diagnostic failure";
        state = stderr.includes("42501:") ? "42501" : "unexpected";
      }
      expect(message).toBe("execution actor or approval scope mismatch"); expect(state).toBe("42501");
      expect(() => targetQuery(`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${operation.approval}');`, operator)).toThrow(/receipt actor mismatch/);
      failures.push({ operation: operation.kind, sourceRetry: "ORIGINAL_RECEIPT", restoredRetry: "REFUSED", sqlstate: state, reason: message });
    }
    expect(targetQuery(countSql)).toBe(query(countSql));
    outcomes.push({ checkpoint: label, counts, history, historicalProjectionHashesRecomputed: true,
      completeApplicationAndIngestionTablesEqual: tables.length,
      installedSchemaContractHashEqual: true,
      privateSnapshotHashEqual: true, encryptedArchiveSha256: archiveHash, plaintextArchiveSha256: plaintextHash,
      decryptDigestEqual: true, roleNamesAttributesAndMembershipsEqual: true, sourceAndRestoredRetries: failures });
    rmSync(content, { recursive: true }); rmSync(tar); rmSync(decrypted); rmSync(archive);
    process.stdout.write(`Data equality verified; ${failures.length} restored completed-operation retries refused at ${label}.\n`);
  }
  try {
    checkpoint("before_reprojection", 1199, 1);
    originalReceipt = execute(plan(false), fixtureId(999810));
    checkpoint("after_reprojection", 6261, 2);
    execute(plan(true), fixtureId(999811));
    expect(query(coreSql)).toBe(originalCore);
    checkpoint("after_compensation", 1199, 3);
    writeFileSync(join(evidence, "actor-identity-blocker.json"), JSON.stringify({
      task: "NUTRITION-USDA-FULL35-RECOVERY-001", status: "USDA_FULL35_RECOVERY_001_BLOCKED",
      diagnosticAssertions: "PASS", recoveryQualification: "FAIL", approvedPipelineHistory47Accepted: false,
      exactMigration47Sha256: migrationInventory.at(-1).sha256,
      orderedFilenameSetSha256: sha256(migrationFiles.join("\n")),
      sourceRoles, restoredRoles: targetRoles, outcomes,
      limitation: "Diagnostic CMS envelope and data replay; the approved pipeline remains closed to history 47. This is not recovery qualification.",
      privateKeyAndPlaintextRemovedByFinally: true, productionAccess: false,
    }, null, 2) + "\n", { mode: 0o600 });
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
