# Implementation evidence

Status: implementation and local automated evidence; runtime release checks remain pending.
Updated: 2026-10-24. No deployments or production mutations performed.

## Address lookup and settings (REQ-01, REQ-02, REQ-10)

Read-only Supabase connector inspection on 2026-10-24 confirmed project
`gfvqmxsiuhhujnckghpa`, named `FieldSoli`, reports `ACTIVE_HEALTHY`.
`get_edge_function` for `address-autocomplete` returned `Function not found`.
`list_edge_functions` independently returned exactly five functions:
`delete-account`, `request-job-export`, `process-job-exports`,
`redeem-job-export`, and `cleanup-job-exports`; no `address-autocomplete`.
This identifies a production deployment gap, rather than a proven Geoapify search defect.
A read-only SQL lookup using `to_regprocedure` confirmed both
`public.consume_address_autocomplete_budget(uuid)` and
`private.consume_address_autocomplete_budget(uuid,integer,integer)` exist.
No budget-consuming RPC or user-data query was run. Secret presence and real-provider
success remain unverified because the endpoint is absent.

Client changes bound the complete request (including error-body parsing) to eight
seconds, abort timed-out native requests, settle thrown failures into manual-entry
fallback, and discard stale/unmounted lookup responses. Business Details reuses the
same hook, suggestions, attribution, US request and result limit as Job entry.
Address selection updates the draft; only Save Changes persists it. Focused zero
markup/tax is visually empty without making the underlying saved zero dirty;
nonzero and fractional entries remain editable, and an empty blur/save becomes zero.

Automated checks passed from this worktree:

- BusinessSettingsScreen and useAddressAutocomplete Jest suites: 23 tests.
- Address API client and existing Edge provider adapter Vitest suites: 11 tests.
- API client TypeScript check: passed.

Before claiming REQ-01 works in production: separately authorize deployment of the
existing `address-autocomplete` function, verify server-only Geoapify secret presence,
then run an authenticated lookup using a synthetic address through the actual
provider and confirm selection/manual fallback on the reported physical iPhone.
No new migration is indicated by the inspected budget RPC presence. Native keyboard,
large text, and physical-provider checks remain pending.

## Preview, sharing and material changes

The Job FAB and saved-document rows now use a modal presenter outside the scrolling/crossfade content. The inline Documents section delegates saved opens; a shared revision refreshes view/edit lists after successful creates and recovered/finalized operations. This avoids depending on an off-screen section to present the FAB modal. A physical-device reproduction is still required before attributing the original TestFlight symptom solely to native scroll/modal mounting.

Preview reads have a 15-second completion bound; mutations keep durable request-key recovery. Saved preview identity and unsaved selected type survive foreground refresh. WKWebView content is remounted after foreground/process termination. Failures show inline Retry, stale reads cannot overwrite newer requests or reopen dismissed previews, and loading/foreground-review reads can be dismissed. Failed finalization refresh keeps confirmation blocked until fresh recovery. Font loading has a bounded fallback as well.

SMS sharing uses only a validated, normalized phone from the fresh saved snapshot, or no recipient. Names such as “Buddy name” cannot become an app-supplied recipient. iOS may still resolve a valid number to a local/suggested display name; physical inspection must distinguish that from the phone passed by the app. Messages and other link bodies use the immutable full amount; email subject and actual document keep the number. No SMS/email was sent.

Material charge is secondary below cost using the existing override/current-default canonical calculation and rounding. Unknown rate/cost is omitted. Settings reads are cancelled on stale scope and do not fabricate a default. Figma/component and device evidence are distinguished in material-design-verification.md.

Hosted pages use the shared presentation-only phone formatter. Unknown/revoked links and their metadata/image return neutral copy; outages remain separate with Retry. Rich cards show business, type, total and immutable Job short title with small FieldSoli footer. Real Next ImageResponse output was rendered and visually inspected using synthetic data:

- [Normal card](evidence/share-card-normal.png)
- [Long business/title card](evidence/share-card-long.png)

These PNGs prove the generated image layout, not native iMessage crawler behavior or deployed website contents.

## Independent final review

A separate read-only subagent reviewed the combined changes and found three integration issues: persistent finalization renderer error, stale Documents list after FAB creation, and stale confirmation after a failed finalization refresh. All were corrected and covered by regression tests. A subsequent read-only pass confirmed the first two fixes and the idempotent open/dismissal guards; the final stale-confirmation/dismissal scenarios also pass their dedicated tests.

## Automated validation

Validation uses temporary Node 22.23.4, matching the repository's Node 22 requirement. Locked dependencies installed without modifying package-lock.json; no package upgrades.

- Root npm test: 18 API files / 143 tests; renderer 2 files / 27 tests; marketing 11 files / 51 tests; Edge shared helpers 5 files / 14 tests; design contrast 1 file / 4 tests — 239 tests passed.
- Mobile final complete run: 72 suites / 490 tests passed. Combined with the root suites: 729 automated tests passed.
- Preview controller focused suite: 36 tests passed, including Paid/In Progress FAB entry, selected-type resume, timeout, stale completion, dismissal, finalization Retry, stale-confirmation suppression, shared-list refresh and native SMS adapter arguments.
- Full workspace TypeScript: passed again after all final safeguards.
- Product exports regenerated; design:check passed. This is static repository validation; the live Figma page mismatch remains unresolved.
- git diff --check: passed.

## Remaining gates

1. Separately authorize production deployment of existing backend/supabase/functions/address-autocomplete/index.ts to project gfvqmxsiuhhujnckghpa, verify Geoapify secret presence without exposing it, and prove an authenticated provider lookup. No new schema or provider purchase is needed based on the inspected RPC signatures.
2. User-selected simulator/install permission is pending via the in-chat question. Available recommended target: iPhone 17 Pro Max, iOS 26.2, 9089633C-F02B-4302-8CA7-35DE128AC098. No simulator app was overwritten or installed by this work.
3. On the reported physical iPhone/TestFlight build: actual address results, FAB paths, interrupted previews, native To field, fresh iMessage preview, keyboard, large text and VoiceOver. Exact original TestFlight build/iOS was not available in the report.
4. Restore/identify the maintained Figma page before updating it. Existing pages 01–05 were preserved.
5. Website deployment, mobile build/submission, Apple processing and public release remain separate authorized gates. This branch is implementation and automated evidence, not a production fix or a release receipt.
