# Milestone A application release checklist — no enrichment

All hosted cells are **NOT EXECUTED**. This checklist becomes applicable only
after independent DEC-042 amendment acceptance and the separate owner recovery
decision. It provides no read, mutation, build or promotion authority.

| Gate | Required evidence / stop condition |
| --- | --- |
| Approved source | Exact independently accepted Git SHA/tree, repository/ref, runtime dependency base and unchanged original 48-file SQL inventory. Full required CI/CodeQL on the candidate; no open failed required check is waived. |
| Database first | Exact original prefix 47 separately committed/verified, accepted CP47, then exact 48 separately committed/verified and CP1-48. Match installed source/object/role/ACL/RLS and resolve applicable B2 drift before advancing. |
| Atomic contract | Actual `create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[])`, VOLATILE SECURITY INVOKER, empty search path, authenticated-only execution; correct limited NOLOGIN/NOINHERIT/NOBYPASSRLS reader authority. Missing RPC blocks deployment/use; never fall back automatic reference-dependent work to a manual API. |
| Project/environment | Exact authorized Supabase project and app environment/configuration version, no secret values in evidence. Production-target build is a Production-connected action even before canonical promotion. |
| Build | Separately authorized Production-targeted trusted-Git build from accepted source, READY identity and validator result, immutable build/deployment provenance. Source-only local validation does not prove provider-effective settings. |
| Unique URL | Protected unique deployment URL; verify effective protection, exceptions, aliases/generated origins, intended project and exact build before traffic promotion. Do not create bypasses or assume configured SSO proves reachability/retirement. |
| Owner/Auth | Legitimate owner session, activation/account access and RLS; owner isolation with accepted local negatives and separately authorized hosted read/write scope. Do not copy tokens or manufacture Production accounts. |
| Nutrition paths | New automatic and reference-dependent quantity paths use atomic persistence and current reference. Intentional manual overrides, null/zero, historical diary/reuse captures and completed receipts remain intact. Test correct quantity conversion, exact retry/original timestamp, changed-payload conflict and safe failures under explicit write scope. |
| Locales/devices | Candidate-bound EN/HE, LTR/RTL, native/JS forms and error preservation. Actual authorized Mac Safari/Chrome, iPhone Safari/Chrome and Android Chrome results, with device/OS/browser/source/time recorded. Emulation is supporting evidence only. Existing Windows deferral and Firefox exclusion retain their meanings. |
| Promotion | Separate attributable owner approval of exact canonical promotion/window after unique-URL acceptance. Then verify authoritative Current and live canonical alias point to that same build and recheck permitted acceptance. No promotion occurs under this PR. |
| Original references | Complete approved public Foundation head/identities/source versions/core/scalar/serving values unchanged. No mapping activation, lifecycle import, public archive/serving change or nutrient operator executes during A. |
| Legacy risk | Old URLs/actions and direct authenticated APIs may still admit old snapshots. Preserve that explicit pre-existing exposure. Do not claim full retirement or B1 closure; any release-driven reference change requires permanent B1 first. |
| Recovery/rollback | Valid CP1-48 and bounded-RPO decision; exact compatible fallback build/configuration available. Retain schema 47/48. A pre-enrichment old build requires established compatibility and unchanged references. Once references change, an unqualified old writer is forbidden. Hobby's previous-deployment rollback limit does not guarantee arbitrary fallback availability. |

The accepted PRE-01–PRE-10 and PRE-12 cases retain their content. PRE-11 full
legacy exclusion is a **Milestone B prerequisite**, not a claimed Milestone A
PASS. Milestone A still needs correct routing/protection and explicit known
legacy reachability classification. All mutation smoke needs exact owner/account,
payload/count/key/window and cleanup/history permission; read-only smoke does
not authorize it. This task performs none of these hosted checks.
