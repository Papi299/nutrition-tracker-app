# Privacy notice — English draft

**Status:** `DRAFT_PENDING_PRODUCT_OWNER_AND_QUALIFIED_REVIEW`. This is proposed MVP copy, not a published notice or a legal-compliance statement. Before use, the Product Owner must fill and verify `[OPERATOR_IDENTITY]`, `[SUPPORT_CONTACT_CHANNEL]`, `[EFFECTIVE_DATE]`, `[APPROVED_RETENTION_SCHEDULE]`, `[APPROVED_REQUEST_PROCESS]` and `[APPROVED_PROVIDER_DISCLOSURE]`. The qualified reviewer must approve the exact final text and placement.

**Effective date:** `[EFFECTIVE_DATE]`

**Operator:** `[OPERATOR_IDENTITY]`

**Contact for privacy, account and correction requests:** `[SUPPORT_CONTACT_CHANNEL]`

**Request process:** `[APPROVED_REQUEST_PROCESS]`

## Information handled and why

This nutrition-tracking app uses an invited Supabase Auth account. Account information includes an Auth user ID, email address, authentication and session information, invitation state, and the recorded activation/eligibility acknowledgement. Necessary session cookies support sign-in and protected pages. The current app does not include a nonessential analytics SDK.

You can enter a display name and language preference; set calorie and macronutrient targets with effective dates; record diary entries, portions, notes and nutrient values; create custom foods, saved meals and recipes; and save favorites. The app stores dated diary snapshots and records some completed actions so repeat requests do not duplicate entries. The application schema and account export reviewed for this draft do not contain weight, height, birth date or diagnosis fields. If the product changes, this statement must be reviewed again.

Food search and selection use a shared catalog, including controlled imports from USDA FoodData Central. Food and source labels appear in relevant views, and source/provenance metadata is retained for imported catalog records. User-entered values, source values and application calculations can differ. **Proposed attribution, `DRAFT_PENDING_QUALIFIED_REVIEW`:** “Some food information is based on USDA FoodData Central. The displayed values and portions may reflect imported source data and application transformations; check the source and serving details before using them.” Exact release citation and surface placement are pending review.

## Where information goes

Supabase provides Auth and database services. Vercel hosts the application and may handle necessary requests and server logs. GitHub hosts source/CI and the recurring encrypted backup artifacts and redacted manifests. USDA FoodData Central is an upstream food-data source; the reviewed repository code does not show a live transfer of your account or diary data to USDA. Provider contract terms, access, locations and any required disclosures remain under qualified review. `[APPROVED_PROVIDER_DISCLOSURE]`

Normal app access is limited by authentication and user-ownership rules. The app has no general support screen for reading user nutrition records. Authorized infrastructure operators may have privileged provider access; actual Production grants and an audited support procedure still need verification. Application telemetry is designed to exclude user IDs, food/nutrition content, free text and secrets, but hosting log scope and retention need verification. Do not send passwords or sensitive nutrition details through a support request unless an approved secure path is provided.

## Export and account closure

While your account is active, you can request a recent-password-authenticated JSON export from the account area. It includes account-facing identity and activation information, profile, target history, diary, your custom foods and their related values, favorites, saved meals, recipes, selected activity records and referenced food-source information. It does not include passwords, tokens, the full shared catalog, internal ingestion/security records or the separately designed restricted invitation register. The download is generated for the current account and is not stored as a durable export job by the app.

**Close-account copy — proposed for the account screen:** “Closing your account immediately ends application access. We record an irreversible closure event and attempt to sign you out. Your Auth identity, nutrition data and certain historical records remain stored; closure does not erase or pseudonymize them. Encrypted backups may retain an earlier copy until their applicable retention ends. You cannot reactivate this account through the app. Download your JSON export before closing if you want a copy; export is unavailable afterward. Closing does not promise immediate or complete deletion.”

The exact later treatment and duration of retained identity, product and historical records are `[APPROVED_RETENTION_SCHEDULE]`. No physical deletion or pseudonymization occurs as part of the current close-account action. The restricted invitation-register design calls for a separate `ACCOUNT_CLOSED` entry, but no operational store or automatic synchronization has been established.

## Backups, retention and recovery

The current recovery design targets a 24-hour recovery point and an 8-hour recovery time. Recurring encrypted database-backup artifacts have a 30-day GitHub expiry; their redacted manifest accompanies the archive. The encrypted archive includes durable Auth identity and application/database records. Because the repository is public, encrypted artifact bytes may be downloadable; the private decryption key is held separately. The original recovery-qualified copy has a separate disposition still to be decided. Volatile Auth sessions and tokens, Storage object bytes and Vault secret values are outside the current archive. A future Production restore must reconcile account closures, later changes/deletions and retention decisions before restored data is used. That reconciliation is not automated today.

The operational telemetry policy is 30 days; actual hosted enforcement is still to be verified. Retention for account records, support evidence, source records and the restricted register remains `[APPROVED_RETENTION_SCHEDULE]`. These unresolved periods must be filled before this draft becomes a final notice.

## Nutrition information

**Health disclaimer — proposed user-facing copy:** “This app helps you record foods, portions and nutrition targets. Nutrient values may come from you or imported sources and may be incomplete or inaccurate. Use the information as a tracking aid, not as a diagnosis, treatment plan, emergency service or substitute for advice from a physician or registered dietitian.”

For questions or requests about your information, use `[SUPPORT_CONTACT_CHANNEL]` once the Product Owner has approved and published it.
