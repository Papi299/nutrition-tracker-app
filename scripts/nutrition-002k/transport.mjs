import { randomUUID } from 'node:crypto';
import { Session, run } from '../nutrition-002g/process.mjs';
import { Environment } from '../nutrition-002i/local.mjs';
import { boundary, canonical, hash, identifier, literal, assertEqual, fail } from '../nutrition-002g/contract.mjs';
import { identitySql } from '../nutrition-002g/capture.mjs';
import { capture as captureI, schema, inventorySql, rolesSql, catalogWitnessSql,
  readOnly, lockSql, applicationSql, assertRestricted } from '../nutrition-002i/adapter.mjs';

export const FUTURE_SOURCE = Object.freeze({project:'hskfanrqwtqknzpquwhg',environment:'Production',
  database:'postgres',role:'postgres',host:'aws-0-eu-west-1.pooler.supabase.com',port:5432,
  mode:'session',tls:'verify-full',credentialSource:'REVIEWED_TEMPORARY_CLI_SESSION',scope:'READ_ONLY_CAPTURE'});

// This validates a proposed binding only. There is deliberately no network
// implementation, credential issuance, fallback, SET ROLE or hosted entry point.
export function validateProposedBinding(binding, now=Date.now()) {
  const {expiresAt,...fixed}=binding??{};
  assertEqual(fixed,FUTURE_SOURCE,'CONNECTION_BINDING');
  if(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=now||Date.parse(expiresAt)>now+15*60000)fail('CREDENTIAL_EXPIRY');
  return {kind:'MOCK_ONLY',expiresAt};
}
export function openHostedTransport() { fail('HOSTED_TRANSPORT_DISABLED'); }

export async function assertLocal(e, side) {
  if(!(e instanceof Environment)||e.side!==side||e.scope!=='002i'||e.prefix!=='nutrition-002i-'+side)fail('TRANSPORT_RESOURCE');
  if(!['default','desktop-linux'].includes(await run('docker',['context','show'])))fail('DOCKER_CONTEXT');
  await e.check('db'); await assertRestricted(e);
}
export const ledgerSql='select version from supabase_migrations.schema_migrations order by version;';
export const factsSql=`select jsonb_build_object('database',current_database(),'role',current_user,
  'version',current_setting('server_version_num'),'readonly',current_setting('transaction_read_only'),
  'isolation',current_setting('transaction_isolation'));`;
export const typesSql=`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
  'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull)
    order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attgenerated=''))
  order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','ingestion') and c.relkind='r';`;
const nameOf=t=>identifier(t.schema)+'.'+identifier(t.name);
export const typedExpression=t=>'jsonb_build_array('+t.columns.map(c=>
  'jsonb_build_array(t.'+identifier(c)+' is null,t.'+identifier(c)+'::text)').join(',')+')::text';
export const typedAggregate=()=>`coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]')`;
export const typedSql=t=>`select ${typedAggregate(t)} from (select ${typedExpression(t)} rowtext from ${nameOf(t)} t) r;`;
const representedSql=t=>`select ${typedAggregate(t)} from (select ${typedExpression(t)} rowtext
  from json_array_elements(${literal('['+t.rows.join(',')+']')}::json) j
  cross join lateral json_populate_record(null::${nameOf(t)},j) t) r;`;
const identityAt=time=>identitySql.replace('u.banned_until>now()','u.banned_until>'+literal(time)+'::timestamptz');
const textSettings="set local timezone='UTC';set local datestyle='ISO,YMD';set local intervalstyle='postgres';set local extra_float_digits=3;";
const readText=sql=>'begin read only;set local search_path=pg_catalog;'+textSettings+sql+'commit;';
const rawSession=e=>new Session(['exec','-i',e.ids.get('db'),'psql','-XqAt','-v',
  'ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','postgres','-d','postgres']);
const token=s=>{if(!/^[A-F0-9]{8}-[A-F0-9]{8}-[0-9]+$/.test(s))fail('SNAPSHOT_TOKEN');return literal(s);};

// Reader SQL is generated exclusively by this module from trusted inventory.
// The public capture capability cannot execute caller- or archive-selected SQL.
export async function capture(e,count,options={}) {
  await assertLocal(e,'source');
  const captureId=randomUUID(),sessions=new Set();let inventory,types;
  const make=()=>{const s=rawSession(e);sessions.add(s);return s;};
  async function reader(snapshot,fn) {
    await assertLocal(e,'source'); const s=make();
    try {
      // BEGIN and SETs do not acquire a snapshot; import precedes every SELECT.
      try {await s.query(readOnly+textSettings+'set transaction snapshot '+token(options.failImport?'00000000-00000000-0':snapshot)+';');}
      catch(error) {
        if(options.failImport) {
          const result=await s.process.result;
          if(/ERROR:\s+42704\b/.test(result.stderr.toString('utf8')))fail('SNAPSHOT_IMPORT_REJECTED_42704');
        }
        throw error;
      }
      assertEqual(JSON.parse((await s.query(factsSql))[0]),{database:'postgres',role:'postgres',version:'170006',readonly:'on',isolation:'repeatable read'},'READER_IDENTITY');
      assertEqual(await s.query(ledgerSql),boundary(count).map(m=>m.version),'READER_LEDGER');
      assertEqual(JSON.parse((await s.query(inventorySql))[0]),inventory,'READER_INVENTORY');
      if(options.loseReader){s.terminateClient();await s.query('select 1;');fail('READER_LOSS_NOT_DETECTED');}
      const result=await fn(s); await s.query('commit;'); return result;
    } finally {await s.close();sessions.delete(s);}
  }
  const transport={
    async openExporter(source,expected) {
      if(source!==e)fail('EXPORTER_BINDING'); inventory=expected.inventory;
      types=JSON.parse(await options.reference.roleSql(typesSql));
      const s=make(); const allowed=new Set([readOnly,catalogWitnessSql,lockSql(inventory),
        'select pg_export_snapshot();',ledgerSql,inventorySql,'select transaction_timestamp();',rolesSql,'select 1;','commit;']);
      return {get closed(){return s.closed;},get process(){return s.process;},
        query:sql=>{if(!allowed.has(sql))fail('CAPTURE_SQL_DENIED');return s.query(sql===readOnly?sql+textSettings:sql);},close:()=>s.close()};
    },
    schema,
    application:(_,tables,snapshot)=>reader(snapshot,async s=>{
      const result=[];for(const t of tables)result.push({schema:t.schema,name:t.name,columns:t.columns,
        rows:JSON.parse((await s.query(applicationSql(t)))[0])});return result;
    }),
    identity:(_,snapshot,time)=>reader(snapshot,async s=>JSON.parse((await s.query(identityAt(time)))[0])),
    verify:({snapshot,application,identity,capturedAt})=>reader(snapshot,async s=>{
      // Independent direct reads are compared against PostgreSQL's typed
      // reconstruction, not hashes derived only from producer serialization.
      assertEqual(JSON.parse((await s.query(typesSql))[0]),types,'TYPE_INVENTORY');
      const independentIdentity=JSON.parse((await s.query(identityAt(capturedAt)))[0]);
      assertEqual(independentIdentity,identity,'INDEPENDENT_IDENTITY');
      if(options.corrupt)options.corrupt(application);
      const tables=[];
      for(const t of application) {
        const direct=(await s.query(typedSql(t)))[0];
        const represented=(await s.query(representedSql(t)))[0];
        assertEqual(represented,direct,'INDEPENDENT_COMPLETE_VALUES');
        tables.push({schema:t.schema,name:t.name,rows:t.rows.length,sha256:hash(direct)});
      }
      const evidence={contract:'nutrition-002k-source-values/v1',captureId,
        source:{kind:'DISPOSABLE_LOCAL',instance:e.ids.get('db'),database:'postgres',role:'postgres',postgres:'170006'},
        boundary:count,capturedAt,snapshotSha256:hash(snapshot),inventorySha256:hash(canonical(inventory)),
        types,identitySha256:hash(canonical(independentIdentity)),tables,
        ddlModel:{relationLocks:'ACCESS_SHARE',catalogWitness:'VISIBLE_TUPLE_VERSIONS',
          externalExclusion:'REQUIRED_FOR_UNCONTROLLED_PROVIDER_OPERATOR_ACTIVITY',
          qualification:'LOCAL_CONTROLLED_FIXTURE_ONLY',universalAudit:false}};
      evidence.completeValueSha256=hash(canonical(tables));
      evidence.producerRowsSha256=hash(canonical(application));return evidence;
    }),
  };
  try {return await captureI(e,count,{...options,killExporter:false,transport,
    afterSnapshot:async()=>{await options.afterSnapshot?.();if(options.killExporter){for(const s of sessions)s.terminateClient();}}});}
  finally {const closed=await Promise.allSettled([...sessions].map(s=>s.close()));if(closed.some(r=>r.status==='rejected'))fail('SESSION_CLEANUP');}
}

export async function verifyTarget(e,payload) {
  await assertLocal(e,'target');
  assertEqual(JSON.parse(await e.roleSql(typesSql)),payload.verification.types,'TARGET_TYPES');
  for(const t of payload.application) {
    const proof=payload.verification.tables.find(v=>v.schema===t.schema&&v.name===t.name);
    assertEqual(hash(await e.roleSql(readText(typedSql(t)))),proof?.sha256,'INDEPENDENT_TARGET_VALUES');
  }
}
export function acceptanceSql(payload,inventory) {
  assertEqual(inventory.map(({schema,name,columns})=>({schema,name,columns})),
    payload.application.map(({schema,name,columns})=>({schema,name,columns})),'ACCEPTANCE_INVENTORY');
  return [textSettings,...inventory.map(t=>{
    const proof=payload.verification.tables.find(v=>v.schema===t.schema&&v.name===t.name);
    if(!proof||!/^[a-f0-9]{64}$/.test(proof.sha256))fail('VALUE_EVIDENCE');
    const query=typedSql(t).replace(/;$/,'');
    return `do $accept$ begin if (select encode(sha256(convert_to((${query})::text,'UTF8')),'hex')) <> ${literal(proof.sha256)} then raise exception 'INDEPENDENT_TARGET_VALUES';end if;end $accept$;`;
  })];
}
