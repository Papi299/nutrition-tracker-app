# Nutrition Tracker isolated runner qualification

The historical `nutrition-j3` Lima VM was permanently retired with owner approval
on November 9, 2026. Its saved guest state is unavailable. Commands that start
or resume that instance are historical evidence and must not be executed.
No replacement runner has received equivalent acceptance.

Private-device testing and encrypted PostgreSQL recovery require separate
qualifications. This runbook defines the gates for future runners. Production
operations, real checkpoint access and recovery-key access require separate
owner authorization.

## A. Private-device testing

### Identity and synthetic data

- Approve a new dedicated Linux ARM64 guest and instance name before provisioning.
  Record its identity, the base-image release and verified digest, guest OS and
  architecture, and Docker, Node.js, npm and Tailscale versions. Use plain mode
  if using Lima. Exclude host mounts, extra disks, managed networks, automatic
  startup and static application forwards.
- Record the exact application commit, tree, dependency lockfile digest and
  migration/seed identities. Use reviewed current source for new observations.
  Use the exact recorded candidate and fixture recipe for historical
  reproduction. Record the pinned Supabase CLI version, PostgreSQL major and
  service image/platform digests. The historical preflight used Supabase CLI
  2.116.0 and PostgreSQL 17. Verify compatibility for the selected source.
- Verify the explicit local Docker context resolves to the dedicated guest
  engine's Unix socket. Record the resolved socket and engine ID. Stop on
  conflicting endpoint overrides, an unexpected engine or pre-existing fixture
  identities. Use a fresh local, synthetic Supabase project, migrations and
  seeds. Keep hosted services and Production credentials out of the guest.
- Create new synthetic Auth identities and activation state. Verify ordinary
  password sign-in, eligibility for protected routes, and the matching local
  Vault capability used by the application. Record the checks without logging
  credentials or Vault values.

### Network and application gates

1. Create a dedicated Docker bridge whose default host IPv4 binding is
   `127.0.0.1`, with IPv6 disabled for this topology. Pass the exact bridge ID
   as `--network-id` on every Supabase start and `db reset --local`. Scope a
   reset to the new disposable project. The historical plain reset recreated
   PostgreSQL with wildcard bindings. Preserve that incident and its measured
   correction. [Reset isolation correction](phase-11j3-local-supabase-reset-network-isolation-correction.md)
2. Check every container's network membership and effective Docker port
   mappings. Inspect guest sockets and host forwarding/listeners before
   exposure and again after database recreation. Reject wildcard, LAN or
   tailnet bindings. Require failed nonloopback probes to Supabase from the
   guest and separate LAN and tailnet clients. A requested bind or a guest
   socket listing alone cannot establish the effective exposure.
3. Run a production-mode Next.js build with the `device-test` environment
   contract. Record its build ID and bind the app to guest loopback. Verify
   `/api/health`, the actual private HTTPS origin, certificate and browser
   secure context, English/LTR and Hebrew/RTL behavior, same-origin WASM loading
   and authenticated app requests. Check that browsers make no direct Supabase calls. Verify the
   client artifact secret boundary and, if tested, the exact locale recovery
   callbacks and secure Auth cookies. [Device-test topology](phase-11j3-private-device-test-topology.md)
4. Enroll a fresh Tailscale node interactively with the owner's approval.
   Verify the intended tailnet and enrolled clients. Allow Serve to expose only
   the HTTPS app route to the loopback app. Verify Funnel is disabled and an
   outside-tailnet client cannot reach the app. Stop on any unexpected
   listener, route or origin.
5. Record device, OS, browser, source, build and actual origin for each
   physical observation. Track browser automation separately. Verify teardown
   of task-owned processes, Serve, routes, ports and services, and account for
   synthetic state under the approved retention plan. Preserve redacted
   evidence and report exclusions, failures and incomplete observations.

### Historical attribution

September's 30 mobile camera passes are bound to candidate
`bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree
`02e86af4db29d0f509c35308727f876ed607dba1`, and its accepted carry-forward
decision. The five fresh full UI passes used
`f50d7448a080dbc0a5968c00fd6747ced36d822b`, tree
`f3ac6117f70af8d7a6261c803576d6ecf72ec80f`. Keep DEC-037 and DEC-039 and their
recorded support boundaries. The October owner-device packet used
`24cb07931fb2ea0d891abce757073dfb11cef333`, tree
`ae85dda9d6ecfccbe83ba5ad3c7e0d48d5459ddc`, from PR #186 and recorded 13
automation checks and zero physical client groups. These results stay with
their original source, runner and evidence. A fresh runner earns credit through
new observations. [Camera carry-forward](phase-11j3-camera-evidence-carry-forward.md),
[Navigation-fix owner results](phase-11j3-navigation-fix-owner-ui-execution-results.md),
[Owner-device plan](phase-11j3-owner-device-validation-plan.md),
[PR #186 source](https://github.com/Papi299/nutrition-tracker-app/pull/186)

## B. Isolated PostgreSQL recovery

### Synthetic qualification first

1. Obtain approval for the isolated recovery runner. Record the explicit local
   Docker context, canonical Unix socket path and its file identity, and engine
   ID. Pin the exact disposable container ID, database, project and server identity
   before executing a restore. Reject conflicting endpoint overrides, remote or
   Production target fallback, source-target reuse, or a pre-existing or
   ambiguous target. The standalone PostgreSQL 17 target has no published ports
   and no unauthorized external route. Verify effective isolation, including
   network mode, mounts, routes and port mappings. Use an allowlisted local
   container transport and verify database identity through it.
2. Record the exact PostgreSQL image tag, OCI manifest and platform digest,
   local image ID, server version and required extensions and versions. Verify
   source and migration history and the applicable Full35 compatibility
   contract before selecting the restore path. Inspect the repository's
   [synthetic qualification harness](../scripts/qualify-phase-11i-populated-recovery.mjs),
   [Full35 local harness](../scripts/run-full35-recovery-local.mjs) and
   [Phase 11I restore entry point](../scripts/run-phase-11i-restore.mjs).
   Some helpers expect a local Supabase stack or a particular transport.
   Prove the selected helper or a separately approved adapter satisfies the
   standalone isolation gates before use. Keep the existing Phase 11I
   operator contract for its own supported restore path.
3. Prove fail-closed transport and restore with a synthetic encrypted artifact
   and synthetic key before accessing any real checkpoint. Use an owner-only,
   short-lived encrypted scratch area outside Git. Verify the exact encrypted
   archive/manifest pair, digest, recipient identity, expected source/history
   and integrity checks before import. Keep recovery keys under separate owner
   custody. Keep decrypted material out of durable outputs, logs and evidence.
4. Verify required schema, migration and extension state, table counts and
   fingerprints, Auth and application invariants, role/grant/RLS boundaries and
   required integrity checks and smoke tests. Use the checks required for the
   chosen source and artifact. Record start, end, failures and corrective
   retries through mandatory smoke against the established eight-hour RTO.
   Record teardown separately. Verify removal of disposable targets and
   plaintext scratch, closure of encrypted mappings, and absence of residual
   listeners or active source bindings. Keep a redacted receipt.
5. Before any later real restore, obtain separate owner authorization for the
   exact checkpoint, key access and operation. Reverify the artifact, target
   and retention gates. Follow the existing [Phase 11I recovery contract](phase-11i-recovery-qualification.md)
   for backup, ownership, retention, RPO and RTO. Preserve the H49–H56 receipts,
   their original attribution and individual authorization boundaries.

### Historical transport dependencies

The archived Full35 B1 coordination and restore helpers and Milestone A
transport/target guards contain explicit `nutrition-j3` instance names or
assumptions about its guest paths and Docker socket. Treat them as historical
implementation inputs. A separate task can adapt reviewed copies to take an
explicit replacement identity and exact target allowlist, then prove those
guards with synthetic data. The accepted H56 restore remains evidence for its
original runner and scope. A replacement H56-equivalent recovery requires fresh
qualification and separate authorization for any real checkpoint.
