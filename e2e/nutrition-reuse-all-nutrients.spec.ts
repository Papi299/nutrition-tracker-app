import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Locator } from "@playwright/test";
import { provisionActivatedLocalUser } from "@/e2e/helpers/local-auth";
import { additionalNutrientCodesV1, nutrientManifestV1 } from "@/lib/nutrition-snapshots";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { AccountExportPayload } from "@/lib/account-export/schema";

const url = process.env.LOCAL_SUPABASE_URL;
const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !url || !key, "Requires synthetic loopback-only fixtures.");
const password = "SyntheticReuseSnapshot123!";
const email = `nutrient-reuse-${randomUUID()}@example.test`;
const sourceName = `Synthetic complete reference ${randomUUID().slice(0, 8)}`;
const amounts = Object.fromEntries(additionalNutrientCodesV1.map((code, index) => [code, Number(`${index + 1}.2345`)]));
const captured = { version: 1, values: { ...amounts, fiber_g: 0, vitamin_d_ug: null } };
const request = { version: 1, values: additionalNutrientCodesV1.map(code => ({ code, amount: captured.values[code as keyof typeof captured.values] })) };

async function openGroups(row: Locator) {
  for (const details of await row.locator("details").all()) {
    if (await details.getAttribute("open") === null) await details.locator("summary").click();
  }
}

test.describe.serial("35-nutrient reuse and export lifecycle", () => {
  let client: ReturnType<typeof createClient<Database>>;
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let mealId: string;
  let recipeId: string;
  let sourceId: string;
  let userId: string;
  const date = "2026-12-20";

  test.beforeAll(async ({ browser }) => {
    client = createClient<Database>(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
    const owner = await provisionActivatedLocalUser(client, { email, password });
    userId = owner.data.user!.id;
    const source = await client.rpc("create_custom_food", {
      p_aliases: [], p_brand_name: "Synthetic all nutrients", p_idempotency_key: randomUUID(),
      p_locale: "en", p_name: sourceName, p_nutrient_basis: "per_100g", p_serving_quantity: 100, p_serving_unit: "g",
      p_nutrients: [{ code: "energy_kcal", amount: 200 }, { code: "protein_g", amount: 20 },
        { code: "carbohydrates_g", amount: 20 }, { code: "fat_g", amount: 5 },
        ...additionalNutrientCodesV1.map(code => ({ code, amount: amounts[code] }))],
    }).single();
    expect(source.error).toBeNull(); sourceId = source.data!.food_id;
    const diary = await client.rpc("create_manual_diary_entry_v2", {
      p_idempotency_key: randomUUID(), p_entry_date: date, p_meal_type: "lunch", p_food_id: sourceId,
      p_food_name: "Synthetic consumed copy", p_brand_name: "Synthetic", p_serving_quantity: 200, p_serving_unit: "g",
      p_calories: 400, p_protein_g: 40, p_carbohydrates_g: 40, p_fat_g: 10, p_notes: "", p_additional_nutrients: request,
    }).single();
    expect(diary.error).toBeNull();
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    state = await context.storageState(); await context.close();
  });

  test("copies every consumed Saved Meal amount, edits one additional field, and logs once", async ({ browser }) => {
    const context = await browser.newContext({ storageState: state }); const page = await context.newPage();
    await page.goto(`/en/saved-meals/new?date=${date}&mealType=lunch`);
    const row = page.getByTestId("saved-meal-item").first();
    for (const code of additionalNutrientCodesV1) {
      await expect(row.locator(`input[name="item_${code}_0"]`)).toHaveValue(captured.values[code as keyof typeof captured.values] === null ? "" : String(captured.values[code as keyof typeof captured.values]));
    }
    await page.getByLabel("Meal name").fill("Synthetic complete consumed meal");
    await page.getByRole("button", { name: "Create saved meal", exact: true }).click();
    await expect(page).toHaveURL(/\/saved-meals\/[0-9a-f-]+\/edit\?saved=created$/);
    mealId = new URL(page.url()).pathname.split("/").at(-2)!;
    const first = await client.from("saved_meal_items").select("id,additional_nutrient_snapshot,serving_quantity,calories").eq("saved_meal_id", mealId).single();
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ additional_nutrient_snapshot: captured, serving_quantity: 200, calories: 400 });
    await openGroups(row);
    await row.locator('input[name="item_sodium_mg_0"]').fill("77.12345");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
    await expect(row.locator('input[name="item_sodium_mg_0"]')).toHaveValue("77.1235");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page).toHaveURL(/saved=updated$/);
    const updated = await client.from("saved_meal_items").select("id,additional_nutrient_snapshot").eq("saved_meal_id", mealId).single();
    expect(updated.data).toEqual({ id: first.data!.id, additional_nutrient_snapshot: { version: 1, values: { ...captured.values, sodium_mg: 77.1235 } } });
    const parent = await client.from("saved_meals").select("updated_at").eq("id", mealId).single();
    const log = { p_saved_meal_id: mealId, p_expected_updated_at: parent.data!.updated_at,
      p_entry_date: "2026-12-21", p_meal_type: "dinner", p_idempotency_key: randomUUID() };
    const firstLog = await client.rpc("log_saved_meal_to_diary_v2", log);
    expect(firstLog.error).toBeNull(); expect((await client.rpc("log_saved_meal_to_diary_v2", log)).data).toEqual(firstLog.data);
    const copied = await client.from("diary_entries").select("calories,serving_quantity,additional_nutrient_snapshot").eq("entry_date", "2026-12-21").single();
    expect(copied.data).toEqual({ calories: 400, serving_quantity: 200, additional_nutrient_snapshot: updated.data!.additional_nutrient_snapshot });
    await context.close();
  });

  test("scales Recipe picker quantities across all nutrients and applies yield exactly once", async ({ browser }) => {
    const context = await browser.newContext({ storageState: state }); const page = await context.newPage();
    await page.goto("/en/recipes/new");
    const row = page.getByTestId("recipe-ingredient").first();
    await row.getByLabel("Food name, alias, or brand").fill(sourceName);
    await row.getByRole("button", { name: "Search foods", exact: true }).click();
    await row.getByRole("listitem").filter({ hasText: sourceName }).getByRole("button", { name: "Use snapshot", exact: true }).click();
    await row.locator('input[name="ingredient_quantity_0"]').fill("200");
    await expect(row.locator('input[name="ingredient_calories_0"]')).toHaveValue("400");
    for (const code of additionalNutrientCodesV1) await expect(row.locator(`input[name="ingredient_${code}_0"]`)).toHaveValue(String(Number((amounts[code] * 2).toFixed(4))));
    await openGroups(row);
    await row.locator('input[name="ingredient_fiber_g_0"]').fill("0");
    await row.locator('input[name="ingredient_vitamin_d_ug_0"]').fill("");
    await row.locator('input[name="ingredient_quantity_0"]').fill("150");
    await row.locator('input[name="ingredient_quantity_0"]').fill("200");
    await expect(row.locator('input[name="ingredient_fiber_g_0"]')).toHaveValue("0");
    await expect(row.locator('input[name="ingredient_vitamin_d_ug_0"]')).toHaveValue("");
    await page.getByLabel("Recipe name").fill("Synthetic complete recipe");
    await page.getByLabel("Yield servings").fill("2");
    await page.getByRole("button", { name: "Create recipe", exact: true }).click();
    await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+\/edit\?saved=created$/);
    recipeId = new URL(page.url()).pathname.split("/").at(-2)!;
    const ingredient = await client.from("recipe_ingredients").select("additional_nutrient_snapshot,calories,quantity").eq("recipe_id", recipeId).single();
    const expected = { version: 1, values: Object.fromEntries(additionalNutrientCodesV1.map(code => [code,
      code === "fiber_g" ? 0 : code === "vitamin_d_ug" ? null : Number((amounts[code] * 2).toFixed(4)),
    ])) };
    expect(ingredient.data).toEqual({ calories: 400, quantity: 200, additional_nutrient_snapshot: expected });
    const parent = await client.from("recipes").select("updated_at").eq("id", recipeId).single();
    const log = { p_recipe_id: recipeId, p_expected_updated_at: parent.data!.updated_at,
      p_requested_servings: 3, p_entry_date: "2026-12-22", p_meal_type: "dinner", p_idempotency_key: randomUUID() };
    const logged = await client.rpc("log_recipe_to_diary_v2", log);
    expect(logged.error).toBeNull(); expect((await client.rpc("log_recipe_to_diary_v2", log)).data).toEqual(logged.data);
    const rowSnapshot = await client.from("diary_entries").select("calories,additional_nutrient_snapshot").eq("entry_date", "2026-12-22").single();
    expect(rowSnapshot.data).toEqual({ calories: 600, additional_nutrient_snapshot: { version: 1,
      values: Object.fromEntries(additionalNutrientCodesV1.map(code => [code,
        expected.values[code] === null ? null : Number((expected.values[code]! * 1.5).toFixed(4)),
      ])),
    } });
    await context.close();
  });

  test("keeps a delayed picker response on its stable row after another ingredient moves", async ({ browser }) => {
    const context = await browser.newContext({ storageState: state }); const page = await context.newPage();
    await page.goto("/en/recipes/new");
    await page.getByRole("button", { name: "Add blank ingredient", exact: true }).click();
    const rows = page.getByTestId("recipe-ingredient");
    const selectedKey = await rows.nth(0).getAttribute("data-row-key");
    const otherKey = await rows.nth(1).getAttribute("data-row-key");
    await rows.nth(1).getByLabel("Ingredient name").fill("Synthetic untouched manual row");
    await rows.nth(1).locator('input[name="ingredient_calories_1"]').fill("17");
    await rows.nth(0).getByLabel("Food name, alias, or brand").fill(sourceName);
    await rows.nth(0).getByRole("button", { name: "Search foods", exact: true }).click();
    let release!: () => void; let received!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const responseReceived = new Promise<void>(resolve => { received = resolve; });
    await page.route("**/recipes/new", async route => {
      if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.continue();
      const response = await route.fetch(); received(); await held; await route.fulfill({ response });
    });
    try {
      await rows.nth(0).getByRole("listitem").filter({ hasText: sourceName }).getByRole("button", { name: "Use snapshot", exact: true }).click();
      await responseReceived;
      await expect(page.getByRole("button", { name: "Create recipe", exact: true })).toBeDisabled();
      await rows.nth(1).getByRole("button", { name: "Move ingredient 2 up", exact: true }).click();
      expect(await rows.nth(1).getAttribute("data-row-key")).toBe(selectedKey);
      release();
      const selected = rows.filter({ has: page.locator(`input[value="${selectedKey}"]`) });
      const other = rows.filter({ has: page.locator(`input[value="${otherKey}"]`) });
      await expect(selected.getByLabel("Ingredient name")).toHaveValue(sourceName);
      await expect(selected.locator('input[name="ingredient_calories_1"]')).toHaveValue("200");
      await expect(other.getByLabel("Ingredient name")).toHaveValue("Synthetic untouched manual row");
      await expect(other.locator('input[name="ingredient_calories_0"]')).toHaveValue("17");
      await expect(page.getByRole("button", { name: "Create recipe", exact: true })).toBeEnabled();
    } finally { release(); await page.unrouteAll({ behavior: "wait" }); await context.close(); }
  });

  test("preserves complete manual snapshots in native Saved Meal and Recipe submissions", async ({ browser }) => {
    const context = await browser.newContext({ storageState: state, javaScriptEnabled: false });
    const page = await context.newPage();
    for (const kind of ["saved-meals", "recipes"] as const) {
      await page.goto(`/en/${kind}/new`);
      const isRecipe = kind === "recipes";
      const row = page.getByTestId(isRecipe ? "recipe-ingredient" : "saved-meal-item").first();
      await page.getByLabel(isRecipe ? "Recipe name" : "Meal name").fill(`Synthetic native ${kind}`);
      const prefix = isRecipe ? "ingredient" : "item";
      await row.locator(`input[name="${prefix}_${isRecipe ? "ingredient_name" : "food_name"}_0"]`).fill("Synthetic native consumed amount");
      if (isRecipe) await page.getByLabel("Yield servings").fill("2");
      await row.locator(`input[name="${prefix}_calories_0"]`).fill("100");
      await openGroups(row);
      for (const code of additionalNutrientCodesV1) {
        await row.locator(`input[name="${prefix}_${code}_0"]`).fill(captured.values[code as keyof typeof captured.values] === null ? "" : String(captured.values[code as keyof typeof captured.values]));
      }
      await page.getByRole("button", { name: isRecipe ? "Create recipe" : "Create saved meal", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${kind}/[0-9a-f-]+/edit\\?saved=created$`));
      const id = new URL(page.url()).pathname.split("/").at(-2)!;
      const saved = isRecipe
        ? await client.from("recipe_ingredients").select("additional_nutrient_snapshot").eq("recipe_id", id).single()
        : await client.from("saved_meal_items").select("additional_nutrient_snapshot").eq("saved_meal_id", id).single();
      expect(saved.error).toBeNull(); expect(saved.data!.additional_nutrient_snapshot).toEqual(captured);
    }
    await context.close();
  });

  test("exports all consumed snapshots with immutable units and preserves historical absence", async ({ browser }) => {
    const context = await browser.newContext({ storageState: state }); const page = await context.newPage();
    await page.goto("/en/account/export");
    await page.getByRole("link", { name: "Confirm current password", exact: true }).click();
    await page.getByLabel("Current password").fill(password);
    await page.getByRole("button", { name: "Confirm password", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/account\/export$/);
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data", exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/account-export-v2-/);
    const payload = JSON.parse(await readFile((await download.path())!, "utf8")) as AccountExportPayload;
    expect(payload.version).toBe(2);
    expect(payload.account.id).toBe(userId);
    expect(payload.nutritionSnapshotManifest?.nutrients).toEqual(nutrientManifestV1.map(({ code, unit, coreField, precision }) => ({ code, unit, coreField, precision })));
    const diaryRows = await client.from("diary_entries").select("id,additional_nutrient_snapshot").eq("user_id", userId);
    for (const entry of diaryRows.data!) expect(payload.diaryEntries.find(row => row.id === entry.id)?.additionalNutrientSnapshot).toEqual(entry.additional_nutrient_snapshot as Json);
    expect(payload.savedMeals.find(meal => meal.id === mealId)?.items[0].additionalNutrientSnapshot).toBeDefined();
    expect(payload.recipes.find(recipe => recipe.id === recipeId)?.ingredients[0].additionalNutrientSnapshot).toBeDefined();
    expect(JSON.stringify(payload)).not.toContain("idempotency_key");
    await context.close();
  });
});
