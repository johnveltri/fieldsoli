# Test contract

All tests below are required evidence, not completed results. Use synthetic contacts/addresses and owner-scoped fixtures; never send a real message as part of verification. Use the screenshot reset fixture where suitable and remove temporary test artifacts.

| ID | Source rules | Scenario, expected result and layer |
| --- | --- | --- |
| TEST-01 | REQ-01/02, STATE-01, DATA-01, UX-01 | Hook/API/edge tests: debounce/threshold, latest request, thrown/network/timeout/auth/quota failures settle, result selection/no matches, manual save, cancellation and budget sharing. Existing endpoint real-provider smoke verifies deployed auth, RPC and secret presence without revealing values. |
| TEST-02 | REQ-03, STATE-02/04, DATA-03, UX-02 | Component/integration matrix: FAB and Edit, planned/in-progress/completed/paid, no/existing documents, type defaults/switch, existing read, required-data gaps. Opening has no persisted effects; creation retains request key and existing paid-total confirmation. |
| TEST-03 | REQ-04, STATE-03/04, DATA-03, UX-02 | Component tests plus physical device: saved/unsaved estimate and invoice, app switch while loading/ready, WebView recovery, offline/reconnect/retry, expired auth, slow older responses, dismissal and native composer return. Same identity/type returns; no repeated handoff or creation. Fresh controls gate share/PDF. |
| TEST-04 | REQ-05, DATA-02, UX-03 | Pricing/row tests: default/override/zero markup, zero/incomplete cost, fractional-cent rounding and quantity. Compare displayed charge with canonical pricing. Device visual/VoiceOver/large-text evidence proves cost/charge hierarchy and no overflow. |
| TEST-05 | REQ-06, DATA-04, UX-04 | Renderer unit tests: raw ten-digit, +1, already formatted, null, malformed, international, extension and HTML-sensitive values. Stored payload unchanged. Native/hosted/explicit-PDF visual smoke confirms shared formatting. |
| TEST-06 | REQ-07, STATE-04, DATA-03/04, UX-05 | Adapter tests with valid/missing/invalid/name-like phone and changed current Job contacts. Physical iPhone To-field inspection verifies supplied recipient and native label resolution; cancel, do not send. |
| TEST-07 | REQ-08, DATA-05, UX-06 | Marketing/resolver tests: unknown/disabled/archived/deleted produce identical copy and neutral metadata/image; outage has separate retry. Authorized owner can still view disabled snapshot. |
| TEST-08 | REQ-09, DATA-05, UX-07 | Helper/marketing tests verify amount-first body, retained email subject, total/title/card hierarchy, long strings and omitted private fields. Browser verifies server metadata and image; physical Messages with fresh URL checks actual rich preview. Existing cached preview is not a reliable new-render test. |
| TEST-09 | REQ-10, DATA-06, UX-08 | Settings component/device tests: zero-focus/type/empty-blur, nonzero/decimal edits, clear, validation, dirty state, Done/cancel and accessible labels. No accidental leading-zero entry requirement. |

## Gates

Before merge: focused tests above, typecheck, relevant existing regression suites; real provider success before claiming address fix; matched visual/accessibility evidence for changed row/fields. Run DB/edge checks when those layers change. No mock substitutes for the failing device/provider boundary.

Before release: record exact source, app version/build/iOS, website and function deployment revision; physical iPhone 17 Pro Max covers TEST-01/02/03/06/08/09; small screen and large type cover layout risk. Keep build, submission, Apple processing and release verification separate. Prior snapshot/control tests remain required if affected. No financial migration expected; if one becomes necessary, extend the approved data/plan/test contracts before applying it.

Highest risks: hidden deployment/provider defect (01), async blank preview or stale sharing (02/03), wrong recipient/privacy exposure (06/07/08), financial display drift (04/05). No functional requirement intentionally untested; native/device checks are manual because simulator SMS and mocks cannot prove those boundaries.

## Preview preparation regression coverage

- Prepared FAB opening performs no second preview request and no document mutation.
- Hook coverage includes shared in-flight reads, expiry, failed speculative reads,
  timeout, invalidation, owner/Job/type/source changes, disabled mode and unmount.
- Loader persists through sizing messages until first paint, resets after renderer
  termination, and offers Retry if rendering never signals readiness.
- Simulator smoke: current unsaved Estimate and Invoice render, close/reopen works,
  and existing saved Estimate remains accessible. This does not replace physical
  TestFlight resume/first-paint checks or establish a measured latency target.

Follow-up assertions: an already-loaded saved snapshot renders while its owner
revalidation remains pending; identical HTML keeps the same WebView source and
ready state; read and paint phases expose exactly one loading message. Failed
owner revalidation and fresh-read sharing/PDF regression checks remain covered.
Follow-up simulator execution is assigned to the user.

Native handoff regression assertions: the preview Modal stays visible behind a
pending native Share promise; source and paint token remain unchanged after
cancellation and active callbacks both before and after completion. Dismissal
during a delayed final owner read cancels presentation without reopening; a failed
owner read offers Retry and blocks Share. SMS adapter assertions still cover
validated snapshot recipients through the revised options-modal dismissal path.
