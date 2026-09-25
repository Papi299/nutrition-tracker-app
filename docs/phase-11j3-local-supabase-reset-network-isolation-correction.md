# Phase 11J3 local Supabase reset network isolation correction

Task: `PHASE-11J3-LOCAL-SUPABASE-RESET-NETWORK-ISOLATION-CORRECTION-001`

Machine-side result: `LOCAL_SUPABASE_RESET_NETWORK_ISOLATION_CORRECTED`
J3 execution readiness: `BLOCKED_PENDING_REMAINING_PRIVATE_DEVICE_TEST_TOPOLOGY_PREFLIGHT`

This record corrects only the local reset failure measured in [PR #138's historical blocked packet](phase-11j3-private-device-test-topology-provisioning.md). That packet and its JSON evidence remain unchanged. The documentation baseline was `main` commit `a4e281428d46ffa92f7a086510a2ced9c71935a6`, tree `b6b2c5a5ea042648d70d3607ea761e8ce2a22913`; its exact-head push CI run [#277](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35496569150) passed on attempt 1. The runtime in the VM remained candidate `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree `02e86af4db29d0f509c35308727f876ed607dba1`, with a clean guest worktree. No application runtime file changed.

## Local machine and command boundary

The dedicated `nutrition-j3` VM was a Lima 2.2.0 `vz` Ubuntu 24.04.4 ARM64 instance (4 vCPU, 7 GiB memory, 35 GiB disk), configured with `plain: true`, no static port forwards, and no automatic startup. `videofetch` stayed stopped and untouched. Docker was 29.8.1; the repository-pinned Supabase CLI was 2.116.0. Actual `npx supabase --help`, `start --help`, and `db reset --help` exposed the global `--network-id` option; `db reset --help` also exposed `--local`. No remote Supabase project was linked or accessed.

Before startup, no J3 Supabase container ran, no J3 wildcard listener existed, and Tailscale was inactive/unconfigured. The dedicated Docker network `nutrition-j3-loopback` had `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` and IPv6 disabled. The old generated network from the failed attempt initially existed without attached containers; it was absent after the explicitly networked start. Its absence was not used as the correction.

From the exact runtime candidate directory, the start command was:

```bash
npx supabase --network-id nutrition-j3-loopback start
```

All 12 J3 containers initially joined only `nutrition-j3-loopback`. Docker's **effective** `NetworkSettings.Ports` published API 54321, database 54322, Studio 54323, Inbucket 54324, and Analytics 54327 only on `127.0.0.1`; guest sockets agreed. No other J3 service was published. The first reset on 2026-09-20 and the second on 2026-09-25 both used exactly:

```bash
npx supabase --network-id nutrition-j3-loopback db reset --local
```

The first reset finished with 43 `Applying migration` lines through `20260830143000_cache_search_account_access_policy.sql`, `Seeding data from supabase/seed.sql...`, and `Finished supabase db reset on branch master.` The database reported 43 migration rows and latest version `20260830143000`. A live recreation guard sampled the new Postgres container on `nutrition-j3-loopback` with effective `127.0.0.1:54322`; after completion all 12 containers remained on that network and all five effective published bindings and guest listeners remained loopback-only.

There was a pause between resets. The VM was stopped, then restarted on 2026-09-25; its runtime tree and first-reset log were verified again. Docker restored 11 containers, the edge runtime was restarted on its existing private network, and the explicit start command above was rerun. All 12 containers and five loopback bindings were rechecked before proceeding. The first-reset guest nonloopback probe was performed on this restored stack: each published port accepted a guest `127.0.0.1` connection and rejected a connection to the guest's own nonloopback interface.

During the second reset, a guard repeatedly inspected container creation, network membership, effective bindings, and Linux sockets, with an immediate J3-container stop on unsafe exposure. It sampled the newly created Postgres container as running only on `nutrition-j3-loopback`, effective `127.0.0.1:54322`, and recorded no failure. The reset again finished with all 43 migrations, the same latest migration, seed and completion markers, and 43 migration rows in Postgres. An independent inspection after completion found all 12 running containers only on `nutrition-j3-loopback`; all five effective published bindings and listening sockets were `127.0.0.1` only. The guest loopback/nonloopback connection probe passed again for all five ports.

Docker's `HostConfig.PortBindings` for recreated Postgres requested `HostIp=""` in both samples. This is an unspecified **requested** bind. The network's default binding option resolved it to effective `NetworkSettings.Ports.HostIp="127.0.0.1"`; the live socket and nonloopback probes independently confirmed that effective isolation. The historical failed reset differed: its effective binding was wildcard and it joined a generated network. A preliminary temporary guard before the first corrected reset treated a blank requested binding on Studio as failure and stopped the stack before any reset. This guard was corrected to evaluate the effective binding, and the stack was explicitly restarted; no wildcard socket was observed during that false alarm.

Lima remained in plain mode with no J3 host port forward. On macOS, Lima listened only on its loopback SSH ports; pre-existing wildcard listeners on 54322, 54323, 54324, and 54327 belonged to the unrelated `com.docker.backend` process. No new J3 Mac-host Supabase forward was observed. This attribution does not claim an unqualified Mac `localhost` probe reached J3.

After the proof, `npx supabase --network-id nutrition-j3-loopback stop --no-backup` stopped and removed the local J3 containers without a backup. A final inspection found zero running J3 containers, zero remaining J3 containers, and zero guest listeners on the five published ports. The preserved `nutrition-j3` VM was stopped; `videofetch` remained stopped. Tailscale remained inactive; no login, Serve, Funnel, application build/start, synthetic Auth account, device test, Vercel change, remote Supabase operation, or Production/provider mutation was performed.

This result closes the specific reset network isolation blocker. The [39-record owner template](../deployment/phase-11j3-owner-device-validation-template.json) remains `TEMPLATE_NOT_EXECUTED`, bound to the same runtime SHA/tree, with every observation blank and release authorization false. The remaining private topology, Tailscale Serve, application, authenticated flow, physical connectivity, and owner-device preflight gates still require separate authorization and evidence. The [machine-readable correction record](../deployment/phase-11j3-local-supabase-reset-network-isolation-correction-evidence.json) carries the measured values.
