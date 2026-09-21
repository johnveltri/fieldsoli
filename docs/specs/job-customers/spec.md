# Job Customers — Product Specification

**Status:** Approved product spec

**Feature source:** Plan Customers Table UX / Job Customer convenience flow

**Feature slug:** `job-customers`

**Last updated:** 2026-09-20

## Product intent

Customer information exists to make creating and working a Job faster. It is not a standalone CRM. A Job remains FieldSoli's economic and recall record; a Customer is a lightweight reusable identity and a set of current defaults.

The canonical domain noun is **Customer** in both the product and backend. Reusable records live in `customers`; device Contacts are only an optional import source.

## Goals

- Reuse recent customer details without retyping them.
- Add phone and email to the existing Job customer snapshot.
- Make the same customer workflow available in Job Edit and Live Session.
- Import one person's details from device contacts without bulk contact access or a separate sync workflow.
- Improve service-address entry while always preserving a free-text path.
- Keep ongoing provider cost compatible with a free app and make the address provider replaceable.
- Preserve historical Job and issued-document snapshots.

## Scope

- Smallest useful release: reusable Customers embedded in Job workflows, without a Customer destination.
- Users: authenticated FieldSoli operators creating or editing their own Jobs.
- Surfaces: Job Edit, Live Session, Job View, device contact picker, and address suggestion picker.
- Dependent constraints: existing Job soft deletion/restoration, atomic Job edits, issued-document snapshot integrity, and account export/deletion behavior.

## Non-goals

- A Customers tab, profile, detail screen, notes, history, or CRM workflow.
- Multiple saved addresses, phones, or emails per Customer.
- Bulk device-contact import, background sync, or writing to device contacts.
- User-visible duplicate merging or cleanup.
- Backfilling Customers from existing historical Jobs.
- Customer CSV export in this iteration.
- Package-deliverability address validation.
- Rewriting already-issued quotes, invoices, or receipts.

## Requirements

### REQ-01 — Job-owned customer snapshot

Every Job owns its exact `customer_name`, `customer_phone`, `customer_email`, and `service_address` values and may reference one `customer_id`. Editing a Customer or another Job never silently changes that snapshot. Issued documents remain immutable snapshots of the values used when issued.

### REQ-02 — Reusable Customer eligibility

A reusable Customer is eligible only when an active Job snapshot has:

```text
non-empty name + (valid phone OR valid email OR meaningful service address)
```

A meaningful service address is trimmed text containing at least five characters and at least two alphabetic characters. Free-typed addresses qualify; Geoapify selection is not required. A Job may still save with incomplete or invalid customer data.

### REQ-03 — Current defaults and identity

`customer_id` is the identity. Name, phone, email, and address are mutable attributes and are not unique. A Customer holds only the latest reusable defaults. When a linked Job's customer snapshot is saved, those exact values—including explicit clears—become the Customer defaults. Earlier Jobs remain unchanged.

### REQ-04 — Customer picker

The Customer-name field opens a picker. Before typing, it shows up to three unique eligible Customers with the most recently saved active linked Jobs. Typing searches eligible Customers and also returns at most three matches. Each suggestion shows:

- Customer name as the primary line.
- Available phone, email, and last service address together in a compact secondary block.
- Natural wrapping for that secondary block, with truncation only after two full lines.

Selecting a Customer fills all four Job fields. If any affected field already contains a value and the selected Customer differs, the app confirms replacement using the copy in `ux-contract.md`.

### REQ-05 — Job Edit workflow

Job Edit exposes Customer name, Phone, Email, and Service address plus an `Add from Contacts` action. Customer and address picker selections update the edit draft; the Job and reusable Customer persist together only when the user saves Job Edit.

### REQ-06 — Live Session workflow

Live Session exposes the same four editable fields, Customer picker, address picker, and device-contact import. It atomically saves the complete customer snapshot and any linked Customer defaults when the user selects a picker result or blurs a customer field. Customer fields never persist on each keystroke. A pending draft is flushed when focus is intentionally removed as part of minimizing or ending the session.

### REQ-07 — Device contacts

Device contacts are a read-only input source. The app requests access only after the user taps `Add from Contacts` for the first time.

- Denial never blocks manual entry.
- The app stores and transmits only the selected person's chosen values; it does not upload or retain the device address book.
- One available phone, email, or postal address is chosen automatically.
- Multiple values open a compact labeled chooser for that field.
- A missing value contributes a blank value to the import; after any required replacement confirmation, that field is blank.
- A device-contact selection follows the same replacement-confirmation rule as a saved Customer selection.

### REQ-08 — Address autocomplete

Geoapify is the V1 provider. After at least five trimmed characters, including at least two alphabetic characters, and a 300 ms pause, the app requests up to four US address suggestions. A new query cancels or supersedes the prior request. The picker shows `Searching…` while a lookup is in flight, then `No results` when the provider returns none. Provider errors, timeouts, and quota exhaustion hide the suggestion panel instead of showing unavailable copy.

The picker displays the smallest legible app caption style in its footer:

`Powered by Geoapify · © OpenStreetMap contributors`

The attribution is shown only while provider suggestions are visible, remains readable with system text scaling, and links to the appropriate provider/data attribution pages where supported.

Free text is always accepted. No result, timeout, provider outage, authentication failure, or quota exhaustion may block Job saving.

### REQ-09 — Provider and cost boundary

The mobile app consumes a provider-neutral suggestion contract through an authenticated FieldSoli server endpoint. Provider credentials never ship in the app. Jobs store only the user-approved address text and ordinary address components needed by FieldSoli; they do not store Geoapify IDs, raw responses, coordinates, or confidence scores.

The free Geoapify plan is the launch assumption: 3,000 requests per day, no billing card required, and required attribution (verified 2026-09-19). FieldSoli does not automatically upgrade or incur paid overages. At an assumed three to five autocomplete requests per completed address, the provider allowance supports roughly 600–1,000 completed address entries per day; actual usage must be monitored without logging address text. Current terms and limits must be rechecked before release: [Geoapify pricing](https://www.geoapify.com/pricing/), [address autocomplete](https://www.geoapify.com/address-autocomplete/), and [terms](https://www.geoapify.com/terms-and-conditions/).

Geoapify explicitly permits storing/caching address autocomplete results. Saving the user-selected address is therefore expected, not a licensing problem. FieldSoli's decision not to retain provider IDs/raw JSON/coordinates is its own privacy and provider-portability boundary.

### REQ-10 — Matching and duplicates

When no Customer was explicitly selected, the server may link automatically only when there is one unambiguous high-confidence match:

- The same normalized phone and normalized email identify the same Customer; or
- The exact normalized name and one matching normalized phone/email identify one Customer, with no conflicting non-empty identifier.

Name-only and address-only matches never auto-link. Conflicting identifiers never auto-merge. An occasional duplicate is preferable to linking two different people. No merge UI ships in this iteration.

### REQ-11 — Lifecycle, deletion, and restoration

Customer visibility depends on active linked Jobs, not Job workflow status. Deleting a linked Job recomputes the Customer defaults from its most recently updated remaining active linked Job. Deleting its final active Job makes the Customer unavailable everywhere. Restoring a Job recomputes and reactivates the Customer when eligible. The implementation uses recoverable soft deletion for Customers while preserving this user-visible behavior.

If a linked Customer is edited down to name-only or otherwise becomes ineligible, its identity and Job links remain intact, but it is hidden from recent/search suggestions until eligible again.

### REQ-12 — Job View and actions

Job View adds phone and email to the existing compact Customer display alongside name and service address. A transparent person/contact control appears to the left of Edit. It always opens a compact menu—even when only one action is available—and includes only valid actions:

- `Call` for a valid phone.
- `Text` for a valid phone.
- `Email` for a valid email.

Actions use the current Job snapshot, not Customer defaults, and hand off to the device's default app through `tel:`, `sms:`, or `mailto:` links.

### REQ-13 — Validation and normalization

Phone and email fields save permissively. Invalid values remain visible in the Job snapshot but cannot create an eligible Customer, drive automatic matching, or appear as actions. Phone normalization is US-first and accepts explicitly international `+` numbers. Email matching is trimmed and case-insensitive. Display formatting never changes the saved snapshot without a user save.

### REQ-14 — Rollout compatibility

The migration is additive and nullable. Existing Jobs are unchanged and no Customer is inferred from history. A reusable Customer is first created or linked only when the new customer workflow saves or edits a Job. Database and server support deploy before the mobile build. Older clients continue to read/write the legacy customer name/address fields without creating partial Customers.

### REQ-15 — Privacy and disclosure

Customer names, phones, emails, device-contact selections, and address queries are sensitive. They must not enter product analytics, logs, crash breadcrumbs, or error payloads. Analytics may record coarse events and error categories without values. Before public release, FieldSoli's privacy policy, mobile privacy backlog, permission strings, and Apple/Google privacy declarations must cover phone/email collection, explicit device-contact selection, and server-mediated Geoapify address queries.

## Requirement verification map

| Requirement | Planned acceptance evidence |
| --- | --- |
| REQ-01 | TEST-01, TEST-04, TEST-21 |
| REQ-02 | TEST-03, TEST-10 |
| REQ-03 | TEST-04, TEST-07 |
| REQ-04 | TEST-08, TEST-14, TEST-15 |
| REQ-05 | TEST-13 |
| REQ-06 | TEST-07, TEST-16 |
| REQ-07 | TEST-15, TEST-17, TEST-18, TEST-23, TEST-24 |
| REQ-08 | TEST-19, TEST-20, TEST-26, TEST-27 |
| REQ-09 | TEST-09, TEST-11, TEST-26, TEST-27 |
| REQ-10 | TEST-05 |
| REQ-11 | TEST-06 |
| REQ-12 | TEST-12, TEST-21, TEST-23, TEST-24 |
| REQ-13 | TEST-03, TEST-10, TEST-12 |
| REQ-14 | TEST-01 |
| REQ-15 | TEST-02, TEST-09, TEST-22, TEST-28 |

## Artifact manifest

| Artifact | Applicability | Path | Rationale |
| --- | --- | --- | --- |
| State model | Required | `docs/specs/job-customers/state-model.md` | Linking, soft deletion, restoration, asynchronous lookup, and retry change meaningful state. |
| Data contract | Required | `docs/specs/job-customers/data-contract.md` | The feature adds owned data, imports device/provider values, changes migrations, and introduces an external provider boundary. |
| UX contract | Required | `docs/specs/job-customers/ux-contract.md` | Three existing user-visible surfaces and two picker flows change. |
| Test contract | Required | `docs/specs/job-customers/test-contract.md` | Proof spans database, RLS, provider, mobile, native permission, accessibility, and release boundaries. |

## Product constraints

- Preserve FieldSoli's field-speed simplicity and existing Job-detail interaction language.
- Avoid a new CRM navigation or management burden.
- Treat Customer and address data as sensitive; least privilege and redaction are required.
- Launch within Geoapify's free-plan envelope with attribution and a failure-open manual path.
- Require an app-store binary for native contact configuration; deploy additive backend support first.

## Approved decision summary

- Canonical product and backend entity: Customer (`customers`, `jobs.customer_id`).
- Four recent Customers.
- Phone, email, and address share one wrapping metadata block, maximum two lines in picker results.
- Live Session has full parity with Job Edit.
- Live customer data saves on picker selection or field blur.
- `Add from Contacts` remains a visible row action; permission is just-in-time.
- The Job View action always opens a menu.
- Geoapify launches with minimum-size compliant attribution and manual fallback.
- The address-provider boundary is swappable without migrating Jobs.

## Deferred decisions

The following require a separate feature decision rather than incidental implementation:

- Customer screen/profile/history.
- User-directed merge/split tools.
- Multiple properties or contact methods.
- Customer-specific export.
- International address-provider expansion.
- Paid address-provider upgrade or an automatic failover provider.

## Success signals

- Users can select a recent Customer and populate all available details with one choice.
- Manual entry remains fully functional without permissions or provider availability.
- No historical Job snapshot changes when another Job or Customer is edited.
- No sensitive customer values appear in telemetry.
- Address-provider consumption stays within the configured free-plan budget, or fails open to manual entry.

## Acceptance scenarios

- Given an eligible recent Customer, when the user selects it, then all four fields populate and save as this Job's independent snapshot.
- Given non-empty draft fields, when a different Customer/device contact is selected, then nothing changes until the user confirms `Replace`.
- Given a Live Session customer edit, when the user types, then no customer write occurs until selection, blur, minimize flush, or end-session flush.
- Given device-contact access is denied, when the user returns to the editor, then manual entry remains fully usable.
- Given address suggestions fail or return no result, when the user keeps the typed address and saves, then the Job saves successfully.
- Given a linked Customer's newest Job is deleted, when another active linked Job remains, then defaults recompute without changing that remaining Job.
- Given an older Job, when Customer defaults later change, then Job View and contact actions still use the older Job snapshot.

## Agent-decided assumptions

- Customer deletion is implemented as soft deletion so restoring a soft-deleted Job can recover the same identity.
- Most-recent Customer defaults/recents use active linked Job `updated_at desc, id desc`; this aligns Customer use with an explicit save/edit and supplies deterministic ties.
- The mobile client searches Customer display names only in V1; metadata differentiates results but is not a broad PII search surface.
- A maintained standards-based phone library will supply validity/E.164 parsing; implementation must verify its exact version and footprint.

## Open blockers

None for implementation. Geoapify credentials, current terms confirmation, native permission inspection, legal/store updates, and physical-device evidence are release prerequisites tracked by the plan and TEST-23 through TEST-28.
