# Inbox, New Job, Quick Capture, Live Session Test Contract

## Quality objective and risk inventory

| Risk | Impact | Likelihood | Required proof |
|---|---|---|---|
| Flag on still inserts Untitled Job before user types | High | Medium | TEST-N01, TEST-N03 |
| Inbox tap still assigns | High | High | TEST-I01 |
| Quick capture asks for job | High | Medium | TEST-Q01, TEST-Q02 |
| Live overlay nested Edit / Done returns | High | Medium | TEST-L08 |
| Live identity requires Done | High | Medium | TEST-L04 |
| Live capture not immediate | High | Medium | TEST-L05 |
| Start tile visible during another live | Medium | Medium | TEST-L02 |
| Material quick capture still requires qty+unit | Medium | High | TEST-Q02 |
| Flag-off regression | High | Medium | TEST-F02 |
| Shared chrome diverges from Edit rows | Low | Medium | TEST-S01 |

## Traceability matrix

| ID | Source rules | Scenario | Expected result | Layer | Auto/manual | Environment |
|---|---|---|---|---|---|---|
| TEST-F01 | REQ-F01 | Flag on: smoke each Phase 3 entry | New paths active | Integration | Auto | Jest + mocked flag |
| TEST-F02 | REQ-F02 | Flag off: New Job, Inbox tap, Quick Material, live overlay | Legacy behavior unchanged | Component | Auto | Jest |
| TEST-N01 | REQ-N01 | Open composer | No `Untitled Job` prefill; Add Job disabled when empty | Component | Auto | Jest |
| TEST-N02 | REQ-N02 | Type title; Add Job | `createJob*` with title; navigates Job View; not `initialEditOpen` | Integration | Auto | Jest |
| TEST-N03 | REQ-N03 | Dismiss composer with text entered | No `createJob` call | Component | Auto | Jest |
| TEST-N04 | REQ-N04 | Expand composer; add customer; Add Job | Job created with customer_name | Integration | Auto | Jest |
| TEST-Q01 | REQ-Q01 | Quick Note save | `createNote` jobId null; no chooser shown | Integration | Auto | Jest |
| TEST-Q02 | REQ-Q02 | Quick Material description+total only | Save succeeds; qty/unit not required | Component | Auto | Jest |
| TEST-I01 | REQ-I01 | Tap Inbox note | Edit sheet opens; `ChooseJobBottomSheet` not opened | Component | Auto | `InboxScreen.test` |
| TEST-I02 | REQ-I02 | Add to job | `updateNote` with jobId; user stays Inbox; row removed | Component | Auto | Jest |
| TEST-I03 | REQ-I03 | Swipe delete Inbox note | Confirm → `deleteNote` | Component | Auto | Jest |
| TEST-L01 | REQ-L01 | Job View flag on, no live | Live start tile visible with UX-L01/L02 copy | Component | Auto | `JobDetailScreen.test` |
| TEST-L02 | REQ-L02 | Global live active | Start tile hidden on all Job Views | Component | Auto | Jest |
| TEST-L03 | REQ-L03 | Tap start tile | `startLiveSession`; job detail closes | Integration | Auto | Jest |
| TEST-L04 | REQ-L04, DATA-L03 | Change customer on live overlay | `updateJobById` called; no Done; bar title updates | Integration | Auto | Jest |
| TEST-L05 | REQ-L05 | Add note on overlay | `createNote` with live sessionId; list updates | Integration | Auto | Jest |
| TEST-L06 | REQ-L06 | Overlay list | Flat rows; no chevron; tap opens edit | Component | Auto | Jest |
| TEST-L07 | REQ-L07 | Tap started time | `updateLiveSessionStart`; no EditLiveSession sheet | Component | Auto | Jest |
| TEST-L08 | REQ-L08 | Render live overlay flag on | No header EDIT; no EditJobBottomSheet trigger | Component | Auto | Jest |
| TEST-S01 | REQ-S01 | Composer + quick sheets | Use shared Edit row testIDs/components | Component | Auto | Jest |
| TEST-L09 | UX-L10 | Minimize live | Back minimizes; session continues | Component | Auto | Jest |
| TEST-L10 | STATE-C04 | Blank title on live identity blur | Patch not sent; field reverts | Unit | Auto | Jest |
| TEST-A11 | UX-C01–C02 | Composer keyboard + safe area | Title visible above keyboard | Manual | Manual | iOS device |
| TEST-A12 | UX-L06 | End session flow | Session ended; job refresh | Manual | Manual | Device |

## Test layers and boundaries

- **Unit:** debounce/blank-title guards for live identity; material `canSave` with total-only.
- **Component:** InboxScreen, QuickActionsFlow, JobDetailScreen (tile), LiveSessionBottomSheet/overlay refactors.
- **Integration:** create job + apply children; live capture CRUD mocked api-client.
- **DB/RLS:** no new migrations; existing inbox null-parent queries covered by api-client tests.
- **Manual:** composer keyboard, live overlay scroll + End Session on device.

## Fixtures and test data

- Inbox notes/materials with `createdAt` for recency buckets.
- Job with/without `inProgressSession`.
- Mock `useLiveSession` / `useHasLiveSession` for tile visibility.
- Flag provider: force true/false for `job-detail-fullscreen-edit`.

## Lifecycle, failure, and concurrency coverage

- Duplicate **Add Job** tap while committing: ignored.
- `23505` on second live start: existing alert path (FAB + View tile).
- Assign while offline: error alert; item stays Inbox.
- Live identity save failure: error copy UX-L07; persisted value unchanged.

## Data, security, and migration coverage

- Inbox assign only sets `job_id` (session null).
- Quick capture never sets job_id at create (flag on).
- Flag off still uses `createBlankJobForCurrentUser` (TEST-F02).

## UX and accessibility coverage

- TEST-I03 swipe + a11y delete action.
- TEST-L06 row tap labels include content excerpt.
- TEST-A11 composer at Dynamic Type L.

## Release gates and evidence

| Gate | Required checks | Evidence | Blocking failure |
|---|---|---|---|
| Before merge | TEST-F01–F02, N01–N04, Q01–Q02, I01–I03, L01–L08, S01 | CI Jest | Inbox tap assigns; Untitled insert on flag on |
| Before submission | TEST-A11–A12 | Manual notes | Composer unusable with keyboard |
| Before public release | Flag rollout plan separate | PostHog flag % | N/A for this packet |

## Deferred or intentionally untested

- Composer kill mid-commit orphan job (low frequency; accepted).
- Flag retirement and legacy code deletion (future release).
- Inbox session-assign (deferred).
