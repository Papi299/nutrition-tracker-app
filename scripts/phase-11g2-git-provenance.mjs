import { execFileSync } from "node:child_process";

const gitObjectShaPattern = /^[0-9a-f]{40}$/;

export function parseGitObjectSha(value, label = "Git object SHA") {
  if (typeof value !== "string" || !gitObjectShaPattern.test(value)) {
    throw new TypeError(`${label} must be a lowercase 40-character Git object SHA.`);
  }
  return value;
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

export function readGitProvenance({
  cwd = process.cwd(),
  requireTrackedWorktreeClean = false,
} = {}) {
  const commitSha = parseGitObjectSha(
    git(["rev-parse", "HEAD"], cwd),
    "Repository commit SHA",
  );
  const treeSha = parseGitObjectSha(
    git(["rev-parse", "HEAD^{tree}"], cwd),
    "Repository tree SHA",
  );
  const trackedWorktreeCleanAtStart =
    git(["status", "--porcelain=v1", "--untracked-files=no"], cwd) === "";

  if (requireTrackedWorktreeClean && !trackedWorktreeCleanAtStart) {
    throw new Error(
      "Qualification requires a clean tracked worktree at start; preserve the current checkout and use a dedicated clean worktree.",
    );
  }

  return Object.freeze({
    commitSha,
    trackedWorktreeCleanAtStart,
    treeSha,
  });
}
