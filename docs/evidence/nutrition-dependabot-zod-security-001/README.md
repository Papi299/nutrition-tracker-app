# Zod transitive security correction

The sole dependency resolution change is `node_modules/zod`, from 4.3.6 to
4.6.7. The version, registry URL and integrity change; every other lock entry,
the root manifest, ESLint configuration, application and ingestion source,
all 47 migrations, recovery implementation and workflows remain unchanged.

[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
affects Zod below 4.6.6. Public npm metadata was reverified before resolution:
4.6.7 is the latest stable 4.x release. The installed dependency path is
`eslint-config-next@16.3.6 → eslint-plugin-react-hooks@7.1.1 → zod`, with
`zod-validation-error@4.0.2` sharing the same copy through its peer constraint.
Both consumers permit `^3.25.0 || ^4.0.0`. The installation is development-only;
no direct dependency or override is added.

The controlled `npm update zod --package-lock-only --ignore-scripts`
experiment also removed libc metadata from twenty unchanged optional platform
entries and added a dev marker to fsevents. Those unrelated npm 10 metadata
rewrites were discarded. Only the exact registry-resolved Zod record was
retained, followed by a successful clean `npm ci` on Node 22.23.4/npm 10.9.9,
matching the observed accepted CI toolchain.

## Behavioral evidence

Run `node scripts/check-zod-react-hooks-compatibility.mjs` from the repository
root. The ordinary unit suite also runs `tests/zod-react-hooks-compatibility.spec.ts`.
The latter compares the installed candidate against `react-hooks-baseline.json`,
captured on the exact starting source with Zod 4.3.6. Patched results are retained
in `react-hooks-patched.json`.

The read-only probe loads the complete repository flat configuration and uses
18 comparable cases: a legitimate component; six intentionally invalid Hook,
dependency, mutation, purity, ref and state-update examples; five legitimate
compiler configurations; five invalid compiler configurations; and invalid
ESLint option-schema rejection. Full diagnostic messages, classifications,
severity and source locations remain identical. Unexpected exceptions fail.
The expected five ReactCompilerError results prove invalid configuration is
still rejected; they are intentional negative tests, not rule crashes.

Node's profiler observes the unmodified installed packages. It proves execution
of the plugin's `parseEnvironmentConfig`, `validateEnvironmentConfig`,
`parsePluginOptions`, `parseTargetConfig`, `tryParseExternalFunction` and
`runReactCompilerImpl`, and the installed `fromZodError` formatter. All twelve
directly referenced `zod/v4` namespace symbols retain their export types. The
consumer plugin bytes are unchanged. Its embedded metadata says 7.0.0 even
though its package version is 7.1.1; the probe records both and asserts the
actual package version. These are focused compatibility checks of the installed
configuration and relevant validation paths, not a claim about every possible
future compiler option.

## Security and preservation evidence

`npm-audit-before.json` and `npm-audit-after.json` retain the complete audit
records. The full audit improves from 16 moderate plus one high finding to
16 moderate and zero high/critical findings. It remains non-clean because of
the existing minimatch advisory. No audit suppression is applied. Npm's
propagation/fix recommendation fields vary, while all remaining advisory,
severity, range and installed-node fields are unchanged.

`dependency-analysis.json` records both Zod constraints, the sole installation,
both unchanged minimatch copies (3.1.5 and 10.2.5), and every immediate owning
dependency. `investigation.json` includes registry/advisory metadata and all
47 migration hashes and Git blobs. `plugin-api-review.json` records the API
inventory. Production-only audit has zero findings and the existing production
advisory policy passes. The earlier minimatch investigation remains blocked;
this task does not attempt or claim its remediation.

Final local regression results, exact-head Validate/CodeQL links, head/tree and
the A–S engineering report are recorded in the Draft PR description and the
external delivery receipt after qualification. This source evidence snapshot
does not predeclare those CI gates successful. The branch must remain Draft
and unmerged. No hosted database, deployment, Production backup/restore,
branch-protection or approval operation is authorized by this correction.
