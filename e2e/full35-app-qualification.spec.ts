import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Request } from "@playwright/test";
import { provisionActivatedLocalUser, queryLocalAuthFixture } from "./helpers/local-auth";
import type { Database } from "@/lib/supabase/database.types";

test("rejects a valid automatic draft when enrichment commits after render and before first submit", async ({ browser }) => {
  test.setTimeout(60_000);
  const url = process.env.LOCAL_SUPABASE_URL;
  const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
  if (process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !url || !key || new URL(url).hostname !== "127.0.0.1") {
    throw new Error("Stage5 requires the disposable local application runner; it cannot be skipped.");
  }
  const client = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `full35-stale-${randomUUID()}@example.test`;
  const password = `${randomBytes(24).toString("hex")}aA!`;
  await provisionActivatedLocalUser(client, { email, password });
  const nutrients = [{ code: "energy_kcal", amount: 200 }, { code: "protein_g", amount: 20 },
    { code: "carbohydrates_g", amount: 20 }, { code: "fat_g", amount: 5 }];
  const foodId = randomUUID();
  queryLocalAuthFixture(`insert into public.foods(id,food_type,name,locale,data_quality,is_public,source_id)
    values('${foodId}','generic','Synthetic enrichment race','en','verified',true,(select id from public.food_sources where code='manual'));
    insert into public.food_nutrients(food_id,nutrient_id,amount,basis) values
    ${nutrients.map(({ code, amount }) => `('${foodId}',(select id from public.nutrients where code='${code}'),${amount},'per_100g')`).join(",")};`);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/en/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/today\?date=/);
  await page.goto(`/en/today?date=2026-11-01&foodId=${foodId}`);
  const actual = page.getByTestId("manual-diary-entry-form");
  const core = { calories: "400", protein_g: "40", carbohydrates_g: "40", fat_g: "10" };
  await actual.locator('input[name="serving_quantity"]').fill("200");
  for (const [name, value] of Object.entries(core)) await expect(actual.locator(`input[name="${name}"]`)).toHaveValue(value);
  let completedRequest: Request | undefined;
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/en/today") completedRequest = request; });
  await actual.getByRole("button", { name: "Add entry", exact: true }).click();
  await expect(actual).toContainText("Entry added.");
  const original = await client.from("diary_entries").select("*").eq("entry_date", "2026-11-01").single(); expect(original.error).toBeNull();
  const originalRequest = completedRequest!;
  const originalReceipts = await client.from("manual_diary_entry_requests").select("*"); expect(originalReceipts.error).toBeNull();
  await page.goto(`/en/today?date=2026-11-02&foodId=${foodId}`);
  await actual.locator('input[name="serving_quantity"]').fill("200");
  await expect(actual.locator('input[name="calories"]')).toHaveValue("400");
  const fingerprint = await actual.locator('input[name="reference_fingerprint"]').inputValue();
  const staleKey = await actual.locator('input[name="idempotency_key"]').inputValue();
  queryLocalAuthFixture(`insert into public.food_nutrients(food_id,nutrient_id,amount,basis)
    values('${foodId}',(select id from public.nutrients where code='fiber_g'),2.4,'per_100g');`);
  const reference = await client.rpc("get_readable_food_nutrition_reference_v2", { p_food_id: foodId }).single();
  expect(reference.data!.reference_fingerprint).not.toBe(fingerprint);
  await test.info().attach("before-first-submit", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await actual.getByRole("button", { name: "Add entry", exact: true }).click();
  await expect(page.getByTestId("nutrition-reference-changed").or(actual.getByText("Entry added.", { exact: true }))).toBeVisible();
  const rows = await client.from("diary_entries").select("serving_quantity,calories,protein_g,carbohydrates_g,fat_g,additional_nutrient_snapshot").eq("entry_date", "2026-11-02");
  const receipts = await client.from("manual_diary_entry_requests").select("request_payload").eq("idempotency_key", staleKey);
  await test.info().attach("submission-observation", { body: Buffer.from(JSON.stringify({ expected: { diary: [], receipts: [] },
    observed: { diary: rows.data, receipts: receipts.data }, referenceChanged: await page.getByTestId("nutrition-reference-changed").isVisible() }, null, 2)), contentType: "application/json" });
  await test.info().attach("after-first-submit", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await expect(page.getByTestId("nutrition-reference-changed")).toBeVisible();
  expect(rows.error).toBeNull(); expect(rows.data).toEqual([]);
  expect(receipts.error).toBeNull(); expect(receipts.data).toEqual([]);
  await expect(actual).toBeVisible();
  const retry = await context.request.fetch(originalRequest.url(), { method: "POST", data: originalRequest.postDataBuffer()!,
    headers: { "content-type": originalRequest.headers()["content-type"], "next-action": originalRequest.headers()["next-action"], origin: new URL(originalRequest.url()).origin } });
  expect(retry.status()).toBeLessThan(400);
  expect(await retry.text()).toContain('"status":"success"');
  expect((await client.from("manual_diary_entry_requests").select("*")).data).toEqual(originalReceipts.data);
  expect((await client.from("diary_entries").select("*").eq("id", original.data!.id).single()).data).toEqual(original.data);
  await page.goto(`/en/today?date=2026-11-03&foodId=${foodId}`);
  await actual.locator('input[name="serving_quantity"]').fill("200");
  for (const details of await actual.locator("details").all()) if (await details.getAttribute("open") === null) await details.locator("summary").click();
  for (const [name, value] of Object.entries({ ...core, fiber_g: "4.8" })) await expect(actual.locator(`input[name="${name}"]`)).toHaveValue(value);
  await actual.getByRole("button", { name: "Add entry", exact: true }).click(); await expect(actual).toContainText("Entry added.");
  const enriched = await client.from("diary_entries").select("*").eq("entry_date", "2026-11-03").single(); expect(enriched.error).toBeNull();
  expect(enriched.data).toMatchObject({ serving_quantity: 200, calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10,
    additional_nutrient_snapshot: { version: 1, values: { fiber_g: 4.8 } } });
  for (const [name, value] of Object.entries(core)) await expect(page.locator(`[data-nutrition-metric="${name}"] .nutrition-consumed`)).toContainText(value);
  await page.reload();
  const row = page.locator(`[data-diary-entry-id="${enriched.data!.id}"]`); await row.getByRole("button", { name: "Edit", exact: true }).click();
  const review = row.locator("form");
  await expect(review.locator('input[name="serving_quantity"]')).toHaveValue("200");
  for (const [name, value] of Object.entries(core)) await expect(review.locator(`input[name="${name}"]`)).toHaveValue(value);
  await test.info().attach("200g-full-flow", { body: Buffer.from(JSON.stringify({ expected: { quantity: 200, ...core, fiber_g: "4.8" },
    stateA: original.data, stateB: enriched.data, completedRetryUnchanged: true })), contentType: "application/json" });
  await context.close();
});
