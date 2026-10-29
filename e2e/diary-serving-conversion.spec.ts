import type { Database } from "@/lib/supabase/database.types";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Locator, type Request } from "@playwright/test";
import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import { nutrientManifestV1 } from "@/lib/nutrition-snapshots/manifest";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey,
  "Serving conversion requires disposable local authenticated fixtures.");
const input = (form: Locator, name: string) => form.locator(`input[name="${name}"]`);
const field = (code: string) => nutrientManifestV1.find(item => item.code === code)!.coreField ?? code;
const raw = (index: number) => index === 0 ? 201.4 : index + 1.1112;
const amount = (index: number, multiplier: number) => Number((raw(index) * multiplier).toFixed(nutrientManifestV1[index].precision));

async function expand(form: Locator) {
  for (const details of await form.locator("details").all()) {
    if (await details.getAttribute("open") === null) await details.locator("summary").click();
  }
}

test.describe.serial("verified physical catalog servings", () => {
  let client: ReturnType<typeof createClient<Database>>;
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  const foods = { per_100g: randomUUID(), per_serving: randomUUID() };
  const password = "SyntheticServingHotfix123!";

  async function open(browser: Browser, date: string, foodId = foods.per_100g, locale = "en", javaScriptEnabled = true) {
    const context = await browser.newContext({ storageState: state, javaScriptEnabled });
    const page = await context.newPage();
    await page.goto(`/${locale}/today?date=${date}&foodId=${foodId}`);
    return { context, page, form: page.getByTestId("manual-diary-entry-form") };
  }
  async function saved(date: string) {
    const result = await client.from("diary_entries").select("*").eq("entry_date", date).single();
    expect(result.error).toBeNull();
    return result.data!;
  }
  async function noWrite(date: string) {
    const rows = await client.from("diary_entries").select("id", { count: "exact", head: true }).eq("entry_date", date);
    expect(rows.error).toBeNull();
    expect(rows.count).toBe(0);
  }
  async function totals(form: Locator, multiplier: number) {
    for (const [index, definition] of nutrientManifestV1.entries()) {
      await expect(input(form, field(definition.code))).toHaveValue(String(amount(index, multiplier)));
    }
  }

  test.beforeAll(async ({ browser }) => {
    client = createClient<Database>(localUrl!, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const email = `serving-hotfix-${randomUUID()}@example.test`;
    await provisionActivatedLocalUser(client, { email, password });
    for (const basis of ["per_100g", "per_serving"] as const) {
      queryLocalAuthFixture(`
        insert into public.foods(id,food_type,name,brand_name,locale,serving_size,serving_unit,data_quality,is_public,source_id)
        values('${foods[basis]}','branded','Synthetic TEST CUP ${basis}','TARA','en',50,'g','verified',true,
          (select id from public.food_sources where code='manual'));
        insert into public.food_nutrients(food_id,nutrient_id,amount,basis) values
          ${nutrientManifestV1.map(({ code }, index) => `('${foods[basis]}',(select id from public.nutrients where code='${code}'),${raw(index)},'${basis}')`).join(",")};
      `);
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=/);
    state = await context.storageState();
    await context.close();
  });

  for (const [basisIndex, basis] of (["per_100g", "per_serving"] as const).entries()) {
    for (const [localeIndex, locale] of ["en", "he"].entries()) {
      test(`${locale} ${basis}: fresh one serving and all 35 totals at 1, 2, 0.5, 0 servings`, async ({ browser }) => {
        test.setTimeout(60_000);
        for (const [index, quantity] of [1, 2, 0.5, 0].entries()) {
          const date = `2027-07-${String(1 + basisIndex * 8 + localeIndex * 4 + index).padStart(2, "0")}`;
          const { context, page, form } = await open(browser, date, foods[basis], locale);
          await expect(input(form, "serving_quantity")).toHaveValue("1");
          await expect(input(form, "serving_unit")).toHaveValue("serving");
          await expect(page.getByTestId("catalog-serving-equivalence")).toContainText("1 serving = 50 g");
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
          await input(form, "serving_quantity").fill(String(quantity));
          const multiplier = quantity * (basis === "per_100g" ? 0.5 : 1);
          await totals(form, multiplier);
          await form.getByRole("button", { name: locale === "he" ? "הוספת רשומה" : "Add entry", exact: true }).click();
          await expect(form).toContainText(locale === "he" ? "הרשומה נוספה." : "Entry added.");
          const row = await saved(date);
          expect(row).toMatchObject({ serving_quantity: quantity, serving_unit: "serving", calories: amount(0, multiplier),
            protein_g: amount(1, multiplier), carbohydrates_g: amount(2, multiplier), fat_g: amount(3, multiplier) });
          expect(row.additional_nutrient_snapshot).toEqual({ version: 1, values: Object.fromEntries(
            nutrientManifestV1.filter(item => !item.coreField).map(item => [item.code,
              amount(nutrientManifestV1.indexOf(item), multiplier)])) });
          await context.close();
        }
      });
    }
  }

  test("unit transitions preserve quantity and independent manual overrides; automatic restores the raw reference", async ({ browser }) => {
    const { context, form } = await open(browser, "2027-07-17");
    await expand(form);
    await input(form, "fiber_g").fill("0");
    await input(form, "sodium_mg").fill("77.1234");
    await input(form, "vitamin_b12_ug").fill("");
    const key = await input(form, "idempotency_key").inputValue();
    for (const [quantity, unit] of [["50", "g"], ["1", "serving"], ["0.05", "kg"], ["1", "serving"]]) {
      await input(form, "serving_unit").fill(unit);
      await expect(input(form, "serving_quantity")).toHaveValue(quantity);
      await expect(input(form, "calories")).toHaveValue("101");
      await expect(input(form, "fiber_g")).toHaveValue("0");
      await expect(input(form, "sodium_mg")).toHaveValue("77.1234");
      await expect(input(form, "vitamin_b12_ug")).toHaveValue("");
    }
    await input(form, "serving_quantity").fill("2");
    await input(form, "automatic_fiber_g").check();
    await expect(input(form, "fiber_g")).toHaveValue(String(amount(4, 1)));
    await input(form, "serving_unit").fill("g");
    await expect(input(form, "serving_quantity")).toHaveValue("100");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    const row = await saved("2027-07-17");
    expect(row.additional_nutrient_snapshot).toMatchObject({ values: { sodium_mg: 77.1234, vitamin_b12_ug: null } });
    const receipt = await client.from("manual_diary_entry_requests").select("id").eq("idempotency_key", key);
    expect(receipt.data).toHaveLength(1);
    await context.close();
  });

  for (const [basis, locale, day] of [["per_100g", "en", "18"], ["per_serving", "he", "21"]] as const) {
    test(`${locale} native ${basis}: serving/gram transitions require review and replay once`, async ({ browser }) => {
      const date = `2027-07-${day}`;
      const { context, page, form } = await open(browser, date, foods[basis], locale, false);
      const submit = form.getByRole("button", { name: locale === "he" ? "הוספת רשומה" : "Add entry", exact: true });
      let request: Request | undefined;
      page.on("request", current => { if (current.method() === "POST" && new URL(current.url()).pathname === `/${locale}/today`) request = current; });
      await input(form, "serving_quantity").fill("2");
      await submit.click();
      await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
      await noWrite(date);
      await totals(form, basis === "per_100g" ? 1 : 2);
      await input(form, "serving_unit").fill("g");
      await submit.click();
      await expect(input(form, "serving_quantity")).toHaveValue("100");
      await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
      await noWrite(date);
      await input(form, "serving_unit").fill("serving");
      await submit.click();
      await expect(input(form, "serving_quantity")).toHaveValue("2");
      await noWrite(date);
      await submit.click();
      await expect(form).toContainText(locale === "he" ? "הרשומה נוספה." : "Entry added.");
      const captured = request!;
      await context.request.fetch(captured.url(), { method: "POST", data: captured.postDataBuffer()!, headers: {
        "content-type": captured.headers()["content-type"], origin: new URL(captured.url()).origin,
      } });
      expect(await saved(date)).toMatchObject({ serving_quantity: 2, serving_unit: "serving", calories: basis === "per_100g" ? 201 : 403 });
      await context.close();
    });
  }

  test("missing, zero and incompatible catalog metadata never invent a serving conversion", async ({ browser }) => {
    for (const [quantity, unit] of [[null, null], [0, "g"], [50, "ml"]] as const) {
      const id = randomUUID();
      queryLocalAuthFixture(`
        insert into public.foods(id,food_type,name,locale,serving_size,serving_unit,data_quality,is_public)
        values('${id}','generic','Synthetic incompatible serving','en',${quantity ?? "null"},${unit ? `'${unit}'` : "null"},'verified',true);
        insert into public.food_nutrients(food_id,nutrient_id,amount,basis)
        values('${id}',(select id from public.nutrients where code='energy_kcal'),200,'per_100g');
      `);
      const { context, page, form } = await open(browser, "2027-07-22", id);
      await expect(input(form, "serving_quantity")).toHaveValue("100");
      await expect(page.getByTestId("catalog-serving-equivalence")).toHaveCount(0);
      await input(form, "serving_unit").fill("serving");
      await form.getByRole("button", { name: "Add entry", exact: true }).click();
      await expect(form).toContainText("Automatic calculation requires a valid quantity");
      await noWrite("2027-07-22");
      await context.close();
    }
  });

  for (const javaScriptEnabled of [true, false]) {
    test(`Enter submits the entry rather than resetting quantity (JavaScript ${javaScriptEnabled})`, async ({ browser }) => {
      const date = javaScriptEnabled ? "2027-07-24" : "2027-07-25";
      const { context, page, form } = await open(browser, date, foods.per_100g, "en", javaScriptEnabled);
      await input(form, "serving_quantity").fill("2");
      await input(form, "food_name").press("Enter");
      if (!javaScriptEnabled) {
        await expect(page.getByTestId("nutrition-review-required")).toBeVisible();
        await expect(input(form, "serving_quantity")).toHaveValue("2");
        await noWrite(date);
        await input(form, "food_name").press("Enter");
      }
      await expect(form).toContainText("Entry added.");
      expect(await saved(date)).toMatchObject({ serving_quantity: 2, serving_unit: "serving", calories: 201 });
      await context.close();
    });
  }

  test("fully manual totals keep explicit custom portion labels", async ({ browser }) => {
    const { context, form } = await open(browser, "2027-07-23");
    await expand(form);
    for (const control of await form.locator('input[name^="automatic_"]').all()) await control.uncheck();
    await input(form, "serving_unit").fill("cup");
    await expect(input(form, "serving_quantity")).toHaveValue("1");
    await form.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(form).toContainText("Entry added.");
    expect(await saved("2027-07-23")).toMatchObject({ serving_quantity: 1, serving_unit: "cup", calories: 101 });
    await context.close();
  });

  test("old 100 serving draft is retained for review and explicit reset preserves manual values and retry identity", async ({ browser }) => {
    const date = "2027-07-19";
    const { context, page, form } = await open(browser, date);
    const storageKey = (await form.getAttribute("data-draft-storage-key"))!;
    const key = await input(form, "idempotency_key").inputValue();
    await page.evaluate(({ storageKey, key }) => {
      const stored = JSON.parse(sessionStorage.getItem(storageKey)!);
      stored.referenceKey = "old-basis-only-reference";
      stored.idempotencyKey = key;
      Object.assign(stored.values, { serving_quantity: "100", serving_unit: "serving", quantity_unit: "serving", sodium_mg: "77.1234", automatic_sodium_mg: "" });
      sessionStorage.setItem(storageKey, JSON.stringify(stored));
    }, { storageKey, key });
    await page.reload();
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    await expect(input(form, "serving_quantity")).toHaveValue("100");
    await expect(page.getByTestId("incompatible-serving-draft")).toBeVisible();
    await expand(form);
    for (const { code } of nutrientManifestV1) await expect(input(form, `automatic_${field(code)}`)).not.toBeChecked();
    await page.reload();
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    await form.getByRole("button", { name: /Reset quantity to one catalog serving/ }).click();
    await expect(input(form, "serving_quantity")).toHaveValue("1");
    await expect(input(form, "idempotency_key")).toHaveValue(key);
    await expand(form);
    await expect(input(form, "sodium_mg")).toHaveValue("77.1234");
    await input(form, "automatic_calories").check();
    await expect(input(form, "calories")).toHaveValue("101");
    await input(form, "serving_quantity").fill("2");
    await expect(input(form, "calories")).toHaveValue("201");
    await expect(input(form, "sodium_mg")).toHaveValue("77.1234");
    await noWrite(date);
    await context.close();
  });

  test("catalog serving drift disables all automatic fields and native reset keeps manual totals", async ({ browser }) => {
    const date = "2027-07-20";
    const { context, page, form } = await open(browser, date);
    await input(form, "calories").fill("222");
    const key = await input(form, "idempotency_key").inputValue();
    queryLocalAuthFixture(`update public.foods set serving_size=25 where id='${foods.per_100g}'`);
    await page.reload();
    await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
    await expect(page.getByTestId("catalog-serving-equivalence")).toContainText("1 serving = 25 g");
    await expect(input(form, "calories")).toHaveValue("222");
    await input(form, "serving_quantity").fill("2");
    await expect(input(form, "calories")).toHaveValue("222");
    await expect(input(form, "automatic_protein_g")).not.toBeChecked();
    await expect(input(form, "idempotency_key")).toHaveValue(key);
    await context.close();
    const native = await open(browser, date, foods.per_100g, "en", false);
    await input(native.form, "automatic_calories").uncheck();
    await input(native.form, "calories").fill("222");
    await input(native.form, "serving_quantity").fill("5");
    const nativeKey = await input(native.form, "idempotency_key").inputValue();
    await native.form.getByRole("button", { name: /Reset quantity to one catalog serving/ }).click();
    await expect(input(native.form, "serving_quantity")).toHaveValue("1");
    await expect(input(native.form, "calories")).toHaveValue("222");
    await expect(input(native.form, "idempotency_key")).toHaveValue(nativeKey);
    await noWrite(date);
    await native.context.close();
    queryLocalAuthFixture(`update public.foods set serving_size=50 where id='${foods.per_100g}'`);
  });
});
