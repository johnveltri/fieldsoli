# Inbox, New Job, Quick Capture, Live Session Build Plan

## Readiness basis

- Approved product spec: [spec.md](spec.md)
- State model: [state-model.md](state-model.md)
- Data contract: [data-contract.md](data-contract.md)
- UX contract: [ux-contract.md](ux-contract.md)
- Test contract: [test-contract.md](test-contract.md)
- Source revision reviewed: `efd4946`
- Remaining blockers: None

## Current-state findings

- **New Job:** [`AuthenticatedAppChrome.tsx`](../../../apps/mobile-expo/src/shell/AuthenticatedAppChrome.tsx) `createJobAndOpen` calls `createBlankJobForCurrentUser` (inserts `Untitled Job`) then `openJobDetail(..., { initialEditOpen: true })`.
- **Quick capture:** [`QuickActionsFlowContext.tsx`](../../../apps/mobile-expo/src/shell/QuickActionsFlowContext.tsx) already opens note/material sheets directly and saves to Inbox (`jobId: null`). Material sheet still requires qty + unit cost via [`EditMaterialBottomSheet.tsx`](../../../apps/mobile-expo/src/components/ds/EditMaterialBottomSheet.tsx) `canSave`.
- **Inbox:** [`InboxScreen.tsx`](../../../apps/mobile-expo/src/screens/InboxScreen.tsx) row tap → `openAssign` → `ChooseJobBottomSheet`; no edit, no swipe delete.
- **Job View live tile:** Phase 2 reserved REQ-V06; flag-on View has no session ADD and no Live start tile ([`JobDetailScreen.tsx`](../../../apps/mobile-expo/src/screens/JobDetailScreen.tsx) `onStartLiveSession` exists for flag-off chooser).
- **Live overlay:** [`LiveSessionBottomSheet.tsx`](../../../apps/mobile-expo/src/components/ds/LiveSessionBottomSheet.tsx) + [`LiveSessionCaptureCard.tsx`](../../../apps/mobile-expo/src/components/ds/LiveSessionCaptureCard.tsx) + [`LiveSessionOverlay.tsx`](../../../apps/mobile-expo/src/components/LiveSessionOverlay.tsx) — header **EDIT job**, expandable card, add tiles, attachment list, nested `EditJobBottomSheet` / `EditLiveSessionBottomSheet` / note-material sheets.
- **Flag:** `job-detail-fullscreen-edit` in [`constants.ts`](../../../apps/mobile-expo/src/lib/featureFlags/constants.ts); Phase 3 entirely gated behind it.
- **Shared Edit rows:** [`edit-mode/EditFormRows.tsx`](../../../apps/mobile-expo/src/components/ds/edit-mode/EditFormRows.tsx), [`JobDetailEditMode.tsx`](../../../apps/mobile-expo/src/screens/jobDetailEdit/JobDetailEditMode.tsx).
- **APIs:** `updateJobById`, `createNote`, `createMaterial`, `updateLiveSessionStartedAt` (live), `listInboxNotes` / `listInboxMaterials`, `apply_job_detail_edit_atomic` (composer children only).

## Change map

| Area | Expected files/systems | Requirement or contract rule |
|---|---|---|
| Flag gate | All Phase 3 touchpoints branch on `job-detail-fullscreen-edit` | REQ-F01, REQ-F02 |
| `createJobForCurrentUser` | `packages/api-client/src/jobs.ts`, tests | DATA-C01, REQ-N02 |
| New Job composer | New `NewJobComposerSheet.tsx` (or similar), `AuthenticatedAppChrome.tsx`, Jobs FAB / Home entry | REQ-N01–N04, UX-C01–C04 |
| Quick Material save gate | `EditMaterialBottomSheet.tsx` or flag-on variant | REQ-Q02, TEST-Q02 |
| Quick Note/Material | `QuickActionsFlowContext.tsx` | REQ-Q01–Q02 |
| Inbox edit + assign + delete | `InboxScreen.tsx`, tests | REQ-I01–I03 |
| Job View live tile | `JobDetailScreen.tsx`, tests | REQ-L01–L03, UX-L01–L02 |
| Live overlay redesign | `LiveSessionBottomSheet.tsx`, `LiveSessionOverlay.tsx`; retire or bypass `LiveSessionCaptureCard` flag-on | REQ-L04–L08, STATE-L* |
| Shared row extraction | `edit-mode/*`, composer + live consumers | REQ-S01 |
| Analytics | `analytics.ts` call sites | UX analytics section |

## Implementation sequence

1. **API: title-required job create**
   - Files: `jobs.ts`, `jobs.test.ts`, export from `index.ts`
   - Behavior: `createJobForCurrentUser({ shortDescription, ... })`; reject blank
   - Verification: unit tests; TEST-N02

2. **Extract reusable capture/composer building blocks**
   - Files: `edit-mode/` or `capture/` module — title field, note body, material total-first, job identity tile group
   - Behavior: props-driven; usable from composer, quick capture, Inbox edit, live overlay
   - Verification: TEST-S01

3. **New Job composer (flag on)**
   - Files: composer sheet, wire `createJobAndOpen` replacement path in `AuthenticatedAppChrome.tsx`
   - Behavior: compact → expand tiles → **Add Job** → optional `apply_job_detail_edit_atomic` for children → Job View
   - Verification: TEST-N01–N04

4. **Quick capture material minimum (flag on)**
   - Files: `EditMaterialBottomSheet.tsx` or thin wrapper
   - Behavior: description + total only; optional breakdown
   - Verification: TEST-Q01–Q02

5. **Inbox: edit, explicit assign, swipe delete (flag on)**
   - Files: `InboxScreen.tsx`, `InboxScreen.test.tsx`
   - Behavior: tap → edit sheet; **Add to job** button; swipe delete
   - Verification: TEST-I01–I03

6. **Job View Live start tile (flag on)**
   - Files: `JobDetailScreen.tsx`
   - Behavior: tile in Sessions when no global live; start + close detail
   - Verification: TEST-L01–L03

7. **Live overlay redesign (flag on)**
   - Files: `LiveSessionBottomSheet.tsx`, `LiveSessionOverlay.tsx`; simplify/remove legacy card path when flag on
   - Behavior: inline identity tiles (immediate `updateJobById`); in-place start time; Add note/material rows; flat session list; no nested Edit sheets
   - Verification: TEST-L04–L08, TEST-L09–L10

8. **Flag-off regression pass**
   - Files: all branches
   - Verification: TEST-F02

9. **Manual device checks**
   - Composer keyboard/safe area (TEST-A11); End Session (TEST-A12)

## Migration and compatibility

- No database migration required.
- Additive API `createJobForCurrentUser` only; keep `createBlankJobForCurrentUser` for flag-off.
- Deploy mobile build; Phase 3 inactive until PostHog flag enabled per user (same flag as Phase 1/2).
- Rollback: disable flag → legacy paths.

## Test execution map

| Test contract rules | Implementation step | Planned evidence |
|---|---|---|
| TEST-N01–N04 | Step 3 | Jest |
| TEST-Q01–Q02 | Steps 4–5 | Jest |
| TEST-I01–I03 | Step 5 | Jest |
| TEST-L01–L03 | Step 6 | Jest |
| TEST-L04–L10 | Step 7 | Jest |
| TEST-F01–F02 | Steps 1–8 | Jest |
| TEST-S01 | Step 2 | Jest |
| TEST-A11–A12 | Step 9 | Manual device |

## Release sequence

1. Merge api-client helper + mobile implementation behind flag.
2. Internal QA with flag on for test users.
3. Mobile build submission (no server gate).
4. Gradual PostHog flag rollout (operational; not part of code merge).

## Product-context closeout

- Phase 2 deferred pointer updated to this folder ([`../job-detail-view-simplification/spec.md`](../job-detail-view-simplification/spec.md) Deferred).
- Phase 2 REQ-V06 / REQ-V14 fulfilled by this spec REQ-L01–L08.
- Do not implement Customers table, invoice/receipt, or flag retirement in this build.
