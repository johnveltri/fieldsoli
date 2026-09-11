# Inbox, New Job, Quick Capture, Live Session

**Status:** Approved product spec
**Feature source:** Phase 3 — capture and create surfaces aligned with Job View scan/read/act. Supersedes the Phase 2 deferred packet in [`../job-detail-view-simplification/spec.md`](../job-detail-view-simplification/spec.md).
**Last updated:** 2026-09-09

## Outcome

A solo tradesperson can capture work in the field without choosing a job first, create a job with only a title when that is enough, process unassigned captures from Inbox, and run a Live Session that captures notes/materials and fixes job identity without nested Edit or Done. Every surface reuses the same Edit-mode row chrome already built for Job Detail Edit.

## Purpose (this release)

1. **Inbox** — viewing surface for unassigned quick captures. Tap = edit; **Add to job** is explicit; swipe to delete. Assign removes the item from Inbox; user stays in Inbox to process a pile.
2. **New Job** — Todoist/Reminders-style expandable composer. Title required; **Add Job** creates immediately and opens Job View. No default `Untitled Job`, no insert-then-Edit, no abandoned empty rows.
3. **Quick Note / Quick Material** — minimum info → Save → Inbox only. No job or session chooser at capture time.
4. **Live Session** — Job View start tile when allowed; overlay is the capture surface with immediate persist for notes, materials, start time, and job identity (title/description, customer, address, revenue). No nested Job Edit, no second **Done**.

## Approved decisions

- **One spec, one UI flag gate:** all Phase 3 surfaces, including the expanded Live Session overlay, are behind existing `job-detail-fullscreen-edit`. Flag off keeps today’s Untitled-Job create, Inbox tap-to-assign, Quick Material qty+unit-cost save gate, and the legacy live overlay (header **EDIT**, expandable session card, add tiles, nested sheets). The successful end-session destination remains Job View in either state.
- **New Job composer** (Jobs FAB, primary **+ → New Job**, Home empty first-job — same surface):
  - Compact: title field (placeholder `Job title`, 60-char max). **No** prefilled `Untitled Job`. Typed `Untitled Job` is allowed.
  - Blank title: **Add Job** disabled.
  - **Add details** creates the titled job, then opens fullscreen Job Edit for customer, address, revenue, description, and child rows. It does not expand the composer or persist a blank job first.
  - **Add Job** (not Save) creates the job with the typed title, applies optional composer children in one follow-up when present, then opens **Job View** (not Edit).
  - Dismiss without **Add Job**: nothing persisted, no list row, no discard dialog.
  - Composer does **not** start a Live Session.
- **Quick capture:** Quick Note / Quick Material open their capture form directly. Minimum → Save → Inbox (`job_id` and `session_id` null). No job/session chooser. Material is **description + total** minimum; qty, unit price, and UOM are opt-in (total-first, same as Job Edit).
- **Inbox:** Notes / Materials tabs (as today). Row tap opens edit composer (same chrome as quick capture). Explicit **Add to job** opens job picker; assign is **job only** (no session picker). After assign, stay in Inbox. Swipe to Delete with confirm (same pattern as Job View list rows). No overflow menu this phase.
- **Shared chrome:** New Job title, Quick Note body, Quick Material name+total, Inbox edit, Live overlay job-identity tiles, and Job Edit reuse [`EditFormRows.tsx`](../../../apps/mobile-expo/src/components/ds/edit-mode/EditFormRows.tsx) / [`JobDetailEditMode.tsx`](../../../apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx) patterns.
- **Live Session — View start tile:** In Sessions section when **this job has no in-progress session and the user has no live session anywhere**: `Live Session` / `Start a timer now`. Uses existing `startLiveSession` path and **closes job detail**. Hide tile on every job whenever any live session exists (minimized bar is the way back), but keep an empty job's card as `No sessions recorded` and tappable for manual entry. FAB **Live Session** remains.
- **Live Session — expanded overlay (flag on):**
  - Keep: dark timer header, elapsed counter, **Back** minimizes, minimized bar, **END SESSION**.
  - Remove: header **EDIT** (job), nested `EditJobBottomSheet`, expandable `LiveSessionCaptureCard`, session **EDIT** pill, `EditLiveSessionBottomSheet`, add-to-session **tiles**.
  - Add/replace: Job Edit tiles on the overlay body for title+long description, customer, address, revenue — **persist immediately** via `updateJobById` (per-field / debounced, not draft+Done). Blank title does not persist; last saved title remains; minimized bar follows persisted title.
  - Start date/time **in place** (tappable); persist via `updateLiveSessionStart`. **End Session** is the only end path on the overlay.
  - `Add note` / `Add material` rows (Job Edit–style); persist immediately on `createNote` / `createMaterial` attached to **this live session** (not Inbox).
  - This session’s notes/materials listed as Job View–style rows: scan, tap to edit (compact composer), swipe to delete. No chevron, no `N notes · M materials` on a session header.
  - **Not on overlay:** other costs, past sessions, confirm-none checkboxes, job `Missing:` line, Delete job, nested fullscreen Job Edit with **Done**.
  - Live writes do **not** use `apply_job_detail_edit`.
- **Deleting a running live session** is not a primary overlay action. **End Session** keeps the ended session on the job. Hard-delete of a live session stays off the overlay (ended sessions deletable from Job View/Edit swipe as today).

## Scope

- Surfaces: Inbox, New Job composer, FAB Quick Note/Material, Job View Live start tile, Live Session overlay + minimized bar.
- Depends on: Phase 1 Edit ([`../job-detail-edit/spec.md`](../job-detail-edit/spec.md)), Phase 2 View ([`../job-detail-view-simplification/spec.md`](../job-detail-view-simplification/spec.md)).
- Flag: `job-detail-fullscreen-edit` (same as Phase 1/2).

## Product requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| REQ-F01 | Flag on: Phase 3 surfaces use the new behavior in this spec. | TEST-F01 |
| REQ-F02 | Flag off: Untitled-Job create + `initialEditOpen`, Inbox tap-to-assign, legacy Quick Material save gate, and legacy live overlay remain. | TEST-F02 |
| REQ-N01 | Flag on: New Job composer does not prefill `Untitled Job`; blank title disables **Add Job**. | TEST-N01 |
| REQ-N02 | Flag on: **Add Job** creates a job with the typed title and opens Job View. Optional composer children persist with create (no blank-row insert first). | TEST-N02 |
| REQ-N03 | Flag on: Dismiss composer without **Add Job** leaves no job row. | TEST-N03 |
| REQ-N04 | Flag on: **Add details** creates the titled job and opens fullscreen Job Edit; the compact composer does not expand. | TEST-N04 |
| REQ-Q01 | Flag on: Quick Note saves non-blank body to Inbox with no job/session chooser. | TEST-Q01 |
| REQ-Q02 | Flag on: Quick Material saves description + total to Inbox; qty/unit price optional; no job/session chooser. | TEST-Q02 |
| REQ-I01 | Flag on: Inbox row tap opens edit; does not open assign sheet. | TEST-I01 |
| REQ-I02 | Flag on: Explicit **Add to job** assigns to chosen job only; user stays in Inbox; item disappears from list. | TEST-I02 |
| REQ-I03 | Flag on: Inbox swipe-to-delete with confirm removes unassigned item. | TEST-I03 |
| REQ-L01 | Flag on: Job View shows Live start tile when this job has no in-progress session and user has no live session anywhere; copy per UX contract. | TEST-L01 |
| REQ-L02 | Flag on: Live start tile hidden when any live session exists. | TEST-L02 |
| REQ-L03 | Flag on: Starting live from View tile uses existing start path and closes job detail. | TEST-L03 |
| REQ-L04 | Flag on: Live overlay has inline job identity tiles (title/description, customer, address, revenue) that persist immediately without **Done**. | TEST-L04 |
| REQ-L05 | Flag on: Live overlay `Add note` / `Add material` persist immediately to this session. | TEST-L05 |
| REQ-L06 | Flag on: Live overlay lists this session’s notes/materials as flat rows; tap edit, swipe delete; no session expand chrome. | TEST-L06 |
| REQ-L07 | Flag on: Start time editable in place on overlay; no `EditLiveSessionBottomSheet`. **End Session** ends session and opens the ended session’s Job View. | TEST-L07 |
| REQ-L08 | Flag on: No header **EDIT**, nested `EditJobBottomSheet`, or second **Done** on live overlay. | TEST-L08 |
| REQ-S01 | Flag on: Quick capture, Inbox edit, New Job, and Live job tiles reuse shared Edit-mode row components. | TEST-S01 |

REQ-V06 and REQ-V14 from Phase 2 map to REQ-L01–REQ-L08 here.

## Artifact manifest

| Artifact | Applicability | Path or inline section | Rationale |
|---|---|---|---|
| State model | Required | [state-model.md](state-model.md) | Composer draft, Inbox assign, live expanded/minimized, immediate persist |
| Data contract | Required | [data-contract.md](data-contract.md) | Create-with-title, Inbox assign, live APIs, no apply from live |
| UX contract | Required | [ux-contract.md](ux-contract.md) | Composer, Inbox, quick capture, overlay copy and interaction |
| Test contract | Required | [test-contract.md](test-contract.md) | Flag, capture, Inbox, live, shared chrome |

## Product constraints

- Brand: field-speed capture now, organize later; consumer-grade composers; same honest missing-data rules as Phase 1/2.
- Security: owner-only writes; Inbox items are `job_id IS NULL AND session_id IS NULL`; assign sets `job_id` only.
- Financial: live overlay may set `revenue_cents` immediately; confirm-none timestamps are **not** on the overlay (Job Edit only).
- Free-tier: no new paid vendor; reuse existing CRUD + `apply_job_detail_edit_atomic` only for composer children at create; live uses per-row APIs.
- Compatibility: flag off retains the legacy Phase 3 flows, including the legacy Live Session overlay. Flag on requires a mobile build that implements Phase 3; no DB migration is required for core behavior (the optional `createJobForCurrentUser` helper is additive).

## Acceptance scenarios

- Given flag on, when the user opens New Job, types a title, and taps **Add Job**, then a job exists with that title and Job View opens — no `Untitled Job` was inserted first.
- Given flag on, when the user dismisses the composer without **Add Job**, then the jobs list is unchanged.
- Given flag on, when the user saves a Quick Material with description and total only, then it appears in Inbox and was not assigned to a job.
- Given flag on, when the user taps an Inbox note, then they edit the body; assign happens only after **Add to job**.
- Given flag on and no live session, when the user opens Job View and taps the Live start tile, then a live session starts and job detail closes.
- Given flag on and a live session, when the user changes customer on the overlay, then `jobs.customer_name` updates without tapping **Done**.
- Given flag on, when the user adds a note on the live overlay, then it appears in the session list immediately and is attached to the live session.
- Given either flag state, when the user ends a live session, then its Job View opens with the ended session visible.
- Given flag off, when the user taps New Job, then behavior matches pre–Phase 3 (Untitled Job + Edit).

## Agent-decided assumptions

- **Add Job** with only a title: single insert with `short_description` = typed title (new `createJobForCurrentUser` or equivalent); no `createBlankJobForCurrentUser`.
- **Add Job** with composer children: insert job, then one `apply_job_detail_edit_atomic` with creates only (identity fields from composer merged into apply payload or pre-written via `updateJobById` before apply — implementation chooses one path; both must be atomic from the user’s perspective).
- Live job-identity persist: debounce ~500ms on text fields; immediate on blur; revenue persists on field commit; reject blank title patches.
- Inbox **Add to job** uses existing `ChooseJobBottomSheet`; assign via `updateNote` / `updateMaterial` with `{ jobId, sessionId: null }`.
- Inbox edit uses the same bottom-sheet shell as quick capture, with **Add to job** and Save actions on the sheet footer when editing an existing item.
- Live note/material edit from list reuses quick-capture composers scoped to the session parent.
- Phase 2 `REQ-V06` / `REQ-V14` reserved IDs are fulfilled by REQ-L01–REQ-L08 in this spec.

## Non-goals

- Customers table, customer Inspect, `customer_id`.
- Invoice/receipt CTAs.
- Insights/recos on View or overlay.
- Inbox assign to session (job only).
- Photos / full note Inspect.
- Other costs, past sessions, confirm-none, `Missing:` health line, or Delete job on the live overlay.
- Nested fullscreen Job Edit with **Done** on Live Session.
- Live Session start from the New Job composer.
- Flag 100% rollout / deleting legacy sheets (separate release decision).

## Deferred work

- Inbox overflow menu (swipe-only delete is enough this phase).
- Inbox → session assign on **Add to job**.
- Hard-delete running live session from overlay.
- Retire `job-detail-fullscreen-edit` flag and delete unused legacy components.

## Open blockers

- None
