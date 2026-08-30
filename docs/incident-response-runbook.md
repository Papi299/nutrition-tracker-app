# Incident Response Runbook

## Status and boundary

This is the repository-owned, provider-neutral private-beta incident-response
contract approved by `DEC-004`, `DEC-006`, `DEC-022`, and `DEC-023`. It creates
no SLA, public uptime promise, hosted status page, monitoring account, alert
delivery integration, deployment authority, or Production evidence.

The application is best effort. Where practical, planned maintenance is
communicated before the window. Affected beta users receive incident
communication by the approved email process once the impacted population and
message are known. No real email delivery is configured by this runbook.

## Ownership and escalation

| Responsibility | Assigned and approved owner |
| --- | --- |
| Observability Owner | Maor Pichhadze |
| Performance & Reliability Owner | Maor Pichhadze |
| Incident Primary | Maor Pichhadze |
| Incident Escalation Backup | Jimmy Peachy |

The Incident Primary must acknowledge a sustained launch-blocking signal
within 15 minutes. Escalate to Jimmy Peachy at 15 minutes without
acknowledgement or when the primary needs backup. Escalate to Product Authority
at 30 minutes while the launch blocker remains sustained. These are operating
rules, not an SLA.

## Approved signal policy

| Signal | Approved threshold and window | Initial route |
| --- | --- | --- |
| Critical-operation application error | Unhandled critical-operation errors page immediately at low volume. At 100 or more operations, five errors in five minutes or more than 1% in 15 minutes pages the Incident Primary. A repeated root cause always triggers review. | Incident Primary immediately; backup and Product Authority per the escalation clock |
| Performance duration | Latency above the approved operation p95 for 15 minutes with at least 20 samples alerts. Below 20 samples every breach is reviewed. | Observability Owner and Performance & Reliability Owner |
| Liveness / uptime | An external uptime probe runs every five minutes; two consecutive failures within ten minutes alert. The repository endpoint is liveness only. | Incident Primary |
| Auth anomaly | Ten failures for one approved canonical-email digest or source class in ten minutes, or five revoked/replayed invitation attempts in 15 minutes, alert. G1 emits no email or user identity and does not implement invitation-register telemetry. | Incident Primary and the later approved restricted invitation-control process |
| Database authorization or integrity | Any authorization/integrity database error alerts. | Incident Primary immediately |
| Other unexpected database error | Three unexpected database errors in five minutes alert. | Incident Primary |
| Deployment/version | A failed deploy, required smoke, rollback, or redeploy rehearsal alerts immediately. | Incident Primary immediately |

Threshold evaluation, alert transport, provider configuration, external uptime
probing, and deployment notification remain Phase 11H/11J work under separate
authorization. G1 provides event types and deterministic policy constants; it
does not pretend that alerts were delivered.

## Response procedure

1. **Detect and intake.** Record the safe event name, timestamp, exact
   environment when known, candidate/release when known, route template,
   classification, duration where applicable, and opaque correlation ID. Do
   not copy raw errors, request bodies, provider payloads, SQL, user content, or
   credentials into incident notes.
2. **Assess.** Confirm whether the signal is application, dependency, Auth,
   database, liveness, performance, or deployment/version related. Establish
   the first and last observed time, affected operation categories, recurrence,
   and whether the event is handled, unhandled, externally unavailable, or
   indeterminate.
3. **Contain or mitigate.** Prefer reversible action. Stop unsafe retries,
   narrow traffic or pause the affected operation when authorized, use the
   safe localized maintenance/unavailable semantics, and preserve the ability
   to review current state. Do not replay a mutation whose commit status is
   unknown.
4. **Check data integrity.** Verify transaction/receipt state, duplicate and
   partial-write absence, snapshots, owner boundaries, RLS behavior, and
   cross-tenant nondisclosure. Treat indeterminate mutation status as a launch
   blocker until the authoritative current state is known.
5. **Assess user impact.** Identify affected operation categories and beta
   users only through the later approved restricted process. Do not put raw
   emails, Auth IDs, diary values, food names, or other personal/nutrition data
   in operational telemetry.
6. **Escalate.** Apply the ownership and time path above. Any repeated root
   cause is reviewed even when a percentage threshold is not met.
7. **Recover and verify.** Confirm dependency restoration, liveness, safe
   reads, authentication behavior, mutation/receipt integrity, and at least one
   representative localized journey. Recovery is not complete while required
   checks are pending or unexplained.
8. **Communicate.** For affected beta users, use the approved email process.
   State the known impact and recovery status without claiming an SLA, a
   definitive failed write when commit status is unknown, or unsupported data
   integrity. Give maintenance notice where practical. A hosted status page is
   not required.
9. **Preserve evidence.** Retain only the approved privacy-minimal operational
   fields for 30 days. Store restricted invitation-procedure evidence under its
   separately approved access/retention policy, never in the telemetry stream.
10. **Review.** Record root cause, detection gap, impact, containment,
    integrity verification, recovery evidence, communication, corrective
    action owner, and follow-up date. Phase 11K remains the only formal finding
    closure gate.

## Synthetic tabletop G1

The deterministic G1 test creates one valid `application.error` event with
critical severity, an opaque correlation ID, and no user data. The policy
routes it to Maor Pichhadze, records Jimmy Peachy as the 15-minute escalation
backup, records the 30-minute Product Authority escalation boundary, and marks
delivery `NOT_CONFIGURED_SYNTHETIC_ONLY`.

Passing this test proves repository policy wiring only. It is not a page,
email, alert-delivery, provider, deployed outage, or real incident exercise.

## Later provider-neutral handoff points

- Map only the versioned repository event object to an approved provider
  adapter; reject provider-specific fields at application call sites.
- Configure threshold/window evaluation and delivery outside the core user
  operation so provider failure cannot break the application.
- Bind exact environment and candidate/release at the deployment boundary.
- Configure a five-minute external liveness probe against `/api/health`; do not
  call it readiness or dependency health.
- Preserve 30-day operational retention and the prohibited-field boundary.
- Collect actual signal, delivery, acknowledgement, escalation, outage,
  recovery, and communication evidence only in separately authorized Phase
  11J.
