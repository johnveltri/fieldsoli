# FieldSoli 1.2 iOS release preparation — October 31, 2026

## Identity and verdict

Target: iPhone 17 Pro, iOS 26.2, UDID `95208464-318A-445B-9AFE-942C65AD574C`.
Runtime: Expo Go 57.0.9, SDK 57, this worktree through Metro port 8084; hosted Dev `anypejjoovlatmrkrxvx`. This is development-bundle evidence, not the TestFlight/store binary.
Account: authorized synthetic `app-store-demo@fieldsoli.example`; identity verified through Personal Details. Existing populated account/business; first-ever use and blank-business assertions unavailable. Local configuration: development, invoicing enabled, fullscreen edit enabled, analytics none. No remote flag changes or backend reset/deploy.

**Verdict:** targeted simulator checks pass after three fixes. Public-release approval remains pending the physical TestFlight candidate and the explicit coverage gaps below. The historical Android failures are not certified fixed by this run.

## Changes and evidence

1. Total Costs: API list/snapshot/aggregate now expose `costsCents`, negative Materials plus Other Costs; preserve material-only `materialsCents`. Existing cost-ID deduplication, soft-delete queries, eligibility and window logic are unchanged. Home/Jobs COST and Earnings COSTS consume total costs; Net = Revenue + signed Costs.
2. Account: reproduced minimized Live Visit bar covering Log Out at the bottom scroll limit. A tap hit the timer instead of logging out. Added bottom scroll clearance; Log Out now scrolls above the bar and actually reaches Sign In. See [clearance](evidence/account-logout-clearance.png).
3. Live Visit pricing: reproduced entering $100 Labor & Services but completion finding no component labor. `flushIdentity` discarded the labor patch and wrote legacy Revenue. It now writes component labor with invoicing on and legacy Revenue with it off, including blur/minimize/end flushes. Fresh fixture retains $125 in Job Detail after End Visit: [persisted amount](evidence/labor-persisted-after-end.png). Saved visit is October 31, 2:50–2:51 PM, <0.1h.

## Executed scenarios

| Scenario | Outcome | Observed assertion |
| --- | --- | --- |
| Mixed-cost Home/Jobs card | PASS | Existing Drywall job: $439.40 revenue, $38 materials + $12 other costs; COST now −$50, NET $389 with existing whole-dollar rounding. [Jobs](evidence/jobs-total-costs.png) |
| Earnings Week | PASS | Before QA completion: Revenue $404, Costs −$57, Net $347. [Week](evidence/earnings-week.png) |
| Earnings Month | PASS | Before QA completion: $7,585.60 − $1,549 = $6,036.60. [Month](evidence/earnings-month.png) |
| Earnings Year | PASS | Before QA completion: $9,043.60 − $1,924 = $7,119.60. [Year](evidence/earnings-year.png) |
| Estimate create/preview | PASS | Created synthetic Estimate #00002 for existing Drywall job, $443.16 including $3.76 tax; saved preview and share options rendered. |
| Explicit PDF, cancel, repeat | PASS | Twice produced native share sheet for Estimate #00002, 39 KB PDF, correct amount/business filename. Cancellation returned to saved preview without a hang. [Native handoff](evidence/pdf-native-handoff.png) |
| Live start/minimize/reopen/relaunch | PASS | QA-owned first timer kept its title and elapsed time after app termination/reload. [Relaunch](evidence/live-restored-after-relaunch.png) |
| Logout/relogin with active timer | PASS | With clearance fix, Logout reached Sign In. Skill-stored password was rejected; user restored the authorized account session. Timer resumed, still running rather than ended. [After login](evidence/live-restored-after-login.png) |
| Capture/work/complete/invoice/Paid | PASS after correction | New QA Logout continuity job created from Live Visit; customer entered, $100 labor set via completion guidance after finding the Live Visit pricing defect; no materials/no other costs confirmed. Complete & Create Invoice produced Invoice #00002 for $100; Confirm $100 Paid reached Paid. [Paid](evidence/core-qa-job-paid.png) |
| Paid correction and persistence | PASS (payment only) | Mark Unpaid returned to Completed; Mark Paid and confirmation restored Paid. App relaunch showed the same Paid job, Revenue/Net $100. Home weekly Net increased exactly $100 to $447, without double-counting payment toggles. |
| Live labor regression | PASS | Final fixed checkout, new QA Labor persistence visit: $125 survives blur and End Visit; reopened component editor shows $125. Visit explicitly ended. |

Rows above are assertion-specific, not full feature certification. No email/text was sent, no invoice was delivered, no real payment was processed. Native share preview is not proof of recipient delivery or public-link routing.

## Automated validation

Node **22.23.4**, within repository engine range:

- API client: 18 suites, 156 tests pass. Added material-only, Other-Cost-only, mixed, zero, legacy classification, deduplicated session-linked costs, all three windows, and soft-delete query assertions. Existing material-only tests remain.
- Mobile: 75 suites, **545 tests pass**, including $50 Cost display, $389.40 Net, all Earnings windows, Live Visit pricing on/off blur/minimize/end, and existing profile/logout checks.
- Investigated the previous eight invoicing failures under Node 22: tests selected the wrong Modal after Android preview gained `statusBarTranslucent`. Select share modal by `onDismiss`; all 49 invoicing tests pass. No runtime handoff behavior was changed to satisfy those tests.
- Document renderer: 2 suites, 27 tests pass.
- Workspace typecheck, product export, design check, and `git diff --check` pass.

## Coverage gaps / public-release gates

- Actual physical-iPhone TestFlight candidate: upgrade continuity, totals, document/PDF/native handoffs, active visit lifecycle, authentication recovery, and new-user access must pass before public release.
- REL-01/02: no prior release simulator binary upgrade tested. Development reload continuity passed; it is not a binary migration test.
- REL-03: payment correction passed; forgotten costs, customer edits after invoice, and historical snapshot comparisons not run comprehensively.
- REL-04: logout/relogin passed; true expiry and two-account isolation not tested (no second authorized account/mechanism).
- REL-05: concurrent/stale editing blocked: no second user-selected UI session. Do not substitute direct API writes.
- REL-06: existing historical data across three windows inspected; full pagination/date-boundary fixture reconciliation not performed.
- Flag-off pricing has unit coverage. A local flag-off runtime pass retained $125 job revenue and the $100 invoice-backed Paid job while hiding document and component-labor entry points. This is a focused compatibility pass, not an exhaustive flag-off audit. Original local invoicing override restored; no remote rollout changes.
- Connected PostHog project Fieldsoli Analytics (461762), invoicing flag 970495, is active but restricted to one distinct ID and the old `.local` demo email. No general-user rule exists: general invoicing access must be deliberately addressed before public launch. [Flag configuration](https://us.posthog.com/project/461762/feature-flags/970495). Runtime new-user access in the production candidate, production shared document links, store metadata/device previews, and physical native permissions remain unverified. The old hosted-Dev public-link failure is environment-specific until independently tested in production.
- Broad Inbox/settings/export/accessibility sweep and blank-account/business tests are not claimed complete.

## Persistent QA changes / cleanup

Synthetic hosted Dev only:

- Created `QA 20261031 Live continuity`, visit explicitly ended (started around 2:27 PM).
- Created `QA 20261031 Logout continuity`, visit explicitly ended after sign-in recovery; customer `QA Customer 20261031`, $100 labor, no materials/no other costs confirmations, Invoice #00002, final Paid state.
- Created `QA 20261031 Labor persistence`, $125 labor, visit explicitly ended (2:50–2:51 PM); left incomplete/in progress for review.
- Added Estimate #00002 to the pre-existing Drywall job. Existing financial fields were not changed.
- No account/password changes, deletion, bulk reset, external sends, remote flags, or backend deploy. All timers created by this run were ended. The Logout continuity visit persisted as 2:38–2:44 PM, 0.1h. QA fixtures are retained for review. The temporary Metro server was stopped; the original local invoicing override was restored.

TestFlight build/submission status is recorded separately in `release-status.md` when available.

## Delivery boundary reaffirmed

User explicitly reaffirmed TestFlight only during this run. Do not submit for App Store review or public release; the user must update metadata first. No store listing fields were changed.
