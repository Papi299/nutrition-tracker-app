# Phase 11K P11A-009 policy and data-governance packet

**Status:** `P11A009_POLICY_PACKET_COMPLETE_PENDING_OWNER_AND_QUALIFIED_REVIEW`

**Finding:** `P11A-009`, P0, `OPEN_OWNER_OR_POLICY_DECISION_PENDING`

**Scope:** repository facts and drafts only. This packet is neither legal advice nor qualified approval. It does not close a finding, approve a candidate, authorize Production, access a provider, or change runtime behavior.

## Baseline and evidence boundary

The verified `main` commit is `34d9e7859fe001f54ce2810a4cb3eb1cfadbda5d`, tree `ab1116a1fe540e8ae4b7491d42ac47a84fe89bd4`, subject `docs(phase11k): record integrated acceptance dispositions (#157)`. PR #157 was merged and the initial open-PR count was zero. [Integrated acceptance](phase-11k-integrated-acceptance.md) records Phase 11K started, Phase 11 incomplete, four closed and fourteen open findings. P11A-003 stays separately open; these drafts do not constitute its native EN/HE or affected-surface review.

The [machine-readable evidence and complete data-flow matrix](../deployment/phase-11k-p11a009-policy-data-governance-evidence.json) are part of this packet. `UNRESOLVED` means neither implementation nor accepted evidence proves the field. Existing engineering decisions are distinguished below from policy choices awaiting the Product Owner and qualified review. The repository proves schema and code behavior; it does not prove current hosted contents, access grants, retention enforcement, or provider terms without a separately authorized refresh. **`PROVIDER_REFRESH_REQUIRED`:** current hosted register/access proof, hosted logs/retention, provider terms and live Storage-object scope cannot be established from accepted repository evidence. No provider was queried for this packet.

## Technical facts and current decisions

- Supabase Auth supplies identity, email and sessions. `public.account_activations` records activation and eligibility statement version. `public.account_closures` holds a unique, immutable user and server-generated closure-request ID, timestamp and policy version. A closed identity fails the common application-access predicate. [Activation migration](../supabase/migrations/20260827070838_create_invited_account_activation.sql), [closure migration](../supabase/migrations/20260829030137_implement_account_closure_lifecycle.sql).
- Profile stores display name, preferred language and metric unit system; targets retain effective dates and calories/macronutrients. Diary entries store dated food/portion/nutrient snapshots and notes; foods, favorites, saved meals, recipes and their use/creation receipts exist. No weight, height, date of birth, diagnosis, or other body/anthropometric column was found in the application schema or account export. [Profile/target schema](../supabase/migrations/20260429163444_create_profiles_and_nutrition_targets.sql), [export schema](../lib/account-export/schema.ts).
- A recent password reauthentication is required for export and closure. Export is a synchronous JSON download of account identity metadata, activation, profile, effective-dated targets, diary, owned foods with aliases/barcodes/nutrients, favorites, saved meals, recipes, selected activity receipts and referenced source data. It excludes Auth tokens/passwords, restricted register, shared full catalog and unrelated ingestion/security data. It creates no durable export job. [Collector](../lib/account-export/collector.ts), [export route](<../app/[locale]/(app)/account/export/download/route.ts>), [11E4 evidence](phase-11e4-account-export-validation.md).
- Closure is immediate **logical application closure**. The database commits the closure row; product data, activation and historical receipts remain physically unchanged. The Auth user is not deleted. Global sign-out and local cleanup are attempted after commit, but cross-session provider revocation is not established. Product data becomes inaccessible through application/RLS guards. There is no supported reactivation path, grace period, physical erasure, or pseudonymization in this implementation. Export must occur before closure; it fails after commit. [Closure route](<../app/[locale]/(app)/account/closure/submit/route.ts>), [11E governance](phase-11e-auth-account-lifecycle-governance.md), [11E5 validation](phase-11e5-account-closure-validation.md).
- The closure capability is short lived, bound to recent authentication and checked with a protected database-local secret. The capability and Vault secret value are not an account export field or backup artifact. [Capability](../lib/account-closure/capability.ts), [recovery qualification](phase-11i-recovery-qualification.md).
- The shared catalog contains USDA FoodData Central source metadata, imported food/portion/nutrient projections and provenance/ingestion records. The app already renders source labels in search, food selection, reuse and barcode surfaces; `USDA FoodData Central` is localized in both message catalogs. The ingestion distributor metadata calls for citation and applicable release retention. A global final attribution statement and license/citation review remain open. [Source migration](../supabase/migrations/20260718100000_create_ingestion_governance_foundation.sql), [food page](<../app/[locale]/(app)/foods/page.tsx>), [EN labels](../messages/en.json), [HE labels](../messages/he.json).
- Application telemetry uses validated, bounded event fields and an informational console sink. The contract excludes user/Auth/session IDs, food/nutrition data, free text, raw errors and secrets; it has no telemetry database. The accepted operational policy says 30 days, while actual hosted log retention and grants remain `UNRESOLVED`. No general support impersonation or application admin-read screen was found. Server routes use the user-scoped Supabase client; privileged admin/service-role use appears in local qualification/provisioning scripts, not ordinary app runtime. Project-level provider operators can potentially inspect data, subject to actual access control and audit proof. [Events](../lib/observability/events.ts), [observability](phase-11g1-reliability-observability-foundation.md), [server client](../lib/supabase/server.ts).

### Account lifecycle vocabulary

| Term | Current behavior |
| --- | --- |
| Closure | Irreversible application access denial plus immutable closure receipt. |
| Deactivation | No separately defined reversible deactivation state. |
| Logical deletion | Closure blocks application access; underlying rows remain. |
| Pseudonymization | Not implemented for product/Auth/receipts. |
| Physical deletion | Not performed by closure; Auth deletion is constrained by closure-row foreign key and requires a future designed procedure. |
| Backup copy | Recovery-point data stays in encrypted archives for the applicable backup retention. |
| Restore | Earlier data can return; lifecycle state must be reconciled before traffic resumes. |

### Backup and restore privacy contract

[Phase 11I recovery qualification](phase-11i-recovery-qualification.md) accepts **24-hour RPO**, **8-hour RTO**, and a recovery-qualified isolated restore. The [recurring backup runbook](phase-11i-github-artifact-backup-automation.md) uses an encrypted CMS archive and redacted manifest as GitHub Actions artifacts with **30-day expiry**; the private decryption key is held separately. The original qualified backup is stored outside Git and its final disposition is `UNRESOLVED`. The archive covers `public` and `ingestion` data, migration/security structure, and durable `auth.users`, `auth.identities`, `auth.mfa_factors`, and `auth.webauthn_credentials`. Volatile sessions, refresh/one-time tokens and flow state, Storage object bytes, and Vault values are excluded. The accepted source had zero Storage objects; a nonzero scope triggers a fail-closed backup expansion gate. A restore needs secret reprovisioning and fresh provider-configuration checks.

**Post-restore reconciliation requirement, not an implemented mechanism:** Before any Production traffic cutover, identify the recovery point and compare an authoritative, access-controlled post-point lifecycle/retention record against restored Auth, activation, closure, product and restricted-register state. Specifically account for closures after the recovery point, record changes/deletions and retention expirations since it, invitations and activation changes, support restrictions, and any provider-side Auth state. Reapply approved closure/deletion/retention decisions under separate authority, verify no closed identity regains application access, record operator and independent reviewer, source evidence, actions and unresolved discrepancies, then obtain cutover approval. Stop if that authoritative record or a reconciliation result is missing. Current tooling validates archive/restore integrity but provides **no automated post-restore privacy reconciliation**. This is a bounded future operational/implementation follow-up, not part of the present packet.

### Support, providers and source attribution

The accepted [restricted register design](phase-11h-deployment-architecture-release-runbook.md#15-restricted-invitation-register-contract) defines environment, canonical-email index/controlled contact reference, eligibility/cohort evidence, status, Auth ID, operation/result, operator/reviewer, timestamps, attempt count, provider class, application lifecycle, candidate/configuration, reconciliation, approval/evidence, and append-only correction link. Access is designed for named Auth/lifecycle, invitation, operator, reviewer and approved auditor roles. Raw email belongs only in encrypted or separately restricted contact storage; tokens and secrets are prohibited. Retention is designed as active private-beta period plus 90 days, subject to shorter reviewed schedule/hold. **No store is selected or populated; operational access, retention, correction and `ACCOUNT_CLOSED` execution remain unproved.** DEC-035 makes external invitation/register operation inactive in the current personal-use profile, without resolving policy governance.

The factual provider matrix is also in the JSON. Controller/processor classification, contracts, transfer geography, provider retention and access terms are `QUALIFIED_REVIEW_REQUIRED`; no classification is adopted here.

| Provider | Architecture role and data categories | Production/development boundary | Evidence | Review need |
| --- | --- | --- | --- | --- |
| Supabase | Auth identity/session, application/ingestion database, potential Storage/Vault | Hosted Production project; local and isolated non-production qualification | [server client](../lib/supabase/server.ts), [recovery scope](phase-11i-recovery-qualification.md) | Provider terms, access, retention and location: `QUALIFIED_REVIEW_REQUIRED` |
| Vercel | App requests, necessary cookies and validated console events; hosted log scope `UNRESOLVED` | Configured Preview/staging/Production architecture; only bootstrap deployment evidenced | [deployment runbook](phase-11h-deployment-architecture-release-runbook.md), [event sink](../lib/observability/events.ts) | Hosted logs, terms, access and location: `QUALIFIED_REVIEW_REQUIRED` |
| GitHub | Source/CI, redacted evidence, encrypted backup archive and manifest | Development/operations and recurring Production backup transport | [backup workflow](../.github/workflows/phase-11i-production-backup.yml), [artifact model](phase-11i-github-artifact-backup-automation.md) | Ciphertext/artifact access and terms: `QUALIFIED_REVIEW_REQUIRED` |
| USDA FoodData Central | Upstream imported food/portion/nutrient and provenance source; no live user-data transmission shown | Controlled ingestion and shared reference catalog | [source governance migration](../supabase/migrations/20260718100000_create_ingestion_governance_foundation.sql) | Attribution, release citation and source terms: `QUALIFIED_REVIEW_REQUIRED` |

**Proposed source attribution (EN):** “Some food information is based on USDA FoodData Central. The displayed values and portions may reflect imported source data and application transformations; check the source and serving details before using them.”

**Proposed source attribution (HE):** “חלק ממידע המזון מבוסס על USDA FoodData Central. הערכים והמנות המוצגים עשויים לשקף נתוני מקור שיובאו ועיבוד שבוצע ביישום; יש לבדוק את המקור ואת פרטי המנה לפני השימוש.”

Status: `DRAFT_PENDING_QUALIFIED_REVIEW`. Exact release citation, location on every affected surface, correction/takedown and legal/license interpretation remain open.

## Retention decisions and enforcement

No final Product Owner duration exists for Auth identity, product records, activation, closure/immutable receipts, source records, support evidence or qualified backup copy. The only accepted numbers here are the recurring artifact 30 days, operational telemetry policy 30 days, and restricted-register **design** of active beta plus 90 days. None silently sets a legal retention rule for every copy. The [Product Owner decision table](phase-11k-p11a009-product-owner-decisions.md) records active, post-closure, operational and backup interaction per class, present enforcement, gaps, and review order. All unset values are `PRODUCT_OWNER_DECISION_REQUIRED`.

## Drafts and required review

- [English privacy notice, health disclaimer and account-closure copy](privacy-notice-draft-en.md)
- [Hebrew privacy notice, health disclaimer and account-closure copy](privacy-notice-draft-he.md)
- [Product Owner decisions](phase-11k-p11a009-product-owner-decisions.md)
- [Qualified legal/privacy review questions](phase-11k-p11a009-qualified-review-checklist.md)

The drafts are not published product policy. Contact identity/channel, final retention/deletion schedule, provider terms, source citation and exact bilingual copy await attributable decisions. After those decisions, P11A-003 still requires a separate native EN/HE and affected-surface RTL/mixed-content review. P11A-009 remains open P0; launch authorization remains ineligible, candidate approval false and Production authorization false.

## Human-readable data-flow matrix

The following is generated from the JSON evidence. Each actual class includes source, purpose, location, access, export, logical closure, physical deletion, pseudonymization, backup, evidence, support access, providers, current retention, unresolved decision, restore and closure implications. `UNRESOLVED` is deliberate.

### Auth identity, user ID and email

| Field | Current fact or gap |
| --- | --- |
| Source | Supabase Auth invitation and sign-in |
| Purpose | Account identity and authentication |
| Storage | auth.users; auth.identities |
| Access boundary | Provider-owned; app reads current user |
| Account export | id/email/created_at |
| Logical closure | Application access denied by closure record |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Auth identity remains; removal procedure deferred. |
| Evidence | `docs/phase-11i-recovery-qualification.md`, `lib/account-export/schema.ts`, `supabase/migrations/20260829030137_implement_account_closure_lifecycle.sql` |

### Volatile Auth sessions and recovery/invitation flow state

| Field | Current fact or gap |
| --- | --- |
| Source | Supabase Auth |
| Purpose | Session and account flows |
| Storage | Auth provider volatile tables and browser session cookies |
| Access boundary | Authenticated identity/provider |
| Account export | NO |
| Logical closure | Best-effort global sign-out and local cleanup; cross-session revocation unproved |
| Physical deletion | UNRESOLVED |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase, Vercel |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Excluded from recovery archive; users must reauthenticate. |
| Closure/deletion | Closed-account DB predicate still denies app access. |
| Evidence | `docs/phase-11i-recovery-qualification.md`, `lib/auth/session-cleanup.ts`, `lib/supabase/server.ts` |

### Invitation-control register

| Field | Current fact or gap |
| --- | --- |
| Source | Authorized future operator |
| Purpose | Eligibility, issuance, limits, reconciliation and corrections |
| Storage | External restricted store not selected or populated |
| Access boundary | Restricted operator/reviewer design; operational access proof absent |
| Account export | NO |
| Logical closure | Append ACCOUNT_CLOSED is specified but not executed |
| Physical deletion | UNRESOLVED |
| Pseudonymization | UNRESOLVED |
| Database backup | NO |
| Operational evidence | Redacted evidence only by design; execution absent |
| Support/admin access | Accepted named roles in design; operational proof absent |
| Providers | UNRESOLVED |
| Current retention | Active private-beta period plus 90 days in design; enforcement unproved |
| Unresolved decision | Qualified review of schedule, store, deletion and disclosure required |
| Restore | External register must reconcile separately after restore. |
| Closure/deletion | No automatic register mutation on closure. |
| Evidence | `docs/phase-11h-deployment-architecture-release-runbook.md`, `docs/phase-11e-integration-external-readiness-handoff.md` |

### Account activation and eligibility attestation

| Field | Current fact or gap |
| --- | --- |
| Source | User activation after invitation |
| Purpose | Application access eligibility |
| Storage | public.account_activations |
| Access boundary | Authenticated own row; server-derived identity |
| Account export | YES |
| Logical closure | Retained |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Immutable activation remains after closure. |
| Evidence | `supabase/migrations/20260827070838_create_invited_account_activation.sql`, `lib/account-export/schema.ts` |

### Account closure receipt and request ID

| Field | Current fact or gap |
| --- | --- |
| Source | Server-generated closure transaction |
| Purpose | Idempotent immutable closure and policy version |
| Storage | public.account_closures |
| Access boundary | Own-row select; atomic server/DB write |
| Account export | NO |
| Logical closure | Is the closure gate |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | A pre-closure backup can omit later closure; reapply verified lifecycle state before access. |
| Closure/deletion | No Auth or product-row deletion. |
| Evidence | `supabase/migrations/20260829030137_implement_account_closure_lifecycle.sql`, `app/[locale]/(app)/account/closure/submit/route.ts` |

### Closure capability

| Field | Current fact or gap |
| --- | --- |
| Source | Server-issued E3-bound capability |
| Purpose | Authorize atomic closure |
| Storage | Transient server request plus database-local Vault secret |
| Access boundary | Server and protected DB function |
| Account export | NO |
| Logical closure | Expires; no durable export |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | NO |
| Support/admin access | Server-only; no ordinary admin UI |
| Providers | Supabase, Vercel |
| Current retention | Short-lived capability; exact retention UNRESOLVED |
| Unresolved decision | Secret lifecycle/reprovisioning after restore |
| Restore | Vault value excluded from backup; reprovision under incident plan. |
| Closure/deletion | Capability is not account data erasure. |
| Evidence | `lib/account-closure/capability.ts`, `docs/phase-11i-recovery-qualification.md` |

### Profile and preferences

| Field | Current fact or gap |
| --- | --- |
| Source | User setup |
| Purpose | Display name, language and unit preference |
| Storage | public.profiles |
| Access boundary | Authenticated owner via RLS |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `supabase/migrations/20260429163444_create_profiles_and_nutrition_targets.sql`, `lib/account-export/schema.ts` |

### Effective-dated nutrition targets

| Field | Current fact or gap |
| --- | --- |
| Source | User setup and edits |
| Purpose | Track goals and history |
| Storage | public.nutrition_targets |
| Access boundary | Authenticated owner via RLS |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `supabase/migrations/20260429163444_create_profiles_and_nutrition_targets.sql`, `lib/account-export/schema.ts` |

### Diary entries, portions, nutrients and snapshots

| Field | Current fact or gap |
| --- | --- |
| Source | User entries and linked food/meal/recipe use |
| Purpose | Nutrition journal |
| Storage | public.diary_entries |
| Access boundary | Authenticated owner via RLS |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `supabase/migrations/20260630193832_create_diary_entries.sql`, `lib/account-export/schema.ts` |

### Owned custom foods, aliases, barcodes and nutrient values

| Field | Current fact or gap |
| --- | --- |
| Source | User creation |
| Purpose | Reusable food catalog |
| Storage | public.foods; food_aliases; food_barcodes; food_nutrients |
| Access boundary | Authenticated owner / owned aggregate |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `supabase/migrations/20260714120000_custom_food_persistence_foundation.sql`, `lib/account-export/collector.ts` |

### Food favorites

| Field | Current fact or gap |
| --- | --- |
| Source | User action |
| Purpose | Food reuse |
| Storage | public.food_favorites |
| Access boundary | Authenticated owner via RLS |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `lib/account-export/collector.ts`, `supabase/migrations/20260716100000_add_food_favorites_and_reusable_foods.sql` |

### Saved meals, items and diary-use runs

| Field | Current fact or gap |
| --- | --- |
| Source | User authoring and use |
| Purpose | Reusable meals and immutable use evidence |
| Storage | public.saved_meals; saved_meal_items; saved_meal_diary_runs |
| Access boundary | Authenticated owner via RLS |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `lib/account-export/collector.ts`, `supabase/migrations/20260716130000_log_saved_meal_to_diary.sql` |

### Recipes, ingredients and diary-use runs

| Field | Current fact or gap |
| --- | --- |
| Source | User authoring and use |
| Purpose | Recipe nutrition and use evidence |
| Storage | public.recipes; recipe_ingredients; recipe_diary_runs |
| Access boundary | Authenticated owner via RLS |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Application access blocked after closure; rows retained. |
| Evidence | `lib/account-export/collector.ts`, `supabase/migrations/20260717130000_log_recipe_to_diary.sql` |

### User mutation receipts

| Field | Current fact or gap |
| --- | --- |
| Source | Server/database request completion |
| Purpose | Idempotency and historical integrity |
| Storage | public.custom_food_creation_requests; manual_diary_entry_requests |
| Access boundary | Authenticated owner; server/DB transaction |
| Account export | YES |
| Logical closure | Application access blocked after closure; rows retained. |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | UNRESOLVED |
| Support/admin access | Supabase privileged project/operator access possible; authorization and audit proof UNRESOLVED. |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | No Product Owner post-closure duration approved. |
| Restore | Restore can reintroduce pre-recovery-point values; reconcile before traffic cutover. |
| Closure/deletion | Receipt deletion/pseudonymization deferred. |
| Evidence | `lib/account-export/schema.ts`, `docs/phase-11e-auth-account-lifecycle-governance.md` |

### Shared food catalog and USDA provenance

| Field | Current fact or gap |
| --- | --- |
| Source | Reviewed source imports |
| Purpose | Search/reference nutrition and attribution |
| Storage | public.food_sources; foods; food_nutrients; ingestion.food_portions; ingestion schema |
| Access boundary | Shared/reference or ingestion operator-owned |
| Account export | Referenced subset only |
| Logical closure | Not tied to account closure |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | Approved source/release evidence may be retained |
| Support/admin access | Ingestion operator/project admin; exact operational grant review required |
| Providers | USDA FoodData Central, Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | Source retention and correction/takedown decision required |
| Restore | Restore source projection and provenance consistently. |
| Closure/deletion | Shared source rows are not deleted with one account. |
| Evidence | `supabase/migrations/20260718100000_create_ingestion_governance_foundation.sql`, `lib/account-export/schema.ts`, `docs/phase-11i-recovery-qualification.md` |

### Search and barcode lookup inputs

| Field | Current fact or gap |
| --- | --- |
| Source | User query / camera-derived code |
| Purpose | Find foods |
| Storage | Request/browser processing; no dedicated search-history table identified |
| Access boundary | Authenticated runtime |
| Account export | NO |
| Logical closure | No account-linked history identified |
| Physical deletion | UNRESOLVED |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | UNRESOLVED |
| Support/admin access | No direct support UI identified |
| Providers | Vercel, Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | Provider log behavior and retention require refresh |
| Restore | No search-history restore path established. |
| Closure/deletion | No stored history deletion claim. |
| Evidence | `lib/food-search/search.ts`, `app/[locale]/(app)/foods/barcode/page.tsx` |

### Operational telemetry and security correlation

| Field | Current fact or gap |
| --- | --- |
| Source | Server allowlisted events |
| Purpose | Reliability and incident detection |
| Storage | Console sink / hosting logs; no telemetry DB |
| Access boundary | System-owned; validated fields exclude user/food IDs and free text |
| Account export | NO |
| Logical closure | Not account-linked by design |
| Physical deletion | UNRESOLVED |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | YES |
| Support/admin access | Operator access via hosting/log permissions; exact grants UNRESOLVED |
| Providers | Vercel |
| Current retention | 30-day operational retention policy; hosted enforcement UNRESOLVED |
| Unresolved decision | Verify hosted log retention and access |
| Restore | No database row to restore; provider logs outside archive. |
| Closure/deletion | Outside account export/closure. |
| Evidence | `lib/observability/events.ts`, `docs/phase-11g1-reliability-observability-foundation.md`, `docs/incident-response-runbook.md` |

### Support/operator and security evidence

| Field | Current fact or gap |
| --- | --- |
| Source | Authorized support/incident procedures |
| Purpose | Audit and response |
| Storage | Restricted external evidence and GitHub redacted docs/artifacts |
| Access boundary | System-owned; no general app support read interface |
| Account export | NO |
| Logical closure | Separate review required |
| Physical deletion | UNRESOLVED |
| Pseudonymization | UNRESOLVED |
| Database backup | UNRESOLVED |
| Operational evidence | YES |
| Support/admin access | Accepted roles/policy; actual access proof UNRESOLVED |
| Providers | GitHub, Vercel, Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | Evidence access and retention schedule required |
| Restore | Preserve/reconcile incident evidence under restricted control. |
| Closure/deletion | Not removed by app closure. |
| Evidence | `docs/phase-11h-deployment-architecture-release-runbook.md`, `docs/incident-response-runbook.md` |

### Encrypted logical backup archive

| Field | Current fact or gap |
| --- | --- |
| Source | Phase 11I recovery workflow |
| Purpose | Recover durable Auth, public and ingestion state |
| Storage | GitHub Actions artifact; original qualified copy in restricted off-Git store |
| Access boundary | Restricted recovery operator; ciphertext may be downloadable |
| Account export | NO |
| Logical closure | Contains recovery-point state including accounts then active |
| Physical deletion | Artifact expiry; no per-user edit |
| Pseudonymization | NO |
| Database backup | YES |
| Operational evidence | Redacted manifest only |
| Support/admin access | Recovery key held separately |
| Providers | GitHub, Supabase |
| Current retention | Recurring artifact 30 days; original qualified copy disposition UNRESOLVED |
| Unresolved decision | Approve qualified-copy and closure interaction |
| Restore | Can resurrect later closed/deleted state absent reconciliation. |
| Closure/deletion | No per-user erasure mechanism in existing archive. |
| Evidence | `docs/phase-11i-github-artifact-backup-automation.md`, `docs/phase-11i-recovery-qualification.md` |

### Redacted backup manifest

| Field | Current fact or gap |
| --- | --- |
| Source | Backup workflow |
| Purpose | Integrity and scope verification |
| Storage | GitHub Actions artifact |
| Access boundary | System-owned |
| Account export | NO |
| Logical closure | Not account-specific by design |
| Physical deletion | Artifact expiry |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | YES |
| Support/admin access | Recovery operator |
| Providers | GitHub |
| Current retention | 30-day recurring artifact expiry |
| Unresolved decision | Manifest/qualified-copy retention review |
| Restore | Use to identify recovery point and scope. |
| Closure/deletion | No direct account closure mutation. |
| Evidence | `docs/phase-11i-github-artifact-backup-automation.md` |

### Recovery qualification evidence

| Field | Current fact or gap |
| --- | --- |
| Source | Isolated restore rehearsal |
| Purpose | Audit RPO/RTO/integrity |
| Storage | Repository redacted docs/evidence; restricted source archive outside Git |
| Access boundary | System-owned |
| Account export | NO |
| Logical closure | No user-level payload in public evidence by design |
| Physical deletion | UNRESOLVED |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | YES |
| Support/admin access | Recovery roles |
| Providers | GitHub |
| Current retention | UNRESOLVED |
| Unresolved decision | Evidence retention review |
| Restore | Record reconciliation results for any future restore. |
| Closure/deletion | Separate from application closure. |
| Evidence | `docs/phase-11i-recovery-qualification.md`, `docs/phase-11i-recovery-qualification-evidence.json` |

### Storage objects and Vault values

| Field | Current fact or gap |
| --- | --- |
| Source | Provider storage/secrets if provisioned |
| Purpose | Potential object data and closure secret |
| Storage | Supabase Storage / Vault |
| Access boundary | Provider/project admin |
| Account export | NO |
| Logical closure | No Storage action on closure |
| Physical deletion | NO |
| Pseudonymization | NO |
| Database backup | NO |
| Operational evidence | Only zero-object gate and redacted identifier |
| Support/admin access | Privileged provider access |
| Providers | Supabase |
| Current retention | UNRESOLVED |
| Unresolved decision | Scope expansion if Storage nonzero; secret rotation policy |
| Restore | Storage bytes excluded; Vault values must be reprovisioned. |
| Closure/deletion | Accepted production evidence had zero objects, not a perpetual guarantee. |
| Evidence | `docs/phase-11i-recovery-qualification.md`, `docs/phase-11e-auth-account-lifecycle-governance.md` |
