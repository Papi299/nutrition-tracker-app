# P11A-017 equivalent redeploy and rollback rehearsal

**Result:** `P11A017_CANONICAL_ALIAS_REHEARSAL_COMPLETE_READY_FOR_INDEPENDENT_CLOSURE_REVIEW`

**Recorded:** 2026-09-29T18:01:23Z. **Executor:** Codex. **Independent reviewer:** ChatGPT, pending. **Public launch:** not authorized.

The [machine-readable packet](../deployment/phase-11k-p11a017-redeploy-rollback-rehearsal-evidence.json) records the two operational segments, individual smoke rows, provider attribution, and mutation counts. This packet supplements the [exact candidate deployment packet](phase-11k-p11a017-exact-candidate-deployment-verification.md). It does not turn either segment into an uninterrupted run or certify independent review.

## Baseline and A/B equivalence

At preflight, `main` was `cbb672acb804dafb8a65a79ffef3648059faf734`, tree `6c58fd0a95dc13f046fbebba5bddb7aaf4c94e6f`, with zero open PRs. Exact-main Validate run `36560410473` and CodeQL run `36560409905` (Actions and JavaScript/TypeScript) succeeded. The accepted application SHA/tree were `7f3aea526ea3751f39b37fd02c90153d3a93e2a0` / `fc1689dd3cbf5af19e1a8bd43bcda4710d274f14`.

Vercel project `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd` had exactly three deployments: A `dpl_FY6mkZ8By62mFDxcUarJLmy1oxiN` (current, Git source), B `dpl_53J1g2s9m6zXiK2kx6G9NSujGUMu` (READY, redeploy of A), and historical bootstrap `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` (inactive). A and B had the same project, `Papi299/nutrition-tracker-app` repository, accepted SHA, Production target and READY state. Fresh Production configuration read-back identified `PRODUCTION_RELEASE`, project ref `hskfanrqwtqknzpquwhg`, canonical app origin `https://nutrition-tracker-app-xi.vercel.app`, and two server-only secrets present without reading their values. Automatic Git deployments were disabled. The historical bootstrap remains `INDETERMINATE_DO_NOT_ROLLBACK` and was never selected.

## Segment 1: redeploy and initial restoration

The earlier authorized retry created B by redeploying A once. B served Production, and native Chrome smoke of B's generated URL passed English/LTR, Hebrew/RTL, health GET/HEAD and signed-out localized Today/sign-in behavior. The canonical-alias B check was interrupted when Chrome control reached an unrelated private window and automatic approval review rejected further control. Vercel explicitly identified A as the rollback target; one rollback restored A. A then passed canonical-alias smoke. No evidence PR was opened then because B's canonical-alias row remained unproved. No share link or protected-fetch connector was used in this segment.

## Segment 2: canonical alias closure

Before changing traffic, the dedicated native Chrome Nutrition Tracker window loaded current A at `/en` and `/api/health`. Vercel External Access still showed **No external access**. The UTC authorization window ended at `2026-09-29T18:00:00Z`; both traffic actions were completed before that deadline. No new deployment was created.

With A current, the Vercel Hobby Instant Rollback dialog explicitly identified **current A** and **previous B**, both at the accepted SHA. One A→B traffic switch made B current. Provider alias lookup confirmed B at `https://nutrition-tracker-app-xi.vercel.app`. An unrelated Chrome window briefly became active; interaction stopped until the user returned the dedicated window to the foreground. The canonical-alias smoke then passed while B was current:

| Path | Observed result |
| --- | --- |
| `/en`, `/he` | HTTP 200; English `lang=en`/`dir=ltr` and Hebrew `lang=he`/`dir=rtl` shells. |
| GET `/api/health` | HTTP 200, `{"status":"live"}`, `application/json; charset=utf-8`, `Cache-Control: no-store, max-age=0`. |
| HEAD `/api/health` | HTTP 200, empty body, same expected content type and cache control. |
| `/en/today`, `/he/today` | HTTP 307 to the matching localized sign-in routes; no private content. |
| `/en/auth/sign-in`, `/he/auth/sign-in` | HTTP 200; localized forms rendered without submission. |

Deployment-scoped Production runtime logs for B contained the corresponding `/en`, `/he`, health GET/HEAD, Today redirects and sign-in routes during the smoke window (17:54–17:56 UTC); health GET/HEAD appeared at 17:55:26 UTC. No unexplained 5xx or runtime error cluster was observed. Provider alias lookup still identified B after the smoke.

With B current, the Vercel Hobby Instant Rollback dialog explicitly identified **current B** and **previous A**, both at the accepted SHA. One B→A traffic restoration made A current again before the deadline. Provider alias lookup confirmed A. The dedicated Chrome window was restored after another unrelated-window interruption; no unrelated content was used.

A then passed the same canonical-alias English/Hebrew, health GET/HEAD, signed-out Today redirect and localized sign-in checks. Deployment-scoped A Production runtime logs grouped over 17:59:00–18:00:10 UTC contained `/en` (7), `/he` (8), `/api/health` (2), both Today routes (1 each), and both sign-in routes (3 each); grouped statuses were 31×200 and 2×307, with no runtime error cluster. The individual A log query timed out, so A attribution rests on the deployment-scoped grouped log result plus the provider alias read-back, not that query.

## Final state and finding disposition

Final provider read-back showed exactly three deployments: A READY/current on the canonical Production alias, B READY/inactive, and bootstrap inactive. Vercel Authentication covered All Deployments; External Access showed No external access, zero active share links, zero automation bypass credentials and zero protection exceptions. Supabase Production project `hskfanrqwtqknzpquwhg` was `ACTIVE_HEALTHY` with exactly 44 migrations ending at `20260927170418_harden_account_closure_mac_comparison`; Storage was zero buckets and zero objects. Accepted backup run `36513218364`, artifact `11009933286`, completed `2026-09-29T02:37:50.660Z`, remained within its 24-hour RPO at final read; freshness expires `2026-09-30T02:37:50.660Z`.

Across both segments: one new equivalent deployment (Segment 1), three targeted traffic actions (one Segment 1 restoration; Segment 2 A→B and B→A), and zero bootstrap activations. Segment 2 had zero new deployments, link revocations or creations, protected-fetch calls, bypass credentials, environment/Auth/database/Storage mutations, users, emails, backups, restores or paid-plan changes. No database reversal occurred. A separate historical share-link revocation in the earlier exact-candidate deployment packet is not counted as a mutation in these two rehearsal segments.

The exact deployment, equivalent redeploy, deliberate Production-alias switch to B, B smoke and log attribution, and restoration and re-verification of A satisfy the original P11A-017 deployment and rollback/redeploy evidence criterion. **Proposed disposition: `FINDING_CLOSED`, subject to independent review of the Draft PR.** P11A-010 remains open for full hosted behavior and a 44-migration isolated restore/8-hour RTO requalification. P11A-014 and all other open findings retain their separate gates. This does not authorize public launch, further provider mutation or PR merge.
