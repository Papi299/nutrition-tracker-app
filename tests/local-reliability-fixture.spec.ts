import { expect, test } from "@playwright/test";
import { isLocalReliabilityTestFixtureEnabled } from "@/lib/reliability/local-test-fixture";

const localEnvironment = {
  APP_ORIGIN: "http://127.0.0.1:3100",
  DATE_E2E_LOCAL_SUPABASE: "1",
  LOCAL_RELIABILITY_FAULT_CONTROL_URL: "http://127.0.0.1:45000/fault",
  LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
};

test("enables render-failure injection only for the complete loopback-local test contract", () => {
  expect(isLocalReliabilityTestFixtureEnabled(localEnvironment)).toBe(true);
  expect(
    isLocalReliabilityTestFixtureEnabled({
      ...localEnvironment,
      DATE_E2E_LOCAL_SUPABASE: undefined,
    }),
  ).toBe(false);
  expect(
    isLocalReliabilityTestFixtureEnabled({
      ...localEnvironment,
      APP_ORIGIN: "https://beta.example.com",
    }),
  ).toBe(false);
  expect(
    isLocalReliabilityTestFixtureEnabled({
      ...localEnvironment,
      LOCAL_RELIABILITY_FAULT_CONTROL_URL: "https://example.com/fault",
    }),
  ).toBe(false);
  expect(
    isLocalReliabilityTestFixtureEnabled({
      ...localEnvironment,
      LOCAL_SUPABASE_URL: "https://project.supabase.co",
    }),
  ).toBe(false);
});
