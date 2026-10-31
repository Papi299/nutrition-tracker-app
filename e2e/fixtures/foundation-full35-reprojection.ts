// Hand-authored synthetic values and UUIDs. No Production identity inventory or
// USDA archive is imported into this disposable database fixture.
import { readFileSync } from "node:fs";
import { fingerprintJson } from "../../ingestion/usda/foundation/canonical-json";
import { parseFoundationArchive } from "../../ingestion/usda/foundation/parser";
import { normalizeFoundationRecord } from "../../ingestion/usda/foundation/normalization";
import { normalizeFoundationFull35Record } from "../../ingestion/usda/foundation/full35/normalization";
import { fingerprintFull35IdentitySet } from "../../ingestion/usda/foundation/full35/report";
import { full35Mapping, full35MappingHash } from "../../ingestion/usda/foundation/full35/mapping";
import { foundationNutrientMappingHash } from "../../ingestion/usda/foundation/nutrient-mapping";
import { syntheticNutrient } from "../../tests/fixtures/foundation-full35";

export const fixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const fixtureHash = (s: string) => fingerprintJson({synthetic_only:s});
export const sqlJson = (v: unknown) => `'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export const mappingId = fixtureId(999900);
export const excludedIds = ["2727566","2727567","2727568","2727569","2727570","2727571","2727575","2727576","2747656","2747673"];

export function syntheticReprojectionRecords() {
  const lines = readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/coverage.csv","utf8").trim().split(/\r?\n/);
  const columns=lines[0].split(",");
  const coverage=Object.fromEntries(lines.slice(1).map(line=>{
    const row=Object.fromEntries(line.split(",").map((v,i)=>[columns[i],v]));
    return [row.code,row];
  }));
  const raws=Array.from({length:353},(_,i)=>{
    const foodNutrients=full35Mapping.mappings.flatMap((target,index)=>{
      if(target.classification!=="direct") return [];
      const count=Number(coverage[target.application_nutrient_code].present);
      const position=(i+index*13)%353;
      if(position>=count) return [];
      const zero=position<Number(coverage[target.application_nutrient_code].explicit_zero);
      const calculated=!zero && position-Number(coverage[target.application_nutrient_code].explicit_zero)<Number(coverage[target.application_nutrient_code].source_calculated);
      const amount=zero?0:Number(`${i+1}.${String(index+1).padStart(3,"0")}`);
      const unit=target.application_unit==="ug"?"µg":target.application_unit;
      const source=target.sources[0];
      const item=syntheticNutrient(Number(source.id),source.name,unit,amount);
      item.foodNutrientDerivation={code:calculated?"NC":"A",description:"Synthetic source derivation"};
      if(target.application_nutrient_code==="energy_kcal") {
        const general={...item,nutrient:{id:2047,name:"Energy (Atwater General Factors)",unitName:"kcal"}};
        return position<191?[item,general]:[general];
      }
      return [item];
    });
    return {foodClass:"FinalFood",description:`Synthetic reprojection food ${i+1}`,fdcId:9900001+i,
      dataType:"Foundation",publicationDate:"4/30/2026",ndbNumber:9901001+i,foodNutrients,foodPortions:[]};
  });
  const archive=parseFoundationArchive(JSON.stringify({FoundationFoods:raws}));
  const identities=archive.records.map((r,i)=>({fdc_id:String(r.raw.fdcId),source_record_id:fixtureId(i*3+1),
    source_version_id:fixtureId(i*3+2),raw_content_sha256:r.rawContentSha256}));
  return {archive,identities,legacy:archive.records.map(r=>normalizeFoundationRecord(r))};
}

export function installSyntheticBaseline(query:(sql:string)=>string) {
  const fixture=syntheticReprojectionRecords();
  const manifest={contract_version:"source-release-manifest/v1",source_code:"usda",dataset_code:"usda_fdc_foundation",
    distributor_code:"usda_fdc_direct",transformation_code:null,original_release_identifier:"synthetic-full35-reprojection-001",
    transformation_release_identifier:null,publication_date:"2026-04-30",acquisition_method:"official_bulk_download",
    official_url:"https://fdc.nal.usda.gov/synthetic-full35",authorized_delivery_url:"https://fdc.nal.usda.gov/synthetic.zip",
    license_identifier:"CC0-1.0",attribution:"Cite USDA FoodData Central and retain the applicable release citation.",file_format:"json",
    schema_contract_version:"usda-fdc-foundation-json/v1",archive_name:"synthetic.zip",sha256:fixtureHash("archive"),
    compressed_size:1024,uncompressed_size:4096,approval_reference:"synthetic-local-only",reject_policy_version:"synthetic-reject/v1"};
  const releaseId=query(`select ingestion.register_source_release(${sqlJson(manifest)});`);
  const release=JSON.parse(query(`select jsonb_build_object('manifest_fingerprint',manifest_fingerprint,'dataset_id',dataset_id,'sha256',sha256) from ingestion.source_releases where id='${releaseId}';`));
  const source={source_release_id:releaseId,manifest_fingerprint:release.manifest_fingerprint,
    archive_sha256:release.sha256,json_sha256:fixtureHash("synthetic-json"),accepted_identity_set_hash:fingerprintFull35IdentitySet(fixture.identities)};
  const records=fixture.archive.records.map((record,i)=>({record,candidate:normalizeFoundationFull35Record(record,source,fixture.identities[i])}));
  const payload=records.map((r,i)=>({raw:r.record.raw,candidate:r.candidate,legacy:fixture.legacy[i].candidate,
    food_id:fixtureId(i*3+3),...fixture.identities[i]}));
  const h=fixtureHash("initial-history");
  query(`begin;
    create temporary table full35_fixture as select value p from jsonb_array_elements(${sqlJson(payload)});
    create temporary table full35_context(run_id uuid,receipt_id uuid,validation_id uuid,approval_id uuid);
    insert into full35_context values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
    insert into ingestion.import_runs(id,source_release_id,logical_run_fingerprint,attempt_number,importer_contract_version,
      nutrient_mapping_version_id,operator_execution_identity,approval_reference,current_state,completed_at,source_count,
      accepted_count,rejected_count,inserted_count,run_purpose,lifecycle_environment,parser_contract_version,lifecycle_policy_version)
    select run_id,'${releaseId}','${h}',1,'usda-foundation-importer/v2',
      (select id from ingestion.nutrient_mapping_versions where version_code='usda-foundation-mvp-v1'),
      'synthetic-initial-operator','synthetic-initial-approval','completed',now(),363,353,10,353,
      'initial_promotion','local','usda-fdc-foundation-json/v1','foundation-initial-promotion/v1' from full35_context;
    insert into ingestion.import_run_events(import_run_id,event_sequence,previous_state,next_state,operator_execution_identity,reason)
      select run_id,1,null,'created','synthetic-initial-operator','synthetic created' from full35_context;
    insert into ingestion.import_run_events(import_run_id,event_sequence,previous_state,next_state,operator_execution_identity,reason)
      select run_id,2,'promoting','completed','synthetic-initial-operator','synthetic completed' from full35_context;
    insert into ingestion.source_records(id,dataset_id,concept_key)
      select (p->>'source_record_id')::uuid,'${release.dataset_id}',p->'candidate'->>'concept_key' from full35_fixture;
    insert into ingestion.source_record_versions(id,source_record_id,source_release_id,upstream_version_key,content_sha256,
      source_status,publication_date,raw_evidence_reference)
      select (p->>'source_version_id')::uuid,(p->>'source_record_id')::uuid,'${releaseId}',p->'candidate'->>'upstream_version_key',
      p->>'raw_content_sha256','active','2026-04-30','synthetic:'||(p->>'fdc_id') from full35_fixture;
    insert into public.foods(id,owner_user_id,source_id,source_food_id,food_type,name,brand_name,locale,serving_size,
      serving_unit,data_quality,is_public,is_archived,custom_nutrient_basis)
      select (p->>'food_id')::uuid,null,(select id from public.food_sources where code='usda'),p->'candidate'->>'concept_key',
      'generic',p->'candidate'->>'name',null,'en',null,null,'imported',true,false,null from full35_fixture;
    insert into ingestion.food_source_links(food_id,source_record_id,link_role,review_status,effective_import_run_id,review_reason,reviewed_by,reviewed_at)
      select (p->>'food_id')::uuid,(p->>'source_record_id')::uuid,'primary','approved',run_id,'synthetic initial','Synthetic approver',now()
      from full35_fixture cross join full35_context;
    insert into public.food_nutrients(food_id,nutrient_id,amount,basis)
      select (p->>'food_id')::uuid,n.id,(s.value->>'value')::numeric,'per_100g'
      from full35_fixture cross join lateral jsonb_each(p->'legacy'->'nutrients') s
      join public.nutrients n on n.code=s.key where s.value->>'semantic'<>'missing';
    insert into ingestion.food_nutrient_evidence(food_nutrient_id,source_record_version_id,mapping_version_id,source_nutrient_id,
      original_value,original_unit,original_basis,value_kind,source_semantic,derivation_code,derivation_description)
      select n.id,(p->>'source_version_id')::uuid,(select id from ingestion.nutrient_mapping_versions where version_code='usda-foundation-mvp-v1'),
      s.value->>'source_nutrient_id',n.amount,s.value->>'source_unit','per_100g',s.value->>'semantic',s.value->>'semantic',
      s.value->>'derivation_code',s.value->>'derivation_description' from full35_fixture
      cross join lateral jsonb_each(p->'legacy'->'nutrients') s join public.nutrients dictionary on dictionary.code=s.key
      join public.food_nutrients n on n.food_id=(p->>'food_id')::uuid and n.nutrient_id=dictionary.id;
    insert into ingestion.foundation_validation_receipts(id,import_run_id,source_release_id,reject_allowance_id,target_environment,
      manifest_fingerprint,schema_contract_version,schema_contract_hash,importer_contract_version,mapping_version,mapping_hash,
      reject_policy_version,report_fingerprint,accepted_set_fingerprint,rejected_set_fingerprint,warning_set_fingerprint,
      source_count,accepted_count,rejected_count,warning_count,reject_category_counts,receipt_fingerprint)
      select validation_id,run_id,'${releaseId}',null,'local','${source.manifest_fingerprint}','usda-fdc-foundation-json/v1','${h}',
      'usda-foundation-importer/v2','usda-foundation-mvp-v1','${foundationNutrientMappingHash}','synthetic-reject/v1','${h}',
      '${h}','${h}','${h}',363,353,10,0,'{"negative_target_value":10}','${h}' from full35_context;
    insert into ingestion.foundation_promotion_approvals(id,validation_receipt_id,target_environment,approver_identity,
      approval_reference,approval_timestamp,expires_at,promotion_policy_version,approval_contract,approval_fingerprint)
      select approval_id,validation_id,'local','Synthetic initial approver','synthetic-initial',now(),now()+interval '1 day',
      'foundation-initial-promotion/v1','{"synthetic_only":true}','${h}' from full35_context;
    insert into ingestion.foundation_promotion_receipts(id,promotion_approval_id,import_run_id,source_release_id,manifest_fingerprint,
      validation_receipt_fingerprint,accepted_set_fingerprint,rejected_set_fingerprint,mapping_version,mapping_hash,inserted_food_count,
      inserted_nutrient_count,inserted_portion_count,inserted_source_record_count,inserted_version_count,inserted_link_count,
      completion_timestamp,promotion_policy_version,receipt_fingerprint)
      select receipt_id,approval_id,run_id,'${releaseId}','${source.manifest_fingerprint}','${h}','${h}','${h}',
      'usda-foundation-mvp-v1','${foundationNutrientMappingHash}',353,1199,0,353,353,353,now(),'foundation-initial-promotion/v1','${h}' from full35_context;
    select ingestion.bootstrap_foundation_lifecycle_baseline(receipt_id) from full35_context;
    insert into ingestion.nutrient_mapping_versions(id,dataset_id,version_code,mapping_owner,content_sha256)
      values('${mappingId}','${release.dataset_id}','usda-foundation-full35-direct-v2','Synthetic mapping reviewer','${full35MappingHash}');
    insert into ingestion.nutrient_source_mappings(mapping_version_id,source_nutrient_id,source_nutrient_name,source_unit,
      application_nutrient_id,application_unit,conversion_classification,source_basis,value_classification,mapping_status,missing_value_policy,explicit_zero_policy)
      select '${mappingId}',s->>'id',s->>'name',case when m->>'application_unit'='ug' then 'µg' else m->>'application_unit' end,
      n.id,n.unit,'source_reported','per_100g','source_reported','supported','preserve_unknown','preserve_zero'
      from jsonb_array_elements(ingestion.foundation_full35_mapping_body_v1()->'mappings') m
      cross join lateral jsonb_array_elements(m->'sources') s join public.nutrients n on n.code=m->>'application_nutrient_code';
    update ingestion.nutrient_mapping_versions set approval_status='approved',approved_at=now(),approval_reference='synthetic-local-only' where id='${mappingId}';
    insert into ingestion.mapping_version_evidence(mapping_version_id,mapping_hash,canonical_mapping,reviewed_commit,approval_reference)
      values('${mappingId}','${full35MappingHash}',ingestion.foundation_full35_mapping_body_v1(),'cd61608d1c8668cd27128b1ef2710becd2057283','synthetic-local-only');
    -- Synthetic owner state is created through the existing versioned APIs.
    insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,raw_app_meta_data,raw_user_meta_data)
      values('00000000-0000-4000-8000-000000999700','authenticated','authenticated','synthetic-full35@example.invalid','',now(),now(),'{}','{}');
    insert into public.profiles(id,display_name,preferred_language)
      values('00000000-0000-4000-8000-000000999700','Synthetic local owner','he');
    insert into public.account_activations(user_id,eligibility_statement_version)
      values('00000000-0000-4000-8000-000000999700','p11e-e001-private-beta-eligibility-v1');
    insert into public.foods(id,owner_user_id,source_id,source_food_id,food_type,name,locale,data_quality,is_public,custom_nutrient_basis)
      values('00000000-0000-4000-8000-000000999705','00000000-0000-4000-8000-000000999700',
        (select id from public.food_sources where code='custom'),'foundation:ndb:9901001','user_custom','Synthetic private food','he','user_provided',false,'per_100g');
    select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000999700',true);
    set local role authenticated;
    create temporary table full35_snapshot_request as select jsonb_build_object('version',1,'values',jsonb_agg(jsonb_build_object(
      'code',m->>'code','amount',case when m->>'code'='sugars_g' then '0'::jsonb
        when m->>'code'='thiamin_mg' then '1.2345'::jsonb else 'null'::jsonb end))) request
      from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) m where m->'coreField'='null'::jsonb;
    select * from public.create_manual_diary_entry_v2('00000000-0000-4000-8000-000000999702','2026-01-15','lunch',
      '00000000-0000-4000-8000-000000000003','Synthetic reprojection food 1',null,100,'g',100,null,2,0,null,
      (select request from full35_snapshot_request));
    select * from public.create_manual_diary_entry('00000000-0000-4000-8000-000000999706','2026-01-15','snack',
      null,'Synthetic frozen v1 diary',null,100,'g',100,null,2,0,null);
    select * from public.persist_saved_meal_v2(null,'Synthetic frozen meal','he',
      jsonb_build_array(jsonb_build_object('item_id',null,'position',1,'food_id','00000000-0000-4000-8000-000000000003',
        'food_name','Synthetic reprojection food 1','brand_name',null,'serving_quantity',100,'serving_unit','g',
        'calories',100,'protein_g',null,'carbohydrates_g',2,'fat_g',0,'notes',null,
        'additional_nutrient_snapshot',(select request from full35_snapshot_request))),null);
    select * from public.persist_recipe_v2(null,'Synthetic frozen recipe','he',2,
      jsonb_build_array(jsonb_build_object('ingredient_id',null,'position',1,'food_id','00000000-0000-4000-8000-000000000003',
        'ingredient_name','Synthetic reprojection food 1','brand_name',null,'quantity',100,'unit','g',
        'calories',100,'protein_g',null,'carbohydrates_g',2,'fat_g',0,'notes',null,
        'additional_nutrient_snapshot',(select request from full35_snapshot_request))),null);
    insert into public.food_favorites(user_id,food_id)
      values('00000000-0000-4000-8000-000000999700','00000000-0000-4000-8000-000000000003');
    insert into public.nutrition_targets(user_id,effective_from,calories,protein_g,carbohydrates_g,fat_g)
      values('00000000-0000-4000-8000-000000999700','2026-01-01',2000,null,250,0),
        ('00000000-0000-4000-8000-000000999700','2026-02-01',2100,100,null,50);
    reset role;

    commit;`);
  return {records,source,datasetId:release.dataset_id as string,releaseId};
}
