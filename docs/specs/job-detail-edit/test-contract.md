# Job Detail Edit Test Contract

## Quality objective and risk inventory

| Risk | Impact | Likelihood | Required proof |
|---|---|---|---|
| Partial writes if Done is not transactional | High | Medium | RPC raises on error; failure rolls back entire transaction (TEST-07) |
| Fake clock times shown on View | High | High | View/model test for `clockTimesExplicit === false` |
| Live session deleted from a snapshot replace | High | Medium | RPC rejects in_progress; diff omits it |
| Draft believed saved after kill | High | Medium | Documented + unit: no persist without Done (manual kill) |
| Accidental job delete | High | Medium | Confirm required; cancel does not delete |
| Dual path confusion (sheets vs Edit) | Medium | High | Wizard/ADD still use sheets (regression) |
| Swipe fights job dismiss | Medium | Medium | Manual device |
| Cross-user apply | High | Low | RLS/RPC unauthorized |
| Partial data silently normalized or fabricated | High | High | Null revenue, undated/zero session, and partial material round-trip tests |
| Lost apply response makes retry fail | High | Medium | Execute identical RPC create payload twice |
| Flag outage strands or exposes the new entry point | High | Medium | Enabled, disabled, HTTP error, and timeout fallback tests |
| Conflicting Back/Delete during apply | High | Medium | Deferred apply component tests; controls and handlers remain inert |
| Focused numeric text bypasses dirty Back or survives discard | High | Medium | Back flushes buffers before dirty check; discard resyncs mounted fields |

## Traceability matrix

| ID | Source rules | Scenario | Expected result | Layer | Automated or manual | Environment |
|---|---|---|---|---|---|---|
| TEST-01 | REQ-01, STATE-01→02 | Pencil and `initialEditOpen` open Edit mode; `EditJobBottomSheet` is not shown for those entries | Edit chrome visible; job identity prefilled | Component | Automated | Jest |
| TEST-02 | REQ-02, REQ-03, UX-01, UX-02 | Edit shows Back, brand-primary Done in the EDIT slot, hero title, identity rows, four sections, add rows, Delete job | Chrome and body present | Component | Automated | Jest |
| TEST-03 | REQ-03, UX-18..21 | Add session/material/note/other cost inserts a draft row without network | No API mock call until Done | Component | Automated | Jest |
| TEST-04 | REQ-04, STATE-03→04 | Dirty Back shows discard copy | UX-04..06 | Component | Automated | Jest |
| TEST-05 | REQ-04, STATE-04 | Confirm discard; View/title unchanged vs pre-edit | Apply RPC not called | Component | Automated | Jest |
| TEST-06 | REQ-05, STATE-05 | Done on dirty draft calls apply RPC once then fetchJobDetail | View shows new title | Component + API mock | Automated | Jest |
| TEST-07 | REQ-05, DATA apply atomic | RPC aborts mid-payload after confirmation updates (forced) | Zero net job, confirmation, or child-row changes | DB | Automated | Local Supabase or SQL test |
| TEST-08 | REQ-06 | Blank title disables Done; completely empty new rows are omitted; non-empty partial session/material/other-cost rows persist; blank new note is omitted and cleared existing note deletes | Payload and validation match capture-now rules | Unit + component | Automated | Jest |
| TEST-09 | REQ-07, DATA-05, DATA-06 | Duration-only session persists `clock_times_explicit=false` and synthesized 09:00–end | DB row matches | Unit (synthesis) + DB | Automated | Jest + SQL |
| TEST-10 | REQ-07, DATA-06 | fetchJobDetail/mapSession: `clockTimesExplicit=false` → no time range in View row | Duration + date only | Unit + component | Automated | Jest |
| TEST-11 | REQ-08, DATA-09, DATA-10 | Total-only material preserves total with both breakdown flags false; complete quantity×price recomputes total | Values and explicitness match | Unit + RPC | Automated | Jest + SQL |
| TEST-12 | REQ-09 | Note attached to ended session id on Done | `notes.session_id` set; `job_id` null per existing parent rule | DB or API | Automated | Jest mock + SQL |
| TEST-13 | REQ-10, STATE-03 | Swipe-remove then Back discard restores row; swipe-remove then Done soft-deletes | Restore vs deleted | Component + DB | Automated | Jest |
| TEST-14 | REQ-11, STATE-06 | Delete job cancel; then confirm | Cancel: job remains; confirm: `deleteJobById`, detail closes, no apply RPC | Component | Automated | Jest |
| TEST-15 | REQ-12, DATA in_progress | Payload deleteIds includes in_progress id | RPC `conflict`; session remains | DB | Automated | SQL |
| TEST-16 | REQ-13, STATE AppKilled | Unsaved draft is not written without Done | No apply call; documented manual force-quit | Unit (no persist path) + Manual | Automated + manual | Jest + device |
| TEST-17 | REQ-14 | Add Sessions from View still opens `NewSessionBottomSheet`; wizard still opens gap sheets | Regression | Component | Automated | Existing JobDetailScreen tests |
| TEST-18 | REQ-15, DATA auth | Other user job id | RPC unauthorized / not_found; no writes | DB | Automated | SQL as second user or RLS |
| TEST-19 | UX-01, UX-02, UX-04, UX-12 | Critical copy strings render | Exact text `Done`, `Back`, discard and save-error copy | Component | Automated | Jest |
| TEST-20 | UX visual, a11y | Keyboard, safe area, Dynamic Type XXXL, swipe vs dismiss | No clipped chrome; Delete job reachable; hardware Back = Edit Back; Done is brand-primary in the EDIT slot | Manual | Manual | iOS + Android device/simulator |
| TEST-21 | REQ-07, DATA-05, DATA-13 | Save/refetch/reopen undated or zero-duration session; map zero, 1-second, 36-second, and 37-second durations | No crash; missing fields remain missing; zero duration does not count; every positive duration counts and short positive values render `<0.1h` | Unit + API + DB | Automated | Jest + SQL |
| TEST-22 | REQ-08, DATA-09, DATA-10 | Save/reopen total + quantity only; total + unit price only; complete pair | Partial values and explicitness round-trip; only complete pair recomputes total | Unit + API + DB | Automated | Jest + SQL |
| TEST-23 | REQ-16, STATE-05 | Hold apply promise pending, then tap Back/hardware Back/Delete/repeated Done | No second mutation, navigation, or dialog until apply settles | Component | Automated | Jest |
| TEST-24 | REQ-14 | FAB Quick Note and Quick Material | Capture form opens directly; save writes an Inbox item with no job/session | Component + API mock | Automated | Jest |
| TEST-25 | REQ-17 | Flag enabled, disabled, HTTP error, thrown error, and never-resolving request | Enabled uses fullscreen Edit; every other state reaches old sheet after bounded wait; UUID only in request | Unit + component | Automated | Jest |
| TEST-26 | REQ-18, DATA idempotency | Execute identical apply create payload twice | Both calls return ok; one child row per client ID; other-user collision rejected | DB | Automated | SQL |
| TEST-27 | REQ-10 | Delete a session with visible attached note/material/other cost | Each child immediately becomes unassigned; Done succeeds | Unit + DB | Automated | Jest + SQL |
| TEST-28 | REQ-06, DATA-04 | Edit only a child on a job with null revenue | `revenue_cents` remains null after Done | API + DB | Automated | Jest + SQL |
| TEST-29 | REQ-04, STATE-03→04 | Change a focused numeric field, then Back and discard while crossfade keeps Edit mounted | Dirty discard path runs; reopened buffer matches persisted snapshot | Component | Automated | Jest |

## Test layers and boundaries

- Unit: duration ↔ timestamps, undated handling, material total/explicitness, child unassignment, dirty diff builder, shared Back-handler delegation, `mapSession` clock hide, flag timeout.
- Component: JobDetailScreen / Edit mode open and flag fallback, discard, saving lock, Done mock, delete confirm, FAB Inbox capture, copy.
- Database/RLS: migration, apply RPC atomicity/idempotency, in_progress, ownership, partial derived-state exclusion, material explicitness.
- Integration: api-client wrapper maps payload and errors (mock or local).
- End-to-end: not required if component + SQL cover REQ-*.
- Manual: TEST-16 force-quit, TEST-20 devices — not faithfully automatable in Jest.

## Fixtures and test data

- Reuse job detail mocks in `apps/mobile-expo/src/mocks/jobDetail.ts`.
- SQL tests: owner job with meaningful ended session, partial ended sessions, one in_progress live session, partial/complete materials, child attachments, and a second user.
- Cross-tenant: second auth user id.
- Duration-only vs explicit-time sessions.

## Lifecycle, failure, and concurrency coverage

- All STATE transitions in state-model.md except physical AppKilled (TEST-16 manual).
- Duplicate Done while Saving ignored.
- Back, hardware/system Back, and Delete job while Saving ignored.
- Same payload retry after an assumed lost response succeeds without duplicates.
- Live session ending during Edit: not in deleteIds; remains after Done (comment + RPC does not replace-all).

## Data, security, and migration coverage

- `clock_times_explicit` default true.
- Date/clock and material breakdown explicitness backfills and round-trips.
- Grant/execute authenticated only; idempotent conflicts preserve tenant ownership.
- Old-client note: untested beyond “column default true”; accepted.

## UX and accessibility coverage

- Copy: TEST-19.
- Device: TEST-20.
- Screen reader labels on Back, Done, Add rows, Delete job.

## External dependencies and environments

- Jest for app; existing Supabase SQL/pg-tap or api-client test style for RPC.
- No new third-party test accounts.

## Release gates and evidence

| Gate | Required checks | Evidence | Blocking failure |
|---|---|---|---|
| Before merge | Automated portions of TEST-01..19 and TEST-21..28; TEST-16 and TEST-20 remain manual | CI + local SQL | Failed test, non-idempotent RPC, data loss, privacy leak, or broken flag fallback |
| Before deployment | Migration applied to target | Supabase migration log | RPC missing |
| Before submission | TEST-20 on iOS and Android | Manual notes/screens | Keyboard covering Done/Delete or swipe dismissing job |
| Before public release | Same as submission | — | — |

## Deferred or intentionally untested

- Performance of very large jobs (100+ materials): out of current usage.
- Old-client display of synthesized 9:00 on duration-only rows: accepted compatibility limitation.
