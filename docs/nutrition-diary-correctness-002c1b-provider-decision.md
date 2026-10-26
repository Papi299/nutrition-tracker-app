# 002C1B provider and proportionality decision

Status: PROPOSED_PENDING_INDEPENDENT_REVIEW_AND_PRODUCT_OWNER_ACCEPTANCE.
Hosted-provider acceptance and Production recovery eligibility: BLOCKED / false.
Public documentation was reviewed on 2026-10-26; no project endpoint was read.

## Public evidence and its limits

| Capability | Classification | Evidence / implication |
| --- | --- | --- |
| Free-tier logical exports | Publicly documented | [Database backups](https://supabase.com/docs/guides/platform/backups) recommends off-site CLI exports for Free projects. This is not a universal DDL exclusion guarantee or this project's complete recovery proof. |
| Administrative roles | Publicly documented, project grants unverified | [Supabase role-membership restrictions](https://supabase.com/kb/troubleshooting/cant-revoke-a-role-membership-granted-by-supabase_admin) distinguishes customer `postgres` from platform `supabase_admin`. The local bootstrap superuser cannot establish customer authority over platform grants or sessions. |
| Auth schema changes | Publicly documented service behavior | [Supabase Auth compatibility contract](https://supabase.github.io/auth/) permits some database additions even in patch versions and broader schema changes in minor versions. Its [migration sources](https://github.com/supabase/auth/tree/master/migrations) confirm a separately versioned database surface. No service migration exclusion for this project was verified. |
| Platform upgrades | Publicly documented; project version unknown | [Upgrading](https://supabase.com/docs/guides/platform/upgrading) describes service upgrades alongside Postgres upgrades and Free resume behavior. The [2026-09-25 release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) describes a rollout from 17.6 to 17.11. This task deliberately retains the reviewed offline 17.6 image; it does not infer or alter any hosted version. |
| Extension versions | Publicly documented provider restriction | [2026-07-22 extension change](https://supabase.com/changelog/extension-version-pinning-ignored) limits explicit version selection for non-superusers. A customer script's VERSION clause cannot be accepted as universal provider-version control. Existing installed extensions are distinct from future installation behavior. |
| Snapshot import and locking | Supported PostgreSQL feature; locally tested only | [Snapshot synchronization](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION) and [explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html) support participating relational readers. ACCESS SHARE permits ordinary DML and only blocks conflicting lock modes. Advisory locks require cooperation. |
| Event-trigger fence | Incomplete technical coverage | [Event-trigger behavior](https://www.postgresql.org/docs/17/event-trigger-definition.html) excludes shared roles/databases/tablespaces and event triggers themselves from DDL events. A privileged administrator can disable or replace local controls. No event trigger was installed. |
| Writer / service / queue drain | Administrative convention until verified | A runbook request, point-in-time session scan or customer advisory lock does not prove all future privileged writers are excluded. Source review does not identify actual hosted jobs, services or credentials. |
| Universal provider-maintenance freeze on Free | Unsupported by reviewed evidence; not assumed available | No reviewed public source establishes a customer-enforceable freeze covering provider administrators, Auth migrations, extension/security operations and all shared metadata throughout the capture window. This is an absence of supporting evidence, not a claim that no private provider contract could ever exist. |

The first Supabase changelog fetch through the web reader rejected its Markdown
content type. A verified-TLS public curl fetch succeeded; relevant breaking
changes above were read separately. The docs-search connector was used only for
public documentation, never project discovery or database access.

## Exact prerequisite contract, currently unsatisfied

Before any proposed hosted acceptance: independently establish the complete writer
and credential inventory; close all administrative admission paths and drain
older/queued sessions; prove the source/version floor; validate native snapshot
import, backend supervision and relation coverage with actual least privileges;
obtain a provider-supported boundary covering service-owned definitions and
shared security metadata, including Auth and extension changes; independently
verify that boundary for the entire capture window; then restore and compare
all supported data/security/provider state in a separate full qualification.

Persistent server/catalog/service changes must reject a version/model mismatch.
A database restart invalidates retained sessions. Neither condition proves a
service definition stayed unchanged between observations. Change-and-revert can
commit twice while both comparisons match. Current evidence offers no universal
independent detector for such privileged races.

## Architectural blocker and smallest next decision

For the established requirement of strict coherent schema/security plus durable
Auth recovery, Strategy B lacks the provider exclusion guarantee. Strategy A
remains incomplete and the native dump itself can mix metadata; adding a default
parser alone cannot repair that boundary. Neither strategy currently establishes
the mandatory hosted guarantee. Keep Production capture refused.

The next step should be a bounded independent architecture/Product Owner decision
on this blocker and acceptable provider guarantees, using public/provider-supported
evidence. A different recovery boundary or infrastructure would be a separate
proposed contract change, not an implementation assumption. Do not start a general
catalog serializer or encrypted integration while that decision is unresolved.

## Complexity and proportionality

The immutable 002C prototype already has a control row, attempt and participant
history, a gate inventory, five operational tables, a NOLOGIN owner, state guards
and privileged procedures. This experiment adds one admission-binding table and
three invoker functions, plus fixed local process supervision. It deploys none.
There are already separately versioned migration, live model, raw observation,
function subset, admission, overlay and evidence contracts. Additional expression
parsing would couple these to PostgreSQL's internal node representation and to
provider-owned schema/version changes.

A personal-use Free project should avoid accumulating an unaccepted custom backup
platform. Prefer reusing accepted identities/admission, native tooling and strict
unsupported-state refusals; keep cutover row gates separate from metadata capture;
avoid event-trigger or generic-parser expansion. These are proposed simplifications
only. They do not remove privacy, encryption, source provenance, Auth semantics,
RPO/RTO, null/zero, snapshot history or any established recovery objective.

Costs measured by this task are two disposable local clusters and one bounded
read-only CI workflow with two CodeQL languages. No paid resource was added. The
local tests do not estimate hosted operational cost or demonstrate unattended
reconciliation. Backup machinery itself introduces lock retention, durable latches,
privileged installation and operator-error risk; fail-closed complexity is material
even when the application has one owner.
