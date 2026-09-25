# Phase 11J3 remaining private topology preflight

Status: **READY_FOR_OWNER_DEVICE_OBSERVATIONS** as of 2026-09-26. The private topology and one authenticated iPhone path passed. This remains a preflight: none of the 39 owner observation records was executed. [Machine-readable evidence](../deployment/phase-11j3-private-device-test-remaining-topology-preflight-evidence.json) retains the earlier checkpoint and current measurements. The [original failed provisioning](phase-11j3-private-device-test-topology-provisioning.md) and [accepted reset correction](phase-11j3-local-supabase-reset-network-isolation-correction.md) remain unchanged.

## Completed 2026-09-26 resumption

The owner created the intended `tail86244a.ts.net` tailnet and approved normal interactive VM login. Tailscale 1.102.4 reports `Running`, the node online, `CurrentTailnet.MagicDNSSuffix=tail86244a.ts.net`, and the exact node DNS name `lima-nutrition-j3.tail86244a.ts.net`. No reusable auth key or boot persistence was introduced. The suffix and node name come from Tailscale itself. The unrelated `videofetch` VM was observed running on resumption and was not operated on by this task.

Docker was started manually. The three saved local volumes restored the synthetic user's normal password authentication, activation eligibility record, and matching Vault secret. The restored local stack was started with `npx supabase --network-id nutrition-j3-loopback start`; it was **not** reset again. All 12 containers remained on that private network. Effective API/DB/Studio/Inbucket/Analytics bindings remained on guest `127.0.0.1` only, and all five guest nonloopback probes were rejected.

The exact accepted runtime tree passed the real `APP_ENVIRONMENT=device-test` validator with `NODE_ENV=production`, the Tailscale-derived HTTPS `APP_ORIGIN`, local-only Supabase URL/project identity, distinct server-only secrets, and no Vercel identity. Production build and same-origin barcode WASM preparation passed. An actual-build scan of 114 browser/static artifacts found neither app server secret nor the local Supabase service key. Next.js was started with `npm run start -- -p 3001 -H 127.0.0.1`; its socket is `127.0.0.1:3001`, `/api/health` is live, English and Hebrew routes return 200 with LTR/RTL HTML, and the direct app response has the expected same-origin device-test CSP and security headers. Source inspection confirms password sign-in is a Next.js Server Action.

The installed CLI command `sudo tailscale serve --bg --https=443 http://127.0.0.1:3001` requested official HTTPS/Serve consent, which the owner completed. Its ephemeral consent URL is not recorded in Git. `tailscale serve status --json` then showed exactly HTTPS 443 with one `/` handler at the Tailscale-derived hostname and upstream `http://127.0.0.1:3001`; no Supabase port or unrelated service was targeted. The installed 1.102.4 `tailscale funnel status --json` repeats the shared web handler, so that JSON alone is not treated as Funnel proof. Human-readable `tailscale funnel status` explicitly labelled the endpoint **tailnet only**, with no `AllowFunnel` permission. VM-side HTTPS returned 200 with valid TLS and expected security headers. The Mac had no Tailscale client and could not resolve the private hostname: `OUTSIDE_TAILNET_APP_REACHABILITY=FAIL_CLOSED`.

The owner enrolled one iPhone in the intended tailnet and used Google Chrome. The private HTTPS sign-in page loaded without a certificate warning. A first password entry produced a generic Auth error; local Auth logs showed invalid credentials and no origin/forwarded-host error. After retrying the exact disposable local credential, the owner reached the protected Today page. At this exact runtime, password sign-in is `signInAction`, a Next.js Server Action, so physical sign-in also passed the representative Serve proxy action gate. The app log had zero Origin, `X-Forwarded-Host`, or other runtime errors. No security setting was relaxed.

With Tailscale connected, the iPhone could not connect to the VM hostname on local Supabase port 54321. After disconnecting Tailscale, the same iPhone could not reload the private Today URL. The static runtime audit found no required production browser-direct Supabase call site; device-test CSP is `connect-src 'self'`, and the authenticated path worked through Next.js while the local API port was unreachable from the phone. The bounded disposition is `NO_REQUIRED_BROWSER_DIRECT_SUPABASE_PATH_OBSERVED_OR_REQUIRED_FOR_PREFLIGHT`; no packet-level zero-attempt claim is made. No camera, barcode, or formal J3 case was exercised.

The app process was stopped, and `npx supabase --network-id nutrition-j3-loopback stop` backed up the synthetic local state to three volumes. There were zero J3 containers and zero J3 app/Supabase listeners. Docker, its socket, and Tailscale were inactive and disabled for boot; `nutrition-j3` was stopped. A secret-free copy of the verified session runner was stored inside the guest at `~/.local/share/nutrition-j3/device-test-runner.mjs`, mode `0600`, SHA-256 `60f15ac71c0a2b7b5c0303e4c3d58f29f1427dfe2b46f6a0603c52b109c1a6e5`. A brief start to save it confirmed the accepted runtime tree remained clean and all J3 services inactive, then the VM was stopped again. The unrelated `videofetch` VM was observed running on resumption and stopped at final inspection; this task did not operate on it.

## Baseline and unchanged runtime

The documentation baseline was accepted `main` `e906f226aa021c7a2ccd39b36ca1e704cbc72985`, tree `79a5497a5ef4f56f109511ecd1fbf6b844cf9dcc`, with zero open PRs. Exact-head push CI [run #279](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36143987620), job `108100414488`, succeeded on attempt 1: production advisories `0/0/0/0`, 311 unit passes, migration/reset/seed pass, 364 Playwright passes, and Phase 11D 53 passes with three intentional skips, zero failures, and zero flaky cases. Artifact `10869183491` has digest `sha256:60f58c48cebc096b27db58cafaf3f27e19c0d99b97327a14461658aae0adb0ea`.

The VM's clean guest Git import commit `c513ff58353510d23ec1f351cf052f658f9af98b` reproduced the accepted runtime **tree** `02e86af4db29d0f509c35308727f876ed607dba1` from candidate `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`. The original candidate commit object is not in the guest staging repository; the import was created from its verified archive. No tracked runtime file changed. The [original failed provisioning packet](phase-11j3-private-device-test-topology-provisioning.md) and [accepted reset correction](phase-11j3-local-supabase-reset-network-isolation-correction.md) remain unchanged.

## Historical 2026-09-25 local stack and synthetic account checkpoint

The preserved `nutrition-j3` Lima 2.2.0 VZ VM had its accepted 4 CPU, 7 GiB, 35 GiB, aarch64, plain-mode configuration and no static application or Supabase forward. `videofetch` remained stopped and untouched. Docker and Tailscale were started manually; neither service nor the Docker socket was enabled for boot. The private Docker network retained `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` with IPv6 disabled. No remote Supabase link or relevant cloud credentials were present in the guest session.

From the clean runtime directory, the pinned Supabase CLI 2.116.0 ran exactly:

```bash
npx supabase --network-id nutrition-j3-loopback start
npx supabase --network-id nutrition-j3-loopback db reset --local
```

The fresh reset finished 43 migrations through `20260830143000_cache_search_account_access_policy.sql` and seeded normally. A temporary guard observed the recreated database only on `nutrition-j3-loopback`, with effective `127.0.0.1:54322`. Docker's requested `HostIp=""` resolved through the network default to that effective loopback binding. All 12 J3 containers used only that network; effective published ports 54321, 54322, 54323, 54324, and 54327 and Linux listening sockets were loopback-only. Each port accepted guest loopback and rejected guest nonloopback connections. The macOS host had only Lima's loopback SSH administrative forward for this VM; its overlapping 54322/54323/54324/54327 listeners belonged to unrelated Docker Desktop.

The accepted local Auth admin/activation pattern created one disposable email-confirmed user, inserted the required `account_activations` eligibility record, and passed ordinary local password sign-in. Distinct local application secrets and the matching account-closure capability in local Vault were provisioned. Credentials and app secrets are held only in mode `0600` files under the guest's private `~/.local/share/nutrition-j3/` directory. No value is in this packet or Git. The owner has not been given the synthetic credential yet because the physical HTTPS preflight was not reached. Account closure was not tested.

The existing client-secret canary check passed a production build in its `local` test environment, prepared same-origin barcode WASM, and found no server-secret canary in 114 browser/static artifacts. This is **not** an exact `device-test` build: the actual Tailscale origin was unavailable. The runtime deployment validator, device-test production build, Next.js loopback listener, Serve, physical app sign-in, and Server Action proxy gate remain unrun. The static source audit still finds no required production browser-direct Supabase call site; no physical network-traffic claim is made.

## Historical 2026-09-25 authentication boundary and stop state

Installed Tailscale 1.102.4 CLI help was checked for `up`, `status`, Serve, Funnel, and `serve get-config`. The daemon was manually started and reported `NeedsLogin`. Normal interactive login was initiated without an auth key. No authenticated tailnet identity or DNS name was returned. Serve and Funnel status were both empty before login; neither was configured. No HTTPS consent, Serve endpoint, Funnel endpoint, outside-tailnet hostname probe, physical phone action, or device-test application process occurred. The login URL is intentionally omitted because it is an ephemeral authentication token.

The pinned CLI's normal state-preserving command was used:

```bash
npx supabase --network-id nutrition-j3-loopback stop
```

It reported local data backed up to three Docker volumes. Zero J3 containers and no J3 guest listeners remained. Docker, `docker.socket`, and `tailscaled` were stopped and remained disabled for boot; `nutrition-j3` was stopped and preserved. The local synthetic identity, activation, Vault secret, and mode `0600` files are backed up for resume; restoration has not yet been tested. No Production, hosted Supabase, Vercel, or unrelated VM mutation occurred.

## Exact future owner-session sequence

The VM-local `~/.local/share/nutrition-j3/device-test-runner.mjs` is a mode `0600`, secret-free copy of the runner verified in this preflight. It derives the actual origin from Tailscale, rejects a wrong tailnet or changed local Supabase identity, validates the environment, and starts the app with explicit device-test variables. Its SHA-256 is recorded above. Confirm the accepted runtime tree and runner before use. Resume in this order:

1. On the Mac run `limactl start nutrition-j3`. Leave `videofetch` alone.
2. In the guest run `sudo systemctl start docker` and `sudo systemctl start tailscaled`. Check `tailscale status --json` reports the intended tailnet/node online; use normal interactive `sudo tailscale up` only if re-authentication is required.
3. From `~/nutrition-j3-runtime`, run `npx supabase --network-id nutrition-j3-loopback start` **without resetting**. Verify the private network, all five effective loopback bindings, guest nonloopback rejection, and the saved synthetic user/activation.
4. Run `node ~/.local/share/nutrition-j3/device-test-runner.mjs build`, then `node ~/.local/share/nutrition-j3/device-test-runner.mjs start`. Verify `ss -ltnp` shows `127.0.0.1:3001`, `/api/health` is live, and the HTTPS origin matches Tailscale's actual DNS name.
5. Check `tailscale serve status --json` has only HTTPS 443 `/` → `http://127.0.0.1:3001`. If its stored handler is absent, reapply `sudo tailscale serve --bg --https=443 http://127.0.0.1:3001`. Check `tailscale funnel status` says **tailnet only**, with no Funnel permission. Verify trusted private HTTPS on the enrolled phone before starting the separate 39-case owner session.
6. After that session, stop only the app process group identified by `~/.local/share/nutrition-j3/next-device-test.pid` and verify port 3001 is closed. Run `npx supabase --network-id nutrition-j3-loopback stop` **without** `--no-backup`. Confirm three preserved volumes and zero J3 containers/listeners. Run `sudo systemctl stop tailscaled docker docker.socket`; on the Mac run `limactl stop nutrition-j3` and verify it is stopped. Do not delete the VM or synthetic account.

The [39-case template](../deployment/phase-11j3-owner-device-validation-template.json) remains `TEMPLATE_NOT_EXECUTED`, with 39 unique blank result, disposition, and timestamp fields, `physicalPassRecorded=false`, and `productionReleaseAuthorized=false`. Readiness is `READY_FOR_OWNER_DEVICE_OBSERVATIONS`; no physical J3 pass was credited. All 18 Phase 11 findings remain `OPEN`; Phase 11K alone can close findings. No Vercel, hosted Supabase, Production Supabase, or unrelated project was mutated. Production release remains unauthorized.
