# Job Detail View UX Contract

## User and context

Scan a job’s health and contents; read without editing; act (status, complete, Edit). Live Session stays the current FAB + overlay this phase.

## Primary journeys


| Step | Surface | Action                                 | Response                                                    |
| ---- | ------- | -------------------------------------- | ----------------------------------------------------------- |
| 1    | View    | Open job                               | Shared X + **EDIT**; body is View; `Missing:` under status CTA if incomplete |
| 2    | View    | Tap **EDIT**                           | Body fades to Edit; **Done** in the pill slot; X stays      |
| 3    | View    | Chevron on truncated note       | Expand full note body (read-only)                           |
| 4    | View    | Tap session row / Edit control / material row / customer | Fade to Edit, focused                       |
| 5    | View    | Complete                               | End live session if in progress → minimum-info → scoped Edit; revenue gap always opens revenue Edit (not title); commit pill is **Next** while more gaps remain, **Done** on the last gap (then marks complete) |


Live Session start from View and expanded live capture (add note/material, start time) are Phase 3. FAB Live Session and today’s overlay remain.

## Chrome and motion

- Header matches Edit: left `PlatformHeaderAction` X (`accessibilityLabel` **Close** — same as current Edit implementation), right pill **EDIT** (`Brand/Primary` or current EDIT styling) vs Edit’s **Done**.
- **Shared header**; View and Edit bodies crossfade (~200–300ms, respect reduced motion → hard cut).
- X never changes meaning: View X closes job detail; Edit X/Back behavior stays Phase 1 **discard** (implementation today labels it Close and calls `onBack`). Do not close the job when discarding Edit.



## Expand vs Edit (read vs mutate)


| Card                  | Collapsed                              | Expand                 | Mutate                                           |
| --------------------- | -------------------------------------- | ---------------------- | ------------------------------------------------ |
| Title / description   | Title (display) + optional long description (body) | None | Tap either → scoped Title Edit (title + description) |
| Sessions (one white card) | Rows: date, start–end, duration, missing | None               | Row tap → scoped Sessions Edit; swipe → Delete |
| Notes (one white card) | Excerpt (up to 4 lines) + date       | Show More / Show Less  | Row tap → scoped Notes Edit; swipe → Delete |
| Materials / other costs | Name, amount, missing line           | None                   | Row tap → scoped section Edit; swipe → Delete |
| Customer / address    | Name + address in header               | None                   | Tap → scoped Customer Edit (name + address only) |
| Earnings              | Summary card (revenue / materials / costs / net) | None | Tap → scoped Edit: Revenue + Materials + Other Costs |
| Metrics               | Time / net/hr / sessions               | None                   | Not clickable                                        |

Header **EDIT** opens full Edit (all white tiles). Scoped Edit still uses Done / X (discard) and can Add rows within the visible section(s); Done persists the full job draft.

On Edit, title + long description share one white tile; customer + address share one white tile; revenue is its own white tile. Title and long description are both multiline (Return inserts a newline; text wraps and the field grows like a note). Title has a **60-character** max.

**Swipe to delete (View):** Swipe a session, material, other-cost, or note row to reveal Delete; confirm soft-deletes immediately and refreshes the job.

## Health

- Directly under the status primary CTA (Mark Completed / equivalent), if pills nonempty: `Missing: ${pills.join(', ')}` — same style intent as Job Card incomplete line.
- Row missing: one secondary line, not a blocking modal.



## Actions (clear)

- Close job, **EDIT**, status primary + more, Complete (via status), Edit-on-item, swipe-delete on View list rows.
- Live Session: FAB + existing overlay only this phase. No dedicated View start tile.
- **Not this phase:** Share, invoice, receipt — CTA row may remain as today; do not add fake buttons.



## Empty and Complete copy

Keep UX-V01..V17 from the prior packet **except** the dedicated Live start tile (`Live Session` / `Start a timer now` on View). Keep empty lists and minimum-info. Confirm-none copy lives on Edit (checkbox under Add material / Add other cost, and Confirm no revenue on the revenue tile). Live start-tile copy is Phase 3 (with REQ-V06).

Add:


| ID     | Surface               | Exact text                                               |
| ------ | --------------------- | -------------------------------------------------------- |
| UX-V18 | Job health            | `Missing: {list}` (`revenue`, `sessions`, `materials`, `costs`) |
| UX-V23 | Edit / View materials | `Confirm no materials` / `No materials confirmed` |
| UX-V24 | Edit / View other costs | `Confirm no other costs` / `No other costs confirmed` |
| UX-V25 | Edit / View revenue | `Confirm no revenue` / `No revenue confirmed` |

UX-V19 (`{n} notes · {m} materials` on the collapsed session) is **withdrawn**. Session cards do not summarize attachments; use Materials / Other costs / Notes sections for session-scoped items.

UX-V20 (`Edit` on expanded session/note) is **withdrawn** for View. Notes expand read-only; mutate via tap on the collapsed excerpt or header **EDIT**.


UX-V21 `Add note` and UX-V22 `Add material` on the live overlay are Phase 3.

## Inbox, Quick capture, New job, Live Session (not this phase — Phase 3)

- Inbox is a View of unassigned captures: tap = edit; **Add to job** is explicit; delete is swipe or overflow.
- New job is Todoist-style: title is enough to save; more fields are opt-in (Job Edit).
- Quick Note / Quick Material stay Inbox-bound (no job picker). Save on the minimum (note body; material description + total); more fields are opt-in.
- Live Session: View start tile when this job has no in-progress session; expanded overlay is the capture surface (start time in place, Edit-style add-rows, immediate persist, End Session, no nested job Edit / Done). Item tap may keep existing live note/material sheets unless inline edit is cheaper.



## Accessibility

- Chevron on truncated notes: expand/collapse read-only body. Session rows: tap opens Edit (no chevron).
- Fade: not the only cue; Edit still has Done.
- Reduced motion: skip crossfade.



## Visual quality

- View stays a **composed** layout (header card, earnings, metrics, lists) — not Edit’s field rows.



## Analytics

- `job_edit_opened` sources: `header`, `view_row`, `view_empty`, `complete_wizard`, `customer`.
- Existing live start/end/note/material events stay; no new live-capture events this phase.



## Verification

TEST-V02, TEST-V05, TEST-V11–V15.