import { provisionActivatedLocalUser } from "@/e2e/helpers/local-auth";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localReliabilityFaultControlUrl =
  process.env.LOCAL_RELIABILITY_FAULT_CONTROL_URL;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "Phase11G1ReliabilityPassword123!";

test.skip(
  !localOnly ||
    !localSupabaseUrl ||
    !localSupabasePublishableKey ||
    !localReliabilityFaultControlUrl,
  "Reliability recovery tests require the local-only test runner.",
);

type Locale = "en" | "he";

function localClient() {
  const url = new URL(localSupabaseUrl as string);

  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("Refusing to use a remote Supabase API in reliability tests.");
  }

  return createClient<Database>(
    localSupabaseUrl as string,
    localSupabasePublishableKey as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function provisionUser(label: string) {
  const email = `${label}-${Date.now()}-${crypto.randomUUID()}@example.test`;
  const client = localClient();
  const result = await provisionActivatedLocalUser(client, { email, password });
  const userId = result.data.user?.id;

  expect(result.error).toBeNull();
  expect(userId).toBeTruthy();

  return { client, email, userId: userId as string };
}

async function signIn(page: Page, locale: Locale, email: string) {
  const labels =
    locale === "en"
      ? { email: "Email", password: "Password", submit: "Sign in" }
      : { email: "אימייל", password: "סיסמה", submit: "כניסה" };

  await page.goto(`/${locale}/auth/sign-in`);
  await page.getByLabel(labels.email).fill(email);
  await page.getByLabel(labels.password).fill(password);
  await page.getByRole("button", { name: labels.submit }).click();
  await expect(page).toHaveURL(/\/today(?:\?date=\d{4}-\d{2}-\d{2})?$/);
}

async function armRenderFailure() {
  const url = new URL(localReliabilityFaultControlUrl as string);

  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  const response = await fetch(url, { method: "POST" });
  expect(response.status).toBe(204);
}

async function countApplicationRows(
  client: SupabaseClient<Database>,
  userId: string,
) {
  const [profiles, targets, entries, foods, meals, recipes] = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }).eq("id", userId),
    client
      .from("nutrition_targets")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("diary_entries")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("foods")
      .select("owner_user_id", { count: "exact", head: true })
      .eq("owner_user_id", userId),
    client
      .from("saved_meals")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("recipes")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  for (const result of [profiles, targets, entries, foods, meals, recipes]) {
    expect(result.error).toBeNull();
  }

  return [profiles, targets, entries, foods, meals, recipes].map(
    ({ count }) => count ?? 0,
  );
}

test.describe.serial("Phase 11G1 localized failure recovery", () => {
  let userA: Awaited<ReturnType<typeof provisionUser>>;
  let userB: Awaited<ReturnType<typeof provisionUser>>;
  const date = "2034-08-30";
  const userAMarker = "PHASE11G1 PRIVATE USER A";
  const userBMarker = "PHASE11G1 PRIVATE USER B";

  test.beforeAll(async () => {
    userA = await provisionUser("phase11g1-recovery-a");
    userB = await provisionUser("phase11g1-recovery-b");

    expect(
      (
        await userA.client.from("diary_entries").insert({
          entry_date: date,
          food_name: userAMarker,
          meal_type: "breakfast",
          source: "manual",
          user_id: userA.userId,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await userB.client.from("diary_entries").insert({
          entry_date: date,
          food_name: userBMarker,
          meal_type: "breakfast",
          source: "manual",
          user_id: userB.userId,
        })
      ).error,
    ).toBeNull();
  });

  test("CJ-033 recovers English and Hebrew protected render failures without mutation replay or disclosure", async ({
    browser,
  }) => {
    const cases = [
      {
        body:
          "Something interrupted this page. No submission was repeated. Reload the latest state before deciding whether to submit again.",
        direction: "ltr",
        email: userA.email,
        locale: "en" as const,
        ownClient: userA.client,
        ownMarker: userAMarker,
        otherMarker: userBMarker,
        retry: "Reload latest state",
        title: "This page needs to recover",
        userId: userA.userId,
      },
      {
        body:
          "פעולת הדף הופסקה. אף שליחה לא בוצעה שוב. יש לטעון את המצב העדכני לפני שמחליטים אם לשלוח שוב.",
        direction: "rtl",
        email: userB.email,
        locale: "he" as const,
        ownClient: userB.client,
        ownMarker: userBMarker,
        otherMarker: userAMarker,
        retry: "טעינת המצב העדכני",
        title: "יש לשחזר את הדף",
        userId: userB.userId,
      },
    ];

    for (const recoveryCase of cases) {
      const before = await countApplicationRows(
        recoveryCase.ownClient,
        recoveryCase.userId,
      );
      const context = await browser.newContext();
      const page = await context.newPage();
      await signIn(page, recoveryCase.locale, recoveryCase.email);
      await armRenderFailure();
      await page.goto(
        `/${recoveryCase.locale}/local-reliability-fixture`,
      );

      const recovery = page.getByTestId("reliability-recovery");
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        recoveryCase.direction,
      );
      await expect(recovery).toHaveAttribute("role", "alert");
      await expect(
        recovery.getByRole("heading", { name: recoveryCase.title }),
      ).toBeVisible();
      await expect(recovery).toContainText(recoveryCase.body);
      await expect(recovery.locator("code")).toHaveText(/^obs_[0-9a-f]{32}$/);
      await expect(
        recovery.getByRole("button", { name: recoveryCase.retry }),
      ).toBeVisible();
      await expect(recovery).not.toContainText(
        "Synthetic local render failure for Phase 11G1",
      );
      await expect(recovery).not.toContainText(
        /supabase|stack|sql|bearer|password/i,
      );
      await expect(
        page.getByText(recoveryCase.ownMarker, { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText(recoveryCase.otherMarker, { exact: true }),
      ).toHaveCount(0);

      await recovery.getByRole("button", { name: recoveryCase.retry }).click();
      await expect(page).toHaveURL(
        new RegExp(
          `/${recoveryCase.locale}/today(?:\\?date=\\d{4}-\\d{2}-\\d{2})?$`,
        ),
      );
      await page.goto(`/${recoveryCase.locale}/today?date=${date}`);
      await expect(
        page.getByText(recoveryCase.ownMarker, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(recoveryCase.otherMarker, { exact: true }),
      ).toHaveCount(0);
      expect(
        await countApplicationRows(recoveryCase.ownClient, recoveryCase.userId),
      ).toEqual(before);
      await context.close();
    }
  });

  test("CJ-033 recovers a browser-network interruption to the liveness route", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.route("**/api/health", (route) =>
      route.abort("internetdisconnected"),
    );

    const interrupted = await page.evaluate(async () => {
      try {
        await fetch("/api/health");
        return false;
      } catch {
        return true;
      }
    });
    expect(interrupted).toBe(true);

    await page.unroute("**/api/health");
    const restored = await page.evaluate(async () => {
      const response = await fetch("/api/health");
      return { body: await response.json(), status: response.status };
    });
    expect(restored).toEqual({ body: { status: "live" }, status: 200 });
  });
});
