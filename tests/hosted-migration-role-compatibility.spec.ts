import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const pendingMigrations = [
  "20260718150000_allow_phase_10e_terminal_run_classification.sql",
  "20260719080000_create_foundation_lifecycle_foundation.sql",
  "20260719120000_harden_foundation_lifecycle_diff_validation.sql",
  "20260719160000_execute_foundation_lifecycle_updates.sql",
  "20260721100000_restore_strict_terminal_run_immutability.sql",
] as const;

const temporaryRoleBlocks = [
  {
    migration: pendingMigrations[0],
    temporaryRole: "ingestion_definer",
    occurrence: 1,
  },
  {
    migration: pendingMigrations[2],
    temporaryRole: "ingestion_definer",
    occurrence: 1,
  },
  {
    migration: pendingMigrations[2],
    temporaryRole: "ingestion_definer",
    occurrence: 2,
  },
  {
    migration: pendingMigrations[4],
    temporaryRole: "ingestion_definer",
    occurrence: 1,
  },
  {
    migration: pendingMigrations[4],
    temporaryRole: "ingestion_lifecycle_definer",
    occurrence: 1,
  },
] as const;

function migrationSql(file: string) {
  return readFileSync(`supabase/migrations/${file}`, "utf8");
}

function occurrenceIndex(value: string, pattern: string, occurrence: number) {
  let index = -1;
  for (let count = 0; count < occurrence; count += 1) {
    index = value.indexOf(pattern, index + 1);
  }
  return index;
}

test.describe("hosted migration role compatibility", () => {
  test("keeps the exact five pending migration timestamps", () => {
    expect(pendingMigrations).toEqual([
      "20260718150000_allow_phase_10e_terminal_run_classification.sql",
      "20260719080000_create_foundation_lifecycle_foundation.sql",
      "20260719120000_harden_foundation_lifecycle_diff_validation.sql",
      "20260719160000_execute_foundation_lifecycle_updates.sql",
      "20260721100000_restore_strict_terminal_run_immutability.sql",
    ]);
  });

  test("rejects unsafe RESET ROLE restoration in every pending migration", () => {
    for (const file of pendingMigrations) {
      expect(migrationSql(file)).not.toMatch(/\breset\s+role\s*;/i);
    }
  });

  test("restores all five temporary-role blocks explicitly to postgres", () => {
    for (const block of temporaryRoleBlocks) {
      const sql = migrationSql(block.migration);
      const temporaryRoleIndex = occurrenceIndex(
        sql,
        `set role ${block.temporaryRole};`,
        block.occurrence,
      );
      const restorationIndex = sql.indexOf(
        "set role postgres;",
        temporaryRoleIndex + 1,
      );
      expect(temporaryRoleIndex, block.migration).toBeGreaterThanOrEqual(0);
      expect(restorationIndex, block.migration).toBeGreaterThan(
        temporaryRoleIndex,
      );
    }
    expect(
      pendingMigrations.reduce(
        (count, file) =>
          count + (migrationSql(file).match(/\bset role postgres\s*;/gi)?.length ?? 0),
        0,
      ),
    ).toBe(5);
  });

  test("retains cleanup and direct catalog assertions in the complete chain", () => {
    for (const file of pendingMigrations) {
      const sql = migrationSql(file);
      expect(sql, file).toContain("revoke");
      expect(sql, file).toContain("from postgres");
      expect(sql, file).toContain("pg_catalog.pg_auth_members");
      expect(sql, file).toContain("pg_catalog.has_schema_privilege");
      expect(sql, file).toMatch(/current_user\s*<>\s*'postgres'/);
    }
  });

  test("does not introduce session-authorization switching", () => {
    for (const file of pendingMigrations) {
      expect(migrationSql(file)).not.toMatch(
        /\b(set|reset)\s+session\s+authorization\b/i,
      );
    }
  });
});
