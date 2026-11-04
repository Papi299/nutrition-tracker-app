#!/usr/bin/env python3
"""Catalog packet syntax/coverage validation only; NOT recovery qualification.

Fixed cached local image, isolated network, synthetic credentials, no URL input.
No observed Production-profile transformation or encrypted checkpoint is run.
"""
import argparse,hashlib,json,pathlib,subprocess,sys,time,uuid
if not __debug__:
    raise SystemExit('Assertions must remain enabled.')
REPO=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=pathlib.Path,required=True,help='New local output directory; existing paths are refused.')
OUT=parser.parse_args().output.absolute()
if OUT.exists() or OUT.is_symlink():
    raise SystemExit('Refusing to replace an existing output path.')
OUT.mkdir(mode=0o700,parents=True)
VM=['/opt/homebrew/bin/limactl','shell','nutrition-j3','--'] if sys.platform=='darwin' else []
NAME='nutrition-profile-004-catalog'
PG='sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518'
AUTH='sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232'
nonce=str(uuid.uuid4())
def run(args,body=None,timeout=120):
    p=subprocess.run(args,input=body,text=True,capture_output=True,timeout=timeout)
    if p.returncode:
        raise RuntimeError('Local validation command failed: '+p.stderr[-1400:])
    return p.stdout
def docker(*args,body=None,timeout=120):return run(VM+['docker',*args],body,timeout)
def db(sql,user='postgres'):
    assert user in ['postgres','supabase_admin']
    return docker('exec','-i',NAME,'psql','-U',user,'-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1',body=sql).strip()
def digest():
    sql=docker('exec',NAME,'pg_dump','-U','postgres','--schema-only','-n','public','-n','private','-n','ingestion','-n','auth')
    lines=[s for s in sql.splitlines() if not s.startswith(('\\restrict','\\unrestrict','--'))]
    return hashlib.sha256('\n'.join(lines).encode()).hexdigest()
def walk(value):
    if isinstance(value,dict):
        if 'complete' in value:assert value['complete'],value
        for v in value.values():walk(v)
    elif isinstance(value,list):
        for v in value:walk(v)
report={'scope':'LOCAL_CATALOG_PACKET_VALIDATION_ONLY','recoveryQualified':False,'profileReconstructed':False,
 'imageId':PG,'authDdlImageId':AUTH,'network':'none','boundaries':[],'nonce':nonce}
inventory=json.loads((REPO/'docs/evidence/nutrition-usda-full35-app-atomic-persistence-002/migration-inventory.json').read_text())['migrations']
canonical=[{k:e[k] for k in ['filename','ordinal','predecessor','sha256','version']} for e in inventory]
assert hashlib.sha256(json.dumps(canonical,separators=(',',':')).encode()).hexdigest()=='4bd4dba279ddc8b2a5f64a8ff62ba1b0074fb5ffda4507a3a01efd13301bb563'
paths=sorted((REPO/'supabase/migrations').glob('*.sql'))
assert len(paths)==48 and len(inventory)==48
assert all(path.name==entry['filename'] and hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'] for path,entry in zip(paths,inventory))
created=False
try:
    assert NAME not in docker('ps','-a','--format','{{.Names}}').splitlines()
    for image in [PG,AUTH]:assert json.loads(docker('image','inspect',image))[0]['Id']==image
    docker('run','--pull=never','-d','--rm','--name',NAME,'--network','none','--label','nutrition.profile004='+nonce,
      '--shm-size=256m','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_PASSWORD=profile-004-local-synthetic',PG)
    created=True
    for _ in range(100):
        try:docker('exec',NAME,'pg_isready','-h','127.0.0.1');break
        except RuntimeError:time.sleep(.2)
    else:raise RuntimeError('Local fixture did not become ready.')
    ins=json.loads(docker('inspect',NAME))[0]
    assert ins['Image']==PG and ins['HostConfig']['NetworkMode']=='none'
    assert not ins['HostConfig']['Privileged'] and not ins['HostConfig']['PortBindings']
    assert all(m['Type']=='tmpfs' for m in ins['Mounts'])
    assert ins['Config']['Labels']['nutrition.profile004']==nonce
    docker('run','--pull=never','--rm','--network','container:'+NAME,'-e','GOTRUE_DB_DRIVER=postgres',
      '-e','GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:profile-004-local-synthetic@127.0.0.1:5432/postgres',
      '-e','GOTRUE_JWT_SECRET=profile-004-local-synthetic-only','-e','GOTRUE_SITE_URL=http://127.0.0.1',
      '-e','API_EXTERNAL_URL=http://127.0.0.1',AUTH,'auth','migrate')
    db('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);')
    packet=(REPO/'docs/nutrition-usda-full35-stage6/recovery-profile-read-only-packet.sql').read_text()
    report['packetSha256']=hashlib.sha256(packet.encode()).hexdigest()
    for index,(path,entry) in enumerate(zip(paths,inventory),1):
        assert path.name==entry['filename'] and hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
        sql=path.read_text();version,name=path.stem.split('_',1)
        assert '$profile004$' not in sql
        db("begin;"+sql+"\ninsert into supabase_migrations.schema_migrations values ('%s',array[$profile004$%s$profile004$],'%s');commit;"%(version,sql,name))
        if index not in [46,47,48]:continue
        before=digest();started=time.monotonic();results=[json.loads(s) for s in db(packet).splitlines()]
        assert [r['query_id'] for r in results]==['R%02d'%n for n in range(1,8)]
        assert len({r['snapshot_at'] for r in results})==1
        for r in results:
            assert r['read_only']=='on' and r['statement_timeout']=='5s' and r['lock_timeout']=='1s'
            assert r['byte_limit_ok'];walk(r)
        assert digest()==before,'Catalog dump changed across the read-only packet.'
        ledger=sorted(results[-1]['payload']['ledger']['rows'],key=lambda r:r['ordinal'])
        assert [r['version'] for r in ledger]==[e['version'] for e in inventory[:index]]
        result={'history':index,'result':'PASS_PACKET_ONLY','elapsedSeconds':round(time.monotonic()-started,3),
          'sameReadOnlySnapshot':True,'schemaDumpUnchanged':True,'ledgerVerified':True,
          'queries':[{'id':r['query_id'],'outputBytes':r['output_bytes'],
            'groups':{k:v['total'] for k,v in r['payload'].items()}} for r in results]}
        report['boundaries'].append(result)
        # Synthetic metadata only. No passwords, connection strings or data rows.
        (OUT/('local-packet-'+str(index)+'.json')).write_text(json.dumps(results,indent=2)+'\n')
        print('PASS local packet on stock history',index,flush=True)
    # Local privacy/limit negatives are packet tests, never profile qualification.
    sentinel='PROFILE004_LOCAL_REDACTION_SENTINEL'
    synthetic_name='profile004 identifier@invalid'
    db("create role \""+synthetic_name+"\" nologin noinherit;alter role authenticated set app.profile_secret_probe='"+sentinel+"';",user='supabase_admin')
    redacted=db(packet)
    assert sentinel not in redacted and synthetic_name not in redacted
    rs=[json.loads(s) for s in redacted.splitlines()]
    rr=rs[0]['payload']['roles']['rows']
    assert any(r['name'].startswith('REDACTED_ROLE_SHA256:') and not r['identity_complete'] for r in rr)
    auth=next(r for r in rr if r['name']=='authenticated')
    assert auth['settings']['unsupported_count']>0
    assert any(s['key']=='app.profile_secret_probe' and s['value'] is None and not s['value_available'] for s in auth['settings']['entries'])
    db('alter role authenticated reset app.profile_secret_probe;drop role \"'+synthetic_name+'\";',user='supabase_admin')
    capped=[json.loads(s) for s in db(packet.replace('2097152','1')).splitlines()]
    assert all(not r['byte_limit_ok'] and r['payload'] is None for r in capped)
    row_packet=packet.replace("'row_limit',256","'row_limit',1").replace('count(*)<=256','count(*)<=1')
    row_capped=[json.loads(s) for s in db(row_packet).splitlines()]
    assert not row_capped[0]['payload']['roles']['complete'] and row_capped[0]['payload']['roles']['rows']==[]
    report['packetNegatives']={'unknownSettingValueRedacted':True,'nonstandardRoleNameRedacted':True,'byteOverflowExplicitAndPayloadWithheld':True,'rowOverflowExplicitAndRowsWithheld':True}
    report['result']='PASS_CATALOG_PACKET_ONLY'
finally:
    if created:
        inspect=json.loads(docker('inspect',NAME))[0]
        assert inspect['Config']['Labels']['nutrition.profile004']==nonce
        docker('stop',NAME)
        report['containerRemoved']=NAME not in docker('ps','-a','--format','{{.Names}}').splitlines()
    (OUT/'local-packet-validation.json').write_text(json.dumps(report,indent=2)+'\n')
