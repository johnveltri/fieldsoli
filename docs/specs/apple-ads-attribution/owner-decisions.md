# Owner decisions before acquisition rollout

This packet is for review. None of the decisions below have been applied. Attribution remains disabled by default. Consent stays at its current point after authentication/legal acceptance; the separate onboarding initiative owns any broader flow changes.

## 1. Explain the acquisition purpose

**Recommendation:** disclose that optional analytics links Apple's campaign/ad-group/keyword identifiers with the consenting user's FieldSoli activity to measure advertising effectiveness. Use the proposed addendum in [implementation.md](implementation.md) as review text. It describes the token exchange with Apple, local storage, PostHog association, and withdrawal behavior. It does not claim access to individual search phrases, IDFA, or other apps' activity.

Decide whether to approve that purpose and wording, the effective date, and the corresponding App Store privacy classifications. The source implementation does not establish legal compliance. Do not publish the addendum merely by merging the disabled integration.

Affected release files:

- `docs/legal/privacy-policy.md`: approved purpose, collected identifiers, recipients, retention and withdrawal explanation.
- `docs/legal/consent-versions.md`: actual effective date, notice/reacceptance plan and updated privacy version.
- `apps/mobile-expo/src/lib/legal-versions.ts` and `apps/marketing/src/lib/waitlist-validation.ts`: matching privacy-version references when the approved policy changes. A Terms change should follow an actual Terms decision rather than being inferred from this integration.
- `apps/marketing/src/app/privacy/page.tsx`: reads the canonical Markdown; verify its published rendering, not a separate duplicate policy.
- App Store Connect privacy answers: linked identifiers/product interaction data and the applicable advertising/analytics purposes; verify the actual configuration. No answers were changed here.

## 2. Prior optional analytics grants

**Recommendation:** require a new affirmative optional analytics choice covering acquisition before collecting attribution for an existing user. Present it at the current consent location. A privacy-policy acceptance alone must not be treated as optional analytics permission. Declined users keep using the app normally.

The present backend only stores `granted/withdrawn` and an update timestamp; it has no disclosure-purpose/version field. The current disabled integration therefore cannot prove that a prior grant covered the new purpose. Flipping its build switch alone would let prior grants trigger attribution. **Do not enable it until this is resolved.**

Recommended implementation after approval:

- Add a nullable analytics `disclosure_version` field and persist the version of the wording actually shown on a successful grant. Legacy/null versions do not qualify for acquisition.
- Keep product analytics behavior and acquisition eligibility separate: an older grant can retain its existing product-analytics meaning while acquisition waits for the revised affirmative choice.
- Prompt legacy **granted** users once at the current post-authentication point for the revised optional choice. A decline stops optional analytics according to the existing choice semantics; it never blocks normal app use.
- Preserve **withdrawn** users' choice; do not automatically prompt them again. They can deliberately opt in through Privacy Choices using the revised disclosure.
- New users see the revised disclosure at the existing point and only a matching current-version grant qualifies for acquisition.
- Old mobile versions can continue product analytics; grants written without a disclosure version never silently authorize acquisition. Verify migration compatibility before rollout.
- Server state is authoritative for eligibility; a missing version, failed read, offline uncertainty or stale cache keeps acquisition off. Do not invent a consent timestamp/version.

Affected follow-up files: `packages/api-client/src/analyticsConsent.ts` and tests; a new additive backend migration and RLS/compatibility tests; `apps/mobile-expo/src/lib/analytics/consentSync.ts`, `consentStorage.ts`, `client.ts`/`config.ts` and their tests; `AnalyticsConsentPromptModal.tsx`, `PrivacyChoicesScreen.tsx`, consent-gate wiring in `AuthenticatedAppChrome.tsx`, and their tests. The policy/version references above must be coordinated with that release.

Alternative: keep acquisition disabled and first ship the analytics reliability work. This avoids changing the optional-consent purpose now, but provides no paid-acquisition-to-user-quality linkage. Relying on old grants after only updating policy wording is not recommended without an explicit owner/privacy review that supports that scope; it is not selected by this packet.

## 3. Release order

1. Review/merge the **disabled preparation** PR if desired. This does not enable collection or authorize deployment.
2. Approve purpose/wording and the existing-user choice above; assign an effective date aligned with the intended release.
3. Implement/version/test acquisition eligibility and the approved consent treatment. Verify zero attribution on legacy/null/withdrawn/missing consent and correct behavior across devices/account switches.
4. Finalize and publish approved disclosures through the separate authorized legal/site release, coordinate mobile policy versions and store privacy answers. Do not change the campaign or spend to do this.
5. Build/archive the full native app with the opt-in enabled only when the versioned acquisition eligibility is present. Review the actual native consent screen and confirm no token requests before qualifying consent. A native bridge target compile is not a full archive.
6. Release the native App Store build after the normal release approval. TestFlight can test consent and event mechanics; it cannot prove production Apple Ads attribution in this implementation.
7. Verify a real ad-attributed install on John's selected physical iPhone, matching Apple IDs to the consenting PostHog account; create synthetic job/invoice records and inspect later return use. Do not classify absent events as churn.
8. Create/review the acquisition coverage and quality views from the reporting contract. Establish the new coverage date before interpreting spend. John controls campaign pause/resume and budgets.

## Current review boundary

The prepared source includes the iOS bridge, safe response/cache handling, consent-gated client enrichment, document completion events, successful-deletion local cleanup, conditional disclosure preview and tests. It deliberately does **not** publish policy text, change legal versions, add consent-schema migrations, enable attribution, create provider dashboards, deploy, submit an app or alter campaigns.

Known remaining limitations: pre-consent signup is unobservable; the transport has no durable event queue; person acquisition properties describe the latest resolved consenting installation, not guaranteed global first-touch; recovery confirmations must be counted by distinct document, not raw event count. Full event-delivery/deletion-race/session work remains coordinated with the analytics plan.
