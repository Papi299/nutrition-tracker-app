# Custom Food post-merge browser acceptance

Baseline: main `ec58fa5180c1cad5444f445a21c1eb2fe82b8312`, tree
`273c5b1817a5db52554453f22972a616ef1b81b5`.
The failing hosted run is [39846556939](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39846556939);
its retained artifact is `playwright-failure-39846556939` (12456950904).

## Alias keyboard focus

Alias rows retain presentation keys when an earlier row is removed. The child
reports those keys through a passive effect; the parent then remaps submitted
error indexes. A summary item keyed by `alias_text_2` becomes a different item
keyed by `alias_text_1`, even though both point to the same surviving input.

Value-free event/DOM instrumentation reproduced the mechanism in English and
Hebrew with both Next.js 16.3.8 and 16.4.1. Controlled focus before reindexing
survived the child commit, then the parent commit detached the focused anchor.
The input retained its DOM identity. Focus fell to BODY, Enter reached BODY,
and the intended anchor click/input-focus handler did not execute. This matches
the retained first-failure state and explains the timing-sensitive assertion.

Alias summary items now use their stable destination identity as the React key.
Other error items retain field keys because different errors can share a
destination. No effect, mutation, form value, input ID or focus/scroll handler
changes. The identical controlled ordering then retained the anchor, invoked
the actual click handler, prevented native default behavior and focused the
original input. The existing EN/HE keyboard/visibility/geometry assertions
remain, with added surviving-anchor/input identity assertions.

## Receipt retirement and prefetch classification

After native `history.replaceState`, the language links update their hrefs.
On 16.4.1, both EN/HE probes observed two script-initiated Fetch requests from
the Next.js client chunk. They were GETs with `RSC: 1` and
`Next-Router-Prefetch: 1`, not document navigation or Server Action submissions.
Both responses were HTTP 200 `text/x-component`. Waiting for those responses
preserved the complete database fingerprint, created-food/receipt identity,
single intentional creation action, document/editor identity, unsaved values,
matching-only draft cleanup and browser history.

In the same scenario, the 16.3.8 probes observed no query-update prefetch within
their bounded response-observation window; its original EN/HE receipt tests
passed with the empty-request assertion. The local framework sources also
differ in cache-root versus routing-tree prefetch scheduling. This establishes
an observed version-dependent scheduling difference, not a universal timing
guarantee or isolation of a particular upstream commit.

Only the subsequent query-update assertion exempts the proven passive prefetch
category: same origin, the exact created food's EN/HE edit routes,
`saved=updated`, GET Fetch, both RSC/prefetch protocol flags, no action marker,
and no document navigation. Only the optional internal `_rsc` cache key is
accepted in addition to `saved`. Receipt parameters, other queries, other
foods/routes/origins, POSTs and unmarked RSC fetches still fail.

Twenty negative classification cases and four positive cases guard that
boundary. All existing action-count, database, draft, history, locale,
no-JavaScript and editor-preservation assertions remain in place. No production
navigation or receipt implementation changed.

## Validation and boundaries

Local validation includes clean installation, lint, typecheck, 393 unit tests,
security/workflow policies, production build/client-secret boundary, controlled
version comparisons and original focused browser cases. Complete browser and
exact-head hosted results are recorded in the PR description and task report.

No dependency, authentication/RLS, schema, deployment, workflow, timeout or
retry change is included. The separate CI-193-R01 APT mirror limitation remains.
No Production deployment or hosted database operation is authorized.
