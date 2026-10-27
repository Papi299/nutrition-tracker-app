import { readFileSync } from 'node:fs';
import { Environment as PriorEnvironment, run } from './local.mjs';
import { CLIENT_IMAGE, root } from './contract.mjs';
import { waitUntil } from './process.mjs';
import { recoveryMail, syntheticAddress } from './mail-sink.mjs';

export const LABEL='NUTRITION-DIARY-CORRECTNESS-002G';
export class Environment extends PriorEnvironment {
 constructor(side,scope='002g'){super(side,scope);this.otpExpiry=3600;}
 async check(kind) {
  const c=await super.check(kind);
  if(Object.keys(c.HostConfig.PortBindings??{}).length)throw Error('N002G_PUBLISHED_PORT');
  return c;
 }
 async startClient() {
  const source=readFileSync(new URL('./mail-sink.mjs',import.meta.url),'utf8');
  const template=readFileSync(new URL('supabase/templates/recovery.html',root),'utf8');
  // Code and reviewed public template are non-secret; no fixture credential is
  // passed in argv. Received mail lives only in this container's process memory.
  await this.create('client',[CLIENT_IMAGE,'node','--input-type=module','-e',source+'\nstartCapture('+JSON.stringify(template)+');'],{});
  await waitUntil(async()=>{try{return(await this.clientHttp('/health')).status===200;}catch{return false;}},10000);
 }
 authEnvironment() {
  return {...super.authEnvironment(),
   GOTRUE_SMTP_HOST:this.prefix+'-client',GOTRUE_SMTP_PORT:'2525',
   GOTRUE_SMTP_ADMIN_EMAIL:'capture@example.invalid',GOTRUE_SMTP_SENDER_NAME:'Disposable capture',
   GOTRUE_SMTP_MAX_FREQUENCY:'1s',GOTRUE_SMTP_LOGGING_ENABLED:'false',
   GOTRUE_MAILER_TEMPLATES_RECOVERY:'http://'+this.prefix+'-client:2527/recovery-template',
   GOTRUE_MAILER_OTP_EXP:String(this.otpExpiry),GOTRUE_MAILER_OTP_LENGTH:'6',
   GOTRUE_URI_ALLOW_LIST:'http://localhost:3000/en/auth/recover/confirm,http://localhost:3000/he/auth/recover/confirm'};
 }
 async clientHttp(path,recipient) {
  if(!['/take','/health'].includes(path)||path==='/take'&&!syntheticAddress(recipient))throw Error('N002G_CAPTURE_TARGET');
  await this.check('client');
  const code=`let s='';for await(const c of process.stdin)s+=c;const q=JSON.parse(s);
   const r=await fetch('http://127.0.0.1:'+q.port+q.path,{method:q.path==='/take'?'POST':'GET',redirect:'error',body:q.path==='/take'?JSON.stringify({recipient:q.recipient}):undefined,signal:AbortSignal.timeout(2000)});
   process.stdout.write(JSON.stringify({status:r.status,text:await r.text()}));`;
  return JSON.parse(await run('docker',['exec','-i',this.ids.get('client'),'node','--input-type=module','-e',code],
   {input:JSON.stringify({port:path==='/take'?2526:2527,path,recipient}),timeoutMs:5000}));
 }
 async recovery(user,locale='en') {
  if(!syntheticAddress(user.email)||!['en','he'].includes(locale))throw Error('N002G_RECOVERY_INPUT');
  const r=await this.api('/recover?redirect_to='+encodeURIComponent('http://localhost:3000/'+locale+'/auth/recover/confirm'),{method:'POST',body:{email:user.email}});
  if(r.status!==200)throw Error('N002G_RECOVER_HTTP_'+r.status);
  let mail;
  await waitUntil(async()=>{const r=await this.clientHttp('/take',user.email);if(r.status===404)return false;if(r.status!==200)throw Error('N002G_MAIL_CAPTURE');mail=JSON.parse(r.text);return true;},10000);
  if(mail.recipient!==user.email)throw Error('N002G_MAIL_RECIPIENT');
  return recoveryMail(mail.raw,user.email);
 }
 async expiry(seconds) {
  if(![2,3600].includes(seconds))throw Error('N002G_EXPIRY_SETTING');
  await this.remove('auth');this.otpExpiry=seconds;await this.startAuth();
 }
}
