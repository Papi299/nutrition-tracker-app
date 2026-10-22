import { attachKeyboardFocusFailure } from "@/e2e/helpers/focus-diagnostics";
import { expect, test } from "@playwright/test";

test("focus diagnostics retain the actual focus and hidden disabled target without field values", async ({ page }, info) => {
  await page.setContent(`
    <button id="actual-focus">Actual focus</button>
    <a id="summary-link" href="#expected-input">Expected input</a>
    <details id="closed-group"><summary>Group</summary>
      <input id="expected-input" name="alias_text_1" disabled value="private-synthetic-value">
    </details>
  `);
  await page.locator("#actual-focus").focus();
  const snapshot = await attachKeyboardFocusFailure(
    page, page.locator("#summary-link"), page.locator('[name="alias_text_1"]'), info,
  );
  expect(snapshot.documentState).toMatchObject({ value: { activeElement: { id: "actual-focus", tag: "BUTTON" } } });
  expect(snapshot.links).toMatchObject({ value: [{ href: "#expected-input", destinationId: "expected-input" }] });
  expect(snapshot.controls).toMatchObject({ value: [{ connected: true, visible: false, enabled: false, focused: false, closedDisclosures: ["closed-group"] }] });
  expect(JSON.stringify(snapshot)).not.toContain("private-synthetic-value");
  expect(info.attachments).toContainEqual(expect.objectContaining({ name: "keyboard-focus-failure", contentType: "application/json" }));
});

test("focus diagnostics record BODY focus and a missing destination", async ({ page }, info) => {
  await page.setContent('<a id="summary-link" href="#removed-input">Removed input</a>');
  const snapshot = await attachKeyboardFocusFailure(
    page, page.locator("#summary-link"), page.locator("#removed-input"), info,
  );
  expect(snapshot.documentState).toMatchObject({ value: { activeElement: { tag: "BODY" } } });
  expect(snapshot.links).toMatchObject({ value: [{ href: "#removed-input", destinationId: null }] });
  expect(snapshot.controls).toEqual({ value: [] });
});
