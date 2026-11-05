# Consented analytics reliability and dropout diagnosis

Status: implementation for review, not released. Based on main c6c0014 (PR #116).
No attribution enablement, consent relocation, onboarding changes, dashboard writes,
production configuration, migration or deployment is included.

## Data and state contract

- Analytics remains post-login and opt-in. A granted choice and an identified
  account are required. No pre-consent capture, backfill, install or signup inference.
- Schema 2 preserves the existing event names, including PR #116's
  `document_created` and acquisition enrichment. Legacy `app_opened` still means
  consented shell availability, never downloads or first physical launch.
- Each queued request has its own UUID and original ISO occurrence timestamp,
  unchanged on retry. Delivery is at least once; PostHog eventually deduplicates
  matching UUID/event/timestamp/distinct ID. This is not an exactly-once guarantee.
- The account-owned queue persists in AsyncStorage, limited to 1000 requests and
  seven days. Overflow drops oldest requests. Retries back off to at most one per
  minute plus jitter, with a ten-second request timeout. HTTP 400/413/422 are
  discarded as invalid payloads; other failed HTTP responses are retained.
- A request is persisted before sending. Disk operations and purge are serialized;
  only one send runs per adapter. Foreground/background transitions trigger a
  best-effort flush. OS termination before persistence can still lose an event.
- Withdrawal, logout and deletion disable capture immediately, abort in-flight
  delivery and remove the queue. Collection stops before the deletion endpoint.
  Already accepted network requests cannot be recalled; provider deletion remains
  a separately verified operation. There is no post-deletion success capture.
- An explicit new grant purges the previous observation queue first. Restoration
  of existing permission may restore that same account's queue. A cached local
  withdrawal cannot be overridden by a stale remote grant; sync retries withdrawal.
- Cross-account queue restoration is rejected. Direct identity switching stops
  collection until consent is resolved again. Late documents retain PR #116's
  owner guard. Other existing asynchronous feature callbacks retain their existing
  lifecycle guards; this change does not claim a wholesale callback rewrite.
- Envelope ownership/build/session fields cannot be overridden by caller fields.
  Legacy work `session_id` becomes `visit_id`; `session_id` and `app_session_id`
  identify the analytics session (also mapped to PostHog $session_id). Cold consented startup and 30 minutes of
  background inactivity start sessions. UUIDs are random correlation IDs, not secrets.
- `expo-application` 57.0.3 (MIT) provides actual native version/build. Unavailable
  metadata is `unknown`, never a fabricated production build. Requires rebuilding
  both native apps; Expo Go is not release evidence. No new service or paid tier.
- A reviewed scalar-key allowlist excludes raw errors, customer/job text, contact
  data, email domains, tokens and arbitrary nested objects even in debug builds.
  Existing coarse numeric/bucket properties remain supported where allowlisted.
- Local `analytics.getDiagnostics()` exposes pending/drop/storage-failure counts
  and coarse delivery result, without user content. It does not phone home through
  an analytics-failure recursion. A failed queue purge rejects the operation and blocks a fresh explicit grant
  rather than silently replaying an earlier observation period. OS storage failures
  and uninstalling before a
  successful flush can lose data. Queue storage is ordinary app-sandbox storage,
  not encrypted application storage; never add content to it.

## Measurement contract

| Event | Exact meaning |
| --- | --- |
| `app_session_started` | One identified, consented app session; cold start or 30-minute background interval |
| `screen_viewed` | A distinct visible screen transition, not effect rerenders |
| `job_became_meaningful` | First observed description save/nonplaceholder creation or persisted useful work on a job |
| `useful_action_completed` | Observed saved visit, note, material, other cost, document or fullscreen work additions |
| `meaningful_return` | Useful action on a later UTC day and a different app session; once per UTC day; within/after seven days from first observed value |
| `job_work_saved` | An atomic fullscreen edit saved newly added visits/notes/materials/other costs; one batch, not each record |
| `other_cost_created` / `other_cost_updated` | Successful cost mutation; no amount/description added |
| `other_cost_create_failed` | Cost flow failed; operation distinguishes create/update |
| `workflow_validation_blocked` | A concrete completion gap was opened, or document prerequisite gaps were actually displayed |
| `document_create_started` | User initiated document creation after prerequisites passed |
| `document_create_failed` | Creation/confirmation flow did not return confirmed success; a server mutation may still have committed |
| `document_refresh_failed` | A document was confirmed but the following refresh failed |

Meaningful-job and useful-action progress is derived from permissioned events only.
The local account-scoped progress summary caps remembered job IDs and action refs at
1000 each. Repeated document/visit/note/material refs do not create duplicate derived
value events. After eviction, withdrawal/logout or another device a milestone can
recur: reports should count distinct people/jobs, not sum milestone events. The
summary is not an authoritative server lifetime activation date. No historical job
scan occurs. Missing refs limit deduplication. Base `document_created` events can
still repeat during idempotent recovery; use document_ref for distinct documents.

First value supports time/cost tracking and document-first workflows. Placeholders
alone do not activate; starting a timer alone does not prove useful work saved.
Documents use job_ref/mutation_ref from PR #116. Sharing remains handoff, not proof
of delivery/read/payment. Existing payment and customer behavior isn't redefined.

## Founder report recipe (no dashboards created)

1. One row per distinct consenting account: build, acquisition status/available
   campaign IDs, first observed session, meaningful job, first useful action, last
   successful action, last failed action and current return eligibility.
2. Funnel: observed session → meaningful job → useful action → later meaningful
   use. Show counts, numerator/denominator, schema-2 coverage start and consent gap.
3. Examine failures by workflow, safe category/code, platform and build. A validation
   gap supports a specific UX hypothesis. Silence without an error does not establish
   motivation, uninstall or failed delivery.
4. Keep Apple spend/downloads and store/platform usage in their own aggregate panels.
   Do not divide all downloads by the consented funnel as if coverage were complete.
5. Evaluate seven-day return only after seven days; show incomplete windows as
   pending. `meaningful_return` is a convenient signal; use dated useful actions for
   cohort windows when permission/device resets have occurred.

## Test contract and release gates

- Queue tests: offline persistence/relaunch, exact retry UUID/time/body, HTTP retry,
  in-flight abort, clearing pending writes, another-account rejection, expiry, overflow.
- Client tests: no pre-consent activation; blank job excluded; useful action and later
  return; document deduplication; progress restoration; screen deduplication;
  protected session/identity/build envelope; late account callback rejection.
- Existing attribution and consent tests remain; deletion asserts local stop precedes
  remote deletion. Property tests reject nested/customer/raw-error payloads.
- Typecheck and affected composer/cost/document/privacy tests. Baseline failures must
  be distinguished explicitly from regressions; see validation.md.
- Before release: build iOS/Android with the native metadata module and run synthetic
  device journeys, including airplane mode → force quit → reopen online; decline,
  grant, revoke while sending; account switch; deletion; and 30-minute background
  session boundary. Verify UUID/time/identity and counts in PostHog using test data.
- Confirm release build metadata and schema 2 in ingestion. Mark synthetic traffic
  by dedicated test-account cohort; exclude it from founder views. No live ingestion,
  real attributed install, native rebuild or production deletion proof is claimed
  by mocked source tests. Apple attribution remains disabled per PR #116.

Deferred owner decisions: earlier consent, additional survey UI, provider raw-event
retention, replay/autocapture, attribution disclosure/enablement. No decision here
changes those settings or PR #116's release gates.

Provider references checked November 5, 2026:
- https://posthog.com/docs/data/events (timestamps and eventual UUID deduplication)
- https://docs.expo.dev/versions/latest/sdk/application/ (native metadata)
