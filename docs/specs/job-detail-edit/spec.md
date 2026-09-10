# Job Detail Edit

**Status:** Approved product spec
**Feature source:** Job detail Edit page (Google Calendar edit-event layout), Phase 1 of job view/edit speed work
**Last updated:** 2026-09-01

## Outcome

A solo tradesperson can change everything that belongs on a job — identity, sessions, materials, other costs, and notes — on one fullscreen Edit page, then commit once with **Done** or throw the draft away with **Back**. That removes the current edit-save-edit-save loop of nested bottom sheets for the pencil path.

## Approved decisions

- Phase 1 is the **Edit page plus direct FAB Inbox capture**. View subtraction, Inspect, Todoist new job, Inbox swipe, and live-session overlay redesign are deferred.
- Edit is a **mode on the existing job-detail fullscreen**, not a second stacked modal and not `EditJobBottomSheet`.
- Layout follows **Google Calendar edit event** (hero title, icon rows, Add-rows, delete at bottom). Chrome is **not** Calendar’s X: **Back** on the left, **Done** on the right in the same slot as View’s **EDIT**, using brand primary red.
- All Edit-page field and list changes are an **in-memory draft until Done**. Back discards (with confirm if dirty). Process kill discards.
- **Duration-first** sessions: date and duration may be captured independently; duration is the primary time value; start and end are optional. When date or clock times are omitted, View shows honest missing-data labels and never invented user-facing values. Internal `started_at` / `ended_at` may still be synthesized so existing constraints stay intact.
- Materials are **total-first**. Description, quantity, and unit price are independently optional capture fields; UOM accompanies any captured breakdown. Total changes only when both quantity and unit price are explicit; otherwise the entered total remains authoritative.
- **Delete job**: confirm, then delete immediately and leave job detail. Not part of the Done draft.
- Live Session is **not** on Edit. In-progress sessions are not in the draft and cannot be deleted from Edit.
- View **ADD pills and item sheets stay** for this release, including the mark-complete wizard. Pencil and `initialEditOpen` go to Edit mode instead of `EditJobBottomSheet`.
- After Done, View session rows with no explicit clock times hide the time range (minimal View display change required for honest duration-only sessions).
- Fullscreen Edit is protected by `job-detail-fullscreen-edit`. Production evaluation uses the authenticated Supabase user UUID as PostHog `distinct_id`; no email is transmitted. Disabled, unavailable, or timed-out evaluation falls back to the existing sheets.
- FAB **Quick Note** and **Quick Material** open their capture forms directly and save to Inbox. They do not ask for a job or session.

## Scope

- Smallest useful release: Job Detail Edit mode that can create, update, and delete job identity and child rows in one Done, with Back discarding, plus confirm-and-delete-job.
- Users and surfaces: authenticated mobile job detail (iOS Modal and Android overlay).
- Known dependent features: mark-complete wizard and Live Session keep current sheets; completeness rules and no-materials confirmation are unchanged; invoices/share are not in this release. A future **Customers** record (table, save-from-Edit, View Inspect) is identified but **out of this release** — see Deferred work.

## Product requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| REQ-01 | Header **EDIT** / pencil and new-job `initialEditOpen` open Edit mode instead of `EditJobBottomSheet`. | TEST-01 |
| REQ-02 | Edit chrome is **Back** (left) and **Done** (right, View **EDIT** slot, brand primary). Layout matches [ux-contract.md](ux-contract.md). | TEST-02, TEST-20 |
| REQ-03 | Edit contains job title, customer, address, revenue, and editable lists for sessions, materials, other costs, and notes, including inline add. | TEST-02, TEST-03 |
| REQ-04 | List changes (add, edit, swipe-remove) stay in the draft until Done. Back with a dirty draft asks to discard; confirming discard restores last persisted job. | TEST-04, TEST-05 |
| REQ-05 | Done persists the draft in one transaction, refetches job detail, and returns to View. Failure keeps the draft and shows retry copy. | TEST-06, TEST-07 |
| REQ-06 | Job title is the only field that blocks Done when blank. Completely empty brand-new rows are omitted. Non-empty partial sessions, materials, and other costs persist with explicit missing-data state; blank new notes are omitted and clearing an existing note deletes it. | TEST-08 |
| REQ-07 | New sessions start with no explicit date, duration, start, or end. Duration is primary; date/start/end remain optional. Storage timestamps may be synthesized, but `calendar_date_explicit` and clock-explicit flags preserve what the user actually entered. Undated or zero-duration ended sessions do not drive job status, last-worked, or completeness. | TEST-09, TEST-10, TEST-21 |
| REQ-08 | Material total is primary. Description, quantity, and unit price are optional; UOM is optional breakdown metadata. Quantity and unit price retain independent explicitness; only when both are explicit does quantity × unit price recompute total. Partial breakdown values survive Done and reopen. | TEST-11, TEST-22 |
| REQ-09 | Notes, materials, and other costs may optionally attach to an ended session on the Edit page via `ChooseSessionBottomSheet` (date + duration label per row). | TEST-12 |
| REQ-10 | Swipe-remove on a draft row hides it until Done (soft-delete) or Back (restore). Removing a session immediately makes its visible child notes/costs unassigned in the draft. | TEST-13 |
| REQ-11 | **Delete job** at the bottom confirms, then soft-deletes immediately and closes job detail. It does not wait for Done. | TEST-14 |
| REQ-12 | In-progress live sessions do not appear on Edit and cannot be deleted or rewritten by Done. | TEST-15 |
| REQ-13 | Process kill or force-quit while in Edit discards the draft. Reopening the job shows last persisted data. | TEST-16 |
| REQ-14 | View section ADD, row-tap sheets, Live Session, and mark-complete wizard keep current behavior. FAB Quick Note and Quick Material are the approved exception: each opens capture directly and saves to Inbox without job/session choice. | TEST-17, TEST-24 |
| REQ-15 | Done and Delete job honor job ownership (authenticated owner only). | TEST-18 |
| REQ-16 | While Done is saving, repeated Done, Back, hardware/system Back, and Delete job are disabled or ignored so no conflicting mutation/navigation can start. | TEST-23 |
| REQ-17 | The fullscreen entry flag evaluates by Supabase user UUID only and fails closed to existing edit sheets on disabled, error, or bounded timeout. | TEST-25 |
| REQ-18 | Retrying an identical successful apply payload is idempotent: client-generated child IDs do not duplicate rows or fail the retry. | TEST-26 |

## Artifact manifest

| Artifact | Applicability | Path or inline section | Rationale |
|---|---|---|---|
| State model | Required | [state-model.md](state-model.md) | In-memory draft, discard, save, and delete-job are a multi-step workflow with interruption rules. |
| Data contract | Required | [data-contract.md](data-contract.md) | New session flag, synthesized times, and a transactional apply RPC. |
| UX contract | Required | [ux-contract.md](ux-contract.md) | New surface, copy, gestures, and Calendar-style layout. |
| Test contract | Required | [test-contract.md](test-contract.md) | Proof spans UI, RPC, RLS, and device interruption. |

## Product constraints

- Brand and field-speed constraints: one mutation surface for the pencil path; View sheets remain available; FAB Quick Note/Material are direct Inbox capture.
- Security, privacy, legal, or financial constraints: owner-only writes; soft-delete job and children; no change to paid/invoiced meaning; revenue still cents on `jobs`.
- Free-tier and dependency constraints: one RPC per Done (fewer round-trips than N sheet saves). No new paid vendor. Reuse `react-native-gesture-handler` `Swipeable`.
- Compatibility and release constraints: deploy the migration before the mobile build that calls the RPC. Old clients ignore `clock_times_explicit` and may show synthesized clock times for duration-only sessions created by new clients.

## Acceptance scenarios

- Given a loaded job, when the user taps **EDIT**, then they see Calendar-style Edit with current values and can change lists without those writes hitting the server until **Done**.
- Given a dirty Edit draft, when the user taps Back and confirms discard, then View shows the job as it was before Edit.
- Given a duration-only new session, when the user taps **Done**, then View shows the session’s date and duration and does not show a start–end clock range.
- Given an undated or zero-duration partial session, when the user taps **Done**, then the row survives without changing job status, last-worked, or completeness.
- Given a material total plus only quantity or only unit price, when the user taps **Done** and reopens Edit, then the total and partial breakdown value remain unchanged and the missing counterpart remains visibly missing.
- Given flag evaluation is disabled, unavailable, or times out, when the user enters Edit, then the existing Edit sheet opens.
- Given the apply response is lost after commit, when the user retries the same Done payload, then the response succeeds without duplicate children.
- Given Delete job, when the user confirms, then the job is gone from lists even if they never tapped **Done**.
- Given mark-complete still needs a session, when the user uses the existing wizard, then the current session sheet still opens (not Edit mode).

## Agent-decided assumptions

- Default date and duration for a new session are **empty** until the user enters them or attaches a non-empty child that requires the partial session to persist.
- Synthesized clock when times are omitted: **09:00 local** on the session date, end = start + duration (0h when duration unset), `started_tz` = device IANA zone. These values are storage-only until both start and end clocks are explicit.
- Duration chips: **30m**, **1h**, **2h**, **4h**, **8h**, plus a numeric field. Picking a duration clears the end clock when a start clock was set; start clock is preserved.
- Apply payload is a **diff** (creates/updates/deletes), not a replace-all child list, so a live session that ends while Edit is open is not destroyed.
- Client RPC is `public.apply_job_detail_edit_atomic`, `SECURITY INVOKER`, owner RLS; it applies confirmation timestamps and invokes the existing row-diff function within one transaction.
- Exact copy in the UX contract unless later overridden.

## Non-goals

- Removing View ADD/EDIT pills, session accordion, or no-materials confirmation cards.
- Inspect (full note / photo viewer).
- Assigning a job or session inside FAB Quick Note/Material; those captures intentionally land in Inbox.
- Todoist-style job create (no Untitled Job until named).
- Inbox swipe-to-delete.
- Live session overlay redesign.
- Autosave of the Edit draft to disk.
- Changing financial completeness rules.
- A `customers` table, linking a job to a customer id, creating a customer from Edit, or a customer Inspect/manage surface.

## Deferred work

- Phase 2 Job View quality: [`../job-detail-view-simplification/spec.md`](../job-detail-view-simplification/spec.md).
- **Phase 3** (Inbox view, Todoist new job, Quick Note/Material minimum-save UX, Live Session View tile + overlay capture) is specified from Job View deferred work, not this Edit packet.
- Live overlay redesign is Phase 3, not this packet.
- Re-homing mark-complete gaps onto Edit after View sheets go away.
- **Customers (next iteration, not this RPC):** user-owned customer records; job points at a customer; Edit Customer row becomes search/select/create; View customer name becomes Inspect (full customer fields / manage). Preserved seams for this release:
  - Keep Customer as one Calendar-style **icon row** bound only to `jobs.customer_name` (plain text).
  - Do not add `customer_id` (or a customers payload key) to `apply_job_detail_edit`.
  - Do not invent a customer picker, “save as customer”, or View tap-to-Inspect on the name.
  - Address stays a **job** field (`jobs.service_address`), not a customer-owned address, until Customers is shaped.

## Open blockers

- None
