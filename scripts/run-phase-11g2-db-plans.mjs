import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];
if (!projectId) throw new Error("Could not read the local Supabase project id.");
const container = `supabase_db_${projectId}`;

function psql(statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-q",
      "-t",
      "-A",
    ],
    { encoding: "utf8", input: statement, maxBuffer: 50 * 1024 * 1024 },
  ).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function uuidLiteral(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error("Invalid fixture UUID.");
  return `'${value}'::uuid`;
}

const actorId = psql(
  "select id::text from auth.users where email = 'phase11g2-user-001@example.test';",
);
const privateFood = JSON.parse(
  psql(
    `select json_build_object('id', id, 'revision', custom_food_edit_revision)::text from public.foods where owner_user_id = ${uuidLiteral(actorId)} order by created_at, id limit 1;`,
  ),
);
const publicFoodId = psql(
  "select id::text from public.foods where is_public order by created_at, id limit 1;",
);
const barcode = psql(
  `select canonical_gtin from public.food_barcodes where food_id = ${uuidLiteral(publicFoodId)};`,
);
const savedMeal = JSON.parse(
  psql(
    `select json_build_object('id', id, 'updated_at', updated_at)::text from public.saved_meals where user_id = ${uuidLiteral(actorId)} order by created_at, id limit 1;`,
  ),
);
const recipe = JSON.parse(
  psql(
    `select json_build_object('id', id, 'updated_at', updated_at)::text from public.recipes where user_id = ${uuidLiteral(actorId)} order by created_at, id limit 1;`,
  ),
);
const manualDiaryId = psql(
  `select id::text from public.diary_entries where user_id = ${uuidLiteral(actorId)} and source = 'manual' order by created_at, id limit 1;`,
);

for (const required of [
  actorId,
  privateFood.id,
  privateFood.revision,
  publicFoodId,
  barcode,
  savedMeal.id,
  savedMeal.updated_at,
  recipe.id,
  recipe.updated_at,
  manualDiaryId,
]) {
  if (!required) throw new Error("The launch-shaped fixture is incomplete.");
}

const queries = [
  {
    id: "search_readable_foods",
    thresholdMs: 750,
    sql: "select * from public.search_readable_foods('Launch Apple')",
  },
  {
    id: "get_readable_food_prefill",
    thresholdMs: 750,
    sql: `select * from public.get_readable_food_diary_prefill(${uuidLiteral(publicFoodId)})`,
  },
  {
    id: "lookup_readable_food_by_gtin",
    thresholdMs: 750,
    sql: `select * from public.lookup_readable_food_by_gtin(${sqlLiteral(barcode)})`,
  },
  {
    id: "persist_custom_food",
    thresholdMs: 1250,
    sql: `select * from public.persist_custom_food(
      p_food_id => ${uuidLiteral(privateFood.id)},
      p_name => 'Owned Launch Food 001-01',
      p_brand_name => null,
      p_locale => 'en',
      p_nutrient_basis => 'per_serving',
      p_serving_quantity => 1,
      p_serving_unit => 'serving',
      p_nutrients => '[{"code":"energy_kcal","amount":101},{"code":"protein_g","amount":8.5},{"code":"carbohydrates_g","amount":18.25},{"code":"fat_g","amount":5.75}]'::jsonb,
      p_aliases => '[{"alias_text":"Launch Selective plan","language_code":"en"}]'::jsonb,
      p_expected_edit_revision => ${Number(privateFood.revision)}
    )`,
  },
  {
    id: "log_saved_meal_to_diary",
    thresholdMs: 1250,
    sql: `select * from public.log_saved_meal_to_diary(
      p_saved_meal_id => ${uuidLiteral(savedMeal.id)},
      p_expected_updated_at => ${sqlLiteral(savedMeal.updated_at)}::timestamptz,
      p_entry_date => date '2026-08-15',
      p_meal_type => 'dinner',
      p_idempotency_key => '10000000-0000-4000-8000-000000000001'::uuid
    )`,
  },
  {
    id: "persist_recipe",
    thresholdMs: 1250,
    sql: `select * from public.persist_recipe(
      p_recipe_id => ${uuidLiteral(recipe.id)},
      p_name => 'Synthetic Recipe 1-1',
      p_locale => 'en',
      p_yield_servings => 4,
      p_ingredients => '[{"position":1,"food_id":null,"ingredient_name":"Plan ingredient","brand_name":null,"quantity":1,"unit":"portion","calories":100,"protein_g":5,"carbohydrates_g":10,"fat_g":3,"notes":null}]'::jsonb,
      p_expected_edit_revision => 1
    )`,
  },
  {
    id: "get_owned_recipe_use_contract",
    thresholdMs: 1250,
    sql: `select * from public.get_owned_recipe_use_contract(${uuidLiteral(recipe.id)}, 1)`,
  },
  {
    id: "log_recipe_to_diary",
    thresholdMs: 1250,
    sql: `select * from public.log_recipe_to_diary(
      p_recipe_id => ${uuidLiteral(recipe.id)},
      p_expected_updated_at => ${sqlLiteral(recipe.updated_at)}::timestamptz,
      p_requested_servings => 1,
      p_entry_date => date '2026-08-16',
      p_meal_type => 'dinner',
      p_idempotency_key => '20000000-0000-4000-8000-000000000001'::uuid
    )`,
  },
  {
    id: "owner_date_diary_read",
    thresholdMs: 1000,
    sql: "select * from public.diary_entries where user_id = auth.uid() and entry_date = date '2026-08-01' order by created_at, id",
  },
  {
    id: "owner_date_diary_write",
    thresholdMs: 1000,
    sql: `update public.diary_entries set notes = 'plan probe' where id = ${uuidLiteral(manualDiaryId)} and user_id = auth.uid() and version = 1 returning id`,
  },
  {
    id: "owner_date_target_read",
    thresholdMs: 1000,
    sql: "select * from public.nutrition_targets where user_id = auth.uid() and effective_from <= date '2026-08-15' order by effective_from desc limit 1",
  },
  {
    id: "owner_date_target_write",
    thresholdMs: 1000,
    sql: "insert into public.nutrition_targets (user_id, effective_from, calories, protein_g, carbohydrates_g, fat_g) values (auth.uid(), date '2026-08-20', 2100, 110, 230, 70) on conflict (user_id, effective_from) do update set calories = excluded.calories, protein_g = excluded.protein_g, carbohydrates_g = excluded.carbohydrates_g, fat_g = excluded.fat_g returning id",
  },
];

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const quotedValuePattern = /'[^']*'/g;

function sanitize(value) {
  if (typeof value === "string") {
    return value
      .replace(uuidPattern, "opaque_uuid")
      .replace(quotedValuePattern, "'opaque_value'");
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, sanitize(child)]),
  );
}

function inspectPlan(node, state) {
  state.nodes += 1;
  state.nodeTypes.add(node["Node Type"]);
  if (node["Relation Name"]) state.relations.add(node["Relation Name"]);
  if (node["Index Name"]) state.indexes.add(node["Index Name"]);
  state.maximumActualRows = Math.max(state.maximumActualRows, node["Actual Rows"] ?? 0);
  const planned = node["Plan Rows"] ?? 0;
  const actual = node["Actual Rows"] ?? 0;
  if (planned > 0) state.maximumCardinalityRatio = Math.max(
    state.maximumCardinalityRatio,
    actual / planned,
  );
  state.sharedHitBlocks += node["Shared Hit Blocks"] ?? 0;
  state.sharedReadBlocks += node["Shared Read Blocks"] ?? 0;
  state.tempReadBlocks += node["Temp Read Blocks"] ?? 0;
  state.tempWrittenBlocks += node["Temp Written Blocks"] ?? 0;
  if (/external|disk/i.test(node["Sort Method"] ?? "")) state.diskSpill = true;
  for (const child of node.Plans ?? []) inspectPlan(child, state);
}

const rawPlans = [];
const summaries = [];
for (const query of queries) {
  const queryPlans = [];
  for (let index = 0; index < 5; index += 1) {
    const statement = `
      begin;
      do $fixture$ begin
        perform set_config(
          'request.jwt.claims',
          json_build_object('sub', ${sqlLiteral(actorId)}, 'role', 'authenticated')::text,
          true
        );
      end $fixture$;
      set local role authenticated;
      explain (analyze, buffers, format json) ${query.sql};
      rollback;
    `;
    const parsed = JSON.parse(psql(statement))[0];
    const state = {
      nodes: 0,
      nodeTypes: new Set(),
      relations: new Set(),
      indexes: new Set(),
      maximumActualRows: 0,
      maximumCardinalityRatio: 0,
      sharedHitBlocks: 0,
      sharedReadBlocks: 0,
      tempReadBlocks: 0,
      tempWrittenBlocks: 0,
      diskSpill: false,
    };
    inspectPlan(parsed.Plan, state);
    const summary = {
      planIndex: index + 1,
      cacheClassification: index === 0 ? "first_observed" : "warm",
      planningTimeMs: parsed["Planning Time"],
      executionTimeMs: parsed["Execution Time"],
      nodeCount: state.nodes,
      nodeTypes: [...state.nodeTypes].sort(),
      relations: [...state.relations].sort(),
      indexes: [...state.indexes].sort(),
      maximumActualRows: state.maximumActualRows,
      maximumCardinalityRatio: Number(state.maximumCardinalityRatio.toFixed(3)),
      sharedHitBlocks: state.sharedHitBlocks,
      sharedReadBlocks: state.sharedReadBlocks,
      tempReadBlocks: state.tempReadBlocks,
      tempWrittenBlocks: state.tempWrittenBlocks,
      diskSpill: state.diskSpill,
    };
    queryPlans.push(summary);
    rawPlans.push({
      queryId: query.id,
      planIndex: index + 1,
      cacheClassification: summary.cacheClassification,
      plan: sanitize(parsed),
    });
  }
  const durations = queryPlans.map((plan) => plan.executionTimeMs).sort((a, b) => a - b);
  const p95Ms = durations.at(-1);
  const materialFindings = [];
  if (queryPlans.some((plan) => plan.diskSpill)) materialFindings.push("disk_spill");
  if (queryPlans.some((plan) => plan.tempWrittenBlocks > 0)) materialFindings.push("temp_write");
  if (queryPlans.some((plan) => plan.maximumCardinalityRatio > 100 && plan.maximumActualRows > 1000)) {
    materialFindings.push("cardinality_blowup");
  }
  if (p95Ms > query.thresholdMs) materialFindings.push("material_latency_breach");
  summaries.push({
    queryId: query.id,
    queryIdentitySha256: sha256(query.sql.replace(uuidPattern, "opaque_uuid")),
    planCount: queryPlans.length,
    firstObservedExecutionMs: queryPlans[0].executionTimeMs,
    warmExecutionMs: queryPlans.slice(1).map((plan) => plan.executionTimeMs),
    p95ExecutionMs: p95Ms,
    comparisonBudgetMs: query.thresholdMs,
    materialFindings,
    passed: materialFindings.length === 0,
    representativePlans: queryPlans,
  });
}

const migrationFiles = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
const schemaIdentitySha256 = sha256(
  migrationFiles
    .map((name) => `${name}\n${readFileSync(`supabase/migrations/${name}`, "utf8")}`)
    .join("\n"),
);
const indexDefinitions = psql(
  "select schemaname || '.' || indexname || ':' || indexdef from pg_indexes where schemaname = 'public' order by indexname;",
);
const fixtureManifest = JSON.parse(
  readFileSync("performance/fixture-manifest.json", "utf8"),
);
const sourceIdentitySha256 = sha256([
  "scripts/run-phase-11g2-db-plans.mjs",
  readFileSync("scripts/run-phase-11g2-db-plans.mjs", "utf8"),
  "performance/fixture-manifest.json",
  readFileSync("performance/fixture-manifest.json", "utf8"),
  "performance/fixture.sql",
  readFileSync("performance/fixture.sql", "utf8"),
].join("\0"));

const report = {
  schemaVersion: "1",
  evidenceType: "DB-001-local-query-plan-qualification",
  sourceIdentitySha256,
  fixtureVersion: fixtureManifest.fixtureVersion,
  fixtureCardinalities: fixtureManifest.cardinalities,
  schemaIdentitySha256,
  indexIdentitySha256: sha256(indexDefinitions),
  databaseVersion: psql("show server_version;"),
  percentileMethod: "nearest-rank; five plans means p95 is the maximum",
  coldQualification:
    "first_observed is recorded separately; a physically cold OS/database cache was not forced because that would make the shared local stack nondeterministic",
  queries: summaries,
  planCount: rawPlans.length,
  passed: summaries.every((summary) => summary.passed),
};

mkdirSync("performance/evidence", { recursive: true });
writeFileSync(
  "performance/evidence/db-plan-report.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
writeFileSync(
  "performance/evidence/db-plans.json",
  `${JSON.stringify({
    schemaVersion: "1",
    sourceIdentitySha256,
    schemaIdentitySha256,
    indexIdentitySha256: report.indexIdentitySha256,
    plans: rawPlans,
  }, null, 2)}\n`,
);

process.stdout.write(`${JSON.stringify(report)}\n`);
if (!report.passed) process.exitCode = 1;
