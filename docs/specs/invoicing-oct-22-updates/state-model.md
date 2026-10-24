# State and recovery contract

No new persisted financial lifecycle states.

| ID | Process | Transitions, guards and recovery |
| --- | --- | --- |
| STATE-01 | Address lookup | Idle → debounced eligible query → searching → results/no matches or hidden-panel failure. A newer query, field exit or unmount supersedes earlier responses. Selection updates draft only; manual save remains valid. Exceptions/timeouts settle searching. Rate limit stops repeated requests for the current editing session; reopening allows a fresh attempt within server quota. |
| STATE-02 | Preview entry | FAB and Job Edit → unsaved loading → ready/incomplete/retry. Job Edit saves through existing mechanism first. Keep default Estimate for planned/in-progress and Invoice for completed/paid; type switching remains explicit. Opening never creates or changes Paid. Existing Documents rows open saved identity directly. |
| STATE-03 | Interruption | Background retains preview identity and selected type. Foreground refreshes saved document controls/payment, or unsaved current-source preview, and restores renderer if needed. Preserve same saved snapshot. Failed refresh shows retry/offline state. Current request owns completion; late responses cannot replace newer preview or resurrect a dismissed one. Retry requires no close/reopen. |
| STATE-04 | Creation and handoff | Existing retained request-key/fingerprint/idempotency and Paid confirmation rules continue. Native composer opens only from explicit user action after fresh link eligibility. Cancel/foreground return restores preview; no automatic send, new snapshot, status change or repeated composer. Missing/invalid recipient stays empty. |

Invariants: disabled public link never prevents authorized owner preview; offline cached state never becomes fresh proof for sharing; unsaved refresh never creates a document; existing snapshot prices/contacts never adopt current Job edits.

## Prepared live preview

The launcher owns an ephemeral preparation scoped to client, owner, Job, default
document type, current Job source identity and document-list revision. Preparation
is read-only and never creates a document or reserves a number. Concurrent FAB
reads share the same pending request. Successful results expire 30 seconds after
completion; failures are not cached. Inactive/edit mode, scope changes, unmount,
foreground return and Business Details return invalidate preparation. Late reads
from superseded generations cannot become the current preview. Creation continues
to validate the source fingerprint on the server; saved-document controls and
payment projections still use fresh reads before sharing.

Font preparation starts on active Job View. HTML/source are memoized. Each modal
opening and renderer restart waits for a font-ready, double-animation-frame signal
before revealing document content; height messages alone do not dismiss the loader.
A missing ready signal after 15 seconds transitions to the existing Retry state.
