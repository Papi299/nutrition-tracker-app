# Phase 11J3 private topology provisioning attempt

Status: **BLOCKED** on 2026-09-20. This is a machine-side safety failure, not a J3 physical observation or a device-test pass. The dedicated VM is preserved but stopped. Do not start the 39-case owner matrix from this attempt.

## Repository and runtime identity

The starting documentation `main` was `2224369cd6dbccedccec41b0a14930301f585f32`, tree `8f9cce8156a40a3d062891f59603adc1bb0e8ccc`, parent `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, with zero open PRs. [Post-#137 CI run #275](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35472110692), `Validate` job `105974819814`, was an exact-head `push` attempt 1 success. Its production advisory gate was 0/0/0/0; unit tests 311 passed; migration replay 43 through `20260830143000_cache_search_account_access_policy.sql`; Playwright 364 passed; Phase 11D 53 passed, 3 intentional skips, 0 failed and 0 flaky. Artifact `10593785839` had digest `sha256:7f4a6a73d90af2e5c30058f8360c7a70a1972ff4b07936c418f79f11934f8a53`.

The **runtime** source came from a clean archive of `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree `02e86af4db29d0f509c35308727f876ed607dba1`. The archive checksum was verified after transfer, and staging it in a new guest Git repository reproduced that exact tree with a clean working tree. PR #137's documentation commit was not substituted for runtime code. No application build or process was started because the isolation gate failed first.

## Host and dedicated VM

The Mac was macOS 27.0 ARM64 with 10 logical CPUs, 16 GiB RAM, and approximately 69 GiB available on `/` at preflight. Lima 2.2.0 listed only the unrelated, stopped `videofetch` VM before provisioning; it was not changed. The Mac had Docker Desktop active and pre-existing wildcard listeners on ports 54322, 54323, 54324, and 54327. There was no host `tailscale` executable. Those existing Docker services were not changed.

The new `nutrition-j3` Lima VM used `vz`, ARM64, Ubuntu 24.04.4 LTS from the `release-20260705/ubuntu-24.04-server-cloudimg-arm64.img` image (Lima expected image digest `sha256:7df0201546f75b8bcc1044594c806c35749421ad3c9bc1be2a3ab806cfae39cc`), 4 vCPU, 7 GiB RAM, and 35 GiB disk. Seven GiB followed [Supabase's full-stack memory guidance](https://supabase.com/docs/reference/cli/start). Lima configuration has `plain: true`, no static `portForwards`, no mounts, and no built-in containerd. [Lima plain mode](https://lima-vm.io/docs/config/plain/) disables dynamic forwarding, while retaining SSH. Docker Engine was 29.8.1, Node 22.23.2, npm 10.9.8, repository Supabase CLI 2.116.0, and Tailscale 1.102.4. Docker and Tailscale services were disabled for automatic VM boot.

The installed CLIs' relevant `--help` output was checked before use. Current [Supabase local-development guidance](https://supabase.com/docs/guides/local-development) recommends a dedicated Docker network with loopback host binding. The [Supabase changelog](https://supabase.com/changelog) was checked for local-development and CLI changes. No remote Supabase link or hosted credentials were present in the clean runtime source.

## Isolation failure and containment

The dedicated Docker bridge `nutrition-j3-loopback` had `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` and IPv6 disabled. `npx supabase start --network-id nutrition-j3-loopback` started 12 Supabase containers. Docker metadata showed all five published ports bound to guest `127.0.0.1`: API 54321, database 54322, Studio 54323, Inbucket 54324, and Analytics 54327. Guest socket inspection initially agreed. Lima had no app or Supabase forwards to the Mac; its only new Mac listener was the SSH administration port. The Mac's pre-existing Docker Desktop Supabase listeners remained present, so an unqualified localhost port probe on the Mac could not identify the J3 stack.

The subsequent `npx supabase db reset --local` **recreated the database container on the CLI-generated `supabase_network_github-plugin-github-openai-curated-you` network**, not on `nutrition-j3-loopback`. Docker's database `HostConfig.PortBindings` became `{"5432/tcp":[{"HostIp":"","HostPort":"54322"}]}`. Linux `ss` independently showed `0.0.0.0:54322` and `[::]:54322`. The reset log listed 43 migration applications through `20260830143000_cache_search_account_access_policy.sql`, but the reset was interrupted at the security stop and is **not** accepted as a completed replay or seed.

On detecting the wildcard listener, the database container and then every other J3 Supabase container were stopped. A follow-up check found zero running J3 Supabase containers and zero wildcard 54322 listeners. The `nutrition-j3` VM was stopped and preserved. The Tailscale client was still `NeedsLogin`; the initial interactive login request was withdrawn. No Serve or Funnel configuration was made.

This is a hard stop under the approved J3 brief. A separately reviewed corrective task must establish a supported, repeatable network-bound reset/replay path and reprove Docker metadata and sockets **after** reset before resuming account, build, Serve, or phone preflight. The pinned CLI's `db reset --help` lists a global `--network-id` flag, but it was not tested as a correction in this stopped attempt. The VM must remain stopped until that separate corrective work is authorized.

## Unexecuted gates and preservation

No synthetic Auth account or password was created. No Vault secret, device-test environment, production build, Next.js process, Tailscale hostname, Serve endpoint, Funnel endpoint, device login, Server Action, same-tailnet test, outside-tailnet test, or browser network inspection was produced. The physical observation template retains all 39 blank cases, `physicalPassRecorded=false`, and `productionReleaseAuthorized=false`. All 18 Phase 11 findings remain open; only Phase 11K may close them.

No second cloud Supabase project was created. Production Supabase and the unrelated `academic-papers-index` project were not contacted or changed. No Vercel or Production configuration was changed.

Safe status and shutdown commands for the preserved VM are `limactl list` and `limactl stop nutrition-j3`. `limactl start nutrition-j3` boots only the VM; Docker and Tailscale are not configured for automatic startup. **There is no approved command to restart local Supabase or the application for a J3 session until the reset isolation failure is corrected and verified.** Do not delete the preserved VM as part of this evidence task.
