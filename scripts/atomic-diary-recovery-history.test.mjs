import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { assertReviewedAtomicDiaryFiles, ATOMIC_DIARY_REVIEWED_HISTORY as pin } from "./atomic-diary-recovery-history.mjs";
import { assertMigrationHistory, assertTrustedMigrationReplay, recoveryMigrationBoundary } from "./phase-11i-recovery-contract.mjs";
const files=readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort();
const read=name=>readFileSync(`supabase/migrations/${name}`);
test("complete 48-file SQL chain equals its closed independent pin",()=>assertReviewedAtomicDiaryFiles(files,read));
test("approved recovery pipeline selects the exact new history",()=>{
  const boundary=recoveryMigrationBoundary(undefined,false,pin.head);
  assertMigrationHistory(files.map(n=>n.slice(0,14)),boundary);
  assert.deepEqual(assertTrustedMigrationReplay(files,boundary,read),files);
});
for(const [label,change] of [
  ["unknown49",f=>f.push("20270101000000_future.sql")],
  ["missing",f=>f.splice(9,1)],
  ["duplicate",f=>{f[8]=f[7];}],
  ["reordered",f=>{[f[8],f[9]]=[f[9],f[8]];}],
  ["version",f=>{f[47]=f[47].replace(pin.head,"20261102181944");}],
  ["filename",f=>{f[47]=`${pin.head}_other.sql`;}],
])test(`${label} fails before replay`,()=>{const altered=[...files];change(altered);assert.throws(()=>assertReviewedAtomicDiaryFiles(altered,read));});
for(const index of [0,43,44,45,46,47])test(`SQL bytes at ordinal ${index+1} cannot be self-asserted`,()=>{
  assert.throws(()=>assertReviewedAtomicDiaryFiles(files,name=>Buffer.concat([read(name),name===files[index]?Buffer.from("--wrong"):Buffer.alloc(0)])));
});
for(const count of [44,45,46,47])test(`original exact ${count} history still selects its established boundary`,()=>{
  const boundary=recoveryMigrationBoundary(undefined,false,files[count-1].slice(0,14));
  assert.equal(assertTrustedMigrationReplay(files,boundary,read).length,count);
});
test("unreviewed 49 head is refused",()=>assert.throws(()=>recoveryMigrationBoundary(undefined,false,"20270101000000")));
