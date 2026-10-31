-- Full35 same-release contracts. No mapping or public data is registered here.
-- Predecessor: 20261029083108; historical SQL and v1 hash domains are unchanged.

do $$
begin
  if exists (select from pg_catalog.pg_roles where rolname='ingestion_reprojection_definer') then
    raise exception 'unexpected pre-existing reprojection role';
  end if;
  create role ingestion_reprojection_definer nologin noinherit nosuperuser
    nocreatedb nocreaterole noreplication nobypassrls;
end;
$$;
grant ingestion_reprojection_definer, ingestion_lifecycle_definer, ingestion_definer to postgres;
grant usage, create on schema ingestion to ingestion_reprojection_definer;
alter default privileges for role ingestion_reprojection_definer
  revoke execute on functions from public;

-- This closed canonical domain uses exact decimal strings and safe integer
-- counters. It deliberately refuses noninteger JSON numbers; v1 is untouched.
create function ingestion.canonicalize_mapping_json_v1(p_value jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare result text; n numeric;
begin
  case pg_catalog.jsonb_typeof(p_value)
    when 'null' then return 'null';
    when 'boolean' then return p_value::text;
    when 'string' then return p_value::text;
    when 'number' then
      n := (p_value #>> '{}')::numeric;
      if n <> pg_catalog.trunc(n) or pg_catalog.abs(n)>9007199254740991 then
        raise exception using errcode='22023',message='mapping JSON requires safe integer numbers';
      end if;
      return pg_catalog.trunc(n)::text;
    when 'array' then
      select '['||coalesce(pg_catalog.string_agg(
        ingestion.canonicalize_mapping_json_v1(e.value),',' order by e.ordinality),'')||']'
      into result from pg_catalog.jsonb_array_elements(p_value) with ordinality e;
      return result;
    when 'object' then
      select '{'||coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(e.key)::text||':'||
        ingestion.canonicalize_mapping_json_v1(e.value),',' order by e.key collate "C"),'')||'}'
      into result from pg_catalog.jsonb_each(p_value) e;
      return result;
    else raise exception using errcode='22023',message='invalid mapping JSON';
  end case;
end;
$$;
create function ingestion.fingerprint_mapping_json_v1(p_value jsonb)
returns text language sql immutable set search_path='' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    ingestion.canonicalize_mapping_json_v1(p_value),'UTF8')),'hex');
$$;

create function ingestion.foundation_full35_mapping_body_v1()
returns jsonb language sql immutable set search_path='' as $mapping$
  select '{"basis":"per_100g","candidate_contract_version":"foundation-normalized-candidate/v2","contract_version":"foundation-nutrient-mapping/v2","conversion_policy":{"factor":"1","policy":"identity_only_no_synthesis","stored_exact_conversion_factor":null},"dataset_code":"usda_fdc_foundation","derivation_policy":{"application_calculation":"forbidden","other_positive":"source_reported","positive_NC_AS":"source_calculated","zero":"explicit_zero"},"energy_precedence":["2048","2047"],"evidence_requirements":["mapping_version_and_hash","candidate_contract_and_hash","release_manifest_archive_json_hashes","frozen_identity_set_hash","fdc_ndb_source_record_version_identity","original_raw_hash_and_field_path","both_energy_method_records","source_nutrient_id_exact_name_original_unit","exact_source_amount","normalized_unit_and_per_100g_basis","source_semantic_derivation_code_description","original_footnote_and_loq","identity_conversion_factor_null","missing_policy_reason","complete_evidence_set_hash"],"excluded_source_ids":["1008","1062","1050","1085","2033","2000","1329","1330","1331","1105","1104","2066","1110","1111","1112","1113","1183","1184","1185","1177","1186","1187","1190","1235"],"importer_contract_version":"usda-foundation-importer/v3","mappings":[{"application_nutrient_code":"energy_kcal","application_unit":"kcal","classification":"direct","definition":"Source-provided metabolizable energy; specific Atwater factors preferred, general factors fallback. Calories: metabolizable kcal; retain current approved precedence.","excluded_alternatives":"Do not use 1008, kJ 1062, or application macro-energy synthesis.","missing_reason":"source_absent","sources":[{"id":"2048","name":"Energy (Atwater Specific Factors)"},{"id":"2047","name":"Energy (Atwater General Factors)"}]},{"application_nutrient_code":"protein_g","application_unit":"g","classification":"direct","definition":"USDA protein, including nitrogen-based source calculations. Protein mass in g.","excluded_alternatives":"Retain NC/AS derivation; do not recalculate nitrogen.","missing_reason":"source_absent","sources":[{"id":"1003","name":"Protein"}]},{"application_nutrient_code":"carbohydrates_g","application_unit":"g","classification":"direct","definition":"Carbohydrate by difference; includes dietary fiber. Total carbohydrates under existing approved by-difference interpretation.","excluded_alternatives":"1050 carbohydrate by summation is excluded; negative values are not clamped.","missing_reason":"source_absent","sources":[{"id":"1005","name":"Carbohydrate, by difference"}]},{"application_nutrient_code":"fat_g","application_unit":"g","classification":"direct","definition":"USDA total lipid (fat). Total fat mass in g.","excluded_alternatives":"1085 total fat (NLEA) is a distinct alternative and is excluded.","missing_reason":"source_absent","sources":[{"id":"1004","name":"Total lipid (fat)"}]},{"application_nutrient_code":"fiber_g","application_unit":"g","classification":"direct","definition":"USDA reported total dietary fiber aggregate (1079). Dietary fiber mass; initial conservative mapping uses 1079 only.","excluded_alternatives":"2033 AOAC 2011.25 is a method-distinct alternative; review method policy before adding it. Never sum overlapping fiber fields.","missing_reason":"source_absent","sources":[{"id":"1079","name":"Fiber, total dietary"}]},{"application_nutrient_code":"sugars_g","application_unit":"g","classification":"direct","definition":"USDA Sugars, Total aggregate, retaining source analytical or summed derivation. Total sugars mass, excluding a claim about added sugars.","excluded_alternatives":"2000 Total Sugars is a separate dictionary entry; exclude until an explicit equivalence/precedence policy is approved. No application sum of components.","missing_reason":"source_absent","sources":[{"id":"1063","name":"Sugars, Total"}]},{"application_nutrient_code":"added_sugars_g","application_unit":"g","classification":"unavailable","definition":"USDA Sugars, added. Added sugars mass.","excluded_alternatives":"No 1235 records; never infer zero or subtract other sugars.","missing_reason":"unavailable_in_approved_source","sources":[]},{"application_nutrient_code":"saturated_fat_g","application_unit":"g","classification":"direct","definition":"Source-reported total saturated fatty acids aggregate. Saturated fatty acid mass.","excluded_alternatives":"Do not sum individual fatty acids in the application.","missing_reason":"source_absent","sources":[{"id":"1258","name":"Fatty acids, total saturated"}]},{"application_nutrient_code":"monounsaturated_fat_g","application_unit":"g","classification":"direct","definition":"Source-reported total monounsaturated fatty acids aggregate. Monounsaturated fatty acid mass.","excluded_alternatives":"Do not manufacture an aggregate from individual isomers.","missing_reason":"source_absent","sources":[{"id":"1292","name":"Fatty acids, total monounsaturated"}]},{"application_nutrient_code":"polyunsaturated_fat_g","application_unit":"g","classification":"direct","definition":"Source-reported total polyunsaturated fatty acids aggregate. Polyunsaturated fatty acid mass.","excluded_alternatives":"Do not manufacture an aggregate from individual isomers.","missing_reason":"source_absent","sources":[{"id":"1293","name":"Fatty acids, total polyunsaturated"}]},{"application_nutrient_code":"trans_fat_g","application_unit":"g","classification":"direct","definition":"Source-reported total trans fatty acids aggregate. Total trans fatty acid mass.","excluded_alternatives":"1329/1330/1331 are partial aggregates; exclude as substitutes.","missing_reason":"source_absent","sources":[{"id":"1257","name":"Fatty acids, total trans"}]},{"application_nutrient_code":"cholesterol_mg","application_unit":"mg","classification":"direct","definition":"Source-reported cholesterol mass. Cholesterol mass.","excluded_alternatives":"Missing plant-food cholesterol remains unknown; no physiological zero fill.","missing_reason":"source_absent","sources":[{"id":"1253","name":"Cholesterol"}]},{"application_nutrient_code":"sodium_mg","application_unit":"mg","classification":"direct","definition":"Elemental sodium (Na) mass. Sodium mass, not salt mass.","excluded_alternatives":"No NaCl conversion.","missing_reason":"source_absent","sources":[{"id":"1093","name":"Sodium, Na"}]},{"application_nutrient_code":"potassium_mg","application_unit":"mg","classification":"direct","definition":"Elemental potassium (K) mass. Potassium mass.","excluded_alternatives":"Do not use compound mass.","missing_reason":"source_absent","sources":[{"id":"1092","name":"Potassium, K"}]},{"application_nutrient_code":"calcium_mg","application_unit":"mg","classification":"direct","definition":"Elemental calcium (Ca) mass. Calcium mass.","excluded_alternatives":"Do not use compound mass.","missing_reason":"source_absent","sources":[{"id":"1087","name":"Calcium, Ca"}]},{"application_nutrient_code":"iron_mg","application_unit":"mg","classification":"direct","definition":"Elemental iron (Fe) mass. Iron mass.","excluded_alternatives":"No bioavailability or compound conversion.","missing_reason":"source_absent","sources":[{"id":"1089","name":"Iron, Fe"}]},{"application_nutrient_code":"magnesium_mg","application_unit":"mg","classification":"direct","definition":"Elemental magnesium (Mg) mass. Magnesium mass.","excluded_alternatives":"Do not use compound mass.","missing_reason":"source_absent","sources":[{"id":"1090","name":"Magnesium, Mg"}]},{"application_nutrient_code":"phosphorus_mg","application_unit":"mg","classification":"direct","definition":"Elemental phosphorus (P) mass. Phosphorus mass.","excluded_alternatives":"Do not use phosphate mass.","missing_reason":"source_absent","sources":[{"id":"1091","name":"Phosphorus, P"}]},{"application_nutrient_code":"zinc_mg","application_unit":"mg","classification":"direct","definition":"Elemental zinc (Zn) mass. Zinc mass.","excluded_alternatives":"Do not use compound mass.","missing_reason":"source_absent","sources":[{"id":"1095","name":"Zinc, Zn"}]},{"application_nutrient_code":"copper_mg","application_unit":"mg","classification":"direct","definition":"Elemental copper (Cu) mass. Copper mass.","excluded_alternatives":"Preserve low-concentration decimals.","missing_reason":"source_absent","sources":[{"id":"1098","name":"Copper, Cu"}]},{"application_nutrient_code":"manganese_mg","application_unit":"mg","classification":"direct","definition":"Elemental manganese (Mn) mass. Manganese mass.","excluded_alternatives":"Preserve low-concentration decimals.","missing_reason":"source_absent","sources":[{"id":"1101","name":"Manganese, Mn"}]},{"application_nutrient_code":"selenium_ug","application_unit":"ug","classification":"direct","definition":"Elemental selenium (Se) mass. Selenium mass in micrograms.","excluded_alternatives":"JSON µg, CSV UG, app ug denote the same unit; label normalization has factor 1, never 1000.","missing_reason":"source_absent","sources":[{"id":"1103","name":"Selenium, Se"}]},{"application_nutrient_code":"vitamin_a_rae_ug","application_unit":"ug","classification":"direct","definition":"Vitamin A expressed as retinol activity equivalents. Vitamin A in micrograms RAE.","excluded_alternatives":"Exclude retinol-only, carotenoids, IU and amountless 2066 Vitamin A records. Do not infer RAE from a mass label.","missing_reason":"source_absent","sources":[{"id":"1106","name":"Vitamin A, RAE"}]},{"application_nutrient_code":"vitamin_c_mg","application_unit":"mg","classification":"direct","definition":"Vitamin C, total ascorbic acid aggregate. Vitamin C mass in mg under the USDA total-ascorbic-acid definition.","excluded_alternatives":"Retain source definition and derivation.","missing_reason":"source_absent","sources":[{"id":"1162","name":"Vitamin C, total ascorbic acid"}]},{"application_nutrient_code":"vitamin_d_ug","application_unit":"ug","classification":"direct","definition":"Reported vitamin D2 plus D3 mass aggregate. Vitamin D interpreted as D2+D3 mass in micrograms.","excluded_alternatives":"Exclude D4 and 25-hydroxy forms; 1110 IU is unnecessary where 1114 exists.","missing_reason":"source_absent","sources":[{"id":"1114","name":"Vitamin D (D2 + D3)"}]},{"application_nutrient_code":"vitamin_e_mg","application_unit":"mg","classification":"direct","definition":"Vitamin E as alpha-tocopherol. Vitamin E interpreted as alpha-tocopherol, not summed tocopherols.","excluded_alternatives":"Document interpretation; do not add beta/gamma/delta tocopherols or use an untyped IU conversion.","missing_reason":"source_absent","sources":[{"id":"1109","name":"Vitamin E (alpha-tocopherol)"}]},{"application_nutrient_code":"vitamin_k_ug","application_unit":"ug","classification":"held","definition":"Vitamin K1 (phylloquinone); K2 menaquinone-4 and dihydrophylloquinone are separate entries. Current application says Vitamin K without a form-qualified definition.","excluded_alternatives":"No exact total-K equivalence established. Hold import until K1-only use with explicit semantics is approved; never sum incompatible forms.","missing_reason":"semantic_hold","sources":[]},{"application_nutrient_code":"thiamin_mg","application_unit":"mg","classification":"direct","definition":"USDA thiamin mass. Thiamin mass in mg.","excluded_alternatives":"No alternative-form synthesis.","missing_reason":"source_absent","sources":[{"id":"1165","name":"Thiamin"}]},{"application_nutrient_code":"riboflavin_mg","application_unit":"mg","classification":"direct","definition":"USDA riboflavin mass. Riboflavin mass in mg.","excluded_alternatives":"No alternative-form synthesis.","missing_reason":"source_absent","sources":[{"id":"1166","name":"Riboflavin"}]},{"application_nutrient_code":"niacin_mg","application_unit":"mg","classification":"direct","definition":"USDA niacin mass. Niacin mass, excluding tryptophan-derived niacin equivalents.","excluded_alternatives":"Document niacin rather than NE; no tryptophan conversion.","missing_reason":"source_absent","sources":[{"id":"1167","name":"Niacin"}]},{"application_nutrient_code":"pantothenic_acid_mg","application_unit":"mg","classification":"direct","definition":"USDA pantothenic acid mass. Pantothenic acid mass in mg.","excluded_alternatives":"No salt-mass substitution.","missing_reason":"source_absent","sources":[{"id":"1170","name":"Pantothenic acid"}]},{"application_nutrient_code":"vitamin_b6_mg","application_unit":"mg","classification":"direct","definition":"USDA Vitamin B-6 aggregate. Vitamin B6 under the USDA reported aggregate definition.","excluded_alternatives":"Do not add individual vitamers or infer equivalence.","missing_reason":"source_absent","sources":[{"id":"1175","name":"Vitamin B-6"}]},{"application_nutrient_code":"folate_dfe_ug","application_unit":"ug","classification":"unavailable","definition":"Folate expressed as dietary folate equivalents. Folate in micrograms DFE.","excluded_alternatives":"1190 absent; 1177 total folate is not DFE. Separate 1186 folic acid and 1187 food folate inputs are absent.","missing_reason":"unavailable_in_approved_source","sources":[]},{"application_nutrient_code":"vitamin_b12_ug","application_unit":"ug","classification":"direct","definition":"USDA Vitamin B-12 aggregate. Vitamin B12 mass in micrograms.","excluded_alternatives":"Do not substitute unrelated cobalamin activity measures.","missing_reason":"source_absent","sources":[{"id":"1178","name":"Vitamin B-12"}]},{"application_nutrient_code":"choline_mg","application_unit":"mg","classification":"direct","definition":"USDA total choline aggregate. Total choline mass in mg.","excluded_alternatives":"Exclude betaine; do not recompute from choline metabolites.","missing_reason":"source_absent","sources":[{"id":"1180","name":"Choline, total"}]}],"numeric_policy":{"canonical_nonnegative_decimal":true,"evidence_precision":24,"evidence_scale":10,"exact_json_lexeme_round_trip":true,"maximum":"9999999999.9999","public_precision":14,"public_scale":4,"round_to_fit":false,"snapshot_rounding":"outside_importer_final_consumed_boundary_only"},"predecessor_mapping_hash":"a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5","qualifier_policy":{"duplicates":"reject_even_identical","energy":"validate_both_before_selection","explicit_zero":"preserve_derivation_unless_qualified","missing":"absent_eligible_id_only","negative_or_malformed_loq":"malformed_target_nutrient","nonzero_trace":"malformed_target_nutrient","present_without_amount":"malformed_target_nutrient","trace":"positive_loq_or_leading_less_than_on_zero_blocks"},"report_contract_version":"foundation-dry-run-report/v3","specification_revision":"NUTRITION-USDA-FULL35-SPEC-001/1.0-draft","unit_aliases":{"g":["G","g"],"kcal":["KCAL","kcal"],"mg":["MG","mg"],"ug":["UG","ug","µg"]},"version_code":"usda-foundation-full35-direct-v2"}'::jsonb;
$mapping$;

-- Approval of a registry version remains an independently governed operation.
-- The function supplies evidence only and performs no registration.
alter table ingestion.source_record_versions add constraint source_record_versions_mapping_raw_key
  unique(id,source_release_id,content_sha256);
alter table ingestion.nutrient_mapping_versions add constraint nutrient_mapping_versions_mapping_hash_key
  unique(id,content_sha256);

create table ingestion.mapping_version_evidence (
  mapping_version_id uuid primary key references ingestion.nutrient_mapping_versions(id),
  mapping_hash text not null check(mapping_hash='028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c'),
  canonical_mapping jsonb not null check(canonical_mapping=ingestion.foundation_full35_mapping_body_v1()),
  reviewed_commit text not null check(reviewed_commit ~ '^[a-f0-9]{40}$'),
  approval_reference text not null check(pg_catalog.length(approval_reference) between 1 and 200),
  created_at timestamptz not null default pg_catalog.now(),
  unique(mapping_version_id,mapping_hash),
  foreign key(mapping_version_id,mapping_hash) references ingestion.nutrient_mapping_versions(id,content_sha256),
  check(ingestion.fingerprint_mapping_json_v1(canonical_mapping)=mapping_hash)
);

create table ingestion.source_mapping_interpretations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  source_record_version_id uuid not null references ingestion.source_record_versions(id),
  source_release_id uuid not null references ingestion.source_releases(id),
  mapping_version_id uuid not null,
  mapping_hash text not null,
  candidate_contract_version text not null check(candidate_contract_version='foundation-normalized-candidate/v2'),
  candidate_hash text not null check(candidate_hash ~ '^[a-f0-9]{64}$'),
  evidence_set_hash text not null check(evidence_set_hash ~ '^[a-f0-9]{64}$'),
  raw_record_hash text not null check(raw_record_hash ~ '^[a-f0-9]{64}$'),
  candidate_body jsonb not null check(pg_catalog.octet_length(candidate_body::text)<=65536),
  provenance jsonb not null check(pg_catalog.jsonb_typeof(provenance)='object'),
  created_at timestamptz not null default pg_catalog.now(),
  foreign key(source_record_version_id,source_release_id,raw_record_hash) references ingestion.source_record_versions(id,source_release_id,content_sha256),
  foreign key(mapping_version_id,mapping_hash) references ingestion.mapping_version_evidence(mapping_version_id,mapping_hash),
  unique(source_record_version_id,mapping_version_id,candidate_contract_version),
  unique(id,source_record_version_id,mapping_version_id),
  check(candidate_hash=ingestion.fingerprint_mapping_json_v1(candidate_body-'content_fingerprint')),
  check(candidate_body->>'content_fingerprint'=candidate_hash),
  check(candidate_body->>'evidence_set_hash'=evidence_set_hash),
  check(ingestion.fingerprint_mapping_json_v1(candidate_body->'nutrient_evidence')=evidence_set_hash)
);

create table ingestion.mapping_reprojection_plans (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  operation_kind text not null check(operation_kind in ('reprojection','compensation')),
  dataset_id uuid not null references ingestion.source_datasets(id),
  environment text not null check(environment in ('local','production')),
  source_release_id uuid not null,
  mapping_version_id uuid not null references ingestion.mapping_version_evidence(mapping_version_id),
  prior_head_id uuid not null,
  prior_head_version bigint not null check(prior_head_version>0),
  prior_head_hash text not null check(prior_head_hash ~ '^[a-f0-9]{64}$'),
  operator_oid oid not null,
  operator_name text not null,
  retry_token uuid not null,
  plan_body jsonb not null check(pg_catalog.octet_length(plan_body::text)<=33554432),
  plan_hash text not null unique check(plan_hash=ingestion.fingerprint_mapping_json_v1(plan_body)),
  state text not null default 'prepared' check(state in ('prepared','validated','approved','completed','rejected','expired','abandoned')),
  rejected_receipt_id uuid null,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key(source_release_id,dataset_id) references ingestion.source_releases(id,dataset_id),
  foreign key(prior_head_id,dataset_id,environment,prior_head_version,prior_head_hash)
    references ingestion.dataset_projection_heads(id,dataset_id,environment,head_version,dataset_projection_fingerprint),
  unique(id,dataset_id,environment),unique(id,plan_hash),unique(id,retry_token),unique(operator_oid,retry_token),
  check((operation_kind='compensation')=(rejected_receipt_id is not null))
);
create table ingestion.mapping_reprojection_plan_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  plan_id uuid not null references ingestion.mapping_reprojection_plans(id),
  food_id uuid not null references public.foods(id),
  source_record_id uuid not null references ingestion.source_records(id),
  source_version_id uuid not null,
  prior_projection_id uuid not null references ingestion.food_projection_versions(id),
  prior_food_head_version bigint not null check(prior_food_head_version>0),
  item_body jsonb not null check(pg_catalog.octet_length(item_body::text)<=196608),
  item_hash text not null check(item_hash=ingestion.fingerprint_mapping_json_v1(item_body)),
  foreign key(source_version_id,source_record_id) references ingestion.source_record_versions(id,source_record_id),
  unique(plan_id,food_id), unique(plan_id,source_version_id), unique(id,plan_id),unique(id,food_id)
);
create table ingestion.mapping_reprojection_approvals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  plan_id uuid not null unique references ingestion.mapping_reprojection_plans(id),
  plan_hash text not null,
  retry_token uuid not null,
  approver_oid oid not null,
  approver_name text not null,
  approved_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>approved_at),
  approval_body jsonb not null,
  approval_hash text not null unique check(approval_hash=ingestion.fingerprint_mapping_json_v1(approval_body)),
  unique(id,plan_id),unique(id,plan_id,retry_token),
  foreign key(plan_id,retry_token) references ingestion.mapping_reprojection_plans(id,retry_token),
  foreign key(plan_id,plan_hash) references ingestion.mapping_reprojection_plans(id,plan_hash)
);
create table ingestion.mapping_reprojection_receipts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  dataset_id uuid not null,environment text not null,
  plan_id uuid not null unique references ingestion.mapping_reprojection_plans(id),
  approval_id uuid not null unique,
  operator_oid oid not null,
  retry_token uuid not null,
  prior_head_id uuid not null references ingestion.dataset_projection_heads(id),
  resulting_head_id uuid not null references ingestion.dataset_projection_heads(id) deferrable initially deferred,
  receipt_body jsonb not null,
  receipt_hash text not null unique check(receipt_hash=ingestion.fingerprint_mapping_json_v1(receipt_body)),
  completed_at timestamptz not null,
  foreign key(approval_id,plan_id) references ingestion.mapping_reprojection_approvals(id,plan_id),
  foreign key(approval_id,plan_id,retry_token) references ingestion.mapping_reprojection_approvals(id,plan_id,retry_token),
  unique(operator_oid,retry_token),unique(id,dataset_id,environment),unique(id,plan_id),
  foreign key(plan_id,dataset_id,environment) references ingestion.mapping_reprojection_plans(id,dataset_id,environment),
  foreign key(prior_head_id,dataset_id,environment) references ingestion.dataset_projection_heads(id,dataset_id,environment),
  foreign key(resulting_head_id,dataset_id,environment) references ingestion.dataset_projection_heads(id,dataset_id,environment) deferrable initially deferred
);
alter table ingestion.mapping_reprojection_plans add foreign key(rejected_receipt_id)
  references ingestion.mapping_reprojection_receipts(id);
create table ingestion.mapping_reprojection_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_sequence integer not null check(event_sequence>0),
  plan_id uuid not null references ingestion.mapping_reprojection_plans(id),
  actor_oid oid not null,
  prior_state text null,
  next_state text not null,
  event_body jsonb not null,
  event_hash text not null check(event_hash=ingestion.fingerprint_mapping_json_v1(event_body)),
  unique(plan_id,event_sequence),
  created_at timestamptz not null default pg_catalog.now()
);
-- Transaction authority is a protected row, never a caller-set GUC. The executor
-- inserts/removes it in the same transaction. No external role gets table DML.
create table ingestion.mapping_reprojection_execution_context (
  backend_pid integer not null,
  transaction_id xid8 not null,
  plan_id uuid not null references ingestion.mapping_reprojection_plans(id),
  approval_id uuid not null references ingestion.mapping_reprojection_approvals(id),
  primary key(backend_pid,transaction_id)
);
create table ingestion.mapping_reprojection_inserted_rows (
  plan_id uuid not null,
  receipt_id uuid not null references ingestion.mapping_reprojection_receipts(id) deferrable initially deferred,
  plan_item_id uuid not null references ingestion.mapping_reprojection_plan_items(id),
  public_row_id uuid not null,
  food_id uuid not null references public.foods(id),
  nutrient_id uuid not null references public.nutrients(id),
  amount numeric(14,4) not null check(amount>=0),
  basis text not null check(basis='per_100g'),
  row_image jsonb not null,
  primary key(receipt_id,public_row_id),
  unique(receipt_id,food_id,nutrient_id),
  foreign key(receipt_id,plan_id) references ingestion.mapping_reprojection_receipts(id,plan_id) deferrable initially deferred,
  foreign key(plan_item_id,plan_id) references ingestion.mapping_reprojection_plan_items(id,plan_id),
  foreign key(plan_item_id,food_id) references ingestion.mapping_reprojection_plan_items(id,food_id)
);

-- Explicit discriminators leave every historical row's stored hash unchanged.
alter table ingestion.food_projection_versions
  add column projection_contract_version text not null default 'foundation-lifecycle-projection/v1',
  add column source_mapping_interpretation_id uuid null,
  add column mapping_version_id uuid null,
  add column mapping_reprojection_receipt_id uuid null references ingestion.mapping_reprojection_receipts(id) deferrable initially deferred,
  add column projection_body_v2 jsonb null,
  add foreign key(mapping_reprojection_receipt_id,dataset_id,environment) references ingestion.mapping_reprojection_receipts(id,dataset_id,environment) deferrable initially deferred,
  add foreign key(source_mapping_interpretation_id,source_record_version_id,mapping_version_id)
    references ingestion.source_mapping_interpretations(id,source_record_version_id,mapping_version_id),
  add constraint food_projection_versions_contract_check check(
    (projection_contract_version='foundation-lifecycle-projection/v1'
      and source_mapping_interpretation_id is null and mapping_version_id is null
      and mapping_reprojection_receipt_id is null and projection_body_v2 is null)
    or (projection_contract_version='foundation-lifecycle-projection/v2'
      and source_mapping_interpretation_id is not null and mapping_version_id is not null
      and mapping_reprojection_receipt_id is not null and projection_body_v2 is not null
      and prior_food_projection_version_id is not null)),
  drop constraint food_projection_versions_origin_check,
  add constraint food_projection_versions_origin_check check(
    (origin_type='initial_promotion_baseline' and initial_promotion_receipt_id is not null
      and lifecycle_update_receipt_id is null and mapping_reprojection_receipt_id is null)
    or (origin_type='lifecycle_update' and initial_promotion_receipt_id is null
      and lifecycle_update_receipt_id is not null and mapping_reprojection_receipt_id is null)
    or (origin_type in ('mapping_reprojection','mapping_compensation')
      and projection_contract_version='foundation-lifecycle-projection/v2'
      and initial_promotion_receipt_id is null and lifecycle_update_receipt_id is null
      and mapping_reprojection_receipt_id is not null));
-- Existing source/lifecycle uniqueness already permits multiple interpretations;
-- it remains intact. No source-version uniqueness constraint is dropped.
alter table ingestion.food_nutrient_projection_versions
  add column projection_contract_version text not null default 'foundation-lifecycle-projection/v1',
  add column missing_reason text null,
  add column application_unit text null,
  add column evidence_hash text null,
  drop constraint food_nutrient_projection_versions_code_check;

alter table ingestion.food_nutrient_evidence
  add column source_mapping_interpretation_id uuid null references ingestion.source_mapping_interpretations(id),
  add column evidence_body_v2 jsonb null,
  add column evidence_hash_v2 text null,
  add foreign key(source_mapping_interpretation_id,source_record_version_id,mapping_version_id) references ingestion.source_mapping_interpretations(id,source_record_version_id,mapping_version_id);

alter table ingestion.dataset_projection_heads
  add column mapping_reprojection_receipt_id uuid null references ingestion.mapping_reprojection_receipts(id) deferrable initially deferred,
  add column projection_contract_version text not null default 'foundation-lifecycle-projection/v1',
  add foreign key(mapping_reprojection_receipt_id,dataset_id,environment) references ingestion.mapping_reprojection_receipts(id,dataset_id,environment) deferrable initially deferred,
  drop constraint dataset_projection_heads_origin_check,
  add constraint dataset_projection_heads_origin_check check(
    (initial_promotion_receipt_id is not null)::integer+
    (lifecycle_update_receipt_id is not null)::integer+
    (mapping_reprojection_receipt_id is not null)::integer=1),
  add constraint dataset_projection_heads_contract_check check(
    (projection_contract_version='foundation-lifecycle-projection/v1' and mapping_reprojection_receipt_id is null)
    or (projection_contract_version='foundation-lifecycle-projection/v2' and mapping_reprojection_receipt_id is not null));
alter table ingestion.food_source_link_events
  add column mapping_dataset_id uuid null,add column mapping_environment text null,
  add column mapping_reprojection_receipt_id uuid null references ingestion.mapping_reprojection_receipts(id) deferrable initially deferred,
  add foreign key(mapping_reprojection_receipt_id,mapping_dataset_id,mapping_environment)
    references ingestion.mapping_reprojection_receipts(id,dataset_id,environment) deferrable initially deferred,
  add foreign key(source_record_id,mapping_dataset_id) references ingestion.source_records(id,dataset_id),
  add constraint food_source_link_events_mapping_origin_check check(
    (event_type in('mapping_reprojected','mapping_compensated') and mapping_reprojection_receipt_id is not null
      and mapping_dataset_id is not null and mapping_environment is not null)
    or (event_type not in('mapping_reprojected','mapping_compensated') and mapping_reprojection_receipt_id is null
      and mapping_dataset_id is null and mapping_environment is null)),
  drop constraint food_source_link_events_type_check,
  drop constraint food_source_link_events_origin_check,
  add constraint food_source_link_events_type_check check(event_type in (
    'initial_link','version_advanced','archived','superseded','reactivated','mapping_reprojected','mapping_compensated')),
  add constraint food_source_link_events_origin_check check(
    (initial_promotion_receipt_id is not null)::integer+
    (lifecycle_update_receipt_id is not null)::integer+
    (mapping_reprojection_receipt_id is not null)::integer=1);
-- Scope new mapping events by receipt, retaining the legacy uniqueness rule.
alter table ingestion.food_source_link_events drop constraint food_source_link_events_version_key;
create unique index food_source_link_events_legacy_version_key
  on ingestion.food_source_link_events(food_id,source_record_version_id,event_type)
  where mapping_reprojection_receipt_id is null;
create unique index food_source_link_events_mapping_version_key
  on ingestion.food_source_link_events(food_id,source_record_version_id,mapping_reprojection_receipt_id)
  where mapping_reprojection_receipt_id is not null;

create function ingestion.mapping_projection_state_body_v1(p_state ingestion.food_nutrient_projection_versions)
returns jsonb language sql immutable set search_path='' as $$
  select case when p_state.projection_state='missing' then pg_catalog.jsonb_build_object(
    'nutrient_code',p_state.nutrient_code,'application_unit',p_state.application_unit,
    'projection_state','missing','missing_reason',p_state.missing_reason)
  else pg_catalog.jsonb_build_object(
    'nutrient_code',p_state.nutrient_code,'application_unit',p_state.application_unit,
    'projection_state','present','basis',p_state.basis,
    'amount',pg_catalog.trim_scale(p_state.amount)::text,
    'source_semantic',p_state.source_semantic,'source_nutrient_id',p_state.source_nutrient_id,
    'source_unit',p_state.source_unit,'derivation_code',p_state.derivation_code,
    'derivation_description',p_state.derivation_description,'evidence_hash',p_state.evidence_hash)
  end;
$$;

create function ingestion.validate_mapping_projection_state_v1()
returns trigger language plpgsql set search_path='' as $$
declare parent ingestion.food_projection_versions; target jsonb;
begin
  select * into strict parent from ingestion.food_projection_versions where id=new.food_projection_version_id;
  if new.projection_contract_version is distinct from parent.projection_contract_version then
    raise exception using errcode='23514',message='mixed projection contract';
  end if;
  if parent.projection_contract_version='foundation-lifecycle-projection/v1' then
    if new.nutrient_code not in ('energy_kcal','protein_g','carbohydrates_g','fat_g')
      or new.missing_reason is not null or new.application_unit is not null or new.evidence_hash is not null then
      raise exception using errcode='23514',message='v1 projection contract is unchanged';
    end if;
    return new;
  end if;
  select m into target from pg_catalog.jsonb_array_elements(
    ingestion.foundation_full35_mapping_body_v1()->'mappings') m
    where m->>'application_nutrient_code'=new.nutrient_code;
  if target is null or new.application_unit is distinct from target->>'application_unit'
    or not exists(select from public.nutrients where id=new.nutrient_id
      and code=new.nutrient_code and unit=new.application_unit) then
    raise exception using errcode='23514',message='invalid v2 nutrient dictionary binding';
  end if;
  if new.projection_state='present' then
    if target->>'classification'<>'direct' or new.missing_reason is not null
      or new.evidence_hash is null or new.evidence_hash !~ '^[a-f0-9]{64}$'
      or not exists(select from pg_catalog.jsonb_array_elements(target->'sources') s
        where s->>'id'=new.source_nutrient_id)
      or not (ingestion.foundation_full35_mapping_body_v1()->'unit_aliases'->new.application_unit ? new.source_unit)
      or new.source_semantic is distinct from (case when new.amount=0 then 'explicit_zero'
        when new.derivation_code in ('NC','AS') then 'source_calculated' else 'source_reported' end) then
      raise exception using errcode='23514',message='invalid v2 present state';
    end if;
  elsif new.evidence_hash is not null or new.missing_reason is null
    or (new.missing_reason is distinct from target->>'missing_reason'
      and not (parent.origin_type='mapping_compensation'
        and new.nutrient_code not in ('energy_kcal','protein_g','carbohydrates_g','fat_g')
        and new.missing_reason='compensated_to_before_image')) then
    raise exception using errcode='23514',message='invalid v2 missing state';
  end if;
  if ingestion.fingerprint_mapping_json_v1(ingestion.mapping_projection_state_body_v1(new))<>new.projection_hash then
    raise exception using errcode='23514',message='v2 state hash mismatch';
  end if;
  return new;
end;
$$;
create trigger food_nutrient_projection_versions_contract
  before insert on ingestion.food_nutrient_projection_versions for each row
  execute function ingestion.validate_mapping_projection_state_v1();

create function ingestion.mapping_projection_body_v2(p_projection_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-projection/v2',
    'dataset_id',p.dataset_id,'environment',p.environment,'food_id',p.food_id,
    'source_record_id',p.source_record_id,'source_record_version_id',p.source_record_version_id,
    'source_release_id',i.source_release_id,'mapping_version_id',p.mapping_version_id,
    'mapping_hash',i.mapping_hash,'raw_record_hash',i.raw_record_hash,
    'candidate_hash',i.candidate_hash,'evidence_set_hash',i.evidence_set_hash,
    'prior_projection',pg_catalog.jsonb_build_object('id',prior.id,
      'contract_version',prior.projection_contract_version,'projection_hash',prior.projection_hash,
      'lifecycle_projection_hash',prior.lifecycle_projection_hash),
    'food_metadata',pg_catalog.jsonb_build_object('name',p.name,'brand_name',p.brand_name,
      'locale',p.locale,'food_type',p.food_type,'data_quality',p.data_quality,
      'is_public',p.is_public,'is_archived',p.is_archived,
      'serving_size',case when p.serving_size is null then null else pg_catalog.trim_scale(p.serving_size)::text end,
      'serving_unit',p.serving_unit),
    'operation_kind',case when p.origin_type='mapping_compensation' then 'compensation' else 'reprojection' end,
    'nutrient_states',(select pg_catalog.jsonb_agg(ingestion.mapping_projection_state_body_v1(s)
      order by s.nutrient_code collate "C") from ingestion.food_nutrient_projection_versions s
      where s.food_projection_version_id=p.id))
  from ingestion.food_projection_versions p
  join ingestion.source_mapping_interpretations i on i.id=p.source_mapping_interpretation_id
  join ingestion.food_projection_versions prior on prior.id=p.prior_food_projection_version_id
  where p.id=p_projection_id;
$$;
create function ingestion.mapping_lifecycle_hash_v2(p_body jsonb)
returns text language sql immutable set search_path='' as $$
  select ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-mapping-lifecycle-envelope/v2',
    'projection_hash',ingestion.fingerprint_mapping_json_v1(p_body),
    'prior_projection',p_body->'prior_projection'));
$$;

-- Version predicates preserve the complete legacy functions and their owners.
drop trigger food_nutrient_projection_versions_initialize_lifecycle_hash on ingestion.food_nutrient_projection_versions;
drop trigger food_projection_versions_verify_lifecycle_hash on ingestion.food_projection_versions;
-- The version predicate calls no privileged helper and cannot be caller-set.
-- The new state validator runs first and binds this value to the parent.
create trigger food_nutrient_projection_versions_initialize_lifecycle_hash
  after insert on ingestion.food_nutrient_projection_versions for each row
  when (new.projection_contract_version='foundation-lifecycle-projection/v1')
  execute function ingestion.initialize_foundation_lifecycle_projection_hash_v1();
create constraint trigger food_projection_versions_verify_lifecycle_hash
  after insert or update on ingestion.food_projection_versions deferrable initially deferred
  for each row when(new.projection_contract_version='foundation-lifecycle-projection/v1')
  execute function ingestion.verify_foundation_lifecycle_projection_hash_v1();

create function ingestion.verify_mapping_projection_v2()
returns trigger language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare p ingestion.food_projection_versions; i ingestion.source_mapping_interpretations;
  prior ingestion.food_projection_versions; body jsonb; state_count bigint; linked_count bigint; present_count bigint;
begin
  select * into strict p from ingestion.food_projection_versions where id=new.id;
  select * into strict i from ingestion.source_mapping_interpretations where id=p.source_mapping_interpretation_id;
  select * into strict prior from ingestion.food_projection_versions where id=p.prior_food_projection_version_id;
  select count(*),count(*) filter(where projection_state='present') into state_count,present_count
    from ingestion.food_nutrient_projection_versions where food_projection_version_id=p.id;
  select count(*) into linked_count from ingestion.food_nutrient_projection_evidence_links l
    join ingestion.food_nutrient_projection_versions s on s.id=l.food_nutrient_projection_version_id
    join ingestion.food_nutrient_evidence e on e.id=l.food_nutrient_evidence_id
    where s.food_projection_version_id=p.id and e.source_mapping_interpretation_id=i.id
      and e.evidence_hash_v2=s.evidence_hash and e.mapping_version_id=p.mapping_version_id
      and e.source_record_version_id=p.source_record_version_id
      and e.mapping_reprojection_receipt_id=p.mapping_reprojection_receipt_id;
  body := ingestion.mapping_projection_body_v2(p.id);
  if state_count<>35 or linked_count<>present_count
    or p.dataset_id<>prior.dataset_id or p.environment<>prior.environment
    or p.food_id<>prior.food_id or p.source_record_id<>prior.source_record_id
    or p.source_record_version_id<>prior.source_record_version_id
    or (pg_catalog.to_jsonb(p)-array['id','prior_food_projection_version_id','origin_type',
      'initial_promotion_receipt_id','lifecycle_update_receipt_id','projection_hash','created_at',
      'normalized_candidate_hash','source_metadata_hash','lifecycle_projection_hash','projection_contract_version',
      'source_mapping_interpretation_id','mapping_version_id','mapping_reprojection_receipt_id','projection_body_v2'])
       is distinct from (pg_catalog.to_jsonb(prior)-array['id','prior_food_projection_version_id','origin_type',
      'initial_promotion_receipt_id','lifecycle_update_receipt_id','projection_hash','created_at',
      'normalized_candidate_hash','source_metadata_hash','lifecycle_projection_hash','projection_contract_version',
      'source_mapping_interpretation_id','mapping_version_id','mapping_reprojection_receipt_id','projection_body_v2'])
    or body->'nutrient_states' is distinct from ingestion.mapping_candidate_states_v1(i.candidate_body,p.origin_type='mapping_compensation')
    or p.projection_body_v2 is distinct from body
    or p.projection_hash<>ingestion.fingerprint_mapping_json_v1(body)
    or p.lifecycle_projection_hash<>ingestion.mapping_lifecycle_hash_v2(body) then
    raise exception using errcode='23514',message='invalid or incomplete v2 projection';
  end if;
  return null;
end;
$$;
create constraint trigger food_projection_versions_verify_mapping_v2
  after insert on ingestion.food_projection_versions deferrable initially deferred
  for each row when(new.projection_contract_version='foundation-lifecycle-projection/v2')
  execute function ingestion.verify_mapping_projection_v2();

create function ingestion.mapping_json_has_duplicate_keys_v1(p_value json)
returns boolean language sql immutable set search_path='' as $$
  with recursive nodes(value) as (
    select p_value
    union all
    select child.value from nodes n cross join lateral (
      select value from pg_catalog.json_array_elements(case when pg_catalog.json_typeof(n.value)='array' then n.value else '[]'::json end)
      union all
      select value from pg_catalog.json_each(case when pg_catalog.json_typeof(n.value)='object' then n.value else '{}'::json end)
    ) child
  ) select exists(select from nodes n where pg_catalog.json_typeof(n.value)='object'
    and (select count(*)<>count(distinct e.key) from pg_catalog.json_each(case when pg_catalog.json_typeof(n.value)='object' then n.value else '{}'::json end) e));
$$;
create function ingestion.mapping_json_input_v1(p_input json)
returns jsonb language plpgsql immutable set search_path='' as $$
declare value jsonb;
begin
  if p_input is null or pg_catalog.octet_length(p_input::text)>33554432
    or ingestion.mapping_json_has_duplicate_keys_v1(p_input) then
    raise exception using errcode='22023',message='duplicate keys or invalid mapping JSON input';
  end if;
  value:=p_input::jsonb;
  if p_input::text is distinct from ingestion.canonicalize_mapping_json_v1(value) then
    raise exception using errcode='22023',message='mapping JSON input must use canonical bytes';
  end if;
  return value;
end;
$$;
create function ingestion.mapping_source_record_hash_v1(p_raw_text text)
returns text language sql immutable set search_path='' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_raw_text,'UTF8')),'hex');
$$;



create function ingestion.validate_mapping_candidate_v1(p_candidate jsonb,p_raw_text text)
returns void language plpgsql set search_path='' as $$
declare target jsonb; source_definition jsonb; raw_nutrient jsonb; raw_offset bigint;
  methods jsonb; selected jsonb; expected_evidence jsonb:='[]'; evidence jsonb;
  code text; unit text; amount_text text; amount_value numeric; semantic text; state jsonb;
  raw_path text; expected_state jsonb; count_methods bigint;p_raw jsonb;
begin
  if p_raw_text is null or pg_catalog.octet_length(p_raw_text)>131072
    or ingestion.mapping_json_has_duplicate_keys_v1(p_raw_text::json) then
    raise exception using errcode='23514',message='invalid or duplicate-key raw source record';end if;
  p_raw:=p_raw_text::jsonb;
  if pg_catalog.jsonb_typeof(p_candidate)<>'object' or pg_catalog.jsonb_typeof(p_raw)<>'object'
    or pg_catalog.octet_length(p_raw::text)>131072
    or p_candidate->>'candidate_contract_version' is distinct from 'foundation-normalized-candidate/v2'
    or p_candidate->>'importer_contract_version' is distinct from 'usda-foundation-importer/v3'
    or p_candidate->>'dataset_code' is distinct from 'usda_fdc_foundation'
    or p_candidate->>'schema_contract_version' is distinct from 'usda-fdc-foundation-json/v1'
    or p_candidate->>'mapping_version' is distinct from 'usda-foundation-full35-direct-v2'
    or p_candidate->>'mapping_hash' is distinct from '028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c'
    or p_candidate->>'nutrient_basis' is distinct from 'per_100g'
    or p_candidate->>'name' is distinct from p_raw->>'description'
    or p_candidate->>'fdc_id' is distinct from p_raw->>'fdcId'
    or p_candidate->'record_identity'->>'fdc_id' is distinct from p_raw->>'fdcId'
    or p_candidate->>'source_row_key' is distinct from 'fdc:'||(p_raw->>'fdcId')
    or p_candidate->>'upstream_version_key' is distinct from 'fdc:'||(p_raw->>'fdcId')
    or p_candidate->>'concept_key' is distinct from 'foundation:ndb:'||(p_raw->>'ndbNumber')
    or p_raw->>'dataType' is distinct from 'Foundation'
    or p_candidate->'record_identity'->>'raw_content_sha256' is distinct from ingestion.mapping_source_record_hash_v1(p_raw_text)
    or p_candidate->>'content_fingerprint' is distinct from ingestion.fingerprint_mapping_json_v1(p_candidate-'content_fingerprint')
    or (select count(*) from pg_catalog.jsonb_each(p_candidate->'nutrients'))<>35 then
    raise exception using errcode='23514',message='candidate source or contract mismatch';
  end if;
  perform ingestion.validate_mapping_candidate_metadata_v1(p_candidate,p_raw);
  raw_path := p_candidate->>'raw_record_path';
  if raw_path is null or raw_path !~ '^FoundationFoods\[[0-9]+\]$' then
    raise exception using errcode='23514',message='invalid raw record path';
  end if;
  for target in select value from pg_catalog.jsonb_array_elements(ingestion.foundation_full35_mapping_body_v1()->'mappings') loop
    code := target->>'application_nutrient_code'; unit := target->>'application_unit';
    methods := '[]';
    for source_definition in select value from pg_catalog.jsonb_array_elements(target->'sources') loop
      select count(*) into count_methods from pg_catalog.jsonb_array_elements(p_raw->'foodNutrients') r
        where r->'nutrient'->>'id'=source_definition->>'id';
      if count_methods>1 then raise exception using errcode='23514',message='duplicate eligible source ID'; end if;
      if count_methods=0 then continue; end if;
      select r.value,r.ordinality-1 into raw_nutrient,raw_offset
        from pg_catalog.jsonb_array_elements(p_raw->'foodNutrients') with ordinality r
        where r.value->'nutrient'->>'id'=source_definition->>'id';
      amount_text := pg_catalog.trim_scale((raw_nutrient->>'amount')::numeric)::text;
      if raw_nutrient->'nutrient'->>'name' is distinct from source_definition->>'name'
        or not coalesce(ingestion.foundation_full35_mapping_body_v1()->'unit_aliases'->unit ? (raw_nutrient->'nutrient'->>'unitName'),false)
        or pg_catalog.jsonb_typeof(raw_nutrient->'amount') is distinct from 'number'
        or (raw_nutrient ? 'loq' and pg_catalog.jsonb_typeof(raw_nutrient->'loq') is distinct from 'number')
        or (raw_nutrient ? 'footnote' and pg_catalog.jsonb_typeof(raw_nutrient->'footnote') is distinct from 'string')
        or (raw_nutrient ? 'foodNutrientDerivation' and pg_catalog.jsonb_typeof(raw_nutrient->'foodNutrientDerivation') is distinct from 'object')
        or (raw_nutrient->'foodNutrientDerivation' ? 'code' and pg_catalog.jsonb_typeof(raw_nutrient->'foodNutrientDerivation'->'code') is distinct from 'string')
        or (raw_nutrient->'foodNutrientDerivation' ? 'description' and pg_catalog.jsonb_typeof(raw_nutrient->'foodNutrientDerivation'->'description') is distinct from 'string')
        or amount_text is null or amount_text !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,4})?$'
        or coalesce((raw_nutrient->>'loq')::numeric,0)<>0
        or coalesce(raw_nutrient->>'footnote','') ~ '^\s*<' then
        raise exception using errcode='23514',message='invalid eligible source nutrient';
      end if;
      amount_value := amount_text::numeric;
      semantic := case when amount_value=0 then 'explicit_zero'
        when raw_nutrient->'foodNutrientDerivation'->>'code' in ('NC','AS') then 'source_calculated' else 'source_reported' end;
      evidence := pg_catalog.jsonb_build_object('application_nutrient_code',code,
        'source_nutrient_id',source_definition->>'id','source_nutrient_name',source_definition->>'name',
        'source_unit',raw_nutrient->'nutrient'->>'unitName','source_value',amount_text,
        'application_unit',unit,'basis','per_100g','semantic',semantic,
        'derivation_code',raw_nutrient->'foodNutrientDerivation'->>'code',
        'derivation_description',raw_nutrient->'foodNutrientDerivation'->>'description',
        'footnote',raw_nutrient->>'footnote','loq',case when raw_nutrient ? 'loq'
          then pg_catalog.trim_scale((raw_nutrient->>'loq')::numeric)::text else null end,
        'raw_field_path',raw_path||'.foodNutrients['||raw_offset::text||']','exact_conversion_factor',null);
      evidence := evidence||pg_catalog.jsonb_build_object('evidence_hash',ingestion.fingerprint_mapping_json_v1(evidence));
      methods := methods||pg_catalog.jsonb_build_array(evidence);
      expected_evidence := expected_evidence||pg_catalog.jsonb_build_array(evidence);
    end loop;
    selected := methods->0;
    expected_state := pg_catalog.jsonb_build_object('application_nutrient_code',code,
      'application_unit',unit,'basis','per_100g','semantic',coalesce(selected->>'semantic','missing'),
      'value',selected->>'source_value','missing_reason',case when selected is null then target->>'missing_reason' else null end,
      'evidence_hash',selected->>'evidence_hash');
    if p_candidate->'nutrients'->code is distinct from expected_state then
      raise exception using errcode='23514',message='candidate nutrient differs from original raw source';
    end if;
  end loop;
  select coalesce(pg_catalog.jsonb_agg(e order by e->>'application_nutrient_code' collate "C",
    (e->>'source_nutrient_id')::bigint),'[]') into expected_evidence
    from pg_catalog.jsonb_array_elements(expected_evidence) e;
  if p_candidate->'nutrient_evidence' is distinct from expected_evidence
    or p_candidate->>'evidence_set_hash' is distinct from ingestion.fingerprint_mapping_json_v1(expected_evidence)
    or p_candidate->>'selected_energy_method' is distinct from (case
      when p_candidate->'nutrients'->'energy_kcal'->>'evidence_hash' is null then null
      when exists(select from pg_catalog.jsonb_array_elements(expected_evidence) e
        where e->>'source_nutrient_id'='2048') then 'atwater_specific_2048' else 'atwater_general_2047' end) then
    raise exception using errcode='23514',message='candidate evidence mismatch';
  end if;
end;
$$;

create function ingestion.validate_mapping_interpretation_v1()
returns trigger language plpgsql set search_path='' as $$
declare version ingestion.source_record_versions; mapping ingestion.nutrient_mapping_versions;
  release ingestion.source_releases;
begin
  select * into strict version from ingestion.source_record_versions where id=new.source_record_version_id;
  select * into strict mapping from ingestion.nutrient_mapping_versions where id=new.mapping_version_id;
  select * into strict release from ingestion.source_releases where id=new.source_release_id;
  if version.source_release_id<>new.source_release_id or version.content_sha256<>new.raw_record_hash
    or mapping.dataset_id<>release.dataset_id or mapping.approval_status<>'approved'
    or mapping.version_code<>'usda-foundation-full35-direct-v2' or mapping.content_sha256<>new.mapping_hash
    or (new.candidate_body->'record_identity'->>'source_version_id')::uuid is distinct from version.id
    or (new.candidate_body->'record_identity'->>'source_record_id')::uuid is distinct from version.source_record_id
    or (new.candidate_body->'source_identity'->>'source_release_id')::uuid is distinct from release.id
    or new.candidate_body->'source_identity'->>'manifest_fingerprint' is distinct from release.manifest_fingerprint
    or new.candidate_body->'source_identity'->>'archive_sha256' is distinct from release.sha256 then
    raise exception using errcode='23514',message='mapping interpretation identity mismatch';
  end if;
  perform ingestion.validate_mapping_candidate_v1(new.candidate_body,new.provenance->>'raw_record');
  return new;
end;
$$;
create trigger source_mapping_interpretations_validate before insert on ingestion.source_mapping_interpretations
  for each row execute function ingestion.validate_mapping_interpretation_v1();

-- Preserve legacy evidence uniqueness; separate successful operations may append
-- distinct evidence for the same immutable raw version and current core row.
alter table ingestion.food_nutrient_evidence
  add column mapping_reprojection_receipt_id uuid null references ingestion.mapping_reprojection_receipts(id) deferrable initially deferred,
  drop constraint food_nutrient_evidence_lineage_key,
  add constraint food_nutrient_evidence_version_check check(
    (source_mapping_interpretation_id is null and evidence_body_v2 is null
      and evidence_hash_v2 is null and mapping_reprojection_receipt_id is null)
    or (source_mapping_interpretation_id is not null and evidence_body_v2 is not null
      and evidence_hash_v2 is not null and mapping_reprojection_receipt_id is not null
      and evidence_hash_v2=ingestion.fingerprint_mapping_json_v1(evidence_body_v2-'evidence_hash')
      and evidence_body_v2->>'evidence_hash'=evidence_hash_v2));
create unique index food_nutrient_evidence_legacy_lineage_key
  on ingestion.food_nutrient_evidence(food_nutrient_id,source_record_version_id,mapping_version_id)
  where mapping_reprojection_receipt_id is null;
create unique index food_nutrient_evidence_mapping_lineage_key
  on ingestion.food_nutrient_evidence(food_nutrient_id,source_record_version_id,mapping_version_id,mapping_reprojection_receipt_id)
  where mapping_reprojection_receipt_id is not null;

create function ingestion.mapping_actor_oid_v1(p_authority text)
returns oid language plpgsql stable set search_path='' as $$
declare actor pg_catalog.pg_roles;
begin
  select * into strict actor from pg_catalog.pg_roles where rolname=session_user;
  if p_authority not in ('ingestion_operator','ingestion_approver') or actor.rolsuper
    or actor.rolbypassrls or not actor.rolcanlogin
    or not pg_catalog.pg_has_role(actor.oid,p_authority,'member')
    or pg_catalog.pg_has_role(actor.oid,case when p_authority='ingestion_operator'
        then 'ingestion_approver' else 'ingestion_operator' end,'member')
    or pg_catalog.pg_has_role(actor.oid,'ingestion_reprojection_definer','member') then
    raise exception using errcode='42501',message='trusted distinct login authority required';
  end if;
  return actor.oid;
end;
$$;
create function ingestion.guard_mapping_plan_transition_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or pg_catalog.to_jsonb(new)-'state' is distinct from pg_catalog.to_jsonb(old)-'state'
    or not ((old.state='prepared' and new.state in ('validated','rejected','expired','abandoned'))
      or (old.state='validated' and new.state in ('approved','rejected','expired','abandoned'))
      or (old.state='approved' and new.state in ('completed','rejected','expired','abandoned'))) then
    raise exception using errcode='55000',message='immutable plan or invalid transition';
  end if;
  return new;
end;
$$;
create trigger mapping_reprojection_plans_transition before update or delete on ingestion.mapping_reprojection_plans
  for each row execute function ingestion.guard_mapping_plan_transition_v1();

grant usage on schema supabase_migrations to ingestion_reprojection_definer;
grant select(version,name) on supabase_migrations.schema_migrations to ingestion_reprojection_definer;

-- Schema-wide ACL defaults are not sufficient when owners differ. Every new
-- relation and function receives explicit closed ACLs below as well.
do $$
declare relation_name text;
begin
  foreach relation_name in array array['mapping_version_evidence','source_mapping_interpretations',
    'mapping_reprojection_plans','mapping_reprojection_plan_items','mapping_reprojection_approvals',
    'mapping_reprojection_receipts','mapping_reprojection_events','mapping_reprojection_execution_context',
    'mapping_reprojection_inserted_rows'] loop
    execute pg_catalog.format('alter table ingestion.%I enable row level security',relation_name);
    execute pg_catalog.format('revoke all on ingestion.%I from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver',relation_name);
    execute pg_catalog.format('create policy reprojection_internal on ingestion.%I to ingestion_reprojection_definer using(true) with check(true)',relation_name);
    execute pg_catalog.format('grant select,insert on ingestion.%I to ingestion_reprojection_definer',relation_name);
    if relation_name not in ('mapping_reprojection_plans','mapping_reprojection_execution_context') then
      execute pg_catalog.format('create trigger %I before update or delete on ingestion.%I for each row execute function ingestion.reject_immutable_mutation()',relation_name||'_immutable',relation_name);
    end if;
  end loop;
end;
$$;
revoke insert on ingestion.mapping_version_evidence from ingestion_reprojection_definer;
-- Row locks require UPDATE privilege; the immutable trigger still rejects all approval edits.
grant update(id) on ingestion.mapping_reprojection_approvals to ingestion_reprojection_definer;
grant update(state) on ingestion.mapping_reprojection_plans to ingestion_reprojection_definer;
grant delete on ingestion.mapping_reprojection_execution_context to ingestion_reprojection_definer;


do $$
declare relation_name text;
begin
  foreach relation_name in array array['source_datasets','source_releases','source_records','source_record_versions','foundation_promotion_receipts',
    'nutrient_mapping_versions','nutrient_source_mappings','food_source_links','food_portions',
    'food_projection_versions','food_nutrient_projection_versions','food_nutrient_evidence',
    'food_nutrient_projection_evidence_links','food_projection_heads','dataset_projection_heads',
    'dataset_projection_current_heads','food_source_link_events'] loop
    execute pg_catalog.format('grant select on ingestion.%I to ingestion_reprojection_definer',relation_name);
    execute pg_catalog.format('create policy reprojection_select on ingestion.%I for select to ingestion_reprojection_definer using(true)',relation_name);
  end loop;
  foreach relation_name in array array['food_projection_versions','food_nutrient_projection_versions',
    'food_nutrient_evidence','food_nutrient_projection_evidence_links','dataset_projection_heads','food_source_link_events'] loop
    execute pg_catalog.format('grant insert on ingestion.%I to ingestion_reprojection_definer',relation_name);
    execute pg_catalog.format('create policy reprojection_append on ingestion.%I for insert to ingestion_reprojection_definer with check(true)',relation_name);
  end loop;
end;
$$;
grant update(food_projection_version_id,dataset_projection_head_id,dataset_head_version,food_head_version,updated_at)
  on ingestion.food_projection_heads to ingestion_reprojection_definer;
grant update(current_dataset_projection_head_id,current_head_version,current_projection_fingerprint,updated_at)
  on ingestion.dataset_projection_current_heads to ingestion_reprojection_definer;
create policy reprojection_advance on ingestion.food_projection_heads for update to ingestion_reprojection_definer using(true) with check(true);
create policy reprojection_advance on ingestion.dataset_projection_current_heads for update to ingestion_reprojection_definer using(true) with check(true);
grant usage on schema public to ingestion_reprojection_definer;
grant select(id,code,unit) on public.nutrients to ingestion_reprojection_definer;
create policy nutrients_reprojection_select on public.nutrients for select to ingestion_reprojection_definer
  using (code in (select m->>'application_nutrient_code' from pg_catalog.jsonb_array_elements(ingestion.foundation_full35_mapping_body_v1()->'mappings') m));
grant select(id,code) on public.food_sources to ingestion_reprojection_definer;
create policy food_sources_reprojection_select on public.food_sources for select to ingestion_reprojection_definer using(code='usda');
grant select on public.foods,public.food_nutrients,public.food_aliases,public.food_barcodes to ingestion_reprojection_definer;
create policy foods_reprojection_select on public.foods for select to ingestion_reprojection_definer
  using(owner_user_id is null and is_public and not is_archived and food_type='generic'
    and source_id in(select id from public.food_sources where code='usda') and source_food_id like 'foundation:%');
create policy food_nutrients_reprojection_select on public.food_nutrients for select to ingestion_reprojection_definer
  using(exists(select from public.foods where id=food_id));
create policy food_aliases_reprojection_select on public.food_aliases for select to ingestion_reprojection_definer
  using(exists(select from public.foods where id=food_id));
create policy food_barcodes_reprojection_select on public.food_barcodes for select to ingestion_reprojection_definer
  using(exists(select from public.foods where id=food_id));


create function ingestion.fingerprint_mapping_projection_evidence_v1(p_projection uuid)
returns text language sql stable set search_path='' as $$
  select ingestion.fingerprint_mapping_json_v1(coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('link',pg_catalog.to_jsonb(l),
    'evidence',(pg_catalog.to_jsonb(e)-'original_value')||pg_catalog.jsonb_build_object(
      'original_value',pg_catalog.trim_scale(e.original_value)::text)) order by l.id),'[]'))
  from ingestion.food_nutrient_projection_versions state
  join ingestion.food_nutrient_projection_evidence_links l on l.food_nutrient_projection_version_id=state.id
  join ingestion.food_nutrient_evidence e on e.id=l.food_nutrient_evidence_id
  where state.food_projection_version_id=p_projection;
$$;

create function ingestion.mapping_scope_snapshot_v1(p_dataset uuid,p_environment text)
returns jsonb language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object('head',pg_catalog.jsonb_build_object(
    'initial_promotion_receipt_id',dh.initial_promotion_receipt_id,'mapping_reprojection_receipt_id',dh.mapping_reprojection_receipt_id,
    'projection_contract_version',dh.projection_contract_version,
    'prior_mapping',case when dh.mapping_reprojection_receipt_id is not null then
      (select pg_catalog.jsonb_build_object('id',m.id,'version_code',m.version_code,'hash',m.content_sha256)
       from ingestion.mapping_reprojection_receipts rr join ingestion.mapping_reprojection_plans pp on pp.id=rr.plan_id
       join ingestion.nutrient_mapping_versions m on m.id=pp.mapping_version_id where rr.id=dh.mapping_reprojection_receipt_id)
      else (select pg_catalog.jsonb_build_object('id',m.id,'version_code',m.version_code,'hash',m.content_sha256)
       from ingestion.foundation_promotion_receipts rr join ingestion.nutrient_mapping_versions m
       on m.dataset_id=dh.dataset_id and m.version_code=rr.mapping_version and m.content_sha256=rr.mapping_hash
       where rr.id=dh.initial_promotion_receipt_id) end,
    'id',pointer.current_dataset_projection_head_id,'version',pointer.current_head_version,
    'fingerprint',pointer.current_projection_fingerprint,'source_release_id',dh.current_source_release_id),
    'foods',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'food_id',h.food_id,'source_record_id',h.source_record_id,'source_version_id',h.source_record_version_id,
      'raw_hash',v.content_sha256,'fdc_id',pg_catalog.substr(v.upstream_version_key,5),'concept_key',r.concept_key,
      'prior_projection_id',p.id,'prior_projection_contract',p.projection_contract_version,
      'prior_projection_hash',p.projection_hash,'prior_lifecycle_hash',p.lifecycle_projection_hash,
      'food_head_version',h.food_head_version,'food_row',pg_catalog.to_jsonb(f),
      'source_version_row',pg_catalog.to_jsonb(v),'source_record_row',pg_catalog.to_jsonb(r),
      'metadata',pg_catalog.jsonb_build_object('name',p.name,'brand_name',p.brand_name,'locale',p.locale,
        'food_type',p.food_type,'data_quality',p.data_quality,'is_public',p.is_public,'is_archived',p.is_archived,
        'serving_size',case when p.serving_size is null then null else pg_catalog.trim_scale(p.serving_size)::text end,'serving_unit',p.serving_unit),
      'prior_evidence_hash',ingestion.fingerprint_mapping_projection_evidence_v1(p.id),
      'prior_states',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'nutrient_code',s.nutrient_code,'projection_state',s.projection_state,
        'amount',case when s.amount is null then null else pg_catalog.trim_scale(s.amount)::text end,
        'source_semantic',s.source_semantic,'source_nutrient_id',s.source_nutrient_id,
        'source_unit',s.source_unit,'derivation_code',s.derivation_code,'derivation_description',s.derivation_description)
        order by s.nutrient_code collate "C") from ingestion.food_nutrient_projection_versions s where s.food_projection_version_id=p.id),
      'public_rows',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',n.id,'food_id',n.food_id,'nutrient_id',n.nutrient_id,'code',dictionary.code,'unit',dictionary.unit,
        'basis',n.basis,'amount',pg_catalog.trim_scale(n.amount)::text,'created_at',n.created_at,'updated_at',n.updated_at)
        order by dictionary.code collate "C",n.id) from public.food_nutrients n
        left join public.nutrients dictionary on dictionary.id=n.nutrient_id where n.food_id=f.id),'[]'),
      'source_links',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.id) from ingestion.food_source_links l where l.food_id=f.id),'[]'),
      'portions',coalesce((select pg_catalog.jsonb_agg((pg_catalog.to_jsonb(portion)-array['amount','gram_weight'])||
        pg_catalog.jsonb_build_object('amount',pg_catalog.trim_scale(portion.amount)::text,'gram_weight',pg_catalog.trim_scale(portion.gram_weight)::text)
        order by portion.ordinal) from ingestion.food_portions portion where portion.source_record_version_id=v.id),'[]'),
      'aliases',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) order by a.id) from public.food_aliases a where a.food_id=f.id),'[]'),
      'barcodes',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) order by b.id) from public.food_barcodes b where b.food_id=f.id),'[]')
    ) order by h.food_id::text collate "C") from ingestion.food_projection_heads h
      join ingestion.food_projection_versions p on p.id=h.food_projection_version_id and p.food_id=h.food_id
        and p.source_record_id=h.source_record_id and p.source_record_version_id=h.source_record_version_id
      join ingestion.source_record_versions v on v.id=h.source_record_version_id
      join ingestion.source_records r on r.id=h.source_record_id
      join public.foods f on f.id=h.food_id
      where h.dataset_id=p_dataset and h.environment=p_environment and h.lifecycle_state='active'
        and h.dataset_projection_head_id=pointer.current_dataset_projection_head_id
        and h.dataset_head_version=pointer.current_head_version),'[]'))
  from ingestion.dataset_projection_current_heads pointer
  join ingestion.dataset_projection_heads dh on dh.id=pointer.current_dataset_projection_head_id
    and dh.dataset_id=pointer.dataset_id and dh.environment=pointer.environment
    and dh.head_version=pointer.current_head_version and dh.dataset_projection_fingerprint=pointer.current_projection_fingerprint
  where pointer.dataset_id=p_dataset and pointer.environment=p_environment;
$$;

create function ingestion.mapping_candidate_states_v1(p_candidate jsonb,p_compensate boolean)
returns jsonb language sql immutable set search_path='' as $$
  select pg_catalog.jsonb_agg(case when p_compensate and code not in('energy_kcal','protein_g','carbohydrates_g','fat_g') then
    pg_catalog.jsonb_build_object('nutrient_code',code,'application_unit',state->>'application_unit',
      'projection_state','missing','missing_reason','compensated_to_before_image')
    when state->>'semantic'='missing' then pg_catalog.jsonb_build_object(
      'nutrient_code',code,'application_unit',state->>'application_unit','projection_state','missing','missing_reason',state->>'missing_reason')
    else pg_catalog.jsonb_build_object('nutrient_code',code,'application_unit',state->>'application_unit',
      'projection_state','present','basis','per_100g','amount',state->>'value',
      'source_semantic',state->>'semantic','source_nutrient_id',evidence->>'source_nutrient_id',
      'source_unit',evidence->>'source_unit','derivation_code',evidence->>'derivation_code',
      'derivation_description',evidence->>'derivation_description','evidence_hash',state->>'evidence_hash') end
    order by code collate "C")
  from pg_catalog.jsonb_each(p_candidate->'nutrients') n(code,state)
  left join lateral(select e as evidence from pg_catalog.jsonb_array_elements(p_candidate->'nutrient_evidence') e
    where e->>'evidence_hash'=state->>'evidence_hash') e on true;
$$;

create function ingestion.mapping_proposed_projection_v2(p_food jsonb,p_candidate jsonb,p_dataset uuid,p_environment text,p_mapping uuid,p_compensate boolean)
returns jsonb language sql immutable set search_path='' as $$
  select pg_catalog.jsonb_build_object('contract_version','foundation-lifecycle-projection/v2',
    'dataset_id',p_dataset,'environment',p_environment,'food_id',p_food->>'food_id',
    'source_record_id',p_food->>'source_record_id','source_record_version_id',p_food->>'source_version_id',
    'source_release_id',p_candidate->'source_identity'->>'source_release_id','mapping_version_id',p_mapping,
    'mapping_hash',p_candidate->>'mapping_hash','raw_record_hash',p_food->>'raw_hash',
    'candidate_hash',p_candidate->>'content_fingerprint','evidence_set_hash',p_candidate->>'evidence_set_hash',
    'prior_projection',pg_catalog.jsonb_build_object('id',p_food->>'prior_projection_id',
      'contract_version',p_food->>'prior_projection_contract','projection_hash',p_food->>'prior_projection_hash',
      'lifecycle_projection_hash',p_food->>'prior_lifecycle_hash'),'food_metadata',p_food->'metadata',
    'operation_kind',case when p_compensate then 'compensation' else 'reprojection' end,
    'nutrient_states',ingestion.mapping_candidate_states_v1(p_candidate,p_compensate));
$$;

create function ingestion.mapping_plan_diff_v1(p_body jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select pg_catalog.jsonb_build_object('contract_version','foundation-mapping-reprojection-diff/v1',
    'before_hash',ingestion.fingerprint_mapping_json_v1(p_body->'before_snapshot'),
    'public_tuple_set_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(r order by f.ordinality,r.ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'before_snapshot'->'foods') with ordinality f(food,ordinality)
      cross join lateral pg_catalog.jsonb_array_elements(food->'public_rows') with ordinality r(r,ordinality))),
    'core_tuple_set_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(r order by f.ordinality,r.ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'before_snapshot'->'foods') with ordinality f(food,ordinality)
      cross join lateral pg_catalog.jsonb_array_elements(food->'public_rows') with ordinality r(r,ordinality)
      where r->>'code' in('energy_kcal','protein_g','carbohydrates_g','fat_g'))),
    'metadata_preservation_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('food_id',f->'food_id','food_row',f->'food_row','metadata',f->'metadata',
        'source_version_row',f->'source_version_row','source_record_row',f->'source_record_row','source_links',f->'source_links',
        'portions',f->'portions','aliases',f->'aliases','barcodes',f->'barcodes') order by ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'before_snapshot'->'foods') with ordinality t(f,ordinality))),
    'prior_evidence_set_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('food_id',f->'food_id','prior_evidence_hash',f->'prior_evidence_hash') order by ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'before_snapshot'->'foods') with ordinality t(f,ordinality))),
    'proposed_projection_set_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('food_id',i->'before'->'food_id','projection_hash',i->'projection_hash','lifecycle_hash',i->'lifecycle_hash')
      order by ordinality) from pg_catalog.jsonb_array_elements(p_body->'items') with ordinality t(i,ordinality))),
    'proposed_evidence_set_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('food_id',i->'before'->'food_id','candidate_hash',i->'candidate'->'content_fingerprint',
        'evidence_set_hash',i->'candidate'->'evidence_set_hash') order by ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'items') with ordinality t(i,ordinality))),
    'accepted_record_set_hash',ingestion.fingerprint_mapping_json_v1((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('record_identity',i->'candidate'->'record_identity','candidate_hash',i->'candidate'->'content_fingerprint',
        'evidence_set_hash',i->'candidate'->'evidence_set_hash') order by (i->'candidate'->>'fdc_id')::bigint)
      from pg_catalog.jsonb_array_elements(p_body->'items') i)),
    'proposed_dataset_fingerprint',ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object(
      'contract_version','foundation-mapping-dataset-projection/v2','dataset_id',p_body->'dataset_id',
      'environment',p_body->'environment','source_release_id',p_body->'source_release_id','mapping_version_id',p_body->'mapping_version_id',
      'mapping_hash','028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c',
      'foods',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('food_id',i->'before'->'food_id',
        'projection_contract_version','foundation-lifecycle-projection/v2','lifecycle_projection_hash',i->'lifecycle_hash',
        'lifecycle_state','active') order by ordinality) from pg_catalog.jsonb_array_elements(p_body->'items') with ordinality t(i,ordinality)))),
    'additions',(select coalesce(pg_catalog.jsonb_agg(a order by i.ordinality,a.ordinality),'[]')
      from pg_catalog.jsonb_array_elements(p_body->'items') with ordinality i(item,ordinality)
      cross join lateral pg_catalog.jsonb_array_elements(item->'additions') with ordinality a(a,ordinality)),
    'additions_hash',ingestion.fingerprint_mapping_json_v1((select coalesce(pg_catalog.jsonb_agg(a order by i.ordinality,a.ordinality),'[]')
      from pg_catalog.jsonb_array_elements(p_body->'items') with ordinality i(item,ordinality)
      cross join lateral pg_catalog.jsonb_array_elements(item->'additions') with ordinality a(a,ordinality))));
$$;

create function ingestion.validate_mapping_plan_v1(p_body jsonb)
returns void language plpgsql set search_path='' as $$
declare snapshot jsonb; food jsonb; item jsonb; candidate jsonb; state jsonb; before_state jsonb;
  expected_projection jsonb; additions jsonb:='[]'; expected_item_additions jsonb;
  total_present bigint:=0; total_added bigint:=0; original_count bigint:=0; row jsonb;
  dataset uuid; mapping uuid; release ingestion.source_releases; mapping_row ingestion.nutrient_mapping_versions;
  item_count bigint; expected_counts jsonb; rejected jsonb; compensate boolean; original_receipt ingestion.mapping_reprojection_receipts;
  identity_hash text;
begin
  -- Exact envelopes prevent unnoticed optional authority fields.
  if (select array_agg(key order by key) from pg_catalog.jsonb_object_keys(p_body) key) is distinct from
    array['approval_requirements','before_snapshot','compensation_policy','contract_version','counts','dataset_id','diff','environment',
      'implementation','items','mapping_version_id','operation_kind','operator_login','operator_oid',
      'qualification','recovery_requirements','rejected_receipt_id','source_release_id']::text[] then
    raise exception using errcode='22023',message='mapping plan fields must be exact';
  end if;
  compensate := p_body->>'operation_kind'='compensation';
  if p_body->>'operation_kind' not in('reprojection','compensation')
    or p_body->>'contract_version' is distinct from (case when compensate then 'foundation-mapping-compensation/v1'
      else 'foundation-mapping-reprojection-plan/v1' end)
    or p_body->>'environment' not in('local','production')
    or pg_catalog.octet_length(p_body::text)>33554432 then
    raise exception using errcode='22023',message='unsupported mapping plan';
  end if;
  perform ingestion.mapping_require_keys_v1(p_body->'qualification',array['source_release_id','manifest_fingerprint','archive_sha256',
    'json_sha256','accepted_identity_set_hash','historical_allowance_fingerprint','rejected','source_qualification_hash']);
  perform ingestion.mapping_require_keys_v1(p_body->'recovery_requirements',array['qualification_hash','production_ready']);
  if p_body->'qualification'->>'source_release_id' is distinct from p_body->>'source_release_id'
    or p_body->'qualification'->>'source_qualification_hash' is null
    or p_body->'qualification'->>'source_qualification_hash' !~ '^[a-f0-9]{64}$'
    or pg_catalog.jsonb_typeof(p_body->'recovery_requirements'->'production_ready') is distinct from 'boolean'
    or (p_body->>'environment'='production' and p_body->'recovery_requirements'->'production_ready'<>'true'::jsonb) then
    raise exception using errcode='23514',message='exact source qualification and recovery evidence required';end if;
  perform ingestion.mapping_require_keys_v1(p_body->'approval_requirements',array['approver_oid','not_before','expires_at']);
  if (p_body->'approval_requirements'->>'expires_at')::timestamptz<=pg_catalog.clock_timestamp()
    or (p_body->'approval_requirements'->>'not_before')::timestamptz >= (p_body->'approval_requirements'->>'expires_at')::timestamptz
    or not exists(select from pg_catalog.pg_roles r where r.oid=(p_body->'approval_requirements'->>'approver_oid')::oid
      and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls
      and pg_catalog.pg_has_role(r.oid,'ingestion_approver','member') and not pg_catalog.pg_has_role(r.oid,'ingestion_operator','member')) then
    raise exception using errcode='42501',message='trusted approver and valid planned approval interval required';
  end if;
  perform ingestion.mapping_require_keys_v1(p_body->'implementation',array['commit','tree','migrations','contract_versions','database_contract_hash']);
  perform ingestion.mapping_require_keys_v1(p_body->'implementation'->'contract_versions',array['parser','importer','candidate','mapping','projection']);
  if p_body->'implementation'->>'database_contract_hash' is distinct from ingestion.fingerprint_mapping_database_contract_v1() then
    raise exception using errcode='55000',message='installed database contract changed';end if;
  if p_body->'implementation'->'contract_versions' is distinct from '{"parser":"usda-fdc-foundation-json/v1","importer":"usda-foundation-importer/v3","candidate":"foundation-normalized-candidate/v2","mapping":"usda-foundation-full35-direct-v2","projection":"foundation-lifecycle-projection/v2"}'::jsonb then
    raise exception using errcode='23514',message='unsupported plan contract versions';
  end if;
  if p_body->'items' is distinct from (select pg_catalog.jsonb_agg(i order by i->'before'->>'food_id' collate "C")
    from pg_catalog.jsonb_array_elements(p_body->'items') i) then
    raise exception using errcode='23514',message='noncanonical plan item ordering';
  end if;
  dataset := (p_body->>'dataset_id')::uuid; mapping := (p_body->>'mapping_version_id')::uuid;
  snapshot := ingestion.mapping_scope_snapshot_v1(dataset,p_body->>'environment');
  select * into strict release from ingestion.source_releases where id=(p_body->>'source_release_id')::uuid;
  select * into strict mapping_row from ingestion.nutrient_mapping_versions where id=mapping;
  if not exists(select from ingestion.source_datasets where id=dataset and code='usda_fdc_foundation')
    or release.dataset_id<>dataset or mapping_row.dataset_id<>dataset or mapping_row.approval_status<>'approved'
    or mapping_row.content_sha256<>'028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c'
    or not exists(select from ingestion.mapping_version_evidence where mapping_version_id=mapping)
    or p_body->'before_snapshot' is distinct from snapshot
    or snapshot->'head'->>'source_release_id' is distinct from release.id::text
    or pg_catalog.jsonb_array_length(snapshot->'foods')<>353
    or pg_catalog.jsonb_array_length(p_body->'items')<>353
    or (select count(distinct i->'before'->>'food_id') from pg_catalog.jsonb_array_elements(p_body->'items') i)<>353
    or (select count(*) from ingestion.food_projection_heads where dataset_id=dataset and environment=p_body->>'environment')<>353
    or p_body->'qualification'->>'archive_sha256' is distinct from release.sha256
    or p_body->'qualification'->>'manifest_fingerprint' is distinct from release.manifest_fingerprint
    or p_body->'qualification'->>'historical_allowance_fingerprint' is distinct from 'bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a' then
    raise exception using errcode='55000',message='mapping plan identity, approval or before-image mismatch';
  end if;
  if (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('version',version,'filename',version||'_'||name||'.sql') order by version)
      from supabase_migrations.schema_migrations)
    is distinct from (select pg_catalog.jsonb_agg(m-array['sha256'] order by ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'implementation'->'migrations') with ordinality t(m,ordinality))
    or exists(select from pg_catalog.jsonb_array_elements(p_body->'implementation'->'migrations') m
      where m->>'sha256' is null or m->>'sha256' !~ '^[a-f0-9]{64}$'
        or (select count(*) from pg_catalog.jsonb_object_keys(m))<>3) then
    raise exception using errcode='23514',message='exact ordered schema migration identities and hashes required';
  end if;
  if p_body->>'environment'='production' and (
    dataset<>'0890fd0c-0b19-4360-8088-6b1bd6be6000'::uuid
    or release.id<>'a2e1699b-6f72-4153-b2f1-5cbf30c53281'::uuid
    or release.sha256<>'186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a'
    or release.manifest_fingerprint<>'ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0'
    or p_body->'qualification'->>'accepted_identity_set_hash' is distinct from '5650b2c66cd6e769e19167c18f72088132d9468c3d6a4d2cbfdacd3e7fec9f97'
    or p_body->'qualification'->>'json_sha256' is distinct from '27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc'
    or (not compensate and (snapshot->'head'->>'id' is distinct from '2562de58-1c1c-4ce4-acca-3dd468cc045c'
      or snapshot->'head'->>'fingerprint' is distinct from '2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69'))
  ) then raise exception using errcode='23514',message='unapproved production source or dataset'; end if;
  if p_body->'implementation'->>'commit' is null or p_body->'implementation'->>'tree' is null
    or p_body->'recovery_requirements'->>'qualification_hash' is null
    or p_body->'implementation'->>'commit' !~ '^[a-f0-9]{40}$'
    or p_body->'implementation'->>'tree' !~ '^[a-f0-9]{40}$'
    or pg_catalog.jsonb_typeof(p_body->'implementation'->'migrations') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_body->'implementation'->'migrations')<47
    or p_body->'recovery_requirements'->>'qualification_hash' !~ '^[a-f0-9]{64}$'
    or p_body->'compensation_policy' is distinct from pg_catalog.to_jsonb('exact_inserted_rows_current_head_only/v1'::text) then
    raise exception using errcode='23514',message='implementation or recovery binding required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(r->>'fdc_id' order by (r->>'fdc_id')::bigint),'[]') into rejected
    from pg_catalog.jsonb_array_elements(p_body->'qualification'->'rejected') r;
  if p_body->'qualification'->'rejected' is distinct from ingestion.foundation_full35_rejected_set_v1()
    or rejected is distinct from '["2727566","2727567","2727568","2727569","2727570","2727571","2727575","2727576","2747656","2747673"]'::jsonb then
    raise exception using errcode='23514',message='historical exclusions differ';
  end if;
  select ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_agg(i->'candidate'->'record_identity'
    order by (i->'candidate'->>'fdc_id')::bigint)) into identity_hash from pg_catalog.jsonb_array_elements(p_body->'items') i;
  if identity_hash is distinct from p_body->'qualification'->>'accepted_identity_set_hash' then
    raise exception using errcode='23514',message='accepted identity set mismatch';
  end if;
  if compensate then
    select * into strict original_receipt from ingestion.mapping_reprojection_receipts where id=(p_body->>'rejected_receipt_id')::uuid;
    if original_receipt.resulting_head_id::text is distinct from snapshot->'head'->>'id'
      or not exists(select from ingestion.mapping_reprojection_plans where id=original_receipt.plan_id and operation_kind='reprojection')
      or (select count(*) from ingestion.mapping_reprojection_inserted_rows where receipt_id=original_receipt.id)<>5062 then
      raise exception using errcode='55000',message='compensation requires the exact active reprojection receipt';
    end if;
  elsif p_body->'rejected_receipt_id'<>'null'::jsonb or snapshot->'head'->>'version'<>'1'
    or snapshot->'head'->'prior_mapping'->>'version_code' is distinct from 'usda-foundation-mvp-v1'
    or snapshot->'head'->'prior_mapping'->>'hash' is distinct from 'a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5' then
    raise exception using errcode='55000',message='first reprojection requires the initial head';
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_body->'items') loop
    perform ingestion.mapping_require_keys_v1(item,array['before','candidate','raw_record','projection_body','projection_hash','lifecycle_hash','additions']);
    candidate := item->'candidate'; food := item->'before';
    if not exists(select from pg_catalog.jsonb_array_elements(snapshot->'foods') f where f=food)
      or (candidate->'record_identity'->>'source_record_id') is distinct from food->>'source_record_id'
      or (candidate->'record_identity'->>'source_version_id') is distinct from food->>'source_version_id'
      or candidate->'record_identity'->>'raw_content_sha256' is distinct from food->>'raw_hash'
      or candidate->>'fdc_id' is distinct from food->>'fdc_id'
      or food->'source_version_row'->>'source_release_id' is distinct from release.id::text
      or candidate->>'concept_key' is distinct from food->>'concept_key'
      or candidate->>'upstream_version_key' is distinct from food->'source_version_row'->>'upstream_version_key'
      or food->'source_record_row'->>'lifecycle_status' is distinct from 'active'
      or food->'source_version_row'->>'source_status' is distinct from 'active'
      or exists(select from pg_catalog.jsonb_each(food->'metadata') m where m.value is distinct from food->'food_row'->m.key)
      or pg_catalog.jsonb_array_length(food->'source_links')<>1
      or food->'source_links'->0->>'source_record_id' is distinct from food->>'source_record_id'
      or food->'source_links'->0->>'link_role' is distinct from 'primary'
      or food->'source_links'->0->>'review_status' is distinct from 'approved'
      or candidate->>'name' is distinct from food->'metadata'->>'name'
      or candidate->'source_identity'->>'source_release_id' is distinct from release.id::text
      or candidate->'source_identity'->>'accepted_identity_set_hash' is distinct from identity_hash
      or candidate->'source_identity'->>'json_sha256' is distinct from p_body->'qualification'->>'json_sha256'
      or food->'food_row'->>'owner_user_id' is not null
      or food->'food_row'->>'is_public'<>'true' or food->'food_row'->>'is_archived'<>'false'
      or food->'food_row'->>'source_food_id' is distinct from food->>'concept_key'
      or food->'food_row'->>'serving_size' is not null or food->'food_row'->>'serving_unit' is not null
      or exists(select from pg_catalog.jsonb_array_elements(rejected) x where x#>>'{}'=candidate->>'fdc_id') then
      raise exception using errcode='23514',message='plan item substitutes a food or source identity';
    end if;
    perform ingestion.validate_mapping_candidate_v1(candidate,item->>'raw_record');
    expected_projection := ingestion.mapping_proposed_projection_v2(food,candidate,dataset,p_body->>'environment',mapping,compensate);
    if item->'projection_body' is distinct from expected_projection
      or item->>'projection_hash' is distinct from ingestion.fingerprint_mapping_json_v1(expected_projection)
      or item->>'lifecycle_hash' is distinct from ingestion.mapping_lifecycle_hash_v2(expected_projection) then
      raise exception using errcode='23514',message='proposed projection hash mismatch';
    end if;
    expected_item_additions := '[]';
    for state in select value from pg_catalog.jsonb_array_elements(expected_projection->'nutrient_states') loop
      select r into row from pg_catalog.jsonb_array_elements(food->'public_rows') r where r->>'code'=state->>'nutrient_code';
      if state->>'nutrient_code' in('energy_kcal','protein_g','carbohydrates_g','fat_g') then
        select s into before_state from pg_catalog.jsonb_array_elements(food->'prior_states') s
          where s->>'nutrient_code'=state->>'nutrient_code';
        if before_state is null or before_state->>'projection_state' is distinct from state->>'projection_state'
          or before_state->>'amount' is distinct from state->>'amount'
          or before_state->>'source_semantic' is distinct from state->>'source_semantic'
          or before_state->>'source_nutrient_id' is distinct from state->>'source_nutrient_id'
          or before_state->>'source_unit' is distinct from state->>'source_unit'
          or before_state->>'derivation_code' is distinct from state->>'derivation_code'
          or before_state->>'derivation_description' is distinct from state->>'derivation_description' then
          raise exception using errcode='23514',message='core enrichment or replacement is forbidden';
        end if;
        if (row is null) is distinct from (state->>'projection_state'='missing')
          or (row is not null and (row->>'amount' is distinct from state->>'amount' or row->>'basis'<>'per_100g')) then
          raise exception using errcode='23514',message='core public before-image mismatch';
        end if;
        if row is not null then original_count:=original_count+1; end if;
      elsif not compensate and row is not null then
        raise exception using errcode='23514',message='additional nutrient already exists';
      elsif compensate and row is not null and not exists(select from ingestion.mapping_reprojection_inserted_rows
        where receipt_id=original_receipt.id and public_row_id=(row->>'id')::uuid and amount=(row->>'amount')::numeric) then
        raise exception using errcode='23514',message='compensation row was not inserted by rejected receipt';
      end if;
      if state->>'projection_state'='present' then total_present:=total_present+1; end if;
      if not compensate and row is null and state->>'projection_state'='present' then
        expected_item_additions:=expected_item_additions||pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('food_id',food->>'food_id','state',state));
        total_added:=total_added+1;
      end if;
    end loop;
    if item->'additions' is distinct from expected_item_additions then
      raise exception using errcode='23514',message='exact addition tuples differ';
    end if;
    additions:=additions||expected_item_additions;
  end loop;
  expected_counts:=pg_catalog.jsonb_build_object('foods',353,'source_versions_inserted',0,
    'core_rows_preserved',1199,'inserted_rows',case when compensate then 0 else 5062 end,
    'deleted_rows',case when compensate then 5062 else 0 end,'present_states',case when compensate then 1199 else 6261 end,
    'missing_states',case when compensate then 11156 else 6094 end,'states',12355);
  if original_count<>1199 or total_present<>(case when compensate then 1199 else 6261 end)
    or total_added<>(case when compensate then 0 else 5062 end) or p_body->'counts' is distinct from expected_counts
    or p_body->'diff' is distinct from ingestion.mapping_plan_diff_v1(p_body) then
    raise exception using errcode='23514',message='exact reprojection counts or diff mismatch';
  end if;
end;
$$;

create function ingestion.append_mapping_event_v1(p_plan uuid,p_prior text,p_next text)
returns void language sql set search_path='' as $$
  insert into ingestion.mapping_reprojection_events(plan_id,event_sequence,actor_oid,prior_state,next_state,event_body,event_hash)
  select p_plan,(b->>'event_sequence')::integer,(select oid from pg_catalog.pg_roles where rolname=session_user),p_prior,p_next,b,
    ingestion.fingerprint_mapping_json_v1(b) from(select pg_catalog.jsonb_build_object(
      'contract_version','foundation-mapping-governance-event/v1','plan_id',p_plan,'prior_state',p_prior,
      'next_state',p_next,'event_sequence',(select coalesce(max(event_sequence),0)+1 from ingestion.mapping_reprojection_events where plan_id=p_plan),'actor_oid',(select oid::bigint from pg_catalog.pg_roles where rolname=session_user)) b) s;
$$;
create function ingestion.prepare_mapping_plan_internal_v1(p_plan jsonb,p_retry_token uuid,p_kind text)
returns uuid language plpgsql set search_path='' as $$
declare actor oid; plan_id uuid; item jsonb; hash text; existing ingestion.mapping_reprojection_plans;
begin
  actor:=ingestion.mapping_actor_oid_v1('ingestion_operator');
  if p_retry_token is null then raise exception using errcode='22023',message='plan retry identity required';end if;
  if p_plan->>'operation_kind' is distinct from p_kind
    or (p_plan->>'operator_oid')::oid is distinct from actor
    or p_plan->>'operator_login' is distinct from session_user then
    raise exception using errcode='42501',message='plan operator identity mismatch';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||(p_plan->>'dataset_id'),0));
  hash:=ingestion.fingerprint_mapping_json_v1(p_plan);
  select * into existing from ingestion.mapping_reprojection_plans where plan_hash=hash;
  if found then
    if existing.operator_oid<>actor or existing.plan_body<>p_plan or existing.retry_token<>p_retry_token then raise exception 'conflicting plan retry'; end if;
    return existing.id;
  end if;
  perform ingestion.validate_mapping_plan_v1(p_plan);
  insert into ingestion.mapping_reprojection_plans(operation_kind,dataset_id,environment,source_release_id,
    mapping_version_id,prior_head_id,prior_head_version,prior_head_hash,operator_oid,operator_name,
    plan_body,plan_hash,rejected_receipt_id,retry_token)
  values(p_kind,(p_plan->>'dataset_id')::uuid,p_plan->>'environment',(p_plan->>'source_release_id')::uuid,
    (p_plan->>'mapping_version_id')::uuid,(p_plan->'before_snapshot'->'head'->>'id')::uuid,
    (p_plan->'before_snapshot'->'head'->>'version')::bigint,p_plan->'before_snapshot'->'head'->>'fingerprint',
    actor,session_user,p_plan,hash,(p_plan->>'rejected_receipt_id')::uuid,p_retry_token) returning id into plan_id;
  perform ingestion.append_mapping_event_v1(plan_id,null,'prepared');
  for item in select value from pg_catalog.jsonb_array_elements(p_plan->'items') loop
    insert into ingestion.mapping_reprojection_plan_items(plan_id,food_id,source_record_id,source_version_id,
      prior_projection_id,prior_food_head_version,item_body,item_hash)
    values(plan_id,(item->'before'->>'food_id')::uuid,(item->'before'->>'source_record_id')::uuid,
      (item->'before'->>'source_version_id')::uuid,(item->'before'->>'prior_projection_id')::uuid,
      (item->'before'->>'food_head_version')::bigint,item,ingestion.fingerprint_mapping_json_v1(item));
  end loop;
  update ingestion.mapping_reprojection_plans set state='validated' where id=plan_id;
  perform ingestion.append_mapping_event_v1(plan_id,'prepared','validated');
  return plan_id;
end;
$$;
create function ingestion.prepare_foundation_mapping_reprojection_v1(p_plan json,p_retry_token uuid)
returns uuid language sql security definer set search_path='' set timezone='UTC' as $$
  select ingestion.prepare_mapping_plan_internal_v1(ingestion.mapping_json_input_v1(p_plan),p_retry_token,'reprojection');
$$;
create function ingestion.prepare_foundation_mapping_compensation_v1(p_plan json,p_retry_token uuid)
returns uuid language sql security definer set search_path='' set timezone='UTC' as $$
  select ingestion.prepare_mapping_plan_internal_v1(ingestion.mapping_json_input_v1(p_plan),p_retry_token,'compensation');
$$;

create function ingestion.approve_mapping_plan_internal_v1(p_plan_id uuid,p_plan_hash text,p_expires_at timestamptz,p_evidence jsonb,p_kind text)
returns uuid language plpgsql set search_path='' as $$
declare actor oid; plan ingestion.mapping_reprojection_plans; approval_id uuid; body jsonb;
begin
  actor:=ingestion.mapping_actor_oid_v1('ingestion_approver');
  select * into strict plan from ingestion.mapping_reprojection_plans where id=p_plan_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||plan.dataset_id::text,0));
  perform 1 from ingestion.dataset_projection_current_heads where dataset_id=plan.dataset_id and environment=plan.environment for update;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=p_plan_id for update;
  if plan.operation_kind<>p_kind or plan.state<>'validated' or plan.operator_oid=actor
    or plan.plan_hash is distinct from p_plan_hash or plan.plan_hash<>ingestion.fingerprint_mapping_json_v1(plan.plan_body)
    or actor is distinct from (plan.plan_body->'approval_requirements'->>'approver_oid')::oid
    or p_expires_at is distinct from (plan.plan_body->'approval_requirements'->>'expires_at')::timestamptz
    or pg_catalog.clock_timestamp()<(plan.plan_body->'approval_requirements'->>'not_before')::timestamptz
    or p_expires_at<=pg_catalog.clock_timestamp() or p_expires_at>pg_catalog.clock_timestamp()+interval '24 hours'
    or pg_catalog.jsonb_typeof(p_evidence) is distinct from 'object' or pg_catalog.octet_length(p_evidence::text)>8192
    or p_evidence->>'independent_review_hash' is null or p_evidence->>'independent_review_hash' !~ '^[a-f0-9]{64}$'
    or p_evidence->>'recovery_evidence_hash' is distinct from plan.plan_body->'recovery_requirements'->>'qualification_hash'
    or p_evidence->>'recovery_evidence_hash' is null or p_evidence->>'recovery_evidence_hash' !~ '^[a-f0-9]{64}$'
    or p_evidence->>'approval_reference' is null or pg_catalog.length(p_evidence->>'approval_reference') not between 1 and 200 then
    raise exception using errcode='42501',message='independent exact-plan approval required';
  end if;
  perform ingestion.validate_mapping_plan_v1(plan.plan_body);
  perform ingestion.mapping_require_keys_v1(p_evidence,array['independent_review_hash','recovery_evidence_hash','approval_reference']);
  body:=pg_catalog.jsonb_build_object('contract_version',case when p_kind='compensation'
      then 'foundation-mapping-compensation/v1' else 'foundation-mapping-reprojection-approval/v1' end,
    'plan_hash',plan.plan_hash,'dataset_id',plan.dataset_id,'environment',plan.environment,
    'source_release_id',plan.source_release_id,'mapping_version_id',plan.mapping_version_id,
    'prior_head_id',plan.prior_head_id,'operator_oid',plan.operator_oid::bigint,'approver_oid',actor::bigint,
    'expires_at',pg_catalog.to_char(p_expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'evidence',p_evidence);
  insert into ingestion.mapping_reprojection_approvals(plan_id,plan_hash,retry_token,approver_oid,approver_name,approved_at,
    expires_at,approval_body,approval_hash) values(plan.id,plan.plan_hash,plan.retry_token,actor,session_user,
    pg_catalog.clock_timestamp(),p_expires_at,body,ingestion.fingerprint_mapping_json_v1(body)) returning id into approval_id;
  update ingestion.mapping_reprojection_plans set state='approved' where id=plan.id;
  perform ingestion.append_mapping_event_v1(plan.id,'validated','approved');
  return approval_id;
end;
$$;
create function ingestion.approve_foundation_mapping_reprojection_v1(p_plan_id uuid,p_plan_hash text,p_expires_at timestamptz,p_evidence json)
returns uuid language sql security definer set search_path='' set timezone='UTC' as $$
  select ingestion.approve_mapping_plan_internal_v1(p_plan_id,p_plan_hash,p_expires_at,ingestion.mapping_json_input_v1(p_evidence),'reprojection');
$$;
create function ingestion.approve_foundation_mapping_compensation_v1(p_plan_id uuid,p_plan_hash text,p_expires_at timestamptz,p_evidence json)
returns uuid language sql security definer set search_path='' set timezone='UTC' as $$
  select ingestion.approve_mapping_plan_internal_v1(p_plan_id,p_plan_hash,p_expires_at,ingestion.mapping_json_input_v1(p_evidence),'compensation');
$$;

create function ingestion.mapping_public_mutation_authorized_v1(p_food uuid,p_nutrient uuid,p_amount numeric,p_basis text,p_row uuid,p_delete boolean)
returns boolean language sql stable set search_path='' as $$
  select current_user='ingestion_reprojection_definer' and exists(
    select from ingestion.mapping_reprojection_execution_context context
    join ingestion.mapping_reprojection_plans plan on plan.id=context.plan_id
    join ingestion.mapping_reprojection_approvals approval on approval.id=context.approval_id and approval.plan_id=plan.id
    join ingestion.mapping_reprojection_plan_items item on item.plan_id=plan.id and item.food_id=p_food
    join public.nutrients n on n.id=p_nutrient
    join public.foods f on f.id=item.food_id
    where context.backend_pid=pg_catalog.pg_backend_pid() and context.transaction_id=pg_catalog.pg_current_xact_id()
      and plan.state='approved' and plan.operator_oid=ingestion.mapping_actor_oid_v1('ingestion_operator')
      and approval.approver_oid<>plan.operator_oid and p_basis='per_100g'
      and f.source_food_id=item.item_body->'before'->>'concept_key'
      and n.code not in('energy_kcal','protein_g','carbohydrates_g','fat_g','added_sugars_g','vitamin_k_ug','folate_dfe_ug')
      and ((not p_delete and plan.operation_kind='reprojection' and exists(
        select from pg_catalog.jsonb_array_elements(item.item_body->'additions') a
        where a->'state'->>'nutrient_code'=n.code and (a->'state'->>'amount')::numeric=p_amount))
      or (p_delete and plan.operation_kind='compensation' and exists(
        select from ingestion.mapping_reprojection_inserted_rows r
        where r.receipt_id=plan.rejected_receipt_id and r.public_row_id=p_row and r.food_id=p_food
          and r.nutrient_id=p_nutrient and r.amount=p_amount and r.basis=p_basis))));
$$;
create function ingestion.guard_mapping_public_mutation_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_user='ingestion_reprojection_definer' then
    if tg_op='UPDATE' or not ingestion.mapping_public_mutation_authorized_v1(
      coalesce(new.food_id,old.food_id),coalesce(new.nutrient_id,old.nutrient_id),
      coalesce(new.amount,old.amount),coalesce(new.basis,old.basis),coalesce(new.id,old.id),tg_op='DELETE') then
      raise exception using errcode='42501',message='public nutrient mutation lacks exact approved transaction authority';
    end if;
  end if;
  return coalesce(new,old);
end;
$$;
create trigger food_nutrients_guard_mapping_mutation before insert or update or delete on public.food_nutrients
  for each row execute function ingestion.guard_mapping_public_mutation_v1();
grant insert(id,food_id,nutrient_id,amount,basis),delete on public.food_nutrients to ingestion_reprojection_definer;
create policy food_nutrients_reprojection_insert on public.food_nutrients for insert to ingestion_reprojection_definer
  with check(ingestion.mapping_public_mutation_authorized_v1(food_id,nutrient_id,amount,basis,id,false));
create policy food_nutrients_compensation_delete on public.food_nutrients for delete to ingestion_reprojection_definer
  using(ingestion.mapping_public_mutation_authorized_v1(food_id,nutrient_id,amount,basis,id,true));

create function ingestion.execute_mapping_plan_internal_v1(p_approval_id uuid,p_retry_token uuid,p_kind text)
returns jsonb language plpgsql set search_path='' as $$
declare actor oid; plan ingestion.mapping_reprojection_plans; approval ingestion.mapping_reprojection_approvals;
  receipt ingestion.mapping_reprojection_receipts; item ingestion.mapping_reprojection_plan_items;
  pointer ingestion.dataset_projection_current_heads; prior ingestion.food_projection_versions;
  interpretation ingestion.source_mapping_interpretations; candidate jsonb; body jsonb; state jsonb; evidence jsonb;
  snapshot jsonb; food jsonb; before_food jsonb; before_row jsonb; current_row public.food_nutrients;
  operation_receipt_id uuid:=pg_catalog.gen_random_uuid(); head_id uuid:=pg_catalog.gen_random_uuid(); projection_id uuid; state_id uuid;
  evidence_id uuid; resolved_nutrient_id uuid; public_row_id uuid; public_ids jsonb; state_ids jsonb; evidence_ids jsonb;
  states jsonb; row_count bigint; inserted_count bigint:=0; deleted_count bigint:=0; projection_count bigint:=0;
  evidence_count bigint:=0; interpretation_count bigint:=0; head_hash text; inventory jsonb; receipt_body jsonb;
  completed_at timestamptz; keys text[]:=array['food_row','source_version_row','source_record_row','metadata','source_links','portions','aliases','barcodes'];
  key text;
begin
  actor:=ingestion.mapping_actor_oid_v1('ingestion_operator');
  if p_retry_token is null then raise exception using errcode='22023',message='exact retry token required'; end if;
  select * into strict approval from ingestion.mapping_reprojection_approvals where id=p_approval_id;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=approval.plan_id;
  if p_retry_token<>plan.retry_token or p_retry_token<>approval.retry_token then
    raise exception using errcode='23505',message='retry identity differs from approved operation';end if;
  if plan.operation_kind<>p_kind or plan.operator_oid<>actor or plan.operator_name<>session_user
    or approval.approver_oid=actor or approval.plan_hash<>plan.plan_hash
    or plan.plan_hash<>ingestion.fingerprint_mapping_json_v1(plan.plan_body)
    or approval.approval_hash<>ingestion.fingerprint_mapping_json_v1(approval.approval_body)
    or not pg_catalog.pg_has_role(approval.approver_oid,'ingestion_approver','member')
    or pg_catalog.pg_has_role(approval.approver_oid,'ingestion_operator','member') then
    raise exception using errcode='42501',message='execution actor or approval scope mismatch';
  end if;
  -- Shared with lifecycle, and also with the historical promotion key. Both
  -- namespaces are taken in this order. Environment is deliberately not added
  -- to the historical dataset key, which serializes environments more strictly.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||plan.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||plan.source_release_id::text,0));
  select * into receipt from ingestion.mapping_reprojection_receipts where approval_id=approval.id;
  if found then
    if receipt.operator_oid<>actor or receipt.retry_token<>p_retry_token or receipt.plan_id<>plan.id then
      raise exception using errcode='23505',message='retry identity differs from committed operation';
    end if;
    return receipt.receipt_body;
  end if;
  select * into strict pointer from ingestion.dataset_projection_current_heads
    where dataset_id=plan.dataset_id and environment=plan.environment for update;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=plan.id for update;
  select * into strict approval from ingestion.mapping_reprojection_approvals where id=approval.id for update;
  perform 1 from ingestion.food_projection_heads where dataset_id=plan.dataset_id and environment=plan.environment
    order by food_id::text collate "C" for update;
  if plan.state<>'approved' or approval.expires_at<=pg_catalog.clock_timestamp()
    or pointer.current_dataset_projection_head_id<>plan.prior_head_id
    or pointer.current_head_version<>plan.prior_head_version or pointer.current_projection_fingerprint<>plan.prior_head_hash then
    raise exception using errcode='55000',message='stale plan or expired approval';
  end if;
  perform ingestion.validate_mapping_plan_v1(plan.plan_body);
  if (select count(*) from ingestion.mapping_reprojection_plan_items where plan_id=plan.id)<>353
    or exists(select from ingestion.mapping_reprojection_plan_items i where i.plan_id=plan.id
      and (i.item_hash<>ingestion.fingerprint_mapping_json_v1(i.item_body)
        or not (plan.plan_body->'items' @> pg_catalog.jsonb_build_array(i.item_body)))) then
    raise exception using errcode='23514',message='persisted plan item scope mismatch';
  end if;
  insert into ingestion.mapping_reprojection_execution_context(backend_pid,transaction_id,plan_id,approval_id)
    values(pg_catalog.pg_backend_pid(),pg_catalog.pg_current_xact_id(),plan.id,approval.id);
  for item in select * from ingestion.mapping_reprojection_plan_items where plan_id=plan.id
    order by food_id::text collate "C" loop
    candidate:=item.item_body->'candidate'; body:=item.item_body->'projection_body';
    select * into interpretation from ingestion.source_mapping_interpretations
      where source_record_version_id=item.source_version_id and mapping_version_id=plan.mapping_version_id
        and candidate_contract_version='foundation-normalized-candidate/v2';
    if not found then
      if p_kind='compensation' then raise exception 'missing original interpretation'; end if;
      insert into ingestion.source_mapping_interpretations(source_record_version_id,source_release_id,mapping_version_id,
        mapping_hash,candidate_contract_version,candidate_hash,evidence_set_hash,raw_record_hash,candidate_body,provenance)
      values(item.source_version_id,plan.source_release_id,plan.mapping_version_id,candidate->>'mapping_hash',
        'foundation-normalized-candidate/v2',candidate->>'content_fingerprint',candidate->>'evidence_set_hash',
        candidate->'record_identity'->>'raw_content_sha256',candidate,pg_catalog.jsonb_build_object(
          'plan_id',plan.id,'plan_hash',plan.plan_hash,'raw_record',item.item_body->'raw_record')) returning * into interpretation;
      interpretation_count:=interpretation_count+1;
    elsif interpretation.candidate_body<>candidate then raise exception 'conflicting existing mapping interpretation';
    end if;
    select * into strict prior from ingestion.food_projection_versions where id=item.prior_projection_id;
    projection_id:=pg_catalog.gen_random_uuid();
    insert into ingestion.food_projection_versions(id,dataset_id,environment,food_id,source_record_id,source_record_version_id,
      prior_food_projection_version_id,origin_type,name,brand_name,locale,food_type,data_quality,is_public,is_archived,
      serving_size,serving_unit,projection_hash,normalized_candidate_hash,source_metadata_hash,lifecycle_projection_hash,
      projection_contract_version,source_mapping_interpretation_id,mapping_version_id,mapping_reprojection_receipt_id,projection_body_v2)
    values(projection_id,plan.dataset_id,plan.environment,item.food_id,item.source_record_id,item.source_version_id,
      prior.id,case when p_kind='compensation' then 'mapping_compensation' else 'mapping_reprojection' end,
      prior.name,prior.brand_name,prior.locale,prior.food_type,prior.data_quality,prior.is_public,prior.is_archived,
      prior.serving_size,prior.serving_unit,item.item_body->>'projection_hash',candidate->>'content_fingerprint',
      prior.source_metadata_hash,item.item_body->>'lifecycle_hash','foundation-lifecycle-projection/v2',
      interpretation.id,plan.mapping_version_id,operation_receipt_id,body);
    projection_count:=projection_count+1;
    public_ids:='{}'; state_ids:='{}'; evidence_ids:='{}';
    for state in select value from pg_catalog.jsonb_array_elements(body->'nutrient_states') loop
      select id into strict resolved_nutrient_id from public.nutrients where code=state->>'nutrient_code';
      state_id:=pg_catalog.gen_random_uuid();
      insert into ingestion.food_nutrient_projection_versions(id,food_projection_version_id,nutrient_id,nutrient_code,
        projection_state,basis,amount,source_semantic,source_nutrient_id,source_unit,derivation_code,derivation_description,
        projection_hash,projection_contract_version,missing_reason,application_unit,evidence_hash)
      values(state_id,projection_id,resolved_nutrient_id,state->>'nutrient_code',state->>'projection_state',state->>'basis',
        (state->>'amount')::numeric,state->>'source_semantic',state->>'source_nutrient_id',state->>'source_unit',
        state->>'derivation_code',state->>'derivation_description',ingestion.fingerprint_mapping_json_v1(state),
        'foundation-lifecycle-projection/v2',state->>'missing_reason',state->>'application_unit',state->>'evidence_hash');
      if state->>'projection_state'<>'present' then continue; end if;
      select id into public_row_id from public.food_nutrients where food_id=item.food_id and nutrient_id=resolved_nutrient_id and basis='per_100g';
      public_row_id:=coalesce(public_row_id,pg_catalog.gen_random_uuid());
      evidence_id:=pg_catalog.gen_random_uuid();
      select e into strict evidence from pg_catalog.jsonb_array_elements(candidate->'nutrient_evidence') e
        where e->>'evidence_hash'=state->>'evidence_hash';
      insert into ingestion.food_nutrient_evidence(id,food_nutrient_id,source_record_version_id,mapping_version_id,
        source_nutrient_id,original_value,original_unit,original_basis,value_kind,source_semantic,derivation_code,
        derivation_description,source_mapping_interpretation_id,evidence_body_v2,evidence_hash_v2,mapping_reprojection_receipt_id)
      values(evidence_id,public_row_id,item.source_version_id,plan.mapping_version_id,state->>'source_nutrient_id',
        (state->>'amount')::numeric,state->>'source_unit','per_100g',state->>'source_semantic',state->>'source_semantic',
        state->>'derivation_code',state->>'derivation_description',interpretation.id,evidence,state->>'evidence_hash',operation_receipt_id);
      public_ids:=public_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',public_row_id);
      state_ids:=state_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',state_id);
      evidence_ids:=evidence_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',evidence_id);
      evidence_count:=evidence_count+1;
    end loop;
    if p_kind='reprojection' then
      for state in select a->'state' from pg_catalog.jsonb_array_elements(item.item_body->'additions') a loop
        select id into strict resolved_nutrient_id from public.nutrients where code=state->>'nutrient_code';
        insert into public.food_nutrients(id,food_id,nutrient_id,amount,basis)
          values((public_ids->>(state->>'nutrient_code'))::uuid,item.food_id,resolved_nutrient_id,(state->>'amount')::numeric,'per_100g')
          returning * into current_row;
        insert into ingestion.mapping_reprojection_inserted_rows(plan_id,receipt_id,plan_item_id,public_row_id,food_id,nutrient_id,amount,basis,row_image)
          values(plan.id,operation_receipt_id,item.id,current_row.id,current_row.food_id,current_row.nutrient_id,current_row.amount,current_row.basis,pg_catalog.to_jsonb(current_row));
        inserted_count:=inserted_count+1;
      end loop;
    else
      for current_row in select n.* from public.food_nutrients n
        join ingestion.mapping_reprojection_inserted_rows r on r.public_row_id=n.id
        where r.receipt_id=plan.rejected_receipt_id and r.food_id=item.food_id order by n.id loop
        if not exists(select from ingestion.mapping_reprojection_inserted_rows r
          where r.receipt_id=plan.rejected_receipt_id and r.public_row_id=current_row.id and r.row_image=pg_catalog.to_jsonb(current_row)) then
          raise exception using errcode='55000',message='compensation row changed since reprojection';
        end if;
        delete from public.food_nutrients where id=current_row.id;
        get diagnostics row_count=row_count;
        if row_count<>1 then raise exception 'compensation deletion denied'; end if;
        deleted_count:=deleted_count+1;
      end loop;
    end if;
    for state in select value from pg_catalog.jsonb_array_elements(body->'nutrient_states') where value->>'projection_state'='present' loop
      insert into ingestion.food_nutrient_projection_evidence_links(food_nutrient_projection_version_id,food_nutrient_evidence_id)
        values((state_ids->>(state->>'nutrient_code'))::uuid,(evidence_ids->>(state->>'nutrient_code'))::uuid);
    end loop;
    insert into ingestion.food_source_link_events(food_id,source_record_id,source_record_version_id,prior_event_id,
      event_type,mapping_reprojection_receipt_id,mapping_dataset_id,mapping_environment,event_fingerprint)
    values(item.food_id,item.source_record_id,item.source_version_id,
      (select id from ingestion.food_source_link_events where food_id=item.food_id order by created_at desc,id desc limit 1),
      case when p_kind='compensation' then 'mapping_compensated' else 'mapping_reprojected' end,
      operation_receipt_id,plan.dataset_id,plan.environment,ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object('contract_version','foundation-mapping-source-event/v1',
        'receipt_id',operation_receipt_id,'food_id',item.food_id,'source_version_id',item.source_version_id,'projection_id',projection_id)));
    update ingestion.food_projection_heads set food_projection_version_id=projection_id,
      food_head_version=food_head_version+1,dataset_projection_head_id=head_id,
      dataset_head_version=plan.prior_head_version+1,updated_at=pg_catalog.clock_timestamp()
      where dataset_id=plan.dataset_id and environment=plan.environment and food_id=item.food_id
        and food_projection_version_id=item.prior_projection_id and food_head_version=item.prior_food_head_version;
    get diagnostics row_count=row_count;
    if row_count<>1 then raise exception 'food head compare-and-swap failed'; end if;
  end loop;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('food_id',h.food_id,
    'projection_contract_version',p.projection_contract_version,'lifecycle_projection_hash',p.lifecycle_projection_hash,
    'lifecycle_state',h.lifecycle_state) order by h.food_id::text collate "C") into inventory
    from ingestion.food_projection_heads h join ingestion.food_projection_versions p on p.id=h.food_projection_version_id and p.food_id=h.food_id
        and p.source_record_id=h.source_record_id and p.source_record_version_id=h.source_record_version_id
    where h.dataset_id=plan.dataset_id and h.environment=plan.environment;
  head_hash:=ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-mapping-dataset-projection/v2','dataset_id',plan.dataset_id,
    'environment',plan.environment,'source_release_id',plan.source_release_id,'mapping_version_id',plan.mapping_version_id,
    'mapping_hash','028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c','foods',inventory));
  if head_hash is distinct from plan.plan_body->'diff'->>'proposed_dataset_fingerprint' then
    raise exception 'resulting dataset fingerprint differs from approved plan';end if;
  insert into ingestion.dataset_projection_heads(id,dataset_id,environment,current_source_release_id,
    mapping_reprojection_receipt_id,dataset_projection_fingerprint,head_version,previous_head_id,projection_contract_version)
  values(head_id,plan.dataset_id,plan.environment,plan.source_release_id,operation_receipt_id,head_hash,
    plan.prior_head_version+1,plan.prior_head_id,'foundation-lifecycle-projection/v2');
  if approval.expires_at<=pg_catalog.clock_timestamp() then raise exception using errcode='55000',message='approval expired during execution';end if;
  completed_at:=pg_catalog.clock_timestamp();
  receipt_body:=pg_catalog.jsonb_build_object('contract_version',case when p_kind='compensation'
      then 'foundation-mapping-compensation/v1' else 'foundation-mapping-reprojection-receipt/v1' end,
    'receipt_id',operation_receipt_id,'operation_kind',p_kind,'plan_id',plan.id,'plan_hash',plan.plan_hash,
    'approval_id',approval.id,'approval_hash',approval.approval_hash,'operator_oid',actor::bigint,'retry_token',p_retry_token,
    'dataset_id',plan.dataset_id,'environment',plan.environment,'source_release_id',plan.source_release_id,
    'prior_head_id',plan.prior_head_id,'resulting_head_id',head_id,'resulting_head_version',plan.prior_head_version+1,
    'resulting_head_fingerprint',head_hash,'counts',plan.plan_body->'counts','rejected_receipt_id',plan.rejected_receipt_id,
    'public_row_identity_set_hash',(select ingestion.fingerprint_mapping_json_v1(coalesce(pg_catalog.jsonb_agg(
      (r.row_image-'amount')||pg_catalog.jsonb_build_object('amount',pg_catalog.trim_scale(r.amount)::text) order by r.public_row_id::text collate "C"),'[]'))
      from ingestion.mapping_reprojection_inserted_rows r where r.receipt_id=case when p_kind='compensation' then plan.rejected_receipt_id else operation_receipt_id end),
    'completed_at',pg_catalog.to_char(completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  insert into ingestion.mapping_reprojection_receipts(id,dataset_id,environment,plan_id,approval_id,operator_oid,retry_token,
    prior_head_id,resulting_head_id,receipt_body,receipt_hash,completed_at)
  values(operation_receipt_id,plan.dataset_id,plan.environment,plan.id,approval.id,actor,p_retry_token,plan.prior_head_id,head_id,receipt_body,
    ingestion.fingerprint_mapping_json_v1(receipt_body),completed_at);
  update ingestion.dataset_projection_current_heads set current_dataset_projection_head_id=head_id,
    current_head_version=plan.prior_head_version+1,current_projection_fingerprint=head_hash,updated_at=completed_at
    where dataset_id=plan.dataset_id and environment=plan.environment
      and current_dataset_projection_head_id=plan.prior_head_id and current_head_version=plan.prior_head_version
      and current_projection_fingerprint=plan.prior_head_hash;
  get diagnostics row_count=row_count;
  if row_count<>1 then raise exception 'dataset pointer compare-and-swap failed'; end if;
  snapshot:=ingestion.mapping_scope_snapshot_v1(plan.dataset_id,plan.environment);
  if pg_catalog.jsonb_array_length(snapshot->'foods')<>353 or projection_count<>353
    or evidence_count<>(case when p_kind='compensation' then 1199 else 6261 end)
    or inserted_count<>(case when p_kind='compensation' then 0 else 5062 end)
    or deleted_count<>(case when p_kind='compensation' then 5062 else 0 end)
    or interpretation_count<>(case when p_kind='compensation' then 0 else 353 end) then
    raise exception 'execution counters differ from exact approved scope';
  end if;
  for food in select value from pg_catalog.jsonb_array_elements(snapshot->'foods') loop
    select i into strict before_food from pg_catalog.jsonb_array_elements(plan.plan_body->'before_snapshot'->'foods') i
      where i->>'food_id'=food->>'food_id';
    if before_food->>'prior_evidence_hash' is distinct from ingestion.fingerprint_mapping_projection_evidence_v1(
      (before_food->>'prior_projection_id')::uuid) then raise exception 'historical evidence changed';end if;
    foreach key in array keys loop
      if food->key is distinct from before_food->key then raise exception 'immutable catalog/source preservation failed'; end if;
    end loop;
    for before_row in select value from pg_catalog.jsonb_array_elements(before_food->'public_rows')
      where p_kind='reprojection' or value->>'code' in('energy_kcal','protein_g','carbohydrates_g','fat_g') loop
      if not food->'public_rows' @> pg_catalog.jsonb_build_array(before_row) then raise exception 'original public row changed'; end if;
    end loop;
    select item_body->'projection_body'->'nutrient_states' into states from ingestion.mapping_reprojection_plan_items
      where plan_id=plan.id and food_id=(food->>'food_id')::uuid;
    if pg_catalog.jsonb_array_length(food->'public_rows')<>(select count(*) from pg_catalog.jsonb_array_elements(states) s where s->>'projection_state'='present')
      or exists(select from pg_catalog.jsonb_array_elements(food->'public_rows') r where not exists(
        select from pg_catalog.jsonb_array_elements(states) s where s->>'projection_state'='present'
          and s->>'nutrient_code'=r->>'code' and s->>'amount'=r->>'amount' and r->>'basis'='per_100g')) then
      raise exception 'final public tuples differ from approved projection';
    end if;
  end loop;
  update ingestion.mapping_reprojection_plans set state='completed' where id=plan.id;
  perform ingestion.append_mapping_event_v1(plan.id,'approved','completed');
  delete from ingestion.mapping_reprojection_execution_context
    where backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.pg_current_xact_id();
  return receipt_body;
end;
$$;
create function ingestion.execute_foundation_mapping_reprojection_v1(p_approval_id uuid,p_retry_token uuid)
returns jsonb language sql security definer set search_path='' set timezone='UTC' as $$
  select ingestion.execute_mapping_plan_internal_v1(p_approval_id,p_retry_token,'reprojection');
$$;
create function ingestion.execute_foundation_mapping_compensation_v1(p_approval_id uuid,p_retry_token uuid)
returns jsonb language sql security definer set search_path='' set timezone='UTC' as $$
  select ingestion.execute_mapping_plan_internal_v1(p_approval_id,p_retry_token,'compensation');
$$;

create function ingestion.get_foundation_mapping_reprojection_receipt_v1(p_approval_id uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor oid; plan ingestion.mapping_reprojection_plans; receipt ingestion.mapping_reprojection_receipts;
begin
  actor:=ingestion.mapping_actor_oid_v1('ingestion_operator');
  select * into strict plan from ingestion.mapping_reprojection_plans where id=(
    select plan_id from ingestion.mapping_reprojection_approvals where id=p_approval_id);
  if plan.operator_oid<>actor then raise exception using errcode='42501',message='receipt actor mismatch'; end if;
  select * into receipt from ingestion.mapping_reprojection_receipts where approval_id=p_approval_id;
  return receipt.receipt_body;
end;
$$;
create function ingestion.get_foundation_mapping_reprojection_plan_v1(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor oid; plan ingestion.mapping_reprojection_plans;
begin
  if pg_catalog.pg_has_role(session_user,'ingestion_approver','member') then
    actor:=ingestion.mapping_actor_oid_v1('ingestion_approver');
  else actor:=ingestion.mapping_actor_oid_v1('ingestion_operator'); end if;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=p_plan_id;
  if plan.operator_oid<>actor and not pg_catalog.pg_has_role(actor,'ingestion_approver','member') then
    raise exception using errcode='42501',message='plan actor mismatch';
  end if;
  return pg_catalog.jsonb_build_object('plan_id',plan.id,'plan_hash',plan.plan_hash,'retry_token',plan.retry_token,'state',plan.state,'plan',plan.plan_body);
end;
$$;
create function ingestion.close_foundation_mapping_plan_v1(p_plan_id uuid,p_outcome text)
returns void language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor oid; plan ingestion.mapping_reprojection_plans;
begin
  if p_outcome='rejected' then actor:=ingestion.mapping_actor_oid_v1('ingestion_approver');
  else actor:=ingestion.mapping_actor_oid_v1('ingestion_operator'); end if;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=p_plan_id for update;
  if plan.state not in('prepared','validated','approved') or p_outcome not in('rejected','expired','abandoned')
    or (p_outcome<>'rejected' and plan.operator_oid<>actor)
    or (p_outcome='expired' and (plan.plan_body->'approval_requirements'->>'expires_at')::timestamptz>pg_catalog.clock_timestamp())
    or (p_outcome='expired' and exists(select from ingestion.mapping_reprojection_approvals where plan_id=plan.id
      and expires_at>pg_catalog.clock_timestamp())) then
    raise exception using errcode='42501',message='invalid pre-execution outcome';
  end if;
  update ingestion.mapping_reprojection_plans set state=p_outcome where id=plan.id;
  perform ingestion.append_mapping_event_v1(plan.id,plan.state,p_outcome);
end;
$$;

create function ingestion.mapping_require_keys_v1(p_value jsonb,p_keys text[])
returns void language plpgsql immutable set search_path='' as $$
begin
  if pg_catalog.jsonb_typeof(p_value) is distinct from 'object'
    or (select array_agg(key order by key) from pg_catalog.jsonb_object_keys(p_value) key)
      is distinct from (select array_agg(k order by k) from pg_catalog.unnest(p_keys) k) then
    raise exception using errcode='22023',message='mapping object fields must be exact';
  end if;
end;
$$;
create function ingestion.validate_mapping_registry_evidence_v1()
returns trigger language plpgsql set search_path='' as $$
declare registry ingestion.nutrient_mapping_versions;
begin
  select * into strict registry from ingestion.nutrient_mapping_versions where id=new.mapping_version_id;
  if not exists(select from ingestion.source_datasets where id=registry.dataset_id and code='usda_fdc_foundation')
    or registry.version_code<>'usda-foundation-full35-direct-v2' or registry.content_sha256<>new.mapping_hash
    or registry.approval_status<>'approved'
    or (select count(*) from ingestion.nutrient_source_mappings where mapping_version_id=registry.id)<>33
    or exists(select from ingestion.nutrient_source_mappings r
      left join public.nutrients n on n.id=r.application_nutrient_id
      where r.mapping_version_id=registry.id and not exists(
        select from pg_catalog.jsonb_array_elements(new.canonical_mapping->'mappings') m
        cross join lateral pg_catalog.jsonb_array_elements(m->'sources') s
        where s->>'id'=r.source_nutrient_id and s->>'name'=r.source_nutrient_name
          and m->>'application_nutrient_code'=n.code and m->>'application_unit'=n.unit and n.unit=r.application_unit
          and new.canonical_mapping->'unit_aliases'->n.unit ? r.source_unit
          and r.source_basis='per_100g' and r.mapping_status='supported'
          and r.exact_conversion_factor is null and r.conversion_classification='source_reported'
          and r.value_classification='source_reported' and r.missing_value_policy='preserve_unknown'
          and r.explicit_zero_policy='preserve_zero')) then
    raise exception using errcode='23514',message='registry must match the exact 33-source Full35 mapping';
  end if;
  return new;
end;
$$;
create trigger mapping_version_evidence_validate before insert on ingestion.mapping_version_evidence
  for each row execute function ingestion.validate_mapping_registry_evidence_v1();

create function ingestion.validate_mapping_candidate_metadata_v1(p_candidate jsonb,p_raw jsonb)
returns void language plpgsql set search_path='' as $$
declare expected_portions jsonb; expected_metadata jsonb; expected_warnings jsonb; warnings text[]:='{}';
  rebased boolean; unsupported bigint; eligible bigint;
begin
  perform ingestion.mapping_require_keys_v1(p_candidate,array['candidate_contract_version','importer_contract_version',
    'dataset_code','schema_contract_version','mapping_version','mapping_hash','source_identity','record_identity',
    'raw_record_path','fdc_id','ndb_number','source_row_key','concept_key','upstream_version_key','name','publication_date',
    'nutrient_basis','nutrients','nutrient_evidence','evidence_set_hash','selected_energy_method','portion_candidates',
    'source_metadata','unsupported_nutrient_count','warning_categories','content_fingerprint']);
  perform ingestion.mapping_require_keys_v1(p_candidate->'source_identity',array['source_release_id','manifest_fingerprint',
    'archive_sha256','json_sha256','accepted_identity_set_hash']);
  perform ingestion.mapping_require_keys_v1(p_candidate->'record_identity',array['fdc_id','source_record_id','source_version_id','raw_content_sha256']);
  if p_raw->>'foodClass' is distinct from 'FinalFood'
    or p_candidate->>'ndb_number' is distinct from p_raw->>'ndbNumber'
    or p_candidate->>'publication_date' is distinct from pg_catalog.to_char(pg_catalog.to_date(p_raw->>'publicationDate','MM/DD/YYYY'),'YYYY-MM-DD') then
    raise exception using errcode='23514',message='candidate source metadata differs';
  end if;
  expected_metadata:=pg_catalog.jsonb_build_object(
    'scientific_name',case when pg_catalog.btrim(coalesce(p_raw->>'scientificName',''))='' then null else p_raw->>'scientificName' end,
    'category',case when pg_catalog.btrim(coalesce(p_raw->'foodCategory'->>'description',''))='' then null else p_raw->'foodCategory'->>'description' end,
    'is_historical_reference',case when pg_catalog.jsonb_typeof(p_raw->'isHistoricalReference')='boolean' then p_raw->'isHistoricalReference' else 'null'::jsonb end,
    'input_food_count',case when pg_catalog.jsonb_typeof(p_raw->'inputFoods')='array' then pg_catalog.jsonb_array_length(p_raw->'inputFoods') else 0 end,
    'nutrient_conversion_factor_count',case when pg_catalog.jsonb_typeof(p_raw->'nutrientConversionFactors')='array' then pg_catalog.jsonb_array_length(p_raw->'nutrientConversionFactors') else 0 end);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'ordinal',ordinal,'source_sequence_number',(p->>'sequenceNumber')::bigint,'source_portion_id',p->>'id',
    'amount',pg_catalog.trim_scale((p->>'amount')::numeric)::text,'measure_unit_id',p->'measureUnit'->>'id',
    'measure_unit_name',p->'measureUnit'->>'name','measure_unit_abbreviation',p->'measureUnit'->>'abbreviation',
    'portion_description',case when pg_catalog.btrim(coalesce(p->>'portionDescription',''))='' then null else p->>'portionDescription' end,
    'modifier',case when pg_catalog.btrim(coalesce(p->>'modifier',''))='' then null else p->>'modifier' end,
    'gram_weight',pg_catalog.trim_scale((p->>'gramWeight')::numeric)::text,
    'source_value',case when p ? 'value' then pg_catalog.trim_scale((p->>'value')::numeric)::text else null end,
    'minimum_year_acquired',(p->>'minYearAcquired')::bigint) order by ordinal),'[]') into expected_portions
    from(select p,pg_catalog.row_number() over(order by (p->>'sequenceNumber')::bigint,(p->>'id')::bigint) ordinal
      from pg_catalog.jsonb_array_elements(coalesce(p_raw->'foodPortions','[]')) p) portions;
  select count(*)<>count(distinct p->>'sequenceNumber') into rebased
    from pg_catalog.jsonb_array_elements(coalesce(p_raw->'foodPortions','[]')) p;
  select pg_catalog.jsonb_array_length(p_candidate->'nutrient_evidence') into eligible;
  unsupported:=pg_catalog.jsonb_array_length(p_raw->'foodNutrients')-eligible;
  if exists(select from pg_catalog.jsonb_each(p_candidate->'nutrients') n
    where n.value->>'semantic'='missing' and n.value->>'missing_reason'='source_absent') then
    warnings:=pg_catalog.array_append(warnings,'missing_direct_nutrients'); end if;
  warnings:=pg_catalog.array_append(warnings,'policy_withheld_nutrients');
  if (select count(*) from pg_catalog.jsonb_array_elements(p_candidate->'nutrient_evidence') e
    where e->>'application_nutrient_code'='energy_kcal')>1 then warnings:=pg_catalog.array_append(warnings,'alternative_energy_methods_retained'); end if;
  if unsupported>0 then warnings:=pg_catalog.array_append(warnings,'unsupported_nutrients_retained_in_raw'); end if;
  if rebased then warnings:=pg_catalog.array_append(warnings,'source_portion_sequence_rebased'); end if;
  select pg_catalog.jsonb_agg(w order by w collate "C") into expected_warnings from pg_catalog.unnest(warnings) w;
  if p_candidate->'portion_candidates' is distinct from expected_portions
    or p_candidate->'source_metadata' is distinct from expected_metadata
    or p_candidate->'warning_categories' is distinct from expected_warnings
    or (p_candidate->>'unsupported_nutrient_count')::bigint is distinct from unsupported then
    raise exception using errcode='23514',message='candidate metadata, portions or warnings differ from original raw source';
  end if;
end;
$$;


create function ingestion.foundation_full35_rejected_set_v1()
returns jsonb language sql immutable set search_path='' as $$
  select '[{"category":"negative_target_value","fdc_id":"2727566","raw_hash":"06dc7e5736ab1c93c6aa86e29d017ad969cbcdafbf497844c329c4f80ecee343","source_id":"1005","value":"-0.475"},{"category":"negative_target_value","fdc_id":"2727567","raw_hash":"555a24d57a6480813382ef4a16872cc289680a4e37b6ea542210cb7e7fee6fbc","source_id":"1005","value":"-0.173"},{"category":"negative_target_value","fdc_id":"2727568","raw_hash":"c55fec3abb54850e8d232b5cfe053bc0a7be53c5e0095406e5185d344b42a550","source_id":"1005","value":"-0.459"},{"category":"negative_target_value","fdc_id":"2727569","raw_hash":"7565ac119911fd1490d50d80cfa5261be24aa60bbc2f5ac149ddd0e512328dca","source_id":"1005","value":"-0.428"},{"category":"negative_target_value","fdc_id":"2727570","raw_hash":"88fce36913b9de7f09efe3e6fc12822850cfd0f6f44b36070a6fcccd588a8a8f","source_id":"1005","value":"-0.251"},{"category":"negative_target_value","fdc_id":"2727571","raw_hash":"f99f1eb39121b9f90ada2fe074e61f261611b09c088e31c58353cc3b158471d7","source_id":"1005","value":"-0.150"},{"category":"negative_target_value","fdc_id":"2727575","raw_hash":"5caecce43b3c74993b7d516719b7a1bb1920d688b97387536969d7bb3947c23e","source_id":"1005","value":"-0.562"},{"category":"negative_target_value","fdc_id":"2727576","raw_hash":"62f591dfc99c5211c6177efb98decadd7bf8b72e028ee7ed1b4d8ff7ea38a3eb","source_id":"1005","value":"-0.705"},{"category":"negative_target_value","fdc_id":"2747656","raw_hash":"42a7bb6b119a3e4071f929ee153faeb9e12a14cb75b31c8cf07db4f076b1f057","source_id":"1005","value":"-0.060"},{"category":"negative_target_value","fdc_id":"2747673","raw_hash":"53dde09f27e1c66326644df495623519d0b76782c7428ed05faf109e4e640f01","source_id":"1005","value":"-0.104"}]'::jsonb;
$$;


create function ingestion.get_foundation_mapping_reprojection_scope_v1(p_environment text)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare dataset uuid; snapshot jsonb; mapping jsonb;
begin
  perform ingestion.mapping_actor_oid_v1('ingestion_operator');
  if p_environment not in('local','production') or p_environment is null then
    raise exception using errcode='22023',message='unknown Foundation environment'; end if;
  select id into strict dataset from ingestion.source_datasets where code='usda_fdc_foundation';
  snapshot:=ingestion.mapping_scope_snapshot_v1(dataset,p_environment);
  if snapshot is null or pg_catalog.jsonb_array_length(snapshot->'foods')<>353 then
    raise exception using errcode='55000',message='exact Foundation catalog scope unavailable'; end if;
  select pg_catalog.jsonb_build_object('id',m.id,'version_code',m.version_code,'hash',m.content_sha256)
    into strict mapping from ingestion.nutrient_mapping_versions m join ingestion.mapping_version_evidence e on e.mapping_version_id=m.id
    where m.dataset_id=dataset and m.version_code='usda-foundation-full35-direct-v2' and m.approval_status='approved';
  return pg_catalog.jsonb_build_object('before_snapshot',snapshot,'before_hash',ingestion.fingerprint_mapping_json_v1(snapshot),'mapping',mapping,
    'database_contract_hash',ingestion.fingerprint_mapping_database_contract_v1());
end;
$$;

create function ingestion.fingerprint_mapping_database_contract_v1()
returns text language sql stable set search_path='' as $$
  select ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-mapping-installed-database-contract/v1',
    'functions',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'identity',p.oid::regprocedure::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),
      'definition',pg_catalog.pg_get_functiondef(p.oid),'acl',p.proacl::text)
      order by p.oid::regprocedure::text collate "C") from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where (n.nspname in('public','private') and p.prokind<>'a') or (n.nspname='ingestion' and (p.proowner='ingestion_reprojection_definer'::regrole
        or p.proname in('canonicalize_json_v1','fingerprint_json_v1','promote_validated_foundation_run','execute_foundation_lifecycle_update')))),
    'dictionary',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'code',code,'unit',unit) order by code collate "C") from public.nutrients),
    'roles',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',rolname,'login',rolcanlogin,
      'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,
      'replication',rolreplication,'inherit',rolinherit) order by rolname collate "C")
      from pg_catalog.pg_roles where rolname in('ingestion_reprojection_definer','ingestion_operator','ingestion_approver',
        'ingestion_promotion_definer','ingestion_lifecycle_definer','ingestion_definer')),
    'relations',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'relation',n.nspname||'.'||c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
      'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,
      'columns',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',a.attname,
        'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text,
        'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
        from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',conname,
        'definition',pg_catalog.pg_get_constraintdef(oid),'validated',convalidated) order by conname collate "C")
        from pg_catalog.pg_constraint where conrelid=c.oid),
      'indexes',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('definition',pg_catalog.pg_get_indexdef(indexrelid),
        'valid',indisvalid,'ready',indisready) order by indexrelid::regclass::text collate "C")
        from pg_catalog.pg_index where indrelid=c.oid),
      'policies',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',polname,'command',polcmd::text,
        'permissive',polpermissive,'roles',(select pg_catalog.jsonb_agg(case when r=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(r) end
          order by r) from pg_catalog.unnest(polroles) r),'using',pg_catalog.pg_get_expr(polqual,polrelid),
        'check',pg_catalog.pg_get_expr(polwithcheck,polrelid)) order by polname collate "C")
        from pg_catalog.pg_policy where polrelid=c.oid),
      'triggers',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',t.tgname,
        'enabled',t.tgenabled::text,'definition',pg_catalog.pg_get_triggerdef(t.oid)) order by t.tgname collate "C")
        from pg_catalog.pg_trigger t join pg_catalog.pg_proc f on f.oid=t.tgfoid
        join pg_catalog.pg_namespace fn on fn.oid=f.pronamespace
        where t.tgrelid=c.oid and not t.tgisinternal and fn.nspname in('ingestion','public','private'))
      ) order by n.nspname collate "C",c.relname collate "C") from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','ingestion') and c.relkind='r'),
    'default_acls',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(d.defaclrole),
      'schema',n.nspname,'kind',d.defaclobjtype::text,'acl',d.defaclacl::text)
      order by pg_catalog.pg_get_userbyid(d.defaclrole) collate "C",n.nspname collate "C",d.defaclobjtype)
      from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
      where n.nspname in('public','ingestion') or (d.defaclnamespace=0 and d.defaclrole='ingestion_reprojection_definer'::regrole))));
$$;










-- BEGIN CLOSED FUNCTION ACLS
alter function ingestion.canonicalize_mapping_json_v1(jsonb) owner to ingestion_reprojection_definer;
revoke all on function ingestion.canonicalize_mapping_json_v1(jsonb) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.fingerprint_mapping_json_v1(jsonb) owner to ingestion_reprojection_definer;
revoke all on function ingestion.fingerprint_mapping_json_v1(jsonb) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.foundation_full35_mapping_body_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.foundation_full35_mapping_body_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_projection_state_body_v1(ingestion.food_nutrient_projection_versions) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_projection_state_body_v1(ingestion.food_nutrient_projection_versions) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.validate_mapping_projection_state_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.validate_mapping_projection_state_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_projection_body_v2(uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_projection_body_v2(uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_lifecycle_hash_v2(jsonb) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_lifecycle_hash_v2(jsonb) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.verify_mapping_projection_v2() owner to ingestion_reprojection_definer;
revoke all on function ingestion.verify_mapping_projection_v2() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_json_has_duplicate_keys_v1(json) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_json_has_duplicate_keys_v1(json) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_json_input_v1(json) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_json_input_v1(json) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_source_record_hash_v1(text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_source_record_hash_v1(text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.validate_mapping_candidate_v1(jsonb,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.validate_mapping_candidate_v1(jsonb,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.validate_mapping_interpretation_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.validate_mapping_interpretation_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_actor_oid_v1(text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_actor_oid_v1(text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.guard_mapping_plan_transition_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.guard_mapping_plan_transition_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.fingerprint_mapping_projection_evidence_v1(uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.fingerprint_mapping_projection_evidence_v1(uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_scope_snapshot_v1(uuid,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_scope_snapshot_v1(uuid,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_candidate_states_v1(jsonb,boolean) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_candidate_states_v1(jsonb,boolean) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_proposed_projection_v2(jsonb,jsonb,uuid,text,uuid,boolean) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_proposed_projection_v2(jsonb,jsonb,uuid,text,uuid,boolean) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_plan_diff_v1(jsonb) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_plan_diff_v1(jsonb) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.validate_mapping_plan_v1(jsonb) owner to ingestion_reprojection_definer;
revoke all on function ingestion.validate_mapping_plan_v1(jsonb) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.append_mapping_event_v1(uuid,text,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.append_mapping_event_v1(uuid,text,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.prepare_mapping_plan_internal_v1(jsonb,uuid,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.prepare_mapping_plan_internal_v1(jsonb,uuid,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.prepare_foundation_mapping_reprojection_v1(json,uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.prepare_foundation_mapping_reprojection_v1(json,uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.prepare_foundation_mapping_compensation_v1(json,uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.prepare_foundation_mapping_compensation_v1(json,uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.approve_mapping_plan_internal_v1(uuid,text,timestamptz,jsonb,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.approve_mapping_plan_internal_v1(uuid,text,timestamptz,jsonb,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.approve_foundation_mapping_reprojection_v1(uuid,text,timestamptz,json) owner to ingestion_reprojection_definer;
revoke all on function ingestion.approve_foundation_mapping_reprojection_v1(uuid,text,timestamptz,json) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.approve_foundation_mapping_compensation_v1(uuid,text,timestamptz,json) owner to ingestion_reprojection_definer;
revoke all on function ingestion.approve_foundation_mapping_compensation_v1(uuid,text,timestamptz,json) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_public_mutation_authorized_v1(uuid,uuid,numeric,text,uuid,boolean) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_public_mutation_authorized_v1(uuid,uuid,numeric,text,uuid,boolean) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.guard_mapping_public_mutation_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.guard_mapping_public_mutation_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.execute_mapping_plan_internal_v1(uuid,uuid,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.execute_mapping_plan_internal_v1(uuid,uuid,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.execute_foundation_mapping_reprojection_v1(uuid,uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.execute_foundation_mapping_reprojection_v1(uuid,uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.execute_foundation_mapping_compensation_v1(uuid,uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.execute_foundation_mapping_compensation_v1(uuid,uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.get_foundation_mapping_reprojection_receipt_v1(uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.get_foundation_mapping_reprojection_receipt_v1(uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.get_foundation_mapping_reprojection_plan_v1(uuid) owner to ingestion_reprojection_definer;
revoke all on function ingestion.get_foundation_mapping_reprojection_plan_v1(uuid) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.close_foundation_mapping_plan_v1(uuid,text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.close_foundation_mapping_plan_v1(uuid,text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.mapping_require_keys_v1(jsonb,text[]) owner to ingestion_reprojection_definer;
revoke all on function ingestion.mapping_require_keys_v1(jsonb,text[]) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.validate_mapping_registry_evidence_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.validate_mapping_registry_evidence_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.validate_mapping_candidate_metadata_v1(jsonb,jsonb) owner to ingestion_reprojection_definer;
revoke all on function ingestion.validate_mapping_candidate_metadata_v1(jsonb,jsonb) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.foundation_full35_rejected_set_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.foundation_full35_rejected_set_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.get_foundation_mapping_reprojection_scope_v1(text) owner to ingestion_reprojection_definer;
revoke all on function ingestion.get_foundation_mapping_reprojection_scope_v1(text) from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
alter function ingestion.fingerprint_mapping_database_contract_v1() owner to ingestion_reprojection_definer;
revoke all on function ingestion.fingerprint_mapping_database_contract_v1() from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
grant execute on function ingestion.fingerprint_json_v1(jsonb),ingestion.canonicalize_json_v1(jsonb)
  to ingestion_reprojection_definer;
grant execute on function ingestion.canonicalize_mapping_json_v1(jsonb),ingestion.fingerprint_mapping_json_v1(jsonb)
  to postgres,ingestion_definer,ingestion_promotion_definer,ingestion_lifecycle_definer;
revoke create on schema ingestion from ingestion_reprojection_definer;


grant execute on function ingestion.get_foundation_mapping_reprojection_scope_v1(text),
  ingestion.prepare_foundation_mapping_reprojection_v1(json,uuid),
  ingestion.prepare_foundation_mapping_compensation_v1(json,uuid),
  ingestion.execute_foundation_mapping_reprojection_v1(uuid,uuid),
  ingestion.execute_foundation_mapping_compensation_v1(uuid,uuid),
  ingestion.get_foundation_mapping_reprojection_receipt_v1(uuid) to ingestion_operator;
grant execute on function ingestion.approve_foundation_mapping_reprojection_v1(uuid,text,timestamptz,json),
  ingestion.approve_foundation_mapping_compensation_v1(uuid,text,timestamptz,json) to ingestion_approver;
grant execute on function ingestion.get_foundation_mapping_reprojection_plan_v1(uuid),
  ingestion.close_foundation_mapping_plan_v1(uuid,text) to ingestion_operator,ingestion_approver;
revoke ingestion_reprojection_definer,ingestion_lifecycle_definer,ingestion_definer from postgres;
