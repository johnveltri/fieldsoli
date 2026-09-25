# Job Customers — State Model

This model separates durable database state from transient picker/editor state. The database never stores a UI-only loading or permission prompt state.

## Scope

- Modeled entities/processes: Job customer snapshot, linked Customer lifecycle, customer editor commit, address lookup, and device-contact selection.
- Durable source of truth: owned `jobs` and `customers` rows plus transactional server mutations.
- Persisted states: active/deleted Job, optional Customer link, active/deleted Customer, and exact snapshots/defaults.
- Derived states: Customer eligibility/visibility and recency.
- Transient states: dirty editor, confirmation, provider lookup, native chooser, and permission recovery.

## State index

| ID | State | Persisted or derived | Terminal? |
| --- | --- | --- | --- |
| STATE-01 | Unlinked, ineligible Job snapshot | Persisted + derived eligibility | No |
| STATE-02 | Unlinked, eligible Job awaiting resolution | Transaction-local | No |
| STATE-03 | Linked Job with eligible active Customer | Persisted + derived eligibility | No |
| STATE-04 | Linked Job with hidden/ineligible Customer | Persisted + derived eligibility | No |
| STATE-05 | Inactive Customer with no active linked Jobs | Persisted soft deletion | No; recoverable |
| STATE-06 | Customer editor clean | Transient | No |
| STATE-07 | Customer editor dirty | Transient | No |
| STATE-08 | Replacement confirmation | Transient | No |
| STATE-09 | Address lookup idle | Transient | No |
| STATE-10 | Address lookup pending | Transient | No |
| STATE-11 | Address suggestions visible | Transient | No |
| STATE-12 | No address matches | Transient | No |
| STATE-13 | Address suggestions unavailable | Transient | No |
| STATE-14 | Device-contact access unresolved | Transient | No |
| STATE-15 | Device-contact chooser active | Transient/native | No |
| STATE-16 | Device-contact access unavailable | Transient/platform-derived | No |

## Durable entities

- **Job snapshot:** customer name, phone, email, service address, and optional Customer link.
- **Customer defaults:** latest reusable values derived from an active linked Job.
- **Job lifecycle:** active or soft-deleted, independent of operational Job status.
- **Customer lifecycle:** active or soft-deleted, derived from active linked Jobs.

## Durable states

### STATE-01 — Unlinked, ineligible Job snapshot

The Job has no `customer_id` and does not meet REQ-02. It remains a valid Job and never appears as a Customer suggestion.

Entry:

- Existing historical Job.
- New Job saved without a name or without any valid phone/email/meaningful address.
- A no-selection save that does not meet Customer eligibility.

Exit:

- A later new-client edit becomes eligible: STATE-02 then server linking may move it to STATE-03.
- The user explicitly selects an eligible Customer: STATE-03.

### STATE-02 — Unlinked, eligible Job draft/snapshot

The values meet REQ-02, but no Customer identity has yet been resolved. This is normally a short-lived server transaction state, not a steady UI state.

Exit:

- One unambiguous high-confidence match exists: link and enter STATE-03.
- No safe match exists: create a Customer, link it, and enter STATE-03.
- Persistence fails: retain the client draft and return to its prior durable state.

### STATE-03 — Linked Job with eligible active Customer

The active Job links to an active Customer whose defaults are eligible. The Customer may appear in recent/search suggestions. Saving the linked Job replaces Customer defaults with the exact new snapshot.

Exit:

- The saved linked snapshot becomes ineligible: STATE-04.
- The Job is deleted and other active linked Jobs remain: recompute and remain STATE-03 or enter STATE-04 based on the source snapshot.
- The Job is the final active link and is deleted: STATE-05.

### STATE-04 — Linked Job with hidden/ineligible Customer

The identity and link remain, but the Customer defaults do not meet REQ-02. The Customer is excluded from recents and search.

Exit:

- An active linked Job is saved with eligible values: STATE-03.
- Deletion/recomputation finds an eligible remaining Job: STATE-03.
- The final active linked Job is deleted: STATE-05.

### STATE-05 — Inactive Customer with no active linked Jobs

The Customer is soft-deleted and unavailable to all Customer surfaces. Soft-deleted Jobs may still reference it for restoration.

Exit:

- A linked Job is restored: recompute defaults; enter STATE-03 if eligible or STATE-04 if not.
- Account deletion: permanently cascade-delete according to the account-deletion contract.

## Transient editor states

### STATE-06 — Customer editor clean

Displayed values equal the last durable Job snapshot. Job Edit persists on Done; Live Session has no pending customer write.

### STATE-07 — Customer editor dirty

At least one customer field differs from the durable Job snapshot. Keystrokes remain local.

Transitions:

- Job Edit `Done`: validate permissively, persist the complete snapshot transactionally, then STATE-06.
- Live Session field blur, picker selection, minimize flush, or end-session flush: persist the complete snapshot transactionally, then STATE-06.
- Persistence failure: remain STATE-07 and expose retry feedback; never silently discard.
- Cancel Job Edit: discard draft and return to STATE-06.

### STATE-08 — Replacement confirmation

A saved-Customer or device-contact selection would replace one or more non-empty customer fields. The current draft remains unchanged until confirmation.

Transitions:

- `Cancel`: return to the prior editor state unchanged.
- `Replace`: apply all selected values to the draft; Job Edit remains STATE-07, while Live Session persists and then enters STATE-06 on success.

### STATE-09 — Address lookup idle

The trimmed query has fewer than five characters, has fewer than two letters, or is unchanged after a completed lookup. No provider request is made.

### STATE-10 — Address lookup pending

The input meets the threshold and its 300 ms debounce has elapsed. One latest-query request is authoritative. The picker shows `Searching…` until results, no-results, or an error arrives.

Transitions:

- New input: cancel/supersede the request and restart the debounce.
- Success with results: STATE-11.
- Empty result: STATE-12.
- Timeout/error/quota/auth failure: STATE-13.
- Picker closes: STATE-09.

### STATE-11 — Address suggestions visible

Up to four provider suggestions and required attribution are visible. Selecting one updates the whole service-address draft. Free text remains editable.

### STATE-12 — No address matches

The typed value remains intact and savable. The picker shows `No results`.

### STATE-13 — Address suggestions unavailable

The typed value remains intact and savable. The app hides the suggestion panel and emits only a coarse error category.

### STATE-14 — Device-contact access unresolved

The user has not tapped `Add from Contacts`. The app has not requested broad permission or opened the native picker.

### STATE-15 — Device-contact chooser active

The explicit tap opens the least-privilege native picker. On platforms requiring permission, the request occurs at this transition only.

Transitions:

- User cancels: return unchanged.
- Contact selected: resolve single values or present per-field labeled chooser; then apply the replacement rule.
- Permission denied/unavailable: STATE-16.

### STATE-16 — Device-contact access unavailable

Manual customer entry remains usable. After denial, the app may offer `Open Settings`; it does not repeatedly prompt on screen entry.

## Authoritative transitions

| Event | Preconditions | Atomic outcome |
| --- | --- | --- |
| Save unlinked eligible snapshot | REQ-02 true | Match safely or create Customer; set `jobs.customer_id`; write exact defaults |
| Save explicitly linked snapshot | Valid owned Customer selected | Update Job snapshot and chosen Customer defaults; do not duplicate-detect away explicit identity |
| Select a different Customer | Non-empty affected draft | Require STATE-08 before replacing all four fields |
| Delete linked Job | Job active | Soft-delete Job; recompute Customer from newest remaining active linked Job or soft-delete Customer |
| Restore linked Job | Job soft-deleted | Restore Job; recompute linked Customer; reactivate/hide by eligibility |
| Save linked snapshot below threshold | Link exists | Keep link; store exact defaults; hide Customer from suggestions |
| Concurrent saves | Same Job or Customer | Serialize server mutation; later committed Job update wins, with Customer defaults matching its committed snapshot |

## Events and idempotency

| Event | Initiator | Preconditions/evidence | Idempotency rule |
| --- | --- | --- | --- |
| Save Job customer | User | Owned active Job and complete draft payload | One transaction per submission; repeated identical payload is semantically idempotent |
| Select saved Customer | User | Owned visible Customer suggestion | Does not mutate until approved commit boundary; duplicate taps are coalesced while committing |
| Select device contact | User/native OS | Explicit user tap and returned native selection | Device identifier is not persisted; cancel is a no-op |
| Request address suggestions | System after typing | Latest input meets threshold after 300 ms | Query sequence/token makes only latest response authoritative |
| Delete Job | User | Owned active Job | Existing Job-delete idempotency applies; recompute once in same transaction |
| Restore Job | User | Owned soft-deleted Job | Existing Job-restore idempotency applies; recompute once in same transaction |

## Invalid, duplicate, and concurrent events

- Reject a selected Customer owned by another user, soft-deleted Customer, missing Job, or deleted Job mutation target.
- Ignore duplicate picker taps while the same commit is in flight.
- Ignore provider responses whose query token is older than the current field input.
- Serialize mutations that touch the same Job or Customer. A stale optimistic version returns a conflict/latest snapshot instead of silently overwriting it.
- Never resolve conflicting phone/email candidates by arbitrary row order.

## Interruption, retry, and recovery

- Job Edit navigation/dismissal follows existing unsaved-draft confirmation; only `Done` commits.
- Live Session keeps a dirty draft through recoverable request failure. Minimize/end triggers one flush and reports failure instead of discarding silently.
- App termination before a successful commit may lose an unsaved transient draft; no partial server state remains.
- Network loss during provider lookup returns STATE-13; the free-text address remains savable.
- Network loss during customer save keeps STATE-07 and allows explicit/next-blur retry.
- After another client wins a version conflict, refresh the authoritative snapshot and require an intentional new edit before overwriting.
- Permission denial does not retry automatically; recovery belongs to a later explicit tap and system Settings.

## Invariants

- A Job snapshot changes only through an explicit save for that Job.
- A visible Customer has at least one active linked Job and eligible current defaults.
- A soft-deleted Customer is never returned by recents/search.
- An explicit `customer_id` is never replaced by heuristic matching.
- Provider failure cannot invalidate or erase free-text address input.
- Device-contact permission status cannot make manual Job editing unavailable.
- The Customer default source and recent ordering both use the most recently updated active linked Job, with a stable ID tie-breaker.

## Verification obligations

- TEST-03 and TEST-05 prove STATE-01/02 eligibility and resolution.
- TEST-04, TEST-06, and TEST-07 prove STATE-03/04/05 updates, deletion, restoration, concurrency, and rollback.
- TEST-15 and TEST-16 prove STATE-06/07/08 commit and recovery behavior.
- TEST-19, TEST-26, and TEST-27 prove STATE-09 through STATE-13 including stale responses and provider failure.
- TEST-17, TEST-18, TEST-23, and TEST-24 prove STATE-14 through STATE-16 and native recovery.
