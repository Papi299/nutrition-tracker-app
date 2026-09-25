# Phase 11J3 remaining private topology preflight checkpoint

Status: **HUMAN_TAILSCALE_AUTH_REQUIRED** on 2026-09-25. The corrected local Supabase reset, synthetic local account, and repository gates passed. The dedicated VM did not join a tailnet, so this packet makes no claim about Serve, trusted private HTTPS, the physical phone, or the 39 owner observations. [Machine-readable evidence](../deployment/phase-11j3-private-device-test-remaining-topology-preflight-evidence.json) contains measured values and explicit `NOT_REACHED` dispositions.

## Baseline and unchanged runtime

The documentation baseline was accepted `main` `e906f226aa021c7a2ccd39b36ca1e704cbc72985`, tree `79a5497a5ef4f56f109511ecd1fbf6b844cf9dcc`, with zero open PRs. Exact-head push CI [run #279](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36143987620), job `108100414488`, succeeded on attempt 1: production advisories `0/0/0/0`, 311 unit passes, migration/reset/seed pass, 364 Playwright passes, and Phase 11D 53 passes with three intentional skips, zero failures, and zero flaky cases. Artifact `10869183491` has digest `sha256:60f58c48cebc096b27db58cafaf3f27e19c0d99b97327a14461658aae0adb0ea`.

The VM's clean guest Git import commit `c513ff58353510d23ec1f351cf052f658f9af98b` reproduced the accepted runtime **tree** `02e86af4db29d0f509c35308727f876ed607dba1` from candidate `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`. The original candidate commit object is not in the guest staging repository; the import was created from its verified archive. No tracked runtime file changed. The [original failed provisioning packet](phase-11j3-private-device-test-topology-provisioning.md) and [accepted reset correction](phase-11j3-local-supabase-reset-network-isolation-correction.md) remain unchanged.

## Local stack and synthetic account

The preserved `nutrition-j3` Lima 2.2.0 VZ VM had its accepted 4 CPU, 7 GiB, 35 GiB, aarch64, plain-mode configuration and no static application or Supabase forward. `videofetch` remained stopped and untouched. Docker and Tailscale were started manually; neither service nor the Docker socket was enabled for boot. The private Docker network retained `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` with IPv6 disabled. No remote Supabase link or relevant cloud credentials were present in the guest session.

From the clean runtime directory, the pinned Supabase CLI 2.116.0 ran exactly:

```bash
npx supabase --network-id nutrition-j3-loopback start
npx supabase --network-id nutrition-j3-loopback db reset --local
```

The fresh reset finished 43 migrations through `20260830143000_cache_search_account_access_policy.sql` and seeded normally. A temporary guard observed the recreated database only on `nutrition-j3-loopback`, with effective `127.0.0.1:54322`. Docker's requested `HostIp=""` resolved through the network default to that effective loopback binding. All 12 J3 containers used only that network; effective published ports 54321, 54322, 54323, 54324, and 54327 and Linux listening sockets were loopback-only. Each port accepted guest loopback and rejected guest nonloopback connections. The macOS host had only Lima's loopback SSH administrative forward for this VM; its overlapping 54322/54323/54324/54327 listeners belonged to unrelated Docker Desktop.

The accepted local Auth admin/activation pattern created one disposable email-confirmed user, inserted the required `account_activations` eligibility record, and passed ordinary local password sign-in. Distinct local application secrets and the matching account-closure capability in local Vault were provisioned. Credentials and app secrets are held only in mode `0600` files under the guest's private `~/.local/share/nutrition-j3/` directory. No value is in this packet or Git. The owner has not been given the synthetic credential yet because the physical HTTPS preflight was not reached. Account closure was not tested.

The existing client-secret canary check passed a production build in its `local` test environment, prepared same-origin barcode WASM, and found no server-secret canary in 114 browser/static artifacts. This is **not** an exact `device-test` build: the actual Tailscale origin was unavailable. The runtime deployment validator, device-test production build, Next.js loopback listener, Serve, physical app sign-in, and Server Action proxy gate remain unrun. The static source audit still finds no required production browser-direct Supabase call site; no physical network-traffic claim is made.

## Authentication boundary and stop state

Installed Tailscale 1.102.4 CLI help was checked for `up`, `status`, Serve, Funnel, and `serve get-config`. The daemon was manually started and reported `NeedsLogin`. Normal interactive login was initiated without an auth key. No authenticated tailnet identity or DNS name was returned. Serve and Funnel status were both empty before login; neither was configured. No HTTPS consent, Serve endpoint, Funnel endpoint, outside-tailnet hostname probe, physical phone action, or device-test application process occurred. The login URL is intentionally omitted because it is an ephemeral authentication token.

The pinned CLI's normal state-preserving command was used:

```bash
npx supabase --network-id nutrition-j3-loopback stop
```

It reported local data backed up to three Docker volumes. Zero J3 containers and no J3 guest listeners remained. Docker, `docker.socket`, and `tailscaled` were stopped and remained disabled for boot; `nutrition-j3` was stopped and preserved. The local synthetic identity, activation, Vault secret, and mode `0600` files are backed up for resume; restoration has not yet been tested. No Production, hosted Supabase, Vercel, or unrelated VM mutation occurred.

## Exact safe resume sequence

The next execution must first have the owner available for normal interactive Tailscale approval and confirmation of the **intended tailnet name**. The prior login URL may be stale and must not be reused as a credential. Resume in this order:

1. Confirm `nutrition-j3` and `videofetch` are stopped; run `limactl start nutrition-j3` only for the dedicated VM.
2. In the guest, manually `sudo systemctl start docker`; verify `nutrition-j3-loopback`, the saved local volumes, and no unexpected J3 listener.
3. From `~/nutrition-j3-runtime`, run `npx supabase --network-id nutrition-j3-loopback start` **without resetting** the saved synthetic state. Verify all five effective loopback bindings and that the synthetic account/activation are present. A later authorized fresh reset would erase this preserved account.
4. Manually `sudo systemctl start tailscaled`; use normal `sudo tailscale up` interactive login if needed. Verify `tailscale status --json` is `Running` on the owner's intended tailnet and obtain the actual `Self.DNSName`. Never use a reusable auth key.
5. Generate the exact `https://<node>.<tailnet>.ts.net` `APP_ORIGIN` from that DNS name; validate the actual `device-test` environment with the runtime validator, build that exact candidate, inspect browser artifacts, and start Next.js with `npm run start -- -p <app-port> -H 127.0.0.1`. Verify its socket and English/Hebrew routes.
6. Configure only Tailscale Serve to proxy `http://127.0.0.1:<app-port>` using the installed CLI syntax. Verify Serve configuration, Funnel absence, trusted HTTPS, macOS outside-tailnet failure, physical same-tailnet load and sign-in, Server Action behavior, physical failure to reach port 54321, and phone failure after Tailscale disconnect. Do not begin camera tests or the 39 formal observations during this preflight.
7. For shutdown, stop the Next.js process, run `npx supabase --network-id nutrition-j3-loopback stop` **without** `--no-backup`, stop manually started services, then `limactl stop nutrition-j3`. Confirm the saved local volumes and zero listeners. Do not delete the VM or synthetic account.

The [39-case template](../deployment/phase-11j3-owner-device-validation-template.json) remains `TEMPLATE_NOT_EXECUTED`, with 39 unique blank records, `physicalPassRecorded=false`, and `productionReleaseAuthorized=false`. Readiness remains `BLOCKED_PENDING_REMAINING_PRIVATE_DEVICE_TEST_TOPOLOGY_PREFLIGHT`. All 18 Phase 11 findings remain `OPEN`; Phase 11K alone can close findings. Production release remains unauthorized.
