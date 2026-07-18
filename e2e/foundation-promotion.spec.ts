import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { fingerprintFoundationRejectAllowance } from "@/ingestion/contracts/foundation-reject-allowance";
import { sourceReleaseManifestContractVersion } from "@/ingestion/contracts/source-release-manifest";
import {
  foundationImporterContractVersion,
  foundationRejectPolicyVersion,
  foundationSchemaContractVersion,
} from "@/ingestion/usda/foundation/contract";
import { runFoundationDryRun, sha256Bytes } from "@/ingestion/usda/foundation/dry-run";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Foundation promotion tests require the local-only test runner.",
);

function queryDatabase(statement: string) {
  return execFileSync(
    "docker",
    [
      "exec", databaseContainer, "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", statement,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  ).trim();
}

function nutrient(id: number, amount: number) {
  return {
    id: 50_000 + id,
    type: "FoodNutrient",
    nutrient: {
      id,
      number: String(id),
      name: `Synthetic nutrient ${id}`,
      rank: id,
      unitName: id === 2048 ? "kcal" : "g",
    },
    foodNutrientDerivation: {
      code: id === 1004 ? "A" : "NC",
      description: id === 1004 ? "Analytical" : "Calculated",
      foodNutrientSource: { id: 1, code: "1", description: "Synthetic" },
    },
    amount,
  };
}

function acceptedRecord(fdcId: number, complete: boolean) {
  const value = {
    foodClass: "FinalFood",
    description: complete
      ? `Phase 10D Rehearsal Apple Prepared ${fdcId}`
      : `Phase 10D Rehearsal Apple Raw ${fdcId}`,
    foodNutrients: complete
      ? [
          nutrient(1003, 0), nutrient(1004, 4.125),
          nutrient(1005, 20.5), nutrient(2048, 140.25),
        ]
      : [nutrient(1003, 2.5), nutrient(1005, 12.25)],
    foodPortions: complete
      ? [{
          id: fdcId + 1,
          value: 1,
          measureUnit: { id: 1000, name: "cup", abbreviation: "cup" },
          modifier: "prepared",
          gramWeight: 120,
          sequenceNumber: 1,
          amount: 1,
        }]
      : [],
    foodCategory: { description: "Synthetic" },
    fdcId,
    dataType: "Foundation",
    publicationDate: "4/30/2026",
    ndbNumber: complete ? fdcId + 100_000 : undefined,
  };
  if (!complete) delete value.ndbNumber;
  return value;
}

type PromotionResult = {
  status: "completed" | "failed";
  retry?: boolean;
  promotion_approval_id?: string;
  promotion_receipt_id?: string;
  receipt_fingerprint?: string;
  inserted_food_count?: number;
  inserted_nutrient_count?: number;
  inserted_portion_count?: number;
  failure_category?: string | null;
};

function runSyntheticPromotion(identity: string, fdcBase: number) {
  const workspace = mkdtempSync(join(tmpdir(), "phase10d1-promotion-"));
  const archive = Buffer.from(`synthetic archive ${identity}`, "utf8");
  const jsonText = JSON.stringify({
    FoundationFoods: [
      acceptedRecord(fdcBase, true),
      acceptedRecord(fdcBase + 1, false),
      {
        ...acceptedRecord(fdcBase + 2, true),
        foodNutrients: [nutrient(1005, -1)],
      },
    ],
  });
  const manifest = {
    contract_version: sourceReleaseManifestContractVersion,
    source_code: "usda",
    dataset_code: "usda_fdc_foundation",
    distributor_code: "usda_fdc_direct",
    transformation_code: null,
    original_release_identifier: identity,
    transformation_release_identifier: null,
    publication_date: "2026-04-30",
    acquisition_method: "official_bulk_download" as const,
    official_url: "https://fdc.nal.usda.gov/download-datasets/",
    authorized_delivery_url: `https://fdc.nal.usda.gov/${identity}.zip`,
    license_identifier: "CC0-1.0",
    attribution:
      "Cite USDA FoodData Central and retain the applicable release citation.",
    file_format: "json" as const,
    schema_contract_version: foundationSchemaContractVersion,
    archive_name: `${identity}.zip`,
    sha256: sha256Bytes(archive),
    compressed_size: archive.byteLength,
    uncompressed_size: Buffer.byteLength(jsonText),
    approval_reference: "phase-10d1-synthetic-review",
    reject_policy_version: foundationRejectPolicyVersion,
  };
  const dryRun = runFoundationDryRun({ manifest, archiveBytes: archive, jsonText });
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const allowance = {
    contract_version: "foundation-reject-allowance/v1",
    manifest_fingerprint: dryRun.manifestFingerprint,
    source_release_identity: `${manifest.dataset_code}:${identity}:2026-04-30`,
    schema_contract_version: dryRun.report.schema_contract_version,
    schema_contract_hash: dryRun.report.schema_contract_hash,
    importer_contract_version: foundationImporterContractVersion,
    nutrient_mapping_version: dryRun.report.nutrient_mapping_version,
    nutrient_mapping_hash: dryRun.report.nutrient_mapping_hash,
    reject_policy_version: foundationRejectPolicyVersion,
    dry_run_report_fingerprint: dryRun.report.report_fingerprint,
    accepted_record_set_fingerprint:
      dryRun.report.accepted_record_set_fingerprint,
    rejected_record_set_fingerprint:
      dryRun.report.rejected_record_set_fingerprint,
    source_count: dryRun.report.source_count,
    accepted_count: dryRun.report.accepted_count,
    rejected_count: dryRun.report.rejected_count,
    reject_category_counts: dryRun.report.reject_category_counts,
    decision_rationale: "Exclude this exact reviewed synthetic negative record.",
    data_governance_approver: "Phase 10D synthetic data approver",
    approval_reference: "phase-10d1-synthetic-allowance",
    approval_date: today.toISOString().slice(0, 10),
    expires_on: tomorrow.toISOString().slice(0, 10),
    target_environment: "local",
  };
  const approval = {
    contract_version: "foundation-local-promotion-approval-input/v1",
    target_environment: "local",
    approver_identity: "Phase 10D synthetic promotion approver",
    approval_reference: "phase-10d1-synthetic-promotion",
    approval_timestamp: new Date(Date.now() - 1_000).toISOString(),
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };
  const paths = {
    manifest: join(workspace, "manifest.json"),
    archive: join(workspace, "archive.zip"),
    json: join(workspace, "foundation.json"),
    report: join(workspace, "report.json"),
    allowance: join(workspace, "allowance.json"),
    approval: join(workspace, "approval.json"),
  };
  writeFileSync(paths.manifest, JSON.stringify(manifest));
  writeFileSync(paths.archive, archive);
  writeFileSync(paths.json, jsonText);
  writeFileSync(paths.allowance, JSON.stringify(allowance));
  writeFileSync(paths.approval, JSON.stringify(approval));
  const execution = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "ingestion/usda/foundation/promote-local.ts",
      "--manifest", paths.manifest,
      "--archive", paths.archive,
      "--json", paths.json,
      "--report", paths.report,
      "--reject-allowance", paths.allowance,
      "--approval", paths.approval,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (!execution.stdout.trim()) {
    throw new Error(
      `Local promotion returned no receipt (status ${execution.status}): ${execution.stderr}`,
    );
  }
  const result = JSON.parse(execution.stdout.trim()) as PromotionResult;
  rmSync(workspace, { recursive: true, force: true });
  return {
    allowanceFingerprint: fingerprintFoundationRejectAllowance(allowance),
    dryRun,
    execution,
    result,
  };
}

function installFailureTrigger(table: string) {
  queryDatabase(`
    create or replace function ingestion.phase10d1_force_failure()
    returns trigger language plpgsql set search_path = '' as $$
    begin raise exception '${table} forced failure'; end;
    $$;
    create trigger phase10d1_force_failure before insert on ${table}
    for each row execute function ingestion.phase10d1_force_failure();
  `);
}

function removeFailureTrigger(table: string) {
  queryDatabase(`
    drop trigger phase10d1_force_failure on ${table};
    drop function ingestion.phase10d1_force_failure();
  `);
}

test.describe.serial("Phase 10D.1 controlled Foundation promotion", () => {
  const successfulIdentity = "phase-10d1-synthetic-success";
  const successfulBase = 9_300_000;
  let completed: ReturnType<typeof runSyntheticPromotion>;
  let completedFoodIds: string[] = [];
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;

  test("hardens approval roles and grants no consumer ingestion access", () => {
    const result = queryDatabase(`
      select string_agg(rolname || '|' || rolcanlogin || '|' || rolinherit || '|'
        || rolsuper || '|' || rolbypassrls, E'\\n' order by rolname)
      from pg_roles where rolname in ('ingestion_approver','ingestion_promotion_definer');
      select concat_ws('|',
        has_schema_privilege('anon','ingestion','usage'),
        has_schema_privilege('authenticated','ingestion','usage'),
        has_schema_privilege('service_role','ingestion','usage'),
        has_table_privilege('ingestion_approver','public.foods','insert,update,delete'),
        has_table_privilege('ingestion_approver','ingestion.foundation_promotion_approvals','insert'),
        has_table_privilege('ingestion_promotion_definer','public.diary_entries','insert,update,delete'),
        has_table_privilege('ingestion_promotion_definer','public.saved_meals','insert,update,delete'),
        has_table_privilege('ingestion_promotion_definer','public.recipes','insert,update,delete'),
        has_table_privilege('ingestion_promotion_definer','public.food_barcodes','insert,update,delete'));
    `);
    expect(result).toBe(
      "ingestion_approver|false|false|false|false\n" +
        "ingestion_promotion_definer|false|false|false|false\n" +
        "f|f|f|f|f|f|f|f|f",
    );
  });

  test("limits approval and promotion execution to separate exact entry points", () => {
    const result = queryDatabase(`
      select concat_ws('|',
        has_function_privilege('ingestion_operator','ingestion.approve_foundation_promotion(uuid,jsonb)','execute'),
        has_function_privilege('ingestion_approver','ingestion.approve_foundation_promotion(uuid,jsonb)','execute'),
        has_function_privilege('ingestion_approver','ingestion.promote_validated_foundation_run(uuid)','execute'),
        has_function_privilege('ingestion_operator','ingestion.promote_validated_foundation_run(uuid)','execute'),
        has_function_privilege('authenticated','ingestion.promote_validated_foundation_run(uuid)','execute'));
      select string_agg(p.proname, ',' order by p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'ingestion' and p.proowner = 'ingestion_promotion_definer'::regrole;
    `);
    expect(result).toBe(
      "f|t|f|t|f\n" +
        "get_completed_foundation_promotion_receipt,promote_validated_foundation_run",
    );
  });

  test("revalidates candidate authority, identity, mapping, trace, and decimal fields in PostgreSQL", () => {
    const definition = queryDatabase(`
      select pg_get_functiondef(
        'ingestion.promote_validated_foundation_run(uuid)'::regprocedure
      );
    `);
    for (const requiredBoundary of [
      "candidate_contract_version",
      "usda_fdc_foundation",
      "usda-foundation-mvp-v1",
      "foundation:ndb:",
      "foundation:generated:",
      "generate_on_first_promotion",
      "candidate->'brand' <> 'null'::jsonb",
      "candidate->>'food_type' <> 'generic'",
      "candidate->>'locale' <> 'en'",
      "candidate->>'nutrient_basis' <> 'per_100g'",
      "trace Foundation target cannot be promoted",
      "Foundation decimal cannot be stored exactly",
      "source_nutrient_id",
      "portion_candidates",
    ]) {
      expect(definition).toContain(requiredBoundary);
    }
    for (const forbiddenProjection of [
      "food_aliases",
      "food_barcodes",
      "diary_entries",
      "saved_meals",
      "recipes",
    ]) {
      expect(definition).not.toContain(forbiddenProjection);
    }
  });

  for (const [index, table] of [
    "ingestion.source_records",
    "ingestion.source_record_versions",
    "public.foods",
    "public.food_nutrients",
    "ingestion.food_nutrient_evidence",
    "ingestion.food_portions",
    "ingestion.food_source_links",
    "ingestion.foundation_promotion_receipts",
  ].entries()) {
    test(`rolls back every projection when ${table} insertion fails`, () => {
      installFailureTrigger(table);
      try {
        const identity = `phase-10d1-forced-${index}`;
        const attempt = runSyntheticPromotion(identity, 9_200_000 + index * 10);
        expect(attempt.execution.status).toBe(2);
        expect(attempt.result).toMatchObject({
          status: "failed",
          inserted_food_count: 0,
          inserted_nutrient_count: 0,
          inserted_portion_count: 0,
        });
        expect(queryDatabase(`
          select concat_ws('|', runs.current_state, runs.inserted_count,
            (select count(*) from ingestion.source_records records
             where records.dataset_id = releases.dataset_id),
            (select count(*) from public.foods foods
             where foods.source_food_id in (
               'foundation:ndb:${9_300_000 + index * 10}',
               'foundation:ndb:${9_300_001 + index * 10}')))
          from ingestion.import_runs runs
          join ingestion.source_releases releases on releases.id = runs.source_release_id
          where releases.original_release_identifier = '${identity}';
        `)).toBe("failed|0|0|0");
      } finally {
        removeFailureTrigger(table);
      }
    });
  }

  test("promotes the exact accepted set atomically and excludes the reject", () => {
    completed = runSyntheticPromotion(successfulIdentity, successfulBase);
    expect(
      completed.execution.status,
      `${completed.execution.stderr}\n${JSON.stringify(completed.result)}`,
    ).toBe(0);
    expect(completed.result).toMatchObject({
      status: "completed",
      retry: true,
      inserted_food_count: 2,
      inserted_nutrient_count: 6,
      inserted_portion_count: 1,
    });
    expect(completed.dryRun.report).toMatchObject({
      source_count: 3,
      accepted_count: 2,
      rejected_count: 1,
      reject_category_counts: { negative_target_value: 1 },
    });
    completedFoodIds = queryDatabase(`
      select foods.id from public.foods foods
      where foods.source_food_id in (
        'foundation:ndb:${successfulBase + 100_000}',
        (select concept_key from ingestion.source_records records
         where records.concept_key like 'foundation:generated:%')
      ) order by foods.name;
    `).split("\n");
    expect(completedFoodIds).toHaveLength(2);
  });

  test("returns the immutable completed receipt on an exact retry", () => {
    const retried = runSyntheticPromotion(successfulIdentity, successfulBase);
    expect(retried.execution.status).toBe(0);
    expect(retried.result).toMatchObject({
      status: "completed",
      retry: true,
      promotion_receipt_id: completed.result.promotion_receipt_id,
      receipt_fingerprint: completed.result.receipt_fingerprint,
      inserted_food_count: 2,
      inserted_nutrient_count: 6,
      inserted_portion_count: 1,
    });
    expect(queryDatabase(`
      select concat_ws('|', count(*), sum(inserted_food_count), sum(inserted_nutrient_count))
      from ingestion.foundation_promotion_receipts;
    `)).toBe("1|2|6");
  });

  test("preserves concepts, versions, calculated evidence, zero, missing values, and portions", () => {
    const result = queryDatabase(`
      select concat_ws('|',
        (select count(*) from ingestion.source_records),
        (select count(*) from ingestion.source_record_versions),
        (select count(*) from ingestion.food_source_links),
        (select count(*) from ingestion.food_portions),
        (select count(*) from ingestion.food_nutrient_evidence),
        (select count(*) from public.food_aliases aliases
          join public.foods foods on foods.id = aliases.food_id
          where foods.source_food_id like 'foundation:%'),
        (select count(*) from public.food_barcodes barcodes
          join public.foods foods on foods.id = barcodes.food_id
          where foods.source_food_id like 'foundation:%'));
      select string_agg(distinct evidence.source_semantic, ',' order by evidence.source_semantic)
      from ingestion.food_nutrient_evidence evidence;
      select count(*) from public.food_nutrients values
      join public.nutrients nutrients on nutrients.id = values.nutrient_id
      where values.food_id = '${completedFoodIds[1]}' and nutrients.code in ('energy_kcal','fat_g');
      select count(*) from public.food_nutrients values
      join public.nutrients nutrients on nutrients.id = values.nutrient_id
      join public.foods foods on foods.id = values.food_id
      where values.amount = 0 and nutrients.code = 'protein_g'
        and foods.source_food_id like 'foundation:%';
    `);
    expect(result).toBe("2|2|2|1|6|0|0\nexplicit_zero,source_calculated,source_reported\n0\n1");
    expect(() => queryDatabase(`
      update ingestion.foundation_validation_receipts set warning_count = 0;
    `)).toThrow();
  });

  test("makes promoted foods searchable and prefills missing and zero distinctly", async () => {
    const client = createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const email = `phase10d1-${Date.now()}@example.test`;
    const password = "Phase10DPromotion123!";
    const signUp = await client.auth.signUp({ email, password });
    expect(signUp.error).toBeNull();
    const search = await client.rpc("search_readable_foods", {
      p_query: "Rehearsal Apple Prepared",
    });
    expect(search.error).toBeNull();
    expect(search.data?.[0]).toMatchObject({
      food_id: completedFoodIds[0],
      source_code: "usda",
      source_name: "USDA FoodData Central",
      source_type: "imported",
      brand_name: null,
      locale: "en",
    });
    const complete = await client.rpc("get_readable_food_diary_prefill", {
      p_food_id: completedFoodIds[0],
    });
    expect(complete.data?.[0]).toMatchObject({
      calories: 140,
      protein_g: 0,
      carbohydrates_g: 20.5,
      fat_g: 4.125,
      nutrient_basis: "per_100g",
      serving_quantity: 100,
      serving_unit: "g",
    });
    const incomplete = await client.rpc("get_readable_food_diary_prefill", {
      p_food_id: completedFoodIds[1],
    });
    expect(incomplete.data?.[0]).toMatchObject({
      calories: null,
      fat_g: null,
      nutrient_basis: "per_100g",
      serving_quantity: 100,
      serving_unit: "g",
    });
  });

  test("renders the promoted English source safely in Hebrew and writes only after review", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const email = `phase10d1-ui-${Date.now()}@example.test`;
    const password = "Phase10DPromotion123!";
    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    authenticatedState = await context.storageState();
    const client = createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
    await page.goto("/he/foods?q=Rehearsal%20Apple%20Prepared");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const result = page.locator(`[data-food-id="${completedFoodIds[0]}"]`);
    await expect(result).toContainText("Phase 10D Rehearsal Apple Prepared");
    await expect(result).toContainText("USDA FoodData Central");
    const before = await client.from("diary_entries").select("id", { count: "exact", head: true });
    await result.getByRole("link", { name: "שימוש ביומן" }).click();
    const afterSelection = await client.from("diary_entries").select("id", { count: "exact", head: true });
    expect(afterSelection.count).toBe(before.count);
    await expect(page.locator('input[name="serving_quantity"]')).toHaveValue("100");
    await expect(page.locator('input[name="serving_unit"]')).toHaveValue("g");
    await expect(page.locator('input[name="protein_g"]')).toHaveValue("0");
    await page.getByRole("button", { name: "הוספת רשומה" }).click();
    await expect(page.getByText("הרשומה נוספה.")).toBeVisible();
    const saved = await client.from("diary_entries").select("food_name,protein_g,calories").eq("food_id", completedFoodIds[0]).single();
    expect(saved.data).toMatchObject({
      food_name: `Phase 10D Rehearsal Apple Prepared ${successfulBase}`,
      protein_g: 0,
      calories: 140,
    });
    await context.close();
  });

  test("keeps receipts immutable and consumer roles outside ingestion", async () => {
    expect(() => queryDatabase(
      "delete from ingestion.foundation_promotion_receipts;",
    )).toThrow();
    expect(authenticatedState.cookies.length).toBeGreaterThan(0);
    expect(queryDatabase(`
      select concat_ws('|',
        has_schema_privilege('authenticated','ingestion','usage'),
        has_table_privilege('authenticated','ingestion.foundation_validation_receipts','select'),
        has_function_privilege('authenticated','ingestion.validate_foundation_run(uuid,jsonb,uuid,text)','execute'));
    `)).toBe("f|f|f");
  });
});
