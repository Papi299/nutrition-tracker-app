import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Request } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { additionalNutrientCodesV1, nutrientManifestV1 } from "@/lib/nutrition-snapshots";
import { allNutrientFields, scaleAllFoodNutrients } from "@/lib/food-selection/nutrient-scaling";
import { parseFoodNutritionReferenceV2 } from "@/lib/food-selection/reference-parser";
import { parseFoundationArchive } from "@/ingestion/usda/foundation/parser";
import { normalizeFoundationRecord } from "@/ingestion/usda/foundation/normalization";
import { syntheticReprojectionRecords, fixtureId } from "./fixtures/foundation-full35-reprojection";
import { installApplicationTransition } from "./fixtures/full35-app-transition";
import { provisionActivatedLocalUser } from "./helpers/local-auth";

test("atomic persistence closes freshness-read / governed-commit / diary-write race", async ({ browser }) => {
  test.setTimeout(420_000);
  if (process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !process.env.FULL35_ATOMICITY_CONTROL) throw new Error("Isolated diagnostic runner required.");
  const diaryFirst = process.env.FULL35_ATOMICITY_SCENARIO === "diary-first";
  const control = process.env.FULL35_ATOMICITY_CONTROL;
  const url = process.env.LOCAL_SUPABASE_URL!, key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY!;
  if (new URL(url).hostname !== "127.0.0.1") throw new Error("Local database required.");
  const base = syntheticReprojectionRecords();
  const raws = base.archive.records.map(record => structuredClone(record.raw)) as Array<{
    foodNutrients: Array<{ nutrient: { id: number }; amount: number }>;
  }>;
  const amounts: Record<number, number> = { 2048: 200, 2047: 200, 1003: 20, 1005: 20, 1004: 5, 1079: 2.4 };
  const index = raws.findIndex(record => [1003, 1005, 1004, 1079].every(id =>
    record.foodNutrients.some(n => n.nutrient.id === id)) && record.foodNutrients.some(n => [2047, 2048].includes(n.nutrient.id)));
  expect(index).toBeGreaterThanOrEqual(0);
  for (const nutrient of raws[index].foodNutrients) if (nutrient.nutrient.id in amounts) nutrient.amount = amounts[nutrient.nutrient.id];
  const archive = parseFoundationArchive(JSON.stringify({ FoundationFoods: raws }));
  const records = { archive, identities: archive.records.map((record, i) => ({ fdc_id: String(record.raw.fdcId),
    source_record_id: fixtureId(i * 3 + 1), source_version_id: fixtureId(i * 3 + 2), raw_content_sha256: record.rawContentSha256 })),
    legacy: archive.records.map(record => normalizeFoundationRecord(record)) };
  const transition = installApplicationTransition(records);
  const { query, json, asyncQuery, execution, operator, plan, approvalId, planId } = transition;
  const foodId = fixtureId(index * 3 + 3);
  const client = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `atomicity-${randomUUID()}@example.test`, password = `${randomBytes(24).toString("hex")}aA!`;
  const user = await provisionActivatedLocalUser(client, { email, password });
  expect(user.error).toBeNull();
  const owner = user.data.user!.id;
  const evidence: Record<string, unknown> = { source: process.env.FULL35_APP_SOURCE_COMMIT, sourceTree: process.env.FULL35_APP_SOURCE_TREE,
    foodId, sourceMode: "353 synthetic source records; approved migration47 executor and independent bound LOGIN actors",
    approvalId, planId, planCounts: plan.counts, owner };
  const locks: Record<string, unknown> = {};
  const sessions: Array<{ close: () => Promise<void> }> = [];
  const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)![1];
  async function session(name: string) {
    const child = spawn("docker", ["exec", "-i", `supabase_db_${project}`, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]);
    let output = "", errors = "";
    const closed = new Promise<number | null>(ok => child.once("close", ok));
    child.stdout.on("data", data => output += data); child.stderr.on("data", data => errors += data);
    async function send(sql: string) {
      const marker = `ready_${randomBytes(8).toString("hex")}`;
      const previous = output.length;
      child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      await expect.poll(() => output.slice(previous).includes(marker) || child.exitCode !== null, { timeout: 60_000 }).toBe(true);
      if (!output.slice(previous).includes(marker)) throw new Error(errors);
      return output.slice(previous).split(marker)[0].trim();
    }
    const close = async () => { child.stdin.end("rollback;\n\\q\n"); if (await closed !== 0) throw new Error(errors); };
    sessions.push({ close });
    await send(`set application_name='atomicity_${name}';`);
    return { send, close };
  }
  const lockSnapshot = () => json(`select jsonb_build_object('at',clock_timestamp(),
    'sessions',(select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'user',usename,'application',application_name,
      'state',state,'xact_start',xact_start,'query_start',query_start,'backend_xid',backend_xid::text,
      'wait_type',wait_event_type,'wait_event',wait_event,'blockers',pg_blocking_pids(pid))), '[]')
      from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and
      (usename in('authenticator','full35_app_operator','full35_app_consumer') or application_name like 'atomicity_%')),
    'locks',(select coalesce(jsonb_agg(jsonb_build_object('pid',l.pid,'type',l.locktype,'relation',l.relation::regclass::text,
      'page',l.page,'tuple',l.tuple,'mode',l.mode,'granted',l.granted,'xid',l.transactionid::text,
      'classid',l.classid,'objid',l.objid,'objsubid',l.objsubid)), '[]') from pg_locks l join pg_stat_activity a on a.pid=l.pid
      where a.datname=current_database() and a.pid<>pg_backend_pid() and
      (a.usename in('authenticator','full35_app_operator','full35_app_consumer') or a.application_name like 'atomicity_%')))`);
  const counts = () => json(`select jsonb_build_object('rows',(select count(*) from public.diary_entries where user_id='${owner}'),
    'receipts',(select count(*) from public.manual_diary_entry_requests where user_id='${owner}'),
    'mappingReceipts',(select count(*) from ingestion.mapping_reprojection_receipts),
    'datasetHead',(select current_head_version from ingestion.dataset_projection_current_heads where dataset_id='${plan.dataset_id}' and environment='local'))`);
  const reference = async () => { const r = await client.rpc("get_readable_food_nutrition_reference_v2", { p_food_id: foodId }).single(); expect(r.error).toBeNull(); return r.data!; };
  const controlCall = async (path: string) => { const response = await fetch(new URL(path, control), { method: "POST" }); expect(response.ok).toBe(true); return response.json(); };
  const context = await browser.newContext();
  const page = await context.newPage();
  const form = page.getByTestId("manual-diary-entry-form");
  let request: Request | undefined;
  page.on("request", value => { if (value.method() === "POST" && new URL(value.url()).pathname === "/en/today") request = value; });
  async function open(date: string) {
    await page.goto(`/en/today?date=${date}&foodId=${foodId}`);
    await form.locator('input[name="serving_quantity"]').fill("200");
    await expect(form.locator('input[name="calories"]')).toHaveValue("400");
    return { key: await form.locator('input[name="idempotency_key"]').inputValue(), fingerprint: await form.locator('input[name="reference_fingerprint"]').inputValue() };
  }
  const click = () => form.getByRole("button", { name: "Add entry", exact: true }).click();
  async function replay(original: Request, changed = false) {
    let data = original.postDataBuffer()!;
    if (changed) {
      const text = data.toString();
      const updated = text.replace(/(name="[^"]*notes"\r\n\r\n)([^\r\n]*)(\r\n)/,
        (_match, prefix, _notes, suffix) => `${prefix}Atomicity changed payload${suffix}`);
      expect(updated === text, "Change the actual multipart notes field only").toBe(false);
      data = Buffer.from(updated);
    }
    const response = await context.request.fetch(original.url(), { method: "POST", data,
      headers: { "content-type": original.headers()["content-type"], "next-action": original.headers()["next-action"], origin: new URL(original.url()).origin } });
    const text = await response.text(); expect(response.status()).toBeLessThan(400);
    return { success: text.includes('"status":"success"'), conflict: text.includes('"status":"conflict"'), status: response.status() };
  }
  try {
    evidence.installed = json(`select jsonb_build_object('server',version(),'isolation',current_setting('default_transaction_isolation'),
      'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
      'roleSettings',(select jsonb_agg(jsonb_build_object('name',rolname,'config',rolconfig)) from pg_roles
        where rolname in('authenticated','authenticator','full35_app_operator','full35_app_consumer')),
      'databaseSettings',(select jsonb_agg(jsonb_build_object('role',setrole,'database',setdatabase,
        'settings',(select jsonb_agg(case when lower(s) ~ '(secret|password|token|key)=' then split_part(s,'=',1)||'=[REDACTED]' else s end)
          from unnest(setconfig) s))) from pg_db_role_setting),
      'functions',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',pg_get_userbyid(proowner),
        'securityDefiner',prosecdef,'volatility',provolatile,'settings',proconfig,'acl',proacl::text,'definition',pg_get_functiondef(p.oid)))
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and n.nspname in('public','private','ingestion')
        and (p.proname in('get_readable_food_nutrition_reference_v1','get_readable_food_nutrition_reference_v2','create_manual_diary_entry',
          'create_manual_diary_entry_v2','create_reference_diary_entry_v1','diary_governed_dataset_v1','diary_reference_owner_v1','diary_scaled_amount_v1','lock_readable_food_for_diary_create','insert_completed_manual_diary_entry_request',
          'execute_foundation_mapping_reprojection_v1','execute_foundation_mapping_compensation_v1','promote_validated_foundation_run','execute_foundation_lifecycle_update','set_custom_food_archived','create_manual_diary_entry','execute_mapping_plan_internal_v1','lock_mapping_principals_v1','mapping_current_actor_v1')
          or p.oid in(select tgfoid from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace z on z.oid=c.relnamespace
            where z.nspname in('public','ingestion') and not t.tgisinternal))),
      'triggers',(select jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'internal',tgisinternal,'enabled',tgenabled,
        'definition',pg_get_triggerdef(t.oid))) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','ingestion')),
      'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(c.oid)))
        from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in('public','ingestion')),
      'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in('public','ingestion')),
      'rls',(select jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'enabled',relrowsecurity,'forced',relforcerowsecurity))
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','ingestion') and relkind='r'))`);
    await page.goto("/en/auth/sign-in"); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/en\/today\?date=/);
    const a = await reference(); evidence.referenceA = a;
    expect(a.nutrients).toMatchObject({ energy_kcal: "200.0000", protein_g: "20.0000", carbohydrates_g: "20.0000", fat_g: "5.0000", fiber_g: null });

    // A real completed A entry supplies the before/after completion and retry controls.
    await open("2026-11-01"); await click(); await expect(form).toContainText("Entry added.");
    const originalRequest = request!;
    const originalRows = (await client.from("diary_entries").select("*")).data;
    const originalReceipts = (await client.from("manual_diary_entry_requests").select("*")).data;
    evidence.afterDiaryBeforeReprojection = { counts: counts(), rows: originalRows, receipts: originalReceipts };

    // Explicit transactions expose the unchanged installed functions' retained
    // locks; these are corroborating probes, not substitutes for the HTTP path.
    const readProbe = await session("read_probe");
    await readProbe.send(`begin read only;set local role authenticated;set local request.jwt.claim.sub='${owner}';select reference_fingerprint from public.get_readable_food_nutrition_reference_v2('${foodId}');`);
    locks.referenceTransaction = lockSnapshot(); await readProbe.send("rollback;");

    const controller = await session("controller");
    // A test-only BEFORE INSERT barrier holds the actual invoker transaction
    // after freshness/nutrition validation. It changes no value or authority.
    query(`create function full35_app_fixture.diary_barrier() returns trigger language plpgsql security invoker set search_path='' as $$
      begin if new.notes='atomic-barrier' then perform pg_catalog.pg_advisory_xact_lock(73535004);
      elsif new.notes in('atomic-deadlock:A','atomic-deadlock:B') then
        perform pg_catalog.pg_advisory_xact_lock(case when new.notes='atomic-deadlock:A' then 73535006 else 73535007 end);
        perform pg_catalog.pg_advisory_xact_lock(73535008);
        perform pg_catalog.pg_advisory_xact_lock(case when new.notes='atomic-deadlock:A' then 73535007 else 73535006 end);
      end if;return new;end;$$;
      create trigger zz_atomic_diary_barrier before insert on public.diary_entries for each row execute function full35_app_fixture.diary_barrier();`);
    const pending = { ...await open("2026-11-02"), automaticFields: await form.locator('input[name^="automatic_"]:checked').evaluateAll(
      inputs => inputs.map(input => (input as HTMLInputElement).name)) };
    expect(pending.automaticFields).toHaveLength(35);
    if (diaryFirst) {
      await form.locator('[name="notes"]').fill("atomic-barrier");
      await controller.send("select pg_advisory_lock(73535004);");
      await click();
      await expect.poll(() => Number(query("select count(*) from pg_stat_activity where usename='authenticator' and wait_event='advisory';"))).toBe(1);
      locks.diarySharedBeforeInsert = lockSnapshot();
      evidence.before = counts();
      const writer = asyncQuery(`set application_name='atomicity_reverse_writer';begin;${execution}commit;`, operator);
      await expect.poll(() => Number(query("select count(*) from pg_stat_activity where application_name='atomicity_reverse_writer' and wait_event='advisory';"))).toBe(1);
      locks.writerWaitsForDiary = lockSnapshot();
      await controller.send("select pg_advisory_unlock(73535004);");
      await expect(form).toContainText("Entry added.");
      await writer;
      const b = await reference();evidence.referenceB=b;
      const row=(await client.from("diary_entries").select("*").eq("entry_date","2026-11-02").single()).data!;
      expect(row.additional_nutrient_snapshot).toMatchObject({values:{fiber_g:null}});
      evidence.mainOutcome={diaryFirst:true,row,referenceB:b,counts:counts(),writerWaitObserved:true};
    } else {
    await controlCall("/arm"); await click();
    await expect.poll(async () => (await controlCall("/status")).held, { timeout: 30_000 }).toBe(true);
    locks.beforeDiaryDispatchHeld = lockSnapshot(); evidence.before = counts();

    // A complete governed execution that rolls back must leave A and all heads
    // and receipts unchanged. No arbitrary nutrient INSERT is used as evidence.
    await readProbe.send(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';select private.lock_readable_food_for_diary_create('${foodId}');`);
    locks.foodShareHeld = lockSnapshot();
    const rolledBack = query(`begin;${execution}rollback;`, operator);
    evidence.rolledBackReprojection = { receiptWasProducedInsideTransaction: rolledBack.includes('"receipt_id"'),
      completedDespiteConcurrentFoodShare: true, counts: counts(), reference: await reference() };
    await readProbe.send("rollback;");
    expect((evidence.rolledBackReprojection as { reference: typeof a }).reference.reference_fingerprint).toBe(a.reference_fingerprint);

    // FOR UPDATE, unlike the existing SHARE lock, conflicts with the executor's
    // real foreign-key parent KEY SHARE check. Demonstrate that distinction.
    await readProbe.send(`begin;select id from public.foods where id='${foodId}' for update;`);
    await controller.send("select pg_advisory_lock(73535003);");
    const blockedWriter = asyncQuery(`set application_name='atomicity_lock_conflict_writer';begin;${execution}
      select pg_advisory_xact_lock(73535003);rollback;`, operator);
    await expect.poll(() => Number(query("select count(*) from pg_stat_activity where application_name='atomicity_lock_conflict_writer' and wait_event_type='Lock' and wait_event<>'advisory' and cardinality(pg_blocking_pids(pid))>0;")), { timeout: 60_000 }).toBe(1);
    locks.foodUpdateConflict = lockSnapshot();
    await readProbe.send("rollback;");
    await expect.poll(() => Number(query("select count(*) from pg_stat_activity where application_name='atomicity_lock_conflict_writer' and wait_event='advisory';")), { timeout: 90_000 }).toBe(1);
    locks.writerAfterFoodUpdateRelease = lockSnapshot();
    await controller.send("select pg_advisory_unlock(73535003);"); await blockedWriter;
    await controller.send("select pg_advisory_lock(73535002);");
    const writer = asyncQuery(`set application_name='atomicity_governed_writer';begin;${execution}
      select jsonb_build_object('kind','governed-precommit','xid',pg_current_xact_id()::text,'pid',pg_backend_pid(),'at',clock_timestamp(),'isolation',current_setting('transaction_isolation'));
      select pg_advisory_xact_lock(73535002);commit;select jsonb_build_object('kind','governed-committed','at',clock_timestamp());`, operator);
    await expect.poll(() => Number(query("select count(*) from pg_stat_activity where application_name='atomicity_governed_writer' and wait_event='advisory';")), { timeout: 90_000 }).toBe(1);
    locks.writerBeforeCommit = lockSnapshot();
    await controller.send("select pg_advisory_unlock(73535002);");
    evidence.governedExecution = (await writer).split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line));
    const b = await reference(); evidence.referenceB = b;
    expect(b.reference_fingerprint).not.toBe(a.reference_fingerprint); expect(Number((b.nutrients as Record<string, unknown>).fiber_g)).toBe(2.4);
    evidence.committedWhileRequestHeld = counts(); locks.afterGovernedCommit = lockSnapshot();
    await controlCall("/release");
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    const stale = await client.from("diary_entries").select("*").eq("entry_date", "2026-11-02"); expect(stale.error).toBeNull();
    const receipt = await client.from("manual_diary_entry_requests").select("*").eq("idempotency_key", pending.key); expect(receipt.error).toBeNull();
    evidence.mainOutcome = { pending, rows: stale.data, receipts: receipt.data, counts: counts(), referenceChanged: true };
    expect(stale.data).toEqual([]);expect(receipt.data).toEqual([]);
    expect(counts()).toEqual(evidence.committedWhileRequestHeld);
    await test.info().attach("atomicity-browser", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
    const b = await reference();
    evidence.retry = { exact: await replay(originalRequest), changed: await replay(originalRequest, true) };
    expect((evidence.retry as { exact: { success: boolean }; changed: { conflict: boolean } }).exact.success).toBe(true);
    expect((evidence.retry as { exact: { success: boolean }; changed: { conflict: boolean } }).changed.conflict).toBe(true);
    expect((await client.from("diary_entries").select("*").eq("id", originalRows![0].id)).data).toEqual(originalRows);
    expect((await client.from("manual_diary_entry_requests").select("*").eq("id", originalReceipts![0].id)).data).toEqual(originalReceipts);

    // Commit-before-read: replay an old encrypted action with a NEW request key.
    const body = originalRequest.postDataBuffer()!.toString();
    const oldKey = originalReceipts![0].idempotency_key;
    const newKey = randomUUID(); expect(body).toContain(oldKey);
    const beforeRead = await context.request.fetch(originalRequest.url(), { method: "POST", data: Buffer.from(body.replaceAll(oldKey, newKey)),
      headers: { "content-type": originalRequest.headers()["content-type"], "next-action": originalRequest.headers()["next-action"], origin: new URL(originalRequest.url()).origin } });
    const beforeReadText = await beforeRead.text(); expect(beforeReadText).toContain("reference_changed");
    evidence.commitBeforeRead = { referenceChanged: true, rows: (await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key", newKey)).data };

    // Current B selection persists 4.8; mixed provenance retains explicit 7.
    await open("2026-11-03"); await click(); await expect(form).toContainText("Entry added.");
    const enriched = await client.from("diary_entries").select("*").eq("entry_date", "2026-11-03").single();
    expect(enriched.data!.additional_nutrient_snapshot).toMatchObject({ values: { fiber_g: 4.8 } }); evidence.freshB = enriched.data;
    await open("2026-11-04");
    for (const details of await form.locator("details").all()) if (await details.getAttribute("open") === null) await details.locator("summary").click();
    await form.locator('input[name="fiber_g"]').fill("7"); await click(); await expect(form).toContainText("Entry added.");
    evidence.mixed = (await client.from("diary_entries").select("*").eq("entry_date", "2026-11-04").single()).data;
    expect((evidence.mixed as { additional_nutrient_snapshot: unknown }).additional_nutrient_snapshot).toMatchObject({ values: { fiber_g: 7 } });

    const args = { p_idempotency_key: randomUUID(), p_entry_date: "2026-11-05", p_meal_type: "lunch", p_food_id: foodId,
      p_food_name: "Synthetic explicit manual snapshot", p_brand_name: "", p_serving_quantity: 200, p_serving_unit: "g",
      p_calories: 321, p_protein_g: 0, p_carbohydrates_g: null as unknown as number, p_fat_g: 1, p_notes: "",
      p_additional_nutrients: { version: 1, values: additionalNutrientCodesV1.map(code => ({ code, amount: code === "fiber_g" ? 9 : null })) } };
    const manual = await client.rpc("create_manual_diary_entry_v2", args).single(); expect(manual.error).toBeNull(); expect(manual.data!.result_status).toBe("success");
    evidence.manual = { result: manual.data, row: (await client.from("diary_entries").select("*").eq("id", manual.data!.diary_entry_id!).single()).data };
    const rejected: Record<string, unknown> = {};
    for (const [kind, id] of [["archived", randomUUID()], ["deleted", randomUUID()], ["crossOwner", fixtureId(999705)]] as const) {
      if (kind === "archived") query(`insert into public.foods(id,food_type,name,locale,data_quality,is_public,is_archived,source_id)
        values('${id}','generic','Synthetic archived atomicity','en','verified',true,true,(select id from public.food_sources where code='manual'));`);
      if (kind === "deleted") query(`insert into public.foods(id,food_type,name,locale,data_quality,is_public,source_id)
        values('${id}','generic','Synthetic deleted atomicity','en','verified',true,(select id from public.food_sources where code='manual'));
        delete from public.foods where id='${id}';`);
      const next = { ...args, p_idempotency_key: randomUUID(), p_food_id: id };
      const ref = await client.rpc("get_readable_food_nutrition_reference_v2", { p_food_id: id });
      const outcome = await client.rpc("create_manual_diary_entry_v2", next).single();
      expect(ref.data).toEqual([]); expect(outcome.data!.result_status).toBe("unavailable");
      expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key", next.p_idempotency_key)).data).toEqual([]);
      rejected[kind] = { id, read: ref.data, result: outcome.data };
    }
    evidence.unreadable = rejected;
    expect((await client.from("diary_entries").select("id").eq("user_id", fixtureId(999700))).data).toEqual([]);
    expect((await client.from("manual_diary_entry_requests").select("id").eq("user_id", fixtureId(999700))).data).toEqual([]);
    evidence.ownerIsolation = true;

    // Two real simultaneous RPCs are held by the EXISTING idempotency lock.
    const parsedB=parseFoodNutritionReferenceV2(b,foodId)!;
    const scaledB=scaleAllFoodNutrients(parsedB,"200","g");expect(scaledB.ok).toBe(true);
    if(!scaledB.ok) throw new Error("Expected B scaling");
    const automaticArgs={...args,p_calories:400,p_protein_g:40,p_carbohydrates_g:40,p_fat_g:10,
      p_captured:true,p_reference_fingerprint:b.reference_fingerprint,p_automatic_fields:[...allNutrientFields],
      p_additional_nutrients:{version:1,values:additionalNutrientCodesV1.map(code=>({code,amount:scaledB.values[code]===""?null:Number(scaledB.values[code])}))}};
    const simultaneous = { ...automaticArgs, p_idempotency_key: randomUUID(), p_entry_date: "2026-11-06" };
    await controller.send(`select pg_advisory_lock(hashtextextended('${owner}:${simultaneous.p_idempotency_key}',0));`);
    const first = client.rpc("create_reference_diary_entry_v1", simultaneous).single().then(result => result);
    const second = client.rpc("create_reference_diary_entry_v1", simultaneous).single().then(result => result);
    await expect.poll(() => Number(query("select count(*) from pg_stat_activity where usename='authenticator' and wait_event='advisory';")), { timeout: 20_000 }).toBe(2);
    locks.simultaneousReceipts = lockSnapshot();
    await controller.send(`select pg_advisory_unlock(hashtextextended('${owner}:${simultaneous.p_idempotency_key}',0));`);
    const both = await Promise.all([first, second]); both.forEach(result => expect(result.error).toBeNull()); expect(both.map(r=>({id:r.data!.diary_entry_id,at:r.data!.completed_at,status:r.data!.result_status}))[0])
      .toEqual(both.map(r=>({id:r.data!.diary_entry_id,at:r.data!.completed_at,status:r.data!.result_status}))[1]);
    const simultaneousReceipts = await client.from("manual_diary_entry_requests").select("*").eq("idempotency_key", simultaneous.p_idempotency_key);
    expect(simultaneousReceipts.data).toHaveLength(1); evidence.simultaneous = { outcomes: both.map(result => result.data), receipts: simultaneousReceipts.data };

    // Retain post-insert locks. The earlier rollback probe separately proved
    // the installed food SHARE helper coexists with a full governed execution.
    const probeBefore=counts();
    const diaryProbe = await session("diary_probe");
    const snapshotRequest = JSON.stringify(args.p_additional_nutrients).replaceAll("'", "''");
    await diaryProbe.send(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';
      select * from public.create_reference_diary_entry_v1('${randomUUID()}','2026-11-07','lunch','${foodId}','Synthetic lock probe',null,200,'g',400,40,40,10,null,true,'${snapshotRequest}'::jsonb,'${b.reference_fingerprint}',array['calories','protein_g','carbohydrates_g','fat_g']);`);
    locks.diaryTransactionAfterInsert = lockSnapshot();
    // Governed retries also take the dataset EXCLUSIVE lock. Observe the wait
    // asynchronously so the retained diary SHARED lock can be released.
    const governedRetry = asyncQuery(`set application_name='atomicity_completed_governed_retry';${execution}`,operator);
    await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where application_name='atomicity_completed_governed_retry' and wait_event='advisory';"))).toBe(1);
    locks.completedGovernedRetryWait=lockSnapshot();
    await diaryProbe.send("rollback;");
    evidence.governedCompletedRetry=JSON.parse(await governedRetry).receipt_id;
    expect(counts()).toEqual(probeBefore);evidence.diaryRollback={noRowOrReceipt:true};
    // The uncaptured legacy automatic path still goes through the atomic RPC;
    // the original v1 manual API also retains its independent manual contract.
    const manualV1Args=Object.fromEntries(Object.entries(args).filter(([key])=>key!=="p_additional_nutrients")) as Omit<typeof args,"p_additional_nutrients">;
    const manualV1=await client.rpc("create_manual_diary_entry",{...manualV1Args,p_idempotency_key:randomUUID()}).single();
    expect(manualV1.data?.result_status).toBe("success");
    const automaticV1=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:randomUUID(),
      p_captured:false,p_additional_nutrients:null,p_automatic_fields:["calories","protein_g","carbohydrates_g","fat_g"]}).single();
    expect(automaticV1.data?.result_status).toBe("success");
    expect((await client.from("diary_entries").select("additional_nutrient_snapshot").eq("id",automaticV1.data!.diary_entry_id).single()).data?.additional_nutrient_snapshot).toBeNull();
    await open("2026-11-08");
    for(const name of ["additional_nutrients_captured",...additionalNutrientCodesV1,...additionalNutrientCodesV1.map(c=>`automatic_${c}`)])
      await form.locator(`[name="${name}"]`).evaluateAll(nodes=>nodes.forEach(node=>node.remove()));
    await click();await expect(form).toContainText("Entry added.");
    expect((await client.from("diary_entries").select("additional_nutrient_snapshot").eq("entry_date","2026-11-08").single()).data?.additional_nutrient_snapshot).toBeNull();
    evidence.legacy={manualV1:manualV1.data,automaticV1:automaticV1.data,browserUncaptured:true};
    // Own custom and non-USDA sources acquire no Full35 dataset authority.
    const custom=await client.rpc("create_custom_food",{p_aliases:[],p_brand_name:"",p_idempotency_key:randomUUID(),
      p_locale:"en",p_name:"Synthetic atomic custom reference",p_nutrient_basis:"per_100g",p_serving_quantity:100,p_serving_unit:"g",
      p_nutrients:[{code:"energy_kcal",amount:200},{code:"protein_g",amount:0},{code:"carbohydrates_g",amount:20},{code:"fat_g",amount:5}]}).single();
    expect(custom.error).toBeNull();const customId=custom.data!.food_id;
    const customRef=(await client.rpc("get_readable_food_nutrition_reference_v2",{p_food_id:customId}).single()).data!;
    expect(query(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';select coalesce(private.diary_governed_dataset_v1('${customId}')::text,'none');rollback;`,transition.consumer)).toBe("none");
    const customArgs={...automaticArgs,p_idempotency_key:randomUUID(),p_food_id:customId,p_reference_fingerprint:customRef.reference_fingerprint,
      p_protein_g:0,p_additional_nutrients:{version:1,values:additionalNutrientCodesV1.map(code=>({code,amount:null}))}};
    const customWrite=await client.rpc("create_reference_diary_entry_v1",customArgs).single();expect(customWrite.data?.result_status).toBe("success");
    // A literal custom unit named "serving" is not a physical catalog alias.
    // Its 1/3 ratio exercises independent SQL and JS recurring-decimal rounding.
    const portionNutrients=[{code:"energy_kcal",amount:100.5},{code:"protein_g",amount:0.1234},
      {code:"carbohydrates_g",amount:1.2345},{code:"fat_g",amount:0.0001},{code:"fiber_g",amount:0.0001}];
    const literal=await client.rpc("create_custom_food",{p_aliases:[],p_brand_name:"",p_idempotency_key:randomUUID(),
      p_locale:"en",p_name:"Synthetic literal serving",p_nutrient_basis:"per_serving",p_serving_quantity:3,p_serving_unit:"serving",
      p_nutrients:portionNutrients}).single();expect(literal.error).toBeNull();
    const literalRef=(await client.rpc("get_readable_food_nutrition_reference_v2",{p_food_id:literal.data!.food_id}).single()).data!;
    const literalParsed=parseFoodNutritionReferenceV2(literalRef,literal.data!.food_id);if(!literalParsed)throw new Error("Literal reference absent");
    const literalScaled=scaleAllFoodNutrients(literalParsed,"1","serving");if(!literalScaled.ok)throw new Error("Literal unit scaling failed");
    expect(literalScaled.values).toMatchObject({calories:"34",protein_g:"0.04",carbohydrates_g:"0.41",fat_g:"0",fiber_g:"0"});
    const literalWrite=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:randomUUID(),
      p_food_id:literal.data!.food_id,p_reference_fingerprint:literalRef.reference_fingerprint,p_serving_quantity:1,p_serving_unit:"serving",
      p_calories:34,p_protein_g:0.04,p_carbohydrates_g:0.41,p_fat_g:0,
      p_additional_nutrients:{version:1,values:additionalNutrientCodesV1.map(code=>({code,amount:literalScaled.values[code]===""?null:Number(literalScaled.values[code])}))}}).single();
    expect(literalWrite.error).toBeNull();expect(literalWrite.data?.result_status).toBe("success");
    evidence.literalServing={ratio:"1/3",expected:literalScaled.values,result:literalWrite.data};

    // Even with all 35 fields manual, a quantity converted from a catalog
    // serving retains its dependency through draft reload and the native review.
    const physical=await client.rpc("create_custom_food",{p_aliases:[],p_brand_name:"",p_idempotency_key:randomUUID(),
      p_locale:"en",p_name:"Synthetic physical serving",p_nutrient_basis:"per_serving",p_serving_quantity:50,p_serving_unit:"g",
      p_nutrients:portionNutrients}).single();expect(physical.error).toBeNull();const physicalId=physical.data!.food_id;
    await page.goto(`/en/today?date=2026-11-10&foodId=${physicalId}`);
    for(const detail of await form.locator("details").all())if(await detail.getAttribute("open")===null)await detail.locator("summary").click();
    for(const field of allNutrientFields)await form.locator(`[name="automatic_${field}"]`).uncheck();
    await form.locator('[name="calories"]').fill("321");
    await form.locator('[name="serving_unit"]').fill("g");
    await expect(form.locator('[name="serving_quantity"]')).toHaveValue("50");
    const physicalFingerprint=await form.locator('[name="reference_fingerprint"]').inputValue();
    await expect(form.locator('[name="quantity_reference_fingerprint"]')).toHaveValue(physicalFingerprint);
    await page.reload();await expect(form.locator('input[name^="automatic_"]:checked')).toHaveCount(0);
    await expect(form.locator('[name="quantity_reference_fingerprint"]')).toHaveValue(physicalFingerprint);
    const conversionKey=await form.locator('[name="idempotency_key"]').inputValue();
    const conversionBefore=counts();await controlCall("/arm");await click();
    await expect.poll(async()=>(await controlCall("/status")).held).toBe(true);
    const conversionStatus=await controlCall("/status");
    const conversionEvent=conversionStatus.events.at(-1);expect(conversionEvent.rpc).toBe("/rest/v1/rpc/create_reference_diary_entry_v1");
    expect(conversionEvent.args.p_automatic_fields).toEqual([]);
    const editRevision=(await client.from("foods").select("custom_food_edit_revision").eq("id",physicalId).single()).data!.custom_food_edit_revision!;
    const edited=await client.rpc("persist_custom_food",{p_food_id:physicalId,p_expected_edit_revision:editRevision,p_aliases:[],p_brand_name:"",
      p_locale:"en",p_name:"Synthetic physical serving",p_nutrient_basis:"per_serving",p_serving_quantity:60,p_serving_unit:"g",p_nutrients:portionNutrients}).single();
    expect(edited.error).toBeNull();await controlCall("/release");
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    expect(counts()).toEqual(conversionBefore);await expect(form.locator('[name="calories"]')).toHaveValue("321");
    expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key",conversionKey)).data).toEqual([]);
    const nativeContext=await browser.newContext({javaScriptEnabled:false,storageState:await context.storageState()});
    const nativePage=await nativeContext.newPage();await nativePage.goto(`/en/today?date=2026-11-11&foodId=${physicalId}`);
    const nativeForm=nativePage.getByTestId("manual-diary-entry-form");
    for(const detail of await nativeForm.locator("details").all())if(await detail.getAttribute("open")===null)await detail.locator("summary").click();
    for(const field of allNutrientFields)await nativeForm.locator(`[name="automatic_${field}"]`).uncheck();
    await nativeForm.locator('[name="calories"]').fill("123");await nativeForm.locator('[name="serving_unit"]').fill("g");
    const nativeSubmit=nativeForm.getByRole("button",{name:"Add entry",exact:true});await nativeSubmit.click();
    await expect(nativePage.getByTestId("nutrition-review-required")).toBeVisible();
    await expect(nativeForm.locator('[name="serving_quantity"]')).toHaveValue("60");
    await expect(nativeForm.locator('[name="quantity_reference_fingerprint"]')).toHaveValue(/[a-f0-9]{64}/);
    await controlCall("/arm");const nativeSubmission=nativeSubmit.click();
    await expect.poll(async()=>(await controlCall("/status")).held).toBe(true);
    const nativeEvent=(await controlCall("/status")).events.at(-1);expect(nativeEvent.rpc).toBe("/rest/v1/rpc/create_reference_diary_entry_v1");
    expect(nativeEvent.args.p_automatic_fields).toEqual([]);await controlCall("/release");await nativeSubmission;
    await expect(nativeForm).toContainText("Entry added.");
    expect((await client.from("diary_entries").select("serving_quantity,serving_unit,calories").eq("entry_date","2026-11-11").single()).data)
      .toMatchObject({serving_quantity:60,serving_unit:"g",calories:123});
    await nativeContext.close();
    evidence.manualServingConversion={javascriptAtomic:true,draftDependencyRetained:true,postReadEditRefused:true,noFailedReceipt:true,
      manualCaloriesPreserved:321,nativeReviewAtomic:true,nativeQuantity:60,nativeManualCalories:123};
    await page.goto(`/en/today?date=2026-11-09&foodId=${customId}`);
    const archiveKey=await form.locator('[name="idempotency_key"]').inputValue();
    expect((await client.rpc("set_custom_food_archived",{p_food_id:customId,p_is_archived:true})).error).toBeNull();
    await click();await expect(form).not.toContainText("Entry added.");
    await expect(form).toContainText("We could not save or load diary entries right now.");
    expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key",archiveKey)).data).toEqual([]);
    evidence.custom={zeroAndUnknownPreserved:true,noGovernedDataset:true,archiveBetweenRenderAndSaveRefused:true};
    for(const [label,extra] of [["spoofOwner",{p_user_id:owner}],["spoofDataset",{p_dataset_id:plan.dataset_id}]] as const){
      const before=counts();const rejected=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,...extra,p_idempotency_key:randomUUID()});
      expect(rejected.error).not.toBeNull();expect(counts()).toEqual(before);evidence[label]={code:rejected.error!.code,noWrite:true};
    }
    const otherPublic=randomUUID(),withoutBasis=randomUUID();
    // Non-governed public fixtures are outside the USDA identity/projection
    // scope. They exercise dataset classification without altering that scope.
    query(`insert into public.foods(id,food_type,name,locale,data_quality,is_public,source_id)
      values('${otherPublic}','generic','Synthetic non-USDA reference','en','verified',true,(select id from public.food_sources where code='manual')),
      ('${withoutBasis}','generic','Synthetic basis-less reference','en','verified',true,(select id from public.food_sources where code='manual'));
      update public.foods set serving_size=100,serving_unit='g' where id='${withoutBasis}';
      insert into public.food_nutrients(food_id,nutrient_id,amount,basis)
      select '${otherPublic}',id,case code when 'energy_kcal' then 200 when 'fat_g' then 5 else 20 end,'per_100g'
      from public.nutrients where code in('energy_kcal','protein_g','carbohydrates_g','fat_g');`);
    const otherRef=(await client.rpc("get_readable_food_nutrition_reference_v2",{p_food_id:otherPublic}).single()).data!;
    await controller.send(`select pg_advisory_lock(hashtextextended('nutrition-tracker:foundation-dataset-lifecycle:${plan.dataset_id}',0));`);
    const unrelated=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:randomUUID(),p_food_id:otherPublic,
      p_reference_fingerprint:otherRef.reference_fingerprint,p_automatic_fields:["calories","protein_g","carbohydrates_g","fat_g"]}).single();
    await controller.send(`select pg_advisory_unlock(hashtextextended('nutrition-tracker:foundation-dataset-lifecycle:${plan.dataset_id}',0));`);
    expect(unrelated.error).toBeNull();expect(unrelated.data?.result_status).toBe("success");
    const emptyRef=(await client.rpc("get_readable_food_nutrition_reference_v2",{p_food_id:withoutBasis}).single()).data!;
    expect(emptyRef.nutrient_basis).toBeNull();expect(emptyRef.serving_quantity).toBe(100);
    const noBasisBefore=counts();
    const noBasis=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:randomUUID(),p_food_id:withoutBasis,p_reference_fingerprint:emptyRef.reference_fingerprint,
      p_calories:null as unknown as number,p_protein_g:null as unknown as number,p_carbohydrates_g:null as unknown as number,p_fat_g:null as unknown as number,
      p_additional_nutrients:{version:1,values:additionalNutrientCodesV1.map(code=>({code,amount:null}))}}).single();
    expect(noBasis.error?.code).toBe("22023");expect(counts()).toEqual(noBasisBefore);
    evidence.sourceClassification={nonUSDANotBlockedByFull35:true,withoutBasisRefused:true};
    const zero=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:randomUUID(),p_serving_quantity:0,
      p_calories:0,p_protein_g:0,p_carbohydrates_g:0,p_fat_g:0,p_additional_nutrients:{version:1,values:additionalNutrientCodesV1.map(code=>({code,amount:(b.nutrients as Record<string,unknown>)[code]===null?null:0}))}}).single();
    expect(zero.data?.result_status).toBe("success");
    evidence.zero=(await client.from("diary_entries").select("*").eq("id",zero.data!.diary_entry_id).single()).data;
    evidence.privileges=json(`select jsonb_build_object('reader',(select jsonb_build_object('login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit) from pg_roles where rolname='diary_dataset_reader'),
      'readerCannotWrite',not has_any_column_privilege('diary_dataset_reader','public.diary_entries','INSERT') and not has_any_column_privilege('diary_dataset_reader','public.food_nutrients','UPDATE'),
      'consumerCannotReadIngestion',not has_any_column_privilege('authenticated','ingestion.source_records','SELECT'),
      'anonymousCannotExecute',not has_function_privilege('anon','public.create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[])','EXECUTE'))`);
    expect(evidence.privileges).toMatchObject({readerCannotWrite:true,consumerCannotReadIngestion:true,anonymousCannotExecute:true});
    const rejectedAtomic:Record<string,unknown>={};
    for(const [label,patch,status] of [
      ["invalidFingerprint",{p_reference_fingerprint:"f".repeat(64)},"reference_changed"],
      ["guessedCurrentObsoleteNutrition",{p_additional_nutrients:{...automaticArgs.p_additional_nutrients,values:automaticArgs.p_additional_nutrients.values.map(v=>({...v,amount:v.code==="fiber_g"?null:v.amount}))}},"nutrition_review_required"],
      ["incorrectUnit",{p_serving_unit:"ml"},null],
      ["unsupportedConversion",{p_serving_unit:"cup"},null],
      ["archive",{p_food_id:(rejected.archived as {id:string}).id},"unavailable"],
      ["deleted",{p_food_id:(rejected.deleted as {id:string}).id},"unavailable"],
      ["quantityPrecision",{p_serving_quantity:200.0001},null],
      ["crossOwner",{p_food_id:fixtureId(999705)},"unavailable"],
    ] as const){
      const request={...automaticArgs,...patch,p_idempotency_key:randomUUID()};
      const before=counts();const response=await client.rpc("create_reference_diary_entry_v1",request).single();
      if(status)expect(response.data?.result_status).toBe(status);else expect(response.error?.code).toBe("22023");
      expect(counts()).toEqual(before);rejectedAtomic[label]={status:response.data?.result_status,errorCode:response.error?.code,noWrite:true};
    }
    await controller.send("select pg_advisory_lock(73535004);");
    const parallelKeys=[randomUUID(),randomUUID()];
    const parallel=parallelKeys.map(key=>client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:key,p_notes:"atomic-barrier"}).single().then(r=>r));
    await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where usename='authenticator' and wait_event='advisory';"))).toBe(2);
    locks.twoKeysShareDataset=lockSnapshot();await controller.send("select pg_advisory_unlock(73535004);");
    const twoKeys=await Promise.all(parallel);twoKeys.forEach(r=>expect(r.data?.result_status).toBe("success"));
    expect(twoKeys[0].data!.diary_entry_id).not.toBe(twoKeys[1].data!.diary_entry_id);
    // Artificial test-trigger cycle verifies PostgreSQL aborts a failed diary
    // transaction atomically; it is not evidence of a production lock cycle.
    await controller.send("select pg_advisory_lock(73535008);");
    const deadlockKeys=[randomUUID(),randomUUID()];const beforeDeadlock=counts();
    const cycle=deadlockKeys.map((key,i)=>client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:key,p_notes:`atomic-deadlock:${i===0?"A":"B"}`}).single().then(r=>r));
    await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where usename='authenticator' and wait_event='advisory';"))).toBe(2);
    locks.artificialDeadlockBeforeRelease=lockSnapshot();await controller.send("select pg_advisory_unlock(73535008);");
    const cycleResults=await Promise.all(cycle);expect(cycleResults.filter(r=>r.error?.code==="40P01")).toHaveLength(1);
    const failedKey=deadlockKeys[cycleResults.findIndex(r=>r.error)];
    expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key",failedKey)).data).toEqual([]);
    evidence.deadlock={outcomes:cycleResults.map(r=>({code:r.error?.code,status:r.data?.result_status})),before:beforeDeadlock,after:counts(),failedKeyHasNoReceipt:true};
    const changedConcurrentKey=randomUUID();
    const changedPair=await Promise.all([1,2].map(i=>client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:changedConcurrentKey,p_notes:`payload ${i}`}).single()));
    expect(changedPair.map(r=>r.data!.result_status).sort()).toEqual(["idempotency_conflict","success"]);
    const timeoutKey=randomUUID();
    await controller.send(`select pg_advisory_lock(hashtextextended('nutrition-tracker:foundation-dataset-lifecycle:${plan.dataset_id}',0));`);
    const timed=await client.rpc("create_reference_diary_entry_v1",{...automaticArgs,p_idempotency_key:timeoutKey}).single();
    expect(["57014","55P03"]).toContain(timed.error?.code);
    await controller.send(`select pg_advisory_unlock(hashtextextended('nutrition-tracker:foundation-dataset-lifecycle:${plan.dataset_id}',0));`);
    expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key",timeoutKey)).data).toEqual([]);
    // Database implementation independently agrees with the accepted JS exact
    // arithmetic across every manifest field and 50/100/200 g quantities.
    const numerical=[];
    for(const quantity of [50,100,200]){
      const scaled=scaleAllFoodNutrients(parsedB,String(quantity),"g");if(!scaled.ok)throw new Error("Oracle scaling failed");
      for(const definition of nutrientManifestV1){
        const field=definition.code === "energy_kcal" ? "calories" : definition.code;
        const raw=(b.nutrients as Record<string,string|null>)[definition.code];
        const actual=query(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';select coalesce(private.diary_scaled_amount_v1(${raw??"null"},${quantity},1000,1000,100,${definition.precision},${definition.maximum})::text,'null');rollback;`,transition.consumer);
        expect(actual==="null"?"":Number(actual).toString()).toBe(scaled.values[field]);
        numerical.push({quantity,code:definition.code,value:actual});
      }
    }
    const oracle=JSON.parse(readFileSync("tests/fixtures/full35-app-oracle.json","utf8")) as {cases:Array<{code:string;amount:string;quantity:string;expected:string}>};
    const vectors=oracle.cases.map(v=>`('${v.code}',${v.amount},${v.quantity},${v.expected})`).join(",");
    const oracleResult=json(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';
      with vectors(code,amount,quantity,expected) as(values ${vectors}),definitions as(select d from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) d)
      select jsonb_build_object('cases',count(*),'mismatches',count(*)filter(where private.diary_scaled_amount_v1(amount,quantity,1000,1000,100,(d->>'precision')::integer,(d->>'maximum')::numeric) is distinct from expected))
      from vectors join definitions on d->>'code'=code;rollback;`,transition.consumer);
    expect(oracleResult).toEqual({cases:245,mismatches:0});evidence.independentDecimalOracle=oracleResult;
    evidence.negativeMatrix=rejectedAtomic;evidence.numerical=numerical;evidence.timeout={code:timed.error?.code,noReceipt:true};
    // The compensation uses independently prepared/approved migration47 APIs.
    const receiptId=query("select id from ingestion.mapping_reprojection_receipts order by id limit 1");
    const compensation=transition.prepareCompensation(receiptId);
    const compensationKey=randomUUID();const compensationRequest={...automaticArgs,p_notes:diaryFirst?"atomic-barrier":"",p_idempotency_key:compensationKey};
    if(diaryFirst){
      await controller.send("select pg_advisory_lock(73535004);");
      const diary=client.rpc("create_reference_diary_entry_v1",compensationRequest).single().then(r=>r);
      await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where usename='authenticator' and wait_event='advisory';"))).toBe(1);
      const compensator=asyncQuery(`set application_name='atomicity_compensator';begin;${compensation.execution}commit;`,operator);
      await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where application_name='atomicity_compensator' and wait_event='advisory';"))).toBe(1);
      locks.compensationWaitsForDiary=lockSnapshot();await controller.send("select pg_advisory_unlock(73535004);");
      expect((await diary).data?.result_status).toBe("success");await compensator;
    }else{
      await controller.send("select pg_advisory_lock(73535005);");
      const compensator=asyncQuery(`set application_name='atomicity_compensator';begin;${compensation.execution}select pg_advisory_xact_lock(73535005);commit;`,operator);
      await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where application_name='atomicity_compensator' and wait_event='advisory';")),{timeout:90000}).toBe(1);
      const diary=client.rpc("create_reference_diary_entry_v1",compensationRequest).single().then(r=>r);
      await expect.poll(()=>Number(query("select count(*) from pg_stat_activity where usename='authenticator' and wait_event='advisory';"))).toBe(1);
      locks.diaryWaitsForCompensation=lockSnapshot();await controller.send("select pg_advisory_unlock(73535005);");await compensator;
      const outcome=await diary;expect(outcome.error).toBeNull();expect(outcome.data?.result_status).toBe("reference_changed");
      expect(outcome.data?.reference_fingerprint).toBe((await reference()).reference_fingerprint);
      expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key",compensationKey)).data).toEqual([]);
      evidence.postWaitSnapshot=outcome.data;
    }
    evidence.compensation={diaryFirst,reference:await reference(),counts:counts()};
    evidence.finalCounts = counts();
    const network = await controlCall("/status"); evidence.network = network;
    if (!diaryFirst) {
    const held = network.events.find((event: { held?: boolean }) => event.held);
    const heldRead = network.events.filter((event: { kind: string; processPid: number; at: string }) =>
      event.kind === "reference-read-completed" && event.processPid === held.processPid && Date.parse(event.at) < Date.parse(held.at)).at(-1);
    const start = network.events.find((event: { kind: string; args?: { p_idempotency_key: string } }) =>
      event.kind === "diary-rpc-start" && event.args?.p_idempotency_key === pending.key);
    const committed = (evidence.governedExecution as Array<{ kind?: string; at: string }>).find(event => event.kind === "governed-committed")!;
    expect(heldRead.data[0].reference_fingerprint).toBe(a.reference_fingerprint);
    expect(held.args.p_idempotency_key).toBe(pending.key);
    expect(Date.parse(heldRead.at)).toBeLessThan(Date.parse(held.at));
    expect(Date.parse(held.at)).toBeLessThan(Date.parse(committed.at));
    expect(Date.parse(committed.at)).toBeLessThan(Date.parse(start.at));
    expect((evidence.mainOutcome as { referenceChanged: boolean }).referenceChanged).toBe(true);
    expect((evidence.commitBeforeRead as { rows: unknown[] }).rows).toEqual([]);
    }
    evidence.verdict = "ATOMIC_PERSISTENCE_RACE_CLOSED";
  } finally {
    for (const s of sessions.reverse()) await s.close();
    await context.close();
    const installed = evidence.installed; delete evidence.installed;
    for (const [name, value] of [["atomicity-observations", evidence], ["installed-architecture", installed], ["lock-evidence", locks]] as const) {
      await test.info().attach(name, { body: Buffer.from(JSON.stringify(value, null, 2)), contentType: "application/json" });
    }
  }
});
