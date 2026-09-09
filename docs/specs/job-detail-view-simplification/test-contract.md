# Job Detail View Test Contract

## Risks

| Risk | Impact | Proof |
|---|---|---|
| Expand still mutates (ADD/EDIT pill on session) | High | TEST-V02 |
| Session shows expand chrome or attachment summary on View | Medium | TEST-V02 |
| Header jumps / no fade | Medium | TEST-V13 |
| Incomplete job has no Missing line on View | High | TEST-V14 |
| Partial session looks complete | High | TEST-V15 |
| Flag-off regression | High | TEST-V09 |
| Wizard discard completes job | High | TEST-V07 |

## Traceability

| ID | Source | Scenario | Layer | Auto/manual |
|---|---|---|---|---|
| TEST-V01 | REQ-V01 | No ADD pills flag on | Component | Auto |
| TEST-V02 | REQ-V02 | Session row is flat (no chevron/expand); shows start–end time; no attachment list or ADD/EDIT chrome. Note expand remains read-only when truncated. | Component | Auto |
| TEST-V03 | REQ-V03 | Empty materials no confirm CTA | Component | Auto |
| TEST-V04 | REQ-V04 | No item sheets from View | Component | Auto |
| TEST-V05 | REQ-V05 | Material tap / customer tap / status CTA; customer card shows name and service address when present | Component | Auto |
| TEST-V07 | REQ-V07 | Wizard Edit discard cancels. After Confirm Info, first gap is scoped `revenue` (not `title`); header still Next with multiple gaps. | Component | Auto |
| TEST-V08 | REQ-V08 | Edit confirm-none checkbox for materials gap | Component | Auto |
| TEST-V09 | REQ-V09 | Flag off ADD + confirm card | Component | Auto |
| TEST-V10 | REQ-V10 | focusTarget | Component | Auto |
| TEST-V11 | UX copy | Empty + gate strings | Component | Auto |
| TEST-V17 | Completeness | Status-sheet Paid and Mark Paid require the same financial completeness gate as Completed | Component | Auto |
| TEST-V12 | UX | Dynamic Type session row | Manual | Manual |
| TEST-V13 | REQ-V11 | X/pill alignment; fade (or reduced-motion cut) | Component + manual | Both |
| TEST-V14 | REQ-V12, UX-V18 | Untitled Job + unconfirmed $0 shows `Missing: revenue, sessions, materials, costs` (no `description`) | Component | Auto |
| TEST-V15 | REQ-V13 | Session without duration shows missing | Component | Auto |

TEST-V06 (live start tile) and TEST-V16 (live add note immediate persist) are Phase 3 with REQ-V06 / REQ-V14.

## Layers

- Jest `JobDetailScreen` with APIs mocked.
- No DB migration tests.
- Manual: fade, Dynamic Type.

## Gates

| Gate | Checks | Block |
|---|---|---|
| Merge | TEST-V01–V05, V07–V11, V14–V15 | Session expand chrome; note expand mutates; Missing missing |
| Submit | TEST-V12, V13 on device | Header jump; clipped rows |

## Deferred untested

- Inbox, Todoist job add, Quick Note/Material UX, View Live Session start tile, live overlay capture (Phase 3). Invoice. Flag retirement.
