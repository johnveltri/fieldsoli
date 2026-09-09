# Job Detail View Data Contract

## Scope and terminology

- **Job health** — list-level incomplete pills (`revenue`, `sessions`, `materials`, `costs`).
- **Row health** — a persisted child that is not yet countable / is missing required capture fields.
- **Read expand** — UI only; applies to **truncated notes** on View. Sessions are not expandable on View.
- Confirm-none timestamps persist from Edit Done (draft refs + reviewed/confirm APIs), not from a Complete bottom sheet.

No new tables. No new RPC for View. Live Session create/start APIs are unchanged this phase; Phase 3 will use existing create note/material and update start APIs for expanded capture.

## Fields

| ID | Field | Meaning | Source |
|---|---|---|---|
| DATA-V01 | jobs.materials_reviewed_at | Confirm-none Edit checkbox; persist on Edit Done | User |
| DATA-V02 | jobs.other_costs_reviewed_at | Same for other costs | User |
| DATA-V03 | focusTarget | Client-only Edit scroll target | Client |
| DATA-V04 | Job `Missing:` pills | Same rules as `incompletePillsFor` on Open Jobs | Derived |
| DATA-V05 | Session row missing | No explicit calendar date and/or no countable duration (Phase 1 flags / empty labels) | Derived |
| DATA-V06 | Material row missing | Missing description and/or missing total (0 with no captured total) | Derived |
| DATA-V07 | Other cost row missing | Missing explicit cost type and/or amount ≤ 0 | Derived |
| DATA-V08 | View customer card | `jobs.customer_name` and `jobs.service_address` (omit address when blank) | Persisted; display only |
| DATA-V09 | jobs.no_revenue_confirmed_at | Confirm-no-revenue Edit checkbox; persist on Edit Done. Completes revenue when `revenueCents` is not > 0. Cleared when the flag differs (including after entering positive revenue). | User |
| DATA-V10 | jobs.long_description | Optional body copy under the title on View/Edit. Same tap target as the title. Not a completeness field. | Persisted; display + Edit |

Job completeness formulas in `jobFinancialCompleteness.ts`, Open Jobs `hasMaterials` / `hasOtherCosts`, and DB `is_job_record_complete` only count **usable** cost rows (material description + total; other-cost type + amount). Incomplete capture-now rows still display on View. A live `inProgressSession` counts as a session. Revenue is complete iff `revenueCents > 0` or `noRevenueConfirmed`. Untitled Job is not a completeness gap.

## Relationships

- View session rows do not attach/detach children and do not surface `JobDetailSession.attachments` in the card UI (items appear under Materials / Other costs / Notes buckets).
- Note expand on View does not attach/detach children.

## Invariants

- Flag on View empty cards do not write reviewed_at.
- `apply_job_detail_edit` is not used from Live Session capture (existing overlay; Phase 3 keeps this).
- Customer tap does not create a customers row.

## Interfaces

Existing: `fetchJobDetail`, `apply_job_detail_edit`, reviewed-at / `updateJobNoRevenueConfirmed` APIs, PostHog flag.

Live Session `createNote`, `createMaterial`, `updateLiveSessionStart` / equivalent, and `startLiveSession` stay as today; Phase 3 will bind new UX to them.

## Migration

`20260908160000_no_revenue_confirmed_and_title_completeness.sql` adds `jobs.no_revenue_confirmed_at`, treats a non-blank title (including Untitled Job) as complete, and completes revenue when `revenue_cents > 0` or no-revenue is confirmed. Flag-off View confirm cards stay as they are.

## Verification

TEST-V03, TEST-V05, TEST-V08, TEST-V14, TEST-V15.
