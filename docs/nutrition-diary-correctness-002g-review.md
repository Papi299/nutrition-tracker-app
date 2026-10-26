# 002G independent review notes

The implementation is development-only, based directly on main `50716d3759e9b75c66fe98b9c483ebb10c28b531` (tree `74776eeb63db7481baad4fa40ca86ceaa574d241`). The original checkout and PR200–207 remain unchanged, Draft and unmerged. Nothing here authorizes merge or Production work.

## Scope and provenance

- `scripts/nutrition-002g/contract.mjs`: exact local profile, migration boundaries, structural validation and separately rooted signed owner/operator approval.
- `capture.mjs`: a single PostgreSQL snapshot, local catalog/role locks, complete table data, minimal identity projection, independently reconstructed schema/security and value/FK comparison. No source DDL execution.
- `archive.mjs`: the existing reviewed CMS AuthEnvelopedData design, implemented for a distinct local v1 JSON payload and source/recipient/version-bound manifest. It does not change existing Phase 11I format or producers.
- `identity.mjs`: supported real Auth API same-UUID creation with fresh credentials and no raw provider-row import.
- `local.mjs` / `process.mjs`: narrow same-repository extraction of PR206 resource-isolation and PR201 bounded process/session techniques. Direct imports resolve only within 002G. Unused historical catalog/overlay frameworks and generated metadata are not imported.
- `mail-local.mjs` / `mail-sink.mjs`: limited extraction of PR207's receiving-only synthetic mail fixture. No recent-auth proof imports, password-HMAC fixture integration, raw Auth copy, SARIF suppression or unresolved OTP behavior is reused.
- `fixtures.mjs` / `qualify-local.mjs`: synthetic application RPC fixtures and actual 44/45 capture/encryption/restore/Auth/security negatives. Migration-45 null/zero checks use its stored object representation, distinct from the request array. The provider-generated `email_verified: true` marker is recognized explicitly; unknown metadata remains blocked.
- `check-sarif.mjs`: PR202's strict successful-analysis/zero-findings check, adapted only for the new evidence schema label.
- `ops/recovery/nutrition-002g-migrations.json`: all 45 SQL identities/hashes recomputed independently; PR200 supplied the fixed historical-source research, not a branch base or an imported producer change.
- `.github/workflows/nutrition-002g-local.yml`: exact-head, same-repository Draft-only branch gate, read-only token, pinned actions/images, bounded jobs, no Production secrets, cache or artifact uploads. Workflow policy recognizes its exact reviewed bytes; existing policy/negative tests remain intact.
- `docs/nutrition-diary-correctness-002g-{design,runbook}.md`: bounded architecture, manual custody/owner verification, actual local commands and explicit future authorization gates.

All reused implementation comes from this same user-authorized repository and retains its repository provenance. Provider implementations are not copied; their immutable official images execute independently. No package/dependency lock, migration, frozen nutrient manifest, application component or Production backup file changes.

## Validation

The sanitized local qualification file records **31 passing groups**, no skips, Node 22.23.4 and complete cleanup. Its implementation digest binds the exact ten executable local recovery modules. Earlier development attempts failed on a local ledger-owner fixture, JSON key ordering, request-versus-storage snapshot shape and a conservative provider-metadata predicate; none was accepted as passing evidence. These were fixture/comparison/profile implementation corrections, not nutrition formula, migration or Production changes.

Focused checks passed: six new contract/security tests; existing recovery contract regressions; nine workflow/provisioning policy tests; 16 nutrient snapshot units; lint; typecheck; production build and 115-artifact client-secret scan; production advisory gate with zero advisories. The first network-restricted advisory attempt was indeterminate; the network-enabled read-only retry passed. No local full application browser rerun was requested. Existing repository CI may run its unchanged complete gate automatically on the Draft.

Authoritative exact-head CI/CodeQL results must be linked in the PR after completion. No passing local result substitutes for those gates. There is no production-ready label or automatic release action.

## Deliberate operational limits

The exercised identity profile has no required extra factors. A real enrolled TOTP factor caused capture to refuse, as required; it was removed only from the disposable negative fixture through Auth's API. It is never discarded during recovery. Hosted methods/configuration, keys, Storage, Vault and effective administrative privileges remain uninspected and unqualified.

The local catalog lock mechanism is not a claim about hosted Supabase permissions. The new v1 archive cannot automatically read existing real Phase 11I artifacts. An authorized real-artifact independent restore, hosted configuration/preflight, custody/free-capacity review and later backup-producer cutover remain release prerequisites. The 24h RPO and 30-day retention are unchanged objectives/policy; 8h RTO is aspirational and not demonstrated. No actual network-level post-commit acknowledgement-loss fault was injected; the manual procedure requires state inspection and forbids blind retry.

The next bounded checkpoint is explicit authorization for a non-secret hosted recovery-profile preflight. It must precede any real-artifact/hosted adaptation and does not authorize migration, deployment or backup dispatch.

CI correction: initial run 40371887909 passed both zero-findings CodeQL analyses but the ECR mirror refused its first image pull with a data-limit response. The official Docker Hub locations use the identical reviewed immutable digests; no provider version changes. Initial standard CI 40371887785 exposed four undocumented local/CI environment reads. The deployment contract now explicitly documents CANDIDATE_SHA, ANALYSIS_LANGUAGE, PATH and HOME; the checker is not weakened and no hosted environment value is changed.

Final review also requires an exact identity-field inventory and typed lifecycle flags. Missing/unknown fields and truthy strings cannot qualify an identity; an unset provider ban is explicitly projected as false. Focused negatives cover these cases.
