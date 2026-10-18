# FieldSoli invoicing delta QA — 2026-10-18-ios-invoicing-delta

Tested: 2026-10-18, approximately 13:12–13:16 CDT (America/Chicago)
Simulator: iPhone 17 Pro, iOS 26.2
App: FieldSoli 1.2.0, Expo SDK 57.0.0
Runtime source: Simulator Source Code Explorer reported `/Users/johnveltri/.codex/worktrees/fbb9/fieldsoli`. That checkout was at `b3a3334` on `codex/job-contact-action-sheet`, a descendant of `cursor/invoicing` at `67156d8`. The finalization implementation was the same; the descendant also included follow-up invoice-gap card changes. This is runtime evidence from that loaded development bundle, not a claim that the simulator ran the exact branch tip.
Account: Previously verified rebuildable demo account. Credentials omitted.
Feature gate: Invoice UI and finalization were available. Code gate key is `invoicing`; the effective value source (local override vs PostHog) was not exposed by the runtime UI. No override was changed.
Scope: Focused follow-up for invoicing behavior unavailable to the earlier checkout. Reused QA job B from the prior run. Existing capture, Inbox, live-session, broad edit sweep, and already-observed invoice preview details were not repeated. This is not full release signoff.
Evidence: Simulator accessibility state and screenshots captured in the task transcript; CUA did not export local screenshots.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Invoice-backed completion entry | PASS | Existing In Progress job B, with $150 Labor & Services, one visit, $24 and $8 material rows, and $6 other cost. MARK COMPLETED opened the invoice preview. |
| Missing job-detail recovery | PASS | Preview showed a “Job Details” card naming “Customer name” as missing. Tapping opened Job Edit. Saving customer “Casey Test” returned to Job Detail; a second MARK COMPLETED tap reopened review. |
| Cancel completion review | PASS | Closing the review left B IN PROGRESS and no invoice appeared in Documents. |
| Complete with invoice creation | PASS | “COMPLETE & CREATE INVOICE” created Invoice #00002 for $182.00 and moved B to COMPLETED without opening a share composer. The preview total reconciled as $150 labor + $24 + $8 materials, $0 tax. |
| Existing selected-invoice Paid review | PASS | MARK PAID opened Invoice #00002 with “CONFIRM $182.00 PAID.” Closing preserved COMPLETED and left Invoice #00002 UNPAID at $182.00. |
| Confirm Paid and fresh read | PASS | Confirming recorded Paid. Jobs showed B in PAID with Revenue $182, Cost -$32, Net $144. Reopening B and its invoice showed PAID and Total $182.00. No money was processed or external communication sent. |

## Observed follow-up

After Job Details was opened from the finalization gap card and the customer name was saved, the app returned to Job Detail rather than resuming the review. The user had to tap MARK COMPLETED again. This preserved the job and was recoverable; record as a re-entry friction point for product review, not a confirmed defect.

## Limits and final state

No flag-off check or broader invoice settings, estimate, share/PDF, replacement-invoice, tax, or failure-retry scenarios were run in this focused pass. No fixture was deleted. Job B is now PAID with Invoice #00002; Job A remains as recorded in the earlier report. No timer was started by this pass; the pre-existing “Live Visit” was left untouched.
