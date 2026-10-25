import { provisionActivatedLocalUser } from "@/e2e/helpers/local-auth";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { additionalSnapshotToRequest, parseAdditionalNutrientSnapshot } from "@/lib/nutrition-snapshots/contracts";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const password = "SyntheticNutritionCorrectness123!";
const nutrients = ["calories", "protein_g", "carbohydrates_g", "fat_g"] as const;

test.skip(
  process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey,
  "Nutrition correctness requires the disposable local fixture runner.",
);

function diaryForm(page: Page) {
  return page.getByTestId("manual-diary-entry-form");
}

function input(form: Locator, name: string) {
  return form.locator(`input[name="${name}"]`);
}

test.describe.serial("consumed nutrient snapshots", () => {
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let client: SupabaseClient<Database>;
  let userId: string;
  let foodId: string;
  let liquidFoodId: string;
  let servingFoodId: string;
  const email = `nutrition-correctness-${randomUUID()}@example.test`;

  async function openSelected(
    browser: Browser,
    date: string,
    selectedFoodId = foodId,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    const context = await browser.newContext({ storageState: state, ...options });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${date}&foodId=${selectedFoodId}`);
    return { context, page, form: diaryForm(page) };
  }

  async function savedOn(date: string) {
    const result = await client.from("diary_entries").select("*")
      .eq("entry_date", date).single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function captureEvidence(browser: Browser, page: Page, entryId: string, output: string) {
    mkdirSync(output, { recursive: true });
    const captures = [];
    for (const locale of ["en", "he"] as const) {
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.goto(`/${locale}/today?date=2026-10-24`);
        await expect(page.locator(`[data-diary-entry-id="${entryId}"]`)).toContainText("Test");
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => window.scrollTo(0, 0));
        const name = `consumed-200g-${locale}-${viewport.width}.png`;
        const screenshot = await page.screenshot({ path: join(output, name), fullPage: true, animations: "disabled" });
        captures.push({
          name, locale, viewport, browser: browser.version(),
          route: `/${locale}/today?date=2026-10-24`,
          sha256: createHash("sha256").update(screenshot).digest("hex"),
        });
      }
    }
    writeFileSync(join(output, "manifest.json"), JSON.stringify({
      capturedAt: new Date().toISOString(),
      sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
      renderedSourceFiles: ["app/[locale]/(app)/today/page.tsx", "app/[locale]/(app)/today/create-action.ts",
        "app/[locale]/(app)/today/create-submission.ts", "app/globals.css", "components/diary/diary-entry-form.tsx",
        "lib/food-selection/nutrient-scaling.ts", "lib/nutrition-snapshots/decimal.ts", "lib/nutrition-snapshots/manifest.ts",
        "components/nutrition/additional-nutrient-details.tsx", "messages/en.json", "messages/he.json"].map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })),
      workingTreeStatus: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
      workingDiffSha256: createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--binary"], { maxBuffer: 32 * 1024 * 1024 })).digest("hex"),
      fixture: {
        synthetic: true, provisioner: "provisionActivatedLocalUser",
        foodCreation: "authenticated create_custom_food RPC", foodName: "Test", brandName: "Tnuva",
        nutrientBasis: "per_100g", reference: { calories: 200, protein_g: 20, carbohydrates_g: 20, fat_g: 5 },
        diary: { entryId, serving_quantity: 200, serving_unit: "g", calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10 },
      },
      captures,
    }, null, 2) + "\n");
  }

  async function createFood(
    name: string,
    basis: string,
    quantity: number,
    unit: string,
    amounts: { amount: number; code: string }[],
  ) {
    const result = await client.rpc("create_custom_food", {
      p_aliases: [],
      p_brand_name: "Tnuva",
      p_idempotency_key: randomUUID(),
      p_locale: "en",
      p_name: name,
      p_nutrient_basis: basis,
      p_nutrients: amounts,
      p_serving_quantity: quantity,
      p_serving_unit: unit,
    });
    expect(result.error).toBeNull();
    return result.data![0].food_id;
  }

  test.beforeAll(async ({ browser }) => {
    client = createClient<Database>(localUrl!, localKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const provisioned = await provisionActivatedLocalUser(client, { email, password });
    expect(provisioned.error).toBeNull();
    userId = provisioned.data.user!.id;
    foodId = await createFood("Test", "per_100g", 100, "g", [
      { code: "energy_kcal", amount: 200 },
      { code: "protein_g", amount: 20 },
      { code: "carbohydrates_g", amount: 20 },
      { code: "fat_g", amount: 5 },
    ]);
    liquidFoodId = await createFood("Synthetic liquid", "per_100ml", 100, "ml", [
      { code: "energy_kcal", amount: 50 },
      { code: "protein_g", amount: 0 },
      { code: "fat_g", amount: 1.25 },
    ]);
    servingFoodId = await createFood("Synthetic two-slice serving", "per_serving", 2, "slices", [
      { code: "energy_kcal", amount: 125 },
      { code: "protein_g", amount: 0 },
      { code: "fat_g", amount: 4.5 },
    ]);
    const targets = await client.from("nutrition_targets").insert({
      user_id: userId, effective_from: "2026-01-01",
      calories: 800, protein_g: 80, carbohydrates_g: 80, fat_g: 20,
    });
    expect(targets.error).toBeNull();
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

  test("persists the exact 200 g reproduction and reads consumed totals once", async ({ browser }, testInfo) => {
    const date = "2026-10-24";
    const { context, page, form } = await openSelected(browser, date);
    await expect(input(form, "food_name")).toHaveValue("Test");
    await expect(input(form, "brand_name")).toHaveValue("Tnuva");
    for (const quantity of [0, 25, 50, 100, 150, 200]) {
      await input(form, "serving_quantity").fill(String(quantity));
      for (const [index, reference] of [200, 20, 20, 5].entries()) {
        await expect(input(form, nutrients[index])).toHaveValue(String(reference * quantity / 100));
      }
    }
    const requestKey = await form.getByTestId("manual-diary-idempotency-key").inputValue();
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    const saved = await savedOn(date);
    expect(saved).toMatchObject({
      user_id: userId, food_id: foodId, food_name: "Test", brand_name: "Tnuva",
      calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10,
      serving_quantity: 200, serving_unit: "g", source: "manual",
    });
    const snapshot = parseAdditionalNutrientSnapshot(saved.additional_nutrient_snapshot);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) throw new Error("Saved snapshot did not satisfy the v1 contract.");
    const replay = await client.rpc("create_manual_diary_entry_v2", {
      p_idempotency_key: requestKey, p_entry_date: date, p_meal_type: saved.meal_type,
      p_food_name: "Test", p_brand_name: "Tnuva", p_food_id: foodId,
      p_calories: 400, p_protein_g: 40, p_carbohydrates_g: 40, p_fat_g: 10,
      p_serving_quantity: 200, p_serving_unit: "g", p_notes: saved.notes,
      p_additional_nutrients: additionalSnapshotToRequest(snapshot.data),
    } as Database["public"]["Functions"]["create_manual_diary_entry_v2"]["Args"]);
    expect(replay.error).toBeNull();
    expect(replay.data?.[0].diary_entry_id).toBe(saved.id);
    for (let read = 0; read < 2; read += 1) {
      await page.reload();
      const row = page.locator(`[data-diary-entry-id="${saved.id}"]`);
      await expect(row.locator(".diary-row-calories bdi")).toHaveText("400 kcal");
      await expect(row.locator(".diary-row-metadata")).toContainText("200 g");
      await expect(row.locator(".diary-row-macros dd")).toHaveText(["40 g", "40 g", "10 g"]);
      for (const [index, value] of [400, 40, 40, 10].entries()) {
        const metric = page.locator(`[data-nutrition-metric="${nutrients[index]}"]`);
        await expect(metric.locator("dl > div").first().locator("dd"))
          .toHaveText(`${value} ${index === 0 ? "kcal" : "g"}`);
        await expect(metric.locator(".nutrition-comparison")).toContainText("50% of target");
      }
    }
    expect((await savedOn(date)).calories).toBe(400);
    await captureEvidence(browser, page, saved.id, testInfo.outputPath("nutrition-correctness-evidence"));
    await context.close();
  });

  test("keeps independent manual overrides through validation, session restore, and quantity changes", async ({ browser }) => {
    const date = "2026-10-25";
    const { context, page, form } = await openSelected(browser, date);
    await input(form, "serving_quantity").fill("150");
    await input(form, "calories").fill("333");
    await input(form, "protein_g").fill("0");
    await input(form, "fat_g").fill("");
    for (const field of ["calories", "protein_g", "fat_g"]) {
      await expect(input(form, `automatic_${field}`)).not.toBeChecked();
    }
    await expect(input(form, "automatic_carbohydrates_g")).toBeChecked();
    await input(form, "automatic_fat_g").check();
    await expect(input(form, "fat_g")).toHaveValue("7.5");
    await input(form, "fat_g").fill("");
    await input(form, "food_name").fill("");
    const requestKey = await form.getByTestId("manual-diary-idempotency-key").inputValue();
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await input(form, "serving_quantity").fill("200");
    await expect(input(form, "calories")).toHaveValue("333");
    await expect(input(form, "protein_g")).toHaveValue("0");
    await expect(input(form, "carbohydrates_g")).toHaveValue("40");
    await expect(input(form, "fat_g")).toHaveValue("");
    await input(form, "food_name").fill("Intentional overrides");
    await page.reload();
    await expect(input(form, "food_name")).toHaveValue("Intentional overrides");
    await expect(form.getByTestId("manual-diary-idempotency-key")).toHaveValue(requestKey);
    for (const quantity of ["25", "50", "100", "150", "200", "25", "200"]) {
      await input(form, "serving_quantity").fill(quantity);
      await expect(input(form, "calories")).toHaveValue("333");
      await expect(input(form, "protein_g")).toHaveValue("0");
      await expect(input(form, "carbohydrates_g")).toHaveValue(String(Number(quantity) / 5));
      await expect(input(form, "fat_g")).toHaveValue("");
    }
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await savedOn(date)).toMatchObject({
      calories: 333, protein_g: 0, carbohydrates_g: 40, fat_g: null, serving_quantity: 200,
    });
    await context.close();
  });

  test("uses verified serving quantities and independent null/zero values without drift", async ({ browser }) => {
    for (const item of [
      { food: liquidFoodId, date: "2026-10-26", quantity: "250", values: ["125", "0", "", "3.13"] },
      { food: servingFoodId, date: "2026-10-27", quantity: "0.5", values: ["31", "0", "", "1.13"] },
    ]) {
      const { context, form } = await openSelected(browser, item.date, item.food);
      await input(form, "serving_quantity").fill(item.quantity);
      for (const [index, value] of item.values.entries()) {
        await expect(input(form, nutrients[index])).toHaveValue(value);
      }
      await form.getByRole("button", { name: "Add entry", exact: true }).click();
      await expect(form).toContainText("Entry added.");
      const saved = await savedOn(item.date);
      expect(saved.protein_g).toBe(0);
      expect(saved.carbohydrates_g).toBeNull();
      expect(saved.calories).toBe(Number(item.values[0]));
      await context.close();
    }
  });

  test("restores legacy drafts as intentional manual snapshots without guessing provenance", async ({ browser }) => {
    const date = "2026-10-30";
    const { context, page, form } = await openSelected(browser, date);
    const storageKey = await form.getAttribute("data-draft-storage-key");
    expect(storageKey).not.toBeNull();
    const requestKey = randomUUID();
    await page.evaluate(({ key, selectedFoodId, idempotencyKey, entryDate }) => {
      sessionStorage.setItem(key, JSON.stringify({
        version: 1, idempotencyKey,
        values: {
          food_id: selectedFoodId, food_name: "Legacy reviewed snapshot", brand_name: "Tnuva",
          entry_date: entryDate, meal_type: "lunch", serving_quantity: "200", serving_unit: "g",
          calories: "210", protein_g: "0", carbohydrates_g: "", fat_g: "7", notes: "",
        },
      }));
    }, { key: storageKey!, selectedFoodId: foodId, idempotencyKey: requestKey, entryDate: date });
    await page.reload();
    await expect(input(form, "food_name")).toHaveValue("Legacy reviewed snapshot");
    for (const field of nutrients) await expect(input(form, `automatic_${field}`)).not.toBeChecked();
    await input(form, "serving_quantity").fill("50");
    for (const [index, value] of ["210", "0", "", "7"].entries()) {
      await expect(input(form, nutrients[index])).toHaveValue(value);
    }
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await savedOn(date)).toMatchObject({
      calories: 210, protein_g: 0, carbohydrates_g: null, fat_g: 7, serving_quantity: 50,
    });
    await context.close();
  });

  test("rejects incompatible dimensions until the user chooses a valid unit or manual totals", async ({ browser }) => {
    const date = "2026-10-31";
    const { context, form } = await openSelected(browser, date);
    await input(form, "serving_quantity").fill("200");
    await input(form, "serving_unit").fill("ml");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(input(form, "serving_unit")).toHaveAttribute("aria-invalid", "true");
    const rows = await client.from("diary_entries").select("id", { count: "exact", head: true }).eq("entry_date", date);
    expect(rows.error).toBeNull();
    expect(rows.count).toBe(0);
    await input(form, "serving_unit").fill("g");
    await expect(input(form, "calories")).toHaveValue("400");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await savedOn(date)).toMatchObject({ serving_unit: "g", calories: 400 });
    await context.close();
  });

  test("retains reviewed draft totals as manual when the catalog reference changes", async ({ browser }) => {
    const date = "2026-11-01";
    const driftFoodId = await createFood("Synthetic reference drift", "per_100g", 100, "g", [
      { code: "energy_kcal", amount: 200 },
      { code: "protein_g", amount: 20 },
      { code: "carbohydrates_g", amount: 20 },
      { code: "fat_g", amount: 5 },
    ]);
    const { context, page, form } = await openSelected(browser, date, driftFoodId);
    await input(form, "serving_quantity").fill("200");
    await expect(input(form, "calories")).toHaveValue("400");
    const current = await client.rpc("get_owned_custom_food_editor", { p_food_id: driftFoodId });
    expect(current.error).toBeNull();
    const changed = await client.rpc("persist_custom_food", {
      p_aliases: [], p_brand_name: "Tnuva", p_expected_edit_revision: current.data![0].edit_revision,
      p_food_id: driftFoodId, p_locale: "en", p_name: "Synthetic reference drift", p_nutrient_basis: "per_100g",
      p_nutrients: [
        { code: "energy_kcal", amount: 300 }, { code: "protein_g", amount: 20 },
        { code: "carbohydrates_g", amount: 20 }, { code: "fat_g", amount: 5 },
      ],
      p_serving_quantity: 100, p_serving_unit: "g",
    });
    expect(changed.error).toBeNull();
    await page.reload();
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    for (const field of nutrients) await expect(input(form, `automatic_${field}`)).not.toBeChecked();
    await expect(input(form, "calories")).toHaveValue("400");
    await input(form, "serving_quantity").fill("150");
    await expect(input(form, "calories")).toHaveValue("400");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await savedOn(date)).toMatchObject({
      food_id: driftFoodId, calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10, serving_quantity: 150,
    });
    await context.close();
  });

  test("calculates native no-JavaScript submissions on the server and replays once", async ({ browser }) => {
    const date = "2026-10-28";
    const retryFoodId = await createFood("Synthetic native retry food", "per_100g", 100, "g", [
      { code: "energy_kcal", amount: 200 },
      { code: "protein_g", amount: 20 },
      { code: "carbohydrates_g", amount: 20 },
      { code: "fat_g", amount: 5 },
    ]);
    const { context, page, form } = await openSelected(browser, date, retryFoodId, { javaScriptEnabled: false });
    let submittedRequest: Request | null = null;
    page.on("request", request => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/en/today") submittedRequest = request;
    });
    await input(form, "serving_quantity").fill("200");
    // Without JavaScript the visible preview remains at the reference amount.
    await expect(input(form, "calories")).toHaveValue("200");
    // Automatic fields are recalculated from authenticated catalog nutrition,
    // even if the submitted browser value is changed without clearing its mode.
    await input(form, "calories").fill("999");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
    await expect(input(form, "calories")).toHaveValue("400");
    const beforeConfirmation = await client.from("diary_entries").select("id", { count: "exact", head: true }).eq("entry_date", date);
    expect(beforeConfirmation.count).toBe(0);
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await savedOn(date)).toMatchObject({ calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10 });
    expect(submittedRequest).not.toBeNull();
    const captured = submittedRequest as unknown as Request;
    const replayOptions = {
      data: captured.postDataBuffer()!, method: "POST",
      headers: { "content-type": captured.headers()["content-type"], origin: new URL(captured.url()).origin },
    };
    const archived = await client.rpc("set_custom_food_archived", { p_food_id: retryFoodId, p_is_archived: true });
    expect(archived.error).toBeNull();
    try {
      const response = await context.request.fetch(captured.url(), replayOptions);
      expect(response.status()).toBeLessThan(400);
      expect(await response.text()).toContain("Entry added.");
      expect(await savedOn(date)).toMatchObject({ food_id: retryFoodId, calories: 400, serving_quantity: 200 });
    } finally {
      const restored = await client.rpc("set_custom_food_archived", { p_food_id: retryFoodId, p_is_archived: false });
      expect(restored.error).toBeNull();
    }
    const deleted = await client.from("foods").delete().eq("id", retryFoodId);
    expect(deleted.error).toBeNull();
    const deletedSourceReplay = await context.request.fetch(captured.url(), replayOptions);
    expect(deletedSourceReplay.status()).toBeLessThan(400);
    expect(await deletedSourceReplay.text()).toContain("Entry added.");
    expect((await savedOn(date)).food_id).toBeNull();
    expect(await savedOn(date)).toMatchObject({ calories: 400, serving_quantity: 200 });
    await context.close();
  });

  test("retains native manual overrides and automatic flags after validation errors", async ({ browser }) => {
    const date = "2026-10-29";
    const { context, page, form } = await openSelected(browser, date, foodId, { javaScriptEnabled: false });
    await input(form, "automatic_calories").uncheck();
    await input(form, "automatic_fat_g").uncheck();
    await input(form, "calories").fill("321");
    await input(form, "fat_g").fill("");
    await input(form, "food_name").fill("");
    await input(form, "serving_quantity").fill("100");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(input(form, "automatic_calories")).not.toBeChecked();
    await expect(input(form, "automatic_fat_g")).not.toBeChecked();
    await expect(input(form, "automatic_protein_g")).toBeChecked();
    await expect(input(form, "calories")).toHaveValue("321");
    await input(form, "food_name").fill("Native intentional override");
    await input(form, "serving_quantity").fill("200");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
    await expect(input(form, "protein_g")).toHaveValue("40");
    await expect(input(form, "calories")).toHaveValue("321");
    await expect(input(form, "fat_g")).toHaveValue("");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await savedOn(date)).toMatchObject({ calories: 321, protein_g: 40, carbohydrates_g: 40, fat_g: null });
    await context.close();
  });
});
