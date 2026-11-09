import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintJson } from "../ingestion/usda/foundation/canonical-json.ts";
import { FULL35_STAGED_AUTHORIZATION_ID } from "./full35-owner-release-history.mjs";
import { runFull35StagedOperation } from "./full35-staged-operation.mjs";

const id = FULL35_STAGED_AUTHORIZATION_ID;
const retryToken = "12345678-1234-1234-1234-123456789abc";
const foods = Array.from({ length: 353 }, (_, index) => "00000000-0000-0000-0000-" + String(index).padStart(12, "0"));
const items = foods.map(food => ({ before: { food_id: food } }));
const manifest = {
  actor_authority: { authorization_id: id },
  items: items.map((item, index) => ({ food_id: foods[index], item_hash: fingerprintJson(item) })),
  counts: { foods: 353, inserted_rows: 5062 },
  diff: { proposed_dataset_fingerprint: "d".repeat(64) },
};
const authorization = {
  id, retry_token: retryToken, plan_hash: fingerprintJson(manifest), expires_at: "2999-01-01T00:00:00.000Z",
};
const receipt = {
  contract_version: "foundation-full35-owner-receipt/v1", owner_authorization: { id }, retry_token: retryToken,
  plan_hash: authorization.plan_hash, resulting_head_version: 2,
  resulting_head_fingerprint: manifest.diff.proposed_dataset_fingerprint, counts: manifest.counts,
};

test("resume submits only missing foods and reconciles an ambiguous publication without another write", async () => {
  const calls = [], progress = [];
  let committed = null;
  const result = await runFull35StagedOperation({ manifest, items, authorization, progress: value => progress.push(value),
    query: async ({ sql, timeoutSeconds }) => {
      const name = sql.match(/select ingestion\.([a-z_0-9]+)\(/)[1];
      calls.push(name);
      if (name === "get_foundation_full35_owner_receipt_v1") return committed;
      if (name === "prepare_full35_staged_plan_v1") return { plan_id: id, staged_food_ids: foods.slice(0, -1) };
      if (name === "stage_full35_food_v1") {
        assert(sql.includes(foods.at(-1)));
        assert(sql.includes("statement_timeout = '8s'"));
        assert.equal(timeoutSeconds, 24);
        return id;
      }
      assert.equal(name, "publish_full35_staged_plan_v1");
      assert(sql.includes("statement_timeout = '55s'") && sql.includes("set constraints all immediate;"));
      assert.equal(timeoutSeconds, 72);
      committed = receipt;
      throw Error("Lost commit acknowledgement");
    },
  });
  assert.deepEqual(result, receipt);
  assert.deepEqual(progress, [352, 353]);
  assert.deepEqual(calls, [
    "get_foundation_full35_owner_receipt_v1", "prepare_full35_staged_plan_v1",
    "stage_full35_food_v1", "publish_full35_staged_plan_v1", "get_foundation_full35_owner_receipt_v1",
  ]);
});

test("modified food bytes are rejected before any database call", async () => {
  const changed = items.with(0, { ...items[0], altered: true });
  await assert.rejects(runFull35StagedOperation({
    manifest, items: changed, authorization, query: () => assert.fail("Unexpected database call"),
  }), { name: "AssertionError" });
});
