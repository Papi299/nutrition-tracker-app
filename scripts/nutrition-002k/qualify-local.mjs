import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qualify } from '../nutrition-002g/qualify-local.mjs';
import { run } from '../nutrition-002g/process.mjs';
import { canonical, hash, assertEqual } from '../nutrition-002g/contract.mjs';
import { AuthRegressionEnvironment as Environment, fixtureFacts, beforeCapture, targetInitialChecks, afterRecovery, observations as authObservations } from './auth-regressions.mjs';
import { schema, roleState } from '../nutrition-002i/adapter.mjs';
import { capture, typesSql, verifyTarget } from './transport.mjs';
import { seal, open } from './archive.mjs';
import { MockPublication, publish } from './publication.mjs';
import { restore, restoreRows } from './restore.mjs';

const candidates=new Map(),archives=new Map(),metrics=[];let sourceEnvironment,serial=0;
const observed={kind:'LOCAL_OBSERVED',postgres:'170006',auth:null};
await qualify({output:process.argv[2],profile:'002k',Environment,transition:false,schema,roleState,restoreRows,
  implementationPaths:['contract.mjs','password-fixture.mjs','process.mjs','local.mjs','mail-local.mjs','mail-sink.mjs','capture.mjs','archive.mjs','identity.mjs','fixtures.mjs','qualify-local.mjs',
    '../nutrition-002i/local.mjs','../nutrition-002i/adapter.mjs','../nutrition-002k/transport.mjs','../nutrition-002k/archive.mjs','../nutrition-002k/publication.mjs','../nutrition-002k/restore.mjs','../nutrition-002k/qualify-local.mjs','../nutrition-002k/auth-regressions.mjs','../../lib/auth/recent-password-auth-proof.ts'],
  afterReplay:async(source,target)=>{
    sourceEnvironment=source;await source.restrictRole();await target.restrictRole();
    observed.auth=(await source.api('/health')).body.version;
  },
  extraAuthChecks:afterRecovery,
  afterPopulate:async({source,target,count,owner,record})=>{
    await fixtureFacts({source,target,count,record});
    await beforeCapture({source,target,count,record});
    // Fixture bootstrap only, outside the capture transport. The real trusted
    // jsonb object column retains exact large/decimal values, nested JSON null,
    // empty object/array/string and zero through archive and target restoration.
    await source.sql(`insert into public.manual_diary_entry_requests(user_id,idempotency_key,
      request_payload,completed_diary_entry_id,live_diary_entry_id)
      select '${owner.id}',gen_random_uuid(),
      '{"precision":9007199254740993.12345678901234567890,"null":null,"zero":0,"empty":"","object":{},"array":[]}'::jsonb,
      id,id from public.diary_entries where user_id='${owner.id}' order by id limit 1;`);
  },
  capture:async(source,count,options)=>{
    const p=await capture(source,count,options);
    // This receipt belongs to the independent reader and is retained separately
    // before constructing any archive. It is never recovered from that archive.
    candidates.set(p.verification.captureId,hash(canonical(p.verification)));return p;
  },
  duringCapture:async source=>{
    await assert.rejects(()=>source.sql("begin;set local lock_timeout='100ms';alter table public.profiles add column forbidden integer;commit;"),/55P03/);
  },
  seal:async(payload,certificate,directory)=>{
    const publication={repository:'Papi299/nutrition-tracker-app',workflow:'nutrition-002k-mock-publication',runId:++serial,attempt:1,
      sourceSha:await run('git',['rev-parse','HEAD'])};
    const pair=await seal(payload,certificate,publication,observed);
    const expected={manifestSha256:pair.manifestSha256,source:payload.verification.source,boundary:payload.boundary,
      publication,sourceEvidenceSha256:candidates.get(payload.verification.captureId)};
    const receipt=await publish(pair,new MockPublication(),expected);
    mkdirSync(directory,{mode:0o700});writeFileSync(join(directory,'manifest.json'),pair.manifest,{mode:0o600,flag:'wx'});
    writeFileSync(join(directory,'archive.cms'),pair.cipher,{mode:0o600,flag:'wx'});
    archives.set(directory,{expected,receipt,pair,certificate});
    metrics.push({boundary:payload.boundary,plainBytes:JSON.parse(pair.manifest).plainBytes,
      compressedBytes:JSON.parse(pair.manifest).compressedBytes,cipherBytes:pair.cipher.length,artifactBytes:receipt.bytes,
      typesSha256:hash(canonical(payload.verification.types)),
      numericTypes:[...new Set(payload.verification.types.flatMap(t=>t.columns.map(c=>c[1])).filter(t=>/numeric|bigint|xid8/.test(t)))].sort(),
      jsonColumns:payload.verification.types.flatMap(t=>t.columns.filter(c=>c[1]==='jsonb'||c[1]==='json').map(c=>({table:t.schema+'.'+t.name,column:c[0],type:c[1],notNull:c[2]})))});
    return {manifest:JSON.parse(pair.manifest),manifestSha256:pair.manifestSha256};
  },
  openArchive:async(directory,key,certificate,expectation)=>{
    const a=archives.get(directory);assert.ok(a);
    const result=await open({manifest:readFileSync(join(directory,'manifest.json'),'utf8'),cipher:readFileSync(join(directory,'archive.cms'))},key,certificate,
      {...a.expected,boundary:expectation.boundary,manifestSha256:expectation.manifestSha256,
        ...(expectation.source==='nutrition-002i-source'?{}:{source:{kind:'wrong'}})});
    a.key=key;return result;
  },
  reconstructIdentities:async(target,payload,approval,cipherSha256,operatorPublicKey)=>{
    const a=[...archives.values()].find(a=>a.receipt.cipherSha256===cipherSha256);assert.ok(a);
    await restore({source:sourceEnvironment,target,...a,key:a.key,approval,operatorPublicKey});
    await verifyTarget(target,payload);
  },
  extraCaptureChecks:async({source,target,count,owner,record})=>{
    await record('boundary'+count+'IndependentReaderDetectsValuesRowsPrecisionAndNullCorruption',async()=>{
      const replace=(tables,name,before,after)=>{
        const t=tables.find(t=>t.name===name),i=t.rows.findIndex(r=>r.includes(before));assert.ok(i>=0);
        t.rows[i]=t.rows[i].replace(before,after);
      };
      for(const corrupt of [tables=>{const t=tables.find(t=>t.name==='profiles');t.rows[0]=t.rows[0].replace('Equal count replacement value','CORRUPT');},
        tables=>{tables.find(t=>t.name==='profiles').rows.pop();},
        tables=>replace(tables,'manual_diary_entry_requests','9007199254740993.12345678901234567890','9007199254740994'),
        tables=>replace(tables,'manual_diary_entry_requests','"null": null','"null": 0'),
        tables=>replace(tables,'manual_diary_entry_requests','"zero": 0','"zero": null'),
        tables=>replace(tables,'diary_entries','"calories":null','"calories":0')])
        await assert.rejects(()=>capture(source,count,{reference:target,corrupt}),/INDEPENDENT_COMPLETE_VALUES/);
    });
    await record('boundary'+count+'RealReaderLossAndImportFailureAbort',async()=>{
      await assert.rejects(()=>capture(source,count,{reference:target,loseReader:true}),/SESSION_EOF/);
      await assert.rejects(()=>capture(source,count,{reference:target,failImport:true}),/SNAPSHOT_IMPORT_REJECTED_42704/);
    });
    await record('boundary'+count+'OwnershipRestrictionsAndConcurrentClosureRemainCoherent',async()=>{
      const id=await source.sql("select id from public.diary_entries where user_id='"+owner.id+"' order by id limit 1;");
      const other=await source.sql("select id from auth.users where id<>'"+owner.id+"' order by id limit 1;");
      await assert.rejects(()=>source.sql("update public.diary_entries set user_id='"+other+"' where id='"+id+"';"),/42501/);
      const inactive=await source.sql("select id from auth.users where email='inactive@example.invalid';");
      const p=await capture(source,count,{reference:target,afterSnapshot:()=>source.sql("insert into public.account_closures(user_id,closure_request_id,closure_policy_version) values ('"+inactive+"',gen_random_uuid(),'p11e-e5-account-closure-v1');")});
      assert.ok(p.application.find(t=>t.name==='diary_entries').rows.find(r=>r.includes(id)).includes(owner.id));
      assert.ok(!p.application.find(t=>t.name==='account_closures').rows.some(r=>r.includes(inactive)));
      assertEqual(await source.sql("select count(*) from public.account_closures where user_id='"+inactive+"';"),'1','CONCURRENT_CLOSURE_EXECUTED');
    });
    await record('boundary'+count+'FunctionGrantRevertsAndPersistentMembershipDriftAbort',async()=>{
      const cases=[
        ["alter function public.is_current_account_activated() set search_path=public;","alter function public.is_current_account_activated() set search_path='';"],
        ['grant select on public.profiles to anon;','revoke select on public.profiles from anon;'],
        ['grant authenticated to anon;','revoke authenticated from anon;'],
      ];
      for(const [index,[change,revert]] of cases.entries()) {
        try {
          let rejection;
          try {await capture(source,count,{reference:target,afterSnapshot:async()=>{await source.sql(change);if(index<2)await source.sql(revert);}});}
          catch(e){rejection=e.message;}
          if(!rejection?.includes('CATALOG_CHANGED_DURING_CAPTURE'))throw Error('N002G_DDL_CASE_'+index+'_'+(rejection??'DID_NOT_REJECT').replaceAll('N002G_','').replace(/[^A-Z0-9_]/g,'_'));
        }
        finally {await source.sql(revert);}
      }
    });
    await record('boundary'+count+'PolicyDDLIsLockedAndPreexistingPolicyDriftRejected',async()=>{
      let created=false;
      try {
        await assert.rejects(()=>capture(source,count,{reference:target,afterSnapshot:async()=>{
          await source.sql("begin;set local lock_timeout='100ms';create policy nutrition_002k_negative on public.profiles for select to anon using (true);commit;");created=true;
        }}),/LOCAL_PROCESS_FAILED_55P03/);
      }finally{if(created)await source.sql('drop policy nutrition_002k_negative on public.profiles;');}
      try {
        await source.sql('create policy nutrition_002k_negative on public.profiles for select to anon using (true);');
        await assert.rejects(()=>capture(source,count,{reference:target}),/TRUSTED_SCHEMA_MISMATCH/);
      }finally{await source.sql('drop policy nutrition_002k_negative on public.profiles;');}
    });
    await record('boundary'+count+'WrongLedgerUnexpectedRelationColumnAndExtensionAbort',async()=>{
      const version=await source.sql('select max(version) from supabase_migrations.schema_migrations;');
      try {await source.sql("delete from supabase_migrations.schema_migrations where version='"+version+"';");
        await assert.rejects(()=>capture(source,count,{reference:target}),/LEDGER/);
      }finally{await source.sql("insert into supabase_migrations.schema_migrations values ('"+version+"');");}
      for(const [change,revert] of [['create table public.unexpected(id int);','drop table public.unexpected;'],
        ['alter table public.profiles add column unexpected int;','alter table public.profiles drop column unexpected;']]) {
        try {await source.sql(change);await assert.rejects(()=>capture(source,count,{reference:target}),/SOURCE_TABLE_INVENTORY/);}finally{await source.sql(revert);}
      }
      const extension=await source.sql("select extversion from pg_extension where extname='pgcrypto';");
      try{await source.sql("update pg_extension set extversion='unsupported' where extname='pgcrypto';");
        await assert.rejects(()=>capture(source,count,{reference:target}),/ROLE_MISMATCH/);
      }finally{await source.sql("update pg_extension set extversion='"+extension+"' where extname='pgcrypto';");}
    });
    await record('boundary'+count+'ActualTrustedTypesAndNullPrecisionProbe',async()=>{
      const types=JSON.parse(await source.roleSql(typesSql));assert.equal(types.length,61);
      const result=await source.roleSql(`select jsonb_build_array(null::text is null, 'null'::jsonb is null,
        ('{"nested":null,"zero":0}'::jsonb)::text,''::text,'{}'::jsonb::text,'[]'::jsonb::text,
        9007199254740993.12345678901234567890::numeric::text,
        (json_populate_record(null::public.profiles,'{"display_name":"","id":null}')).display_name);`);
      const a=JSON.parse(result);assertEqual(a,[true,false,'{"zero": 0, "nested": null}','','{}','[]','9007199254740993.12345678901234567890',''],'NULL_PRECISION_PROBE');
      // Complete typed comparisons, including real fixture numeric/jsonb/null
      // columns, also run during every capture and within every target load.
    });
  },
  extraRestoreChecks:async({target,count,restored,record})=>{
    await targetInitialChecks({target,count,restored,record});
    await record('boundary'+count+'IndependentValueAcceptanceFailureRollsBack',async()=>{
      const bad=structuredClone(restored);bad.verification.tables[0].sha256='0'.repeat(64);
      bad.verification.completeValueSha256=hash(canonical(bad.verification.tables));
      await assert.rejects(()=>restoreRows(target,bad,count),/LOCAL_PROCESS_FAILED/);
      await verifyTarget(target,restored);assertEqual(await schema(target),restored.schema,'ROLLBACK_SECURITY');
    });
    await record('boundary'+count+'InvalidForeignKeyRollbackPreservesIndependentValuesAndSecurity',async()=>{
      const bad=structuredClone(restored),table=bad.application.find(t=>t.name==='profiles');
      const id=JSON.parse(table.rows[0]).id;table.rows[0]=table.rows[0].replace(id,'ffffffff-ffff-4fff-8fff-ffffffffffff');
      bad.verification.producerRowsSha256=hash(canonical(bad.application));
      await assert.rejects(()=>restoreRows(target,bad,count),/23503/);
      await verifyTarget(target,restored);assertEqual(await schema(target),restored.schema,'ROLLBACK_SECURITY');
    });
  },
});
const evidence=JSON.parse(readFileSync(process.argv[2]));evidence.syntheticMeasurements=metrics;evidence.authObservations=authObservations;
evidence.hostedQualification='NOT_PERFORMED';writeFileSync(process.argv[2],JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
