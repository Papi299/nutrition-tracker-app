import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LocalDatabase, reject } from './local-postgres.mjs';

export async function verifyLocalOverlay() {
  const manifest=JSON.parse(readFileSync(new URL('../../ops/recovery/nutrition-002c/overlay-v1.json',import.meta.url),'utf8'));
  const db=new LocalDatabase();
  const functions=JSON.parse(await db.sql(`select coalesce(jsonb_agg(jsonb_build_object(
    'name',p.proname,'source',p.prosrc,'definer',p.prosecdef,'owner',r.rolname,'config',p.proconfig) order by p.proname),'[]')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='recovery_ops';`));
  if (functions.length!==manifest.functionDefinitions.length) reject('N002C_OVERLAY_FUNCTION_DRIFT');
  for (const actual of functions) {
    const expected=manifest.functionDefinitions.find(f=>f.name===actual.name);
    if (!expected || createHash('sha256').update(actual.source).digest('hex')!==expected.bodySha256 ||
        actual.definer!==expected.securityDefiner || actual.owner!=='nutrition_recovery_owner' ||
        JSON.stringify(actual.config)!==JSON.stringify(['search_path=""'])) reject('N002C_OVERLAY_FUNCTION_DRIFT');
  }
  if ((await db.sql(`select count(*) from pg_roles where rolname='nutrition_recovery_owner'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit;`))!=='1') reject('N002C_OVERLAY_OWNER_DRIFT');
  if ((await db.sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='recovery_ops' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));`))!=='0' ||
      (await db.sql(`select has_schema_privilege('anon','recovery_ops','USAGE') or has_schema_privilege('authenticated','recovery_ops','USAGE');`))!=='f') reject('N002C_OVERLAY_CLIENT_GRANT_DRIFT');
}
