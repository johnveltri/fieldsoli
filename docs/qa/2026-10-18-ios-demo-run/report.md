# FieldSoli simulator QA — 2026-10-18-ios-demo-run

> Review update: invoice-backed completion is required by the newer contract, so that portion of FIND-01 is superseded. See the [invoicing follow-up](../2026-10-18-ios-invoicing-delta/report.md) and [code fixes](code-follow-up.md) for the remaining issues and validation.

Tested: 2026-10-18, approximately 12:46–12:58 CDT (America/Chicago). Simulator: iPhone 17 Pro, iOS 26.2. UDID was not exposed by the UI driver.

App/build: The running FieldSoli development app reported version 1.2.0 and Expo SDK 57.0.0 in its developer menu. Exact build identity and correspondence to the checked-out source were not verified. The installed app exposed Estimates & Invoices; the checkout did not expose the same invoice UI, so this is runtime evidence for the installed simulator app only.

Environment: Authorized rebuildable demo account verified in Account → Personal Details. The account was populated; no genuinely empty account was available. The sign-in identifier and password are omitted. Existing demo history was left in place. The pre-existing “Live Visit” job was not edited or ended.

Flags: No overrides were changed. Invoice UI was reachable, but the effective flag key, value and override source were not inspected. This was not a flag-off compatibility run.

Scope: Focused first-use core loop (minimal capture → completion → invoice → Paid), one live-session workflow, and Quick Note/Quick Material capture and assignment to a QA job. Broad feature/field sweep, destructive recovery, release-regression suite, and other platforms/builds were not run. This report is not release signoff.

Evidence: UI state and screenshots were captured through the simulator driver in this task transcript. The driver did not expose a local screenshot export, so no image files are linked here.

## Core-loop verdict

Capture: PASS → Work: PASS → Complete: PARTIAL → Invoice: PASS → Paid: PASS.

The title-only job could be created, priced at $120, given one dated one-hour visit, and explicitly marked as having no materials or other costs. Invoice #00001 was created for $120, the job was recorded Paid, and after app reload the invoice showed PAID while retaining its $120 total. However, the primary completion route led into invoice review and could not complete the job until a business name and customer name were supplied; the initial attempt also returned “Invoice review is unavailable. Try again.” See FIND-01. Completion was therefore not independently verified before billing setup.

## Release regression verdict

Not run. No older baseline build, second authorized account, or additional user-selected platform was available. Existing-user upgrade, account isolation, conflicting edits, feature interaction matrix, and flag-off compatibility remain unverified. Do not treat this simulator run as release verification.

## Feature interaction matrix

| Feature | Fixture/state | Assertion exercised | Outcome |
| --- | --- | --- | --- |
| Minimal job capture | A: QA 20261018 Adjust sticking door | Created with title only; business/customer/pricing/work initially blank | PASS for title-only save; empty-title/cancel path not run |
| Completion review | A | Added $120 labor, one dated 1-hour visit, no-materials and no-other-cost confirmations | PARTIAL; completion routed into invoice review and required business/customer details |
| Invoice preview and creation | A | Incomplete preview identified business/customer gaps; after supplying only those names, created one invoice | PASS for minimum data tested; no share or PDF action |
| Paid state | A | Confirmed $120 Paid; checked job detail, Paid list, Home/Earnings, then invoice after reload | PASS; invoice #00001 showed PAID and Total $120 |
| Live visit | B: QA 20261018 Repair leaking tap | Started from global Live Visit action, edited title, added $24 material and visit note, navigated screens, reloaded while active, then ended | PARTIAL; timer and edits persisted, cancel-ending and invalid interval checks not run |
| Other cost | B | Added $6 Other cost and attached it to the ended visit; Invoice customer remained unchecked | PASS for add/attach and displayed total reconciliation |
| Quick Inbox note | Unassigned note | Saved, inspected in Inbox, assigned to B, reopened B | PASS for save and one-time assignment; cancel-picker/delete checks not run |
| Quick Inbox material | Unassigned $8 total-only material | Missing total disabled Save; corrected and saved $8, assigned to B | PARTIAL; negative-value normalization concern in FIND-02 |

## Findings

| ID | Severity | Scenario | Problem and user consequence | Evidence |
| --- | --- | --- | --- | --- |
| FIND-01 | P1 | CORE-03 / completion | The primary Mark Completed path coupled work completion to invoice creation. With business/customer blank, the checklist's final Done returned “Invoice review is unavailable. Try again” and the job remained IN PROGRESS. A retry exposed Business name and Customer name as missing; after those were saved, the action became “COMPLETE & CREATE INVOICE” and completed the job while creating Invoice #00001. This adds billing setup and creates a document to close work. The approved invoicing spec says names and complete charges are required only for document creation, and its UX contract says document-creation gaps should not run the work-completion wizard. A separate Change Job Status route was not evaluated. The installed app differs from the checkout, so recheck this on the intended release build. | A, title-only start → checklist → error → invoice preview with missing names → successful combined action. Transcript screenshots and observed states. Contract: docs/specs/invoicing/spec.md (REQ-14/product notes) and docs/specs/invoicing/ux-contract.md, line 31. |
| FIND-02 | P2 | Quick Material validation | Entering -5 in Total cost silently displayed 5 and enabled Save. The invalid value was not saved; it was corrected to $8 for the Inbox test. Silent sign removal can turn an attempted negative adjustment into a positive cost without telling the user. | Quick Material form: Material “Replacement washer”; Total cost “-5” became “5”; Save became enabled. Transcript state; corrected before saving. |

### Recheck, not yet classified as a product defect

After saving “QA Handy Services” from the invoice preview, the job detail appeared but its app accessibility tree collapsed to the floating developer control and taps on Edit, the customer row, and Close had no effect. A developer-menu Reload restored the dashboard and normal interaction; the job/business data persisted. This may be an app overlay issue or simulator-driver issue and should be reproduced on the target build before classification.

## Scenario coverage

| ID/assertion | Effective flag configuration | Outcome | Observed result / unverified scope |
| --- | --- | --- | --- |
| Account identity | Invoice UI visible; exact gate unknown | PASS | Demo account identity verified in Personal Details. |
| CORE-00 first launch/empty account | No override | PARTIAL | Account was populated; empty-account and first-launch assertions not reproducible. |
| CORE-01 minimal job | No override | PARTIAL | Title-only QA job saved; whitespace title, cancel/no-orphan, and first-ever account action not tested. |
| CORE-02 invoice before details | Invoice UI visible; exact gate unknown | PASS | Missing business/customer fields were shown; no document number was created in the rejected preview and no share handoff occurred. |
| CORE-03 complete with gaps | No override | PARTIAL | Labor/session/material/cost checklist saved; initial completion returned an invoice-review error and billing names were required on the primary route. |
| CORE-04 gradual edit/recovery | No override | NOT RUN | Broad text, clearing, discard, customer reuse/snapshot and scratch-job validation checks remain. |
| CORE-05 minimum invoice | Invoice UI visible; exact gate unknown | PASS | Business name and customer name only were added; Invoice #00001 saved for $120. Share was canceled/not opened. |
| CORE-06 Paid and fresh read | No override | PASS | Job Paid in detail/list; Home/Earnings reflected the $120 QA job; after reload invoice showed PAID with Total $120. |
| CORE-07 live work/interruption | No override | PARTIAL | B timer displayed and advanced across screen navigation and app reload; title, $24 material and note persisted; ending saved a 12:52–12:54 visit (<0.1h). End Visit returned immediately with no confirmation/cancel step. Invalid interval and second-timer guard not tested. |
| CORE-08 Inbox capture/assignment | No override | PARTIAL | One note and one total-only material were captured unassigned, then each was assigned once to B; Inbox showed no unassigned item. Cancel, delete and duplicate-retry checks not run. |
| SWEEP-01 lifecycle/edit/delete | No override | NOT RUN | Broad status corrections, deletion/restore, field removal after Paid and scratch-job recovery not tested. |
| SWEEP-02 navigation/settings | No override | PARTIAL | Home, Jobs All/Paid, Earnings and Inbox were visited; business name was entered. Profile, all editable fields, settings defaults, searches, exports and other document controls were not swept. |
| SWEEP-03 interruptions/accessibility | No override | PARTIAL | Active session survived app reload. Network failure, VoiceOver, large text, keyboard/edge-swipe and controlled retry checks not run. |
| Release regression REL-01–06 and interaction matrix | No override | NOT RUN | No historical build/account/platform prerequisites; compatibility and upgrade behavior remain unverified. |

The invoice feature was tested as visible in the installed app. No flag-specific configuration or flag-off result is claimed.

## Feature and field coverage

| Surface/field | Change or validation attempted | Reopen/persistence | Outcome |
| --- | --- | --- | --- |
| New Job title | Title-only A saved | A reopened after reload and completed | PASS for this value; whitespace/cancel not run |
| Business name | Added “QA Handy Services” only | Persisted through app reload and invoice | PASS; optional fields/clear/cancel not run |
| Job customer | Added “Casey Test” only | Persisted through invoice and reload | PASS; phone/email/address/contact picker not run |
| Labor & Services | A set to $120 | Detail and invoice showed $120 | PASS; blank/zero/decimal/clear not run |
| Manual visit | A date Oct 18, 2026; duration 1h; no exact clocks | Reopened as one Oct 18 visit; 1.0h | PASS for date/duration; invalid interval/correction not run |
| Completion confirmations | A: no materials; no other costs | Saved and displayed as confirmed | PASS for explicit-none state |
| Live session title | B renamed to “QA 20261018 Repair leaking tap” | Persisted after reload | PASS |
| Live session material | B: Replacement washer, $24 | Persisted on B and linked to Oct 18 visit | PASS; total-only, no quantity/UOM/unit-price path |
| Live session notes | B: “Water shutoff is under sink; verify no leak.” and “Second note: bring ladder.” | Reopened as distinct notes on B | PASS; note edit/delete/cancel not broadly tested |
| Other Cost | B: Other, $6, “Test disposal fee”; attached to ended visit; billable unchecked | B detail showed $6 under Oct 18 visit | PASS for tested fields; checkbox toggle not tested |
| Quick Note | “Bring ladder for return visit” | Inbox entry assigned to B and shown under Job Notes | PASS |
| Quick Material | “Replacement washer,” total $8 only; missing total and -5 tested before correcting | Inbox entry assigned to B and shown under Job Materials | PARTIAL; negative silently normalized to positive |
| Invoice | Invoice #00001, $120; share preview opened read-only | After reload status PAID, Total $120 | PASS for create and payment projection; share, PDF, archived/link controls not run |

## Totals checked

| Fixture | Inputs and independent expectation | Observed |
| --- | --- | --- |
| A — Adjust sticking door | Revenue $120; 1.0h; no costs. Expected net $120 and net/hour $120. Invoice total $120, tax $0. | Detail showed $120 net and $120/hr; invoice showed $120 unpaid before payment and PAID / Total $120 after reload. Jobs Paid showed Revenue $120, Cost $0, Net $120. |
| B — Repair leaking tap | Revenue blank; $24 visit material + $8 Inbox material + $6 visit-linked Other cost. Expected net -$38. | Jobs list showed material cost -$32 and net -$38; detail showed the $24/$8 materials, $6 Other cost, one ended <0.1h visit, and three distinct notes. |
| Home/Earnings snapshot | Initial $3,351; after reload before A was paid $2,826; after A Paid $2,946. | The $525 drop equals the observed “Interior paint touch-ups” net and it had last worked Oct 11; it appears to have crossed the rolling 7-day snapshot boundary during the run. A Paid then added exactly $120. No separate aggregate discrepancy was confirmed. |

## Remaining coverage and final state

Scenario-level counts: 4 PASS, 7 PARTIAL, 3 NOT RUN, 0 BLOCKED. Partial coverage is not a pass for the omitted assertions.

Fixtures left for review: A is COMPLETED and PAID with Invoice #00001; B remains IN PROGRESS with blank Revenue, one ended live visit, $24 and $8 materials, $6 Other cost, and three notes. The Quick Inbox note/material were assigned; no unassigned items remained. Business name “QA Handy Services” was saved. No invoice/message was sent, no PDF was created, no business/pricing/tax settings or remote flags were changed, and no account/history was deleted. The timer started by this run was ended; the pre-existing “Live Visit” job was left untouched.

Next verification needed before treating invoicing/completion as release-ready: identify the installed build and effective invoice gate; reproduce FIND-01 on the intended release candidate and check whether a distinct completion-only route exists; resolve the negative amount behavior; run the release regression suite and remaining field/platform coverage on selected targets.
