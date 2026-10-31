// Optional read-only check of an explicitly supplied, locally held approved ZIP.
// No source file is committed or fetched. UUIDs below are synthetic local bindings.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalizeJson} from '../../ingestion/usda/foundation/canonical-json.ts';
import {parseFoundationArchive} from '../../ingestion/usda/foundation/parser.ts';
import {extractFoundationFull35Json} from '../../ingestion/usda/foundation/full35/archive.ts';
import {normalizeFoundationFull35Record} from '../../ingestion/usda/foundation/full35/normalization.ts';
import {fingerprintFull35IdentitySet} from '../../ingestion/usda/foundation/full35/report.ts';
const [archivePath,container]=process.argv.slice(2);
assert.equal(process.argv.length,4);
assert.match(container,/^supabase_db_full35-reprojection-[a-zA-Z0-9_-]+$/);
const zip=readFileSync(archivePath);
assert.equal(createHash('sha256').update(zip).digest('hex'),'186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a');
const text=extractFoundationFull35Json(zip,'FoodData_Central_foundation_food_json_2026-04-30.json');
assert.equal(createHash('sha256').update(text).digest('hex'),'27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc');
const archive=parseFoundationArchive(text);
const excluded=new Set(['2727566','2727567','2727568','2727569','2727570','2727571','2727575','2727576','2747656','2747673']);
const records=archive.records.filter(r=>!excluded.has(String(r.raw.fdcId))).sort((a,b)=>Number(a.raw.fdcId)-Number(b.raw.fdcId));
assert.equal(records.length,353);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const identities=records.map((r,i)=>({fdc_id:String(r.raw.fdcId),source_record_id:id(i*2+1),source_version_id:id(i*2+2),raw_content_sha256:r.rawContentSha256}));
const source={source_release_id:id(999900),manifest_fingerprint:'ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0',archive_sha256:'186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a',json_sha256:'27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc',accepted_identity_set_hash:fingerprintFull35IdentitySet(identities)};
const literal=value=>`'${value.replaceAll("'","''")}'`;
let present=0,methods=0;
const statements=records.map((record,i)=>{
  const candidate=normalizeFoundationFull35Record(record,source,identities[i]);
  present+=Object.values(candidate.nutrients).filter(n=>n.value!==null).length;
  methods+=candidate.nutrient_evidence.length;
  return `select ingestion.validate_mapping_candidate_v1(${literal(canonicalizeJson(candidate))}::jsonb,${literal(canonicalizeJson(record.raw))});`;
});
execFileSync('docker',['exec','-i',container,'psql','-U','supabase_admin','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:`begin read only;\n${statements.join('\n')}\nrollback;\n`,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(present,6261);assert.equal(methods,6452);
process.stdout.write(JSON.stringify({scope:'Authentic approved source; synthetic local UUID bindings; read-only SQL candidate validation',records:353,present,source_method_records:methods,all_raw_candidates_equal:true})+'\n');
