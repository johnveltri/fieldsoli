# Job Customers — Implementation Plan

Status: Ready for implementation

Scope: Planning only; no product code is changed by this feature-shaping packet.

## Readiness basis

- Approved product spec: `docs/specs/job-customers/spec.md`
- State model: `docs/specs/job-customers/state-model.md`
- Data contract: `docs/specs/job-customers/data-contract.md`
- UX contract: `docs/specs/job-customers/ux-contract.md`
- Test contract: `docs/specs/job-customers/test-contract.md`
- Source revision reviewed: `f80fb43098bda3752f846ffb4d2164e09baefa9a`
- Remaining blockers: None

## Current-state findings

- `public.jobs` has `customer_name`, `service_address`, and soft deletion, but no phone, email, Customer link, or Customers table in `backend/supabase/migrations/`.
- The latest atomic Job-detail edit RPC updates Customer name/address but does not model linked defaults; a new migration must extend/supersede it rather than editing prior migrations.
- Shared/API Job view and mutation types currently expose Customer name/address only in `packages/shared-types/src/` and `packages/api-client/src/`.
- Job Edit already has the intended future seam: the current plain Customer row in `apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx` and draft ownership in `useJobEditDraft.ts`.
- Live Session currently persists identity fields on a 500 ms schedule in `apps/mobile-expo/src/components/ds/LiveSessionBottomSheet.tsx`; Customer fields need the different approved selection/blur boundary.
- Job View composes compact Customer/address metadata in `JobDetailJobHeader.tsx`; header controls are owned by `JobDetailScreen.tsx`.
- Expo Linking is present; Expo Contacts and native permissions are not configured in `apps/mobile-expo/package.json` / `app.json`.
- Existing legal text says FieldSoli does not request Contacts access and describes customer name/address but not phone/email, so public release requires synchronized updates.

## Change map

| Area | Expected files/systems | Owning rules |
| --- | --- | --- |
| Schema/RLS/RPC | `backend/supabase/migrations/`, `backend/supabase/tests/` | REQ-01–03, REQ-10–11, REQ-14–15; STATE-01–05; DATA-01–07, DATA-12–13 |
| Shared/API types | `packages/shared-types/src/`, `packages/api-client/src/` | REQ-01–04, REQ-12–14; DATA-04–08 |
| Address service | `backend/supabase/functions/address-autocomplete/` | REQ-08–09, REQ-15; STATE-09–13; DATA-09, DATA-11, DATA-13 |
| Reusable pickers | `apps/mobile-expo/src/components/ds/` and focused hooks | REQ-04, REQ-07–09; UX-02–04, UX-07–11, UX-14–16 |
| Job Edit | `JobDetailEditMode.tsx`, `useJobEditDraft.ts`, tests | REQ-04–05, REQ-07–08; STATE-06–16; UX-01–05, UX-07–11, UX-14–15 |
| Live Session | `LiveSessionBottomSheet.tsx`, `JobDetailScreen.tsx`, tests | REQ-06–08; STATE-06–16; UX-01, UX-04, UX-06–11, UX-14–15 |
| Device contacts/native config | mobile package/app config and generated manifests | REQ-07, REQ-15; DATA-10; UX-07–09 |
| Job View/actions | `JobDetailJobHeader.tsx`, `JobDetailScreen.tsx`, tests | REQ-12–13; UX-12–13 |
| Legal/product/release | legal docs, current-product exports, store declarations | REQ-09, REQ-15; DATA-11–12; TEST-26–28 |

## Chosen approach

Build an additive Customer convenience layer around the existing Job snapshot model:

1. Add owned Customers and nullable Job phone/email/link columns.
2. Centralize eligibility, conservative matching, defaults, delete/restore recomputation, and snapshot persistence in server transactions.
3. Introduce shared Customer/address suggestion types and API methods.
4. Build reusable mobile Customer and address picker primitives.
5. Integrate them into Job Edit, Live Session, and Job View.
6. Add least-privilege device-contact import.
7. Complete privacy, attribution, product-context, and release validation.

This extends the existing plain Customer row and Live Session identity editing rather than creating a new Customer destination.

## Build/reuse/buy decisions

| Capability | Decision | Rationale |
| --- | --- | --- |
| Customer picker | Build with existing FieldSoli input/sheet primitives | Small, product-specific interaction; preserves visual and keyboard behavior |
| Device contact UI | Use Expo/native contact picker | Least-privilege OS behavior and labeled contact values; avoid custom address-book browsing |
| Phone parsing | Use maintained open-source standards parser | Validity and E.164 normalization are unsafe to reimplement with regex |
| Address data | Use Geoapify free plan behind server adapter | Cost control, acceptable bookkeeping quality, required attribution fits picker footer |
| Address orchestration | Build thin Supabase Edge Function adapter | Protects secret, enforces auth/rate limits, redacts logs, enables provider replacement |
| Customer invariants | Build PostgreSQL RPCs/tests | Atomic Job/Customer behavior and RLS belong at the data boundary |

## Phase 1 — Database foundation

Primary areas:

- `backend/supabase/migrations/`
- `backend/supabase/tests/`
- `packages/api-client/src/database.types.ts`

Work:

- Add DATA-01 Job columns and DATA-02 Customers table in a new forward-only migration.
- Add indexes for owner-scoped normalized matching, active Customer search, and linked active Job recency.
- Add RLS, explicit privileges, timestamp maintenance, and account-deletion behavior.
- Add transactional save/recompute/delete/restore functions from DATA-05 through DATA-07.
- Extend the existing Job-detail atomic mutation rather than allowing Customer fields to split across writes.
- Add SQL tests TEST-01 through TEST-08.
- Regenerate database types from the local schema.

Proof gate:

- Existing migrations apply cleanly from zero.
- Existing Job fixtures are byte-for-byte semantically unchanged.
- Ownership, rollback, deletion/restoration, matching, and no-backfill tests pass.

## Phase 2 — Shared domain and API client

Primary areas:

- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/jobDetailView.ts`
- `packages/api-client/src/applyJobDetailEdit.ts`
- `packages/api-client/src/jobDetail.ts`
- `packages/api-client/src/jobs.ts`
- new focused Customer/address client modules as warranted

Work:

- Extend Job/domain/view types with phone, email, and optional Customer link.
- Add normalization/eligibility helpers with the selected phone library.
- Add full-snapshot customer mutation and owner-scoped suggestion query.
- Preserve explicit nulls/clears through serialization.
- Update Job-detail mapping and existing fixtures.
- Add TEST-10 through TEST-12.

Proof gate:

- Typecheck and package tests pass.
- API fixtures prove old and new rows map safely.
- No Customer PII enters logs or analytics helpers.

## Phase 3 — Provider-neutral address service

Primary areas:

- `backend/supabase/functions/address-autocomplete/`
- shared/API address suggestion types
- function tests and environment documentation

Work:

- Implement the DATA-09 neutral interface and Geoapify adapter using the official autocomplete endpoint.
- Require authenticated users, cap input/output, apply a per-user rate budget, and use short upstream timeouts.
- Configure server-only Geoapify credentials for local/staging/production environments.
- Redact queries and provider payloads from logs/errors.
- Document a hard project budget compatible with the 3,000-request/day free plan; do not configure automatic paid overage.
- Add mocked TEST-09 and TEST-11 coverage.

Proof gate:

- Mobile code contains no provider key and no Geoapify-specific result type.
- Provider failures return a typed, non-sensitive, non-blocking response.
- A future adapter can replace Geoapify without a database migration.

## Phase 4 — Reusable mobile Customer controls

Primary areas:

- `apps/mobile-expo/src/components/ds/`
- focused Customer/address hooks and tests
- existing bottom-sheet/input/keyboard primitives

Work:

- Build the Customer picker with blank-query recents, typed search, exact result layout, two-line metadata cap, loading/empty/error states, and replacement confirmation.
- Build the address suggestion list with threshold/debounce/cancellation, exact fallback copy, and attribution footer.
- Keep draft state independent from persistence so Job Edit and Live Session can use different commit boundaries.
- Add sensitive-data-safe instrumentation from DATA-11.
- Add TEST-14, TEST-15, TEST-19, TEST-20, and TEST-22.

Proof gate:

- Component tests cover race conditions, copy, truncation, accessibility labels, and free-text fallback.
- No provider or Customer value appears in snapshots/log output used by telemetry.

## Phase 5 — Job Edit integration

Primary areas:

- `apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx`
- `apps/mobile-expo/src/screens/jobDetailEdit/useJobEditDraft.ts`
- related Job Edit tests

Work:

- Extend the draft/payload with phone, email, and Customer link.
- Replace the plain Customer seam with the reusable picker while preserving free typing.
- Add Phone, Email, autocomplete-enabled Address, and `Add from Contacts` in UX-01 order.
- Save the full edit atomically on `Done`; keep `Cancel` unchanged.
- Reuse `EditKeyboardScrollProvider` for focus visibility.
- Add TEST-13 and Job Edit portions of TEST-15/17/18/19/25.

Proof gate:

- Existing Job Edit suites remain green.
- Scoped and full edit entry points show identical Customer behavior.
- Cancel and failed save never partially update Job or Customer.

## Phase 6 — Live Session integration

Primary areas:

- `apps/mobile-expo/src/components/ds/LiveSessionBottomSheet.tsx`
- `apps/mobile-expo/src/screens/JobDetailScreen.tsx`
- related Live Session tests

Work:

- Extend Live Session identity/draft/patch types with phone, email, and Customer identity.
- Render the same Customer block and pickers as Job Edit.
- Exclude Customer keystrokes from the existing 500 ms identity autosave path.
- Commit the complete Customer snapshot on picker selection, field blur, minimize flush, or end-session flush.
- Preserve dirty draft and retry UX on failure.
- Keep destructive action visibility aligned with existing focused-field safety behavior.
- Add TEST-16 and Live Session portions of TEST-15/17/18/19/25.

Proof gate:

- Fake-timer tests demonstrate no per-keystroke Customer writes.
- One atomic write occurs per approved boundary.
- Session minimize/end cannot silently drop a focused edit.

## Phase 7 — Device contacts

Primary areas:

- `apps/mobile-expo/package.json`
- `apps/mobile-expo/app.json`
- reusable Customer import module/components
- iOS/Android generated permission configuration

Work:

- Add the Expo SDK 57-compatible `expo-contacts` version after verifying current official compatibility.
- Prefer the native single-contact picker.
- Configure exact iOS purpose text if required.
- On Android, allow only necessary read access and block generated `android.permission.WRITE_CONTACTS`.
- Implement zero/one/multiple value resolution and labeled choosers.
- Pass selected values through the same draft/replacement/persistence contracts; retain no device-contact ID or alternatives.
- Add TEST-17 and TEST-18 automation.

Proof gate:

- Generated iOS and Android configuration is inspected, not inferred.
- No permission prompt occurs before an explicit tap.
- Physical-device TEST-23 and TEST-24 pass.

## Phase 8 — Job View and contact actions

Primary areas:

- `apps/mobile-expo/src/components/ds/JobDetailJobHeader.tsx`
- `apps/mobile-expo/src/screens/JobDetailScreen.tsx`
- related screen/header tests

Work:

- Add phone/email to the compact snapshot display with correct separators.
- Add the transparent Customer contact-action control left of Edit.
- Filter actions by parsed validity but always present the menu when visible.
- Open encoded `tel:`, `sms:`, and `mailto:` URLs from Job snapshot values only.
- Add fallback feedback and TEST-12/21 coverage.

Proof gate:

- Menu combinations and control placement pass automated tests and physical-device smoke tests.
- Mutating Customer defaults after Job creation does not change display/action targets for the older Job.

## Phase 9 — Privacy, product context, and release readiness

Primary areas:

- `docs/legal/privacy-policy.md`
- `docs/legal/mobile-privacy-backlog.md`
- `docs/product/current-product.html`
- store privacy declarations and environment/runbook documentation

Work:

- Describe phone/email storage, selected device-contact handling, and Geoapify query processing accurately.
- Determine whether the policy-version/consent mechanism needs a version bump before release.
- Update Apple and Google privacy/permission declarations.
- Document Geoapify secret rotation, quota monitoring, attribution, and failure-open behavior.
- Update current-product documentation and its maintained exports according to repository workflow.
- Recheck live Geoapify pricing/terms and Expo contact APIs at implementation and again at release.
- Complete TEST-26 through TEST-28.

Proof gate:

- Legal/product docs match shipped behavior.
- Production client config contains no provider or privileged backend secret.
- Attribution, free-text fallback, quota behavior, and store declarations are verified.

## Test execution map

| Test rules | Implementation step/gate | Planned evidence |
| --- | --- | --- |
| TEST-01–TEST-09 | Phases 1 and 3 | Supabase SQL/function tests, migration logs, redaction inspection |
| TEST-10–TEST-12 | Phase 2 and Phase 8 | Shared/API unit tests and deep-link fixtures |
| TEST-13–TEST-15 | Phases 4 and 5 | Job Edit/component tests and visual/accessibility assertions |
| TEST-16 | Phase 6 | Live Session fake-timer and failure/retry tests |
| TEST-17–TEST-18 | Phase 7 | Native-module mocked component/integration tests |
| TEST-19–TEST-20 | Phases 3 and 4 | Address race/threshold/attribution component tests |
| TEST-21–TEST-22 | Phases 4 and 8 | Job View/action tests and telemetry/log audit |
| TEST-23–TEST-25 | Before mobile submission | Dated physical-device evidence with build/OS identifiers |
| TEST-26–TEST-28 | Before public release | Live provider smoke, failure simulation, legal/store/security checklist |

## Rollout and rollback

Rollout order:

1. Database migration and RPCs.
2. Address Edge Function and production secret.
3. Mobile binary with native contacts configuration.
4. Legal/store declarations effective no later than public availability.

Rollback:

- If address service fails or quota is exhausted, disable suggestions server-side; manual address entry remains intact.
- If device-contact import is defective, hide/disable only `Add from Contacts`; manual fields and saved Customer picker remain intact.
- If Customer suggestions are defective, fall back to plain customer fields while preserving additive database columns.
- Do not roll back the additive migration after new clients have written phone/email/Customer links; forward-fix server/mobile behavior instead.

## Dependencies and release prerequisites

- Geoapify account and server-side key.
- Current free-plan/attribution review.
- Expo Contacts SDK compatibility and generated native permission verification.
- Privacy-policy/store disclosure updates.
- Physical iOS and Android devices for permission/deep-link evidence.

These are release prerequisites, not blockers to beginning implementation with mocked adapters.

## Product-context closeout

- Update `docs/product/current-product.html` to describe Job-embedded Customer reuse, device-contact import, and address fallback without implying a CRM.
- Run `npm run product:export` and `npm run design:check` after the maintained product-context update.
- Update `docs/legal/privacy-policy.md` and `docs/legal/mobile-privacy-backlog.md`; assess consent/versioning and store declarations before release.
- Add operational documentation for Geoapify secret rotation, request-count monitoring, quota failure, and provider replacement.
- Keep analytics/support language aligned with DATA-11 and exact UX recovery copy.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Wrong people auto-linked | Conservative DATA-06 rules; explicit identity wins; duplicates preferred |
| Job and Customer drift | One full-snapshot transaction for every customer commit |
| Old Job changes unexpectedly | Job-owned snapshots; no cascade from Customer defaults |
| Permission harms onboarding | Request only on explicit action; manual path always present |
| Address cost/quota | 300 ms debounce, threshold, max five, server abuse controls, hard free-plan budget, manual fallback |
| Provider lock-in | Neutral server/mobile types; persist no provider identifiers/raw response |
| Sensitive data leakage | Redacted logs, forbidden telemetry fields, explicit TEST-22 inspection |
| Soft-delete edge cases | Transactional recomputation and restore/delete SQL tests |
| Live Session data loss | Dirty local draft, approved flush boundaries, retryable error state |

## Documentation index

- Product requirements: `spec.md`
- Durable/transient behavior: `state-model.md`
- Schema, ownership, API, and provider boundary: `data-contract.md`
- Exact interaction and copy: `ux-contract.md`
- Automated/manual proof: `test-contract.md`
- Sequencing and file impact: this file

## Readiness

**Verdict:** Ready for Implementation

### Contract coverage

- Product requirements with planned verification: 15/15
- State rules with planned verification: 16/16
- Data rules with planned verification: 13/13
- UX rules with planned verification: 16/16
- Test scenarios with required evidence defined: 28/28
- Unresolved PM decisions: 0
- Unresolved technical blockers: 0

### Cross-artifact review

- Contradictions: None
- Unplanned requirements or contract rules: None
- Plan tasks without requirements or contract rules: None
- Missing or unjustified contract artifacts: None
- State/data/UX/test mismatches: None

### Shaping throughput

- PM questions asked: Unknown; the earlier shaping conversation is available only as a bounded preview and exact counting would be fabricated.
- PM-agent decision rounds: Unknown for the same reason.
- Fast PM answers used instead of agent research: Unknown for the same reason.
- Material decisions resolved independently: Unknown for the same reason.
- Consequential decisions reopened after approval: 0 during contract finalization.
- Total elapsed shaping time: Unknown
- Active PM time: Unknown
- Active agent investigation time: Unknown

### Artifacts

- `docs/specs/job-customers/spec.md`
- `docs/specs/job-customers/state-model.md`
- `docs/specs/job-customers/data-contract.md`
- `docs/specs/job-customers/ux-contract.md`
- `docs/specs/job-customers/test-contract.md`
- `docs/specs/job-customers/plan.md`
