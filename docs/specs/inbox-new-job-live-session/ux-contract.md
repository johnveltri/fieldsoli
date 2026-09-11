# Inbox, New Job, Quick Capture, Live Session UX Contract

## User and context

- Primary user: solo tradesperson capturing work between jobs or while a timer runs.
- Field context: interrupted mobile use; one-handed capture; minimum fields first.
- Entry points: Jobs FAB / primary **+ → New Job**, Home empty CTA, FAB Quick Note/Material, Jobs header Inbox, Job View Live start tile, FAB Live Session, minimized live bar.
- Successful exit: job created and viewed; capture in Inbox; Inbox item assigned or deleted; live session ended with captures on the job.

## Primary journeys

| Step | Surface | User action | System response | Next |
|---:|---|---|---|---|
| 1 | Shell | Tap New Job (flag on) | Expandable composer opens over Jobs/Home | Composer compact |
| 2 | Composer | Type title; optional expand | More Job Edit tiles appear | Composer expanded |
| 3 | Composer | **Add Job** | Create job; open Job View | Job View |
| 4 | Shell | Quick Note | Body sheet; Save | Inbox |
| 5 | Inbox | Tap note | Edit sheet with Save + **Add to job** | Inbox |
| 6 | Inbox | **Add to job** → pick job | Item leaves Inbox | Inbox |
| 7 | Job View | Tap Live start tile | Start session; close detail | Minimized bar |
| 8 | Live overlay | Add note / edit title / End | Immediate persist | Job View after end |

## Surface-state matrix

| Surface | Loading | Empty | Ready | Saving | Success | Error/retry |
|---|---|---|---|---|---|---|
| New Job composer | — | Title empty; **Add Job** disabled | Compact or expanded draft | **Add Job** spinner | Job View | Alert; stay on composer |
| Quick Note | — | Save disabled | Body field | Save spinner | Sheet closes → Inbox | Alert; stay |
| Quick Material | — | Save disabled until description+total | Fields + optional breakdown | Save spinner | Sheet closes → Inbox | Alert; stay |
| Inbox | List spinner | Tab empty copy | Grouped list | Assign spinner | Item removed / updated | Inline or alert |
| Live overlay | Job detail fetch | No captures yet | Timer + tiles + list | Field/capture spinner | Minimized or ended | Alert per action; retry |

## Interaction rules

### New Job composer (flag on)

- Presents as a bottom sheet or keyboard-anchored composer (Todoist/Reminders feel): title field focused on open.
- Primary action label: **Add Job** (never **Save** on this surface).
- **Add Job** disabled when title is blank (whitespace-only).
- Expand affordance (+ or chevron): reveals Job Edit white tiles below title — customer, address, revenue, long description, Add session / material / other cost / note — using the same row components as [`JobDetailEditMode.tsx`](../../../apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx).
- Collapse hides tiles but retains draft values.
- Scrim tap / swipe down / close: dismiss without persist (no confirm).
- Does not offer Live Session start.

### Quick Note / Quick Material (flag on)

- Open directly from FAB; no job or session picker.
- Quick Note: single body field; Save requires non-blank body.
- Quick Material: description + total required; qty, unit price, UOM visible as optional breakdown (total-first); Save disabled until description and valid total.
- Success: close sheet; item appears in Inbox; optional toast not required.

### Inbox (flag on)

- Header **INBOX** with back; Notes / Materials tabs (existing chrome).
- Row tap: open edit sheet (not assign sheet).
- Edit sheet footer: **Save** (update) and **Add to job** (secondary or equal prominence).
- **Add to job**: `ChooseJobBottomSheet`; on select, assign and close picker; remain on Inbox; remove row.
- Swipe row left: reveal **Delete**; system confirm; soft-delete.
- Empty tab: existing empty copy (unchanged unless noted below).

### Job View Live start tile (flag on)

- Location: Sessions section when list empty or above empty card — single tappable card.
- Visible only when this job has no `in_progress` session **and** `hasLiveSession` is false globally.
- Hidden when any live session exists (user uses minimized bar).
- Tap: start live session; close job detail modal/overlay.

### Live overlay (flag on)

- Header: dark slab, **Back** (minimize), **ACTIVE SESSION** pill, elapsed timer. Job title shown from **persisted** `short_description` (updates after identity save). **No** header **EDIT**.
- Body scroll order (top → bottom):
  1. **Started** — tappable date/time row; edit in place; no separate Edit Live Session sheet.
  2. **Job** — white tiles: title + long description (one tile), customer, address, revenue. Same fields as Job Edit; changes persist immediately (debounced text, commit on blur).
  3. **Capture** — `Add note`, `Add material` rows (Edit Add-row style).
  4. **This session** — flat list of notes (excerpt + date) and materials (name + amount); tap → compact edit sheet; swipe → delete with confirm.
  5. **END SESSION** — full-width destructive primary at bottom.
- No expandable session card, no chevron on session, no `N notes · M materials` summary line, no add tiles grid, no nested `EditJobBottomSheet`, no **Done**.
- Minimized bar: job title (persisted), timer, tap to expand.
- End Session: confirm if needed (use existing copy); navigate/refresh per parent (`onSessionEnded`).

### Flag off

- Legacy New Job (Untitled insert + Edit), Inbox tap-to-assign, legacy Quick Material validation, legacy live overlay — unchanged.

## Navigation and continuity

- New Job success → Job View (`initialEditOpen: false`).
- Quick capture success → user stays on current tab; Inbox badge updates.
- Live start from View → job detail closes; bar visible on shell.
- Live end → refresh open Job Detail if same job; else list refresh only.
- App background: composer draft lost on kill; live session persists on server.

## Responsive and platform behavior

- Phone portrait primary; composer respects keyboard and safe area.
- Live overlay `autoSizeUpToFraction` ~0.98; inner scroll when content exceeds cap.
- Reduced motion: no required composer animation; live bar morph may simplify.
- Android hardware back: composer dismiss; live minimize matches existing overlay stack rules.

## Accessibility

- **Add Job**: `accessibilityLabel` **Add job**; disabled when title blank announced.
- Inbox swipe delete: expose delete accessibility action on row.
- Live **END SESSION**: destructive role/label.
- Identity fields: same labels as Job Edit (`Job title`, `Customer`, `Address`, `Revenue`).
- Timer: live region or periodic announcement optional (not blocking).

## Visual and component quality

- Reuse Edit-mode white tiles, Add rows, and field inputs from Phase 1 Edit.
- Composer: consumer-grade, compact first frame; expanded state grows naturally (not a second fullscreen Edit).
- Live overlay: aligned with Phase 2 View list density — flat rows, no legacy session accordion chrome.
- Minimized bar: unchanged morph animation where possible.

## Content and copy

| ID | Surface/state | Purpose | Exact text | Variables/fallback |
|---|---|---|---|---|
| UX-C01 | Composer title | Placeholder | `Job title` | — |
| UX-C02 | Composer primary | Create | `Add Job` | — |
| UX-C03 | Composer expand | Reveal more | `Add details` or `+` icon with a11y **Add job details** | Implementation may use icon-only if labeled |
| UX-C04 | Composer error | Create failed | `Couldn't add this job. Try again.` | — |
| UX-Q01 | Quick Note placeholder | Hint | `Note` | Match existing sheet if shorter |
| UX-Q02 | Quick Material | Description | `Description` | — |
| UX-Q03 | Quick Material | Total | `Total` | `$` prefix as today |
| UX-I01 | Inbox empty notes | Empty | `All caught up! No unassigned notes.` | Keep existing |
| UX-I02 | Inbox empty materials | Empty | `All caught up! No unassigned materials.` | Keep existing |
| UX-I03 | Inbox edit | Assign | `Add to job` | — |
| UX-I04 | Inbox delete confirm | Title | `Delete this item?` | — |
| UX-I05 | Inbox delete confirm | Body | `This cannot be undone.` | — |
| UX-I06 | Inbox assign error | Failure | `Couldn't add to job. Try again.` | — |
| UX-L01 | View start tile | Title | `Live Session` | — |
| UX-L02 | View start tile | Subtitle | `Start a timer now` | — |
| UX-L03 | Live overlay | Started row | `Started` | Value: formatted date + time |
| UX-L04 | Live capture | Add note | `Add note` | Same as Edit UX-21 |
| UX-L05 | Live capture | Add material | `Add material` | Same as Edit UX-19 |
| UX-L06 | Live footer | End | `END SESSION` | Keep existing casing |
| UX-L07 | Live identity error | Patch failed | `Couldn't update this job. Try again.` | — |
| UX-L08 | Live capture error | Note/material | `Couldn't save. Try again.` | — |
| UX-L09 | Live header | Status | `ACTIVE SESSION` | Existing |
| UX-L10 | Live minimize | Back | `Back` | Minimizes |

- Canonical verbs: **Add Job**, **Add to job**, **Add note**, **Add material**, **End session** (button **END SESSION**).
- Terms to avoid on composer: **Save** (primary), **Untitled Job** (prefill), **Done** (live overlay).
- Error → recovery: alerts above; user retries same action; no stack traces.

## Analytics and observability

- Extend existing: `job_create_started` / `job_created` with `source` and `placeholder: false` for composer path.
- `inbox_item_selected` → distinguish `action: edit` vs legacy `assign`.
- `inbox_item_assigned_to_job` (existing).
- `live_session_started` `source: job_detail` for View tile.
- `note_created` / `material_created` with `parent_type: live_session` on overlay capture.
- Optional: `job_composer_expanded` when user reveals tiles.

## Verification obligations

- TEST-N01–N04, TEST-Q01–Q02, TEST-I01–I03, TEST-L01–L08, TEST-S01, manual keyboard/safe-area on composer and live overlay.
