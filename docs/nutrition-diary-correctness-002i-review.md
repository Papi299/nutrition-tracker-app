# 002I implementation and qualification review

This is a small, local-only adapter stacked on PR208 head
`8fbfb542682e1b635c7fedd3b2bf606729516d45`, tree
`381bce86f5dea7f32d434155e07fbcb5da6cadb7`. Its parent PR remains Draft/unmerged.
No hosted access, real backup, Production migration, deployment, merge or spending occurred.

## Changes

- `scripts/nutrition-002i/adapter.mjs`: read-only snapshot capture as restricted
  postgres; permitted relation locks plus catalog tuple-version witnesses; trusted
  application/private schema, scoped application roles and required extensions;
  owner-only target load with transactional FK reconstruction and USER-trigger
  suspension; complete value and final security comparisons.
- `scripts/nutrition-002i/local.mjs`: reuses the owned internal-network/mail
  fixture, with a hard-coded postgres SQL transport and observed restrictions.
  Ingestion-role memberships have ADMIN but neither INHERIT nor SET authority.
- `scripts/nutrition-002i/qualify-local.mjs`: selects this adapter in the shared
  002G acceptance story and adds actual privilege denials, metadata ABA/role/source
  drift negatives and invalid-load transaction rollback.
- Small 002G hooks expose its existing qualification story and admit only the
  additional fixed local namespace. Default 002G behavior remains exercised.
  Encryption, identity validators, approval signatures and fixtures are reused.
- A dedicated Draft-only stacked-PR workflow checks the exact candidate, original
  002G plus 002I, advisory/deployment gates, focused regressions, lint/typecheck/build boundary and both strict
  zero-findings CodeQL languages. It has no secrets, schedule, artifact upload or
  Production operation. The existing CI and Production backup workflows are unchanged.
  The workflow checker admits only the exact reviewed new bytes, with new negative
  tests; existing policy checks are not weakened.

## Local evidence

The committed sanitized evidence records **44 passing 002I groups** at boundaries
44 and 45, plus **31 passing original 002G groups**, no skips and successful cleanup.
Each binds its executable implementation digest. It includes coherent concurrent
application/Auth updates, balanced row replacement, source schema/role rejection,
catalog change/revert detection, factor refusal, encrypted round trips, trusted
same-UUID reconstruction, complete 61-table values, rollback, genuine stale/source
authority controls, fresh one-use recovery and lifecycle/RLS acceptance.

Additional checks passed: 201 existing recovery-contract tests, 203 deployment
contract tests, six 002G contract groups, ten workflow/provisioning policy groups,
16 nutrient snapshot units, lint and typecheck. No application, migration SQL,
nutrient manifest, dependency lock or Production entry point changed.

The initial target strategy recreated user triggers and failed EXECUTE permission
on deliberately restricted ingestion trigger functions. The final path preserves
those definitions and uses table-owner USER-trigger suspension; no function grant
or role escalation was added. Earlier passing development runs were superseded
by the final digest-bound evidence after the extra role/extension checks.

The local build/client-secret check was blocked twice by Turbopack's local port
binding under this host's execution restrictions, including the permission-enabled
attempt. No build policy/configuration was changed. The focused GitHub Actions build
and strict CodeQL gates must complete successfully before this task is review-ready.

## Limits

This proves the selected algorithm under locally enforced observed privileges,
not complete hosted compatibility. The tuple witness is a conservative detector,
not a provider-wide DDL lock/audit. The runbook explains transient unrelated objects,
maintenance false rejections and the remaining operator/provider coordination gate.
No historical artifact adapter, hosted transport, automatic cutover, version fallback
or alternative authentication profile was added.

Actual hosted Auth version/settings, target privileges/bootstrap, safe mail delivery,
real-artifact independent restoration, custody/free capacity and Production migration/
backup/release operations remain separately authorized prerequisites. RPO/retention
objectives remain unchanged; eight-hour RTO is aspirational and unproven.
