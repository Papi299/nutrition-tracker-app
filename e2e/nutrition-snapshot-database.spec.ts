import {
  provisionActivatedLocalUser,
  provisionUnactivatedLocalUser,
  queryLocalAuthFixture,
} from "@/e2e/helpers/local-auth";
import { additionalNutrientCodesV1, nutrientManifestV1 } from "@/lib/nutrition-snapshots/manifest";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const password = "SyntheticSnapshotDatabase123!";
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
type MutationRow = { result_status: string; diary_entry_id: string; completed_at: string; entry?: unknown };
type ReferenceRow = {
  food_id: string; nutrient_basis: string; serving_quantity: number; serving_unit: string;
  nutrients: Record<string, string | null>; reference_fingerprint: string;
  source_updated_at: string; is_owned: boolean;
};

test.skip(!localOnly || !localUrl || !localKey,
  "Snapshot database acceptance requires the disposable local fixture runner.");

function localClient() {
  return createClient(localUrl!, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
}

function request(overrides: Record<string, number | null> = {}) {
  return {
    version: 1,
    values: additionalNutrientCodesV1.map((code, index) => ({
      code, amount: Object.hasOwn(overrides, code) ? overrides[code] : index + 1.1234,
    })),
  };
}

function stored(overrides: Record<string, number | null> = {}) {
  return {
    version: 1,
    values: Object.fromEntries(request(overrides).values.map(({ code, amount }) => [code, amount])),
  };
}

function createArguments(key = randomUUID(), overrides: Record<string, unknown> = {}) {
  return {
    p_idempotency_key: key, p_entry_date: "2026-10-24", p_meal_type: "lunch",
    p_food_id: null, p_food_name: `Synthetic snapshot ${key}`, p_brand_name: null,
    p_serving_quantity: 200, p_serving_unit: "g", p_calories: 400,
    p_protein_g: 40, p_carbohydrates_g: 40, p_fat_g: 10, p_notes: null,
    ...overrides,
  };
}

test.describe.serial("35-nutrient database snapshot boundaries", () => {
  let owner: ReturnType<typeof localClient>;
  let other: ReturnType<typeof localClient>;
  let unactivated: ReturnType<typeof localClient>;
  let ownerId: string;

  test.beforeAll(async () => {
    owner = localClient();
    other = localClient();
    unactivated = localClient();
    const first = await provisionActivatedLocalUser(owner, {
      email: `snapshot-owner-${randomUUID()}@example.test`, password,
    });
    ownerId = first.data.user!.id;
    await provisionActivatedLocalUser(other, { email: `snapshot-other-${randomUUID()}@example.test`, password });
    await provisionUnactivatedLocalUser(unactivated, { email: `snapshot-inactive-${randomUUID()}@example.test`, password });
  });

  test("agrees with the frozen application manifest and retains invoker-only API authority", async () => {
    const manifest = await owner.rpc("nutrient_snapshot_manifest_v1");
    expect(manifest.error).toBeNull();
    expect(manifest.data).toEqual(nutrientManifestV1);
    expect(nutrientManifestV1).toHaveLength(35);
    expect(additionalNutrientCodesV1).toHaveLength(31);
    const boundaries = queryLocalAuthFixture(`
      select p.proname || '|' || p.prosecdef || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|' ||
        has_function_privilege('anon', p.oid, 'execute') || '|' ||
        has_function_privilege('authenticated', p.oid, 'execute')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'create_manual_diary_entry_v2', 'update_manual_diary_entry_v2',
        'get_readable_food_nutrition_reference_v1', 'nutrient_snapshot_manifest_v1',
        'persist_saved_meal_v2', 'persist_recipe_v2',
        'get_owned_saved_meal_editor_v2', 'get_owned_recipe_editor_v2',
        'get_owned_recipe_use_contract_v2', 'log_saved_meal_to_diary_v2', 'log_recipe_to_diary_v2'
      ) order by p.proname;
    `).split("\n");
    expect(boundaries).toHaveLength(11);
    for (const boundary of boundaries) expect(boundary).toMatch(/\|false\|search_path=""\|false\|true$/);
    // Supabase Postgres issue #2112 can crash the local vendor image on an
    // anonymous RPC denied EXECUTE. Verify the catalog ACL above and exercise
    // an actual anonymous table denial instead: https://github.com/supabase/postgres/issues/2112.
    const anonymousRead = await localClient().from("diary_entries").select("id");
    expect(anonymousRead.error?.code).toBe("42501");
    expect(queryLocalAuthFixture(`
      select prosecdef || '|' || array_to_string(proconfig, ',') || '|' ||
        has_function_privilege('anon', oid, 'execute') || '|' ||
        has_function_privilege('authenticated', oid, 'execute')
      from pg_proc where oid = 'private.insert_completed_manual_diary_entry_request(uuid,jsonb,uuid)'::regprocedure;
    `)).toBe('true|search_path=""|false|true');
  });

  test("v2 reads physical catalog metadata with the same authority and fingerprints serving-only changes", async () => {
    expect(queryLocalAuthFixture(`
      select prosecdef || '|' || array_to_string(proconfig, ',') || '|' ||
        has_function_privilege('anon', oid, 'execute') || '|' ||
        has_function_privilege('authenticated', oid, 'execute')
      from pg_proc where oid = 'public.get_readable_food_nutrition_reference_v2(uuid)'::regprocedure;
    `)).toBe('false|search_path=""|false|true');
    for (const basis of ["per_100g", "per_serving"]) {
      const id = randomUUID();
      queryLocalAuthFixture(`
        insert into public.foods(id,food_type,name,locale,serving_size,serving_unit,data_quality,
          owner_user_id,is_public,custom_nutrient_basis)
        values('${id}','user_custom','Synthetic private 50 g serving','en',50,'g','user_provided',
          '${ownerId}',false,'${basis}');
        insert into public.food_nutrients(food_id,nutrient_id,amount,basis) values
          ('${id}',(select id from public.nutrients where code='energy_kcal'),201.4,'${basis}');
      `);
      const args = { p_food_id: id };
      const first = await owner.rpc("get_readable_food_nutrition_reference_v2", args).single<ReferenceRow & { catalog_serving_quantity: number; catalog_serving_unit: string }>();
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ nutrient_basis: basis, serving_quantity: basis === "per_100g" ? 100 : 50,
        serving_unit: "g", catalog_serving_quantity: 50, catalog_serving_unit: "g", nutrients: { energy_kcal: expect.any(String) } });
      const legacy = await owner.rpc("get_readable_food_nutrition_reference_v1", args).single<ReferenceRow>();
      expect(legacy.error).toBeNull();
      expect(legacy.data).not.toHaveProperty("catalog_serving_quantity");
      expect(legacy.data!.nutrients).toEqual(first.data!.nutrients);
      for (const denied of [other, unactivated]) {
        const hidden = await denied.rpc("get_readable_food_nutrition_reference_v2", args);
        expect(hidden.error).toBeNull();
        expect(hidden.data).toEqual([]);
      }
      queryLocalAuthFixture(`update public.foods set serving_size=25 where id='${id}'`);
      const changed = await owner.rpc("get_readable_food_nutrition_reference_v2", args).single<ReferenceRow & { catalog_serving_quantity: number; catalog_serving_unit: string }>();
      expect(changed.error).toBeNull();
      expect(changed.data!.catalog_serving_quantity).toBe(25);
      expect(changed.data!.reference_fingerprint).not.toBe(first.data!.reference_fingerprint);
      expect(changed.data!.nutrients).toEqual(first.data!.nutrients);
      queryLocalAuthFixture(`update public.foods set is_archived=true where id='${id}'`);
      expect((await owner.rpc("get_readable_food_nutrition_reference_v2", args)).data).toEqual([]);
    }
  });

  test("keeps the private receipt attestation closed to an activated but closed account", () => {
    const result = queryLocalAuthFixture(`
      begin;
      insert into public.account_closures(user_id,closure_request_id,closure_policy_version)
      values ('${ownerId}',gen_random_uuid(),'p11e-e5-account-closure-v1');
      select set_config('request.jwt.claim.sub','${ownerId}',true);
      set local role authenticated;
      do $$ begin
        perform private.insert_completed_manual_diary_entry_request(null,null,null);
        raise exception 'Closed owner receipt attestation unexpectedly succeeded';
      exception when insufficient_privilege then
        if SQLERRM <> 'account_access_required' then raise; end if;
      end $$;
      select 'closed_owner_receipt_denied';
      rollback;
    `);
    expect(result).toContain("closed_owner_receipt_denied");
  });

  test("stores all 31 values with independent null/zero semantics and exact new receipt replay", async () => {
    const args = { ...createArguments(), p_additional_nutrients: request({ fiber_g: 0, vitamin_b12_ug: null }) };
    const first = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(first.error).toBeNull();
    expect(first.data?.result_status).toBe("success");
    const replay = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);
    const saved = await owner.from("diary_entries").select("*").eq("id", first.data!.diary_entry_id).single();
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({
      user_id: ownerId, calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10,
      additional_nutrient_snapshot: stored({ fiber_g: 0, vitamin_b12_ug: null }),
    });
    const receipt = await owner.from("manual_diary_entry_requests").select("request_payload")
      .eq("idempotency_key", args.p_idempotency_key).single();
    expect(receipt.data?.request_payload).toMatchObject({
      contract_version: 2, additional_nutrient_snapshot: stored({ fiber_g: 0, vitamin_b12_ug: null }),
    });
    const changed = await owner.rpc("create_manual_diary_entry_v2", {
      ...args, p_additional_nutrients: request({ fiber_g: 1, vitamin_b12_ug: null }),
    }).single<MutationRow>();
    expect(changed.error).toBeNull();
    expect(changed.data?.result_status).toBe("idempotency_conflict");
    const rows = await owner.from("diary_entries").select("id", { count: "exact", head: true }).eq("food_name", args.p_food_name);
    expect(rows.count).toBe(1);
    const concurrentArgs = { ...createArguments(), p_additional_nutrients: request() };
    const concurrent = await Promise.all([0, 1, 2].map(() =>
      owner.rpc("create_manual_diary_entry_v2", concurrentArgs).single<MutationRow>()));
    for (const result of concurrent) {
      expect(result.error).toBeNull();
      expect(result.data).toEqual(concurrent[0].data);
    }
    const unknownValues = Object.fromEntries(additionalNutrientCodesV1.map(code => [code, null]));
    const capturedUnknown = await owner.rpc("create_manual_diary_entry_v2", {
      ...createArguments(), p_additional_nutrients: request(unknownValues),
    }).single<MutationRow>();
    expect(capturedUnknown.error).toBeNull();
    const unknownRow = await owner.from("diary_entries").select("additional_nutrient_snapshot")
      .eq("id", capturedUnknown.data!.diary_entry_id).single();
    expect(unknownRow.data?.additional_nutrient_snapshot).toEqual(stored(unknownValues));
  });

  test("preserves original four-field receipts and uncaptured historical extensions", async () => {
    const args = createArguments();
    const first = await owner.rpc("create_manual_diary_entry", args).single<MutationRow>();
    expect(first.error).toBeNull();
    const replay = await owner.rpc("create_manual_diary_entry", args).single<MutationRow>();
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);
    const row = await owner.from("diary_entries").select("additional_nutrient_snapshot,calories,version")
      .eq("id", first.data!.diary_entry_id).single();
    expect(row.data).toEqual({ additional_nutrient_snapshot: null, calories: 400, version: 1 });
    const receipt = await owner.from("manual_diary_entry_requests").select("request_payload")
      .eq("idempotency_key", args.p_idempotency_key).single();
    expect(receipt.error).toBeNull();
    expect(receipt.data?.request_payload).not.toHaveProperty("additional_nutrient_snapshot");
  });

  test("reads one dense raw reference across all nutrients and supports extension-only foods", async () => {
    for (const fixture of [
      { basis: "per_100g", quantity: 100, unit: "g", extensionOnly: false },
      { basis: "per_100ml", quantity: 100, unit: "ml", extensionOnly: true },
      { basis: "per_serving", quantity: 2, unit: "slices", extensionOnly: false },
    ]) {
      const referenceAmounts = nutrientManifestV1.map(({ code }, index) => ({
        code, amount: code === "energy_kcal" ? 201.4 : index + 1.1234,
      })).filter(({ code }) => !fixture.extensionOnly || code === "vitamin_d_ug");
      const created = await owner.rpc("create_custom_food", {
        p_aliases: [], p_brand_name: "Synthetic reference", p_idempotency_key: randomUUID(),
        p_locale: "en", p_name: `Synthetic coherent ${fixture.basis}`, p_nutrient_basis: fixture.basis,
        p_nutrients: referenceAmounts, p_serving_quantity: fixture.quantity, p_serving_unit: fixture.unit,
      }).single<{ food_id: string }>();
      expect(created.error).toBeNull();
      const reference = await owner.rpc("get_readable_food_nutrition_reference_v1", { p_food_id: created.data!.food_id })
        .single<ReferenceRow>();
      expect(reference.error).toBeNull();
      expect(reference.data).toMatchObject({
        food_id: created.data!.food_id, nutrient_basis: fixture.basis,
        serving_quantity: fixture.quantity, serving_unit: fixture.unit, is_owned: true,
      });
      expect(reference.data!.reference_fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isFinite(Date.parse(reference.data!.source_updated_at))).toBe(true);
      expect(Object.keys(reference.data!.nutrients).sort()).toEqual(nutrientManifestV1.map(({ code }) => code).sort());
      for (const { code } of nutrientManifestV1) {
        const expected = referenceAmounts.find(item => item.code === code)?.amount;
        const actual = reference.data!.nutrients[code];
        if (expected === undefined) expect(actual).toBeNull();
        else {
          expect(typeof actual).toBe("string");
          expect(Number(actual)).toBe(expected);
        }
      }
      if (!fixture.extensionOnly) expect(Number(reference.data!.nutrients.energy_kcal)).toBe(201.4);
      const hidden = await other.rpc("get_readable_food_nutrition_reference_v1", { p_food_id: created.data!.food_id });
      expect(hidden.error).toBeNull();
      expect(hidden.data).toEqual([]);
      const inactive = await unactivated.rpc("get_readable_food_nutrition_reference_v1", { p_food_id: created.data!.food_id });
      expect(inactive.error).toBeNull();
      expect(inactive.data).toEqual([]);
    }
    const publicId = randomUUID();
    queryLocalAuthFixture(`
      insert into public.foods(id,food_type,name,locale,serving_size,serving_unit,data_quality,is_public,source_id)
      values('${publicId}','generic','Synthetic public coherent reference','en',2,'slices','verified',true,
        (select id from public.food_sources where code='manual'));
      insert into public.food_nutrients(food_id,nutrient_id,amount,basis) values
        ('${publicId}',(select id from public.nutrients where code='energy_kcal'),201.4,'per_100g'),
        ('${publicId}',(select id from public.nutrients where code='vitamin_d_ug'),2.25,'per_serving'),
        ('${publicId}',(select id from public.nutrients where code='protein_g'),7.5,'per_100ml');
    `);
    const publicReference = await owner.rpc("get_readable_food_nutrition_reference_v1", { p_food_id: publicId }).single<ReferenceRow>();
    expect(publicReference.error).toBeNull();
    expect(publicReference.data).toMatchObject({ is_owned: false, nutrient_basis: "per_serving", serving_quantity: 2, serving_unit: "slices" });
    expect(Number(publicReference.data!.nutrients.vitamin_d_ug)).toBe(2.25);
    expect(publicReference.data!.nutrients.energy_kcal).toBeNull();
    expect(publicReference.data!.nutrients.protein_g).toBeNull();
  });

  test("replays the completed extended snapshot after source edits, archival, and deletion", async () => {
    const source = await owner.rpc("create_custom_food", {
      p_aliases: [], p_brand_name: "Synthetic replay reference", p_idempotency_key: randomUUID(),
      p_locale: "en", p_name: "Synthetic replay source", p_nutrient_basis: "per_100g",
      p_nutrients: [{ code: "vitamin_d_ug", amount: 1 }], p_serving_quantity: 100, p_serving_unit: "g",
    }).single<{ food_id: string }>();
    expect(source.error).toBeNull();
    const sourceId = source.data!.food_id;
    const before = await owner.rpc("get_readable_food_nutrition_reference_v1", { p_food_id: sourceId }).single<ReferenceRow>();
    expect(before.error).toBeNull();
    const args = { ...createArguments(), p_food_id: sourceId, p_additional_nutrients: request() };
    const first = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(first.error).toBeNull();
    const nutrient = await owner.from("nutrients").select("id").eq("code", "vitamin_d_ug").single();
    expect(nutrient.error).toBeNull();
    const changed = await owner.from("food_nutrients").update({ amount: 99 })
      .eq("food_id", sourceId).eq("nutrient_id", nutrient.data!.id);
    expect(changed.error).toBeNull();
    const after = await owner.rpc("get_readable_food_nutrition_reference_v1", { p_food_id: sourceId }).single<ReferenceRow>();
    expect(after.error).toBeNull();
    expect(Number(after.data!.nutrients.vitamin_d_ug)).toBe(99);
    expect(after.data!.reference_fingerprint).not.toBe(before.data!.reference_fingerprint);
    const editedReplay = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(editedReplay.error).toBeNull();
    expect(editedReplay.data).toEqual(first.data);
    const archived = await owner.rpc("set_custom_food_archived", { p_food_id: sourceId, p_is_archived: true });
    expect(archived.error).toBeNull();
    const archivedReplay = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(archivedReplay.error).toBeNull();
    expect(archivedReplay.data).toEqual(first.data);
    const removed = await owner.from("foods").delete().eq("id", sourceId);
    expect(removed.error).toBeNull();
    const deletedReplay = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(deletedReplay.error).toBeNull();
    expect(deletedReplay.data).toEqual(first.data);
    const row = await owner.from("diary_entries").select("food_id,additional_nutrient_snapshot")
      .eq("id", first.data!.diary_entry_id).single();
    expect(row.data).toEqual({ food_id: null, additional_nutrient_snapshot: stored() });
  });

  test("rejects duplicate, incomplete, unsupported, malformed, and oversized requests without partial writes", async () => {
    const valid = request();
    const malformed: unknown[] = [
      { ...valid, version: 2 },
      { ...valid, extra: true },
      { version: 1, values: {} },
      { version: 1, values: valid.values.slice(1) },
      { version: 1, values: [valid.values[1], ...valid.values.slice(1)] },
      { version: 1, values: [...valid.values, { code: "unsupported_nutrient", amount: 1 }] },
      { version: 1, values: [{ ...valid.values[0], unit: "g" }, ...valid.values.slice(1)] },
      { version: 1, values: [{ ...valid.values[0], amount: "1" }, ...valid.values.slice(1)] },
      { version: 1, values: [{ ...valid.values[0], amount: -1 }, ...valid.values.slice(1)] },
      { version: 1, values: [{ ...valid.values[0], amount: "NaN" }, ...valid.values.slice(1)] },
      { version: 1, values: [{ ...valid.values[0], amount: 10_000_000_000 }, ...valid.values.slice(1)] },
      { ...valid, padding: "x".repeat(100_000) },
    ];
    for (const envelope of malformed) {
      const args = { ...createArguments(), p_additional_nutrients: envelope };
      const result = await owner.rpc("create_manual_diary_entry_v2", args);
      expect(result.error, JSON.stringify(envelope).slice(0, 250)).not.toBeNull();
      const receipt = await owner.from("manual_diary_entry_requests").select("id", { count: "exact", head: true })
        .eq("idempotency_key", args.p_idempotency_key);
      const row = await owner.from("diary_entries").select("id", { count: "exact", head: true })
        .eq("food_name", args.p_food_name);
      expect(receipt.count).toBe(0);
      expect(row.count).toBe(0);
    }
  });

  test("enforces final four-decimal rounding and the post-round storage bound", async () => {
    const args = { ...createArguments(), p_additional_nutrients: request({ fiber_g: 1.23445, sodium_mg: 9_999_999_999.9999 }) };
    const created = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(created.error).toBeNull();
    const row = await owner.from("diary_entries").select("additional_nutrient_snapshot")
      .eq("id", created.data!.diary_entry_id).single();
    expect(row.data?.additional_nutrient_snapshot).toEqual(stored({ fiber_g: 1.2345, sodium_mg: 9_999_999_999.9999 }));
    const overflow = await owner.rpc("create_manual_diary_entry_v2", {
      ...createArguments(), p_additional_nutrients: request({ sodium_mg: 9_999_999_999.99995 }),
    });
    expect(overflow.error).not.toBeNull();
  });

  test("validates directly written stored snapshots and attests every captured value", async () => {
    const valid = stored();
    const missing = { ...valid.values };
    delete missing.fiber_g;
    for (const extension of [
      { ...valid, version: 2 },
      { ...valid, values: missing },
      { ...valid, values: { ...valid.values, calories: 1 } },
      { ...valid, values: { ...valid.values, fiber_g: "1" } },
      { ...valid, values: { ...valid.values, fiber_g: 1.23445 } },
      { ...valid, values: { ...valid.values, fiber_g: -1 } },
      request(),
    ]) {
      const result = await owner.from("diary_entries").insert({
        user_id: ownerId, entry_date: "2026-10-24", food_name: "Malformed stored snapshot",
        meal_type: "other", source: "manual", additional_nutrient_snapshot: extension,
      });
      expect(result.error).not.toBeNull();
    }
    const requestKey = randomUUID();
    expect(() => queryLocalAuthFixture(`
      begin;
      set local role authenticated;
      set local request.jwt.claim.sub = '${ownerId}';
      do $$
      declare v_id uuid; v_payload jsonb;
      begin
        insert into public.diary_entries (user_id,entry_date,meal_type,food_name,source,additional_nutrient_snapshot)
        values ('${ownerId}','2026-10-24','other','Synthetic incomplete attestation','manual','${JSON.stringify(valid)}'::jsonb)
        returning id into v_id;
        select jsonb_build_object(
          'entry_date',entry_date,'meal_type',meal_type,'food_id',food_id,'food_name',food_name,
          'brand_name',brand_name,'serving_quantity',serving_quantity,'serving_unit',serving_unit,
          'calories',calories,'protein_g',protein_g,'carbohydrates_g',carbohydrates_g,'fat_g',fat_g,'notes',notes
        ) into v_payload from public.diary_entries where id=v_id;
        perform private.insert_completed_manual_diary_entry_request('${requestKey}',v_payload,v_id);
      end;
      $$;
      rollback;
    `)).toThrow();
    const receipt = await owner.from("manual_diary_entry_requests").select("id", { count: "exact", head: true })
      .eq("idempotency_key", requestKey);
    expect(receipt.count).toBe(0);
  });

  test("retains owner, activated-account, anonymous, immutable provenance, and optimistic-lock boundaries", async () => {
    const args = { ...createArguments(), p_additional_nutrients: request() };
    const created = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(created.error).toBeNull();
    const id = created.data!.diary_entry_id;
    const hidden = await other.from("diary_entries").select("id").eq("id", id);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);
    const unauthorized = await other.rpc("update_manual_diary_entry_v2", {
      p_id: id, p_expected_version: 1, p_patch: { additional_nutrient_snapshot: request({ fiber_g: 777 }) },
    });
    expect(unauthorized.data?.[0]?.result_status ?? unauthorized.error?.code).toMatch(/not_found|42501/);
    const inactiveCreate = await unactivated.rpc("create_manual_diary_entry_v2", { ...args, p_idempotency_key: randomUUID() });
    expect(inactiveCreate.error).not.toBeNull();
    const update = await owner.rpc("update_manual_diary_entry_v2", {
      p_id: id, p_expected_version: 1, p_patch: { additional_nutrient_snapshot: request({ fiber_g: 99 }) },
    }).single<MutationRow>();
    expect(update.error).toBeNull();
    expect(update.data?.result_status).toBe("success");
    const stale = await owner.rpc("update_manual_diary_entry_v2", {
      p_id: id, p_expected_version: 1, p_patch: { additional_nutrient_snapshot: request({ fiber_g: 100 }) },
    }).single<MutationRow>();
    expect(stale.error?.code ?? stale.data?.result_status).toMatch(/PT409|conflict/);
    const coreOnly = await owner.from("diary_entries").update({ notes: "Legacy core-only edit preserves captured nutrients" })
      .eq("id", id).eq("version", 2).select("additional_nutrient_snapshot,version").single();
    expect(coreOnly.error).toBeNull();
    expect(coreOnly.data).toEqual({ additional_nutrient_snapshot: stored({ fiber_g: 99 }), version: 3 });
    const clear = await owner.from("diary_entries").update({ additional_nutrient_snapshot: null }).eq("id", id);
    expect(clear.error).not.toBeNull();
    const tamper = await owner.rpc("update_manual_diary_entry_v2", {
      p_id: id, p_expected_version: 3, p_patch: { user_id: randomUUID(), source: "recipe" },
    });
    expect(tamper.error).not.toBeNull();
  });

  test("copies Saved Meal consumed snapshots and guards extension-only changes against legacy and stale writers", async () => {
    const item = {
      item_id: null, position: 1, food_id: null, food_name: "Synthetic saved complete snapshot", brand_name: null,
      serving_quantity: 200, serving_unit: "g", calories: 400, protein_g: 40,
      carbohydrates_g: 40, fat_g: 10, notes: null, additional_nutrient_snapshot: request(),
    };
    const args = {
      p_saved_meal_id: null, p_expected_edit_revision: null, p_name: `Synthetic saved ${randomUUID()}`,
      p_locale: "en", p_items: [item],
    };
    const created = await owner.rpc("persist_saved_meal_v2", args).single<{ saved_meal_id: string }>();
    expect(created.error).toBeNull();
    const id = created.data!.saved_meal_id;
    const initial = await owner.from("saved_meals").select("saved_meal_edit_revision,updated_at").eq("id", id).single();
    expect(initial.error).toBeNull();
    expect(initial.data?.saved_meal_edit_revision).toBe(1);
    const sourceItem = await owner.from("saved_meal_items").select("id,additional_nutrient_snapshot").eq("saved_meal_id", id).single();
    expect(sourceItem.data?.additional_nutrient_snapshot).toEqual(stored());
    const unauthorizedEdit = await owner.from("saved_meal_items")
      .update({ additional_nutrient_snapshot: stored({ fiber_g: 99 }) }).eq("id", sourceItem.data!.id);
    expect(unauthorizedEdit.error).not.toBeNull();
    const logArgs = {
      p_saved_meal_id: id, p_expected_updated_at: initial.data!.updated_at,
      p_idempotency_key: randomUUID(), p_entry_date: "2026-10-24", p_meal_type: "lunch",
    };
    const logged = await owner.rpc("log_saved_meal_to_diary_v2", logArgs).single<{ result_status: string; diary_run_id: string }>();
    expect(logged.error).toBeNull();
    expect(logged.data?.result_status).toBe("success");
    const copied = await owner.from("diary_entries").select("calories,serving_quantity,additional_nutrient_snapshot")
      .eq("saved_meal_diary_run_id", logged.data!.diary_run_id).single();
    expect(copied.data).toEqual({ calories: 400, serving_quantity: 200, additional_nutrient_snapshot: stored() });
    const editArgs = {
      ...args, p_saved_meal_id: id, p_expected_edit_revision: 1,
      p_items: [{ ...item, item_id: sourceItem.data!.id, additional_nutrient_snapshot: request({ fiber_g: 99 }) }],
    };
    const edited = await owner.rpc("persist_saved_meal_v2", editArgs);
    expect(edited.error).toBeNull();
    const parent = await owner.from("saved_meals").select("saved_meal_edit_revision").eq("id", id).single();
    expect(parent.data?.saved_meal_edit_revision).toBe(2);
    const editor = await owner.rpc("get_owned_saved_meal_editor_v2", { p_saved_meal_id: id })
      .single<{ items: { additional_nutrient_snapshot: unknown }[] }>();
    expect(editor.error).toBeNull();
    expect(editor.data?.items[0]).toMatchObject({ id: sourceItem.data!.id });
    expect(editor.data?.items[0].additional_nutrient_snapshot).toEqual(stored({ fiber_g: 99 }));
    const legacyRead = await owner.rpc("get_owned_saved_meal_editor", { p_saved_meal_id: id });
    expect(legacyRead.error).not.toBeNull();
    const stale = await owner.rpc("persist_saved_meal_v2", {
      ...editArgs, p_items: [{ ...item, item_id: sourceItem.data!.id, additional_nutrient_snapshot: request({ fiber_g: 100 }) }],
    });
    expect(stale.error?.code).toBe("PT409");
    const { additional_nutrient_snapshot: omitted, item_id: omittedId, ...legacyItem } = item;
    expect(omitted).toBeDefined();
    expect(omittedId).toBeNull();
    const erasure = await owner.rpc("persist_saved_meal_v2", {
      ...editArgs, p_expected_edit_revision: 2,
      p_items: [{ ...item, item_id: sourceItem.data!.id, additional_nutrient_snapshot: null }],
    });
    expect(erasure.error).not.toBeNull();
    const legacyEdit = await owner.rpc("persist_saved_meal", {
      ...args, p_saved_meal_id: id, p_expected_edit_revision: 2, p_items: [legacyItem],
    });
    expect(legacyEdit.error).not.toBeNull();
    const legacyLog = await owner.rpc("log_saved_meal_to_diary", { ...logArgs, p_idempotency_key: randomUUID() });
    expect(legacyLog.error ?? legacyLog.data?.[0]?.result_status).not.toBe("success");
    const replay = await owner.rpc("log_saved_meal_to_diary_v2", logArgs).single<{ result_status: string; diary_run_id: string }>();
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(logged.data);
    const history = await owner.from("diary_entries").select("additional_nutrient_snapshot")
      .eq("saved_meal_diary_run_id", logged.data!.diary_run_id).single();
    expect(history.data?.additional_nutrient_snapshot).toEqual(stored());
  });

  test("aggregates every Recipe nutrient independently and protects extension-only revisions", async () => {
    const amounts = Object.fromEntries(additionalNutrientCodesV1.map((code, index) => [code, index + 1]));
    const ingredient = {
      ingredient_id: null, position: 1, food_id: null, ingredient_name: "Synthetic recipe first", brand_name: null,
      quantity: 200, unit: "g", calories: 400, protein_g: 40,
      carbohydrates_g: 40, fat_g: 10, notes: null, additional_nutrient_snapshot: request(amounts),
    };
    const args = {
      p_recipe_id: null, p_expected_edit_revision: null, p_name: `Synthetic recipe ${randomUUID()}`,
      p_locale: "en", p_yield_servings: 2,
      p_ingredients: [ingredient, {
        ...ingredient, position: 2, ingredient_name: "Synthetic recipe second", calories: 200,
        protein_g: 20, carbohydrates_g: 20, fat_g: 5,
        additional_nutrient_snapshot: request({ ...amounts, fiber_g: null, sodium_mg: 0 }),
      }],
    };
    const created = await owner.rpc("persist_recipe_v2", args).single<{ recipe_id: string }>();
    expect(created.error).toBeNull();
    const id = created.data!.recipe_id;
    const expected = Object.fromEntries(additionalNutrientCodesV1.map(code => [
      code, code === "fiber_g" ? null : code === "sodium_mg" ? amounts[code] * 1.5 : amounts[code] * 3,
    ]));
    const contract = await owner.rpc("get_owned_recipe_use_contract_v2", { p_recipe_id: id, p_requested_servings: 3 })
      .single<{ additional_nutrient_snapshot: unknown; diary_calories: number }>();
    expect(contract.error).toBeNull();
    expect(contract.data?.additional_nutrient_snapshot).toEqual(stored(expected));
    expect(contract.data?.diary_calories).toBe(900);
    const parent = await owner.from("recipes").select("recipe_edit_revision,updated_at").eq("id", id).single();
    expect(parent.error).toBeNull();
    const children = await owner.from("recipe_ingredients").select("id,position").eq("recipe_id", id).order("position");
    expect(children.error).toBeNull();
    const firstChildId = children.data![0].id;
    const secondChildId = children.data![1].id;
    const unauthorizedEdit = await owner.from("recipe_ingredients")
      .update({ additional_nutrient_snapshot: stored({ ...amounts, fiber_g: 99 }) }).eq("id", firstChildId);
    expect(unauthorizedEdit.error).not.toBeNull();
    const logArgs = {
      p_recipe_id: id, p_requested_servings: 3, p_expected_updated_at: parent.data!.updated_at,
      p_idempotency_key: randomUUID(), p_entry_date: "2026-10-24", p_meal_type: "dinner",
    };
    const logged = await owner.rpc("log_recipe_to_diary_v2", logArgs).single<{ result_status: string; diary_run_id: string }>();
    expect(logged.error).toBeNull();
    expect(logged.data?.result_status).toBe("success");
    const row = await owner.from("diary_entries").select("calories,additional_nutrient_snapshot")
      .eq("recipe_diary_run_id", logged.data!.diary_run_id).single();
    expect(row.data).toEqual({ calories: 900, additional_nutrient_snapshot: stored(expected) });
    const changedIngredients = [
      { ...ingredient, ingredient_id: firstChildId, additional_nutrient_snapshot: request({ ...amounts, fiber_g: 99 }) },
      { ...args.p_ingredients[1], ingredient_id: secondChildId },
    ];
    const edited = await owner.rpc("persist_recipe_v2", {
      ...args, p_recipe_id: id, p_expected_edit_revision: 1, p_ingredients: changedIngredients,
    });
    expect(edited.error).toBeNull();
    const version = await owner.from("recipes").select("recipe_edit_revision").eq("id", id).single();
    expect(version.data?.recipe_edit_revision).toBe(2);
    const editor = await owner.rpc("get_owned_recipe_editor_v2", { p_recipe_id: id })
      .single<{ ingredients: { additional_nutrient_snapshot: unknown }[] }>();
    expect(editor.error).toBeNull();
    expect(editor.data?.ingredients[0]).toMatchObject({ id: firstChildId });
    expect(editor.data?.ingredients[0].additional_nutrient_snapshot).toEqual(stored({ ...amounts, fiber_g: 99 }));
    const legacyRead = await owner.rpc("get_owned_recipe_editor", { p_recipe_id: id });
    expect(legacyRead.error).not.toBeNull();
    const stale = await owner.rpc("persist_recipe_v2", { ...args, p_recipe_id: id, p_expected_edit_revision: 1 });
    expect(stale.error?.code).toBe("PT409");
    const erasure = await owner.rpc("persist_recipe_v2", {
      ...args, p_recipe_id: id, p_expected_edit_revision: 2,
      p_ingredients: [
        { ...ingredient, ingredient_id: firstChildId, additional_nutrient_snapshot: null },
        { ...args.p_ingredients[1], ingredient_id: secondChildId },
      ],
    });
    expect(erasure.error).not.toBeNull();
    const legacyIngredients = args.p_ingredients.map(({ additional_nutrient_snapshot, ingredient_id, ...legacy }) => {
      expect(additional_nutrient_snapshot).toBeDefined();
      expect(ingredient_id).toBeNull();
      return legacy;
    });
    const legacyEdit = await owner.rpc("persist_recipe", {
      ...args, p_recipe_id: id, p_expected_edit_revision: 2, p_ingredients: legacyIngredients,
    });
    expect(legacyEdit.error).not.toBeNull();
    const replay = await owner.rpc("log_recipe_to_diary_v2", logArgs).single<{ result_status: string; diary_run_id: string }>();
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(logged.data);
  });

  test("validates retained reuse child identities and allows mixed historical/captured reordering", async () => {
    for (const kind of ["saved_meal", "recipe"] as const) {
      const meal = kind === "saved_meal";
      const parentKey = meal ? "p_saved_meal_id" : "p_recipe_id";
      const collectionKey = meal ? "p_items" : "p_ingredients";
      const identityKey = meal ? "item_id" : "ingredient_id";
      const childTable = meal ? "saved_meal_items" : "recipe_ingredients";
      const parentColumn = meal ? "saved_meal_id" : "recipe_id";
      const row = {
        [identityKey]: null, position: 1, food_id: null, brand_name: null,
        ...(meal ? { food_name: "Synthetic retained captured", serving_quantity: 1, serving_unit: "bowl" }
          : { ingredient_name: "Synthetic retained captured", quantity: 1, unit: "bowl" }),
        calories: 10, protein_g: 1, carbohydrates_g: 1, fat_g: 1,
        notes: null, additional_nutrient_snapshot: request(),
      };
      const legacyRow = { ...row, position: 2, additional_nutrient_snapshot: null };
      const args = {
        [parentKey]: null, p_name: `Synthetic stable identity ${randomUUID()}`, p_locale: "en",
        p_expected_edit_revision: null, [collectionKey]: [row, legacyRow],
        ...(!meal ? { p_yield_servings: 1 } : {}),
      };
      const created = await owner.rpc(`persist_${kind}_v2`, args).single<Record<string, unknown>>();
      expect(created.error).toBeNull();
      const id = created.data![parentColumn] as string;
      const children = await owner.from(childTable).select("id,position").eq(parentColumn, id).order("position");
      expect(children.error).toBeNull();
      const capturedId = children.data![0].id;
      const historicalId = children.data![1].id;
      const foreign = await other.rpc(`persist_${kind}_v2`, {
        ...args, p_name: `Synthetic foreign child ${randomUUID()}`, [collectionKey]: [row],
      }).single<Record<string, unknown>>();
      expect(foreign.error).toBeNull();
      const foreignChild = await other.from(childTable).select("id").eq(parentColumn, foreign.data![parentColumn]).single();
      expect(foreignChild.error).toBeNull();
      for (const invalidRows of [
        [{ ...row, [identityKey]: capturedId }, { ...legacyRow, [identityKey]: capturedId, additional_nutrient_snapshot: request() }],
        [{ ...row, [identityKey]: capturedId }, { ...legacyRow, [identityKey]: randomUUID() }],
        [{ ...row, [identityKey]: capturedId }, { ...legacyRow, [identityKey]: foreignChild.data!.id }],
        [{ ...row, [identityKey]: capturedId, additional_nutrient_snapshot: null }, { ...legacyRow, [identityKey]: historicalId }],
      ]) {
        const invalid = await owner.rpc(`persist_${kind}_v2`, {
          ...args, [parentKey]: id, p_expected_edit_revision: 1, [collectionKey]: invalidRows,
        });
        expect(invalid.error).not.toBeNull();
      }
      const reordered = await owner.rpc(`persist_${kind}_v2`, {
        ...args, [parentKey]: id, p_expected_edit_revision: 1,
        [collectionKey]: [
          { ...legacyRow, position: 1, [identityKey]: historicalId },
          { ...row, position: 2, [identityKey]: capturedId },
        ],
      });
      expect(reordered.error).toBeNull();
      const after = await owner.from(childTable).select("id,position,additional_nutrient_snapshot")
        .eq(parentColumn, id).order("position");
      expect(after.data).toEqual([
        { id: historicalId, position: 1, additional_nutrient_snapshot: null },
        { id: capturedId, position: 2, additional_nutrient_snapshot: stored() },
      ]);
    }
  });

  test("replays legacy receipts exactly and rejects both cross-version directions without duplicates", async () => {
    for (const firstVersion of [1, 2]) {
      const args = createArguments();
      const originalName = firstVersion === 1 ? "create_manual_diary_entry" : "create_manual_diary_entry_v2";
      const alternateName = firstVersion === 1 ? "create_manual_diary_entry_v2" : "create_manual_diary_entry";
      const originalArgs = firstVersion === 1 ? args : { ...args, p_additional_nutrients: null };
      const alternateArgs = firstVersion === 1 ? { ...args, p_additional_nutrients: null } : args;
      const first = await owner.rpc(originalName, originalArgs).single<MutationRow>();
      expect(first.error).toBeNull();
      expect(first.data?.result_status).toBe("success");
      const crossVersion = await owner.rpc(alternateName, alternateArgs).single<MutationRow>();
      expect(crossVersion.error).toBeNull();
      expect(crossVersion.data?.result_status).toBe("idempotency_conflict");
      const replay = await owner.rpc(originalName, originalArgs).single<MutationRow>();
      expect(replay.error).toBeNull();
      expect(replay.data).toEqual(first.data);
      const rows = await owner.from("diary_entries").select("id", { count: "exact", head: true })
        .eq("food_name", args.p_food_name);
      expect(rows.count).toBe(1);
    }
    for (const kind of ["saved_meal", "recipe"] as const) {
      const meal = kind === "saved_meal";
      const parentKey = meal ? "p_saved_meal_id" : "p_recipe_id";
      const parentColumn = meal ? "saved_meal_id" : "recipe_id";
      const parentTable = meal ? "saved_meals" : "recipes";
      const runsTable = meal ? "saved_meal_diary_runs" : "recipe_diary_runs";
      const legacyChild = {
        position: 1, food_id: null, brand_name: null,
        ...(meal ? { food_name: "Synthetic legacy receipt item", serving_quantity: 1, serving_unit: "bowl" }
          : { ingredient_name: "Synthetic legacy receipt ingredient", quantity: 1, unit: "bowl" }),
        calories: 100, protein_g: 10, carbohydrates_g: 10, fat_g: 1, notes: null,
      };
      const source = await owner.rpc(`persist_${kind}`, {
        [parentKey]: null, p_expected_edit_revision: null, p_name: `Synthetic old receipts ${randomUUID()}`,
        p_locale: "en", [meal ? "p_items" : "p_ingredients"]: [legacyChild],
        ...(!meal ? { p_yield_servings: 1 } : {}),
      }).single<Record<string, unknown>>();
      expect(source.error).toBeNull();
      const id = source.data![parentColumn] as string;
      const parent = await owner.from(parentTable).select("updated_at").eq("id", id).single();
      expect(parent.error).toBeNull();
      for (const firstVersion of [1, 2]) {
        const args = {
          [parentKey]: id, p_expected_updated_at: parent.data!.updated_at,
          p_entry_date: "2026-10-24", p_meal_type: "other", p_idempotency_key: randomUUID(),
          ...(!meal ? { p_requested_servings: 1 } : {}),
        };
        const originalName = `log_${kind}_to_diary${firstVersion === 2 ? "_v2" : ""}`;
        const alternateName = `log_${kind}_to_diary${firstVersion === 1 ? "_v2" : ""}`;
        const first = await owner.rpc(originalName, args).single<{ result_status: string; diary_run_id: string }>();
        expect(first.error).toBeNull();
        expect(first.data?.result_status).toBe("success");
        const crossVersion = await owner.rpc(alternateName, args).single<{ result_status: string }>();
        expect(crossVersion.error).toBeNull();
        expect(crossVersion.data?.result_status).toBe("idempotency_conflict");
        const replay = await owner.rpc(originalName, args).single<{ result_status: string; diary_run_id: string }>();
        expect(replay.error).toBeNull();
        expect(replay.data).toEqual(first.data);
        const receipt = await owner.from(runsTable).select("snapshot_contract_version")
          .eq("id", first.data!.diary_run_id).single();
        expect(receipt.data?.snapshot_contract_version).toBe(firstVersion);
        const entries = await owner.from("diary_entries").select("additional_nutrient_snapshot", { count: "exact" })
          .eq(meal ? "saved_meal_diary_run_id" : "recipe_diary_run_id", first.data!.diary_run_id);
        expect(entries.error).toBeNull();
        expect(entries.count).toBe(1);
        expect(entries.data?.[0].additional_nutrient_snapshot).toBeNull();
      }
      const receipts = await owner.from(runsTable).select("id", { count: "exact", head: true }).eq(parentColumn, id);
      expect(receipts.count).toBe(2);
    }
  });

  test("rolls back the complete extended snapshot when receipt insertion fails", async () => {
    const args = { ...createArguments(), p_additional_nutrients: request() };
    queryLocalAuthFixture(`
      create function private.fail_snapshot_receipt_for_test() returns trigger
      language plpgsql security invoker set search_path = '' as $$
      begin
        if new.idempotency_key = '${args.p_idempotency_key}'::uuid then
          raise exception 'Synthetic extended receipt rollback';
        end if;
        return new;
      end;
      $$;
      create trigger fail_snapshot_receipt_for_test before insert on public.manual_diary_entry_requests
        for each row execute function private.fail_snapshot_receipt_for_test();
    `);
    try {
      const failed = await owner.rpc("create_manual_diary_entry_v2", args);
      expect(failed.error).not.toBeNull();
      const rows = await owner.from("diary_entries").select("id", { count: "exact", head: true }).eq("food_name", args.p_food_name);
      const receipts = await owner.from("manual_diary_entry_requests").select("id", { count: "exact", head: true }).eq("idempotency_key", args.p_idempotency_key);
      expect(rows.count).toBe(0);
      expect(receipts.count).toBe(0);
    } finally {
      queryLocalAuthFixture(`
        drop trigger fail_snapshot_receipt_for_test on public.manual_diary_entry_requests;
        drop function private.fail_snapshot_receipt_for_test();
      `);
    }
    const retry = await owner.rpc("create_manual_diary_entry_v2", args).single<MutationRow>();
    expect(retry.error).toBeNull();
    expect(retry.data?.result_status).toBe("success");
  });
});
