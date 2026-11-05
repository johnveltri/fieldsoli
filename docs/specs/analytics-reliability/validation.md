# Validation evidence

Date: November 5, 2026. Branch: codex/analytics-reliability, based on c6c0014.
Runtime available in this environment: Node 23.7.0; repository requests Node 22.
Re-run required CI in the supported Node version before merge.

## Passing checks

- Mobile TypeScript: `tsc -p apps/mobile-expo/tsconfig.json --noEmit`.
- Twelve focused Jest suites: 123 tests passed (queue, client reliability, native
  metadata config, existing analytics/attribution/consent, AuthContext, composer,
  JobDetailScreen, analytics prompt and PrivacyChoices).
- Two document-checkpoint tests passed: missing-business prerequisite exposure and
  creation failure/recovery. Existing document_created is reused, not duplicated.
- Queue-specific proof includes persisted offline replay with original UUID/time,
  transient HTTP retry with identical body, in-flight abort/purge, pending-write
  purge, other-account rejection, seven-day expiry, 1000-event overflow, storage
  failure/recovery and explicit purge failure.
- Synthetic journey proves pre-consent exclusion, blank-job exclusion, useful
  activation, document-ref deduplication, later-day return and progress restoration.
- `npm run product:export`, `npm run design:check`, `git diff --check`.

## Existing suite failures

A full mobile run exposed 20 failures in four suites. An independent archive of
unchanged main c6c0014 reproduced the same 20 failing tests (64 passing tests in
those four suites), using the same local dependencies:

- InvoicingJobControls: 8 failures involving saved preview retries/native modal
  dismissal/composer fixtures. The unchanged original control reproduced them.
- App.navigation: 7 failures waiting for the Home fixture (plus Fragment warnings).
- App.legal-gate: 4 gate/fixture failures.
- SignInScreen: 1 expected-policy-version mismatch: the test expects October/
  September versions while merged legal constants use November 2.

These are not treated as passing checks or fixed incidentally in this PR. The
source/type and focused behavioral evidence above does not establish a green full
mobile suite. Required CI/review must account for these failures before merge.

## Not performed

No simulator/physical-device build, live PostHog delivery, production account
operation, Apple attributed install, dashboard write, deployment or settings
change. Native iOS/Android rebuilds and the release checklist in implementation.md
remain necessary. No rendered screen UI changed, so no new screenshot assets were
needed; the local ChatGPT product HTML and text exports were refreshed.

The persistent queue provides bounded at-least-once delivery, not a guarantee
against OS termination, uninstall, storage failure or a request accepted just before
abort. Provider UUID deduplication is eventual; inspect distinct UUIDs/record refs
in low-volume reporting. Progress markers are local observation summaries, not a
server-authoritative activation history.
