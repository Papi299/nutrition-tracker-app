import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const outputPath = "ingestion/generated/database.types.ts";
const generated = spawnSync(
  "npx",
  ["supabase", "gen", "types", "--lang=typescript", "--local", "--schema", "ingestion"],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

if (generated.status !== 0) {
  process.stderr.write(generated.stderr || "Failed to generate ingestion types.\n");
  process.exit(generated.status ?? 1);
}

const generatedTypes = generated.stdout.replace(/\n+$/u, "\n");

if (process.argv.includes("--write")) {
  writeFileSync(outputPath, generatedTypes, "utf8");
  process.stdout.write(`Updated ${outputPath}.\n`);
  process.exit(0);
}

let committed;
try {
  committed = readFileSync(outputPath, "utf8");
} catch {
  process.stderr.write(`${outputPath} is missing. Run npm run types:ingestion.\n`);
  process.exit(1);
}

if (committed !== generatedTypes) {
  process.stderr.write(
    `${outputPath} is stale. Run npm run types:ingestion and commit the result.\n`,
  );
  process.exit(1);
}

process.stdout.write("Internal ingestion types are synchronized.\n");
