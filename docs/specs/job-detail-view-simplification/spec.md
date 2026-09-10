# Job Detail View

**Status:** Approved product spec
**Feature source:** Phase 2 — make Job View a consumer-grade scan/read/act surface. (Replaces the subtraction-only draft of this folder.)
**Last updated:** 2026-09-08

## Outcome

Job View tells the truth about a job at a glance — status, what’s missing, what’s on it — and makes the next action obvious. Reading does not require Edit. Mutating job records still commits on Edit **Done**.

## Purpose (this page)

1. **Health** — not only the status pill. Same job-level `Missing:` line as Open Jobs incomplete cards, plus per-row missing when a session/material/other cost cannot count yet.
2. **Scan and read** — cards, metrics, profit snapshot, expandable read-more on **truncated notes only**. Future insights/recos can join this column. Customer is an entry point (this phase: tap → Edit).
3. **Act** — financially complete, change status, whole-job Edit, edit an existing item. Invoice/receipt are reserved slots, not built here. Live Session start from View is **Phase 3**; FAB Live Session stays as today.
4. **Inbox, quick capture, Todoist job add, and Live Session** — same viewing/minimum-save and capture-while-running principles, **Phase 3** (not this phase).

## Approved decisions

- Shared **header chrome** with Edit: `PlatformHeaderAction` **X** (same slot as [`JobDetailEditMode.tsx`](../../../apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx)), trailing pill **EDIT** / **Done** in the same geometry. **Fade** View body ↔ Edit body under that chrome (X does not jump).
- **Expand is read, not mutate — notes only.** Collapsed rows stay scannable. Session rows are **flat** (not expandable): date, start–end time, duration, and missing line when applicable — no note/material counts and no attachment list on the card. Truncated notes use a chevron to reveal the full body read-only. Expanded note panels do **not** contain ADD tiles or an EDIT pill. Mutate via row tap (session, note excerpt, material/other cost) or header **EDIT**.
- Customer card on View shows **name and service address** (`jobs.service_address`; omit the address line when blank). Tap name → Edit focused on customer (Customers table later).
- Remove section **ADD** pills and confirm-none **cards** from View (flag on). Confirm-none is an Edit checkbox under Add material / Add other cost, plus Confirm no revenue on the revenue tile. Checkboxes show when there are no **usable** rows (stubs allowed) and are not cleared on Add until a usable row exists.
- Job-level `Missing: revenue, sessions, materials, costs` uses the same pill vocabulary as [`incompletePillsFor`](../../../apps/mobile-expo/src/screens/JobsScreen.tsx). Untitled Job / blank-name is **not** a `description` pill — `Untitled Job` is a valid title.
- Row-level missing uses capture-now placeholders (no duration, no date, no material description, no total, no cost type/amount) so partial Phase 1 rows are honest.
- Live Session: **unchanged this phase.** FAB start and the existing overlay/sheets stay. Do **not** add a dedicated View start tile. Do **not** redesign expanded live capture (inline add note/material, start time in place). Flag on removes session ADD, so the New Session chooser’s Live tile is gone from View until Phase 3.
- Complete wizard: all gaps (including materials/other costs confirm-none) open scoped Edit after minimum-info confirm. The revenue gap always opens scoped **revenue** Edit (no title vs revenue split). Mark Completed ends any live in-progress session for this job first.
- Flag off: Phase 1 View + sheets unchanged (including session ADD → Live vs past chooser).
- Inbox edit/delete/assign, Todoist new job, Quick Note/Material UX, and Live Session View/overlay work are **out**; principles recorded under Deferred.

## Scope

- Surfaces: Job View (flag on), Complete gates.
- Depends on: Phase 1 Edit ([`../job-detail-edit/spec.md`](../job-detail-edit/spec.md)).
- Not in this release: Inbox, Live Session start tile or overlay redesign, invoices, customer records, insights copy, photo inspect.

## Product requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| REQ-V01 | Flag on: no section ADD pills. | TEST-V01 |
| REQ-V02 | Flag on: truncated **note** expand is read-only (Show More / Show Less). **Sessions** are a single multi-row white card (not expandable). No session chevron, EDIT pill, or add-to-session tiles on View. | TEST-V02 |
| REQ-V03 | Flag on: empty materials/other costs have no confirm/undo cards. | TEST-V03 |
| REQ-V04 | Flag on: View does not open job item add/edit sheets. | TEST-V04 |
| REQ-V05 | Mutate: header EDIT → full Edit. View section cards, customer/address, earnings summary → **scoped** Edit (only the matching white tile(s)). Time/net/sessions metrics are read-only. Status CTA does not open Edit. | TEST-V05 |
| REQ-V07 | Complete addable gaps open Edit after minimum-info confirm. Edit discard cancels wizard. | TEST-V07 |
| REQ-V08 | Materials/other-costs confirm-none is an Edit checkbox (below Add); Complete wizard opens that scoped Edit card. | TEST-V08 |
| REQ-V09 | Flag off: Phase 1 View unchanged. | TEST-V09 |
| REQ-V10 | `focusTarget` scrolls Edit to the section/row. | TEST-V10 |
| REQ-V11 | Shared X + trailing pill placement with Edit; View↔Edit **crossfade** of body (header stays). | TEST-V13 |
| REQ-V12 | Job View shows `Missing: …` when incomplete, same tokens as the Open Jobs card. | TEST-V14 |
| REQ-V13 | Rows that are not yet countable show critical empty placeholders in error color (session date/duration; material description/total; other cost type/amount). Optional fields (session times, material qty breakdown) are omitted when empty — no duplicate missing line. | TEST-V15 |

REQ-V06 (View Live Session start tile) and REQ-V14 (live expanded capture) are reserved for Phase 3.

## Artifact manifest

| Artifact | Applicability | Path or inline section | Rationale |
|---|---|---|---|
| State model | Required | [state-model.md](state-model.md) | Wizard vs job Edit draft |
| Data contract | Required | [data-contract.md](data-contract.md) | Completeness display vs persist |
| UX contract | Required | [ux-contract.md](ux-contract.md) | Chrome, expand-to-read, health, actions |
| Test contract | Required | [test-contract.md](test-contract.md) | Flag, wizard, fade, health |

## Product constraints

- Completeness no longer treats Untitled Job / blank-name as a gap. Title is required at create/edit persist; Untitled Job is a real title. Revenue is complete when `revenueCents > 0` **or** confirm-no-revenue (`no_revenue_confirmed_at`). Unconfirmed $0 displays as `—`. A live in-progress session counts as a session.
- Do not route Live Session writes through `apply_job_detail_edit`. Overlay capture stays on existing APIs, unchanged this phase.
- Fade/chrome are Expo animation; no new paid dependency (`Animated` already used).
- Invoice/receipt: leave space in the CTA story; do not build.

## Acceptance scenarios

- Given View and Edit, when the user taps EDIT then Done, then X stays put and the body fades.
- Given an incomplete job, when View opens, then `Missing: revenue, sessions` (example) matches the Open Jobs card.
- Given a session on View, when the row is shown, then it displays date, start–end time, duration, and missing line only — not `N notes · M materials`, no chevron, and no attachment list.
- Given a job with a service address, when View opens, then the customer card shows the name and that address.
- Given a truncated note, when they expand it with the chevron, then the full body is readable on View without an EDIT link in the expanded panel.
- Given flag on, when they want a live timer, then FAB Live Session still starts it; View has no new Live Session tile and the overlay is still today’s sheet.

## Agent-decided assumptions

- **Chevron expands truncated notes only** (read-only). Session row tap opens job Edit. Materials/other costs with nothing to disclose: whole row → Edit.
- Job `Missing:` copy: `Missing: ${pills.join(', ')}` with pills `revenue`, `sessions`, `materials`, `costs`.
- Row missing copy: reuse/adapt `JOB_DETAIL_EMPTY_LABELS` plus `No total` / `No amount` as needed.
- Shared header host in `JobDetailScreen`; do not animate X between two different layouts.
- Blank service address omits the address line (existing `JobDetailJobHeader`). Last-worked on the header stays as today.

## Non-goals

- Full-screen note/photo Inspect (expand-in-place is enough for notes now).
- Further completeness formula changes beyond live sessions, Untitled Job as a valid title, and confirm-no-revenue.
- Inbox, Todoist new job, Quick Note/Material **UX**, View Live Session start tile, and live overlay redesign (Phase 3 — see Deferred). Customers table, Share/invoice.
- Nested Edit mode on Live Session.

## Deferred work

- **Phase 3 — Inbox, quick capture, Todoist job add, and Live Session** (one spec, after this View phase). Same scan/act idea as Job View:
  - **Inbox:** viewing surface for unassigned captures. Tap = edit the note/material; **Add to job** is explicit; delete via swipe or overflow. Not “tap only assigns.”
  - **New job:** Todoist-style. A non-blank title is enough to save (`Untitled Job` is a valid title; blank titles are rejected). Optional control to add more (opens Job Edit / remaining fields). Abandoned empty drafts are not left on the jobs list.
  - **Quick Note / Quick Material:** keep direct Inbox save (no job chooser — already Phase 1). UX matches the same minimum-to-save rule: note body enough to save; material description + total enough to save; extra fields (session, qty, unit price) only if they choose to add more.
  - **Live Session:** dedicated View start tile when this job has no in-progress session (`Live Session` / `Start a timer now`; start uses existing path and closes job detail). Expanded live sheet is the capture surface: Edit-style `Add note` / `Add material` rows that persist immediately; start time editable in place; End Session remains; no nested job-Edit mode and no second Done. Writes use existing note/material create and start-time APIs, not `apply_job_detail_edit`.
- Customers Inspect; invoice/receipt actions in the CTA row.
- Insights/recos modules on View.
- Flag 100% / delete unused sheets.

## Open blockers

- None
