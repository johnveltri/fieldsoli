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

## Hosted Dev address recovery — 2026-10-24

After the simulator switched to hosted Dev, both pickers showed a brief search
then manual-entry fallback. Read-only inspection found no deployed Edge Functions
and no configured provider secret on `anypejjoovlatmrkrxvx`; budget RPCs and
service-role-only execution permissions were already present.

The user explicitly approved transferring the existing provider key to server-only
Dev secrets, deploying `address-autocomplete`, and verifying both simulator
pickers. Initial upstream requests timed out. Safe reason-code diagnostics were
added without logging addresses, tokens, URLs or provider response bodies.
The user then corrected the provider account and replaced the local key; that
replacement was synchronized to the same approved Dev secret.

Provider lookup is bounded at 12 seconds and the client at 18 seconds so the
server's authentication/budget hop and provider lookup can complete. Timeouts
remain tested and fall back to manual entry. JWT verification remains enabled.

Observed on the selected iPhone 17 Pro / iOS 26.2, running this worktree on Metro
8082 against Dev: Business Details and Job Edit each returned four real US
suggestions for the synthetic query `1600 Pennsylvania Avenue`, with Geoapify /
OpenStreetMap attribution. Temporary test drafts were discarded; no business or
Job address was saved. This proves the Dev provider boundary; physical iPhone,
SMS/iMessage and production gates remain separate.

Focused API + Edge address tests: 12 passed. Complete Edge shared tests: 15 passed.
Full workspace TypeScript: passed. Secrets stayed outside repository/mobile env;
production was unchanged. Operational steps are maintained in
`docs/ops/geoapify-address-autocomplete-runbook.md`.

## Production address deployment — 2026-10-24

The user explicitly requested the replacement production Geoapify key and then
approved deploying the Dev-verified function. The production secret fingerprint
was checked against the replacement key without revealing the value.

Target `gfvqmxsiuhhujnckghpa` / FieldSoli was verified ACTIVE_HEALTHY. Deployed only
`address-autocomplete` from source commit `e7ef41f`, using API bundling and the
repository configuration with JWT verification enabled. The function is ACTIVE,
version 1, with bundle SHA-256
`93329db00d759f033dc0b66f806bd954d5dde7f606bdb0536611872c44457993`, identical to
Dev's verified version 6. Existing budget RPC and service-role execution grant
were verified; anonymous roles cannot execute the budget function.

Unauthenticated POST to the live production endpoint returned HTTP 401 with
`UNAUTHORIZED_NO_AUTH_HEADER`, confirming the authentication boundary. Focused
address API/Edge regression suites passed 12 tests immediately before deployment.
No database migration, user-data write or mobile/store release was performed.
An authenticated production provider lookup through the user's TestFlight app
remains the final runtime check; this receipt does not claim that it was run.

## Prepared Job preview and first-paint recovery — 2026-10-24

User approved preparing the current live preview and fonts during Job View.
The root launcher warms a read-only preview, shares in-flight reads, and reuses
successful results for at most 30 seconds. Owner/Job/type/source/document revision,
edit/inactive transitions, foreground and Business Details return invalidate the
preparation. No document creation, number reservation, persistent cache or location
collection was added. Fresh saved sharing reads and creation fingerprint validation
are preserved.

Memoized HTML avoids rebuilding embedded fonts on sizing/loading updates. The
WebView remains hidden behind an explicit loading state until a font-ready,
double-animation-frame signal. A per-render token rejects previous-document ready
messages; source changes and renderer recovery remount the WebView. A missing
ready signal after 15 seconds offers the existing Retry action.

Final validation: 508 mobile tests across 73 suites, including 54 focused preview /
preparation tests, passed. Full workspace TypeScript and product HTML validation
passed; product exports regenerated. Independent review found a stale first-paint
message race; the fix and regression test were reviewed with no remaining findings.

Observed on selected iPhone 17 Pro / iOS 26.2, Expo Go served from this worktree on
Metro 8082 against hosted Dev: FAB Estimate rendered; switching to Invoice rendered;
backgrounding to the iOS Home screen and reopening Expo Go showed loading then
restored the selected Invoice; existing saved Estimate #00001 rendered. Left on
Job View. No documents were created or shared and no Job/business data was edited.
This is a focused simulator smoke check, not a latency benchmark or physical
TestFlight verification. Existing maintained-Figma-page mismatch remains unchanged.

## Single loading presentation and prepared saved content — 2026-10-24

Follow-up removes the separate read-busy label and gives data/paint loading the
same presentation. Non-archived saved document HTML is prepared from the loaded
list and fonts. Opening displays that content while revalidating owner state;
identical HTML preserves the WebView source instead of triggering another render.
Saved Share remains disabled during the initial owner refresh, preventing a second
read and an out-of-order share sheet. Failed revalidation still removes content and sharing access. Foreground/Retry
force a fresh owner read; sharing and PDF keep their existing fresh-read gates.

Focused preview component tests passed 42 cases, including a deliberately pending
saved owner read, unchanged-source revalidation, and exactly one loading message
through data and paint. Simulator QA for this follow-up was explicitly deferred
to the user. Native WebView first rendering still occurs on opening; this update
does not claim a fully pre-rendered preview or zero initial render latency.

## Native sharing retains the rendered preview — 2026-10-24

Removed the handoff sequence that closed the preview before native presentation
and reopened it afterward. Only the options sheet dismisses; native sharing,
composers, browser and PDF handoff retain the preview presenter underneath.
App-state callbacks during a queued/running handoff do not refresh/remount it.
Subsequent saved-preview foreground reads retain content during verification and
preserve the source/paint state when HTML is unchanged. Actual renderer-loss
callbacks still recover the WebView. Fresh owner/link checks remain in place.

Independent review found dismissal during a pending owner read could still launch
native UI and reopen the preview. Handoffs now check the preview request generation
and visibility before presenting, and no completion/fallback forcibly reopens the
preview. Failed current owner reads transition to Retry instead of a blank spinner.
Review of those fixes found no remaining issues.

Final automated validation: 513 mobile tests across 73 suites passed, including 45
preview component tests. Added pending native Share/cancellation coverage verifies
that preview visibility, source and paint token survive native active callbacks
both before and after completion; delayed-owner-read dismissal cancels native
presentation; failed owner reads expose Retry. SMS recipient tests continue to
pass through the options-sheet-only dismissal path. Full workspace TypeScript and
product HTML validation passed; product exports regenerated. No simulator QA was
performed for this follow-up, per user instruction; native presentation remains
for the user's runtime verification.

## SMS “Buddy Name” recipient diagnosis — 2026-10-24

The original handoff called `SMS.sendSMSAsync(customerPhone ?? '', body)`.
Installed Expo SMS converts a scalar string to a one-element array, so an absent
phone became `['']`; its iOS module assigns that array directly to
`MFMessageComposeViewController.recipients`. An empty recipient element is distinct
from an empty recipient list. This exact empty-string array input and “Buddy Name”
symptom are reported in the firsthand reproduction at
https://stackoverflow.com/questions/29150994/mfmessagecomposeviewcontroller-remove-buddy-name.
No app code or pre-fix repository history contains a fabricated Buddy contact.
The existing branch fix passes `[]` for absent/empty/invalid phones, or one
normalized valid phone. Added the explicit empty-string case to the native-adapter
regression test; physical-device confirmation remains assigned to the user.
