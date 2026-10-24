# Phase B Nutrition UX Production release closeout

Recorded 2026-10-24 under `NUTRITION-PHASEB-PRODUCTION-005`. Phase B's
engineering release is complete for the protected, single-owner personal-use
scope with the limitations below. The operational outcome remains
`NUTRITION_PHASEB_PRODUCTION_004_PROMOTED_WITH_LIMITATIONS`. This record and its
runbook clarification are a documentation Draft for independent review; they
authorize no merge, deployment, provider correction or Phase C implementation.

## Verified release and closeout baseline

| Identity | Verified value |
| --- | --- |
| Repository / merged Phase B | `Papi299/nutrition-tracker-app` / [PR #197](https://github.com/Papi299/nutrition-tracker-app/pull/197) |
| Approved live source / tree | `02723650b002a607e44b1bac14f8809b5c251582` / `5f2ca6b853be6b6643590f8eda75d81f7c667ac3` |
| Canonical Production | `https://nutrition-tracker-app-xi.vercel.app` |
| Current Production deployment | `dpl_G8xjT3VzfMGCsw3NuhMnos51Wvbh` |
| Immutable candidate URL | `https://nutrition-tracker-jk33z9apg-peachys-projects-4596e52a.vercel.app` |
| Retained previous deployment / source | `dpl_13WtxbvAjfLfUQ9PV8rHQoRgPTGV` / `c87d9c0fff0ffe8dd6df8017b4b3b6478c89a8bb` |
| Vercel team / project | `team_s9dzc3uaGVF7b1NSTxQh3kNm` / `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd` |
| Production Supabase identity | `hskfanrqwtqknzpquwhg`, carried from reviewed source/backup identity; no hosted administrative read |

Fresh read-only reconciliation at approximately **05:17 UTC** found no
meaningful drift from R4. GitHub main/tree remain approved; raw candidate
`gitSource` confirms GitHub repository ID `1223506255`, `main`, and the exact
SHA; the candidate remains READY/Production with Next.js framework identity.
Lookup by canonical hostname and the live canonical alias both resolve to it;
raw project `targets.production.id` independently agrees. The previous
deployment remains retained, and the same five deployment IDs, four aliases,
and sole explicitly configured verified domain remain. All Deployments
Vercel Authentication, zero project bypass entries, direct project
`autoAssignCustomDomains=false`, and all twelve Production environment
key/ID/type/target/update metadata entries are unchanged from R4's closing
readback. No value, credential, owner record or private key is included.

The reviewed `vercel.json` still disables effective automatic Git deployment.
The connected Git integration's separate `createDeployments=enabled` metadata
does not override that repository policy. Latest deployment was not substituted
for authoritative Current Production. See the privacy-limited
[closeout verification snapshot](evidence/nutrition-phaseb-production/closeout-verification.json).

## R1–R4 operational history

The four linked reports are verbatim historical records, with their original
wording, verdicts and authority boundaries. The R3 copy includes the later owner
confirmation that no populated date is available; no fixture was created.
Reports' companion raw evidence remains in the restricted operational store,
not in Git. Do not reinterpret their old pending-action statements as current
permission or rewrite R1's failure to match the later reconciliation.

| Task / retained report | Historical verdict | Operation and finding |
| --- | --- | --- |
| [R1: candidate staging](evidence/nutrition-phaseb-production/production-001-report.md) | `NUTRITION_PHASEB_PRODUCTION_001_STAGED_VALIDATION_FAILED` | Exactly one approved Production-targeted candidate was created at `03:44:59.231Z`, READY at `03:45:29.071Z`. Canonical and Current remained old. The original zero-alias-movement criterion failed when two generated aliases moved; no repair or promotion followed. |
| [R2: alias investigation](evidence/nutrition-phaseb-production/production-002-report.md) | `NUTRITION_PHASEB_PRODUCTION_002_GENERATED_ALIAS_BEHAVIOR_CONFIRMED` | Read-only investigation confirmed expected generated-alias maintenance. `autoAssignCustomDomains` controls configured custom-domain assignment, while `automaticAliases` and branch metadata identify separate generated routes. No provider defect or corrective mutation was established. |
| [R3: owner acceptance](evidence/nutrition-phaseb-production/production-003-report.md) | `NUTRITION_PHASEB_PRODUCTION_003_ACCEPTED_WITH_LIMITATIONS` | The owner personally signed in on the exact candidate; Codex then inspected actual EN/HE Today, empty diary/missing targets, responsive shell and sampled accessibility. Populated-data scenarios were unrepresented, with reviewed synthetic tests retained as supporting evidence. |
| [R4: controlled promotion](evidence/nutrition-phaseb-production/production-004-report.md) | `NUTRITION_PHASEB_PRODUCTION_004_PROMOTED_WITH_LIMITATIONS` | Product Owner explicitly accepted R3 limitations and authorized one existing-deployment Promote operation. Provider promotion audit is `04:48:43.878Z`; canonical mapping changed at `04:48:45.425Z`. Canonical and Current moved old → exact approved candidate, with no new build/deployment or corrective setting operation. |

R4's UTC action window was `04:44:40Z–05:29:40Z`, with one attempt at
`04:48:40Z`. Promotion audit `uev_NqtfHnTAoBojAzCNRQlpSyJy` and single alias
assignment audit `uev_7OY9gfyiYJzhSfwfh4EPWhtm` identify the approved operation.
Health GET/HEAD returned 200 with expected JSON/empty body; EN/HE returned 200
with correct direction. Existing canonical owner authentication supported
read-only Today inspection in both languages. Security headers/protection and
bounded runtime checks passed. `autoAssignCustomDomains` remained false
before, immediately after, and at closing; no release-control correction was
needed. R1–R4 initiated no hosted Supabase administrative mutation, migration,
nutrition mutation, restore or new backup.

## Routing interpretation and corrected operational rule

| Surface at closeout | Destination / interpretation |
| --- | --- |
| Configured `nutrition-tracker-app-xi.vercel.app` | Approved live candidate; the sole explicitly configured Production domain, despite its `vercel.app` suffix |
| Generated `nutrition-tracker-app-peachys-projects-4596e52a.vercel.app` | Approved candidate; moving project URL, already moved during R1 |
| Generated `nutrition-tracker-app-git-main-peachys-projects-4596e52a.vercel.app` | Approved candidate; moving `main` branch URL, already moved during R1 |
| Unique `nutrition-tracker-jk33z9apg-peachys-projects-4596e52a.vercel.app` | Immutable deployment URL used for candidate acceptance |
| Historical `nutrition-tracker-app-git-ad92-fc4157-peachys-projects-4596e52a.vercel.app` | Unchanged historical `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` |
| Latest versus Current | During R1–R3 latest was the candidate while authoritative Current was old; after authorized R4 both identify the candidate |

The [first-party deployment response model](https://github.com/vercel/sdk/blob/main/docs/models/getdeploymentresponsebody2.md)
limits `autoAssignCustomDomains` to custom domains; it separately exposes
`automaticAliases`. R1's nonempty aliases and `aliasAssigned=true` therefore did
not establish canonical promotion. The actual configured-domain mappings and
Current target stayed old until R4. Generated URLs still changed what
authorized members could see before promotion, so exposure must be explicitly
inventoried and All Deployments protection verified.

The canonical [release runbook](phase-11h-deployment-architecture-release-runbook.md#controlled-staged-production-and-existing-deployment-promotion)
now states the future procedure. It distinguishes these six surfaces, preserves
configured Production mappings until separately authorized promotion, accounts
for permitted generated movements, retains protection/source/recovery gates,
and requires post-promotion canonical **and** Current-target verification plus
direct automatic-domain-assignment readback. No executable contract was changed.

## Backup and recovery disposition

Fresh workflow/artifact metadata still identifies active scheduled backup
[run `40050403210`](https://github.com/Papi299/nutrition-tracker-app/actions/runs/40050403210)
as the latest run and successful on approved main. Artifact `12543435962`
remains available, unexpired, 11,904,076 bytes, expiry
`2026-11-23T01:43:31Z`; no newer run was present in the inspected workflow
inventory. Capture started `2026-10-24T01:34:51.475Z`, completed
`01:43:29.876Z`. Its conservative 24-hour RPO deadline is
**`2026-10-25T01:34:51.475Z`**, not extended by closeout.

R4 freshly verified retained encrypted bytes against the GitHub ZIP digest,
manifest/archive hashes and exact-source ciphertext verifier. CMS
AuthEnvelopedData/AES-256-GCM, approved RSA-3072 recipient issuer/serial and
fingerprint, 44 migrations/head `20260927170418`, zero Storage, ownership,
capture consistency, redaction and cleanup passed. R5 reread metadata and
carried forward that immutable-artifact integrity evidence; it did not download,
decrypt or restore the backup or access a private key.

The release satisfied the applicable `PERSONAL_USE_FREE_TIER` recovery gate
under [DEC-040](phase-11k-personal-use-owner-readiness-baseline.md) and the
[accepted owner-backup disposition](phase-11k-p11a010-production-owner-backup-verification.md).
`currentRecoveryQualificationRequired=true` remains in force. The accepted
September 30 populated synthetic recovery and current encrypted real-owner
backup establish the applicable path for this code-only/no-schema-change
release; backup/restore tooling and recipient were unchanged. This selected
artifact remains `PENDING_RESTORE`. Formal eight-hour RTO timing and repeated
drills remain the separate `P11A-010-B1` improvement. A future restore still
requires matching owner-held key, isolated target, secret reprovisioning and
fresh provider/lifecycle reconciliation under separate authority.

## Accepted limits, CI and runtime evidence

- **Owner UX:** Actual candidate and canonical acceptance covered empty diary,
  missing targets, four localized metrics and the compact five-meal shell.
  Populated rows, historical nutrition snapshots, incomplete nutrients and
  configured-target comparisons were not independently exercised using owner
  data. The owner confirmed no populated date exists. Approved synthetic/local
  regression evidence supports these scenarios; no Production fixture was made.
- **Accessibility:** R3's bounded layout, sampled contrast/keyboard observations
  and reviewed browser/axe acceptance passed their approved scopes. Full manual
  assistive-technology or physical-device certification was not claimed. R4
  reused identical source and did not repeat the full viewport/axe matrix.
- **Accepted main CI:** [Validate and Ubuntu 26.04 provisioning](https://github.com/Papi299/nutrition-tracker-app/actions/runs/40014616223)
  and [both CodeQL analyses](https://github.com/Papi299/nutrition-tracker-app/actions/runs/40014614399)
  remain successful. Retained counts are 411 unit passes, 466 main browser
  passes/7 skips and 53 Phase 11D passes/3 skips. The Production dependency
  gate passed with critical/high/moderate/low all zero.
- **CI reliability:** Successful main Validate job `120623357103` still contains
  `public.ecr.aws` image-pull `toomanyrequests: Rate exceeded` events beginning
  `2026-10-23T19:53:08Z`, followed by 4/8-second retries and successful pulls.
  Success is not a registry-throttling-free claim. This closeout changes no CI
  behavior, retry policy, registry, dependency or test.
- **Runtime:** R4's error/fatal/warning inspection covered
  `04:48:40Z–04:53:33.811Z` without matching entries. R5's fresh candidate-scoped
  query covered **`04:53:33Z–05:17:30.745Z`** and also returned no matching
  error/fatal/warning logs; post-R4 project audit inventory was empty. These are
  bounded observations, not continuous monitoring or a guarantee of future
  traffic. No health/browser acceptance was newly repeated by R5.

## Evidence preservation and delivery boundary

The [verification snapshot](evidence/nutrition-phaseb-production/closeout-verification.json)
records fresh safe metadata and SHA-256 values for the four verbatim reports.
The R1 report remains `48d070eb9b78545f3432d11e35eaa5dc4905a9885cae3ebc9bc41edc6a4dcff2`.
Reports are historical attachments, not competing active runbooks. No backup
archive, raw provider payload, environment value, session material or private
owner nutrition record is committed. Source reports and existing branches and
worktrees are preserved.

This documentation task has **zero Production mutations**. It permits only one
isolated documentation Draft PR and exact-head validation. Hosted results and
the final documentation head/tree belong in that Draft's delivery report; main
and Production remain on the approved release while review is pending. No merge
is authorized. Future owner-data coverage, `P11A-010-B1`, any CI reliability
implementation, provider setting correction or Phase C needs separate scope.
