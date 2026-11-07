-- The mapping JSON hash accepts decimal strings and safe integer numbers.
-- Keep existing integer and null scope encodings, and preserve fractional source
-- portion values exactly. No source or application rows are rewritten.
do $portion_scope$
begin
  if not exists (select from pg_catalog.pg_roles where rolname='full35_release_owner' and not rolcanlogin) then
    raise exception 'The Full35 owner login must be disabled before changing the scope contract';
  end if;
  if pg_catalog.has_schema_privilege('ingestion_reprojection_definer','ingestion','CREATE')
    or exists (select from pg_catalog.pg_auth_members
      where roleid='ingestion_reprojection_definer'::regrole and member='postgres'::regrole
        and grantor='postgres'::regrole) then
    raise exception 'Unexpected Full35 function-owner authority before scope repair';
  end if;
  grant ingestion_reprojection_definer to postgres with admin false, inherit false, set true granted by postgres;
  grant create on schema ingestion to ingestion_reprojection_definer;
  set local role ingestion_reprojection_definer;

create or replace function ingestion.mapping_scope_snapshot_v1(p_dataset uuid,p_environment text)
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
      'portions',coalesce((select pg_catalog.jsonb_agg((pg_catalog.to_jsonb(portion)-array['amount','gram_weight','source_value'])||
        pg_catalog.jsonb_build_object('amount',pg_catalog.trim_scale(portion.amount)::text,
          'gram_weight',pg_catalog.trim_scale(portion.gram_weight)::text,
          'source_value',case when portion.source_value <> pg_catalog.trunc(portion.source_value)
            then pg_catalog.to_jsonb(pg_catalog.trim_scale(portion.source_value)::text)
            else pg_catalog.to_jsonb(portion.source_value) end)
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

  set local role postgres;
  revoke create on schema ingestion from ingestion_reprojection_definer;
  revoke ingestion_reprojection_definer from postgres granted by postgres;
  -- Replay the disabled baseline used after a temporary credential is cleared.
  alter role full35_release_owner valid until 'infinity';
end
$portion_scope$;
