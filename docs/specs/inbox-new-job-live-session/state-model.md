# Inbox, New Job, Quick Capture, Live Session State Model

## Scope

- New Job composer draft (in-memory until **Add Job**).
- Quick capture sheets (note/material) and Inbox edit flows.
- Inbox assign picker.
- Live Session overlay (`LiveSessionContext` modes) with immediate persist for capture and job identity.
- Job Detail Edit draft states remain in [`../job-detail-edit/state-model.md`](../job-detail-edit/state-model.md). Live overlay does **not** enter Edit draft / **Done** commit.

## State definitions

| ID | State | Meaning | Persisted or derived | Terminal? |
|---|---|---|---|---|
| STATE-C01 | ComposerClosed | No New Job composer visible | Derived | No |
| STATE-C02 | ComposerCompact | Title field + **Add Job** (+ expand affordance) | Derived | No |
| STATE-C03 | ComposerExpanded | Additional Job Edit tiles visible in composer | Derived | No |
| STATE-C04 | ComposerCommitting | **Add Job** in flight | Derived | No |
| STATE-Q01 | QuickCaptureIdle | No quick capture sheet | Derived | No |
| STATE-Q02 | QuickNoteEditing | Quick Note or Inbox note edit sheet open | Derived | No |
| STATE-Q03 | QuickMaterialEditing | Quick Material or Inbox material edit sheet open | Derived | No |
| STATE-Q04 | QuickCaptureSaving | Create/update note or material in flight | Derived | No |
| STATE-I01 | InboxReady | Inbox list loaded | Derived | No |
| STATE-I02 | InboxAssignPicker | Choose job sheet open for one item | Derived | No |
| STATE-I03 | InboxAssigning | Assign write in flight | Derived | No |
| STATE-L01 | LiveHidden | No live session for user | Derived | No |
| STATE-L02 | LiveExpanded | Full live overlay sheet visible | Derived | No |
| STATE-L03 | LiveMinimized | Minimized bar visible | Derived | No |
| STATE-L04 | LiveEnding | End session in flight | Derived | No |
| STATE-L05 | LiveIdentitySaving | Job identity patch in flight from overlay | Derived | No |
| STATE-L06 | LiveCaptureSaving | Note/material create/update/delete in flight | Derived | No |

Presentation-only: Inbox tab selection, composer keyboard focus, debounced identity field dirty indicator.

## Events

| Event | Initiator | Preconditions | Idempotency |
|---|---|---|---|
| OpenComposer | User | Flag on; entry from Jobs FAB / primary New Job / Home empty | — |
| ExpandComposer / CollapseComposer | User | ComposerCompact or ComposerExpanded | Toggle |
| DismissComposer | User | Composer not Committing | — |
| CommitComposer (Add Job) | User | Non-blank title; not Committing | Retry safe if create idempotent by client request id (optional) |
| OpenQuickNote / OpenQuickMaterial | User | Flag on | — |
| SaveQuickCapture | User | Meets minimum fields; not Saving | Duplicate tap ignored while Saving |
| OpenInboxEdit | User | Flag on; item in Inbox | — |
| OpenInboxAssign | User | Flag on; item selected | — |
| AssignInboxToJob | User | Job picked; not Assigning | — |
| DeleteInboxItem | User | Swipe confirm | — |
| StartLiveFromView | User | Flag on; this job has no in-progress session; user has no live anywhere | Server enforces one live per user (`23505` → refetch) |
| StartLiveFromFab | User | Existing quick-actions path | Same as today |
| MinimizeLive | User | LiveExpanded | — |
| ExpandLive | User | LiveMinimized | — |
| LiveChangeJobIdentity | User/System | LiveExpanded; field valid | Debounced; blank title rejected |
| LiveChangeStart | User | LiveExpanded | `updateLiveSessionStart` |
| LiveAddNote / LiveAddMaterial | User | LiveExpanded | Immediate create |
| LiveEditCapture / LiveDeleteCapture | User | LiveExpanded; row exists | Update/delete APIs |
| EndLiveSession | User | LiveExpanded or LiveMinimized; not Ending | — |

## Transitions

**Composer**

- ComposerClosed + OpenComposer → ComposerCompact (empty draft).
- ComposerCompact + ExpandComposer → ComposerExpanded (tiles appended).
- ComposerExpanded + CollapseComposer → ComposerCompact (tiles hidden; draft retained).
- Composer* + DismissComposer → ComposerClosed (draft discarded; **no** server write).
- Composer* + CommitComposer → ComposerCommitting → ComposerClosed + navigate Job View on success; Composer* + failure → stay with error.

**Quick capture / Inbox edit**

- QuickCaptureIdle + OpenQuickNote → QuickNoteEditing.
- QuickCaptureIdle + OpenQuickMaterial → QuickMaterialEditing.
- InboxReady + OpenInboxEdit(note) → QuickNoteEditing (item id bound).
- InboxReady + OpenInboxEdit(material) → QuickMaterialEditing (item id bound).
- Quick*Editing + SaveQuickCapture → QuickCaptureSaving → InboxReady (new item) or InboxReady (updated item).
- InboxReady + OpenInboxAssign → InboxAssignPicker.
- InboxAssignPicker + AssignInboxToJob → InboxAssigning → InboxReady (item removed from list).

**Live**

- LiveHidden + StartLiveFromView / StartLiveFromFab → LiveExpanded (existing context).
- LiveExpanded + MinimizeLive → LiveMinimized.
- LiveMinimized + ExpandLive → LiveExpanded.
- LiveExpanded + LiveChangeJobIdentity → LiveIdentitySaving → LiveExpanded (refresh job title on bar).
- LiveExpanded + LiveAddNote/Material → LiveCaptureSaving → LiveExpanded (list refresh).
- LiveExpanded + EndLiveSession → LiveEnding → LiveHidden + parent refreshes job detail if open.
- View: when `hasLiveSession` globally, StartLiveFromView tile not rendered (STATE guard at UI).

## Invalid, duplicate, and concurrent events

- CommitComposer with blank title: rejected (button disabled).
- StartLiveFromView while another live exists: tile hidden; if forced via API, `23505` → alert + refetch existing live (existing behavior).
- LiveChangeJobIdentity with blank title: patch not sent; field reverts to last persisted on blur.
- SaveQuickCapture with empty note body or material without description+total: rejected (Save disabled).
- AssignInboxToJob while Assigning: ignored.
- EndLiveSession while Ending: ignored.
- Live overlay must not emit `OpenEditFromView` / Job Edit draft events.

## Interruption, retry, and recovery

- Kill during ComposerExpanded: draft lost; no job row.
- Kill during ComposerCommitting: if insert succeeded, job may exist; user sees it on reopen (acceptable orphan — rare; no auto-delete).
- Kill during QuickCaptureSaving: if create succeeded, item appears in Inbox on reopen.
- Kill during LiveExpanded: live session remains on server; overlay reopens on next launch via context refresh.
- Network loss on immediate live identity save: show error on field or banner; user retries edit; last persisted values remain authoritative.
- Minimize live overlay: in-progress text edits on identity fields should commit or revert on minimize (implementation: flush debounce on minimize).

## Invariants

- Inbox items always have `job_id IS NULL` and `session_id IS NULL` until assigned.
- Quick capture never sets `job_id` or `session_id` at create time (flag on).
- Live capture always attaches notes/materials to the active `in_progress` session id.
- Live overlay never calls `apply_job_detail_edit`.
- New Job composer never inserts `Untitled Job` as a default; only user-typed title or explicit `Untitled Job` string.
- One in-progress session per user (server index).
- Flag off: none of STATE-C*, STATE-I01–I03 new transitions, or STATE-L overlay redesign apply; legacy paths only.

## Verification obligations

- TEST-N03 (dismiss composer), TEST-I02 (assign stay Inbox), TEST-L04 (identity without Done), TEST-L05 (immediate capture), TEST-L08 (no nested Edit), TEST-F02 (flag off).
