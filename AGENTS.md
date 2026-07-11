# Repository Working Rules

- Produce engineering output, code comments, commits, pull requests, and
  completion reports in English.
- Use focused branches and pull requests for each approved task.
- Codex owns the delivery loop: branch, implementation, focused validation,
  push, pull request, CI monitoring, required corrections, final review,
  squash merge, branch deletion, and local `main` synchronization.
- Never merge while a required check is pending, failing, cancelled, or
  unexplained.
- Preserve Row Level Security, server-derived ownership, authenticated-only
  mutations, and least-privilege grants.
- Preserve English/Hebrew localization and LTR/RTL behavior.
- Preserve blank-as-null and explicit-zero semantics.
- Preserve effective-dated target history and diary snapshot values.
- Follow the documented phase sequence. Do not start a later phase while an
  earlier required corrective task remains incomplete.
- Never link, push, reset, inspect, or otherwise operate on remote Supabase
  without explicit human approval. Local Supabase is the default for schema
  and authenticated testing.
- Use focused local checks during development and GitHub Actions as the final
  authoritative gate.
- Keep completion reports concise and limited to outcomes, validation,
  delivery state, and remaining work.
