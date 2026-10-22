import type { Locator, Page, TestInfo } from "@playwright/test";

function describeElements(elements: Element[]) {
  return elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const href = element.getAttribute("href");
    const destination = href?.startsWith("#")
      ? document.getElementById(href.slice(1))
      : null;
    const closedDisclosures: string[] = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement && !parent.open) {
        closedDisclosures.push(parent.id);
      }
    }
    return {
      tag: element.tagName,
      id: element.id,
      name: element.getAttribute("name"),
      connected: element.isConnected,
      visible: element.checkVisibility() && rect.width > 0 && rect.height > 0,
      enabled: !element.matches(":disabled"),
      focused: document.activeElement === element,
      ariaInvalid: element.getAttribute("aria-invalid"),
      href: href?.startsWith("#") ? href : null,
      destinationId: destination?.id ?? null,
      closedDisclosures,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
}

async function observe<T>(read: () => Promise<T>) {
  try {
    return { value: await read() };
  } catch (error) {
    return { captureError: error instanceof Error ? error.message : String(error) };
  }
}

// Capture only after the assertion has failed, before its context is closed.
// Exclude values, text, cookies and storage from the diagnostic attachment.
export async function attachKeyboardFocusFailure(
  page: Page,
  link: Locator,
  expectedControl: Locator,
  info: TestInfo,
) {
  const [documentState, links, controls] = await Promise.all([
    observe(() => page.evaluate(() => ({
      capturedAt: new Date().toISOString(),
      readyState: document.readyState,
      documentHasFocus: document.hasFocus(),
      activeElement: document.activeElement ? {
        tag: document.activeElement.tagName,
        id: document.activeElement.id,
        name: document.activeElement.getAttribute("name"),
        connected: document.activeElement.isConnected,
      } : null,
    }))),
    observe(() => link.evaluateAll(describeElements)),
    observe(() => expectedControl.evaluateAll(describeElements)),
  ]);
  const snapshot = {
    expectedLocator: expectedControl.toString(),
    linkLocator: link.toString(),
    documentState,
    links,
    controls,
  };
  await info.attach("keyboard-focus-failure", {
    body: Buffer.from(JSON.stringify(snapshot, null, 2)),
    contentType: "application/json",
  });
  return snapshot;
}
