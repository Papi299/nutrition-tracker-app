import assert from "node:assert/strict";
import { canonicalizeJson, fingerprintJson } from "../ingestion/usda/foundation/canonical-json.ts";
import { FULL35_STAGED_AUTHORIZATION_ID } from "./full35-owner-release-history.mjs";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sqlLiteral = text => "'" + text.replaceAll("'", "''") + "'";
const expired = expiresAt => Date.now() >= expiresAt;

function operationSql(name, args, { readOnly = false, publish = false } = {}) {
  const [statement, transaction] = publish ? [55, 60] : [8, 12];
  return {
    timeoutSeconds: transaction + 12,
    sql: `begin${readOnly ? " read only" : ""};
set local standard_conforming_strings = on;
set local timezone = 'UTC';
set local lock_timeout = '5s';
set local statement_timeout = '${statement}s';
set local transaction_timeout = '${transaction}s';
set local idle_in_transaction_session_timeout = '10s';
set local work_mem = '2184kB';
select ingestion.${name}(${args.map(sqlLiteral).join(",")});
${publish ? "set constraints all immediate;" : ""}
commit;`,
  };
}

// The operator supplies the existing certificate-verified restricted session
// adapter. It returns one decoded SELECT result only after a confirmed commit.
// No stage or publication is silently retried on a failed or ambiguous reply.
export async function runFull35StagedOperation({ manifest, items, authorization, query, progress = () => {} }) {
  const { id, retry_token: token, plan_hash: planHash } = authorization;
  const expiresAt = Date.parse(authorization.expires_at);
  assert.equal(id, FULL35_STAGED_AUTHORIZATION_ID);
  assert(uuid.test(token) && Number.isFinite(expiresAt));
  assert.equal(fingerprintJson(manifest), planHash);
  assert.equal(manifest.actor_authority.authorization_id, id);
  assert.equal(manifest.items.length, 353);
  assert.equal(items.length, 353);
  const byFood = new Map(items.map(item => [item.before.food_id, item]));
  assert.equal(byFood.size, 353);
  for (const { food_id: food, item_hash: itemHash } of manifest.items) {
    assert(uuid.test(food));
    assert.equal(fingerprintJson(byFood.get(food)), itemHash);
  }
  const run = (name, args = [], options) => query(operationSql(name, [id, ...args, token], options));
  const readReceipt = () => run("get_foundation_full35_owner_receipt_v1", [], { readOnly: true });
  const validateReceipt = receipt => {
    assert.equal(receipt.contract_version, "foundation-full35-owner-receipt/v1");
    assert.equal(receipt.plan_hash, planHash);
    assert.equal(receipt.retry_token, token);
    assert.equal(receipt.owner_authorization.id, id);
    assert.equal(receipt.resulting_head_version, 2);
    assert.equal(receipt.resulting_head_fingerprint, manifest.diff.proposed_dataset_fingerprint);
    assert.deepEqual(receipt.counts, manifest.counts);
    return receipt;
  };
  const prior = await readReceipt();
  if (prior !== null) return validateReceipt(prior);
  assert(!expired(expiresAt), "The exact Full35 authorization expired.");
  const prepared = await run("prepare_full35_staged_plan_v1", [canonicalizeJson(manifest)]);
  assert(uuid.test(prepared.plan_id));
  const done = new Set(prepared.staged_food_ids);
  assert.equal(done.size, prepared.staged_food_ids.length);
  assert([...done].every(food => byFood.has(food)));
  progress(done.size);
  for (const { food_id: food } of manifest.items) {
    if (done.has(food)) continue;
    assert(!expired(expiresAt), "The exact Full35 authorization expired during staging.");
    const stagedId = await run("stage_full35_food_v1", [food, canonicalizeJson(byFood.get(food))]);
    assert(uuid.test(stagedId));
    done.add(food);
    progress(done.size);
  }
  assert(expiresAt - Date.now() > 72_000, "The exact Full35 authorization lacks publication headroom.");
  let result;
  try {
    result = validateReceipt(await run("publish_full35_staged_plan_v1", [], { publish: true }));
  } catch (error) {
    const reconciled = await readReceipt();
    if (reconciled !== null) return validateReceipt(reconciled);
    throw error;
  }
  assert.deepEqual(validateReceipt(await readReceipt()), result);
  return result;
}
