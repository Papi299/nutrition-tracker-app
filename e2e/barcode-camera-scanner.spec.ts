import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "BarcodeCameraScannerPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Camera scanner UI tests require the local-only runner.",
);

type Detection = { format: string; rawValue: string };
type ScannerMockOptions = {
  cameraErrors?: Array<string | null>;
  detectDelayMs?: number;
  detectErrorName?: string;
  detections?: Detection[][];
  getSupportedFormatsRejects?: boolean;
  missingDetector?: boolean;
  missingMediaDevices?: boolean;
  secure?: boolean;
  supportedFormats?: string[];
};

function rawGtin(length: 8 | 12 | 13 | 14, seed: number) {
  const seedLength = length - 2;
  const payload = `4${String(seed).padStart(seedLength, "0").slice(-seedLength)}`;
  let sum = 0;
  let weight = 3;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += (payload.charCodeAt(index) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return `${payload}${(10 - (sum % 10)) % 10}`;
}

async function installScannerMock(
  context: BrowserContext,
  options: ScannerMockOptions = {},
) {
  await context.addInitScript((configuration: ScannerMockOptions) => {
    const state = {
      constructorFormats: [] as string[][],
      constraints: [] as MediaStreamConstraints[],
      detectCalls: 0,
      frameTime: 0,
      permissionRequests: 0,
      trackStops: 0,
    };
    const endedListeners: Array<() => void> = [];
    let hidden = false;
    let frameId = 0;
    const frameTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const mediaSources = new WeakMap<HTMLMediaElement, MediaProvider | null>();

    Object.defineProperty(window, "__scannerMock", {
      configurable: true,
      value: {
        fireTrackEnded: () => endedListeners.forEach((listener) => listener()),
        setHidden: (value: boolean) => {
          hidden = value;
          document.dispatchEvent(new Event("visibilitychange"));
        },
        state,
      },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: configuration.secure ?? true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_ENOUGH_DATA,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: () => Promise.resolve(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return mediaSources.get(this as HTMLMediaElement) ?? null;
      },
      set(value: MediaProvider | null) {
        mediaSources.set(this as HTMLMediaElement, value);
      },
    });
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      {
        configurable: true,
        value(callback: (now: number) => void) {
          const id = ++frameId;
          const timer = setTimeout(() => {
            state.frameTime += 300;
            callback(state.frameTime);
          }, 0);
          frameTimers.set(id, timer);
          return id;
        },
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback",
      {
        configurable: true,
        value(id: number) {
          const timer = frameTimers.get(id);
          if (timer) clearTimeout(timer);
          frameTimers.delete(id);
        },
      },
    );

    if (configuration.missingMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      });
    } else {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            const requestIndex = state.permissionRequests;
            state.permissionRequests += 1;
            state.constraints.push(constraints);
            const errorName = configuration.cameraErrors?.[requestIndex];
            if (errorName) throw new DOMException("private camera detail", errorName);

            const tracks = Array.from({ length: 2 }, () => ({
              addEventListener: (name: string, listener: () => void) => {
                if (name === "ended") endedListeners.push(listener);
              },
              stop: () => {
                state.trackStops += 1;
              },
            }));
            return { getTracks: () => tracks } as unknown as MediaStream;
          },
        },
      });
    }

    if (!configuration.missingDetector) {
      class MockBarcodeDetector {
        static async getSupportedFormats() {
          if (configuration.getSupportedFormatsRejects) {
            throw new Error("format detection failed");
          }
          return configuration.supportedFormats ?? [
            "ean_8",
            "ean_13",
            "upc_a",
            "itf",
            "upc_e",
            "qr_code",
          ];
        }

        constructor(detectorOptions: { formats: string[] }) {
          state.constructorFormats.push([...detectorOptions.formats]);
        }

        async detect() {
          const index = state.detectCalls;
          state.detectCalls += 1;
          if (configuration.detectDelayMs) {
            await new Promise((resolve) =>
              setTimeout(resolve, configuration.detectDelayMs),
            );
          }
          if (configuration.detectErrorName) {
            throw new DOMException(
              "private detector detail",
              configuration.detectErrorName,
            );
          }
          return configuration.detections?.[index] ?? [];
        }
      }

      Object.defineProperty(window, "BarcodeDetector", {
        configurable: true,
        value: MockBarcodeDetector,
      });
    } else {
      delete (window as typeof window & { BarcodeDetector?: unknown })
        .BarcodeDetector;
    }
  }, options);
}

async function mockState(page: Page) {
  return page.evaluate(() =>
    (
      window as typeof window & {
        __scannerMock: {
          state: {
            constructorFormats: string[][];
            constraints: MediaStreamConstraints[];
            detectCalls: number;
            permissionRequests: number;
            trackStops: number;
          };
        };
      }
    ).__scannerMock.state,
  );
}

async function fireMock(
  page: Page,
  action: "fireTrackEnded" | "hide" | "show",
) {
  await page.evaluate((requestedAction) => {
    const mock = (
      window as typeof window & {
        __scannerMock: {
          fireTrackEnded(): void;
          setHidden(value: boolean): void;
        };
      }
    ).__scannerMock;
    if (requestedAction === "fireTrackEnded") mock.fireTrackEnded();
    if (requestedAction === "hide") mock.setHidden(true);
    if (requestedAction === "show") mock.setHidden(false);
  }, action);
}

test.describe.serial("native camera barcode scanning progressive enhancement", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const seed = Date.now() % 1_000_000;
  const codes = {
    ean8: rawGtin(8, seed + 1),
    ean13: rawGtin(13, seed + 2),
    itf: rawGtin(14, seed + 3),
    secondEan13: rawGtin(13, seed + 4),
    upca: rawGtin(12, seed + 5),
  };
  const canonical = Object.fromEntries(
    Object.entries(codes).map(([key, value]) => [key, value.padStart(14, "0")]),
  ) as Record<keyof typeof codes, string>;
  let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userClient: SupabaseClient<Database>;
  let userId: string;
  let ownedFoodId: string;
  const publicFoodId = randomUUID();

  function database(statement: string) {
    return execFileSync(
      "docker",
      [
        "exec",
        databaseContainer,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-c",
        statement,
      ],
      { encoding: "utf8" },
    ).trim();
  }

  async function authenticatedContext(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({ ...options, storageState });
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const email = `phase9d-${runId}@example.test`;
    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    storageState = await context.storageState();
    await context.close();

    userClient = createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    userId = signedIn.data.user?.id as string;
    const owned = await userClient
      .from("foods")
      .insert({
        custom_nutrient_basis: "per_serving",
        data_quality: "user_provided",
        food_type: "user_custom",
        is_public: false,
        locale: "en",
        name: `Phase 9D owned ${runId}`,
        owner_user_id: userId,
        serving_size: 1,
        serving_unit: "serving",
      })
      .select("id")
      .single();
    expect(owned.error).toBeNull();
    ownedFoodId = owned.data?.id as string;

    database(`
      insert into public.foods (
        id, food_type, name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'branded', 'Phase 9D public ${runId}', 'en', 1,
        'serving', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
      insert into public.food_barcodes (
        food_id, canonical_gtin, provenance_source_id, verification_status
      ) values
        ('${ownedFoodId}', '${canonical.ean8}',
          (select id from public.food_sources where code = 'user_custom'),
          'user_asserted'),
        ('${publicFoodId}', '${canonical.upca}',
          (select id from public.food_sources where code = 'manual'),
          'curated_verified');
    `);
  });

  test("keeps manual and no-JavaScript lookup complete when capability is unavailable", async ({ browser }) => {
    for (const scannerOptions of [
      { missingDetector: true },
      { secure: false },
      { missingMediaDevices: true },
      { supportedFormats: ["qr_code", "upc_e"] },
      { getSupportedFormatsRejects: true },
    ]) {
      const context = await authenticatedContext(browser);
      await installScannerMock(context, scannerOptions);
      const page = await context.newPage();
      await page.goto("/en/foods/barcode?date=2026-07-18");
      await expect(page.locator('input[name="code"]')).toBeVisible();
      await expect(page.getByTestId("barcode-camera-scanner")).toContainText(
        "unavailable",
      );
      expect((await mockState(page)).permissionRequests).toBe(0);
      await context.close();
    }

    const noJs = await authenticatedContext(browser, { javaScriptEnabled: false });
    const page = await noJs.newPage();
    await page.goto("/en/foods/barcode?date=2026-07-18");
    await expect(page.getByTestId("barcode-camera-scanner")).toHaveCount(0);
    await page.locator('input[name="code"]').fill(codes.ean13);
    await page.getByRole("button", { name: "Look up barcode" }).click();
    await expect(page).toHaveURL(
      `/en/foods/barcode?code=${canonical.ean13}&date=2026-07-18`,
    );
    await expect(page.getByTestId("barcode-not-found")).toBeVisible();
    await noJs.close();
  });

  test("requests permission only on action, classifies failures, and bounds constraint fallback", async ({ browser }) => {
    const denied = await authenticatedContext(browser);
    await installScannerMock(denied, {
      cameraErrors: ["NotAllowedError", "NotAllowedError"],
    });
    const deniedPage = await denied.newPage();
    await deniedPage.goto("/en/foods/barcode?date=2026-07-18");
    await expect(deniedPage.getByRole("button", { name: "Scan barcode" })).toBeVisible();
    expect((await mockState(deniedPage)).permissionRequests).toBe(0);
    await deniedPage.getByRole("button", { name: "Scan barcode" }).press("Enter");
    await expect(deniedPage.locator('[data-scanner-state="permission_denied"]')).toHaveAttribute("role", "alert");
    await expect(deniedPage.getByTestId("barcode-camera-scanner")).not.toContainText("private camera detail");
    expect((await mockState(deniedPage)).permissionRequests).toBe(1);
    await deniedPage.getByRole("button", { name: "Scan again" }).click();
    expect((await mockState(deniedPage)).permissionRequests).toBe(2);
    await denied.close();

    for (const [errorName, expectedState] of [
      ["NotFoundError", "camera_unavailable"],
      ["NotReadableError", "camera_busy"],
      ["SecurityError", "security_error"],
      ["AbortError", "camera_aborted"],
      ["UnknownError", "camera_error"],
    ] as const) {
      const context = await authenticatedContext(browser);
      await installScannerMock(context, { cameraErrors: [errorName] });
      const page = await context.newPage();
      await page.goto("/en/foods/barcode?date=2026-07-18");
      await page.getByRole("button", { name: "Scan barcode" }).click();
      await expect(page.locator(`[data-scanner-state="${expectedState}"]`)).toBeVisible();
      expect((await mockState(page)).permissionRequests).toBe(1);
      await context.close();
    }

    const fallback = await authenticatedContext(browser);
    await installScannerMock(fallback, {
      cameraErrors: ["OverconstrainedError", null],
      detections: [[]],
    });
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto("/en/foods/barcode?date=2026-07-18");
    await fallbackPage.getByRole("button", { name: "Scan barcode" }).click();
    await expect(fallbackPage.locator('[data-scanner-state="camera_active"]')).toBeVisible();
    const fallbackState = await mockState(fallbackPage);
    expect(fallbackState.permissionRequests).toBe(2);
    expect(fallbackState.constraints).toEqual([
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      },
      { audio: false, video: true },
    ]);
    await fallbackPage.getByRole("button", { name: "Cancel camera" }).click();
    expect((await mockState(fallbackPage)).trackStops).toBe(2);
    expect(await fallbackPage.getByTestId("barcode-camera-preview").evaluate((video) => (video as HTMLVideoElement).srcObject)).toBeNull();
    await fallback.close();

    const finalConstraint = await authenticatedContext(browser);
    await installScannerMock(finalConstraint, {
      cameraErrors: ["OverconstrainedError", "OverconstrainedError"],
    });
    const finalPage = await finalConstraint.newPage();
    await finalPage.goto("/en/foods/barcode?date=2026-07-18");
    await finalPage.getByRole("button", { name: "Scan barcode" }).click();
    await expect(finalPage.locator('[data-scanner-state="constraint_failure"]')).toBeVisible();
    expect((await mockState(finalPage)).permissionRequests).toBe(2);
    await finalConstraint.close();
  });

  test("canonicalizes every approved format using current edited date and meal without mutation", async ({ browser }) => {
    const before = database(`
      select
        (select count(*) from public.foods),
        (select count(*) from public.food_barcodes),
        (select count(*) from public.diary_entries),
        (select count(*) from public.food_favorites);
    `);
    const cases = [
      ["ean_8", codes.ean8, canonical.ean8],
      ["upc_a", codes.upca, canonical.upca],
      ["ean_13", codes.ean13, canonical.ean13],
      ["itf", codes.itf, canonical.itf],
    ] as const;

    for (const [format, rawValue, canonicalGtin] of cases) {
      const context = await authenticatedContext(browser);
      await installScannerMock(context, {
        detections: [[{ format, rawValue }]],
      });
      const page = await context.newPage();
      const externalRequests: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
          externalRequests.push(request.url());
        }
      });
      await page.goto("/en/foods/barcode?date=2026-07-18&mealType=lunch");
      await page.locator('input[name="date"]').fill("2025-02-03");
      await page.locator('select[name="mealType"]').selectOption("other");
      await page.getByRole("button", { name: "Scan barcode" }).click();
      await expect(page).toHaveURL(
        `/en/foods/barcode?code=${canonicalGtin}&date=2025-02-03&mealType=other`,
      );
      const state = await mockState(page);
      expect(state.trackStops).toBe(2);
      expect(state.constructorFormats).toEqual([
        ["ean_8", "ean_13", "upc_a", "itf"],
      ]);
      expect(externalRequests).toEqual([]);
      await context.close();
    }

    expect(database(`
      select
        (select count(*) from public.foods),
        (select count(*) from public.food_barcodes),
        (select count(*) from public.diary_entries),
        (select count(*) from public.food_favorites);
    `)).toBe(before);
  });

  test("feeds scanned codes through normal owned, public, miss, and custom-handoff states", async ({ browser }) => {
    for (const [format, rawValue, expectedTestId] of [
      ["ean_8", codes.ean8, "barcode-found_owned"],
      ["upc_a", codes.upca, "barcode-found_public"],
      ["ean_13", codes.ean13, "barcode-not-found"],
    ] as const) {
      const context = await authenticatedContext(browser);
      await installScannerMock(context, {
        detections: [[{ format, rawValue }]],
      });
      const page = await context.newPage();
      await page.goto("/en/foods/barcode?date=2026-07-18&mealType=snack");
      await page.getByRole("button", { name: "Scan barcode" }).click();
      await expect(page.getByTestId(expectedTestId)).toBeVisible();
      if (expectedTestId === "barcode-not-found") {
        await expect(
          page.getByRole("link", {
            name: "Create private food with this barcode",
          }),
        ).toHaveAttribute(
          "href",
          `/en/foods/custom/new?barcode=${canonical.ean13}&date=2026-07-18&mealType=snack`,
        );
      }
      await context.close();
    }
  });

  test("rejects UPC-E, ISBN, invalid, and multiple detections without changing manual input", async ({ browser }) => {
    const cases = [
      {
        detections: [[{ format: "upc_e", rawValue: codes.ean8 }]],
        state: "unsupported_detection",
      },
      {
        detections: [[{ format: "ean_13", rawValue: "9780306406157" }]],
        state: "invalid_detection",
      },
      {
        detections: [[{ format: "ean_8", rawValue: "96385075" }]],
        state: "invalid_detection",
      },
      {
        detections: [[
          { format: "ean_13", rawValue: codes.ean13 },
          { format: "ean_13", rawValue: codes.secondEan13 },
        ]],
        state: "multiple_detections",
      },
    ];

    for (const scannerOptions of cases) {
      const context = await authenticatedContext(browser);
      await installScannerMock(context, scannerOptions);
      const page = await context.newPage();
      await page.goto("/en/foods/barcode?date=2026-07-18");
      await page.locator('input[name="code"]').fill("manual-value");
      await page.getByRole("button", { name: "Scan barcode" }).click();
      await expect(page.locator(`[data-scanner-state="${scannerOptions.state}"]`)).toHaveAttribute("role", "alert");
      await expect(page).toHaveURL("/en/foods/barcode?date=2026-07-18");
      await expect(page.locator('input[name="code"]')).toHaveValue("manual-value");
      expect((await mockState(page)).trackStops).toBe(2);
      await context.close();
    }

    const repeated = await authenticatedContext(browser);
    await installScannerMock(repeated, {
      detections: [[
        { format: "ean_13", rawValue: codes.ean13 },
        { format: "ean_13", rawValue: codes.ean13 },
      ]],
    });
    const repeatedPage = await repeated.newPage();
    await repeatedPage.goto("/en/foods/barcode?date=2026-07-18");
    await repeatedPage.getByRole("button", { name: "Scan barcode" }).click();
    await expect(repeatedPage).toHaveURL(
      `/en/foods/barcode?code=${canonical.ean13}&date=2026-07-18`,
    );
    expect((await mockState(repeatedPage)).detectCalls).toBe(1);
    await repeated.close();
  });

  test("stops every track on cancellation, lifecycle exits, detector failure, and replacement", async ({ browser }) => {
    for (const action of ["cancel", "hidden", "pagehide", "ended"] as const) {
      const context = await authenticatedContext(browser);
      await installScannerMock(context, { detections: [[]] });
      const page = await context.newPage();
      await page.goto("/en/foods/barcode?date=2026-07-18");
      await page.getByRole("button", { name: "Scan barcode" }).click();
      await expect(page.locator('[data-scanner-state="camera_active"]')).toBeVisible();
      if (action === "cancel") {
        await page.getByRole("button", { name: "Cancel camera" }).click();
      } else if (action === "hidden") {
        await fireMock(page, "hide");
        await fireMock(page, "show");
        await expect(page.locator('[data-scanner-state="cancelled"]')).toBeVisible();
      } else if (action === "pagehide") {
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
      } else {
        await fireMock(page, "fireTrackEnded");
        await expect(page.locator('[data-scanner-state="camera_unavailable"]')).toBeVisible();
      }
      expect((await mockState(page)).trackStops).toBe(2);
      expect(await page.getByTestId("barcode-camera-preview").evaluate((video) => (video as HTMLVideoElement).srcObject)).toBeNull();
      await context.close();
    }

    const detectorFailure = await authenticatedContext(browser);
    await installScannerMock(detectorFailure, {
      detectErrorName: "OperationError",
    });
    const failurePage = await detectorFailure.newPage();
    await failurePage.goto("/en/foods/barcode?date=2026-07-18");
    await failurePage.getByRole("button", { name: "Scan barcode" }).click();
    await expect(failurePage.locator('[data-scanner-state="detection_error"]')).toBeVisible();
    expect((await mockState(failurePage)).trackStops).toBe(2);
    await detectorFailure.close();

    const stale = await authenticatedContext(browser);
    await installScannerMock(stale, {
      detectDelayMs: 200,
      detections: [[{ format: "ean_13", rawValue: codes.ean13 }]],
    });
    const stalePage = await stale.newPage();
    await stalePage.goto("/en/foods/barcode?date=2026-07-18");
    await stalePage.getByRole("button", { name: "Scan barcode" }).click();
    await expect(stalePage.locator('[data-scanner-state="camera_active"]')).toBeVisible();
    await stalePage.getByRole("button", { name: "Cancel camera" }).click();
    await stalePage.waitForTimeout(300);
    await expect(stalePage).toHaveURL("/en/foods/barcode?date=2026-07-18");
    expect((await mockState(stalePage)).trackStops).toBe(2);
    await stale.close();

    const replacement = await authenticatedContext(browser);
    await installScannerMock(replacement, { detections: [[]] });
    const replacementPage = await replacement.newPage();
    await replacementPage.goto("/en/foods/barcode?date=2026-07-18");
    const start = replacementPage.getByRole("button", { name: "Scan barcode" });
    await start.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(replacementPage.locator('[data-scanner-state="camera_active"]')).toBeVisible();
    expect((await mockState(replacementPage)).permissionRequests).toBe(2);
    await replacementPage.getByRole("button", { name: "Cancel camera" }).click();
    expect((await mockState(replacementPage)).trackStops).toBe(4);
    await replacement.close();
  });

  test("preserves localized, mobile, keyboard, live-region, and nonmirrored behavior", async ({ browser }) => {
    for (const [locale, scanLabel, cancelLabel] of [
      ["en", "Scan barcode", "Cancel camera"],
      ["he", "סריקת ברקוד", "ביטול המצלמה"],
    ] as const) {
      const context = await authenticatedContext(browser, {
        viewport: { height: 740, width: 390 },
      });
      await installScannerMock(context, { detections: [[]] });
      const page = await context.newPage();
      await page.goto(`/${locale}/foods/barcode?date=2026-07-18`);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        locale === "he" ? "rtl" : "ltr",
      );
      const status = page.locator('[data-scanner-state="ready"]');
      await expect(status).toHaveAttribute("aria-live", "polite");
      await page.getByRole("button", { name: scanLabel }).press("Enter");
      await expect(page.locator('[data-scanner-state="camera_active"]')).toBeVisible();
      const preview = page.getByTestId("barcode-camera-preview");
      await expect(preview).toBeVisible();
      expect(await preview.evaluate((video) => getComputedStyle(video).transform)).toBe("none");
      await page.getByRole("button", { name: cancelLabel }).press("Enter");
      await expect(page.locator('[data-scanner-state="cancelled"]')).toBeVisible();
      await expect(page.locator('input[name="code"]')).toBeVisible();
      await context.close();
    }
  });
});
