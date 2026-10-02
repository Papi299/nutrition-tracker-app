import { assertApprovedProductionTransport, fail } from "./phase-11i-recovery-contract.mjs";
import { readPsqlRows } from "./phase-11i-psql-diagnostics.mjs";

export function createLinkedSourceTransport({
  runSupabase, psqlBinary, readRows = readPsqlRows, environment = process.env,
}) {
  function parseLinkedEnvironment() {
    const output = runSupabase(["db", "dump", "--linked", "--dry-run"]);
    const linked = {};
    for (const name of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]) {
      const match = output.match(new RegExp('^export ' + name + '="([^"]+)"$', "m"));
      if (!match) fail("Linked transport omitted " + name + ".");
      linked[name] = match[1];
    }
    assertApprovedProductionTransport(linked);
    return {
      ...environment,
      ...linked,
      PGCONNECT_TIMEOUT: "20",
      PGSSLMODE: "require",
    };
  }

  let linkedEnvironment = parseLinkedEnvironment();
  return {
    rows(sql, stage) {
      return readRows({ psqlBinary, sql, environment: linkedEnvironment, stage });
    },
    refreshSourceTransport() {
      // Replace the complete approved environment before any post-dump read.
      linkedEnvironment = parseLinkedEnvironment();
    },
  };
}
