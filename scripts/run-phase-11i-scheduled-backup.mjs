import { spawnSync } from "node:child_process";

function run(script, extraArgs = []) {
  const result = spawnSync("npm", ["run", script, "--", ...extraArgs], {
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("recovery:backup");
run("recovery:retention", ["--apply"]);
