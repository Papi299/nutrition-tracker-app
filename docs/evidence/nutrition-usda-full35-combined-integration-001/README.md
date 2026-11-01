# Combined Full35 integration evidence

The integration branch initially points to qualified Stage4B commit
`5cac08e0415ab1c5a08d0304f0e55586049c6cdb`, tree
`0f7da2f53cfb6345ee335d1bf80564f60cbf7b77`. The complete initial cumulative
inventory is recorded in `initial-source-inventories.json`: 41 Stage4A paths,
36 Stage4B paths, and exactly 71 cumulative paths, with before/after Git blob
identities proving composition. The original Draft PR219 and PR220 remain
unchanged. This candidate does not authorize a merge or hosted operation.

## Squash topology correction

A disposable commit with the reviewed combined tree and approved main as its
sole parent reproduced two failures after all feature commit objects were
excluded: CodeQL's Stage4A ancestor requirement and the recovery test's Git
lookup of defective migration47. See `original-squash-defect-reproduction.json`.

`accepted-stage4a.bundle` is a bounded 141,479-byte Git source bundle. It
contains the exact accepted Stage4A commit and its reviewed source objects,
with only approved main `cd61608d1c8668cd27128b1ef2710becd2057283` as a
prerequisite. SHA-256:
`fa07eeff31a40f4935c97b4809c8a877d09ff0d8a25032316b1a20239c8ab6f2`.
The resolver verifies the bundle hash, header, prerequisite, commit and tree,
then imports objects from this local evidence without updating branches or
requiring a feature ref or network. CodeQL still scans the complete exact
candidate and fresh exact Stage4A baseline with the pinned official CLI and
queries. Only identical findings in byte-unchanged source files may match;
new or changed findings still fail.

`defective-migration47.sql.historical` is the byte-identical original migration
from `2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b`, independently matched with
the bundle. SHA-256:
`907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703`.
It is immutable rejected test evidence, outside the migration directory. The
actual corrected migration remains
`086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af`.

The existing mandatory workflow-security tests import the squash regressions.
They reconstruct a main-only repository, prove feature commits initially
absent, create a same-tree sole-parent squash, resolve the exact baseline
offline without ref changes, and reject altered bundle bytes. Existing
workflow PR/push/manual-event policy and mandatory checks remain unchanged.

The fixtures contain only previously committed reviewed source. They contain
no restricted identities, USDA bulk archives, user data, encryption keys or
backup payloads. No application, scientific mapping, migration, lockfile,
Supabase configuration, Vercel configuration or deployment policy is changed
by this integration correction. Final exact-head runtime/CI qualification and
the A–Q delivery report are recorded in the Draft integration PR and bounded
external review package after qualification; this implementation snapshot
does not claim those pending checks have completed.
