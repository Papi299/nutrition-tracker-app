import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
} from "@/lib/i18n/format";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "Phase11dAccessibilityPassword123!";
const barcodeTechnicalTokens = [
  "GTIN-8",
  "UPC-A",
  "GTIN-12",
  "GTIN-13",
  "GTIN-14",
  "UPC-E",
] as const;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Phase 11D UI tests require the local-only test runner.",
);

const viewportCases = [
  { height: 720, locale: "he", path: "/he/foods/barcode?date=2026-08-21", width: 320 },
  { height: 844, locale: "en", path: "/en/today?date=2026-08-21", width: 390 },
  { height: 390, locale: "he", path: "/he/saved-meals/new", width: 768 },
  { height: 900, locale: "en", path: "/en/recipes/new", width: 1280 },
] as const;

const aliasControlViewportCases = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, supportingReflow: "200%", width: 640 },
  { height: 900, width: 768 },
  { height: 900, width: 1280 },
] as const;

const he01CopyCases = [
  {
    expectedText: ["What's available now"],
    locale: "en",
    path: "/en",
  },
  {
    expectedText: [
      "הגרסה הנוכחית",
      "מעקב תזונתי ידני בעברית ובאנגלית.",
      "מה זמין עכשיו",
      "להגדיר יעדים תזונתיים באופן ידני",
      "רשומות ביומן התזונה",
      "ניהול ידני של יומן התזונה",
      "הגדרה ידנית של יעדים תזונתיים לפי תאריך תחילה",
      "יצירה ועריכה של מזונות מותאמים אישית",
      "שקיפות לגבי מקור הנתונים והערכים השמורים",
      "היקף המערכת כיום",
      "כבר זמינים במערכת: חשבונות ופרופילים, הגדרה ידנית של יעדים תזונתיים, ניהול יומן התזונה, חיפוש מזונות ושימוש חוזר בהם, מזונות מותאמים אישית, ארוחות שמורות ומתכונים — כולל יצירה, עריכה, ניהול, חישוב ערכים תזונתיים ושימוש ביומן.",
      "יכולות ניתוח מתקדמות",
      "פריסה לסביבת הייצור",
      "דוגמה לשילוב שפות:",
    ],
    forbiddenText: [
      "MVP",
      "מעקב תזונה ידני",
      "יעדים תזונתיים שהוגדרו ידנית",
      "יעדים תזונתיים שנקבעו ידנית",
      "רשומות ביומן היומי",
      "מעקב ידני ביומן",
      "מעקב יומן ידני",
      "יעדים תזונתיים שנקבעו ידנית עם מועד כניסה לתוקף",
      "יעדים שהוגדרו ידנית לפי תאריך תחולה",
      "יעדים שהוגדרו ידנית ונכנסים לתוקף לפי תאריך",
      "שקיפות לגבי מקור הנתונים והערכים שנשמרו",
      "כבר זמינים: חשבונות, פרופילים",
      "היקף נוכחי",
      "דוגמה לטקסט מעורב:",
      "זמין עכשיו ומה עדיין לא זמין",
    ],
    locale: "he",
    path: "/he",
  },
  {
    expectedText: ["Back to home"],
    locale: "en",
    path: "/en/auth/sign-in",
  },
  {
    expectedText: [
      "חזרה לדף הבית",
      "להגדיר יעדים תזונתיים באופן ידני",
      "רשומות ביומן",
      "לאחר הכניסה באמצעות אימייל וסיסמה אפשר להגדיר יעדים תזונתיים באופן ידני ולנהל רשומות ביומן.",
      "עדיין אין חשבון?",
      "הרשמה",
      "הכניסה לחשבון מתבצעת באמצעות שירות האימות של Supabase. לאחר הכניסה אפשר לגשת לפרופיל, להגדיר יעדים תזונתיים באופן ידני ולנהל את יומן התזונה.",
    ],
    forbiddenText: [
      "אין לך חשבון?",
      "אין עדיין חשבון?",
      "צור חשבון",
      "יעדים תזונתיים שהוגדרו ידנית",
      "יש להיכנס באמצעות אימייל וסיסמה כדי לנהל יעדים תזונתיים שנקבעו ידנית ורשומות ביומן.",
      "הטופס משתמש בשירות האימות של Supabase.",
      "לאחר הכניסה ניתן לגשת לפרופיל, ליעדים התזונתיים שנקבעו ידנית ולמעקב ביומן.",
    ],
    locale: "he",
    path: "/he/auth/sign-in",
  },
] as const;

const he02ViewportCases = [
  { height: 844, width: 390 },
  { height: 900, width: 768 },
] as const;

const he03ViewportCases = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 768 },
  { height: 900, width: 1280 },
] as const;

const rejectedSnapshotLiteral = /תצלומ|תצלום|תמונת מצב/;
const rejectedReviewedDirectForm = /בחרו|הוסיפו|בשבילכם|0 מותר/;
const rejectedHe03Terminology = /שם פרטי|מטא־נתונים|מזון קריא|נוספו \d+ כינויים|יחושבו/;

const he03CopyCases = [
  {
    expectedText: [
      "כאן ניתן להגדיר את פרטי המזון, לבחור בסיס ייחוס לערכים התזונתיים ולהוסיף ערכים וכינויי חיפוש לפי הצורך.",
      "פרטי המזון",
      "בסיס ייחוס לערכים תזונתיים",
      "יש לבחור את כמות הייחוס שאליה יתייחסו הערכים התזונתיים שיוזנו בהמשך.",
      "שינוי בסיס הייחוס אינו ממיר את הערכים הקיימים. המערכת תתייחס לערכים שהוזנו בהתאם לבסיס הייחוס החדש שנבחר.",
      "כל הערכים התזונתיים אופציונליים ומתייחסים לבסיס הייחוס שנבחר. שדה ריק משמעו שלא יישמר ערך; ניתן להזין 0.",
      'קלוריות (קק"ל)',
      "חלבון (גרם)",
      "כינויי חיפוש",
      "ניתן להוסיף עד 20 כינויי חיפוש בדיוק כפי שיוזנו. המערכת אינה מתרגמת או מתעתקת אותם אוטומטית.",
      "כינויי חיפוש שנוספו: 0 מתוך 20.",
      "מעורב או ללא שיוך לשפה",
      "לאחר השלמת הטופס, יש לבדוק את הפרטים ולשמור.",
    ],
    path: "/he/foods/custom/new",
  },
  {
    expectedText: [
      "הגדרת פרטי המתכון והוספת המרכיבים לפי הסדר, עם אפשרות לערוך כל מרכיב בנפרד.",
      "פרטי המתכון",
      "מספר המנות מציין כמה מנות מתקבלות מהמתכון כולו. הסיכום התזונתי שמופיע בהמשך מחושב אוטומטית על ידי המערכת על סמך הערכים השמורים של מרכיבי המתכון.",
      "מרכיבי המתכון",
      "המתכון יכול לכלול בין 1 ל־50 מרכיבים, לפי סדר הופעתם.",
      "מרכיב ידני",
      "הזזה למעלה",
      "הזזה למטה",
      "שם המרכיב הוא שדה חובה וניתן לעריכה.",
      "בחירת מזון מהמאגר",
      "חיפוש מזון",
      "הכמות אופציונלית וחייבת להיות חיובית. יש למלא את הכמות ואת היחידה יחד, או להשאיר את שתיהן ריקות.",
      "הערכים התזונתיים מתייחסים לכמות שהוזנה עבור המרכיב. שינוי הכמות אינו מעדכן אותם אוטומטית.",
      "הערות אופציונליות עבור המרכיב.",
      'קלוריות (קק"ל)',
      "הוספת מרכיב ריק",
      "לאחר השלמת המתכון, יש לבדוק את הפרטים ולשמור.",
    ],
    path: "/he/recipes/new",
  },
  {
    expectedText: [
      "הגדרת ארוחה לשימוש חוזר באמצעות מתן שם והוספת פריטים לפי הסדר. פרטי כל פריט נשמרים כחלק מהארוחה.",
      "פרטי הארוחה",
      "פריטי הארוחה",
      "הפריטים נשמרים בסדר זה. הערכים בכל פריט נשמרים כפי שהם בעת השמירה ואינם מתעדכנים אוטומטית מקטלוג המזון.",
      "ללא קישור למזון",
      "הזזה למעלה",
      "הזזה למטה",
      "שם המזון הוא שדה חובה.",
      "מותג",
      'קלוריות (קק"ל)',
      "הכמות אופציונלית. שדה ריק משמעו שלא הוגדר ערך; ניתן להזין 0.",
      "הערות אופציונליות עבור הפריט.",
      "הוספת פריט ריק",
      "לאחר השלמת הארוחה, יש לבדוק את הפרטים ולשמור.",
    ],
    path: "/he/saved-meals/new",
  },
] as const;

async function authenticatedContext(
  browser: Browser,
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>,
  options: Parameters<Browser["newContext"]>[0] = {},
) {
  return browser.newContext({ ...options, storageState });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    overflowingElements: Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          className: element.getAttribute("class"),
          left: bounds.left,
          right: bounds.right,
          tagName: element.tagName,
          testId: element.getAttribute("data-testid"),
        };
      })
      .filter(
        ({ left, right }) =>
          left < -1 || right > document.documentElement.clientWidth + 1,
      )
      .slice(0, 12),
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    dimensions.scrollWidth,
    `document width ${dimensions.scrollWidth}px exceeded viewport ${dimensions.clientWidth}px; overflowing elements: ${JSON.stringify(dimensions.overflowingElements)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function scanAxe(
  page: Page,
  testInfo: TestInfo,
  stateName: string,
) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const severityCounts = result.violations.reduce<Record<string, number>>(
    (counts, violation) => {
      const impact = violation.impact ?? "unknown";
      counts[impact] = (counts[impact] ?? 0) + 1;
      return counts;
    },
    { critical: 0, minor: 0, moderate: 0, serious: 0, unknown: 0 },
  );
  const blocking = result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  await testInfo.attach(`axe-${stateName}`, {
    body: Buffer.from(
      JSON.stringify(
        {
          blocking: blocking.map(({ help, id, impact, nodes }) => ({
            help,
            id,
            impact,
            targets: nodes.map((node) => node.target),
          })),
          route: page.url(),
          severityCounts,
          stateName,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });

  expect(blocking, `${stateName} serious/critical axe findings`).toEqual([]);
  return severityCounts;
}

test.describe("Phase 11D risk-selected UI acceptance", () => {
  let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const projectToken = testInfo.project.name.replace(/[^a-z0-9]/gi, "-");
    const email = `phase11d-${projectToken}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);

    await page.goto("/en/setup?effectiveDate=2026-08-21");
    await page.getByLabel("Display name").fill("Phase 11D synthetic user");
    await page.getByLabel("Calories").fill("1234");
    await page.getByLabel("Protein (g)").fill("56.5");
    await page.getByLabel("Carbohydrates (g)").fill("200");
    await page.getByLabel("Fat (g)").fill("60");
    await page.getByRole("button", { name: "Save setup" }).click();
    await expect(page).toHaveURL("/en/today?date=2026-08-21");

    storageState = await context.storageState();
    await context.close();
  });

  test("renders corrected HE-01 copy with narrow-width locale and overflow semantics", async ({ browser }) => {
    for (const viewport of [
      { height: 720, width: 320 },
      { height: 844, width: 390 },
    ] as const) {
      for (const copyCase of he01CopyCases) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.goto(copyCase.path);

        await expect(page.locator("html")).toHaveAttribute(
          "lang",
          copyCase.locale,
        );
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          copyCase.locale === "he" ? "rtl" : "ltr",
        );
        for (const expectedText of copyCase.expectedText) {
          await expect(page.locator("body")).toContainText(expectedText);
        }
        if ("forbiddenText" in copyCase) {
          for (const forbiddenText of copyCase.forbiddenText) {
            await expect(page.locator("body")).not.toContainText(forbiddenText);
          }
        }
        await expectNoHorizontalOverflow(page);
        await context.close();
      }
    }
  });

  test("renders corrected HE-02 Today and Barcode terminology with preserved context", async ({ browser }) => {
    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();

    for (const viewport of he02ViewportCases) {
      await page.setViewportSize(viewport);
      await page.goto("/he/today?date=2026-08-21");
      await expect(page.locator("html")).toHaveAttribute("lang", "he");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      for (const expectedText of [
        "מעקב יומי",
        "מעקב תזונתי ליום הנבחר",
        "כאן ניתן לצפות ביעד התזונתי התקף לתאריך שנבחר, להוסיף, לערוך או למחוק רשומות ביומן, ולראות את הסיכום היומי ואת ההתקדמות ביחס ליעד.",
        "נתוני המעקב בחשבון",
        "הגדרות הפרופיל, היעדים התזונתיים ומועדי תחילתם, הרשומות ביומן, הסיכומים וההתקדמות נשמרים בחשבון.",
        "יעדים תזונתיים יומיים",
        "הרשומות ביומן לתאריך שנבחר. אפשר להזין רשומה באופן ידני או לבחור מזון מהמאגר כדי למלא את פרטיה.",
        "סך הערכים התזונתיים שנצרכו לפי הרשומות ביומן לתאריך זה.",
        `השוואה בין הערכים שנצרכו ביום זה לבין היעד התקף ב־${formatLocalizedDate("he", "2026-08-21", { dateStyle: "long" })}.`,
        "ניתן להזין מזון באופן ידני או לבחור מזון מהמאגר כדי למלא מראש את פרטי הרשומה ביומן.",
        "התאריך שנבחר ישמש לרשומה זו.",
        "יש לבחור את סוג הארוחה שאליה שייכת הרשומה.",
        "ניתן להוסיף מותג רק אם הוא מסייע בזיהוי הפריט.",
        "מידע נוסף לשימוש אישי.",
        'קלוריות (קק"ל)',
        "אפשר להשאיר את השדה ריק אם אין צורך לציין כמות; ניתן להזין 0.",
        "ניתן להוסיף רשומה ידנית לאחר מילוי שדות החובה.",
        "0% מהיעד הושלם",
      ]) {
        await expect(page.locator("body")).toContainText(expectedText);
      }
      await expect(page.getByTestId("target-summary")).toContainText(
        formatLocalizedNumber("he", 1234, { maximumFractionDigits: 2 }),
      );
      await expect(page.locator('input[name="date"]')).toHaveValue("2026-08-21");
      await expect(page.locator('input[name="entry_date"]')).toHaveValue("2026-08-21");
      await expect(page.locator("body")).not.toContainText(rejectedSnapshotLiteral);
      await expect(page.locator("body")).not.toContainText(
        rejectedReviewedDirectForm,
      );
      await expect(page.locator("body")).not.toContainText(
        /מרחב היום|מעקב תזונתי ליום נבחר\.|צפייה ביעד התקף לתאריך הנבחר|מעקב ידני|יעדים תזונתיים יומיים שנקבעו ידנית|רשומות היומן לתאריך שנבחר|סך הערכים שנצרכו לפי הרשומות|השוואה בין הסיכום היומי הידני|ניתן להשאיר ריק אם אין צורך לציין כמות|מזון זמין שנבחר/,
      );
      await expectNoHorizontalOverflow(page);

      await page.goto("/he/foods/barcode?date=2026-08-21&mealType=lunch");
      await expect(page.locator("html")).toHaveAttribute("lang", "he");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("body")).toContainText(
        "הזנת ברקוד נתמך מאפשרת לאתר מזון במאגר המקומי ולעיין בפרטיו. לאחר מכן ניתן להשתמש בפרטים כדי למלא רשומה ביומן. החיפוש עצמו אינו יוצר או משנה נתונים.",
      );
      await expect(page.locator("body")).toContainText(
        "חיפוש לפי ברקוד במאגר המקומי",
      );
      await expect(page.locator("body")).toContainText(
        "יש להזין ברקוד תקני מסוג GTIN-8",
      );
      await expect(page.locator("body")).toContainText(
        "סריקה במצלמת המכשיר",
      );
      await expect(page.locator("body")).toContainText(
        "בעת המעבר למסך „היום”, התאריך הזה יישאר נבחר. חיפוש לפי ברקוד אינו יוצר רשומה ביומן.",
      );
      await expect(page.locator("body")).toContainText(
        "כאשר המכשיר תומך בסריקה מובנית, תמונות מהמצלמה נשארות בדפדפן ואינן מועלות או נשמרות.",
      );
      const barcodeDate = page.locator('input[name="date"]');
      const barcodeMeal = page.locator('select[name="mealType"]');
      await expect(barcodeDate).toHaveValue("2026-08-21");
      await expect(barcodeMeal).toHaveValue("lunch");
      expect(
        await barcodeDate.evaluate(
          (input) =>
            (input as HTMLInputElement).labels?.[0]?.childNodes[0]?.textContent?.trim(),
        ),
      ).toBe("תאריך");
      expect(
        await barcodeMeal.evaluate(
          (select) =>
            (select as HTMLSelectElement).labels?.[0]?.childNodes[0]?.textContent?.trim(),
        ),
      ).toBe("סוג הארוחה");
      await expect(page.locator("body")).not.toContainText(rejectedSnapshotLiteral);
      await expect(page.locator("body")).not.toContainText(
        /יש להזין ברקוד נתמך כדי לאתר|התאריך יועבר למסך „היום”|סריקה באמצעות מצלמת המכשיר|סריקה באמצעות המצלמה זמינה|חיפוש ברקוד מקומי|סריקה באמצעות המכשיר הזה|תמונות המצלמה|סוג ארוחה ביומן/,
      );
      await expectNoHorizontalOverflow(page);
    }

    await context.close();
  });

  test("keeps barcode identifiers atomic LTR tokens at the narrow Hebrew evidence width", async ({ browser }, testInfo) => {
    const context = await authenticatedContext(browser, storageState, {
      viewport: { height: 844, width: 390 },
    });
    await context.addInitScript(() => {
      class Phase11dBarcodeDetector {
        static async getSupportedFormats() {
          return ["ean_8", "ean_13", "upc_a", "itf"];
        }

        async detect() {
          return [];
        }
      }

      Object.defineProperty(globalThis, "BarcodeDetector", {
        configurable: true,
        value: Phase11dBarcodeDetector,
      });
    });
    const page = await context.newPage();
    await page.goto("/he/foods/barcode?date=2026-08-21&mealType=lunch");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-scanner-state='ready']")).toContainText(
      "הסריקה זמינה ואינה מתחילה אוטומטית. ניתן להפעיל אותה באמצעות הכפתור.",
    );

    const evidence = [];
    for (const token of barcodeTechnicalTokens) {
      const locator = page.locator(
        `[data-barcode-technical-token="${token}"]`,
      );
      await expect(locator).toHaveCount(1);
      await expect(locator).toHaveText(token);
      await expect(locator).toHaveAttribute("dir", "ltr");

      const geometry = await locator.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const textRects = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 && rect.height > 0,
        );
        const style = getComputedStyle(element);
        return {
          bounds: {
            bottom: bounds.bottom,
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
          },
          direction: style.direction,
          display: style.display,
          text: element.textContent,
          textRectCount: textRects.length,
          unicodeBidi: style.unicodeBidi,
          whiteSpace: style.whiteSpace,
        };
      });

      expect(geometry.text).toBe(token);
      expect(geometry.direction).toBe("ltr");
      expect(geometry.display).toBe("inline-block");
      expect(geometry.whiteSpace).toBe("nowrap");
      expect(geometry.unicodeBidi).toContain("isolate");
      expect(geometry.textRectCount).toBe(1);
      expect(geometry.bounds.left).toBeGreaterThanOrEqual(0);
      expect(geometry.bounds.right).toBeLessThanOrEqual(390);
      evidence.push({ token, ...geometry });
    }

    await expectNoHorizontalOverflow(page);
    await testInfo.attach(`barcode-bidi-${testInfo.project.name}`, {
      body: Buffer.from(JSON.stringify(evidence, null, 2)),
      contentType: "application/json",
    });
    await context.close();
  });

  test("renders corrected HE-03 editor terminology at the approved widths", async ({ browser }) => {
    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();

    for (const viewport of he03ViewportCases) {
      await page.setViewportSize(viewport);
      for (const copyCase of he03CopyCases) {
        await page.goto(copyCase.path);
        await expect(page.locator("html")).toHaveAttribute("lang", "he");
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        for (const expectedText of copyCase.expectedText) {
          await expect(page.locator("body")).toContainText(expectedText);
        }
        await expect(page.locator("body")).not.toContainText(rejectedSnapshotLiteral);
        await expect(page.locator("body")).not.toContainText(
          rejectedHe03Terminology,
        );
        await expect(page.locator("body")).not.toContainText(
          /שמירת מזון פרטי באמצעות הזנת פרטי המזון|יש לבדוק את הטופס ולשמור לאחר השלמתו|הגדרת המתכון והוספת מרכיבים לפי הסדר|מרכיב שהוזן ידנית|העברה למעלה|העברה למטה|יש לבדוק את המתכון ולשמור כשהכול מוכן|הגדרת שם לארוחה לשימוש חוזר|יש לבדוק את פרטי הארוחה ולשמור לאחר השלמת כל הפרטים|בחירת מזון זמין|חיפוש מזונות|הערות אופציונליות שנשמרות (?:עם המרכיב|עבור הפריט)|שם המותג/,
        );
        if (copyCase.path === "/he/recipes/new") {
          await expect(
            page.getByRole("button", { name: "חיפוש מזון", exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: "הזזת מרכיב 1 למעלה",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: "הזזת מרכיב 1 למטה",
              exact: true,
            }),
          ).toBeVisible();
        }
        if (copyCase.path === "/he/saved-meals/new") {
          const brand = page.locator('input[name*="brand_name"]').first();
          await expect(brand).toBeVisible();
          expect(
            await brand.evaluate(
              (input) =>
                (input as HTMLInputElement).labels?.[0]?.querySelector("span")
                  ?.textContent,
            ),
          ).toBe("מותג");
          await expect(
            page.getByRole("button", {
              name: "הזזת פריט 1 למעלה",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: "הזזת פריט 1 למטה",
              exact: true,
            }),
          ).toBeVisible();
        }
        await expectNoHorizontalOverflow(page);
      }
    }

    await context.close();
  });

  test("preserves explicit locale choice and safe route, date, and meal context", async ({ browser }) => {
    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();

    await page.goto("/en/foods/barcode?date=2026-08-21&mealType=lunch");
    const hebrewLink = page.locator('a[hreflang="he"]');
    await expect(hebrewLink).toHaveAttribute(
      "href",
      "/he/foods/barcode?date=2026-08-21&mealType=lunch",
    );
    await hebrewLink.click();
    await expect(page).toHaveURL(
      "/he/foods/barcode?date=2026-08-21&mealType=lunch",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('input[name="date"]')).toHaveValue("2026-08-21");
    await expect(page.locator('select[name="mealType"]')).toHaveValue("lunch");

    await page.goto("/");
    await expect(page).toHaveURL(/\/he$/);
    const preference = (await context.cookies()).find(
      (cookie) => cookie.name === "nutrition_tracker_locale",
    );
    expect(preference?.value).toBe("he");
    await context.close();
  });

  test("uses active-locale display formatting while preserving canonical date inputs", async ({ browser }) => {
    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();

    for (const locale of ["en", "he"] as const) {
      await page.goto(`/${locale}/today?date=2026-08-21`);
      const targetSummary = page.getByTestId("target-summary");
      await expect(targetSummary).toContainText(
        formatLocalizedNumber(locale, 1234, { maximumFractionDigits: 2 }),
      );
      await expect(targetSummary).toContainText(
        formatLocalizedNumber(locale, 56.5, { maximumFractionDigits: 2 }),
      );
      await expect(targetSummary).toContainText(
        formatLocalizedDate(locale, "2026-08-21", { dateStyle: "long" }),
      );
      await expect(page.locator('input[name="date"]')).toHaveValue("2026-08-21");
    }

    await context.close();
  });

  test("provides keyboard focus, validation association, and nonduplicated status semantics", async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    if (testInfo.project.name === "engine-webkit") {
      await skipLink.focus();
    }
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.getByLabel("Email").fill("synthetic@example.test");
    const passwordInput = page.getByLabel("Password");
    await passwordInput.fill("1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    await expect(passwordInput).toHaveAttribute("aria-describedby", "auth-form-status");
    await expect(passwordInput).toBeFocused();
    const nonemptyAlerts = await page.getByRole("alert").allTextContents();
    expect(nonemptyAlerts.filter((text) => text.trim() !== "")).toEqual([
      "Password must be at least 6 characters.",
    ]);

    const focusStyle = await passwordInput.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);

    await page.goto("/he/auth/sign-in");
    await page.getByLabel("אימייל").fill("synthetic@example.test");
    const hebrewPasswordInput = page.getByLabel("סיסמה");
    await hebrewPasswordInput.fill("1");
    await page.getByRole("button", { name: "כניסה" }).click();
    await expect(hebrewPasswordInput).toHaveAttribute("aria-invalid", "true");
    await expect(hebrewPasswordInput).toHaveAttribute(
      "aria-describedby",
      "auth-form-status",
    );
    await expect(hebrewPasswordInput).toBeFocused();
    const hebrewNonemptyAlerts = await page.getByRole("alert").allTextContents();
    expect(hebrewNonemptyAlerts.filter((text) => text.trim() !== "")).toEqual([
      "הסיסמה צריכה להכיל לפחות 6 תווים.",
    ]);
    await context.close();
  });

  test("covers major forms, navigation, and the universal manual barcode fallback in each engine", async ({ browser }) => {
    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (host !== "127.0.0.1" && host !== "localhost") {
        externalRequests.push(request.url());
      }
    });

    for (const route of [
      "/en/today?date=2026-08-21",
      "/he/foods?q=synthetic",
      "/en/foods/custom/new",
      "/he/saved-meals/new",
      "/en/recipes/new",
      "/he/foods/barcode?date=2026-08-21",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        route.startsWith("/he") ? "rtl" : "ltr",
      );
    }

    await expect(page.locator('input[name="code"]')).toBeVisible();
    await expect(page.getByTestId("barcode-camera-scanner")).toBeVisible();
    await expect(externalRequests).toEqual([]);
    await context.close();
  });

  test("has no essential horizontal overflow at 320, 390, 768, or 1280 CSS px", async ({ browser }, testInfo) => {
    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();

    for (const viewportCase of viewportCases) {
      await page.setViewportSize({
        height: viewportCase.height,
        width: viewportCase.width,
      });
      await page.goto(viewportCase.path);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        viewportCase.locale === "he" ? "rtl" : "ltr",
      );
      await expect(page.locator("h1").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);

      if (testInfo.project.name === "engine-chromium") {
        await testInfo.attach(
          `viewport-${viewportCase.width}-${viewportCase.locale}`,
          {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          },
        );
      }
    }

    await context.close();
  });

  test("keeps real custom-food alias controls contained, separate, and actionable", async ({ browser }, testInfo) => {
    const context = await authenticatedContext(browser, storageState);
    const geometryEvidence = [];

    for (const locale of ["en", "he"] as const) {
      for (const viewportCase of aliasControlViewportCases) {
        const page = await context.newPage();
        await page.setViewportSize(viewportCase);
        await page.goto(`/${locale}/foods/custom/new`);
        const addAliasButton = page.getByRole("button", {
          name: locale === "he" ? "הוספת כינוי" : "Add alias",
        });
        await addAliasButton.click();
        await expect(page.getByText(
          locale === "he"
            ? "כינויי חיפוש שנוספו: 1 מתוך 20."
            : "1 alias added (maximum 20).",
          { exact: true },
        )).toBeVisible();
        if (locale === "he") {
          await expect(page.getByLabel("כינוי", { exact: true })).toBeVisible();
          await expect(page.locator("body")).not.toContainText("טקסט הכינוי");
        }
        await addAliasButton.click();
        await expect(page.getByText(
          locale === "he"
            ? "כינויי חיפוש שנוספו: 2 מתוך 20."
            : "2 aliases added (maximum 20).",
          { exact: true },
        )).toBeVisible();
        await page
          .getByTestId("custom-food-alias-row")
          .nth(1)
          .getByRole("button", {
            name: locale === "he" ? "הסרת כינוי" : "Remove alias",
          })
          .click();

        const aliasRow = page.getByTestId("custom-food-alias-row");
        await expect(aliasRow).toHaveCount(1);
        const languageSelect = aliasRow.locator("select");
        const removeButton = aliasRow.getByRole("button", {
          name: locale === "he" ? "הסרת כינוי" : "Remove alias",
        });
        await expect(languageSelect).toBeEnabled();
        await expect(removeButton).toBeEnabled();
        await languageSelect.selectOption(locale === "he" ? "en" : "he");
        await expect(languageSelect).toHaveValue(locale === "he" ? "en" : "he");

        const geometry = await aliasRow.evaluate((row) => {
          const languageControl = row.querySelector("select");
          const removeControl = row.querySelector("button");
          if (!languageControl || !removeControl) {
            throw new Error("Expected alias language and remove controls.");
          }

          const rectangle = (element: Element) => {
            const bounds = element.getBoundingClientRect();
            return {
              bottom: bounds.bottom,
              height: bounds.height,
              left: bounds.left,
              right: bounds.right,
              top: bounds.top,
              width: bounds.width,
            };
          };
          const container = rectangle(row);
          const select = rectangle(languageControl);
          const removeButton = rectangle(removeControl);
          const overlapWidth = Math.max(
            0,
            Math.min(select.right, removeButton.right) -
              Math.max(select.left, removeButton.left),
          );
          const overlapHeight = Math.max(
            0,
            Math.min(select.bottom, removeButton.bottom) -
              Math.max(select.top, removeButton.top),
          );
          const intersects = overlapWidth > 0 && overlapHeight > 0;
          const tolerance = 1;
          const contained = (control: ReturnType<typeof rectangle>) =>
            control.left >= container.left - tolerance &&
            control.right <= container.right + tolerance &&
            control.top >= container.top - tolerance &&
            control.bottom <= container.bottom + tolerance;

          return {
            container,
            containment: {
              removeButton: contained(removeButton),
              select: contained(select),
            },
            document: {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            },
            intersection: {
              height: intersects ? overlapHeight : 0,
              width: intersects ? overlapWidth : 0,
            },
            removeButton,
            select,
          };
        });

        expect(geometry.intersection).toEqual({ height: 0, width: 0 });
        expect(geometry.containment).toEqual({
          removeButton: true,
          select: true,
        });
        expect(geometry.select.height).toBeGreaterThanOrEqual(44);
        expect(geometry.removeButton.height).toBeGreaterThanOrEqual(44);
        expect(geometry.document.scrollWidth).toBeLessThanOrEqual(
          geometry.document.clientWidth + 1,
        );

        geometryEvidence.push({
          locale,
          supportingReflow:
            "supportingReflow" in viewportCase
              ? viewportCase.supportingReflow
              : null,
          viewport: viewportCase,
          ...geometry,
        });

        await removeButton.click();
        await expect(aliasRow).toHaveCount(0);
        await page.close();
      }
    }

    await testInfo.attach(`alias-control-geometry-${testInfo.project.name}`, {
      body: Buffer.from(JSON.stringify(geometryEvidence, null, 2)),
      contentType: "application/json",
    });
    await context.close();
  });

  test("honors reduced-motion preference without removing interaction", async ({ browser }) => {
    const context = await authenticatedContext(browser, storageState, {
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/en/today?date=2026-08-21");

    const languageLink = page.locator('a[hreflang="he"]');
    await expect(languageLink).toBeVisible();
    const transitionDuration = await languageLink.evaluate((element) =>
      getComputedStyle(element).transitionDuration,
    );
    expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.01);
    await expect(languageLink).toHaveAttribute("href", "/he/today?date=2026-08-21");
    await context.close();
  });

  test("has zero serious or critical axe findings on the approved critical subset", async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== "engine-chromium",
      "Axe is deterministic shared-DOM automation; engine behavior is covered separately.",
    );

    const severityTotals: Record<string, number> = {
      critical: 0,
      minor: 0,
      moderate: 0,
      serious: 0,
      unknown: 0,
    };
    const addCounts = (counts: Record<string, number>) => {
      for (const [impact, count] of Object.entries(counts)) {
        severityTotals[impact] = (severityTotals[impact] ?? 0) + count;
      }
    };

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto("/en");
    await expect(publicPage.locator("h1")).toBeVisible();
    addCounts(await scanAxe(publicPage, testInfo, "public-home-en"));

    await publicPage.goto("/he/auth/sign-in");
    await publicPage.getByLabel("אימייל").fill("synthetic@example.test");
    await publicPage.getByLabel("סיסמה").fill("1");
    await publicPage.getByRole("button", { name: "כניסה" }).click();
    await expect(
      publicPage.locator('#auth-form-status [role="alert"]'),
    ).toBeVisible();
    addCounts(await scanAxe(publicPage, testInfo, "auth-validation-he"));
    await publicContext.close();

    const context = await authenticatedContext(browser, storageState);
    const page = await context.newPage();
    for (const [stateName, route] of [
      ["diary-en", "/en/today?date=2026-08-21"],
      ["food-search-he", "/he/foods?q=synthetic"],
      ["custom-food-form-en", "/en/foods/custom/new"],
      ["saved-meal-form-he", "/he/saved-meals/new"],
      ["recipe-form-en", "/en/recipes/new"],
      ["barcode-manual-fallback-he", "/he/foods/barcode?date=2026-08-21"],
    ] as const) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      addCounts(await scanAxe(page, testInfo, stateName));
    }
    await context.close();

    await testInfo.attach("axe-severity-totals", {
      body: Buffer.from(JSON.stringify(severityTotals, null, 2)),
      contentType: "application/json",
    });
    process.stdout.write(
      `\nPHASE11D_AXE_SEVERITY_TOTALS ${JSON.stringify(severityTotals)}\n`,
    );
    expect(severityTotals.critical).toBe(0);
    expect(severityTotals.serious).toBe(0);
  });
});
