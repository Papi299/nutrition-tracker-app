#!/usr/bin/env python3
"""Fixed, network-none local qualification. Never accepts a database URL.

The source is a clean detached checkout of the accepted main. The two CLI files
must be the installed 2.116.0 platform build. No Production command is emitted.
"""
import argparse, base64, gzip, hashlib, json, os, pathlib, re, shutil
import subprocess, sys, tempfile, time, uuid, zipfile

if not __debug__:
    raise SystemExit('Optimization may disable qualification assertions; use normal Python.')

REPO = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = REPO/'docs/evidence/nutrition-full35-phased-release-enablement-003'
BASE = 'd5399ca52d8ac739ec6b3cb6a66b4fded3a4d43f'
TREE = '4fb74d22012677fbd1ca5534a11a953e5d79387d'
IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.165'
IMAGE_ID = 'sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518'
ACTUAL, REFERENCE = 'nutrition-phased-003-cli', 'nutrition-phased-003-reference'
TOOL = 'nutrition-phased-003-tool'
TOOL_IMAGE = 'public.ecr.aws/supabase/storage-api:v1.70.3'
OWNER = '00000000-0000-4000-8000-000000999700'
VM = ['/opt/homebrew/bin/limactl','shell','nutrition-j3','--'] if sys.platform=='darwin' else []
def run(args, body=None, timeout=120):
    p=subprocess.run(args,input=body,text=True,capture_output=True,timeout=timeout)
    if p.returncode:raise RuntimeError('Local command failed: '+args[0]+' '+p.stderr[-1800:])
    return p.stdout
def docker(*args,body=None,timeout=120):return run(VM+['docker',*args],body,timeout)
def db(container,body):
    assert container in (ACTUAL,REFERENCE)
    return docker('exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1',body=body).strip()
def sha(value):return hashlib.sha256(value if isinstance(value,bytes) else value.encode()).hexdigest()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def save(name,value):
    (EVIDENCE/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
def guard_call(name,*args):
    code='import * as m from '+json.dumps((REPO/'scripts/full35-phased-prefix.mjs').as_uri())+';m['+json.dumps(name)+'](...'+json.dumps(args)+');'
    return run(['node','--input-type=module','-e',code])
def assert_throws(name,*args):
    try:guard_call(name,*args)
    except RuntimeError:return
    raise AssertionError('Guard admitted invalid '+name)
def unzip_json(archive,filename):
    with zipfile.ZipFile(EVIDENCE/archive) as z:
        names=[n for n in z.namelist() if n.endswith('/'+filename)];assert len(names)==1
        return json.loads(z.read(names[0]))

def query_sources():
    source=unzip_json('stage6b-sanitized.zip','database-evidence.json')
    result={q['id']:q for q in source['queries'] if q['id']!='Q04'}
    for name in ['database-q06.json','database-q07.json']:
        q=unzip_json('stage6b-sanitized.zip',name);result[q['id']]=q
    for q in result.values():
        assert q['sql'].startswith('BEGIN TRANSACTION READ ONLY;') and q['sql'].endswith('ROLLBACK;')
    return result
QUERIES=query_sources()
SCHEMA_FIELDS={'Q01':['relations','migration_columns'], 'Q02':['columns','extensions'],
 'Q03':['tables','functions','roles','default_acls'],
 'Q05':['schemas','policies','triggers','expected_role_memberships'],
 'Q06':['columns','constraints','future_collision_names'],'Q07':['grant_paths','relevant_constraints']}
def snapshot(container):
    result={}
    for key,q in QUERIES.items():
        result[key]=json.loads(db(container,q['sql']))
    return result
def schema_hash(snapshot):
    return sha(canonical({q:{key:snapshot[q].get(key) for key in keys} for q,keys in SCHEMA_FIELDS.items()}))
def ledger(container):return json.loads(db(container,"select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]') from supabase_migrations.schema_migrations;"))
def columns(container):
    return json.loads(db(container,"select jsonb_object_agg(name,cols) from (select n.nspname||'.'||c.relname name,jsonb_agg(a.attname order by a.attnum) cols from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where n.nspname in('public','ingestion') and c.relkind='r' group by n.nspname,c.relname) s;"))
def rows_sql(cols):
    sels=[]
    for table,names in sorted(cols.items()):
        assert re.fullmatch(r'(public|ingestion)\.[a-z_]+',table)
        allowed=','.join("'"+x+"'" for x in names)
        image="(select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(t)) where key=any(array["+allowed+"]))"
        sels.append("select '%s' name,count(*) n,encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate \"C\"),''),'UTF8')),'hex') hash from (select encode(sha256(convert_to(%s::text,'UTF8')),'hex') h from %s t) r"%(table,image,table))
    return "select jsonb_object_agg(name,jsonb_build_object('count',n,'sha256',hash)) from ("+' union all '.join(sels)+') s;'
def rows(container,cols):return json.loads(db(container,rows_sql(cols)))

def atomic_authority(container,observed):
    functions=observed['Q03']['functions']
    rpc=[f for f in functions if f['schema']=='public' and f['name']=='create_reference_diary_entry_v1']
    assert len(rpc)==1
    rpc=rpc[0]
    assert rpc['args']=='p_idempotency_key uuid, p_entry_date date, p_meal_type text, p_food_id uuid, p_food_name text, p_brand_name text, p_serving_quantity numeric, p_serving_unit text, p_calories integer, p_protein_g numeric, p_carbohydrates_g numeric, p_fat_g numeric, p_notes text, p_captured boolean, p_additional_nutrients jsonb, p_reference_fingerprint text, p_automatic_fields text[]'
    assert rpc['volatility']=='v' and not rpc['security_definer'] and rpc['settings']==['search_path=""']
    assert rpc['authenticated_execute'] and not rpc['anon_execute'] and not rpc['service_role_execute']
    role=next(r for r in observed['Q03']['roles'] if r['name']=='diary_dataset_reader')
    assert all(role[k] is False for k in ['login','inherit','superuser','createdb','createrole','replication','bypassrls'])
    authority=json.loads(db(container,"""begin transaction read only;
      select jsonb_build_object(
        'dmlRelations',(select coalesce(jsonb_agg(n.nspname||'.'||c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','public','private','ingestion') and c.relkind in ('r','p','v','m','f') and (has_table_privilege('diary_dataset_reader',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('diary_dataset_reader',c.oid,'INSERT,UPDATE,REFERENCES'))),
        'createSchemas',(select coalesce(jsonb_agg(nspname),'[]') from pg_namespace where nspname in ('auth','public','private','ingestion') and has_schema_privilege('diary_dataset_reader',oid,'CREATE')),
        'authSchemaUsage',has_schema_privilege('diary_dataset_reader','auth','USAGE'),
        'authReadableRelations',(select coalesce(jsonb_agg(c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind in ('r','p','v','m','f') and has_any_column_privilege('diary_dataset_reader',c.oid,'SELECT')),
        'ingestionExecutableFunctions',(select coalesce(jsonb_agg(p.oid::regprocedure::text),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ingestion' and has_function_privilege('diary_dataset_reader',p.oid,'EXECUTE')),
        'operationMemberships',(select coalesce(jsonb_agg(rolname),'[]') from pg_roles where rolname like 'ingestion_%' and pg_has_role('diary_dataset_reader',oid,'MEMBER')));
      rollback;"""))
    assert all(v is False or v==[] for v in authority.values()),authority
    return {'rpc':rpc,'readerRole':role,'forbiddenAuthority':authority}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=pathlib.Path,required=True)
    parser.add_argument('--cli-directory',type=pathlib.Path,required=True)
    parser.add_argument('--cli-archive',type=pathlib.Path,required=True)
    args=parser.parse_args();source=args.source.resolve();cli_dir=args.cli_directory.resolve()
    assert run(['git','-C',str(source),'rev-parse','HEAD']).strip()==BASE
    assert run(['git','-C',str(source),'rev-parse','HEAD^{tree}']).strip()==TREE
    assert not run(['git','-C',str(source),'status','--porcelain']).strip()
    guard_call('assertAcceptedSource',str(source))
    assert all((cli_dir/n).is_file() and not (cli_dir/n).is_symlink() for n in ['supabase','supabase-go'])
    import tarfile
    pin=json.loads((source/'package-lock.json').read_text())['packages']['node_modules/@supabase/cli-linux-arm64-musl']
    assert 'sha512-'+base64.b64encode(hashlib.sha512(args.cli_archive.read_bytes()).digest()).decode()==pin['integrity']
    with tarfile.open(args.cli_archive) as archive:
        for name in ['supabase','supabase-go']:
            assert sha(archive.extractfile('package/bin/'+name).read())==sha((cli_dir/name).read_bytes())
    nonce=str(uuid.uuid4());created=[];result={'scope':'LocalSynthetic, network-none; no linked project',
      'source':{'commit':BASE,'tree':TREE},'runNonce':nonce,'boundaries':[],'negativeGuards':[]}
    root=pathlib.Path(tempfile.mkdtemp(prefix='full35-phased-prefix-'))
    # Only directories created by this process are copied/removed.
    vmroot='/tmp/nutrition-phased-003-run-'+nonce
    try:
        existing=docker('ps','-a','--format','{{.Names}}').splitlines()
        assert not any(n in existing for n in [ACTUAL,REFERENCE,TOOL]),'reserved fixture already exists'
        for container in [ACTUAL,REFERENCE]:
            docker('run','-d','--rm','--name',container,'--network','none','--label','nutrition.phased003='+nonce,
              '--shm-size=256m','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_PASSWORD=phased-local-synthetic',IMAGE)
            created.append(container)
            for _ in range(60):
                try:docker('exec',container,'pg_isready','-h','127.0.0.1');break
                except RuntimeError:time.sleep(.2)
            else:raise RuntimeError('local PostgreSQL not ready')
            inspect=json.loads(docker('inspect',container))[0]
            guard_call('assertLocalTarget',{'environment':'LocalSynthetic','name':container,
              'networkMode':inspect['HostConfig']['NetworkMode'],'image':inspect['Image'],
              'privileged':inspect['HostConfig']['Privileged'],'portBindings':inspect['HostConfig']['PortBindings'],
              'mounts':inspect['Mounts'],'runNonce':nonce,'labelNonce':inspect['Config']['Labels']['nutrition.phased003']})
            docker('run','--rm','--network','container:'+container,'-e','GOTRUE_DB_DRIVER=postgres',
              '-e','GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:phased-local-synthetic@127.0.0.1:5432/postgres',
              '-e','GOTRUE_JWT_SECRET=local-phased-003-synthetic-only','-e','GOTRUE_SITE_URL=http://127.0.0.1',
              '-e','API_EXTERNAL_URL=http://127.0.0.1','public.ecr.aws/supabase/gotrue:v2.196.0','auth','migrate')
        docker('run','-d','--rm','--name',TOOL,'--network','container:'+ACTUAL,'--label','nutrition.phased003='+nonce,'--entrypoint','tail',TOOL_IMAGE,'-f','/dev/null')
        created.append(TOOL)
        tool_inspect=json.loads(docker('inspect',TOOL))[0]
        actual_inspect=json.loads(docker('inspect',ACTUAL))[0]
        assert tool_inspect['HostConfig']['NetworkMode']=='container:'+actual_inspect['Id']
        assert not tool_inspect['HostConfig']['Privileged'] and not tool_inspect['HostConfig']['PortBindings'] and not tool_inspect['Mounts']
        result['cliRuntime']={'image':tool_inspect['Image'],'entrypoint':'tail; no Storage service started','network':'same isolated namespace as '+ACTUAL}
        if VM:run(VM+['mkdir','-p',vmroot])
        for name in ['supabase','supabase-go']:
            path=str(cli_dir/name)
            if VM:
                run(['/opt/homebrew/bin/limactl','copy',path,'nutrition-j3:'+vmroot+'/'+name]);path=vmroot+'/'+name
            docker('cp',path,TOOL+':/tmp/'+name)
        docker('exec',TOOL,'chmod','700','/tmp/supabase','/tmp/supabase-go')
        version=docker('exec',TOOL,'/tmp/supabase','--version').strip();assert version=='2.116.0'
        result['cli']={'version':version,'supabaseSha256':sha((cli_dir/'supabase').read_bytes()),
          'supabaseGoSha256':sha((cli_dir/'supabase-go').read_bytes()),'connection':'fixed container loopback only','platformPackage':'@supabase/cli-linux-arm64-musl@2.116.0','lockfileIntegrityVerified':True}
        result['cliHelp']={command:docker('exec',TOOL,'/tmp/supabase',*command.split(),'--help')
          for command in ['migration up','db push']}
        for n in [46,47,48]:
            package=root/('prefix-'+str(n));guard_call('materializePrefix',str(source),str(package),n)
            guard_call('assertPrefix',str(package),n)
            manifest=json.loads((package/'prefix-manifest.json').read_text());save('prefix-'+str(n)+'.json',manifest)
            if VM:
                # A tar transfer avoids any dependency on a shared host mount.
                import tarfile
                archive=root/('prefix-'+str(n)+'.tar')
                with tarfile.open(archive,'w') as t:
                    for path in sorted(package.rglob('*')):
                        if path.is_file():t.add(path,arcname=str(path.relative_to(package)))
                run(['/opt/homebrew/bin/limactl','copy',str(archive),'nutrition-j3:'+vmroot+'/'+archive.name])
                run(VM+['mkdir',vmroot+'/prefix-'+str(n)])
                run(VM+['tar','-xf',vmroot+'/'+archive.name,'-C',vmroot+'/prefix-'+str(n)])
                docker('cp',vmroot+'/prefix-'+str(n),TOOL+':/tmp/prefix-'+str(n))
            else:docker('cp',str(package),TOOL+':/tmp/prefix-'+str(n))
            if n>46:
                guard_call('assertBoundary',ledger(ACTUAL),n-1)
                old_cols=columns(ACTUAL);old_rows=rows(ACTUAL,old_cols)
            cli=['exec',TOOL,'/tmp/supabase','--workdir','/tmp/prefix-'+str(n),'--yes','--agent','no']
            url='postgresql://postgres:phased-local-synthetic@127.0.0.1:5432/postgres?sslmode=disable'
            # The URL is a constant inside the isolated database namespace.
            # It is never supplied by a user, env file or linked project.
            p=subprocess.run(VM+['docker',*cli,'db','push','--db-url',url,'--skip-vault','--dry-run'],text=True,capture_output=True,timeout=120)
            assert p.returncode==0,p.stderr[-1600:]
            dry=p.stdout+p.stderr
            pending=sorted(set(re.findall(r'\d{14}_[a-zA-Z0-9_]+\.sql',dry)))
            wanted=[entry['filename'] for entry in json.loads((source/'docs/evidence/nutrition-usda-full35-app-atomic-persistence-002/migration-inventory.json').read_text())['migrations'][(n-1 if n>46 else 0):n]]
            assert pending==wanted,(pending,wanted)
            applied=docker(*cli,'migration','up','--db-url',url)
            guard_call('assertBoundary',ledger(ACTUAL),n)
            # Independently replay original SQL for an expected catalog. This
            # reference is not evidence of CLI execution; ACTUAL above is.
            if n==46:
                db(REFERENCE,'create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);')
                paths=sorted((source/'supabase/migrations').glob('*.sql'))[:46]
            else:paths=sorted((source/'supabase/migrations').glob('*.sql'))[n-1:n]
            for path in paths:
                sql=path.read_text();v,name=path.stem.split('_',1)
                db(REFERENCE,'begin;'+sql+"\ninsert into supabase_migrations.schema_migrations values('%s',array[$phased$%s$phased$],'%s');commit;"%(v,sql,name))
            observed=snapshot(ACTUAL);expected=snapshot(REFERENCE)
            expected_hash=schema_hash(expected);observed_hash=schema_hash(observed)
            guard_call('assertInstalledFingerprint',expected_hash,observed_hash)
            (EVIDENCE/('local-'+str(n)+'.json.gz')).write_bytes(gzip.compress(canonical(observed).encode(),mtime=0))
            if n>46:guard_call('assertUnchangedRows',old_rows,rows(ACTUAL,old_cols))
            if n==46:
                # Reuse exactly the reviewed fixture constructor, omitting v2.
                with zipfile.ZipFile(EVIDENCE/'qualification-002.zip') as z:
                    seed=z.read(next(x for x in z.namelist() if x.endswith('/seed.cjs'))).decode()
                seed=seed.replace('/private/tmp/nutrition-b1-002/source',str(source))
                seed=seed.replace('/private/tmp/nutrition-b1-002/fixture.sql',str(root/'fixture.sql'))
                seed=seed.replace('/private/tmp/nutrition-b1-002/fixture-metadata.json',str(root/'fixture-metadata.json'))
                seed=seed.replace('nutrition-b1-002-pg',ACTUAL)
                seed=seed.replace('/Users/maor/Documents/Codex/2026-04-28/github-plugin-github-openai-curated-you/node_modules/typescript',str(REPO/'node_modules/typescript'))
                if not VM:seed=seed.replace("'/opt/homebrew/bin/limactl',['shell','nutrition-j3','--','docker',","'docker',[")
                seed_path=root/'seed.cjs';seed_path.write_text(seed);run(['node',str(seed_path)])
                db(ACTUAL,"update public.foods set source_id=(select id from public.food_sources where code='user_custom') where owner_user_id is not null;")
            public_counts=db(ACTUAL,"select (select count(*) from public.foods where is_public),(select count(*) from public.food_nutrients n join public.foods f on f.id=n.food_id where f.is_public);")
            assert public_counts=='353|1199'
            assert db(ACTUAL,"select count(*) from ingestion.nutrient_mapping_versions where version_code='usda-foundation-full35-direct-v2';")=='0'
            if n==48:
                result['atomicAuthority']=atomic_authority(ACTUAL,observed)
            result['boundaries'].append({'history':n,'schemaFingerprint':observed_hash,'independentReferenceFingerprint':expected_hash,
              'exactLedger':ledger(ACTUAL),'dryRunOutput':dry,'applyOutput':applied,'originalRowsUnchanged':n>46,
              'publicFoods':353,'publicScalars':1199,'mappingV2Present':False})
            print('PASS exact CLI prefix '+str(n),flush=True)
        # Two real drift negatives supplement pre-command package/target tests.
        good=schema_hash(snapshot(ACTUAL))
        db(ACTUAL,'create function public.phased_local_probe_only() returns integer language sql as $$ select 1 $$;')
        assert_throws('assertInstalledFingerprint',good,schema_hash(snapshot(ACTUAL)))
        db(ACTUAL,'drop function public.phased_local_probe_only();')
        assert schema_hash(snapshot(ACTUAL))==good
        cols=columns(ACTUAL);before=rows(ACTUAL,cols)
        changed=json.loads(db(ACTUAL,"begin;update public.profiles set display_name='Local drift probe' where id='"+OWNER+"';"+rows_sql(cols)+'rollback;'))
        assert_throws('assertUnchangedRows',before,changed);assert rows(ACTUAL,cols)==before
        result['negativeGuards']=['installed object drift rejected','same-count owner row mutation rejected and rolled back']
        result['result']='PASS';save('cli-qualification.json',result)
    finally:
        for container in reversed(created):docker('stop',container)
        if VM:run(VM+['rm','-rf',vmroot])
        shutil.rmtree(root)

if __name__=='__main__':main()
