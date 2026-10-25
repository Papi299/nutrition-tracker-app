import assert from 'node:assert/strict';
import test from 'node:test';
import { Cluster } from './local.mjs';
import { canonical, compareCatalogs, CONTRACT, MODE } from './catalog.mjs';
const fixture = () => ({contract:CONTRACT,mode:MODE,postgres:'170006',unsupported:[],records:
  ['roles','database','schemas','relations','columns','functions','types','objects','extensions'].map(section=>({section,key:'synthetic',value:section==='roles'?{rolcanlogin:false}:{approved:true}}))});
test('model equivalence is multiset-exact and can never assert recovery eligibility',()=>{
 const a=fixture(),b=structuredClone(a);b.records.reverse();
 const result=compareCatalogs(a,b);assert.equal(result.recoveryEligible,false);assert.equal(result.historicalSnapshotCertified,false);assert.equal(result.producerAuthenticated,false);
 for (const mutation of [m=>m.records.push({...m.records[0]}),m=>m.records[0].value.rolcanlogin=true,m=>m.records[0].key='extra',m=>m.records.pop()]) {
  const changed=structuredClone(a);mutation(changed);assert.throws(()=>compareCatalogs(a,changed),/N002C1_/);
 }
});
test('unknown contracts, unsupported objects and historical claims fail closed',()=>{
 for(const mutate of [m=>m.mode='EXPORTED_SNAPSHOT',m=>m.postgres='180000',m=>m.extra=true,m=>m.unsupported.push('sequence'),m=>m.records[0].value.rolpassword='synthetic',m=>m.records[0].section='unknown']) {
  const m=fixture();mutate(m);assert.throws(()=>compareCatalogs(fixture(),m),/N002C1_/);
 }
 assert.throws(()=>canonical(undefined),/NON_JSON/);
 assert.throws(()=>canonical(Number.MAX_SAFE_INTEGER+1),/UNSAFE_INTEGER/);
 const cluster=new Cluster('source');assert.throws(()=>{cluster.name='other';},TypeError);assert.throws(()=>cluster.args(),/CLUSTER_NOT_STARTED/);
 assert.throws(()=>new Cluster('Production'),/TARGET_DENIED/);
 assert.throws(()=>new Cluster('source;docker'),/TARGET_DENIED/);
});
