import AxeBuilder from "@axe-core/playwright";
import { captureNutritionEvidence } from "@/e2e/helpers/nutrition-evidence";
import { formatLocalizedNumber } from "@/lib/i18n/format";
import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import { additionalNutrientCodesV1, nutrientManifestV1, type NutrientCode } from "@/lib/nutrition-snapshots/manifest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Locator, type Request } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const password = "SyntheticAllNutrients123!";
const referenceAmounts = nutrientManifestV1.map(({ code }, index) => ({
  code, amount: code === "energy_kcal" ? 201.4 : index + 1.1112,
}));

test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey,
  "All-nutrient diary acceptance requires the disposable local fixture runner.");

function control(form: Locator, name: string) {
  return form.locator(`input[name="${name}"]`);
}

function fieldFor(code: NutrientCode) {
  return nutrientManifestV1.find(definition => definition.code === code)!.coreField ?? code;
}

function consumed(code: NutrientCode, multiplier: number) {
  const definition = nutrientManifestV1.find(item => item.code === code)!;
  const reference = referenceAmounts.find(item => item.code === code)!.amount;
  return Number((reference * multiplier).toFixed(definition.precision));
}

function expectedAdditional(multiplier: number, overrides: Record<string, number | null> = {}) {
  return {
    version: 1,
    values: Object.fromEntries(additionalNutrientCodesV1.map(code => [
      code, Object.hasOwn(overrides, code) ? overrides[code] : consumed(code, multiplier),
    ])),
  };
}

async function openGroups(form: Locator) {
  for (const details of await form.locator("details").all()) {
    if (await details.getAttribute("open") === null) await details.locator("summary").click();
  }
}

test.describe.serial("complete consumed nutrition through the application", () => {
  let client: SupabaseClient<Database>;
  let ownerId: string;
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let gramFood: string;
  let liquidFood: string;
  let servingFood: string;
  let extensionOnlyFood: string;
  const email = `all-nutrients-${randomUUID()}@example.test`;

  async function createFood(name: string, basis: string, quantity: number, unit: string,
    amounts: { code: string; amount: number }[] = referenceAmounts) {
    const result = await client.rpc("create_custom_food", {
      p_aliases: [], p_brand_name: "Synthetic nutrient matrix", p_idempotency_key: randomUUID(),
      p_locale: "en", p_name: name, p_nutrient_basis: basis,
      p_nutrients: amounts, p_serving_quantity: quantity, p_serving_unit: unit,
    }).single();
    expect(result.error).toBeNull();
    return result.data!.food_id;
  }

  async function openSelected(browser: Browser, date: string, foodId = gramFood,
    options: Parameters<Browser["newContext"]>[0] = {}) {
    const context = await browser.newContext({ storageState: state, ...options });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${date}&foodId=${foodId}`);
    return { context, page, form: page.getByTestId("manual-diary-entry-form") };
  }

  async function saved(date: string) {
    const result = await client.from("diary_entries").select("*").eq("entry_date", date).single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function expectNoWrite(date: string) {
    const rows = await client.from("diary_entries").select("id", { count: "exact", head: true }).eq("entry_date", date);
    expect(rows.error).toBeNull();
    expect(rows.count).toBe(0);
  }

  async function expectInputs(form: Locator, multiplier: number) {
    for (const { code } of nutrientManifestV1) {
      await expect(control(form, fieldFor(code))).toHaveValue(String(consumed(code, multiplier)));
    }
  }

  test.beforeAll(async ({ browser }) => {
    client = createClient<Database>(localUrl!, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const user = await provisionActivatedLocalUser(client, { email, password });
    ownerId = user.data.user!.id;
    gramFood = await createFood("Synthetic all 35 grams", "per_100g", 100, "g");
    liquidFood = await createFood("Synthetic all 35 milliliters", "per_100ml", 100, "ml");
    servingFood = await createFood("Synthetic all 35 two-slice reference", "per_serving", 2, "slices");
    extensionOnlyFood = await createFood("Synthetic additional-only reference", "per_100g", 100, "g",
      referenceAmounts.filter(({ code }) => additionalNutrientCodesV1.includes(code as typeof additionalNutrientCodesV1[number])));
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    state = await context.storageState();
    await context.close();
  });

  test("persists all 35 distinct nutrients at 0, 25, 50, 100, 150 and 200 g", async ({ browser }) => {
    test.setTimeout(60_000);
    for (const [index, quantity] of [0, 25, 50, 100, 150, 200].entries()) {
      const date = `2026-12-${String(index + 1).padStart(2, "0")}`;
      const { context, form } = await openSelected(browser, date);
      await control(form, "serving_quantity").fill(String(quantity));
      await expectInputs(form, quantity / 100);
      await form.getByRole("button", { name: "Add entry", exact: true }).click();
      await expect(form).toContainText("Entry added.");
      const row = await saved(date);
      expect(row).toMatchObject({
        user_id: ownerId, serving_quantity: quantity, serving_unit: "g",
        calories: consumed("energy_kcal", quantity / 100),
        protein_g: consumed("protein_g", quantity / 100),
        carbohydrates_g: consumed("carbohydrates_g", quantity / 100),
        fat_g: consumed("fat_g", quantity / 100),
        additional_nutrient_snapshot: expectedAdditional(quantity / 100),
      });
      if (quantity === 200) expect(row.calories).toBe(403);
      await context.close();
    }
  });

  test("scales all 35 nutrients for fractional volume and verified reference servings", async ({ browser }) => {
    for (const [index, item] of [
      { foodId: liquidFood, quantity: 250, multiplier: 2.5 },
      { foodId: liquidFood, quantity: 12.5, multiplier: 0.125 },
      { foodId: servingFood, quantity: 0.5, multiplier: 0.25 },
      { foodId: servingFood, quantity: 9, multiplier: 4.5 },
    ].entries()) {
      const date = `2026-12-${String(index + 7).padStart(2, "0")}`;
      const { context, form } = await openSelected(browser, date, item.foodId);
      await control(form, "serving_quantity").fill(String(item.quantity));
      await expectInputs(form, item.multiplier);
      await form.getByRole("button", { name: "Add entry", exact: true }).click();
      await expect(form).toContainText("Entry added.");
      expect(await saved(date)).toMatchObject({
        serving_quantity: item.quantity, calories: consumed("energy_kcal", item.multiplier),
        additional_nutrient_snapshot: expectedAdditional(item.multiplier),
      });
      await context.close();
    }
  });

  test("creates a partially known consumed snapshot when only additional nutrients exist", async ({ browser }) => {
    const date = "2026-12-11";
    const { context, form } = await openSelected(browser, date, extensionOnlyFood);
    await control(form, "serving_quantity").fill("200");
    for (const name of ["calories", "protein_g", "carbohydrates_g", "fat_g"]) await expect(control(form, name)).toHaveValue("");
    for (const code of additionalNutrientCodesV1) await expect(control(form, code)).toHaveValue(String(consumed(code, 2)));
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await saved(date)).toMatchObject({
      calories: null, protein_g: null, carbohydrates_g: null, fat_g: null,
      additional_nutrient_snapshot: expectedAdditional(2),
    });
    await context.close();
  });

  test("renders stored EN/HE details and incomplete daily subtotals without catalog recalculation", async ({ browser }) => {
    const date = "2027-01-20";
    for (const multiplier of [1, 2]) {
      const snapshot = expectedAdditional(multiplier, { fiber_g: 0, vitamin_d_ug: null });
      const inserted = await client.rpc("create_manual_diary_entry_v2", {
        p_idempotency_key: randomUUID(), p_entry_date: date, p_meal_type: "lunch", p_food_id: null as unknown as string,
        p_food_name: `Synthetic stored details ${multiplier}`, p_brand_name: "Synthetic", p_serving_quantity: 100,
        p_serving_unit: "g", p_calories: 200, p_protein_g: 20, p_carbohydrates_g: 20, p_fat_g: 5, p_notes: "",
        p_additional_nutrients: { version: 1, values: additionalNutrientCodesV1.map(code => ({ code, amount: snapshot.values[code] })) },
      });
      expect(inserted.error).toBeNull();
    }
    const legacy = await client.from("diary_entries").insert({ user_id: ownerId, entry_date: date, meal_type: "lunch", source: "manual", food_name: "Synthetic historical uncaptured", calories: 0 });
    expect(legacy.error).toBeNull();
    for (const locale of ["en", "he"] as const) {
      const context = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(`/${locale}/today?date=${date}`);
      const daily = page.getByTestId("daily-additional-nutrients");
      await daily.locator(":scope > summary").click();
      await openGroups(daily);
      for (const code of additionalNutrientCodesV1) {
        const value = daily.locator(`[data-additional-nutrient-code="${code}"] dd`);
        await expect(value).toContainText(locale === "en" ? "Unknown" : "לא ידוע");
        if (code === "vitamin_d_ug") await expect(value.locator("bdi")).toHaveCount(0);
        else {
          const definition = nutrientManifestV1.find(item => item.code === code)!;
          const amount = code === "fiber_g" ? 0 : Number((consumed(code, 1) + consumed(code, 2)).toFixed(4));
          await expect(value.locator("bdi")).toHaveText(`${formatLocalizedNumber(locale, amount, { maximumFractionDigits: 4 })} ${definition.unit}`);
        }
      }
      const rows = page.locator("[data-diary-entry-id]");
      const historical = rows.filter({ hasText: "Synthetic historical uncaptured" }).getByTestId("snapshot-additional-nutrients");
      await historical.locator("summary").click();
      await expect(historical).toContainText(locale === "en" ? "were not captured" : "לא נשמרו");
      await expect(historical.locator("[data-additional-nutrient-code]")).toHaveCount(0);
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      await captureNutritionEvidence(page, `additional-details-${locale}-390`, "Two captured synthetic snapshots, independent explicit fiber zero/vitamin D unknown, and one historical uncaptured row. Daily complete totals remain unknown; known subtotals are shown.");
      await context.close();
    }
  });

  test("preserves additional manual values, zero and blank across errors, draft restore and repeated scaling", async ({ browser }) => {
    const date = "2026-12-12";
    const { context, page, form } = await openSelected(browser, date);
    await openGroups(form);
    await control(form, "serving_quantity").fill("150");
    await control(form, "fiber_g").fill("0");
    await control(form, "sodium_mg").fill("123.4567");
    await control(form, "vitamin_b12_ug").fill("");
    const sameValueOverride = consumed("selenium_ug", 1.5);
    await control(form, "selenium_ug").fill(String(sameValueOverride));
    await control(form, "food_name").fill("");
    const requestKey = await form.getByTestId("manual-diary-idempotency-key").inputValue();
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await control(form, "food_name").fill("Synthetic reviewed additional overrides");
    await page.reload();
    await expect(form.getByTestId("manual-diary-idempotency-key")).toHaveValue(requestKey);
    for (const quantity of [25, 50, 100, 150, 200, 25, 200]) {
      await control(form, "serving_quantity").fill(String(quantity));
      await expect(control(form, "fiber_g")).toHaveValue("0");
      await expect(control(form, "sodium_mg")).toHaveValue("123.4567");
      await expect(control(form, "vitamin_b12_ug")).toHaveValue("");
      await expect(control(form, "selenium_ug")).toHaveValue(String(sameValueOverride));
      await expect(control(form, "vitamin_c_mg")).toHaveValue(String(consumed("vitamin_c_mg", quantity / 100)));
    }
    for (const code of ["fiber_g", "sodium_mg", "vitamin_b12_ug", "selenium_ug"]) await expect(control(form, `automatic_${code}`)).not.toBeChecked();
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect((await saved(date)).additional_nutrient_snapshot).toEqual(expectedAdditional(2, {
      fiber_g: 0, sodium_mg: 123.4567, vitamin_b12_ug: null, selenium_ug: sameValueOverride,
    }));
    await context.close();
  });

  test("retains all draft amounts and retry identity while a selected reference becomes unavailable", async ({ browser }) => {
    const date = "2027-02-05";
    const food = await createFood("Synthetic unavailable draft reference", "per_100g", 100, "g");
    const { context, page, form } = await openSelected(browser, date, food);
    await openGroups(form);
    await control(form, "serving_quantity").fill("200");
    await control(form, "fiber_g").fill("0");
    await control(form, "sodium_mg").fill("77.1234");
    await control(form, "vitamin_d_ug").fill("");
    const retryKey = await form.getByTestId("manual-diary-idempotency-key").inputValue();
    const draftKey = await form.getAttribute("data-draft-storage-key");
    expect((await client.rpc("set_custom_food_archived", { p_food_id: food, p_is_archived: true })).error).toBeNull();
    await page.reload();
    await expect(form).toHaveAttribute("data-draft-storage-key", draftKey!);
    await expect(form.getByTestId("manual-diary-idempotency-key")).toHaveValue(retryKey);
    await expect(control(form, "serving_quantity")).toHaveValue("200");
    await expect(control(form, "calories")).toHaveValue("403");
    await expect(control(form, "fiber_g")).toHaveValue("0");
    await expect(control(form, "sodium_mg")).toHaveValue("77.1234");
    await expect(control(form, "vitamin_d_ug")).toHaveValue("");
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    await expectNoWrite(date);
    expect((await client.rpc("set_custom_food_archived", { p_food_id: food, p_is_archived: false })).error).toBeNull();
    await page.reload();
    for (const { code } of nutrientManifestV1) await expect(control(form, `automatic_${fieldFor(code)}`)).not.toBeChecked();
    await control(form, "automatic_calories").check();
    await control(form, "serving_quantity").fill("100");
    await expect(control(form, "calories")).toHaveValue("201");
    await expect(control(form, "fiber_g")).toHaveValue("0");
    await expect(control(form, "sodium_mg")).toHaveValue("77.1234");
    await expect(control(form, "vitamin_d_ug")).toHaveValue("");
    await expect(form.getByTestId("manual-diary-idempotency-key")).toHaveValue(retryKey);
    await expectNoWrite(date);
    await context.close();
  });

  test("reviews every native automatic total before writing and retains independent additional overrides", async ({ browser }) => {
    const date = "2026-12-13";
    const { context, page, form } = await openSelected(browser, date, gramFood, { javaScriptEnabled: false });
    await openGroups(form);
    await control(form, "automatic_fiber_g").uncheck();
    await control(form, "automatic_sodium_mg").uncheck();
    await control(form, "automatic_vitamin_b12_ug").uncheck();
    await control(form, "fiber_g").fill("0");
    await control(form, "sodium_mg").fill("123.4567");
    await control(form, "vitamin_b12_ug").fill("");
    await control(form, "serving_quantity").fill("200");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
    await expectNoWrite(date);
    for (const { code } of nutrientManifestV1) {
      const override = code === "fiber_g" ? "0" : code === "sodium_mg" ? "123.4567" : code === "vitamin_b12_ug" ? "" : String(consumed(code, 2));
      await expect(control(form, fieldFor(code))).toHaveValue(override);
    }
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await saved(date)).toMatchObject({
      calories: 403, additional_nutrient_snapshot: expectedAdditional(2, { fiber_g: 0, sodium_mg: 123.4567, vitamin_b12_ug: null }),
    });
    await context.close();
  });

  test("reviews manual storage rounding before persisting unlinked nutrition", async ({ browser }) => {
    const date = "2026-12-17";
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${date}`);
    const form = page.getByTestId("manual-diary-entry-form");
    await openGroups(form);
    await control(form, "food_name").fill("Synthetic manual rounded totals");
    await control(form, "serving_quantity").fill("1.2345");
    await control(form, "serving_unit").fill("serving");
    await control(form, "calories").fill("200");
    await control(form, "protein_g").fill("1.235");
    await control(form, "fat_g").fill("0");
    await control(form, "cholesterol_mg").fill("1.23445");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
    await expectNoWrite(date);
    await expect(control(form, "serving_quantity")).toHaveValue("1.235");
    await expect(control(form, "protein_g")).toHaveValue("1.24");
    await expect(control(form, "cholesterol_mg")).toHaveValue("1.2345");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await saved(date)).toMatchObject({
      food_id: null, serving_quantity: 1.235, calories: 200, protein_g: 1.24,
      carbohydrates_g: null, fat_g: 0,
      additional_nutrient_snapshot: {
        version: 1,
        values: Object.fromEntries(additionalNutrientCodesV1.map(code => [code, code === "cholesterol_mg" ? 1.2345 : null])),
      },
    });
    await context.close();
  });

  test("preserves native reviewed values when catalog changes across a validation rerender", async ({ browser }) => {
    const date = "2026-12-14";
    const amounts = nutrientManifestV1.map(({ code }, index) => ({ code, amount: code === "energy_kcal" ? 200 : index + 1 }));
    const sourceId = await createFood("Synthetic native reference stability", "per_100g", 100, "g", amounts);
    const { context, page, form } = await openSelected(browser, date, sourceId, { javaScriptEnabled: false });
    const fingerprint = await control(form, "reference_fingerprint").inputValue();
    await expect(control(form, "calories")).toHaveValue("200");
    const current = await client.rpc("get_owned_custom_food_editor", { p_food_id: sourceId });
    expect(current.error).toBeNull();
    const changed = await client.rpc("persist_custom_food", {
      p_food_id: sourceId, p_expected_edit_revision: current.data![0].edit_revision,
      p_name: "Synthetic native reference stability", p_brand_name: "Synthetic nutrient matrix", p_locale: "en",
      p_nutrient_basis: "per_100g", p_serving_quantity: 100, p_serving_unit: "g", p_aliases: [],
      p_nutrients: amounts.map(item => item.code === "energy_kcal" ? { ...item, amount: 300 } : item),
    });
    expect(changed.error).toBeNull();
    await control(form, "food_name").fill("");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(control(form, "calories")).toHaveValue("200");
    await expect(control(form, "reference_fingerprint")).toHaveValue(fingerprint);
    await expectNoWrite(date);
    await control(form, "food_name").fill("Synthetic reviewed original reference");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    await expect(control(form, "calories")).toHaveValue("200");
    for (const { code } of nutrientManifestV1) await expect(control(form, `automatic_${fieldFor(code)}`)).not.toBeChecked();
    await expectNoWrite(date);
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await saved(date)).toMatchObject({
      calories: 200,
      additional_nutrient_snapshot: { version: 1, values: Object.fromEntries(amounts
        .filter(({ code }) => additionalNutrientCodesV1.includes(code as typeof additionalNutrientCodesV1[number]))
        .map(({ code, amount }) => [code, amount])) },
    });
    await context.close();
  });

  test("rejects a captured public-food action when replayed under another authenticated owner", async ({ browser }) => {
    const date = "2026-12-15";
    const publicId = randomUUID();
    queryLocalAuthFixture(`
      insert into public.foods(id,food_type,name,locale,serving_size,serving_unit,data_quality,is_public,source_id)
      values('${publicId}','generic','Synthetic public session binding','en',100,'g','verified',true,
        (select id from public.food_sources where code='manual'));
      insert into public.food_nutrients(food_id,nutrient_id,amount,basis) values
        ('${publicId}',(select id from public.nutrients where code='energy_kcal'),200,'per_100g');
    `);
    const { context, page, form } = await openSelected(browser, date, publicId, { javaScriptEnabled: false });
    const requestKey = await control(form, "idempotency_key").inputValue();
    let submitted: Request | null = null;
    page.on("request", request => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/en/today") submitted = request;
    });
    await control(form, "serving_quantity").fill("200");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(submitted).not.toBeNull();
    const captured = submitted as unknown as Request;
    const otherClient = createClient<Database>(localUrl!, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const otherEmail = `all-nutrients-other-${randomUUID()}@example.test`;
    await provisionActivatedLocalUser(otherClient, { email: otherEmail, password });
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto("/en/auth/sign-in");
    await otherPage.getByLabel("Email").fill(otherEmail);
    await otherPage.getByLabel("Password").fill(password);
    await otherPage.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(otherPage).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    const replay = await otherContext.request.fetch(captured.url(), {
      method: "POST", data: captured.postDataBuffer()!,
      headers: { "content-type": captured.headers()["content-type"], origin: new URL(captured.url()).origin },
    });
    expect(replay.status()).toBeLessThan(500);
    // Translation dictionaries include success text even in an error response.
    // Owner-bound persistence and receipts are the security assertion.
    const otherReceipts = await otherClient.from("manual_diary_entry_requests").select("id", { count: "exact", head: true })
      .eq("idempotency_key", requestKey);
    expect(otherReceipts.error).toBeNull();
    expect(otherReceipts.count).toBe(0);
    const otherRows = await otherClient.from("diary_entries").select("id", { count: "exact", head: true }).eq("entry_date", date);
    expect(otherRows.error).toBeNull();
    expect(otherRows.count).toBe(0);
    expect((await saved(date)).calories).toBe(400);
    await otherContext.close();
    await context.close();
  });

  test("cannot inject authoritative reference nutrition through the exported legacy action endpoint", async ({ browser }) => {
    const date = "2026-12-16";
    const { context, page } = await openSelected(browser, date);
    const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")) as {
      node: Record<string, { exportedName?: string; filename?: string }>;
    };
    const action = Object.entries(manifest.node).find(([, definition]) =>
      definition.exportedName === "createDiaryEntryAction" && definition.filename?.endsWith("/today/actions.ts"));
    if (action) {
      const formData = new FormData();
      const requestKey = randomUUID();
      for (const [name, value] of Object.entries({
        idempotency_key: requestKey, entry_date: date, meal_type: "lunch", food_id: gramFood,
        food_name: "Synthetic forged reference endpoint", serving_quantity: "200", serving_unit: "g",
        calories: "9999", automatic_calories: "1",
      })) formData.set(name, value);
      const requireFlight = createRequire(join(process.cwd(), "package.json"));
      const { encodeReply } = requireFlight("next/dist/compiled/react-server-dom-webpack/client.node") as {
        encodeReply(value: unknown): Promise<string | FormData>;
      };
      // The former exported fourth argument was browser-controlled despite the
      // page using an encrypted closure. Send it through the real action RPC.
      const encoded = await encodeReply(["en", { status: "idle" }, formData, {
        ownerUserId: ownerId,
        food_id: gramFood, nutrient_basis: "per_100g", serving_quantity: 100, serving_unit: "g",
        calories: 9999, protein_g: 9999, carbohydrates_g: 9999, fat_g: 9999,
        nutrients: Object.fromEntries(nutrientManifestV1.map(({ code }) => [code, "9999"])),
      }]);
      const body = new Response(encoded);
      const response = await context.request.post(page.url(), {
        data: Buffer.from(await body.arrayBuffer()),
        headers: {
          "next-action": action[0], "content-type": body.headers.get("content-type")!,
          accept: "text/x-component", origin: new URL(page.url()).origin,
        },
      });
      expect(response.status()).toBeLessThan(500);
      const receipts = await client.from("manual_diary_entry_requests").select("id", { count: "exact", head: true })
        .eq("idempotency_key", requestKey);
      expect(receipts.error).toBeNull();
      expect(receipts.count).toBe(0);
    }
    // If the legacy action is absent from the build manifest, the former
    // endpoint is removed. Otherwise the explicit forged RPC above must fail.
    await expectNoWrite(date);
    await context.close();
  });
  test("edits captured totals independently and preserves uncaptured historical entries", async ({ browser }) => {
    const date = "2026-12-17";
    const args = {
      p_idempotency_key: randomUUID(), p_entry_date: date, p_meal_type: "lunch",
      p_food_id: gramFood, p_food_name: "Synthetic captured edit", p_brand_name: "",
      p_serving_quantity: 200, p_serving_unit: "g", p_calories: 400,
      p_protein_g: 40, p_carbohydrates_g: 40, p_fat_g: 10, p_notes: "",
    };
    const snapshot = expectedAdditional(2);
    const first = await client.rpc("create_manual_diary_entry_v2", { ...args,
      p_additional_nutrients: { version: 1, values: additionalNutrientCodesV1.map(code => ({ code, amount: snapshot.values[code] })) },
    }).single();
    expect(first.error).toBeNull();
    const legacy = await client.rpc("create_manual_diary_entry", { ...args,
      p_idempotency_key: randomUUID(), p_food_name: "Synthetic uncaptured edit",
    }).single();
    expect(legacy.error).toBeNull();
    const { context, page } = await openSelected(browser, date);
    const capturedRow = page.locator(`[data-diary-entry-id="${first.data!.diary_entry_id}"]`);
    await capturedRow.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = capturedRow.locator("form").filter({ has: page.locator('input[name="expected_version"]') });
    await openGroups(editor);
    await control(editor, "serving_quantity").fill("123");
    await control(editor, "fiber_g").fill("9.87654");
    await editor.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(editor.getByTestId("nutrition-review-required")).toBeVisible();
    await expect(control(editor, "fiber_g")).toHaveValue("9.8765");
    const unchanged = await client.from("diary_entries").select("version,additional_nutrient_snapshot")
      .eq("id", first.data!.diary_entry_id).single();
    expect(unchanged.data).toEqual({ version: 1, additional_nutrient_snapshot: snapshot });
    await editor.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(control(editor, "expected_version")).toHaveValue("2");
    const updated = await client.from("diary_entries").select("serving_quantity,calories,additional_nutrient_snapshot,version")
      .eq("id", first.data!.diary_entry_id).single();
    expect(updated.data).toEqual({ serving_quantity: 123, calories: 400, version: 2,
      additional_nutrient_snapshot: expectedAdditional(2, { fiber_g: 9.8765 }),
    });
    const legacyRow = page.locator(`[data-diary-entry-id="${legacy.data!.diary_entry_id}"]`);
    await legacyRow.getByRole("button", { name: "Edit", exact: true }).click();
    const legacyEditor = legacyRow.locator("form").filter({ has: page.locator('input[name="expected_version"]') });
    await control(legacyEditor, "serving_quantity").fill("99");
    await legacyEditor.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(control(legacyEditor, "expected_version")).toHaveValue("2");
    const historical = await client.from("diary_entries").select("serving_quantity,calories,additional_nutrient_snapshot")
      .eq("id", legacy.data!.diary_entry_id).single();
    expect(historical.data).toEqual({ serving_quantity: 99, calories: 400, additional_nutrient_snapshot: null });
    await openGroups(legacyEditor);
    await control(legacyEditor, "vitamin_d_ug").fill("0");
    await expect(control(legacyEditor, "additional_nutrients_captured")).toBeChecked();
    await legacyEditor.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(control(legacyEditor, "expected_version")).toHaveValue("3");
    const captured = await client.from("diary_entries").select("additional_nutrient_snapshot")
      .eq("id", legacy.data!.diary_entry_id).single();
    expect(captured.data?.additional_nutrient_snapshot).toEqual({ version: 1,
      values: Object.fromEntries(additionalNutrientCodesV1.map(code => [code, code === "vitamin_d_ug" ? 0 : null])),
    });
    await context.close();
  });

});
