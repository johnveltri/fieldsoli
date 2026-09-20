# FieldSoli Mobile App Privacy Backlog

**Status:** Complete on `marketing/privacy-2` — mobile privacy backlog #1–#9, Help screen, PostHog delete hook

**Prepared:** July 3, 2026

**Related:** [privacy-policy.md](./privacy-policy.md), [terms.md](./terms.md), [consent-versions.md](./consent-versions.md)

This document records the bidirectional audit between the FieldSoli mobile app (`apps/mobile-expo`) and the published Privacy Policy, plus the sequenced work required to align app behavior with policy commitments before store submission.

## Audit summary

### Aligned today

| Area | Policy claim | App behavior |
| --- | --- | --- |
| Profile data | Name, email, trades, account ID | Collected via signup and `profiles` table |
| Job records | Descriptions, customers, addresses, notes, materials, sessions, payment/revenue | Stored in `jobs`, `sessions`, `notes`, `materials` |
| Permissions | No camera, mic, location, calendar, notifications; contacts read-only on explicit Job import | `expo-contacts` configured with least-privilege picker copy; no bulk sync |
| Account deletion | In-app Delete account control | Profile → Delete account → `delete-account` edge function |
| Analytics provider | PostHog optional product analytics | PostHog adapter when env configured |
| Sensitive field minimization | Coarse categories, not raw content | Production sanitizer strips email, customer names, job descriptions, error text when `debugRichEnabled=false` |
| No GPS / payment cards / inbox | Not collected | Confirmed — no such integrations |

### Gaps (policy vs. app)

| Priority | Gap | Policy reference | Current app behavior |
| --- | --- | --- | --- |
| P0 | Analytics without consent | "FieldSoli uses product analytics only after you agree to analytics collection" | `AnalyticsClient` initializes at import, creates/persists anonymous ID, fires `app_opened` before sign-in |
| P0 | No privacy/terms acceptance at signup | "privacy-policy acceptance record" | No checkbox, no `legal_acceptances` writes |
| P0 | No reacceptance on version bump | "request renewed consent before applying the new practice" | No version check on launch |
| P1 | No Privacy Choices UI | "withdraw analytics permission through the privacy choices described below" | No Privacy Choices screen or analytics toggle |
| P1 | Withdrawal does not clear local analytics ID | "clears the app's local analytics identifier" | `reset()` keeps persisted `fieldsolo.analytics.anonymousId` |
| P1 | No in-app legal links | Policy easily available in app (store requirement) | No links on sign-in/sign-up or Profile |
| P2 | Sensitive fields attempted at capture sites | Coarse operational error categories only | Events attach `email`, `customer_name`, `job_short_description` (stripped in prod only); `trades[]` sent without blocklist |
| P2 | Data portability | "portability of eligible information in a usable format" | Email-only request path; no in-app export |
| P2 | PostHog deletion on account delete | Deletion within 30 days | `delete-account` edge function queues PostHog bulk delete when secrets are configured |

## Sequenced implementation backlog

### 1. Version constants (app)

Add `REQUIRED_PRIVACY_VERSION` and `REQUIRED_TERMS_VERSION` constants matching [`consent-versions.md`](./consent-versions.md) (`2026-07-03`).

**Files:** new `apps/mobile-expo/src/lib/legal-versions.ts` (or shared package)

### 2. Signup acceptance (combined checkbox)

On sign-up mode in `SignInScreen.tsx`:

- Add required, unchecked checkbox: "I agree to the Privacy Policy and Terms"
- Link to `https://fieldsoli.com/privacy` and `https://fieldsoli.com/terms`
- Block signup until checked
- On successful signup, insert two rows into `legal_acceptances`:
  - `document_type: 'privacy_policy'`, `document_version: REQUIRED_PRIVACY_VERSION`, `source: 'mobile_signup'`
  - `document_type: 'terms'`, `document_version: REQUIRED_TERMS_VERSION`, `source: 'mobile_signup'`

**Files:** `SignInScreen.tsx`, new `packages/api-client/src/consent.ts`

### 3. Reacceptance gate

On authenticated launch (`App.tsx` / `AuthContext`):

- Fetch latest accepted version per document type from `legal_acceptances`
- Compare to required versions
- If missing or stale, show blocking modal with links and "I agree" action
- Record new acceptances with `source: 'mobile_reacceptance'`

**Files:** `App.tsx`, new reacceptance modal component

### 4. Opt-in analytics (default off)

Refactor `AnalyticsClient` (`apps/mobile-expo/src/lib/analytics/client.ts`):

- Do not initialize PostHog adapter, anonymous ID, session ID, or event queue until consent is `granted`
- Read consent from AsyncStorage (fast path) hydrated from `analytics_consent` table on auth
- `capture()` and `identify()` become no-ops when consent is not granted

### 5. Analytics consent prompt

After first successful auth (post-signup or sign-in for users without a consent record):

- Present clear analytics opt-in dialog (unchecked/off by default)
- Explain what is collected (interaction events, platform, app version, coarse error categories)
- On accept: write `analytics_consent` row (`status: 'granted'`), enable analytics
- On decline: write `analytics_consent` row (`status: 'withdrawn'`), keep analytics disabled

### 6. Privacy Choices screen

Add screen accessible from Profile:

- Analytics on/off toggle (reads/writes `analytics_consent`)
- Links to Privacy Policy, Terms, delete-account page
- On withdrawal: stop collection, clear persisted anonymous ID, reset PostHog identity, upsert `status: 'withdrawn'`

**Files:** new `PrivacyChoicesScreen.tsx`, navigation wiring, Profile link

### 7. In-app legal links

Add links on:

- Sign-in / sign-up screen (Privacy Policy, Terms)
- Profile / settings (Privacy Policy, Terms, Privacy Choices)

### 8. Analytics minimization

Remove sensitive properties at capture sites rather than relying on sanitizer:

- Remove raw `email` from event payloads (keep `email_domain` if needed)
- Remove `customer_name`, `job_short_description`, `material_description`
- Replace raw `trades[]` with `trade_count` only
- Consider removing `debugRichEnabled` path from production builds entirely

**Files:** `SignInScreen.tsx`, `JobDetailScreen.tsx`, `ProfileScreen.tsx`, analytics types

### 9. Tests

| Test | Scope |
| --- | --- |
| Signup requires legal checkbox | UI / integration | Done (`SignInScreen.test.tsx`) |
| Version bump triggers reacceptance modal | UI / integration | Done (`App.legal-gate.test.tsx`, `LegalReacceptanceModal.test.tsx`) |
| No analytics events before consent granted | Unit (`analytics.test.ts`) | Done (`client.consent.test.ts`) |
| Withdrawal clears local anonymous ID | Unit | Done (`client.consent.test.ts`) |
| `legal_acceptances` RLS (own rows only) | Backend | Done (`consent_tables_rls.test.sql`) |
| `analytics_consent` RLS (own rows only) | Backend | Done (`consent_tables_rls.test.sql`) |

## Backend ready (implemented)

The following backend foundation supports the backlog above:

- `public.legal_acceptances` — append-only audit log for privacy policy and terms acceptance
- `public.analytics_consent` — current analytics consent state per user
- Migration: `backend/supabase/migrations/20260703220000_create_consent_tables.sql`

Waitlist consent remains on `public.waitlist_signups` for marketing signups only.

## Store submission reminders

- Enter `https://fieldsoli.com/delete-account` in Google Play Data Safety form
- Enter `https://fieldsoli.com/privacy` in App Store Connect and Play Console
- Complete App Privacy / Data Safety labels from shipping build
- Obtain legal review of Terms before submission
