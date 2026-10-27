import assert from 'node:assert/strict';
import { qualify } from '../nutrition-002g/qualify-local.mjs';
import { assertEqual } from '../nutrition-002g/contract.mjs';
import { Environment } from './local.mjs';
import { capture, schema, restoreRows, roleState, assertRestricted } from './adapter.mjs';

await qualify({
  output:process.argv[2], profile:'002i', Environment,
  capture, schema, restoreRows, roleState, transition:false,
  implementationPaths:[
    'contract.mjs','process.mjs','local.mjs','mail-local.mjs','mail-sink.mjs',
    'capture.mjs','archive.mjs','identity.mjs','fixtures.mjs','qualify-local.mjs',
    '../nutrition-002i/local.mjs','../nutrition-002i/adapter.mjs',
    '../nutrition-002i/qualify-local.mjs',
  ],
  afterReplay:async(source,target)=>{
    await source.restrictRole(); await target.restrictRole();
    // The application recovery contract must not require identical unrelated
    // provider roles on independently provisioned source/target databases.
    await source.sql('create role unrelated_provider_fixture nologin;');
  },
  duringCapture:async source=>{
    await assert.rejects(()=>source.sql("begin;set local lock_timeout='100ms';alter table public.profiles add column forbidden integer;commit;"),
      /N002G_LOCAL_PROCESS_FAILED_55P03/);
  },
  extraCaptureChecks:async({source,target,count,record})=>{
    await record('boundary'+count+'RestrictedRolesActuallyDenyAdministrativeOperations',async()=>{
      for(const e of [source,target]) {
        await assertRestricted(e);
        await assert.rejects(()=>e.roleSql('begin;lock table pg_catalog.pg_class in share mode;commit;'),
          /N002G_LOCAL_PROCESS_FAILED_42501/);
        await assert.rejects(()=>e.roleSql('set session_replication_role=replica;'),
          /N002G_LOCAL_PROCESS_FAILED_42501/);
        await assert.rejects(()=>e.roleSql('set role ingestion_definer;'),
          /N002G_LOCAL_PROCESS_FAILED_42501/);
      }
    });
    await record('boundary'+count+'CatalogFunctionChangeAndRevertRejected',async()=>{
      await assert.rejects(()=>capture(source,count,{reference:target,afterSnapshot:async()=>{
        await source.sql('alter function public.is_current_account_activated() set search_path=public;');
        await source.sql("alter function public.is_current_account_activated() set search_path='';");
      }}),/CATALOG_CHANGED_DURING_CAPTURE/);
      assertEqual(await schema(source),await schema(target),'REVERTED_TRUSTED_SCHEMA');
    });
    await record('boundary'+count+'CatalogGrantChangeAndRevertRejected',async()=>{
      await assert.rejects(()=>capture(source,count,{reference:target,afterSnapshot:async()=>{
        await source.sql('grant select on public.profiles to anon;');
        await source.sql('revoke select on public.profiles from anon;');
      }}),/CATALOG_CHANGED_DURING_CAPTURE/);
      assertEqual(await schema(source),await schema(target),'REVERTED_TRUSTED_GRANT');
    });
    await record('boundary'+count+'ConcurrentRoleMembershipChangeRejected',async()=>{
      try {
        await assert.rejects(()=>capture(source,count,{reference:target,afterSnapshot:()=>source.sql('grant authenticated to anon;')}),
          /CATALOG_CHANGED_DURING_CAPTURE/);
      } finally { await source.sql('revoke authenticated from anon;'); }
      assertEqual(await roleState(source),await roleState(target),'REVERTED_TRUSTED_MEMBERSHIP');
    });
    await record('boundary'+count+'PreexistingSourceSecurityDriftRejected',async()=>{
      try {
        await source.sql('alter table public.profiles disable row level security;');
        await assert.rejects(()=>capture(source,count,{reference:target}),/TRUSTED_SCHEMA_MISMATCH/);
      } finally { await source.sql('alter table public.profiles enable row level security;'); }
    });
    await record('boundary'+count+'PreexistingApplicationRoleEscalationRejected',async()=>{
      try {
        await source.sql('alter role authenticated createrole;');
        await assert.rejects(()=>capture(source,count,{reference:target}),/ROLE_MISMATCH/);
      } finally { await source.sql('alter role authenticated nocreaterole;'); }
    });
  },
  extraRestoreChecks:async({target,count,restored,record})=>{
    await record('boundary'+count+'InvalidForeignKeyLoadRollsBackDataAndSecurity',async()=>{
      const invalid=structuredClone(restored);
      const profiles=invalid.application.find(t=>t.schema==='public'&&t.name==='profiles');
      const first=JSON.parse(profiles.rows[0]);
      profiles.rows[0]=profiles.rows[0].replace(first.id,'ffffffff-ffff-4fff-8fff-ffffffffffff');
      await assert.rejects(()=>restoreRows(target,invalid,count),/N002G_LOCAL_PROCESS_FAILED_23503/);
      assertEqual(await schema(target),restored.schema,'ROLLBACK_SECURITY');
      for(const t of restored.application) {
        const name='"'+t.schema+'"."'+t.name+'"';
        const rows=JSON.parse(await target.roleSql(`select coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]')
          from (select row_to_json(t)::text rowtext from ${name} t) r;`));
        assertEqual(rows,t.rows,'ROLLBACK_COMPLETE_VALUES');
      }
    });
  },
});
