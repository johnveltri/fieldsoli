# Apple Ads attribution — implemented, not released

Status: implementation and scoped source tests complete; native Release iPhoneOS bridge build passed. Native app release, disclosure approval, live ingestion and a real attributed install remain release gates. No campaigns, spending, remote feature flags, database or provider dashboards were changed. See [validation](validation.md).

## Scope and coordination

This change owns Apple Ads attribution and its immediate document milestone. It follows the analytics plan in Codex thread `01a19a36-6653-7116-92eb-93334703a015`. The subsequent analytics foundation work owns persistent event delivery/retry, duplicate screen events, protected session/visit IDs, actual native build metadata and the wider dropout funnel. This integration does not claim those problems are repaired.

Consent stays after authentication and legal acceptance. No anonymous pre-auth collection, behavioral queue, historical event replay, historical account-creation timestamp export, IDFA, ATT prompt, session replay or new paid provider is introduced. Signup conversion before consent remains unobservable in PostHog. Do not substitute an account timestamp for a signup event. Changing that boundary requires a separate purpose/disclosure decision.

## Data and state contract

`EXPO_PUBLIC_APPLE_ADS_ATTRIBUTION_ENABLED=true` is a **build-time release opt-in**, default false. Keep it unset until the disclosure decisions below are resolved. It is not a remote campaign control. Collection additionally requires configured PostHog, production iOS, non-TestFlight configuration, an identified account and granted optional analytics consent. Native code returns no token on simulator, Debug or sandbox-receipt builds. Old native binaries safely report unsupported if the bridge is missing. Do not distribute this via a JS-only update and assume the native bridge exists.

After identify, the iOS AdServices bridge returns a transient token. The app sends only that token to `https://api-adservices.apple.com/api/v1/` over HTTPS. No account ID or auth credential is sent to Apple. The token is never logged, persisted or sent to PostHog. The public API exchange needs no advertiser secret or additional paid attribution SDK.

The response boundary allowlists organization/campaign/ad-group/keyword/ad IDs, supported conversion/claim/placement enums and the attribution boolean. Dates, device IDs, arbitrary response fields, query text, contact information and document contents are excluded. The cache contains only those fields plus the consenting account ID; it remains local and is scoped to the observed installation. No database migration is required.

States on analytics events and the PostHog person:

| `acquisition_status` | Meaning |
| --- | --- |
| `unknown` | Lookup has not completed, failed, cache is invalid, account differs from cache owner, or previously collected attribution was withdrawn. See safe `acquisition_reason`. |
| `unsupported` | Build/platform/rollout is ineligible, or native bridge returns no token. |
| `attributed` | Apple returned `attribution: true`; `acquisition_source=apple_ads`. Individual IDs can still be absent. |
| `unattributed` | Apple returned `attribution: false`; source is `unattributed`. **Not proof of organic.** |

`acquisition_reason` values: `native_unavailable`, `different_account`, `consent_reset`, `invalid_cache`, `lookup_failed`. Neither tokens nor raw errors are attached. Missing keyword IDs, including Search Match traffic, must stay missing; the integration does not reveal individual search phrases. Match IDs to campaign/keyword exports from Apple Ads.

A resolved payload is restored for the same consenting account on the same installation. Another account receives unknown rather than the original account's attribution. Logout/reset aborts pending lookups and clears in-memory enrichment. Withdrawal stops collection, aborts lookup, waits for pending writes and replaces existing local attribution with an identity-free tombstone. Regrant does not resurrect withdrawn attribution. Declining before any lookup does not create a tombstone. Already ingested historical data is not automatically deleted by withdrawal; existing deletion/request mechanisms still apply.

Transient 404, 429 and server responses get at most three retries at five-second intervals. Network calls time out after ten seconds. Failed lookups remain unknown, are not persisted as negative, and may retry on a later foreground/identify after a one-minute cooldown. This is attribution lookup retry, **not** a durable PostHog event queue. Delayed consent can fall outside Apple's attribution window; this preserves the current consent timing rather than claiming full install coverage.

After successful account deletion the client disables analytics and clears local acquisition before sign-out, without emitting a new identified success event. This addresses local acquisition cleanup and that immediate identity-recreation trigger. Already in-flight PostHog delivery and end-to-end provider deletion verification still belong to the analytics foundation/deletion follow-up.

## Event and report contract

- `acquisition_resolved`: current consenting installation lookup or cache resolution. Can repeat; **never count these as downloads or unique installs**. It updates allowlisted person properties and clears obsolete acquisition property values.
- Existing `job_created`, `app_opened`, `app_became_active` and other consenting events receive the current acquisition envelope automatically. Early events may have unknown acquisition; person properties can be used to inspect the subsequently resolved cohort.
- `document_created`: successful creation/confirmation returned from an explicit create or a finalization that creates a new invoice. Properties: `document_type=estimate/invoice`, opaque `document_ref`, `job_ref`, `mutation_ref`. Selecting an existing invoice is excluded. Unknown-outcome recovery can repeat the confirmation, so use distinct `(person, document_ref)` and the first observed confirmation, not raw event count. A failed mutation produces no success event. Completion is scoped to the initiating account, preventing an old request from being captured under a newly signed-in account.

First observed job is not necessarily the person's first real job; existing placeholder jobs still require the plan's meaningful-activation work. First observed document confirmation is not necessarily first-ever invoice or send. No event proves delivery or payment.

Suggested PostHog views (create after rollout/ingestion verification; none created remotely here):

1. **Acquisition coverage:** distinct consenting people by acquisition status/reason, production iOS and rollout date. Show unknown/unsupported/unattributed separately. Repeated resolution events are not separate users.
2. **Observed activation by campaign/ad group/keyword:** distinct consenting people with a non-placeholder `job_created` and/or an invoice `document_created`; use first observed milestone. Prefer person acquisition properties when lookup resolved after the first event. These properties describe the most recently resolved consenting installation for the account, not guaranteed global first-touch across devices.
3. **Return use:** for each cohort, distinct people performing a meaningful persisted action on another UTC date and within days 1–7 / 8–28. Foreground alone is a weaker return signal; background timers and app silence cannot prove churn/uninstall.
4. **Spend comparison:** manually join Apple Ads aggregate cost/download reports to IDs and date ranges. Label cost per *observable consenting activated user*, not cost per all activated users. No join to pre-consent signup is available. Paid installs and PostHog people have different denominators.

Keep raw counts and a coverage start date. Reconcile aggregate installs without inventing a reason for missing PostHog users. General PostHog delivery is still fire-and-forget; offline events can be missing until the separate foundation work ships. Source tests do not prove live ingestion.

## Disclosure and release gates

The current policy describes product usability/reliability analytics but does not explicitly cover measuring advertising acquisition. This implementation therefore stays disabled by default. Do not silently enable it for prior consent records without resolving whether renewed optional consent is needed. This is a concrete disclosure-purpose gap, not a new requirement to use ATT.

Proposed policy addendum for owner review (not published or inserted into the effective legal policy):

> If you enable optional analytics, the iOS app may ask Apple whether its download is attributed to an Apple Ads advertisement. Apple receives a temporary attribution token. We may store the resulting campaign, ad-group and keyword identifiers on your device and associate them with your FieldSoli account and permitted app activity in PostHog to understand which advertisements bring useful users. We do not use this integration to obtain your advertising identifier or track activity in other companies' apps. Turning analytics off stops new attribution collection and clears locally stored attribution; previously processed information remains subject to this policy's retention and deletion terms.

The conditional consent prompt includes a corresponding campaign-information bullet when the release opt-in is enabled. The modal content can scroll so the added disclosure and both choices remain reachable on smaller screens; native text-scaling review remains a release gate. A [source-derived local visual reference](../../product/chatgpt/apple-ads-consent-preview.html) is provided; it is not a native screenshot. Before release: approve/publish accurate policy wording, resolve renewed consent for existing users, check App Store privacy answers for the linked advertising/product-interaction data and purpose, then enable the build-time opt-in. Do not change effective legal versions or publish legal text as part of this source implementation.

Release checklist:

- Install pods and compile native iOS bridge; retain native build/version evidence.
- Run contract/client/consent/invoicing tests and typecheck. Resolve or document independently reproduced baseline failures.
- With the release opt-in enabled in a test build, visually review the consent prompt. Refresh its local ChatGPT reference before shipping the UI. Default-off behavior does not show the extra bullet.
- Verify zero token/network requests before consent or after decline; grant, withdrawal during a lookup, logout, regrant and account switching on a physical device. TestFlight/simulator cannot verify production attribution.
- Ship a new native App Store build; record the native build and coverage date.
- On an authorized physical iPhone, perform a real ad-attributed install, grant analytics, create a synthetic job/invoice, return on a later day, and inspect the matching PostHog person/events and Apple IDs. Do not fabricate an ad interaction or claim a unit-test fixture proves real attribution.
- Confirm Search Match reports missing keyword IDs safely, and verified negative/error states remain distinct. Keep campaigns/spending under John's control.
