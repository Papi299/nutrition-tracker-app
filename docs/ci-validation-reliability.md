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

The 328/332 ignored APT downloads in those failed attempts all used
`azure.archive.ubuntu.com`. This is evidence of two slow retrievals, not proof
that this mirror is universally unreliable. Those two runs eventually fell back
to the official archive (164/166 Get/Hit entries), after 12m42s/13m06s total
package retrieval. The original #192 substitution
changed a direct URI in `ubuntu.sources`; it **did not reroute** hosted APT.
The [versioned runner configuration](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/scripts/build/configure-apt-sources.sh)
uses `mirror+file:/etc/apt/apt-mirrors.txt`. That file gives Azure priority 1,
the official HTTPS archive priority 2 and the security archive priority 3.
APT tries the lowest priority number first; editing an absent direct URI is a
successful no-op. The original fixture covered only a direct-URI layout.

Exact-main [Validate 39965033795](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39965033795/job/120452559685)
on Ubuntu 24.04.5, image `20261012.334.1`, passed while retaining this indirection:
205 archive Get/Hit lines used Azure, none used the official archive, and two
retrieved `file:/etc/apt/apt-mirrors.txt`. Fast successful provisioning did not
establish the intended mirror switch. #193 recorded this limitation; #194
corrected the separate Custom Food acceptance failures without changing APT.

## CI-193-R01 correction

`configure-ci-apt.mjs` validates the known x64 Ubuntu 24.04/26.04 deb822 layout
before writing. For the provider mirror list it changes **only** the two archive
priorities: official HTTPS first, Azure second, security fallback third. The
entire deb822 file remains byte-for-byte unchanged, including all four suites,
components and the Ubuntu archive Signed-By keyring. The fallback list and
separate security source remain available. The legacy direct-URI layout changes
only the archive URI to official HTTPS. Unknown layouts, missing security suites,
changed signing metadata or unexpected mirror lists fail before mutation.
Readback must match the planned configuration; CI logs the effective sources,
mirror priorities and provider retry/timeout settings before installing all three
engines with `--with-deps`. No APT retry, timeout, TLS or signature setting is
changed. A fallback may still download from Azure if the official archive fails;
configuration output alone is not proof of the eventual download host.

Option A (correct effective routing while retaining fallback) is selected because
it addresses the observed historical path without deleting provider resilience.
Option B (new retry/timeout overrides) is not justified: the versioned image
already supplies one retry and 15-second HTTP/HTTPS timeouts. Option C (retire the
switch) remains a possible owner decision, but passing once does not withdraw
the original requirement. HTTPS is not a throughput guarantee; any performance
comparison is observational and cannot establish long-term reliability.

Focused tests cover direct and indirect noble/resolute sources, idempotence,
security-suite/component/keyring invariants and rejection of unsafe/unknown
layouts. Workflow policy retains the exact installation command and checks a
bounded, separate Ubuntu 26.04 browser provisioning probe. Validate still uses
`ubuntu-latest`; no global runner pin or migration is introduced.

### Ubuntu 26.04 boundary

GitHub's [published migration announcement](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)
schedules `ubuntu-latest` migration for October 19–November 19, 2026. The published
26.04 image retains deb822/mirror-list provisioning, Node tooling and Docker.
The workflow explicitly selects Node 22. Locked Playwright 1.61.1 includes native
Ubuntu 26.04 package maps and browser binaries, rather than a 24.04 fallback.
A separate `ubuntu-26.04` job exercises this same source helper, signed OS-package
installation, all three engine launches, Node 22, Docker/Compose and the locked
Supabase CLI's version command. It neither starts a database nor uses hosted
services. Its success qualifies this provisioning path only; full application,
migration, local Supabase and browser acceptance on 26.04 remain dependent on a
full Validate run actually scheduled there. A 24.04 Validate pass is not 26.04
application certification. Hosted download routes and timings must be inspected
in the exact Draft-head run and recorded with the review evidence.

See [APT mirror selection and fallback](https://manpages.debian.org/trixie/apt/apt-transport-mirror.1.en.html)
and [Playwright platform requirements](https://playwright.dev/docs/intro#system-requirements).

Validate now has an explicitly reviewed **40-minute** bound. The workflow
policy still requires that exact bound and rejects both the former 30-minute
value and unreviewed increases. Every existing gate, trigger, action pin,
permission, step condition, test command and cleanup remains in place. The
production-backup workflow retains its separate 20-minute bound. No cache,
package-version selection or engine installation command is changed.

## Original #192 diagnostic evidence (historical)

At the time of #192, the Custom Food alias keyboard-focus failure remained unexplained.
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

Current baseline status: #193 merged Next.js 16.4.1 and these diagnostic changes;
#194 corrected the reproduced focus/prefetch acceptance failures. Main
`4ae244e925e8a5620de15aa0ee528281621185e3` passed Validate and CodeQL.
The original dependency-gate block above is historical, not a new-PR waiver.
PR #192 remains open pending a separate owner closure decision after review
and acceptance of this APT correction. No merge or deployment is authorized.
