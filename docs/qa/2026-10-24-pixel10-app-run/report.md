# FieldSoli Pixel 10 simulator QA — QA-20261024-01

Tested: 2026-10-24, America/Chicago. Pixel 10 AVD, Android 17 / API 37, emulator `emulator-5554`, 1080 × 2424 at 420 dpi.

App/build: Expo Go 57.0.9 / SDK 57.0.0, loading the current checkout from Metro at `d96d037` with local modifications. This was a development bundle, not a release binary.

Environment/account: hosted Dev Supabase project `anypejjoovlatmrkrxvx`; the Pixel began signed in as synthetic `app-store-demo@fieldsoli.example`. The simulator-QA skill authorizes persistent QA writes on `app-store-demo@fieldsoli.local`; this `.example` account is a different identity. Persistent QA work remained blocked. During an attempted account switch, the existing Live Visit stopped at 11:15 PM; see `CORE-07` and `AUTH-01` below. No new job, customer, note, material, document, or setting was created.

Effective local flags: `invoicing=true`, `job-detail-fullscreen-edit=true`; app environment `development`; analytics provider `none`. No flag values were changed in this pass. Flag-off compatibility was not run.

Scope: broad read-only sweep of visible tabs, account routes, saved estimates, document handoffs, job list filters/search, earnings windows, and selected blank forms; resumed with a focused Android/iOS Live Visit sizing comparison and app-restart observation. This is **partial QA**, not a complete page-by-page functional or design audit. A small UI correction was made in `EditFormRows.tsx` to clear Android's default vertical input padding, with a regression assertion in `LiveSessionBottomSheet.test.tsx`. The focused Jest suite passed (23 tests) under Node `v23.7.0`, outside the repository's `>=22.13.0 <23` engine range, so runtime validation under supported Node remains outstanding. The earlier `design-qa.md` result applies only to the Estimate Expiration settings crop.

## Core-loop verdict

| Step | Outcome | What was verified |
| --- | --- | --- |
| Capture | BLOCKED | The active account already has seeded jobs; first-use and minimal new-job creation were not attempted on this non-authorized write identity. |
| Work | NOT RUN | No live timer was started or edited. |
| Complete | BLOCKED | No job was mutated to test missing-information completion. |
| Invoice | FAIL / partial | Existing estimate previews opened. The public link did not resolve and explicit PDF creation hung. Creating and persisting a new document was not run. |
| Paid | NOT RUN | No payment/work status was changed. |

A new handyman could not be taken through capture → work → complete → invoice → Paid in this pass. Do not treat this as release verification.

## Release regression verdict

| Scenario | Outcome | Coverage |
| --- | --- | --- |
| Returning-user binary upgrade and migration | NOT RUN | No baseline release build or authorized upgrade path was selected. |
| Work-in-progress continuity through feature introduction/upgrade | NOT RUN | No timer or Inbox capture was created, and no upgrade was performed. |
| Corrections after completion, invoice, and Paid | NOT RUN | No records were changed. |
| Authentication expiry and account isolation | FAIL / partial | The current account could not be switched to the authorized `.local` QA account: Log Out did not reach sign-in, and `.example` profile data remained visible after restart. No second-account isolation assertion was possible. See `AUTH-01`. |
| Concurrent/stale edits | NOT RUN | Only one simulator UI session was used. |
| Months of history, pagination, and boundary totals | NOT RUN | Existing seeded rows did not establish pagination or historical boundary coverage. |
| Release candidate / platform coverage | NOT RUN | Only the Android development bundle was exercised; iOS and release binaries were not tested. |

**Release verdict: further verification required.** Required upgrade, work-continuity, interaction-matrix, and release-build evidence is absent.

## Feature interaction matrix

| Core area | Outcome | Observed assertion / evidence |
| --- | --- | --- |
| Job creation | BLOCKED | Existing account has populated history; creating a minimal first job would persist data outside the QA skill's authorized `.local` identity. |
| Editing | NOT RUN | Existing Job Edit fields were inspected and exited without saving. No validation, dirty-back, persistence, or reopen assertion was made. [Edit screen](screenshots/55-job-edit-open.png) |
| Completion | NOT RUN | Status menu options were visible, but no transition was selected. [Status menu](screenshots/54-job-overflow.png) |
| Invoicing | FAIL / partial | Existing estimate previews and handoff options were inspected. Public URL failed and PDF hung; invoice creation, immutable snapshot checks, and paid projection were not run. [Preview](screenshots/09-estimate-preview.png) · [Share sheet](screenshots/10-estimate-share-sheet.png) |
| Paid | NOT RUN | Paid filter displayed existing seeded jobs; no job was marked Paid or corrected. [Paid list](screenshots/29-jobs-paid.png) |
| Live sessions | FAIL / partial | The pre-existing active visit was minimized and observed, but it stopped during the account-switch attempt. A full QA-owned lifecycle was not run. |
| Inbox | NOT RUN | Empty Notes/Materials states and blank Quick Note/Quick Material forms were opened and canceled; save, edit, assignment, and deletion were not tested. [Inbox](screenshots/30-inbox.png) · [Quick Note canceled](screenshots/80-quick-note-closed.png) |
| Earnings | PASS (read-only navigation) | Week, Month, and Year screens opened and showed populated summary cards. No data mutation or independent full-account reconciliation was possible. [Week](screenshots/35-earnings.png) · [Month](screenshots/36-earnings-month.png) · [Year](screenshots/37-earnings-year.png) |

## Findings

| ID | Severity | Scenario | Problem and user consequence | Evidence |
| --- | --- | --- | --- | --- |
| FIN-01 | P1 | Job cards and Earnings summaries | The `COST` metric displays material costs only while `NET` subtracts all job costs. Other Costs are omitted from the displayed cost amount, so users see understated expenses. | [Jobs card](screenshots/27-jobs.png), [Job detail](screenshots/58-job-detail-restored.png), [Week](screenshots/35-earnings.png), [Month](screenshots/36-earnings-month.png) |
| SHARE-01 | P1 (hosted Dev flow; production applicability unverified) | Existing estimate public link | Opening the shared `fieldsoli.com/share/…` link shows “Invoice/Estimate no longer exists.” A customer following this link from this hosted Dev fixture cannot view the estimate. The Dev-to-public-route environment mapping may explain it; production behavior was not tested. | [Browser result](screenshots/70-share-link-visible.png), [share handoff](screenshots/67-android-share-targets.png) |
| PDF-01 | P2 | Explicit Download PDF | The share sheet remains at “Creating PDF…” and the preview becomes unresponsive. The stuck state reproduced with two saved estimates, and no PDF artifact or error was produced. Recovery required force-stopping and reopening the app. | [First attempt](screenshots/16-pdf-current.png), [preview unresponsive](screenshots/21-preview-scroll-check.png), [retry](screenshots/63-pdf-retry-result.png), [recovered app](screenshots/64-app-restored-after-pdf.png) |
| LIVE-01 | P1 | Active Live Visit during account switch / restart | The pre-existing visit started at 11:03 PM and its saved entry now ends at 11:15 PM (0.2h). I did not press End Visit; the timer badge disappeared during the Log Out/account-switch attempt. This may have truncated the user's work time. | [Active before switch](screenshots/86-live-visit-top.png), [minimized](screenshots/87-live-visit-minimized.png), [ended entry](screenshots/120-live-visit-entry-after-restart.png) |
| AUTH-01 | P2 | Log Out and auth recovery | Log Out did not return to sign-in or allow switching to the authorized QA account. After app restart, the `.example` dashboard and profile data remained visible. The run began with the attached invalid-refresh-token console error. | [Reported auth error](screenshots/115-user-auth-error.png), [account after restart](screenshots/104-personal-details-check.png), [dashboard after restart](screenshots/116-dashboard-after-restart.png) |

### FIN-01 details

1. Open Jobs → All. The “Drywall patch and paint” card shows Revenue `$439`, Cost `-$38`, Net `$389`.
2. Open the job. Its financial summary shows Revenue `$439.40`, Materials `-$38.00`, Other Costs `-$12.00`, and Net Earnings `$389.40`. The total costs are `$50.00`; the card's Cost value omits the `$12.00` Other Cost. [Job card](screenshots/27-jobs.png) · [Job detail](screenshots/58-job-detail-restored.png)
3. Open Earnings. Week shows Net `$3,511.60`, Revenue `$4,408.60`, Costs `-$803.00`; Month and Year show Net `$7,119.60`, Revenue `$9,043.60`, Costs `-$1,628.00`. Revenue minus the displayed Costs differs from Net by `$94` for Week and `$296` for Month/Year. [Week](screenshots/35-earnings.png) · [Month](screenshots/36-earnings-month.png) · [Year](screenshots/37-earnings-year.png)

The visible result is a runtime observation. Narrow source inspection confirms the displayed `COST` values are fed by `materialsCents`, while `netEarningsCents` is computed using all costs: [JobCard.tsx](../../../apps/mobile-expo/src/components/ds/JobCard.tsx#L58), [EarningsScreen.tsx](../../../apps/mobile-expo/src/screens/EarningsScreen.tsx#L433), [jobs.ts](../../../packages/api-client/src/jobs.ts#L773). I did not separately reconcile each period's underlying non-material cost rows. Expected behavior is either to show total costs under `COSTS` or label the displayed subset as materials; the current label does not communicate that distinction.

### SHARE-01 details

1. From an existing saved estimate, choose “Open in browser” from the share sheet.
2. Chrome opens the public `fieldsoli.com/share/…` route.
3. The page says “Invoice/Estimate no longer exists.” The same outcome was observed through the native share route. No message was sent.

The app was connected to hosted Dev while the route used the public `fieldsoli.com` host. That is a plausible environment mismatch, not proof that production links fail. A Dev-compatible public route or a production-target check is needed to separate those cases.

### PDF-01 details

1. On Estimate #00002, select the explicit Download PDF action.
2. After several minutes, the sheet still shows “Creating PDF…”; scroll and normal close/back were unresponsive while the operation remained active.
3. Force-stop and reopen Expo Go/FieldSoli to restore Home.
4. Retry once on Estimate #00001. After at least 12 seconds it still shows “Creating PDF…” and no useful PDF error appears in the inspected logs. No file handoff was reached.

This is reproducible in the tested development emulator. Physical-device and release-build behavior remain unverified.

### LIVE-01 and AUTH-01 details

The original Pixel session began with the console error `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` ([reported screen](screenshots/115-user-auth-error.png)). I minimized the visit and opened Account. Tapping Log Out did not navigate to sign-in. Personal Details still showed the `.example` account ([screen](screenshots/104-personal-details-check.png)); after a force-stop/reopen, the dashboard and existing data remained visible ([screen](screenshots/116-dashboard-after-restart.png)). I did not clear app storage or enter credentials for a different account.

During that switch attempt, the active visit started at 11:03 PM and became a saved visit from 11:03 PM to 11:15 PM, duration 0.2h ([entry](screenshots/120-live-visit-entry-after-restart.png)). I did not tap End Visit. The app was reopened and the job still appeared In Progress, but the floating active-session timer was no longer present. I stopped the broader QA at that point to avoid further changes to the user's visit. The user should review this ended 12-minute entry; I did not try to extend or replace its recorded time.

### LIVE-UI-01 Android / iOS row sizing

The supplied Android capture showed extra height in the live-visit customer and Labor & Services input rows compared with Material and Note, while the supplied iOS capture showed consistent row sizing. The shared `EditFieldInput` uses `DsTextInput`; Android's native EditText vertical padding was retained in addition to the surrounding row spacing. I set `paddingVertical: 0` on the shared field style so the row owns the vertical spacing. The focused `LiveSessionBottomSheet.test.tsx` Jest run passed: 1 suite, 23 tests, including a regression assertion for Customer, Phone, Email, Address, and Labor & Services. Runtime screenshots after Fast Refresh show the Android rows visually aligned with the supplied iOS reference: [Android before](screenshots/81-live-visit-android-before.png), [iOS reference](screenshots/82-live-visit-ios-reference.png), [Android after](screenshots/84-live-visit-android-after-scrolled.png). The test ran on Node `v23.7.0`; the repository requires Node `>=22.13.0 <23`, so rerun under supported Node before treating the test runtime as fully validated.

## Scenario coverage

Statuses below are counted at the **scenario-row level**. A PASS applies only to the assertion written in that row; it does not certify the entire feature.

| ID / assertion | Effective flag configuration | Outcome | Observed result | Evidence / reason |
| --- | --- | --- | --- | --- |
| CORE-00 — blank first-use account | `invoicing=true`; fullscreen edit `true` | BLOCKED | Active account is populated; blank account/blank business assertions not reproduced. | Writes restricted to the designated `.local` account. |
| CORE-01 — minimal first job and validation | same | BLOCKED | No job created or title validation attempted. | See account restriction above. |
| CORE-02 — invoice with missing fields | same | BLOCKED | No clean title-only job was available to test missing-field guidance. | Existing documents were already saved. |
| CORE-03 — completion with gaps and Paid guard | same | BLOCKED | No status transition was attempted. | Would persistently change an existing record or require a new fixture. |
| CORE-04 — edit, validation, save, and reopen | same | NOT RUN | Existing Job Edit was inspected and canceled without changes. | [Edit screen](screenshots/55-job-edit-open.png) |
| CORE-05 — open existing Estimate preview | same | PASS (preview only) | Saved estimates rendered; preview content and scrolling were inspected before the PDF hang. | [Estimate #00002](screenshots/09-estimate-preview.png) · [Estimate #00001](screenshots/61-estimate-00001-preview.png) |
| CORE-05 — Text/native share handoff | same | PASS (handoff only) | Android Messages opened with an empty recipient field; no recipient number was prefilled. The saved customer has no phone number, so populated-phone behavior remains untested. No send occurred. | [SMS composer](screenshots/11-sms-composer.png) · [Android targets](screenshots/67-android-share-targets.png) |
| CORE-05 — explicit PDF download | same | FAIL | “Creating PDF…” remained stuck on two estimates; no PDF was handed off. | [First attempt](screenshots/16-pdf-current.png) · [Retry](screenshots/63-pdf-retry-result.png) |
| CORE-05 — public estimate link | same | FAIL (Dev route) | Public route reports the estimate no longer exists. Production applicability is unknown. | [Browser result](screenshots/70-share-link-visible.png) |
| CORE-05 — Email handoff | same | BLOCKED | Gmail opened its first-run Welcome screen instead of a message composer. No email was sent; Gmail setup was not changed. | [Gmail first run](screenshots/44-blank-check.png) |
| CORE-06 — mark Paid and verify after reload | same | NOT RUN | Existing Paid filter rendered, but no job's payment state was changed. | [Paid list](screenshots/29-jobs-paid.png) |
| CORE-07 — live session lifecycle | same | FAIL (partial) | The already-active Live Visit was minimized. During the attempted logout/account switch, it ended at 11:15 PM; no End Visit action was pressed. Its saved entry is 11:03–11:15 PM (0.2h). Starting, resuming, and normal end flows remain untested. | [Minimized visit](screenshots/87-live-visit-minimized.png) · [Pre-switch active screen](screenshots/86-live-visit-top.png) · [Saved visit entry](screenshots/120-live-visit-entry-after-restart.png) |
| LIVE-UI-01 — Android/iOS Live Visit row sizing | `invoicing=true`; fullscreen edit `true` | PASS (visual comparison after correction) | Android input rows were taller before the style correction; after Fast Refresh, customer and labor input rows visually align with the add rows and supplied iOS reference. Focused regression test passed; Node version is outside the repo engine range. | [Before](screenshots/81-live-visit-android-before.png) · [iOS reference](screenshots/82-live-visit-ios-reference.png) · [After](screenshots/84-live-visit-android-after-scrolled.png) |
| CORE-08 — quick Inbox capture/edit/assign | same | NOT RUN | Notes and Materials were empty; blank Quick Note and Quick Material forms were opened and canceled. Persistence and assignment were not checked. | [Notes](screenshots/30-inbox.png) · [Materials](screenshots/31-inbox-materials.png) · [Quick Note canceled](screenshots/80-quick-note-closed.png) |
| SWEEP-01 — Jobs All/Open/Paid lists, search/no-results/clear | same | PASS (list/search only) | Filters switched; a nonexistent search showed no results; clearing restored the list. Pagination was not exercised. | [Jobs](screenshots/27-jobs.png) · [No results](screenshots/77-jobs-search-no-results.png) · [Cleared](screenshots/78-jobs-search-cleared.png) |
| SWEEP-01 — status menu discovery | same | PASS (menu only) | Not Started, In Progress, Completed, Paid, On Hold, and Cancelled options were visible; none was selected. | [Status menu](screenshots/54-job-overflow.png) |
| SWEEP-02 — Home, Jobs, Earnings windows | same | PASS (read-only navigation) | Main tabs opened; Earnings switched Week/Month/Year and rendered values. Refresh-after-mutation and eligibility were not tested. | [Home](screenshots/05-home.png) · [Week](screenshots/35-earnings.png) · [Month](screenshots/36-earnings-month.png) · [Year](screenshots/37-earnings-year.png) |
| SWEEP-02 — Profile, Business, Invoice Settings routes | same | PASS (view only) | Routes and current values rendered. No fields, settings, save, discard, or reopen behavior was tested. | [Profile](screenshots/01-personal-details.png) · [Business](screenshots/03-business-details.png) · [Invoice settings](screenshots/04-estimate-invoice-settings.png) |
| SWEEP-02 — Inbox empty states and add forms | same | PASS (open/cancel only) | Notes/Materials empty states rendered; blank Quick Note and Quick Material forms opened; Quick Note was dismissed with Android Back without saving. | [Inbox add menu](screenshots/32-inbox-add.png) · [Quick Note form](screenshots/79-quick-note-form.png) · [Closed](screenshots/80-quick-note-closed.png) |
| SWEEP-02 — Privacy choices view | same | PASS (read only) | Privacy choices and current toggle states were inspected; none was changed. Legal-link destinations were not opened. | [Privacy choices](screenshots/40-privacy-choices.png) |
| SWEEP-02 — export generation/file reconciliation | same | NOT RUN | Export page showed year, destination, and personal/financial fields; export request and handoff were not triggered. | [Export screen](screenshots/42-export-job-summary.png) |
| SWEEP-03 — recover app after stuck PDF | same | PASS (app recovery only) | Force-stop/relaunch restored Home; it did not complete or recover the PDF operation. | [Restored Home](screenshots/64-app-restored-after-pdf.png) |
| SWEEP-03 — Back cancels blank Quick Note | same | PASS | Android Back closed the unsaved form and returned to Jobs; no note was saved. | [Closed form](screenshots/80-quick-note-closed.png) |
| SWEEP-03 — controlled network/read failure | same | NOT RUN | No simulator-only fault injection was available in this pass. | No host/network changes made. |
| SWEEP-03 — TalkBack, large text, keyboard edge cases | same | NOT RUN | No screen-reader or large-text pass was completed. | Development gear overlay was visible in some screenshots and is not treated as app release UI. |
| SWEEP-03 — field validation and save/reopen across surfaces | same | NOT RUN | Text, money, material, session, checkbox, and picker save behavior was not exercised. | Requires writable fixture. |
| SWEEP-03 — SMS with an existing customer phone | same | NOT RUN | The existing customer has no phone; no synthetic phone value was saved. | [SMS composer](screenshots/11-sms-composer.png) |
| REL-01 — returning-user upgrade/migration | same | NOT RUN | No baseline build or upgrade transition. | Mandatory release gap. |
| REL-02 — active work across feature introduction/upgrade | same | NOT RUN | No active session or Inbox items were created and no upgrade was performed. | Mandatory release gap. |
| REL-03 — corrections after completion/invoice/Paid | same | NOT RUN | No corrected financial or payment state was exercised. | Mandatory release gap. |
| REL-04 — auth expiry and account isolation | same | FAIL / partial | Invalid-refresh recovery and Log Out did not get the simulator to a sign-in screen; `.example` data remained visible after restart. Cross-account isolation was not tested because the `.local` account could not be reached. | [Auth error](screenshots/115-user-auth-error.png) · [Profile email](screenshots/104-personal-details-check.png) |
| REL-05 — simultaneous/stale edits | same | NOT RUN | No second authenticated UI session. | Mandatory release gap. |
| REL-06 — long history, pagination, and date boundaries | same | NOT RUN | Seeded history was not sufficient to establish pagination or historical-boundary behavior. | Mandatory release gap. |
| FLAG-OFF — legacy compatibility | same | NOT RUN | Invoicing flag was not disabled. | No local/remote flag changes made. |
| RELEASE-BUILD — Android/iOS candidate | same | NOT RUN | Only Android Expo Go + Metro was exercised. | Does not establish release-binary or iOS behavior. |
| DESIGN — full visual audit of all pages | same | NOT RUN | Only the earlier Estimate Expiration crop had a focused comparison; visual review of these screenshots was not a full-page design QA. | See [design-qa.md](../../../design-qa.md). |

## Feature and field coverage

| Surface / fields | Happy edit | Validation | Cancel/back | Reopen/persistence | Outcome |
| --- | --- | --- | --- | --- | --- |
| Job title/customer/address/labor/material/cost/session/notes | No saved edit | Not attempted | Edit screen exited without Save | Original job reopened unchanged | NOT RUN for editing; read-only field inventory only |
| Live Visit Customer/Phone/Email/Address/Labor row heights | No values changed | Not attempted | Active Visit was minimized; no field focused or edited | After style correction, Pixel screenshot compared to supplied iOS reference | PASS for layout comparison only; behavior/persistence NOT RUN |
| Job search | Search for nonexistent title | No-results state shown | Query cleared | Existing list returned | PASS for search/no-results/clear |
| Quick Note | No note saved | Blank form only | Android Back dismissed | No persistence assertion | PASS for open/cancel only; save NOT RUN |
| Quick Material | No material saved | Blank form only; Save disabled | Form dismissed | No persistence assertion | PASS for open/cancel only; save NOT RUN |
| Profile and business fields | No edits | Not attempted | Not applicable | Current values viewed only | NOT RUN |
| Invoice settings (expiration, tax, markup, terms) | No settings saved | Not attempted | Not changed | No save/reopen assertion | NOT RUN; the 30-day selection is only the focused prior visual check |
| Customer phone and SMS autofill | No number saved | Not applicable | Messages composer left unsent | No populated-phone scenario | NOT RUN; empty recipient is expected for this record |
| Privacy options | No toggle changed | Not attempted | Not applicable | No persistence test | PASS for current-state viewing only |
| Export options | No file generated | Not attempted | Request not submitted | No file reopened/reconciled | NOT RUN |

## Totals checked

| Fixture / summary | Independent calculation | Observed | Evidence |
| --- | --- | --- | --- |
| Existing job financials | `$393.80` labor + `$45.60` billable material = `$439.40` revenue; `$38.00` material cost + `$12.00` other cost = `$50.00` costs; `$439.40 - $50.00 = $389.40` net. | Job detail agrees. Jobs card rounds Net to `$389` but displays Cost `-$38`, omitting the other cost. | [Job detail](screenshots/58-job-detail-restored.png) · [Jobs card](screenshots/27-jobs.png) |
| Existing Estimate #00001 / #00002 | `$439.40` subtotal + 8.25% tax on `$45.60` material (`$3.762`, rounds to `$3.76`) = `$443.16`. | Both previews show total `$443.16`. No new estimate was created. | [Estimate #00002](screenshots/09-estimate-preview.png) · [Estimate #00001](screenshots/61-estimate-00001-preview.png) |
| Earnings Week | Displayed revenue `$4,408.60`, costs `-$803.00`, net `$3,511.60`; revenue less displayed costs is `$3,605.60`, a `$94.00` gap. | UI shows those three values. The implementation displays material costs while net subtracts all costs; underlying non-material rows were not separately reconciled. | [Week](screenshots/35-earnings.png) |
| Earnings Month / Year | Displayed revenue `$9,043.60`, costs `-$1,628.00`, net `$7,119.60`; revenue less displayed costs is `$7,415.60`, a `$296.00` gap. | Month and Year show the same seeded totals. The displayed Costs are material-only; all-cost rows were not reconciled one by one. | [Month](screenshots/36-earnings-month.png) · [Year](screenshots/37-earnings-year.png) |

## Remaining coverage and final state

Scenario-row totals: **11 PASS, 4 FAIL, 5 BLOCKED, 16 NOT RUN** (36 rows). The findings are not hidden inside passing rows. Coverage remains incomplete, including authorized persistent mutations, full live-session lifecycle, completion/Paid, new document creation, settings persistence, populated-phone SMS, export, accessibility, flag-off behavior, and the mandatory release regression suite.

The key dependency for completing write scenarios is resolving the observed Log Out / invalid-refresh recovery problem so the simulator can reach the skill-authorized `app-store-demo@fieldsoli.local` account. The `.example` hosted-Dev account was not used for new persistent QA records. The public-link issue also needs an environment-correct route or a production-target verification.

Final simulator state: FieldSoli Job Detail for “Live Visit Oct 24 at 11:03 PM,” scrolled to Visits. The visit now shows 11:03 PM–11:15 PM (0.2h); it had been running before the account-switch attempt, and no End Visit action was pressed. No job fields, finances, customer data, documents, notes, materials, settings, or privacy switches were edited; no email or SMS was sent; no export was requested. The synthetic estimate URL copied during the original share check may remain in the Android clipboard. A supported Android shell clipboard-clear command was unavailable. Expo Go was force-stopped/reopened without clearing storage during auth-recovery investigation.
