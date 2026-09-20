# Job Customers — UX Contract

## User and context

- Primary user: a solo field-service operator capturing or revisiting a Job, often one-handed and interrupted.
- Job to be done: reuse or enter customer details quickly without leaving the Job workflow.
- Entry points: Customer block in Job Edit or Live Session; contact action in Job View.
- Prerequisites: authenticated owned Job. Device-contact and address-provider availability are optional enhancements.
- Successful exit: the current Job snapshot is saved; reusable Customer defaults update only through the approved transaction.

## Primary journey

| Step | Surface | User action | System response | Next state/surface |
| ---: | --- | --- | --- | --- |
| 1 | Job Edit or Live Session | Focus Customer | Show four recents and searchable field | STATE-06/07 plus picker |
| 2 | Customer picker | Select saved Customer or keep typing | Fill draft; confirm if replacing non-empty values | STATE-07 or STATE-08 |
| 3 | Customer block | Optionally import device contact/edit phone/email/address | Keep choices in one draft; autocomplete address when eligible | STATE-07 |
| 4 | Job Edit | Tap Done | Atomically save Job/Customer | STATE-06, Job View |
| 4a | Live Session | Select result or blur | Atomically save Job/Customer inline | STATE-06, Live Session |
| 5 | Job View | Tap Contact customer | Show filtered Call/Text/Email menu | External default app after choice |

## Surface-state matrix

| Surface | Loading | Empty | Ready | Saving | Success | Error/retry | Offline/interrupted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Customer picker | Small in-picker indicator; typed text remains | Exact UX-02 copy | Recent/search rows | N/A until selection commits | Draft populated | Exact UX-02 load error + retry | Free-typed Customer remains usable |
| Address picker | Small in-picker indicator; typed address remains | Exact UX-10 no-match copy | Up to five rows + attribution | N/A until selection commits | Draft populated | Exact UX-10 unavailable copy | Same unavailable state; manual save works |
| Job Edit Customer block | Existing Job load behavior | Blank optional fields | Editable UX-01 block | Existing Done progress; prevent duplicate submit | Return to Job View | Existing save recovery with draft retained | Draft retained under existing edit rules; no partial write |
| Live Session Customer block | Existing session load behavior | Blank optional fields | Editable UX-01 block | Inline pending state without clearing inputs | Remain in Live Session | UX-06 retry copy/action | Dirty draft retained; retry on reconnect/blur |
| Device contacts | Native picker/permission UI | Contact/field has no usable value | Native selection/field chooser | N/A | Values copied to draft | UX-09 settings recovery | Manual entry remains available |
| Job View actions | None | Control hidden with no valid action | Compact filtered menu | External app handoff | Return governed by OS | UX-13 non-blocking error | Same error; Job View remains usable |

## UX-01 — Shared field order and labels

Job Edit and Live Session present the same Customer block in this order:

1. `Customer`
2. `Phone`
3. `Email`
4. `Address`
5. `Add from Contacts`

Phone uses the phone keyboard; Email uses the email keyboard with autocapitalization and autocorrection disabled. All fields remain optional and permissive. The implementation reuses existing Job-detail edit rows, spacing, focus treatment, and keyboard-scrolling primitives.

## UX-02 — Customer picker opening state

Focusing/tapping the Customer field opens the picker without requiring typed text.

- Blank query: show up to four unique recent eligible Customers.
- Typed query: show up to five eligible name matches.
- No recent Customers: show `No saved customers yet.` without blocking typing.
- No search matches: show `No matching customers.` while preserving the typed name.
- Load failure: show `Couldn't load customers. Try again.` with action `Try again`.

The free-typed Customer value is always allowed; closing the picker never clears it.

## UX-03 — Customer suggestion layout

Each suggestion is one compact tappable row:

```text
Jordan Lee
(312) 555-0198 · jordan@example.com · 123 Main St, Chicago, IL
```

- Name occupies the primary line.
- Available phone, email, and service address appear in that order, separated by ` · `.
- Missing values and their separators are omitted.
- The metadata block wraps naturally to a maximum of two full lines and truncates only after line two.
- Same-name Customers are distinguished only by this metadata; the app does not invent labels.
- Rows meet the platform touch-target minimum and expose a combined accessible label.

## UX-04 — Selecting a saved Customer

Selection copies name, phone, email, and last service address into the current draft.

If all affected fields are blank, apply immediately. If any affected field is non-empty and the selected Customer is not already the linked identity with identical values, show:

- Title: `Replace customer details?`
- Body: `This will replace the name, phone, email, and service address for this Job.`
- Secondary action: `Cancel`
- Primary action: `Replace`

`Cancel` leaves every draft value and link unchanged. `Replace` applies all four fields, including blank values from the selected Customer.

## UX-05 — Job Edit persistence

- Typing, saved-Customer selection, device-contact selection, and address selection update only the Job Edit draft.
- `Done` persists the full Job edit and customer mutation atomically.
- `Cancel` discards the draft.
- Validation never prevents saving because a phone/email is malformed or the Customer is incomplete.
- Existing unsaved-changes behavior remains authoritative for dismissal.

## UX-06 — Live Session persistence

- Keystrokes update the local Customer draft only.
- Selecting a saved Customer, device contact, or address suggestion immediately saves the complete four-field snapshot.
- Blurring any Customer field saves the complete four-field snapshot when dirty.
- Minimizing or ending the session intentionally removes focus and flushes a dirty Customer draft before the surrounding action completes.
- While a save is pending, the draft remains visible and interactive according to existing Live Session save conventions.
- On failure, retain the draft and show `Couldn't save customer details. Try again.` with action `Try again`. A later blur may retry.

Existing title/description Live Session persistence may keep its own debounce behavior; this contract changes only the Customer block.

## UX-07 — Device contacts entry point

`Add from Contacts` remains a row-level action underneath the fields on both surfaces. Merely opening Job Edit or Live Session must not request access.

On tap:

1. Open the least-privilege native single-contact picker.
2. If the platform requires read permission, request it at this moment only.
3. After selection, copy the chosen person's name and resolve phone/email/postal address.
4. Apply UX-04 replacement confirmation when needed.

Suggested iOS permission-purpose copy, if required by the selected Expo/native API:

`Allow FieldSoli to choose a contact for this Job.`

The final generated native permission copy must be checked on both platforms before release.

## UX-08 — Multiple device-contact values

For each field independently:

- One value: select it automatically.
- Multiple values: show a compact chooser titled `Choose phone`, `Choose email`, or `Choose address`.
- Show the device-provided label when present, such as `mobile`, `work`, or `home`, plus the value.
- No value: use blank for the corresponding import value; after any required UX-04 confirmation, that field is blank.
- `Cancel`: do not import that field; continue resolving the other fields.

Only one value per field enters the Job. The app does not retain the unchosen alternatives.

## UX-09 — Contact permission denial and recovery

First denial returns immediately to usable manual entry. After denial or platform restriction, a later `Add from Contacts` tap may show:

- Message: `Contacts access is off. You can enter customer details manually or enable access in Settings.`
- Secondary action: `Not now`
- Primary action: `Open Settings`

The app does not show its own permission primer on screen entry and does not repeatedly trigger the OS prompt.

## UX-10 — Address autocomplete behavior

- Start no request before five trimmed characters and two alphabetic characters.
- Wait 300 ms after the latest change.
- Cancel or ignore stale requests as the user continues typing.
- Show up to five US address suggestions below the active field.
- Selecting a suggestion replaces the address draft with its `displayAddress`.
- The user may continue editing the selected value before save.
- Keyboard navigation, VoiceOver/TalkBack traversal, tap dismissal, and focus restoration follow the Customer picker's established primitives.

No-result copy:

`No matching addresses. Keep typing or use this address.`

Failure/quota/offline copy:

`Address suggestions are unavailable. You can keep typing and save this address.`

Neither state presents a blocking alert.

## UX-11 — Address attribution

While Geoapify suggestions are visible, the picker footer shows:

`Powered by Geoapify · © OpenStreetMap contributors`

- Use FieldSoli's smallest existing legible caption token; do not create smaller bespoke type.
- Respect Dynamic Type/font scaling and contrast requirements.
- Link `Geoapify` and `OpenStreetMap contributors` where the native text component supports distinct links; otherwise make the whole footer open an attribution/legal destination.
- Hide the footer when provider suggestions are not visible. Recent Customer suggestions do not require it.

## UX-12 — Job View customer display

The existing compact Job View Customer/header treatment adds phone and email alongside name and service address using ` · ` separators and omitting missing values. It may wrap naturally in the existing layout rather than introducing a Customer card or separate screen. Tapping the editable Customer region retains the existing scoped Job Edit entry behavior.

The display values always come from this Job snapshot, never from the linked Customer defaults.

## UX-13 — Job View contact action

Place a transparent person/contact icon control immediately left of the existing Edit control. It matches the Back/Edit visual family and has accessibility label `Contact customer`.

- Hide the control when neither a valid phone nor valid email exists.
- Always open the compact menu when visible, even if only one action is present.
- Menu order: `Call`, `Text`, `Email`.
- Include `Call` and `Text` only for a valid phone.
- Include `Email` only for a valid email.
- Selecting an item opens the device default app using the current Job snapshot.
- If the OS cannot open a URL, leave Job View usable and show the existing non-blocking error treatment with `Couldn't open that app.`

## UX-14 — Loading, latency, and touch behavior

- Keep the typed value visible during search.
- Do not replace the whole editor with a loader; a small in-picker activity indicator is sufficient.
- Ignore late responses for old queries.
- Picker rows and footer never cover the active input or the keyboard.
- Reuse the Job Detail Edit keyboard-aware scroll primitive in both full-screen and bottom-sheet contexts.
- Destructive Live Session actions continue to hide while any Customer field is focused, consistent with the existing focused-field safety rule.

## UX-15 — Accessibility and reduced motion

- All inputs have persistent accessible labels independent of placeholder text.
- Suggestions announce name followed by available phone, email, and address.
- Chooser labels from device contacts are exposed but never relied on by color alone.
- Focus moves predictably into a picker and returns to the originating field on dismissal.
- Dynamic text may increase row height; the two-line metadata cap applies at the scaled size.
- No new required motion is introduced. Existing reduced-motion behavior is preserved.

## UX-16 — Copy ownership

Copy in this contract is exact user-facing copy for V1. Implementation changes to it require updating this file and corresponding `TEST-*` assertions rather than embedding divergent strings in individual screens.

## Navigation and continuity

- No new Customer route or tab is introduced.
- The existing scoped Customer edit entry from Job View continues to open the same Job Edit surface.
- Back/dismiss from Job Edit follows existing unsaved-change behavior; pickers dismiss back to their originating field without clearing text.
- System Back first dismisses an open chooser/picker according to platform convention, then returns to the containing surface.
- Returning from Call/Text/Email or system Settings returns to the same Job when the OS preserves the app task.
- Cross-device edits use DATA-13 conflict behavior; local unsaved text never silently overwrites a newer snapshot.

## Responsive and platform behavior

- Target current supported phones in portrait and the app's current tablet/orientation declarations; do not add a new tablet-specific layout.
- Respect safe areas and bottom-sheet boundaries on iOS and Android.
- Native contacts and external-action presentation follow platform conventions while FieldSoli-owned choosers keep the same content/order.
- Large text may increase row height; controls remain reachable above the keyboard through the shared edit scroll primitive.
- Reduced motion disables any nonessential picker transition inherited from the design system.

## Visual and component quality

- Intended feel: fast, calm, compact, and consumer-grade; suggestions must be scannable without resembling a CRM table.
- Reuse existing edit rows, sheets/menus, typography, separators, transparent header controls, safe-area handling, and keyboard-scroll primitives.
- Use native contact picker and deep-link primitives for OS-owned actions.
- Build only the small Customer/address suggestion composition not already represented in the design system.
- Loading and errors stay local to the picker/editor; no full-screen interruption or provider-branded modal.

## Analytics and observability

- Observe coarse picker source/outcome, permission outcome, provider availability category, latency bucket, and save outcome as allowed by DATA-11.
- Intentionally omit Customer identities, device-contact identities, values, typed text, suggestion text, native IDs, action destinations, and provider payloads.
- Operational request counts should identify approaching provider quota without exposing query content.

## Verification obligations

- UX-01 and UX-05: TEST-13.
- UX-02 and UX-03: TEST-08 and TEST-14.
- UX-04: TEST-15.
- UX-06: TEST-16.
- UX-07 through UX-09: TEST-17, TEST-18, TEST-23, and TEST-24.
- UX-10 and UX-11: TEST-19, TEST-20, TEST-26, and TEST-27.
- UX-12 and UX-13: TEST-12, TEST-21, TEST-23, and TEST-24.
- UX-14 and UX-15: TEST-14, TEST-20, and TEST-25.
- UX-16: exact-copy assertions in TEST-14 through TEST-21 where applicable.
