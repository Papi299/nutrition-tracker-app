# 002E1 — reviewed bootstrap and bounded qualification design

Preimplementation checkpoint, 26 October 2026. No service containers have been
launched for this task. Local synthetic engineering only, $0 additional spend.

The verified CLI 2.116.0 tag resolves to
`997a1e69a4a83466964ed874d3a604c88a7b3866`. Both its legacy Dockerfile and
managed ServiceCatalog select GoTrue v2.196.0 and PostgreSQL 17.6.1.165.
The managed stack's Auth defaults enable public signup; blindly substituting
that default for this application's invitation-only rules is unacceptable.
Use the permitted separately pinned official services, translating the reviewed
legacy Auth configuration explicitly. Do not run CLI start/reset/link against
any existing project. CLI help/version were read with task-specific SUPABASE_HOME
and telemetry disabled; the first version read attempted a denied telemetry
write, then the isolated invocation succeeded without changing owner settings.

Selected official mirror digests:

- GoTrue: `public.ecr.aws/supabase/gotrue@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232`.
- Postgres: `public.ecr.aws/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`.
- Optional API validation: `public.ecr.aws/supabase/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d`.

Auth v2.196.0 resolves to `0204331ca41a5b49f076b6fa3dc6c0d20b996590`.
Its latest shipped migration is `20260625000000`. Its own passkey migration
`20260302000000` creates credentials and short-lived challenges; the service's
startup migration mechanism must create these tables. Runtime qualification
will compare every shipped SQL file hash to the immutable public source and
independently compare both actual migration ledgers and schema inventories.
No provider table SQL is fabricated. The CLI role-password bootstrap is distinct
from Auth migration authority. Source hashes are recorded in upstream-sources.json.

Use two independently initialized task-owned DB/Auth/API environments, each on
its own internal Docker bridge. All service ports are unpublished. A pinned task-owned Node 22 client per side
makes HTTP requests over that side's internal network. No shared volume. Each DB uses a newly created task-labelled local volume,
verified by name, driver, creation timestamp, label and mount; both are removed
after the bounded fixture. No host directory is mounted. Refuse existing names before creation. Record immutable returned
resource IDs; verify labels, image, networks, mounts and bindings before access,
restart and deletion. Cleanup only successfully created, identity-verified IDs.
Do not prune or enumerate unrelated container settings. Disable service logging;
keep synthetic secrets only in process memory and Docker environment, never
diagnostic output, repository files, artifacts or PR descriptions.

Create invited synthetic users through supported admin generate-link and verify
APIs, set passwords through the authenticated API, then use real password login,
refresh, logout and new target login. No credential is generated with SQL.
Application SQL is replayed from exact fixed 44/45 sources with blob/hash checks.
Use actual JWT validation through PostgREST for owner/anonymous/foreign/closed
authorization checks; SQL execution as an administrator is not that acceptance.

The provider documents SQL data export/import for Auth migration, preserving
password hashes. The bounded same-version experiment transfers only explicit
writable columns of four proposed durable tables into an independently migrated,
stopped, empty target. Use PostgreSQL COPY text in memory, fixed quoted names and
real FK checks; no source DDL, replication-role bypass, session import, or arbitrary
SQL restore. Compare exact rows before service restart, then test credentials.
This proposes evidence for that subset; it does not approve general sufficiency.

Passwords and TOTP secrets can both be encrypted by this Auth version with
DBEncryption AES-GCM/HKDF keys bound to object UUIDs. These are separate from JWT
signing material. The fixture enables encryption and populated TOTP explicitly,
with disposable roots. Correct root must survive target restart; wrong/missing
root and UUID/hash tampering must refuse service authentication. A deliberately
different target signing secret tests old-source tokens; evaluate actual Auth
and PostgREST paths independently, including token behavior after logout.

Local repository config disables TOTP/phone and leaves passkeys commented. This
does not establish hosted state. Additional fixture enablement is labelled
explicitly; never claim disabled-in-Production. Passkey success requires a real
cryptographic ceremony and stable RP/origin. If that cannot be qualified, retain
the feature and return BLOCKED rather than an empty-table success. Source review
must also classify SSO/OAuth configuration and persistence outside four tables.
No durable recovery-code implementation was found in the selected source; verify
the actual schema and distinguish that version fact from unknown hosted status.

This is not coherent application capture, CMS/encryption integration, producer
authentication, or operational recovery acceptance. Keep the 002E contract and
expected hashes unchanged, keep Production refusal unconditional, and stop at
the first essential unsupported dependency with explicit findings. CI may repeat
the local fixture on standard free public-repository runners with bounded time,
read-only permissions, pinned actions, exact head, zero artifact uploads and
owned-resource cleanup. It cannot qualify hosted compatibility or RPO/RTO.

Bootstrap development finding: Docker Desktop does not populate host port
bindings on an internal bridge. Two initial attempts failed closed and cleaned
up; a diagnostic confirmed the service was running but had no published route.
The implementation now uses an owned Node 22 HTTP client inside each internal
network, with image `docker.io/library/node@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d`.
No external route or public port was added. PostgreSQL readiness also waits for
the final TCP listener, rather than its temporary initialization socket.

Restart development finding: Docker tmpfs contents disappear when a container
stops. The initial restart attempts therefore did not exercise retained database
state. The corrected method uses two separate task-owned disposable local volumes,
checks final database readiness after restart, and must verify restored credentials
again. See [Docker tmpfs documentation](https://docs.docker.com/engine/storage/tmpfs/).
No prior tmpfs restart failure is accepted as an Auth compatibility result.

CI correction: the first exact-head workflow 40297462971 passed 315 tests and
lint but ECR refused the initial image download with `toomanyrequests: Data limit
exceeded`. No service fixture ran in that attempt. The official Docker Hub
repositories were independently pulled at the identical existing digests:
`supabase/postgres`, `supabase/gotrue` and `postgrest/postgrest` (the last namespace
is fixed by the reviewed CLI Dockerfile). No Auth/DB/API version or content
digest changes. The new immutable implementation is requalified locally before
final exact-head CI. No paid registry, credential, bypass or quota change is used.

Linux CI portability correction: actual pre-account diagnostics showed Docker
cannot open the Node child stdin socket via `/dev/stdin` for `--env-file`.
Container creation now writes an exclusive 0600 env file in a new 0700 directory,
passes its path to Docker without mounting it, and unlinks/removes both in finally
immediately after create. HTTP credentials still pass through stdin/memory only.
Final local qualification confirms no temporary env directory remains. The runner
architecture was investigated through official OCI manifests (both amd64/arm64
present); no runner or image-version change was needed. All failed CI attempts
are retained separately, with no artifact uploads or paid resource.
