# Phase 11J Fresh Exact-Main CI Dispatch

The existing `CI` workflow accepts pull requests to `main`, pushes to `main`,
and manual `workflow_dispatch` runs. All three events use the same `Validate`
job and gates. A manual dispatch fails immediately after checkout unless its
GitHub ref is `refs/heads/main`; the checkout stays bound to GitHub's workflow
context SHA. Repository hygiene compares a pull request against its base SHA,
a push against its `before` SHA, and a manual dispatch against the dispatched
commit's first parent. An unresolved base fails the job.

## Incident and evidence meaning

Exact-main [CI run #271](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35457818291)
used head `7b03f4679ca08d9299040ebbfb0434d8b25fb952`. Attempt 1 failed with
`EXTERNAL_ADVISORY_SERVICE_INDETERMINATE`: the npm advisory service returned an
error, the gate exited 2, and later validation did not run. Attempt 2 passed
the advisory gate with critical/high/moderate/low all zero, full Playwright
with 364 passes, and Phase 11D with 53 passes, 3 intentional skips, 0 failures,
and 0 flakes. Its Phase 11D artifact is `10588728019`, digest
`sha256:9edb3d73b3d56bf39d014bb401b7cd296aa9e1aff474acbd694d29543d311e37`.
The governing J1/J3 refresh brief excludes retry-dependent evidence, so this
successful second attempt does not rebind either evidence packet.

A retry retains the workflow-run ID and has `run_attempt > 1`. A fresh push or
manual dispatch receives a new run ID and starts at attempt 1. A future
exact-main evidence gate may use a clean `push` or `workflow_dispatch` run only
when its governing task permits that event, the run is attempt 1, its head is
the exact accepted `main` SHA, and the full authoritative CI workflow passes.
Historical accepted evidence remains unchanged.

## Next sequence after this Draft PR

Independently review and merge this PR under the repository's standing merge
authority. Inspect the new merge SHA's normal fresh push CI. If it passes on
attempt 1, use that run for the bounded J1 refresh and J3 template rebind. If
it fails only because of an external advisory service outage, dispatch the
same CI workflow on that accepted `main` SHA to obtain a new run ID and
attempt 1. Resume J1/J3 evidence work only after an eligible clean run. No
empty commit is needed to trigger CI.
