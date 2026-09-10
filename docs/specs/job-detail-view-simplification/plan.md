# Job Detail View Build Plan

## Readiness basis

- Spec: [spec.md](spec.md)
- State / data / UX / test: this folder
- Source revision: `3151ef0` (Edit implementation `f8824c8`)
- Blockers: None

## Current-state findings

- View header is Close + **EDIT** pill; Edit mode header is X + **Done** in [`JobDetailEditMode.tsx`](../../../apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx) (`styles.topHeader`). Placement should be unified; bodies still swap without a shared fade.
- Open Jobs incomplete copy: `Missing: ${pills.join(', ')}` in [`JobCard.tsx`](../../../apps/mobile-expo/src/components/ds/JobCard.tsx); pills from [`incompletePillsFor`](../../../apps/mobile-expo/src/screens/JobsScreen.tsx). Job View header has no equivalent.
- `SessionCard` in View mode (`viewMode`): flat row with date, start–end time, duration, missing line; tap → Edit. No chevron, no expand panel, no attachment list. Legacy flag-off expand (EDIT + add tiles + attachments) unchanged.
- `JobDetailJobHeader` already renders `serviceAddress` when non-blank; keep it on the customer card and make the card tappable → Edit.
- Live `LiveSessionCaptureCard` and overlay stay as today this build. Phase 3 replaces capture tiles/EDIT pill with add-rows + start time, and adds the View start tile.
- Inbox tap only assigns ([`InboxScreen.tsx`](../../../apps/mobile-expo/src/screens/InboxScreen.tsx)) — **out of this build**.
- Completeness helpers unchanged.

## Change map

| Area | Files | Rules |
|---|---|---|
| Shared chrome + fade | `JobDetailScreen.tsx` | REQ-V11 |
| View lists / note expand-read | `SessionCard.tsx`, `ViewActivityBuckets.tsx`, `JobDetailScreen.tsx` | REQ-V01–V05, V13 |
| Customer card | `JobDetailJobHeader.tsx`, `JobDetailScreen.tsx` | REQ-V05 (name + address; tap → Edit) |
| Job Missing line | `JobDetailJobHeader` or View slot | REQ-V12 |
| Wizard | `JobDetailScreen.tsx` | REQ-V07–V08 |
| Flag off | branches | REQ-V09 |
| Tests | `JobDetailScreen.test.tsx` | TEST-V* in this packet |

Do not change `LiveSessionBottomSheet.tsx` / `LiveSessionCaptureCard.tsx` in this build except if View subtraction would otherwise break them; keep current live behavior.

## Implementation sequence

1. Shared header host + crossfade (TEST-V13)
2. Job `Missing:` line (TEST-V14)
3. Flatten session rows; note read expand; row missing; taps → Edit (TEST-V01–V05, V10, V15)
4. Wizard re-home (TEST-V07–V08)
5. Flag-off regression (TEST-V09)
6. Manual fade + Dynamic Type (TEST-V12, V13)

## Migration

None. Flag-off rollback.

## Test execution map

Steps 1–5 → listed TEST-V*; step 6 submission.

## Release sequence

Mobile only. Same PostHog flag.

## Product-context closeout

- This folder is the Phase 2 contract (View quality, not subtraction-only).
- Phase 3 spec: Inbox view + Todoist new job + Quick Note/Material minimum-save UX + Live Session View tile and overlay capture; principles in this UX contract Deferred section.
- Do not implement Customers table.
