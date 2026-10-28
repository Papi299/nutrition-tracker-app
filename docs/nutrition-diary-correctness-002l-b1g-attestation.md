# B1G remaining Auth-policy attestation packet

Status: UNANSWERED. This Codex-generated checklist is not a Product Owner attestation or independent channel verification. B1F's accepted settings are retained as historical observations; no Production access was repeated.

Respond YES, NO, NOT_EXPOSED or UNKNOWN for each row. Include only the permitted type/provider label when conditional detail is requested. Do not include addresses, account identifiers, credentials, hook URLs, configuration exports, screenshots, recovery links, OTPs or cookies.

| Unresolved fact | Non-secret question | Owner response |
| --- | --- | --- |
| Auth hooks | Are any Auth hooks enabled? If YES, list enabled hook types only (BeforeUserCreated, AfterUserCreated, CustomAccessToken, SendEmail, SendSMS, MFAVerificationAttempt, PasswordVerificationAttempt). Mark unsupported/unexposed types NOT_EXPOSED rather than assuming disabled. | Unanswered |
| CAPTCHA | Is CAPTCHA enabled? If YES, give provider name only. | Unanswered |
| WebAuthn MFA | Is WebAuthn MFA enabled? Use NOT_EXPOSED if its status is unavailable. Passkey sign-in being disabled does not answer this. | Unanswered |
| Additional assurance | Is a mandatory MFA/AAL2 requirement imposed outside the accepted repository's optional-enrollment behavior (for example a deployed override, operator policy or hook)? The repository itself contains no mandatory enrollment/AAL2 gate; do not reconfirm that established source finding. | Unanswered |
| Runtime origin | Does deployed APP_ORIGIN equal `https://nutrition-tracker-app-xi.vercel.app` exactly? Do not provide another URL. | Unanswered |
| Built-in delivery | Does the intended owner recovery channel currently meet the built-in email service's recipient-eligibility rules? Do not identify the recipient. | Unanswered |
| Owner-channel authority | Is an independently controlled recovery channel available with an established pre-incident binding to the intended owner? A YES is an attestation of both facts, not proof supplied by this checklist. | Unanswered |

No hosted checks or Auth messages are authorized by this packet. These questions do not block the independently testable application fix. Answers require review before any separately authorized operational qualification. Auto-confirmed email alone does not prove mailbox control or owner authority.
