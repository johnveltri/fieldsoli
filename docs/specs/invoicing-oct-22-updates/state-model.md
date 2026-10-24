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

### Unified loading and saved-document opening

Data preparation and first paint use one loading presentation. Routine owner
revalidation does not display a second loading label over prepared content.
Non-archived saved documents from the current Job-status list prepare HTML with
fonts before opening. Owner revalidation runs without delaying that saved content;
an unchanged HTML result preserves the painted WebView. A failed revalidation
still removes the preview and offers Retry. Foreground and Retry force a fresh
read rather than using the optimistic saved content. Sharing/PDF remain gated by
fresh owner reads. Native WebView first rendering is still performed on opening;
this is data/font/HTML preparation, not a fully rendered off-screen WebView.

### Native handoff preserves the preview

Choosing Text, Email, Share, browser or PDF dismisses only the document options
sheet. After that sheet has dismissed, native UI presents over the still-mounted
preview. Completing/cancelling native UI does not close/reopen the preview or
restart its painted WebView. Active callbacks during queued/running handoff do
not start competing refreshes; later saved-preview foreground reads preserve
content while revalidating. Actual renderer-loss callbacks still remount/recover.
Fresh owner/link checks remain mandatory before native handoff. Closing the
preview during a pending check cancels that handoff; late success/failure cannot
launch native UI or reopen the dismissed preview. A failed current owner check
shows Retry and blocks sharing rather than leaving a blank loading surface.
