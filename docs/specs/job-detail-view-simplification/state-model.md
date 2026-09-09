# Job Detail View State Model

## Scope

- Job View health/read/act, Complete wizard (flag on).
- Job Edit draft states remain in [`../job-detail-edit/state-model.md`](../job-detail-edit/state-model.md). Wizard **enters** those states with `wizardActive`.
- Live Session overlay lifecycle is **unchanged** this phase (existing `LiveSessionContext`). Phase 3 owns expanded capture writes and the View start tile.

## State definitions

| ID | State | Meaning | Persisted or derived | Terminal? |
|---|---|---|---|---|
| STATE-V01 | ViewReady | Flag-on View | Derived | No |
| STATE-V02 | MinimumInfoGate | Complete intro sheet | Derived | No |
| STATE-V03 | WizardEdit | Job Edit while wizard active (incl. materials/other-costs confirm-none) | Derived | No |
| STATE-V06 | MarkingComplete | Status write in flight | Derived | No |

Expand/collapse of **truncated note** rows on View is presentation only (not a durable state). Session rows have no expand state on View.

STATE-V07 LiveExpanded and STATE-V08 LiveMinimized remain existing product states; this phase does not change their transitions. Phase 3 will specify capture events on LiveExpanded.

## Events

| Event | Initiator | Preconditions | Idempotency |
|---|---|---|---|
| OpenEditFromView | User | ViewReady | — |
| ToggleNoteReadExpand | User | ViewReady; note excerpt ≠ body | Toggle |
| BeginComplete / ConfirmMinimumInfo / CancelWizard / WizardDone | User/System | As prior wizard packet | Same as previous spec |

StartLiveFromView, LiveAddNote, LiveAddMaterial, and LiveChangeStart are Phase 3.

## Transitions

Wizard transitions: MinimumInfo → WizardEdit (scoped; revenue gap always opens revenue Edit). Edit discard cancels wizard. Edit Done persists confirm-none (materials, other costs, no revenue) from draft refs via reviewed/confirm APIs.

ViewReady + OpenEditFromView → Phase 1 Edit (not wizard unless wizardActive).

BeginComplete / status-sheet Completed or Paid: end this job’s live in-progress session first (context `endLiveSessionNow`, else `endLiveSession` for `inProgressSession`); abort with Alert on failure; then run completeness on the refreshed job. Paid uses the same gate as Completed (cannot skip financial completeness via the status sheet).

## Interruption

- Kill in WizardEdit: Phase 1 draft lost; wizard flag lost.
- Confirm-none (materials, other costs, no revenue) persist from Edit Done via draft refs + reviewed/confirm APIs — not a Complete bottom sheet.
- Kill during an existing live session: session remains on the server (current product). Unsaved overlay drafts stay as today.

## Invariants

- View note expand never writes. Session rows on View have no expand interaction.
- Live overlay never uses `apply_job_detail_edit` (existing; do not change this phase).
- Job Edit Done is the only batch persist for job-owned lists.

## Verification

- TEST-V07, TEST-V08.
