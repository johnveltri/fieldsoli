# Job Detail Edit State Model

## Scope

- Modeled entity or process: Job Detail **Edit session** (in-memory draft over one job).
- Source of truth for current state: client while Edit is open; `public.jobs` and children after a successful Done or after Delete job.
- Persisted states: none for the draft. Job `deleted_at` and child `deleted_at` / session `session_status` remain the durable records.
- Derived states: dirty (draft differs from snapshot taken on enter).

This model does not change payment state. A newly created ended session may move `job_work_status` from `not_started` to `in_progress` only when it has an explicit calendar date and positive duration; partial undated or zero-duration sessions do not drive job status or other job-level derived state.

## State definitions

| ID | State | Meaning | Persisted or derived | Entry condition | Exit condition | Terminal? |
|---|---|---|---|---|---|---|
| STATE-01 | View | Job detail View mode; last persisted job. | Derived | Job loaded; not in Edit | User opens Edit | No |
| STATE-02 | EditPristine | Edit open; draft equals enter snapshot. | Derived | Open Edit; or restore after failed navigation | Any draft mutation → EditDirty; Back → View | No |
| STATE-03 | EditDirty | Edit open; draft differs from snapshot. | Derived | Any add/edit/remove in the draft | Done → Saving; Back → DiscardConfirm | No |
| STATE-04 | DiscardConfirm | System discard dialog over Edit. | Derived | Back while EditDirty | Cancel → EditDirty; confirm → View (snapshot discarded) | No |
| STATE-05 | Saving | Done in flight. | Derived | Done from EditDirty or EditPristine | Success → View; failure → EditDirty | No |
| STATE-06 | DeleteJobConfirm | Delete-job dialog over Edit. | Derived | User taps Delete job | Cancel → prior Edit state; confirm → deleting then leave | No |
| STATE-07 | LeftJob | Job detail closed (after delete success or user closed View). | Derived | Delete job success or View close | — | Yes for this job surface |

`EditPristine` + Done is allowed (no-op persist or skip RPC) and returns to View.

## Events

| Event | Initiator | Preconditions | Payload or evidence | Idempotency rule |
|---|---|---|---|---|
| OpenEdit | User (pencil) or system (`initialEditOpen`) | Job loaded; STATE-01 | Snapshot of `JobDetailViewModel` minus in-progress session | Ignore if already in Edit |
| MutateDraft | User | STATE-02 or STATE-03 | Field or list change | Last write wins in memory |
| BackFromEdit | User | STATE-02 or STATE-03; not Saving | — | Pristine returns to View; dirty opens DiscardConfirm |
| ConfirmDiscard | User | STATE-04 | — | Drop draft; View shows snapshot source (refetch optional) |
| CancelDiscard | User | STATE-04 | — | Back to EditDirty |
| SubmitDone | User | STATE-02 or STATE-03; not Saving | Diff vs snapshot | Disable repeat taps while Saving |
| SaveSucceeded | System | STATE-05 | Refetched job | Enter View with new snapshot |
| SaveFailed | System | STATE-05 | Error | Stay EditDirty; draft unchanged |
| AskDeleteJob | User | STATE-02 or STATE-03; not Saving | — | — |
| ConfirmDeleteJob | User | STATE-06 | — | Call `deleteJobById`; on success leave job; on failure stay in Edit and show error |
| AppKilled | System | Any Edit state | — | Draft gone; next open is View of persisted job |

## Transitions

| From | Event | Guard | To | Side effects | Failure result |
|---|---|---|---|---|---|
| View | OpenEdit | Job loaded | EditPristine | Snapshot draft; hide in-progress session | Stay View |
| EditPristine | MutateDraft | — | EditDirty | — | — |
| EditDirty | MutateDraft | — | EditDirty | — | — |
| EditPristine | BackFromEdit | — | View | Drop snapshot | — |
| EditDirty | BackFromEdit | — | DiscardConfirm | — | — |
| DiscardConfirm | ConfirmDiscard | — | View | Drop draft | — |
| DiscardConfirm | CancelDiscard | — | EditDirty | — | — |
| EditPristine or EditDirty | SubmitDone | Title non-blank | Saving | Disable Done, Back, hardware/system Back, and Delete job | Stay; title validation |
| Saving | SaveSucceeded | — | View | Refetch; invalidate job lists | — |
| Saving | SaveFailed | — | EditDirty | Show save error | Draft kept |
| EditPristine or EditDirty | AskDeleteJob | — | DeleteJobConfirm | — | — |
| DeleteJobConfirm | Cancel | — | prior Edit state | — | — |
| DeleteJobConfirm | ConfirmDeleteJob | — | LeftJob | `deleteJobById`; close detail | Stay Edit; delete error |
| Any Edit* | AppKilled | — | (process dead) | Draft discarded | Next launch View |

## Invalid, duplicate, and concurrent events

- Ignore Done taps while STATE-05.
- Ignore Back, hardware/system Back, and Delete job while STATE-05.
- Do not apply View sheet mutations to an open draft (Edit covers the fullscreen job; View lists are not visible).
- Done sends a **diff** against the enter snapshot. Rows created on the server after snapshot (for example a live session that ended) are not in `deleteIds` and must remain.
- RPC must reject delete or update of `session_status = 'in_progress'`.

## Interruption, retry, and recovery

- App termination or navigation away: draft is discarded (REQ-13). No local draft persistence.
- Network loss or timeout: STATE-05 → EditDirty; copy UX-12; retry is another Done with the same client-generated IDs.
- Retry ownership: user only; no automatic retry loop.
- Stale or partially completed work: RPC is one transaction, including confirm-none timestamps; a failure writes nothing. If commit succeeds but the response is lost, an identical retry succeeds idempotently and does not duplicate children. No compensating rollback UI.
- Reconciliation: after success, `fetchJobDetail` is the View source of truth.

## Invariants

- The draft never includes an in-progress session.
- Back first flushes focused numeric buffers into the in-memory draft so dirty detection is accurate; confirmed discard never calls the apply RPC.
- Delete job never waits for Done and is not undone by Back.
- Synthesized session timestamps are not shown as clock times unless `clock_times_explicit` is true.
- Removing a session immediately sets `sessionId = null` on each visible, unremoved draft note, material, and other cost that referenced it.
- An undated or zero-duration ended session is durable partial data but is excluded from `last_worked_at`, record completeness, and automatic `not_started` → `in_progress` transition.

## Verification obligations

- Dirty Back discard vs cancel (STATE-04).
- Failed Done keeps draft (STATE-05 → EditDirty).
- Kill during Edit does not persist (TEST-16).
- Live session in progress cannot be removed via the diff (STATE events + DATA-12).
