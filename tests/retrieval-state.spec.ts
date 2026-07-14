import { expect, test } from "@playwright/test";
import {
  isRetrievalFailure,
  resolveNullableRetrieval,
  resolveRetrieval,
} from "@/lib/data/retrieval-state";

test.describe("retrieval-state resolution", () => {
  test("distinguishes ready, missing, and failed nullable reads", () => {
    expect(resolveNullableRetrieval({ data: { id: "profile" }, ok: true })).toEqual(
      {
        data: { id: "profile" },
        status: "ready",
      },
    );
    expect(resolveNullableRetrieval({ data: null, ok: true })).toEqual({
      status: "missing",
    });
    expect(
      resolveNullableRetrieval({ code: "database_error", ok: false }),
    ).toEqual({ status: "database_error" });
    expect(
      resolveNullableRetrieval({ code: "unauthenticated", ok: false }),
    ).toEqual({ status: "unauthenticated" });
  });

  test("preserves successful empty collections without calling them missing", () => {
    expect(resolveRetrieval({ data: [], ok: true })).toEqual({
      data: [],
      status: "ready",
    });
  });

  test("classifies only database and validation states as retrieval failures", () => {
    expect(isRetrievalFailure({ status: "database_error" })).toBe(true);
    expect(isRetrievalFailure({ status: "validation_error" })).toBe(true);
    expect(isRetrievalFailure({ status: "missing" })).toBe(false);
    expect(isRetrievalFailure({ status: "unauthenticated" })).toBe(false);
  });
});
