# P11A-009 qualified legal/privacy review checklist

**Status:** `QUALIFIED_REVIEW_REQUIRED`. The reviewer should identify name, qualification, jurisdiction/scope, version, date, findings and any required edits. No box is checked by this repository packet. Technical references point to the [data-governance packet](phase-11k-p11a009-policy-data-governance.md), [machine-readable matrix](../deployment/phase-11k-p11a009-policy-data-governance-evidence.json), [English draft](privacy-notice-draft-en.md) and [Hebrew draft](privacy-notice-draft-he.md).

- [ ] Is the notice sufficient for the exact personal-use MVP, its operator identity/contact, data classes, purpose, sources, export, logical closure, backup and support disclosures? Which statements need alteration before publication?
- [ ] What are the applicable legal bases/notice or consent mechanisms, if any, for necessary Auth/session storage, nutrition records, invitation eligibility, and optional future features? Do not infer an answer from the current code.
- [ ] What active-account, post-closure, security/evidence and backup retention triggers, periods, exceptions and disposal proof are required for each row in the Product Owner table? Review the existing 30-day recurring artifact, 30-day telemetry policy and designed active-beta-plus-90-day register period separately.
- [ ] How may “close account” be represented when it immediately denies application access but retains Auth identity, product rows, immutable receipts and backup copies, with no pseudonymization or physical deletion? Is any additional user request route needed?
- [ ] What procedure and timing are required if physical Auth/data deletion or pseudonymization is offered later, given the `account_closures.user_id` restrictive foreign key and immutable historical records?
- [ ] Is the backup disclosure sufficient when encrypted public-repository artifact bytes may be downloadable, the private key is separately held, recurring artifacts expire after 30 days, and the original qualified copy's final disposition is unresolved? What treatment of a closed/deleted account in old copies is appropriate?
- [ ] What independent source of truth, authorization, evidence and cutover block are needed to reconcile closures, changed/deleted rows, retention expirations, invitation state and access restrictions after a Production restore? How should any irreconcilable state be treated?
- [ ] Is the EN/HE nutrition/health disclaimer accurate for a tracking tool using user-entered and imported nutrition values, without diagnosis, care or accuracy guarantees? Where should it appear?
- [ ] What exact USDA FoodData Central attribution, release citation, source-link, transformation disclosure and correction/takedown language is required for search, food detail, barcode, reuse, diary snapshots and export? Review source/distributor terms; do not assume a license classification from this packet.
- [ ] What provider roles, contractual terms, security commitments and geography need verification for Supabase, Vercel and GitHub? Assess USDA separately as a data source and verify whether any live user data is sent to it.
- [ ] Is the least-privilege support/operator design sufficient? Which project-admin access, logging, independent approval, incident access and user-request procedures are necessary when provider administrators may inspect data but the app has no general support view?
- [ ] Is the restricted invitation-register purpose, field set, access boundary, append-only correction, `ACCOUNT_CLOSED` reconciliation and intended retention appropriate? What proof is required before operating a store?
- [ ] Are processor/provider international processing, backup storage, remote access, and notification disclosures required for the intended operator and user location? Specify evidence and wording rather than assuming geography.
- [ ] Does the final Hebrew text convey the same substantive meaning as the English draft? A separate native EN/HE affected-surface review for P11A-003 remains required after policy text is approved.
- [ ] Are there other jurisdiction-specific requirements, representations or approval steps for this exact architecture? Identify them with an attributable source and scope; no legal compliance conclusion is made here.

## Review outcome record

| Field | Reviewer to complete |
| --- | --- |
| Reviewer identity and qualification | `UNRESOLVED` |
| Jurisdiction and scope | `UNRESOLVED` |
| Reviewed source commit and draft versions | `UNRESOLVED` |
| Required changes and supporting reasoning | `UNRESOLVED` |
| Approved exact EN/HE copy or rejection | `UNRESOLVED` |
| Product Owner disposition reference | `UNRESOLVED` |
| Date and signature/attribution | `UNRESOLVED` |

A completed review still does not itself close P11A-009 or P11A-003. Phase 11K must re-evaluate final copy, implementation, operational proof and every remaining gate.
