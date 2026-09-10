import { execFileSync, spawnSync } from "node:child_process";

const gitObjectShaPattern = /^[0-9a-f]{40}$/;

const postMeasurementDocumentationPaths = new Set([
  "docs/decision-log.md",
  "docs/phase-11g2-performance-capacity-qualification.md",
]);
const postMeasurementEvidenceFiles = new Set([
  "normative-browser-trace-map.json",
  "normative-performance-report.json",
  "normative-performance-samples.json",
  "operation-boundaries.json",
  "raw-evidence-manifest.json",
  "runtime-manifest.json",
]);
const postMeasurementEvidenceRoot = "performance/evidence/focused-normative/";
const postMeasurementTracePattern =
  /^traces\/trace_(?:desktop|mobile)_ctx(?:0[1-9]|10)\.zip$/;

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
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitNullSeparated(args, cwd) {
  const output = execFileSync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (output.length === 0) return [];
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

export function isAllowedPhase11g2PostMeasurementPath(filePath) {
  if (postMeasurementDocumentationPaths.has(filePath)) return true;
  if (!filePath.startsWith(postMeasurementEvidenceRoot)) return false;

  const relativePath = filePath.slice(postMeasurementEvidenceRoot.length);
  return (
    postMeasurementEvidenceFiles.has(relativePath) ||
    postMeasurementTracePattern.test(relativePath)
  );
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

export function validateMeasuredImplementationAncestor({
  cwd = process.cwd(),
  measuredCommitSha,
  measuredTreeSha,
} = {}) {
  const commitSha = parseGitObjectSha(
    measuredCommitSha,
    "Measured implementation commit SHA",
  );
  const expectedTreeSha = parseGitObjectSha(
    measuredTreeSha,
    "Measured implementation tree SHA",
  );
  const currentRepository = readGitProvenance({ cwd });

  let resolvedCommitSha;
  try {
    resolvedCommitSha = parseGitObjectSha(
      git(["rev-parse", "--verify", `${commitSha}^{commit}`], cwd),
      "Resolved measured implementation commit SHA",
    );
  } catch {
    throw new Error(
      `Measured implementation commit does not exist in this repository: ${commitSha}`,
    );
  }
  if (resolvedCommitSha !== commitSha) {
    throw new Error("Measured implementation commit did not resolve exactly.");
  }

  const actualTreeSha = parseGitObjectSha(
    git(["rev-parse", `${commitSha}^{tree}`], cwd),
    "Measured implementation tree SHA",
  );
  if (actualTreeSha !== expectedTreeSha) {
    throw new Error(
      "Reported measured implementation tree does not match the commit's exact Git tree.",
    );
  }
  if (commitSha === currentRepository.commitSha) {
    throw new Error(
      "Measured-implementation-ancestor mode requires a strict evidence descendant; use current mode at the measured commit.",
    );
  }

  const ancestry = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", commitSha, currentRepository.commitSha],
    { cwd, encoding: "utf8" },
  );
  if (ancestry.error) throw ancestry.error;
  if (ancestry.status === 1) {
    throw new Error(
      "Measured implementation commit is not an ancestor of the current evidence commit.",
    );
  }
  if (ancestry.status !== 0) {
    throw new Error(
      `Git ancestry validation failed with status ${String(ancestry.status)}.`,
    );
  }

  const changedPaths = gitNullSeparated(
    [
      "diff",
      "--name-only",
      "-z",
      "--no-renames",
      `${commitSha}..${currentRepository.commitSha}`,
      "--",
    ],
    cwd,
  );
  if (changedPaths.length === 0) {
    throw new Error(
      "Measured-implementation-ancestor mode requires a non-empty evidence-only descendant diff.",
    );
  }

  const forbiddenPaths = changedPaths.filter(
    (filePath) => !isAllowedPhase11g2PostMeasurementPath(filePath),
  );
  if (forbiddenPaths.length > 0) {
    throw new Error(
      `Post-measurement diff contains forbidden paths: ${forbiddenPaths.join(", ")}`,
    );
  }

  for (const filePath of changedPaths) {
    const treeEntry = git(
      ["ls-tree", currentRepository.commitSha, "--", filePath],
      cwd,
    );
    if (!treeEntry.startsWith("100644 blob ")) {
      throw new Error(
        `Post-measurement path must remain a normal non-executable tracked file: ${filePath}`,
      );
    }
  }

  return Object.freeze({
    changedPaths: Object.freeze([...changedPaths]),
    currentRepository,
    measuredRepository: Object.freeze({
      commitSha,
      treeSha: actualTreeSha,
    }),
  });
}
