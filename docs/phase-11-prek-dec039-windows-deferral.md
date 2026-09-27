# DEC-039 — Defer Windows physical validation without blocking continued Phase 11 development

Approver: **Maor Pichhadze — Product Owner**. Date: **2026-09-27 — Asia/Jerusalem**. Product Owner decision approved; executor-authored recording pending independent exact-head review. Current acceptance contract: **`2.0-personal-use-windows-deferred-amended`**. [Machine amendment](../deployment/phase-11-prek-dec039-windows-deferral-evidence.json).

Attributable Product Owner direction:

> And I want to put aside the Windows matter for now. I decide to proceed with the full development.

DEC-039 supersedes **only DEC-038's Phase 11K eligibility dependency** on completed physical Windows evidence and the resulting J3 completion requirement. DEC-036/037/038 and historical Contract 1.9 remain immutable history. DEC-038 previously permitted J4–J6 while still requiring accepted Windows/J3 completion before 11K. Development may now continue and 11K may evaluate open findings while carrying Windows as an explicit deferred release limitation.

| Case | Execution | Current classification | PASS credit | Blocks development / 11K |
| --- | --- | --- | --- | --- |
| J3-WIN-CHROME-01 | NOT_EXECUTED | DEFERRED_PRE_RELEASE_REQUIRED_FOR_WINDOWS_SUPPORT | None | No / No |
| J3-WIN-EDGE-01 | NOT_EXECUTED | DEFERRED_PRE_RELEASE_REQUIRED_FOR_WINDOWS_SUPPORT | None | No / No |

Windows remains in the long-term intended support scope; it is neither permanently excluded nor accepted. Actual accepted physical Windows Chrome/Edge evidence is required before claiming verified Windows support in a release. A release without it must exclude Windows from that release's verified supported-client claim. A future Production request must explicitly state exclusion for that release or validation first; no such future choice is made here.

J3 remains **INCOMPLETE_WITH_DEFERRED_WINDOWS_EVIDENCE** and `physicalPassRecorded=false`. Accounting: 39 historical IDs = 37 active-support cases + two excluded Firefox IDs; 37 = 30 accepted camera carry-forwards + five accepted UI cases + two deferred/unexecuted Windows cases. No new physical PASS is recorded. All prior evidence limitations, including unmeasured exact 200% mobile zoom and eight unresolved refresh-token events, remain. Localization, LTR/RTL, accessibility, no-JavaScript, CJ-001–035 and automated browser evidence do not change.

The accepted [J6 interim packet](phase-11j6-interim-evidence-reconciliation.md) and its JSON are unchanged. Its Windows-caused 11K-ineligibility conclusion is superseded only for that gate. Historical J3 is not complete and J6 final is not performed. A separately scoped forward reconciliation must bind independently accepted DEC-039, new GitHub-governance evidence and the then-current candidate before 11K, carrying Windows as deferred without fabricated completion. Revalidation is bounded to actual impact; no wholesale J1–J5 repetition is inferred.

Current role-gate eligibility is **NOT_ELIGIBLE_ROLE_ASSIGNMENTS_PENDING**; Phase 11K remains NOT_STARTED. Five new open HIGH CodeQL alerts separately stop a governance-remediation-complete claim and require bounded engineering triage; this decision neither accepts those findings nor invents an additional role assignment. These roles each remain UNASSIGNED_BLOCKING_BEFORE_11K, with no named assignee or acceptance:

- Independent acceptance reviewer
- Candidate release approver
- P1 exception authority

The “full development” direction assigns nobody. The evidence recording and future forward reconciliation still require independent review. Open findings are evaluated in 11K rather than newly imposed as entry blockers. All 18 findings remain OPEN, including P11A-005 and P11A-016; only 11K may close genuinely evidenced findings. The settings remediation is recorded in the [governance packet](phase-11-prek-github-governance-remediation.md), pending independent acceptance.

`productionReleaseAuthorized=false`. No overall release-readiness or verified Windows claim follows from the relaxed development gate. Production requires its separate explicit Product Owner act and applicable release gates. No provider/runtime/data/physical testing, J3 VM startup, role assignment, final J6, 11K, finding closure or merge is authorized or performed here. This task ends at a Draft PR for independent ChatGPT review.
