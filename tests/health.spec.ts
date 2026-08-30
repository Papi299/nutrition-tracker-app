import { expect, test } from "@playwright/test";
import { GET, HEAD } from "@/app/api/health/route";

test.describe("minimal liveness contract", () => {
  test("returns the exact non-cached public liveness response without internal details", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(await response.json()).toEqual({ status: "live" });
  });

  test("supports HEAD without exposing a dependency, build, or environment payload", async () => {
    const response = await HEAD();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect([...response.headers.keys()].sort()).toEqual([
      "cache-control",
      "content-type",
    ]);
  });
});
