# FieldSoli Legal Document Versions

This file is the canonical source of truth for current legal document version identifiers used across the marketing site, mobile app, and backend consent records.

| Document | Version constant | Effective date |
| --- | --- | --- |
| Privacy Policy | `2026-11-02` | November 2, 2026 |
| Terms of Service | `2026-11-02` | November 2, 2026 |

## Where versions are referenced

- **Canonical markdown:** [`privacy-policy.md`](./privacy-policy.md), [`terms.md`](./terms.md)
- **Marketing site constants:** `PRIVACY_POLICY_VERSION` and `TERMS_VERSION` in [`apps/marketing/src/lib/waitlist-validation.ts`](../../apps/marketing/src/lib/waitlist-validation.ts)
- **Mobile app constants:** `REQUIRED_PRIVACY_VERSION` and `REQUIRED_TERMS_VERSION` in [`apps/mobile-expo/src/lib/legal-versions.ts`](../../apps/mobile-expo/src/lib/legal-versions.ts)
- **Website pages:** [`apps/marketing/src/app/privacy/page.tsx`](../../apps/marketing/src/app/privacy/page.tsx) and [`apps/marketing/src/app/terms/page.tsx`](../../apps/marketing/src/app/terms/page.tsx) render the canonical Markdown directly
- **Waitlist consent:** `waitlist_signups.privacy_policy_version`, `waitlist_signups.terms_version`, and their corresponding acceptance timestamps (marketing waitlist only)
- **App user consent:** `legal_acceptances.document_version` (authenticated users; see backend migration)

When a document is materially updated, increment the version string, update every reference above, and require renewed acceptance where applicable.

## November 2, 2026 hosted-document update — owner review before rollout

This is a substantive update covering customer-facing estimates/invoices and anonymous hosted-link disclosure, not a typo-only revision. Both current constants advance together and the mobile legal gate requires renewed acceptance of prior versions. Website pages render the canonical Markdown directly; there are no separate generated legal copies.

Before merging or publishing, the owner must confirm the proposed effective date against the actual rollout and approve the notice/reacceptance plan under Terms Section 23 and Privacy Section 13. If rollout occurs later, update both dates and all version references together. Existing installed mobile builds will keep their compiled required versions until updated; coordinate website publication and mobile release rather than assuming a website edit updates installed clients. This draft does not establish legal compliance or authorize deployment.

Source review: anonymous resolution and stable tokens are implemented in `20261006224955_invoicing_documents.sql` and `20261013163352_invoice_backed_job_revenue.sql`; archive disables links through `20261013034151_archive_disables_document_links.sql`. The document renderer exposes long descriptions as Client notes; the marketing share routes and SiteAnalytics implement previews, no-index/no-store requests, and analytics exclusion. These findings were verified from source, not a live customer-link test.

Known separate issue (excluded from this change): `backend/supabase/functions/delete-account/index.ts` revokes hosted document links after CSV storage cleanup. A cleanup failure can return before revocation. The policy therefore describes completed deletion, not immediate revocation on request. Track the ordering fix separately.
