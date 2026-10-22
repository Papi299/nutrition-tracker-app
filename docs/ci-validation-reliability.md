# Validate timing and first-failure diagnostics

The SECURITY-DEPS-001R1 investigation compared the same main baseline and
brace-expansion-only PR #190 tree. Required Validate normally completed in
18–19 minutes, but two PR attempts spent more than thirteen minutes installing
browser engines and Ubuntu dependencies. The second attempt exhausted the
30-minute job bound before reaching the previously failing focus case.

| Job | Total job | Browser/OS setup | Main browser suite | Phase 11D |
| --- | --- | --- | --- | --- |
| [Current main](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39644001652/job/119374656770) | 18m20s | 54s | 10m47s | 2m24s |
| [PR #190 attempt 1](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39809058079/job/119930018773) | 29m17s | 13m37s | 10m58s, failed | Not run |
| [PR #190 attempt 2](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39809058079/job/119946390225) | 30m45s including cancellation/cleanup | 13m46s | 11m51s, cancelled | Not run |

APT archive retrieval took 18 seconds on main and 12m42s/13m06s in the two
attempts. npm ci took 11/13/17 seconds; browser binary downloads took about four
seconds. Adding the observed extra OS setup time to the successful baseline
alone predicts 31m03s. A separate successful job on the newer runner image
completed in 19m14s with 45 seconds of browser/OS setup, so the image alone is
not an established cause.

Validate now has an explicitly reviewed **40-minute** bound. The workflow
policy still requires that exact bound and rejects both the former 30-minute
value and unreviewed increases. Every existing gate, trigger, action pin,
permission, step condition, test command and cleanup remains in place. The
production-backup workflow retains its separate 20-minute bound. This focused
correction does not attempt caching or package-mirror changes without evidence
that they would preserve engine compatibility and supply-chain constraints.

The original Custom Food alias keyboard-focus failure remains unexplained.
Its retained artifact had no trace: the primary Playwright configuration used
`on-first-retry` while retries were zero. Forty-four controlled target
invocations on main and the brace-expansion patch passed locally, including
tracing-off and CPU-slowdown comparisons; these do not replace full Linux CI
or prove the failure intermittent. Alias reindexing remounted an unfocused
summary link in observed runs. A race involving that replacement remains a
hypothesis, not a confirmed defect or justification to change application code.

The primary suite now explicitly retains **zero retries** and records traces
with `retain-on-failure`. Custom Food keyboard assertions capture the actual
active element, expected-control connection/visibility/enabled state, closed
disclosures and the link's fragment destination after failure, before closing
the context. Capture errors cannot replace the original assertion error.
Snapshots omit field values, text, cookies and storage. The original keyboard,
visibility and geometry assertions remain intact; the successful assertion
path adds no observation, sleep or retry. Existing Phase 11D retry behavior is
unchanged.

Browser regressions exercise actual BUTTON/BODY focus, hidden disabled inputs,
missing targets and value exclusion. A disposable, deliberately failing local
case verified that the first failure retains both its JSON focus attachment
and a trace without retrying; that negative case is not part of the suite.

This change is independent of the newly reported Next.js production dependency
advisories GHSA-2464-fhr4-w9xw and GHSA-p3m5-59mp-jv5r. Its Draft PR must remain
blocked while the unchanged production dependency gate reports them. The
separate Next.js security correction and a successful exact-head Validate and
CodeQL result are prerequisites for readiness. No merge, deployment,
Production access or modification to PR #189/#190 is authorized by this change.
