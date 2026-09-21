# FieldSoli Legal Document Versions

This file is the canonical source of truth for current legal document version identifiers used across the marketing site, mobile app, and backend consent records.

| Document | Version constant | Effective date |
| --- | --- | --- |
| Privacy Policy | `2026-09-20` | September 20, 2026 |
| Terms of Service | `2026-09-20` | September 20, 2026 |

## Where versions are referenced

- **Canonical markdown:** [`privacy-policy.md`](./privacy-policy.md), [`terms.md`](./terms.md)
- **Marketing site constants:** `PRIVACY_POLICY_VERSION` and `TERMS_VERSION` in [`apps/marketing/src/lib/waitlist-validation.ts`](../../apps/marketing/src/lib/waitlist-validation.ts)
- **Mobile app constants:** `REQUIRED_PRIVACY_VERSION` and `REQUIRED_TERMS_VERSION` in [`apps/mobile-expo/src/lib/legal-versions.ts`](../../apps/mobile-expo/src/lib/legal-versions.ts)
- **Website pages:** [`apps/marketing/src/app/privacy/page.tsx`](../../apps/marketing/src/app/privacy/page.tsx) and [`apps/marketing/src/app/terms/page.tsx`](../../apps/marketing/src/app/terms/page.tsx) render the canonical Markdown directly
- **Waitlist consent:** `waitlist_signups.privacy_policy_version`, `waitlist_signups.terms_version`, and their corresponding acceptance timestamps (marketing waitlist only)
- **App user consent:** `legal_acceptances.document_version` (authenticated users; see backend migration)

When a document is materially updated, increment the version string, update every reference above, and require renewed acceptance where applicable.
