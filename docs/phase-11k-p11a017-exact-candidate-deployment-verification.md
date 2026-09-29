# P11A-017 exact-candidate Production deployment verification

Task: `PHASE_11K_P11A017_FINAL_RETRY_SHARE_LINK_REMEDIATION_AND_DEPLOYMENT`
Execution: 2026-09-29 UTC
Operational result: `P11A017_EXACT_CANDIDATE_DEPLOYED_SMOKE_VERIFIED_READY_FOR_INDEPENDENT_REVIEW`
Independent review: pending. Public or external launch: not authorized.

The [machine-readable execution record](../deployment/phase-11k-p11a017-exact-candidate-deployment-verification-evidence.json) and [executed release-evidence instance](../deployment/phase-11k-p11a017-release-evidence.json) retain bounded identifiers, observations, and mutation counts. The original [template](../deployment/release-evidence-template.json) remains unexecuted historical template content. This report does not claim closure of P11A-017 or another finding.

## Fresh baseline and recovery gate

Remote `main` and the deployed candidate were `7f3aea526ea3751f39b37fd02c90153d3a93e2a0`, tree `fc1689dd3cbf5af19e1a8bd43bcda4710d274f14`, with zero open PRs before the evidence PR. Exact-main [Validate 36531451773](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36531451773) and [CodeQL 36531450843](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36531450843) succeeded, including both CodeQL jobs. The repository contained 44 migration SQL files; migration 44 SHA-256 was `3bd721b02b4f996a4abefe624361fd581fae71e190246fafd9234b3ccd8d11f3`. Supabase Production project `hskfanrqwtqknzpquwhg` was `ACTIVE_HEALTHY` with the exact 44-version ledger ending `20260927170418_harden_account_closure_mac_comparison`; Storage had zero buckets and zero objects. The predeployment Vercel inventory contained exactly historical READY Production deployment `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` at source `ad92dadc985e66ac1e6453537d629f6d13ccda5f`.

The accepted scheduled [backup run 36513218364](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36513218364) and artifact `11009933286` remained successful, unexpired, and within the 24-hour RPO throughout execution. Its manifest completion was `2026-09-29T02:37:50.660Z`, so completion-based freshness expires `2026-09-30T02:37:50.660Z`. The encrypted archive and integrity proof were verified in the prior [backup packet](phase-11i-migration44-fresh-backup-verification.md); this task rechecked artifact status and exact current ledger. Fresh 44-migration isolated restore and 8-hour RTO requalification remain pending. No backup was manually triggered or restored.

## Share-link remediation and protection

Vercel team External Access showed exactly one active item labeled **Shareable link**. Its row linked project `nutrition-tracker-app` to the exact historical deployment path `cydL1xMN2TMPFaU3WAQai91BHxQg` and hostname `nutrition-tracker-a5gy11pcn-peachys-projects-4596e52a.vercel.app`. The project's API identity was `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd` in team `team_s9dzc3uaGVF7b1NSTxQh3kNm`. The row showed creator display name `maor29994ps5-9621`; its historical origin was not inferred. The share-link value was neither copied nor recorded.

Codex used the row's **Revoke** control once. External Access immediately changed to **No external access** and still showed that state after deployment. Vercel Authentication/SSO stayed enabled for **all deployments**, project `protectionBypass` stayed empty, and no custom bypass rule or domain change was made. An unauthenticated request to the historical deployment returned HTTP 302 to Vercel Authentication; the final Production alias also returned HTTP 302 when unauthenticated. After revocation, the existing member Chrome session rendered the historical `/en` page and returned HTTP 200 for same-origin GET and HEAD `/api/health`, with GET `{"status":"live"}`, empty HEAD body, and `Cache-Control: no-store, max-age=0`.

## Configuration transition and Auth URLs

The exact Vercel Production project had 12 variables before and after. A before/after Vercel API comparison found only `DEPLOYMENT_CLASS` changed, from `PRODUCTION_BOOTSTRAP_ONLY` to `PRODUCTION_RELEASE`. Fresh safe-value readback confirmed `APP_ENVIRONMENT=production`, `SUPABASE_ENVIRONMENT=production`, both Supabase refs `hskfanrqwtqknzpquwhg`, public Supabase URL `https://hskfanrqwtqknzpquwhg.supabase.co`, `APP_ORIGIN` and `PRODUCTION_APP_ORIGIN=https://nutrition-tracker-app-xi.vercel.app`, and `EXPECTED_VERCEL_PROJECT_ID=prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd`. Two sensitive Production variables remained present at metadata scope; their values were not read or printed.

Supabase Auth Site URL stayed `https://nutrition-tracker-app-xi.vercel.app`. One dashboard save added exactly these four redirects and no wildcard:

- `https://nutrition-tracker-app-xi.vercel.app/en/auth/confirm`
- `https://nutrition-tracker-app-xi.vercel.app/he/auth/confirm`
- `https://nutrition-tracker-app-xi.vercel.app/en/auth/recover/confirm`
- `https://nutrition-tracker-app-xi.vercel.app/he/auth/recover/confirm`

A fresh dashboard read showed total URLs `4`. No other Auth setting was edited.

## Exact Git-source deployment

Vercel's Create Deployment dialog resolved the full commit to GitHub `Papi299/nutrition-tracker-app`, branch `main`, and displayed **Deploy to Production**. Exactly one deployment was created: `dpl_FY6mkZ8By62mFDxcUarJLmy1oxiN`, generated URL `https://nutrition-tracker-hhsdenai6-peachys-projects-4596e52a.vercel.app`, target `production`, source `git`, SHA `7f3aea526ea3751f39b37fd02c90153d3a93e2a0`. It became READY at `2026-09-29T07:51:02.834Z`, with the Production alias `nutrition-tracker-app-xi.vercel.app` assigned. Provider metadata also lists the project's Vercel and Git-main aliases. Inventory after execution contained two deployments, with this exact candidate active. The candidate's committed `vercel.json` still sets `git.deploymentEnabled=false`; there was no automatic additional deployment.

## Candidate read-only smoke

All application checks used the protected member session in the dedicated Nutrition Tracker native Chrome tab. The in-app browser independently confirmed the `/en` and `/he` document `lang`/`dir` values. Safe same-origin `fetch` printed only status, final URL, body for health, and response headers; no browser cookies, SSO tokens, or request authentication headers were inspected.

| Route/check | Observed result |
| --- | --- |
| `/en` | HTTP 200; English shell; `lang=en`, `dir=ltr`. |
| `/he` | HTTP 200; Hebrew shell; `lang=he`, `dir=rtl`. |
| GET `/api/health` | HTTP 200; `{"status":"live"}`; JSON; `no-store, max-age=0`. |
| HEAD `/api/health` | HTTP 200; empty body; JSON content type; `no-store, max-age=0`. |
| `/en/today` | Signed-out redirect to `/en/auth/sign-in`; localized form, no private content. |
| `/he/today` | Signed-out redirect to `/he/auth/sign-in`; localized form, no private content. |
| `/en/auth/sign-up` | English invitation-only information; no self-service signup form. |
| `/he/auth/sign-up` | Hebrew invitation-only information; no self-service signup form. |
| `/en/auth/sign-in` | English email/password form and recovery link; no submission. |
| `/he/auth/sign-in` | Hebrew email/password form and recovery link; no submission. |
| `/en/auth/recover` | English recovery request surface; no submission or email. |
| `/he/auth/recover` | Hebrew recovery request surface; no submission or email. |
| `/en/auth/confirm`, missing parameters | Redirect to English invitation error. |
| `/he/auth/confirm`, missing parameters | Redirect to Hebrew invitation error. |
| `/en/auth/recover/confirm`, missing parameters | Redirect to English recovery error. |
| `/he/auth/recover/confirm`, missing parameters | Redirect to Hebrew recovery error. |
| EN/HE invite confirm, invalid purpose | Both redirect to localized invitation errors; no OTP verification. |
| EN/HE recovery confirm, invalid purpose | Both redirect to localized recovery errors; no real token. |

The invalid-purpose checks used only the literal `invalid` test value. No account was created, invite or recovery email sent, or real invite/recovery token supplied.

## Actual headers, CSP and logs

The observed CSP on `/en`, `/he`, both sign-in pages and health was identical:

```text
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://hskfanrqwtqknzpquwhg.supabase.co wss://hskfanrqwtqknzpquwhg.supabase.co; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; manifest-src 'self'; upgrade-insecure-requests;
```

The same responses had HSTS `max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), fullscreen=()`. These preserve same-origin camera/WASM compatibility at the policy level; physical camera execution was not performed here. `/en` and `/he` used `Cache-Control: public, max-age=0, must-revalidate`; sign-in and the final sign-in responses from `/en/today` and `/he/today` used `private, no-cache, no-store, max-age=0, must-revalidate`; health used `no-store, max-age=0`. HTML responses had `text/html; charset=utf-8`; health had `application/json; charset=utf-8`. Browser `fetch` with manual redirect returned `opaqueredirect` for the initial Today responses, so the initial redirect headers were not observable without inspecting authentication material; final sign-in response headers were captured separately.

The 105 Vercel build events show GitHub clone of `7f3aea5`, successful compilation in 6.9 seconds, `Build Completed`, and `Deployment completed`. One non-failing `npm install-scripts` allowScripts warning named `@parcel/watcher`, `@swc/core`, and `unrs-resolver`. No build error or unexplained 5xx was observed. Vercel's candidate runtime error view reported no errors; the deployment-filtered Logs UI showed error `0` and fatal `0` during the smoke. P11A-014 signal-to-alert/acknowledgement acceptance remains separate.

## Final state, rollback and finding impact

Final readback found two deployments, candidate READY and active, SSO all, no active share links, zero automation bypass credentials, the sole original Vercel domain, exact 44 Supabase migrations, zero Storage scope, and the accepted backup still fresh. Historical deployment `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` remains `INDETERMINATE_DO_NOT_ROLLBACK`; no rollback or restore occurred. The containment boundary is `FORWARD_FIX_ONLY`.

Mutation counts: one pre-existing link revoked; zero links/bypass credentials/rules created; one Vercel environment value changed; one Supabase Auth URL save; one Production deployment; zero rollbacks, migrations, DDL, DML, user creation, email delivery, Vault/Storage mutation, manual backup, restore, or custom-domain change.

This execution satisfies the exact-candidate Git-source deployment, protected static smoke, environment/Auth URL, header/CSP, build, runtime-error and final protection observations requested for P11A-017. The original finding's rollback/redeploy rehearsal remains unqualified because the historical deployment is not a safe target. Independent engineering review is pending, so P11A-017 remains open in the integrated overlay. P11A-010 gains bounded deployed behavior evidence but remains open for full hosted behavior and recovery qualification. P11A-006, P11A-008, P11A-014 and all other unrelated findings remain open at their separate boundaries. Public launch is not authorized.
