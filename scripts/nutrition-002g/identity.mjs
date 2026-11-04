import { approveIdentity, assertEqual, fail } from './contract.mjs';

// An operator's independent identity/channel verification is a precondition,
// never inferred from a matching email or a possession of the encrypted backup.
// This entry point has no hosted adapter, URL argument or production authority.
export async function reconstructIdentities(e,payload,approval,artifactSha256,operatorPublicKey) {
 await e.check('auth');if(e.side!=='target'||e.scope!=='002g')fail('TARGET_IDENTITY');
 approveIdentity(payload,approval,artifactSha256,operatorPublicKey,e.ids.get('db'));
 assertEqual(await e.sql('select count(*) from auth.users;'),'0','TARGET_AUTH_NOT_EMPTY');
 for(const owner of payload.identity.owners) {
  // No source passwords, encrypted credential roots, token columns, metadata,
  // sessions or raw provider rows enter the target. Auth generates the initial
  // random credential. The owner must establish a new one via target recovery.
  const r=await e.api('/admin/users',{method:'POST',bearer:e.admin(),body:{id:owner.id,email:owner.email,email_confirm:true}});
  if(r.status!==200)fail('SAME_UUID_CREATE_HTTP_'+r.status);
  assertEqual(r.body.id,owner.id,'SAME_UUID');
 }
 assertEqual(await e.sql("select count(*) from auth.identities where provider<>'email' or provider_id<>user_id::text;"),'0','IDENTITY_BINDING');
 for(const table of ['sessions','refresh_tokens','one_time_tokens','flow_state','mfa_factors','webauthn_credentials'])
  assertEqual(await e.sql('select count(*) from auth.'+table+';'),'0','SOURCE_AUTHORITY_IMPORTED');
}
