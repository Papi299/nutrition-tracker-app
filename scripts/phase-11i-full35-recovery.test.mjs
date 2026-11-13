import assert from "node:assert/strict";
import test from "node:test";
import {assertFreshFull35Marker,assertFull35Payload,assertFull35Rows,full35AtomicRestoreGuard,full35AtomicRejectionMessage,full35ReviewedSchemaHash,assertFull35SourceMetadata,FULL35_RECOVERY_V1,FULL35_RECOVERY_V2} from "./phase-11i-full35-recovery.mjs";
import { canonicalize, sha256 } from "./phase-11i-recovery-contract.mjs";
const source="00000000-0000-4000-8000-000000000001",target="00000000-0000-4000-8000-000000000002";
test("fresh marker remains independent and stable",()=>assertFreshFull35Marker(source,target,target));
for(const [label,args] of [["copied source marker",[source,source]],["changed target marker",[source,target,source]],["missing source marker",[null,target]],["missing target marker",[source,null]]])test(label+" fails",()=>assert.throws(()=>assertFreshFull35Marker(...args)));
for(const sql of ['INSERT INTO private.mapping_actor_cluster_epoch VALUES (true);','INSERT INTO "private"."mapping_actor_cluster_epoch" VALUES (true);','-- mapping_actor_cluster_epoch','COMMIT;','BEGIN;','ROLLBACK;'])test("unsafe operational payload is refused: "+sql,()=>assert.throws(()=>assertFull35Payload(sql)));
test("application data payload retains its reviewed normal loader settings",()=>assertFull35Payload('SET session_replication_role=replica;\nINSERT INTO public.foods VALUES (1);\nSET session_replication_role=origin;'));
const rows={"public.foods":{count:353,sha256:"a".repeat(64)}};
test("whole-row fingerprint equality preserves zero/null, versions and timestamps",()=>assertFull35Rows(rows,structuredClone(rows)));
for(const bad of [{}, {...rows,"public.foods":{count:353,sha256:"b".repeat(64)}}, {...rows,"public.foods":{count:352,sha256:"a".repeat(64)}}])test("same count hash changes or missing rows fail",()=>assert.throws(()=>assertFull35Rows(rows,bad)));
test("atomic guard requires exact complete rows and preserves target epoch before commit",()=>{const guard=full35AtomicRestoreGuard({sourceClusterMarker:source,rowFingerprints:rows},target);assert.match(guard,/complete persisted row fingerprint mismatch/);assert.match(guard,/target marker changed/);assert.match(guard,/Copied actor authorization/);});
test("atomic guard rejects SQL-shaped table metadata",()=>assert.throws(()=>full35AtomicRestoreGuard({sourceClusterMarker:source,rowFingerprints:{"public.foods;commit":rows["public.foods"]}},target)));

test("atomic rejection preserves guard identity without exposing SQL/private rows",()=>{assert.match(full35AtomicRejectionMessage("ERROR: Full35 complete persisted row fingerprint mismatch\nDETAIL: synthetic private row"),/row fingerprint mismatch/);assert.doesNotMatch(full35AtomicRejectionMessage("ERROR: syntax error\nDETAIL: private row"),/row fingerprint mismatch|private row|syntax error/);});

test("portable reviewed schema fingerprint retains dictionary codes and units",()=>{
  const fingerprint=(unit)=>full35ReviewedSchemaHash(query=>{
    if(query.includes("'dictionary'")){
      assert.match(query,/jsonb_build_object\('code',code,'unit',unit\)/);
      return [[JSON.stringify({dictionary:[{code:"vitamin_k_ug",unit}]})]];
    }
    return [["{}"]];
  });
  assert.notEqual(fingerprint("ug"),fingerprint("g"));
});

test("legacy H56 catalog fingerprint retains its original bytes and comparison", () => {
  const catalog = '{"dictionary":[]}';
  const roles = {roles:[{name:"cli_login_postgres",valid_until:"2026-11-13T09:00:00Z"}],memberships:[]};
  const writerBarrier = {privateSchema:null,writerDefaults:null};
  const rows = sql => {
    if (sql.includes("from pg_auth_members")) return [[JSON.stringify(roles)]];
    if (sql.includes("'privateSchema'")) return [[JSON.stringify(writerBarrier)]];
    assert.doesNotMatch(sql, /set local search_path/);
    return [[catalog]];
  };
  assert.equal(full35ReviewedSchemaHash(rows, true, FULL35_RECOVERY_V1),
    sha256(canonicalize({catalog,roles,writerBarrier})));
});

test("v2 fingerprints are domain-separated and an invalid provider role fails closed", () => {
  const catalog = '{"dictionary":[]}';
  const roles = {roles:[],memberships:[]};
  const rows = status => sql => sql.includes("verified_login")
    ? [[status, JSON.stringify(roles)]] : [[catalog]];
  assert.notEqual(full35ReviewedSchemaHash(rows("t"), false, FULL35_RECOVERY_V2),
    sha256(canonicalize({catalog,roles})));
  assert.throws(() => full35ReviewedSchemaHash(rows("f"), false, FULL35_RECOVERY_V2), /temporary CLI login/);
  assert.throws(() => full35ReviewedSchemaHash(rows("t"), false, "v3"), /Unknown Full35/);
});

test("H56 metadata admits exact v1 and v2 versions and refuses unknown versions", () => {
  const metadata = {
    sourceClusterMarker:source, installedContractHash:"a".repeat(64), reviewedSchemaHash:"b".repeat(64),
    rowFingerprints:Object.fromEntries(["ingestion.foundation_owner_authorization", ...Array.from({length:78},
      (_,index) => `public.synthetic_${"a".repeat(index + 1)}`)].map(name => [name, {count:0,sha256:"c".repeat(64)}])),
  };
  for (const schemaVersion of [FULL35_RECOVERY_V1,FULL35_RECOVERY_V2]) {
    assert.doesNotThrow(() => assertFull35SourceMetadata({...metadata,schemaVersion},true));
  }
  assert.throws(() => assertFull35SourceMetadata({...metadata,schemaVersion:"phase-11i-full35-recovery/v3"},true),
    /metadata mismatch/);
});
