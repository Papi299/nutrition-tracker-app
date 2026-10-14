# Restart recovery

On 2026-10-14 the MacBook restart cleared the previous /private/tmp task directory, including its bare repository, uncommitted source, baseline/focused screenshots and raw validation logs. Docker volumes persisted. The primary checkout and historical worktrees were unaffected, and the prior final-audit ZIP remains intact.

The task now uses this persistent Documents directory. Recorded tool patches and specific task outputs recover source bytes and gate decisions, with hashes compared against recorded pre-restart values. Recovered transcript records do not stand in for lost raw screenshots or logs. Baseline reproductions and every required candidate validation will be executed again and freshly retained here. The failed Suspense implementation and plain-Tab WebKit run remain disclosed historical attempts, with their lost-artifact limitation. No draft PR, branch, commit, push, merge or deployment occurred before the restart.
