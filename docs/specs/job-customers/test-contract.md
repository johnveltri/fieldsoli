# Job Customers — Test Contract

Implementation is not complete until the automated and manual evidence below exists. Test IDs map to product requirements and must remain stable.

## Quality objective and risk inventory

Prove that convenience never compromises Job snapshot integrity, tenant isolation, permission trust, manual fallback, sensitive-data handling, or field-speed usability.

| Risk | Impact | Likelihood | Required proof |
| --- | --- | --- | --- |
| Wrong people linked or snapshots rewritten | High | Medium | TEST-04 through TEST-08, TEST-21 |
| Cross-tenant Customer exposure | High | Low | TEST-02 and TEST-09 |
| Partial Live Session save/data loss | High | Medium | TEST-07 and TEST-16 |
| Contacts permission requested too early/broadly | High | Medium | TEST-17, TEST-23, TEST-24 |
| Customer/address PII in telemetry/logs | High | Medium | TEST-09 and TEST-22 |
| Provider failure blocks field work | Medium | Medium | TEST-19, TEST-26, TEST-27 |
| Keyboard/accessibility regressions | Medium | Medium | TEST-14, TEST-20, TEST-25 |
| Old-client or migration breakage | High | Low | TEST-01 and TEST-07 |

## Traceability summary

| Test IDs | Source rules | Layer | Evidence type/environment |
| --- | --- | --- | --- |
| TEST-01–TEST-09 | REQ-01–11, REQ-14–15; STATE-01, STATE-02, STATE-03, STATE-04, STATE-05; DATA-01–09, DATA-11–13 | DB/server/integration | Automated local Supabase with mocked provider |
| TEST-10–TEST-12 | REQ-02, REQ-08–13; DATA-04–09 | Unit/API client | Automated package tests |
| TEST-13–TEST-22 | REQ-04–15; STATE-06, STATE-07, STATE-08, STATE-09, STATE-10, STATE-11, STATE-12, STATE-13, STATE-14, STATE-15, STATE-16; UX-01–14, UX-15, UX-16 | Component/screen/integration | Automated mobile tests with fake timers/native mocks |
| TEST-23–TEST-25 | REQ-05–08, REQ-12; UX-01, UX-06–15 | Manual native/device | Physical current supported iOS and Android devices |
| TEST-26–TEST-27 | REQ-08–09; STATE-09–13; DATA-09, DATA-13; UX-10–11 | Provider integration/manual | Non-production key plus controlled failure simulation |
| TEST-28 | REQ-15; DATA-03, DATA-10–12 | Release/legal/security | Maintained docs, generated manifests, store declarations |

## Test layers and boundaries

- Unit tests own normalization, eligibility, action generation, result mapping, and query-race reducers; they do not prove RLS/native/provider behavior.
- Component/screen tests own copy, row composition, commit boundaries, confirmation, keyboard hooks, and error recovery with mocked external boundaries.
- Database tests own migrations, ownership, invariants, matching, atomicity, concurrency, delete/restore, and compatibility.
- Provider integration owns one small live Geoapify smoke set; ordinary CI uses deterministic mocks and does not spend quota.
- Physical-device checks own generated permissions, native chooser behavior, OS deep links, keyboard/safe areas, screen readers, and system Settings.
- Release review owns legal/store declarations, production secret placement, and current provider terms.

## Fixtures and test data

- Use deterministic users A/B; active/deleted legacy Jobs; eligible/ineligible Customers; same-name people; conflicting identifiers; and old/new Job snapshots.
- Include blank, whitespace, Unicode, malformed, maximum practical display length, explicit clears, and two-line metadata fixtures.
- Provider fixtures include success, empty, slow, stale, quota, auth, malformed, and redacted error responses.
- Native contact fixtures include zero/one/multiple labeled phones, emails, and addresses, without real personal data.
- Clean test data after provider/device checks and never attach screenshots containing real contact details.

## Database and server tests

### TEST-01 — Job migration compatibility

Covers REQ-01, REQ-14; DATA-01, DATA-12.

- Existing Job fixtures survive the migration unchanged.
- New columns are nullable and old create/update paths still work.
- No existing Job receives a Customer link or inferred phone/email.

Evidence: Supabase migration tests and generated-type diff.

### TEST-02 — Customers ownership and privileges

Covers REQ-03, REQ-15; DATA-02, DATA-03.

- Owner can retrieve eligible owned Customers through the intended surface.
- Another authenticated user and anonymous role cannot read or mutate them.
- Cross-owner Job/Customer linking is rejected.
- Direct grants do not bypass the authoritative RPC.

Evidence: SQL/RLS tests under `backend/supabase/tests/`.

### TEST-03 — Eligibility matrix

Covers REQ-02, REQ-13.

Test name with: valid phone; valid email; meaningful manual address; malformed phone; malformed email; four-character address; address with fewer than two letters; whitespace; and missing name. Only approved combinations create/discover a reusable Customer. The Job always remains savable.

### TEST-04 — Selected Customer update

Covers REQ-01, REQ-03.

Saving an explicitly selected Customer writes the exact four-field Job snapshot and Customer defaults, including explicit phone/email/address clears. Older Jobs remain unchanged.

### TEST-05 — Conservative matching matrix

Covers REQ-10; DATA-06.

Verify same phone+email, exact name+one identifier, name-only, address-only, duplicate candidates, phone/email split across two Customers, and conflicting non-empty identifier cases. Unsafe cases create a separate Customer and never auto-merge.

### TEST-06 — Delete and restore lifecycle

Covers REQ-11; STATE-03 through STATE-05.

- Delete newest linked Job: defaults and recency recompute from newest remaining active Job.
- Delete final active linked Job: Customer becomes unavailable.
- Restore a Job: Customer reactivates/recomputes.
- Operational Job status changes alone do not hide the Customer.

### TEST-07 — Transactionality and conflicts

Covers REQ-03, REQ-06; DATA-05, DATA-13.

Force failures between logical mutation steps and verify no partial Job/Customer write. Simulate concurrent edits and verify the returned conflict/latest-snapshot behavior and Customer defaults correspond to a committed Job snapshot.

### TEST-08 — Customer search and recents

Covers REQ-04; DATA-07, DATA-08.

- Blank query returns at most three unique eligible Customers in derived recency order.
- Typed query returns at most three owned eligible name matches.
- Deleted/ineligible/no-active-Job Customers are absent.
- Same-name Customers remain separate with their own metadata.

### TEST-09 — Address function security and mapping

Covers REQ-08, REQ-09, REQ-15; DATA-09, DATA-11.

- Anonymous requests fail.
- Input/country/limit constraints are enforced.
- Provider response maps to the neutral contract.
- Logs and errors contain no query/address/provider payload.
- Upstream timeout, quota, malformed response, and authentication failures return typed coarse errors.

Use mocked provider responses in CI; do not consume live quota in the standard test suite.

## Shared and API-client tests

### TEST-10 — Normalization

Covers REQ-02, REQ-10, REQ-13; DATA-04.

Table-test whitespace/casing, US formats, explicit international numbers, extensions/invalid phones, email casing/invalid syntax, Unicode names, and meaningful-address thresholds. Confirm display snapshots are not silently rewritten.

### TEST-11 — API serialization

Covers DATA-05, DATA-08, DATA-09.

Verify full customer mutation payloads preserve explicit `null`/clears, response mapping includes new fields, provider-neutral address types leak no Geoapify fields, and stale results are identifiable.

### TEST-12 — Deep-link action eligibility

Covers REQ-12, REQ-13.

Valid phone produces Call/Text URLs; valid email produces Email URL; invalid/missing values produce no action; values are correctly encoded; inability to open a URL returns the non-blocking UI error path.

## Mobile component and screen tests

### TEST-13 — Job Edit Customer block

Covers REQ-04, REQ-05; UX-01, UX-05.

Verify field order, keyboard props, initial values, draft changes, atomic `Done` payload, `Cancel`, permissive invalid values, and keyboard-aware scroll behavior.

### TEST-14 — Picker recents and rows

Covers REQ-04; UX-02, UX-03.

Verify three recents, three search results, exact empty/error copy, omission of missing separators, natural metadata wrap, two-line truncation, same-name differentiation, and accessible combined labels. Typed queries with no matches hide the panel. Typed queries in flight with no rows yet show `Searching…`.

### TEST-15 — Replacement confirmation

Covers REQ-04, REQ-07; UX-04.

Blank fields replace without confirmation. Non-empty fields show exact title/body/actions. Cancel changes nothing; Replace applies all four values including blanks. Test saved-Customer and device-contact sources.

### TEST-16 — Live Session save boundaries

Covers REQ-06; UX-06.

- Typing alone does not call the customer mutation.
- Field blur calls once with the complete snapshot when dirty.
- Saved-Customer, device-contact, and address selection call once immediately.
- Minimize/end flush a focused dirty field.
- Failure retains draft, shows exact retry copy, and retry succeeds.
- Existing non-customer persistence remains unchanged.

### TEST-17 — Device-contact permission timing

Covers REQ-07; UX-07 through UX-09.

Opening either screen never requests permission. First explicit tap opens picker/requests only necessary access. Cancellation leaves draft unchanged. Denial leaves manual entry active and exact settings recovery copy/actions appear on a later attempt.

### TEST-18 — Device-contact value selection

Covers REQ-07; UX-08.

Test zero, one, and multiple phone/email/address values; device labels; independent chooser cancellation; selected-only retention; and no device-contact IDs in mutation/telemetry.

### TEST-19 — Address query threshold and races

Covers REQ-08; STATE-09 through STATE-13; UX-10.

Verify no request before five trimmed characters or two letters; one request after 300 ms; new input cancels/supersedes; maximum four US suggestions; `Searching…` before results; `No results` when empty; errors hide the panel; stale responses do not replace newer results; selection updates address; free text saves in every error/no-result state.

Use fake timers and mocked network responses.

### TEST-20 — Attribution

Covers REQ-08; UX-11.

Attribution appears exactly when Geoapify suggestions are visible, uses the app caption token, exposes the required destinations, disappears otherwise, and remains readable under maximum supported text scaling and both color schemes.

### TEST-21 — Job View display and menu

Covers REQ-12; UX-12, UX-13.

Verify snapshot values and separators, omission of missing values, control placement/accessibility label, hidden state with no valid actions, and a menu for one/two/three actions in fixed order. Confirm actions never use changed Customer defaults.

### TEST-22 — Sensitive telemetry redaction

Covers REQ-15; DATA-11.

Inspect analytics, error reporting, debug logging, and mocked provider failure breadcrumbs. Assert customer values, queries, Customer IDs, device-contact IDs, and raw provider messages are absent.

## Manual device and integration evidence

### TEST-23 — iOS contacts and deep links

On a physical iPhone production-like build:

- Verify generated permission behavior/copy and single-contact picker.
- Exercise denial, Settings recovery, cancellation, multiple labeled values, and selected-value import.
- Open Call, Text, and Email using installed default apps.
- Confirm FieldSoli never offers or requests write access.

Capture build identifier, OS version, and result. Do not capture real contact values in screenshots/logs.

### TEST-24 — Android contacts and deep links

On a physical Android production-like build:

- Verify `READ_CONTACTS` occurs only on explicit tap and `WRITE_CONTACTS` is absent from the merged manifest.
- Exercise denial/don't-ask-again, Settings recovery, chooser variants, and default apps.
- Confirm manual entry remains available throughout.

### TEST-25 — Keyboard, sheet, and accessibility QA

On iOS and Android:

- Traverse every field/picker with the keyboard open in Job Edit and Live Session.
- Verify active rows remain visible; Customer suggestions/attribution do not sit under the keyboard.
- Verify destructive Live Session action visibility follows existing focused-field safety.
- Exercise VoiceOver/TalkBack, large text, dark/light appearance, and reduced motion.

### TEST-26 — Live Geoapify smoke test

With a non-production test credential, verify a small representative US set: ordinary street, unit/apartment, rural address, ZIP-led query, incomplete query, and an intentionally missing address. The acceptance rule is not postal validation: useful results should be selectable where returned, and every miss/failure must preserve free-text save.

Confirm attribution destinations and inspect server logs for redaction. Record request count; do not run this suite in ordinary CI.

### TEST-27 — Quota/offline fallback

Simulate provider quota exhaustion, timeout, device offline state, and server function unavailability. Verify exact non-blocking copy, no automatic paid failover, and successful manual Job save.

### TEST-28 — Legal and store release gate

Before public release, review and record:

- Updated `docs/legal/privacy-policy.md` and mobile privacy backlog.
- Apple privacy manifest/App Store privacy answers as applicable.
- Google Play Data safety and Contacts permission declarations as applicable.
- Geoapify/OSM attribution and current free-plan terms.
- Production secrets present only server-side.

## Required verification commands

Exact scripts may be adjusted to current workspace names, but evidence must include:

```sh
npm run typecheck
npm run test -w mobile-expo -- --runInBand
npm run test:api-client
npm run test:edge-functions
npm run test:db
```

The shared-types package has no standalone test script; its contract is covered by `npm run typecheck` and the API/mobile consumers. Also run repository formatting/lint checks that apply to touched files, regenerate database types, inspect iOS/Android generated native permissions, and capture the manual evidence above.

## Exit criteria

- TEST-01 through TEST-22 pass in automation.
- TEST-23 through TEST-27 have current physical-device/integration evidence.
- TEST-28 is signed off for release.
- No open severity-high privacy, ownership, snapshot-integrity, or permission defects remain.

## Release gates and evidence

| Gate | Required checks | Evidence | Blocking failure |
| --- | --- | --- | --- |
| Before merge | TEST-01–TEST-22; typecheck/lint/format; generated DB types | CI logs and SQL/package/mobile test reports | Any failure or missing redaction review |
| Before backend deployment | Migration from clean/current DB; RLS; function secret/config; provider mocks | Migration/function verification record | Ownership, rollback, or secret failure |
| Before mobile submission | TEST-23–TEST-25; generated permission manifests; production-like config | Device notes, manifest excerpts, build ID | Early/broad permission, lost edits, inaccessible UI |
| Before public release | TEST-26–TEST-28; current provider terms/quota; legal/store declarations | Dated provider smoke record and disclosure review | Missing attribution/disclosure, exposed secret/PII, blocked manual fallback |

## Deferred or intentionally untested

- Customer profile/history, merge UI, multiple properties/contact methods, Customer CSV, bulk sync, and paid-provider failover are out of product scope and receive no tests here.
- Postal/package-deliverability accuracy is intentionally not asserted. TEST-26 proves useful bookkeeping suggestions and manual fallback, not delivery certification.
- International address quality is deferred; V1 provider requests are US-scoped. Explicit international phone parsing remains covered by TEST-10.
