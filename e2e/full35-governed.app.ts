import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { parseFoodNutritionReference, parseFoodNutritionReferenceV2 } from "@/lib/food-selection/reference-parser";
import { additionalNutrientCodesV1, nutrientCodesV1, nutrientManifestV1, type AdditionalNutrientSnapshotV1 } from "@/lib/nutrition-snapshots";
import { summarizeAdditionalSnapshots } from "@/lib/nutrition-snapshots/presentation";
import { provisionActivatedLocalUser } from "./helpers/local-auth";
import { installApplicationTransition } from "./fixtures/full35-app-transition";

const field = (code: string) => code === "energy_kcal" ? "calories" : code;
const input = (form: Locator, name: string) => form.locator(`input[name="${name}"]`);
async function expand(form: Locator) {
  for (const details of await form.locator("details").all()) if (await details.getAttribute("open") === null) await details.locator("summary").click();
}
function independentScale(nutrients: Record<string, string | null>, quantity: string) {
  return JSON.parse(execFileSync("python3", ["-c", `import importlib.util,json,sys
s=importlib.util.spec_from_file_location('oracle','scripts/full35-app-oracle.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
v=json.load(sys.stdin);print(json.dumps({c:m.scale(c,a,v['quantity']) for c,a in v['nutrients'].items()}))`],
  { input: JSON.stringify({ nutrients, quantity }), encoding: "utf8" })) as Record<string, string | null>;
}

test("F35-32–39 governed 353-food enrichment preserves application history, review, reuse, export and ownership", async ({ browser }) => {
  test.setTimeout(360_000);
  const transition = installApplicationTransition();
  const { query, json, plan } = transition;
  const url = process.env.LOCAL_SUPABASE_URL!, key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const other = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const password = `${randomBytes(24).toString("hex")}aA!`;
  const email = `full35-governed-a-${randomUUID()}@example.test`;
  const user = await provisionActivatedLocalUser(client, { email, password });
  await provisionActivatedLocalUser(other, { email: `full35-governed-b-${randomUUID()}@example.test`, password });
  const owner = user.data.user!.id;
  const contexts: BrowserContext[] = [];
  const migrationCount=Number(query("select count(*) from supabase_migrations.schema_migrations"));
  expect(migrationCount).toBe(transition.plan.implementation.migrations.length);
  const evidence: Record<string, unknown> = { sourceMode: transition.sourceMode, migrationCount };
  const sourceIds = plan.items.map(item => item.before.food_id);
  const officialOracle = process.env.FULL35_APPROVED_SOURCE_ARCHIVE
    ? JSON.parse(readFileSync(".ingestion-workspace/full35-local-qual-001/application-oracle.json", "utf8")) as Record<string, { reference: Record<string, string | null> }>
    : null;
  const chosen = plan.items.find(item => ["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"].every(code =>
    item.before.public_rows.some(row => row.code === code))) ?? plan.items[0];
  const foodId = chosen.before.food_id;
  type WireReference = Record<string, unknown> & { food_id: string; nutrients: Record<string, string | null>; reference_fingerprint: string };
  const references = (version: 1 | 2) => json<WireReference[]>(`begin;set local role authenticated;
    set local request.jwt.claim.sub='${owner}';select jsonb_agg(to_jsonb(r) order by r.food_id) from public.foods f
    cross join lateral public.get_readable_food_nutrition_reference_v${version}(f.id) r
    where f.id in (${sourceIds.map(id => `'${id}'`).join(",")});rollback;`);
  const persisted = () => query(`select jsonb_build_object(
    'diary',(select jsonb_agg(to_jsonb(x) order by id) from public.diary_entries x),
    'receipts',(select jsonb_agg(to_jsonb(x) order by id) from public.manual_diary_entry_requests x),
    'targets',(select jsonb_agg(to_jsonb(x) order by id) from public.nutrition_targets x),
    'meals',(select jsonb_agg(to_jsonb(x) order by id) from public.saved_meals x),
    'items',(select jsonb_agg(to_jsonb(x) order by id) from public.saved_meal_items x),
    'recipes',(select jsonb_agg(to_jsonb(x) order by id) from public.recipes x),
    'ingredients',(select jsonb_agg(to_jsonb(x) order by id) from public.recipe_ingredients x),
    'favorites',(select jsonb_agg(to_jsonb(x) order by user_id,food_id) from public.food_favorites x),
    'meal_runs',(select jsonb_agg(to_jsonb(x) order by id) from public.saved_meal_diary_runs x),
    'recipe_runs',(select jsonb_agg(to_jsonb(x) order by id) from public.recipe_diary_runs x))::text;`);
  const identities = () => query(`select jsonb_build_object(
    'foods',(select jsonb_agg(to_jsonb(x) order by id) from public.foods x where id in (${sourceIds.map(id => `'${id}'`).join(",")})),
    'versions',(select jsonb_agg(to_jsonb(x) order by id) from ingestion.source_record_versions x),
    'original_rows',(select jsonb_agg(to_jsonb(x) order by id) from public.food_nutrients x where id in
      (${plan.items.flatMap(item => item.before.public_rows.map(row => `'${row.id}'`)).join(",")})))::text;`);
  async function open(locale: "en" | "he", date: string, mobile = false) {
    const context = await browser.newContext({ ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}) });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in"); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/en\/today\?date=/);
    await page.goto(`/${locale}/today?date=${date}&foodId=${foodId}`);
    return { context, page, form: page.getByTestId("manual-diary-entry-form"), locale, date };
  }
  async function download(page: Page) {
    await page.goto("/en/account/export");
    if (await page.getByRole("link", { name: "Confirm current password", exact: true }).count()) {
      await page.getByRole("link", { name: "Confirm current password", exact: true }).click();
      await page.getByLabel("Current password").fill(password); await page.getByRole("button", { name: "Confirm password", exact: true }).click();
    }
    const event = page.waitForEvent("download"); await page.getByRole("button", { name: "Download my data", exact: true }).click();
    const result = JSON.parse(await readFile((await (await event).path())!, "utf8"));
    delete result.exportedAt; return result;
  }
  try {
    const beforeV1 = references(1), beforeV2 = references(2), originalIdentities = identities();
    await test.step("State A: 353 complete references, stored consumption and reusable snapshots", async () => {
      expect(beforeV1).toHaveLength(353); expect(beforeV2).toHaveLength(353);
      for (const ref of beforeV1) expect(parseFoodNutritionReference(ref, ref.food_id)).not.toBeNull();
      for (const ref of beforeV2) expect(parseFoodNutritionReferenceV2(ref, ref.food_id)).not.toBeNull();
      for (const ref of beforeV2) expect(new Date(String(ref.source_updated_at)).toISOString()).toBe("2026-11-01T00:00:00.000Z");
      const selected = beforeV2.find(ref => ref.food_id === foodId)!;
      const expected = independentScale(selected.nutrients, "100");
      const additional = { version: 1, values: additionalNutrientCodesV1.map(code => ({ code, amount: code === "sugars_g" ? 0 : expected[code] === null ? null : Number(expected[code]) })) };
      const args = { p_idempotency_key: randomUUID(), p_entry_date: "2026-10-01", p_meal_type: "lunch", p_food_id: foodId,
        p_food_name: "Synthetic captured original source", p_brand_name: "", p_serving_quantity: 100, p_serving_unit: "g",
        p_calories: Number(expected.energy_kcal), p_protein_g: Number(expected.protein_g), p_carbohydrates_g: Number(expected.carbohydrates_g),
        p_fat_g: Number(expected.fat_g), p_notes: "", p_additional_nutrients: additional };
      const entry = await client.rpc("create_manual_diary_entry_v2", args).single(); expect(entry.error).toBeNull();
      const item = { position: 1, food_id: foodId, food_name: args.p_food_name, ingredient_name: args.p_food_name,
        brand_name: null, serving_quantity: 100, serving_unit: "g", quantity: 100, unit: "g", calories: args.p_calories,
        protein_g: args.p_protein_g, carbohydrates_g: args.p_carbohydrates_g, fat_g: args.p_fat_g, notes: null, additional_nutrient_snapshot: additional };
      const { ingredient_name: _ingredient, quantity: _quantity, unit: _unit, ...mealItem } = item;
      void _ingredient; void _quantity; void _unit;
      const meal = await client.rpc("persist_saved_meal_v2", { p_saved_meal_id: null as unknown as string, p_expected_edit_revision: null as unknown as number,
        p_name: "Synthetic frozen Stage5 meal", p_locale: "en", p_items: [{ ...mealItem, item_id: null }] }).single(); expect(meal.error).toBeNull();
      const { food_name: _foodName, serving_quantity: _servingQuantity, serving_unit: _servingUnit, ...ingredient } = item;
      void _foodName; void _servingQuantity; void _servingUnit;
      const recipe = await client.rpc("persist_recipe_v2", { p_recipe_id: null as unknown as string, p_expected_edit_revision: null as unknown as number,
        p_name: "Synthetic frozen Stage5 recipe", p_locale: "en", p_yield_servings: 1, p_ingredients: [{ ...ingredient, ingredient_id: null }] }).single(); expect(recipe.error).toBeNull();
      const mealParent = await client.from("saved_meals").select("updated_at").eq("id", meal.data!.saved_meal_id).single();
      const mealArgs = { p_saved_meal_id: meal.data!.saved_meal_id, p_expected_updated_at: mealParent.data!.updated_at,
        p_entry_date: "2026-10-02", p_meal_type: "lunch", p_idempotency_key: randomUUID() };
      const mealLogged = await client.rpc("log_saved_meal_to_diary_v2", mealArgs); expect(mealLogged.error).toBeNull();
      const recipeParent = await client.from("recipes").select("updated_at").eq("id", recipe.data!.recipe_id).single();
      const recipeArgs = { p_recipe_id: recipe.data!.recipe_id, p_expected_updated_at: recipeParent.data!.updated_at,
        p_requested_servings: 1, p_entry_date: "2026-10-02", p_meal_type: "dinner", p_idempotency_key: randomUUID() };
      const recipeLogged = await client.rpc("log_recipe_to_diary_v2", recipeArgs); expect(recipeLogged.error).toBeNull();
      evidence.originalMealLog = { args: mealArgs, response: mealLogged.data };
      evidence.originalRecipeLog = { args: recipeArgs, response: recipeLogged.data };
      evidence.entryArgs = args; evidence.entryResponse = entry.data; evidence.mealId = meal.data!.saved_meal_id; evidence.recipeId = recipe.data!.recipe_id;
      expect((await client.from("food_favorites").insert({ user_id: owner, food_id: foodId })).error).toBeNull();
      expect((await client.from("nutrition_targets").insert([{ user_id: owner, effective_from: "2026-01-01", calories: 2000, protein_g: 0, carbohydrates_g: null, fat_g: null },
        { user_id: owner, effective_from: "2026-10-01", calories: 2100, protein_g: null, carbohydrates_g: 200, fat_g: 0 }])).error).toBeNull();
    });
    const staleEn = await open("en", "2026-11-03"), staleHe = await open("he", "2026-11-04", true);
    const forged = await open("en", "2026-11-07");
    const forgedKey = await input(forged.form, "idempotency_key").inputValue();
    const recipeDraft = await open("en", "2026-11-08");
    await recipeDraft.page.goto("/en/recipes/new");
    const recipeRow = recipeDraft.page.getByTestId("recipe-ingredient").first();
    await recipeRow.getByLabel("Food name, alias, or brand").fill(String(chosen.before.food_row.name));
    await recipeRow.getByRole("button", { name: "Search foods", exact: true }).click();
    await recipeRow.getByRole("button", { name: "Use snapshot", exact: true }).first().click();
    await recipeDraft.page.getByLabel("Recipe name").fill("Synthetic stale recipe selection");
    await input(staleEn.form, "serving_quantity").fill("200");
    await expand(staleHe.form); await input(staleHe.form, "fiber_g").fill("7");
    const stale = [staleEn, staleHe];
    const drafts = await Promise.all(stale.map(async ({ form }) => ({ key: await input(form, "idempotency_key").inputValue(),
      values: Object.fromEntries(await Promise.all(nutrientCodesV1.map(async code => [field(code), await input(form, field(code)).inputValue()])) ) })));
    for (const { page, locale } of stale) await test.info().attach(`${locale}-original-reference`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    const exportContext = await open("en", "2026-10-01");
    const exportBefore = await download(exportContext.page);
    const frozen = persisted();
    await test.step("F35-32: actual uncommitted writer, coherent overlap read and complete enrichment", async () => {
      const releaseReader = await transition.holdReferenceReader();
      let released = false;
      try {
        const execution = transition.asyncQuery(`set application_name='full35_app_visibility';begin;${transition.execution}select pg_sleep(8);commit;`);
        await expect.poll(() => query("select count(*) from pg_stat_activity where application_name='full35_app_visibility' and wait_event='PgSleep'"), { timeout: 120_000 }).toBe("1");
        const overlapRead = transition.asyncQuery(`set application_name='full35_app_visibility_reader';begin;set local role authenticated;
          set local request.jwt.claim.sub='${owner}';
          with gate as materialized(select clock_timestamp() opened_at,pg_advisory_xact_lock(${transition.visibilityLock}))
          select jsonb_agg(to_jsonb(r) order by r.food_id) from gate cross join public.foods f
          cross join lateral public.get_readable_food_nutrition_reference_v2(case when gate.opened_at is not null then f.id else null end) r
          where f.id in (${sourceIds.map(id => `'${id}'`).join(",")});commit;`, "supabase_admin");
        const readerWaiting = () => query("select count(*) from pg_stat_activity where application_name='full35_app_visibility_reader' and wait_event_type='Lock' and wait_event='advisory'");
        await expect.poll(readerWaiting, { timeout: 5_000 }).toBe("1");
        await execution;
        expect(readerWaiting()).toBe("1");
        await releaseReader(); released = true;
        const overlap = JSON.parse(await overlapRead); expect(overlap).toEqual(beforeV2);
      } finally { if (!released) await releaseReader(); }
      evidence.referenceReadSpannedCommit = true;
      const afterV1 = references(1), afterV2 = references(2);
      expect(identities()).toBe(originalIdentities); expect(persisted()).toBe(frozen);
      await test.info().attach("353-identity-comparison", { body: Buffer.from(JSON.stringify({ scope: transition.sourceMode,
        before: JSON.parse(originalIdentities), after: JSON.parse(identities()), equal: true }, null, 2)), contentType: "application/json" });
      for (const [before, after, parser] of [[beforeV1, afterV1, parseFoodNutritionReference], [beforeV2, afterV2, parseFoodNutritionReferenceV2]] as const) {
        expect(after).toHaveLength(353);
        for (const [i, ref] of after.entries()) {
          expect(parser(ref, before[i].food_id)).not.toBeNull(); expect(Object.keys(ref.nutrients).sort()).toEqual([...nutrientCodesV1].sort());
          expect(ref.reference_fingerprint).not.toBe(before[i].reference_fingerprint);
          expect(new Date(String(ref.source_updated_at)).toISOString()).toBe("2026-11-02T00:00:00.000Z");
          for (const code of ["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"] as const) expect(ref.nutrients[code]).toBe(before[i].nutrients[code]);
          for (const code of ["added_sugars_g", "folate_dfe_ug", "vitamin_k_ug"]) expect(ref.nutrients[code]).toBeNull();
          for (const key of ["food_id", "source_id", "source_food_id", "catalog_serving_quantity", "catalog_serving_unit"]) expect(ref[key]).toEqual(before[i][key]);
          expect(ref).toMatchObject({ nutrient_basis: "per_100g", serving_quantity: 100, serving_unit: "g" });
          if (before[i].nutrient_basis !== null) {
            for (const key of ["nutrient_basis", "serving_quantity", "serving_unit"]) expect(ref[key]).toEqual(before[i][key]);
          } else {
            // Existing reader contract: a food with no eligible scalar has no
            // coherent basis yet. First additional values establish 100 g;
            // the catalog serving fields and original core mask stay frozen.
            expect(Object.values(before[i].nutrients).every(value => value === null)).toBe(true);
          }
          const states = plan.items.find(item => item.before.food_id === ref.food_id)!.projection_body.nutrient_states as { nutrient_code: string; amount: string | null }[];
          expect(states).toHaveLength(35);
          const expected = Object.fromEntries(states.map(state => [state.nutrient_code, state.amount ?? null]));
          const actual = parser(ref, ref.food_id)!.nutrients;
          expect(actual).toEqual(expected);
          if (officialOracle) {
            const fdcId = plan.items.find(item => item.before.food_id === ref.food_id)!.before.fdc_id;
            expect(actual).toEqual(officialOracle[fdcId].reference);
          }
        }
      }
      const counts = json(`select jsonb_build_object('food_count',(select count(*) from ingestion.food_projection_heads),
        'source_versions',(select count(*) from ingestion.source_record_versions),
        'public_rows',(select count(*) from public.food_nutrients where food_id in (${sourceIds.map(id => `'${id}'`).join(",")})),
        'v2_projections',(select count(*) from ingestion.food_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
        'v2_states',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
        'present',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2' and projection_state='present'),
        'missing',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2' and projection_state='missing'),
        'withheld',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'
          and projection_state='missing' and nutrient_code in ('added_sugars_g','folate_dfe_ug','vitamin_k_ug')),
        'head',(select current_head_version from ingestion.dataset_projection_current_heads));`);
      expect(counts).toEqual({ food_count: 353, source_versions: 353, public_rows: 6261, v2_projections: 353, v2_states: 12355, present: 6261, missing: 6094, withheld: 1059, head: 2 });
      evidence.counts = counts; evidence.frozenHistorySha256 = createHash("sha256").update(frozen).digest("hex");
      evidence.originalNutrientRows = plan.items.flatMap(item => item.before.public_rows).length;
      expect(evidence.originalNutrientRows).toBe(1199);
      await test.info().attach("353-before-after-references", { body: Buffer.from(JSON.stringify({ beforeV1, beforeV2, afterV1, afterV2 }, null, 2)), contentType: "application/json" });
      expect(await download(exportContext.page)).toEqual(exportBefore);
      evidence.exactAccountExportPreserved = true;
      const args = evidence.entryArgs as Database["public"]["Functions"]["create_manual_diary_entry_v2"]["Args"];
      expect((await client.rpc("create_manual_diary_entry_v2", args).single()).data).toEqual(evidence.entryResponse);
      const mealRetry = evidence.originalMealLog as { args: Database["public"]["Functions"]["log_saved_meal_to_diary_v2"]["Args"]; response: unknown };
      const recipeRetry = evidence.originalRecipeLog as { args: Database["public"]["Functions"]["log_recipe_to_diary_v2"]["Args"]; response: unknown };
      expect((await client.rpc("log_saved_meal_to_diary_v2", mealRetry.args)).data).toEqual(mealRetry.response);
      expect((await client.rpc("log_recipe_to_diary_v2", recipeRetry.args)).data).toEqual(recipeRetry.response);
      expect(persisted()).toBe(frozen);
    });
    await test.step("F35-33–35: EN/HE first-submit stale automatic and mixed provenance refuse all writes", async () => {
      const current = references(2).find(ref => ref.food_id === foodId)!;
      await expand(forged.form);
      await forged.form.evaluate((form, data) => {
        (form.querySelector('input[name="reference_fingerprint"]') as HTMLInputElement).value = data.fingerprint;
        for (const [code, amount] of Object.entries(data.values)) {
          (form.querySelector(`input[name="${code === "energy_kcal" ? "calories" : code}"]`) as HTMLInputElement).value = amount ?? "";
        }
      }, { fingerprint: current.reference_fingerprint, values: independentScale(current.nutrients, "100") });
      await forged.form.getByRole("button", { name: "Add entry", exact: true }).click();
      await expect(forged.page.getByTestId("nutrition-reference-changed")).toBeVisible();
      expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key", forgedKey)).data).toEqual([]);
      await recipeDraft.page.getByRole("button", { name: "Create recipe", exact: true }).click();
      await expect(recipeDraft.page.getByTestId("nutrition-reference-changed")).toBeVisible();
      await expect(recipeDraft.page.getByTestId("recipe-validation-summary")).toBeFocused();
      expect((await client.from("recipes").select("id").eq("name", "Synthetic stale recipe selection")).data).toEqual([]);
      await expand(recipeRow);
      await recipeRow.locator('input[name="ingredient_automatic_fiber_g_0"]').check();
      await expect(recipeRow.locator('input[name="ingredient_fiber_g_0"]')).toHaveValue(independentScale(current.nutrients, "100").fiber_g ?? "");
      await recipeDraft.page.getByRole("button", { name: "Create recipe", exact: true }).click();
      await expect(recipeDraft.page).toHaveURL(/\/recipes\/[0-9a-f-]+\/edit\?saved=created$/);
      const reviewedRecipeId = new URL(recipeDraft.page.url()).pathname.split("/").at(-2)!;
      const reviewedIngredient = await client.from("recipe_ingredients").select("additional_nutrient_snapshot").eq("recipe_id", reviewedRecipeId).single();
      expect(reviewedIngredient.error).toBeNull();
      const expectedFiber = independentScale(current.nutrients, "100").fiber_g;
      expect((reviewedIngredient.data!.additional_nutrient_snapshot as AdditionalNutrientSnapshotV1).values.fiber_g).toBe(expectedFiber === null ? null : Number(expectedFiber));
      for (const [i, { page, form, locale }] of stale.entries()) {
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
        await form.getByRole("button", { name: locale === "he" ? "הוספת רשומה" : "Add entry", exact: true }).click();
        await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
        await expect(page.getByTestId("nutrition-reference-changed")).toContainText(locale === "he" ? "ערכי הייחוס במאגר השתנו" : "The catalog reference changed");
        expect((await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key", drafts[i].key)).data).toEqual([]);
        for (const code of nutrientCodesV1) {
          await expect(input(form, field(code))).toHaveValue(drafts[i].values[field(code)]);
          await expect(input(form, `automatic_${field(code)}`)).not.toBeChecked();
        }
        await page.reload(); await expect(input(form, "idempotency_key")).toHaveValue(drafts[i].key);
        for (const code of nutrientCodesV1) await expect(input(form, field(code))).toHaveValue(drafts[i].values[field(code)]);
        await expand(form);
        for (const code of nutrientCodesV1) await expect(input(form, field(code))).toHaveAccessibleName(/.+/);
        const axe = await new AxeBuilder({ page }).analyze(); expect(axe.violations).toEqual([]);
        await test.info().attach(`${locale}-stale-review-axe`, { body: Buffer.from(JSON.stringify({ violations: axe.violations, passes: axe.passes.map(pass => pass.id) })), contentType: "application/json" });
        await test.info().attach(`${locale}-stale-review`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        // Only this explicit automatic choice is refreshed; the manual fiber
        // override and all other retained manual numbers remain unchanged.
        await input(form, "automatic_vitamin_c_mg").check();
        await form.getByRole("button", { name: locale === "he" ? "הוספת רשומה" : "Add entry", exact: true }).click();
        await expect(form).toContainText(locale === "he" ? "הרשומה נוספה." : "Entry added.");
        const row = await client.from("diary_entries").select("additional_nutrient_snapshot").eq("entry_date", stale[i].date).single();
        expect(row.error).toBeNull();
        if (locale === "he") expect((row.data!.additional_nutrient_snapshot as AdditionalNutrientSnapshotV1).values.fiber_g).toBe(7);
      }
    });
    await test.step("F35-37–39: frozen reusable snapshots, favorite identity, daily unknowns and real owner isolation", async () => {
      const mealId = String(evidence.mealId), recipeId = String(evidence.recipeId);
      const meal = await client.from("saved_meals").select("updated_at").eq("id", mealId).single();
      const mealLog = await client.rpc("log_saved_meal_to_diary_v2", { p_saved_meal_id: mealId, p_expected_updated_at: meal.data!.updated_at,
        p_entry_date: "2026-11-05", p_meal_type: "lunch", p_idempotency_key: randomUUID() }); expect(mealLog.error).toBeNull();
      const recipe = await client.from("recipes").select("updated_at").eq("id", recipeId).single();
      const recipeLog = await client.rpc("log_recipe_to_diary_v2", { p_recipe_id: recipeId, p_expected_updated_at: recipe.data!.updated_at,
        p_requested_servings: 1, p_entry_date: "2026-11-05", p_meal_type: "dinner", p_idempotency_key: randomUUID() }); expect(recipeLog.error).toBeNull();
      const copied = await client.from("diary_entries").select("id,additional_nutrient_snapshot").eq("entry_date", "2026-11-05"); expect(copied.error).toBeNull(); expect(copied.data).toHaveLength(2);
      for (const row of copied.data!) for (const code of additionalNutrientCodesV1) expect((row.additional_nutrient_snapshot as AdditionalNutrientSnapshotV1).values[code]).toBe(code === "sugars_g" ? 0 : null);
      const totals = summarizeAdditionalSnapshots(copied.data!.map(row => row.additional_nutrient_snapshot)); expect(totals.ok).toBe(true);
      if (totals.ok) for (const [code, value] of Object.entries(totals.values)) expect(value).toEqual(code === "sugars_g"
        ? { complete: true, knownSubtotal: "0", unknownCount: 0 } : { complete: false, knownSubtotal: null, unknownCount: 2 });
      await exportContext.page.goto("/en/saved-meals/new?date=2026-10-01&mealType=lunch");
      const copiedItem = exportContext.page.getByTestId("saved-meal-item").first();
      for (const code of additionalNutrientCodesV1) await expect(copiedItem.locator(`input[name="item_${code}_0"]`)).toHaveValue(code === "sugars_g" ? "0" : "");
      await exportContext.page.getByLabel("Meal name").fill("Synthetic copied original diary after enrichment");
      await exportContext.page.getByRole("button", { name: "Create saved meal", exact: true }).click();
      await expect(exportContext.page).toHaveURL(/\/saved-meals\/[0-9a-f-]+\/edit\?saved=created$/);
      const favorite = await client.from("food_favorites").select("food_id"); expect(favorite.data).toEqual([{ food_id: foodId }]);
      const fresh = await open("en", "2026-11-06");
      await fresh.page.goto("/en/foods/reuse?date=2026-11-06");
      await fresh.page.getByTestId("favorites-foods-list").locator(`[data-food-id="${foodId}"]`).getByRole("link", { name: "Use in diary", exact: true }).click();
      await expect(input(fresh.form, "food_id")).toHaveValue(foodId);
      await expand(fresh.form); await input(fresh.form, "serving_quantity").fill("200");
      const current = references(2).find(ref => ref.food_id === foodId)!; const expected = independentScale(current.nutrients, "200");
      for (const code of nutrientCodesV1) await expect(input(fresh.form, field(code))).toHaveValue(expected[code] ?? "");
      expect((await new AxeBuilder({ page: fresh.page }).analyze()).violations).toEqual([]);
      await test.info().attach("en-enriched-reference", { body: await fresh.page.screenshot({ fullPage: true }), contentType: "image/png" });
      await fresh.form.getByRole("button", { name: "Add entry", exact: true }).click(); await expect(fresh.form).toContainText("Entry added.");
      const captured = await client.from("diary_entries").select("*").eq("entry_date", "2026-11-06").single(); expect(captured.error).toBeNull();
      for (const code of additionalNutrientCodesV1) expect((captured.data!.additional_nutrient_snapshot as AdditionalNutrientSnapshotV1).values[code]).toBe(expected[code] === null ? null : Number(expected[code]));
      await fresh.page.reload();
      const row = fresh.page.locator(`[data-diary-entry-id="${captured.data!.id}"]`);
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      const editor = row.locator("form"); await expand(editor); await expect(input(editor, "serving_quantity")).toHaveValue("200");
      for (const code of nutrientCodesV1) await expect(input(editor, field(code))).toHaveValue(expected[code] ?? "");
      expect((await other.from("diary_entries").select("id").eq("id", captured.data!.id)).data).toEqual([]);
      expect((await other.from("diary_entries").update({ calories: 1, serving_quantity: 1 }).eq("id", captured.data!.id).select("id")).data).toEqual([]);
      expect((await client.from("diary_entries").select("*").eq("id", captured.data!.id).single()).data).toEqual(captured.data);
      for (const name of ["saved_meals", "recipes"] as const) expect((await other.from(name).select("id")).data).toEqual([]);
      for (const role of [transition.consumer, "anon", "authenticated", "service_role"]) {
        expect(() => role === transition.consumer ? query(transition.execution, role) : query(`set role ${role};${transition.execution}`)).toThrow(/permission denied/);
      }
      evidence.ownerIsolation = true; evidence.fresh200gAll35 = expected;
    });
    delete evidence.entryArgs;
    await test.info().attach("stage5-results", { body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: "application/json" });
    expect(nutrientManifestV1).toHaveLength(35);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
