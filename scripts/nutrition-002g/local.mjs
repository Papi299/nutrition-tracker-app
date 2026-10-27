import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, assertLocalDocker, waitUntil } from './process.mjs';
import { AUTH_IMAGE, DB_IMAGE, REST_IMAGE, CLIENT_IMAGE, AUTH_VERSION, assertService, assertEqual, fail, token } from './contract.mjs';

export const LABEL = 'NUTRITION-DIARY-CORRECTNESS-002G';
export function assertOwnedContainer(c,id,image,network,volume,label=LABEL) {
 if(c.Id!==id||c.Config.Image!==image||c.Config.Labels?.['codex.task']!==label||
  c.HostConfig.LogConfig.Type!=='none'||c.Mounts.some(m=>m.Type!=='tmpfs'&&!(volume&&m.Type==='volume'&&m.Name===volume&&m.Destination==='/var/lib/postgresql/data'))||
  Object.keys(c.NetworkSettings.Networks).length!==1||!c.NetworkSettings.Networks[network]||
  Object.values(c.HostConfig.PortBindings??{}).flat().some(p=>p.HostIp!=='127.0.0.1')) fail('RESOURCE_IDENTITY');
}
// Every connection endpoint is derived from a newly created owned resource.
// No hosted URL, external secret or arbitrary source/target selector is accepted.
export class Environment {
 constructor(side,scope='002g') {
  if(!['source','target'].includes(side))fail('SIDE');
  if(!['002g','002i'].includes(scope))fail('SCOPE');
  this.label='NUTRITION-DIARY-CORRECTNESS-'+scope.toUpperCase();
  this.scope=scope;this.side=side;this.prefix='nutrition-'+scope+'-'+side;this.network=this.prefix;this.volume=this.prefix+'-data';
  this.ids=new Map();this.images={db:DB_IMAGE,auth:AUTH_IMAGE,rest:REST_IMAGE,client:CLIENT_IMAGE};
  this.signing=randomBytes(48).toString('base64url');this.dbPassword=randomBytes(32).toString('hex');
  this.key=randomBytes(32).toString('base64url');this.modes={};
 }
 async check(kind) {
  await assertLocalDocker();
  if(!this.ids.has(kind))fail('RESOURCE_NOT_CREATED');
  const c=JSON.parse(await run('docker',['inspect',this.ids.get(kind)]))[0];
  assertOwnedContainer(c,this.ids.get(kind),this.images[kind],this.network,kind==='db'?this.volume:undefined,this.label);
  const n=JSON.parse(await run('docker',['network','inspect',this.networkId]))[0];
  if(n.Id!==this.networkId||n.Name!==this.network||!n.Internal||n.Labels?.['codex.task']!==this.label)fail('NETWORK_IDENTITY');
  if(kind==='db') {
   if(Object.keys(c.HostConfig.PortBindings??{}).length||!c.Mounts.some(m=>m.Type==='volume'&&m.Name===this.volume))fail('DATABASE_ISOLATION');
   await this.checkVolume();
  }
  if(kind==='auth') {
   const env=Object.fromEntries(c.Config.Env.map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
   for(const [k,v] of Object.entries(this.expectedAuthEnv))if(env[k]!==v)fail('AUTH_SETTINGS');
  }
  return c;
 }
 async create(kind,extra,env) {
  const name=this.prefix+'-'+kind;
  if(await run('docker',['ps','-a','--filter',`name=^/${name}$`,'--format','{{.Names}}']))fail('PREEXISTING_RESOURCE');
  const args=['run','-d','--pull=never','--name',name,'--label','codex.task='+this.label,'--network',this.network,
   '--log-driver','none','--memory',kind==='db'?'768m':'256m','--cpus','1'];
  // Linux cannot reopen Node's stdin socket as /dev/stdin. Docker reads this
  // exclusive 0600 file in a fresh 0700 directory; it is never mounted, logged
  // or retained after create, including subprocess failure.
  const directory=mkdtempSync(join(tmpdir(),'nutrition-'+this.scope+'-env-')),file=join(directory,'environment');
  let id;
  try {
   writeFileSync(file,Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});
   id=await run('docker',[...args,'--env-file',file,...extra],{timeoutMs:30000});
  }finally{try{unlinkSync(file);}finally{rmdirSync(directory);}}
  if(!/^[a-f0-9]{64}$/.test(id))fail('AMBIGUOUS_CREATE');this.ids.set(kind,id);
  if(kind==='auth')this.expectedAuthEnv=structuredClone(env);
  await this.check(kind);
 }
 async start() {
  this.phase='DOCKER_CONTEXT';
  await assertLocalDocker();
  // Check the whole namespace before creating any resource, never adopt it.
  this.phase='CONTAINER_NAMESPACE';
  for(const kind of ['db','auth','rest','client'])if(await run('docker',['ps','-a','--filter',`name=^/${this.prefix}-${kind}$`,'--format','{{.Names}}']))fail('PREEXISTING_RESOURCE');
  this.phase='NETWORK_NAMESPACE';
  if(await run('docker',['network','ls','--filter','name=^'+this.network+'$','--format','{{.Name}}']))fail('PREEXISTING_NETWORK');
  this.phase='VOLUME_NAMESPACE';
  if(await run('docker',['volume','ls','--filter','name=^'+this.volume+'$','--format','{{.Name}}']))fail('PREEXISTING_VOLUME');
  this.phase='NETWORK_CREATE';
  this.networkId=await run('docker',['network','create','--internal','--label','codex.task='+this.label,this.network]);
  if(!/^[a-f0-9]{64}$/.test(this.networkId))fail('AMBIGUOUS_NETWORK');
  this.phase='VOLUME_CREATE';
  assertEqual(await run('docker',['volume','create','--label','codex.task='+this.label,this.volume]),this.volume,'VOLUME_CREATE');
  const v=JSON.parse(await run('docker',['volume','inspect',this.volume]))[0];this.volumeCreatedAt=v.CreatedAt;await this.checkVolume();
  this.phase='DATABASE_CREATE';
  await this.create('db',['--mount','type=volume,source='+this.volume+',target=/var/lib/postgresql/data',DB_IMAGE,'postgres','-D','/var/lib/postgresql/data',
   '-c','listen_addresses=*','-c','shared_preload_libraries='],{POSTGRES_PASSWORD:this.dbPassword});
  // The image temporarily runs a Unix-socket-only server during initialization.
  // Wait for the final TCP server before changing roles or launching Auth.
  this.phase='DATABASE_READINESS';
  await waitUntil(async()=>{try{return (await run('docker',['exec',this.ids.get('db'),'pg_isready','-h','127.0.0.1','-p','5432'])).includes('accepting connections')&&await this.sql('select 1;')==='1';}catch{return false;}},60000);
  assertEqual(await this.sql('show server_version_num;'),'170006','POSTGRES_VERSION');
  // Same role-password bootstrap as CLI schema.sql, no provider table DDL.
  this.phase='ROLE_BOOTSTRAP';
  await this.sql(`alter role supabase_auth_admin password '${this.dbPassword}';alter role authenticator password '${this.dbPassword}';`);
  this.phase='CLIENT_CREATE';
  await this.startClient();
  this.phase='AUTH_CREATE';
  await this.startAuth();
  this.phase='READY';
 }
 async startClient() {await this.create('client',[CLIENT_IMAGE,'node','-e','setInterval(()=>{},1000)'],{});}
 async checkVolume() {
  const v=JSON.parse(await run('docker',['volume','inspect',this.volume]))[0];
  if(!this.volumeCreatedAt||v.CreatedAt!==this.volumeCreatedAt||v.Name!==this.volume||v.Driver!=='local'||v.Labels?.['codex.task']!==this.label||Object.keys(v.Options??{}).length)fail('VOLUME_IDENTITY');
 }
 authEnvironment() {
  return {GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://localhost:3000',
   GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgresql://supabase_auth_admin:${this.dbPassword}@${this.prefix}-db:5432/postgres`,
   GOTRUE_SITE_URL:'http://localhost:3000',GOTRUE_URI_ALLOW_LIST:'http://localhost:3000',
   GOTRUE_JWT_SECRET:this.signing,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
   GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:'1800',GOTRUE_DISABLE_SIGNUP:'true',
   GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',
   GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED:'true',
   GOTRUE_MFA_TOTP_ENROLL_ENABLED:'true',GOTRUE_MFA_TOTP_VERIFY_ENABLED:'true',
   GOTRUE_MFA_PHONE_ENROLL_ENABLED:'false',GOTRUE_MFA_PHONE_VERIFY_ENABLED:'false',
   GOTRUE_MFA_WEB_AUTHN_ENROLL_ENABLED:'false',GOTRUE_MFA_WEB_AUTHN_VERIFY_ENABLED:'false',
   GOTRUE_PASSKEY_ENABLED:'false',GOTRUE_DB_MAX_POOL_SIZE:'5',
   GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT:'true',GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY_ID:'fixture',
   GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY:this.key,GOTRUE_SECURITY_DB_ENCRYPTION_DECRYPTION_KEYS:'fixture:'+this.key,
   GOTRUE_RATE_LIMIT_EMAIL_SENT:'100',GOTRUE_RATE_LIMIT_TOKEN_REFRESH:'500',
   GOTRUE_RATE_LIMIT_VERIFY:'500',GOTRUE_RATE_LIMIT_OTP:'500',...this.modes};
 }
 async startAuth() {
  await this.create('auth',[AUTH_IMAGE],this.authEnvironment());
  const c=await this.check('auth');
  if(!c.State.Running)fail('AUTH_START_FAILED');
  this.url='http://'+this.prefix+'-auth:9999';
  await waitUntil(async()=>{try{return (await this.api('/health')).status===200;}catch{return false;}},60000);
  assertService((await this.api('/health')).body.version);
 }
 async remove(kind) {if(this.ids.has(kind)){await this.check(kind);await run('docker',['rm','-f',this.ids.get(kind)]);this.ids.delete(kind);}}
 async restartAuth(modes={}) {
  const allowed=['GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT','GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY_ID',
   'GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY','GOTRUE_SECURITY_DB_ENCRYPTION_DECRYPTION_KEYS'];
  if(Object.keys(modes).some(k=>!allowed.includes(k)))fail('UNAPPROVED_AUTH_SETTINGS');
  await this.remove('auth');this.modes=modes;await this.startAuth();
 }
 async restart(kind) {
  await this.check(kind);await run('docker',['restart',this.ids.get(kind)]);
  if(kind==='auth')await waitUntil(async()=>{try{return(await this.api('/health')).status===200;}catch{return false;}},30000);
  if(kind==='db')await waitUntil(async()=>{try{return(await run('docker',['exec',this.ids.get('db'),'pg_isready','-h','127.0.0.1','-p','5432'])).includes('accepting connections')&&await this.sql('select 1;')==='1';}catch{return false;}},30000);
 }
 async startRest() {
  await this.create('rest',[REST_IMAGE],{
   PGRST_DB_URI:`postgresql://authenticator:${this.dbPassword}@${this.prefix}-db:5432/postgres`,
   PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:this.signing,PGRST_SERVER_PORT:'3000'});
  await this.check('rest');this.restUrl='http://'+this.prefix+'-rest:3000';
  await waitUntil(async()=>{try{return(await this.request(this.restUrl,'/')).status===200;}catch{return false;}},30000);
 }
 async sql(input) {await this.check('db');return run('docker',['exec','-i',this.ids.get('db'),'psql','-XqAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','supabase_admin','-d','postgres'],{input,timeoutMs:30000});}
 async request(url,path,{method='GET',body,bearer}={}) {
  // Never follow redirects to a mail link or a remote origin.
  if(![this.url,this.restUrl].includes(url))fail('HTTP_TARGET');await this.check('client');
  // Internal Docker networks deliberately have no host port access. A pinned
  // task-owned Node client makes HTTP requests within that side's network.
  // Secrets pass through stdin and captured stdout only, never argv or logs.
  const code=`let input='';for await(const chunk of process.stdin)input+=chunk;const q=JSON.parse(input);
   const r=await fetch(q.url+q.path,{method:q.method,redirect:'error',headers:{'Content-Type':'application/json',...(q.bearer?{Authorization:'Bearer '+q.bearer}:{})},body:q.body===undefined?undefined:JSON.stringify(q.body),signal:AbortSignal.timeout(10000)});
   const text=await r.text();let body;try{body=JSON.parse(text);}catch{body=null;}process.stdout.write(JSON.stringify({status:r.status,body}));`;
  return JSON.parse(await run('docker',['exec','-i',this.ids.get('client'),'node','--input-type=module','-e',code],
   {input:JSON.stringify({url,path,method,body,bearer}),timeoutMs:15000}));
 }
 async api(path,options) {await this.check('auth');return this.request(this.url,path,options);}
 async rest(path,options) {await this.check('rest');return this.request(this.restUrl,path,options);}
 admin() {return token(this.signing,{role:'service_role',aud:'authenticated'});}
 async stop() {
  const failures=[];for(const kind of ['rest','auth','client','db'])try{await this.remove(kind);}catch{failures.push(kind);}
  if(this.networkId&&failures.length===0){
   const n=JSON.parse(await run('docker',['network','inspect',this.networkId]))[0];
   if(n.Id!==this.networkId||!n.Internal||n.Labels?.['codex.task']!==this.label||Object.keys(n.Containers??{}).length)fail('CLEANUP_NETWORK_IDENTITY');
   await run('docker',['network','rm',this.networkId]);this.networkId=null;
  }
  if(this.volumeCreatedAt&&failures.length===0){await this.checkVolume();await run('docker',['volume','rm',this.volume]);this.volumeCreatedAt=null;}
  if(failures.length)fail('CLEANUP_FAILED');
 }
}
export { run, AUTH_VERSION };
