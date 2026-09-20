# Job Customers — Data Contract

## Scope and terminology

- Canonical user term: Customer.
- Canonical backend term: Customer (`public.customers`).
- Existing source of truth: each `public.jobs` row owns its customer name/service-address snapshot.
- New boundaries: Customer defaults/linking, Job phone/email snapshots, device-contact selection, and server-mediated address suggestions.

## Entities and ownership

| Entity | Meaning | Owner | Source of truth | Retention/deletion |
| --- | --- | --- | --- | --- |
| Job customer snapshot | Values used for this Job | Authenticated Job owner | `public.jobs` | Existing Job soft-delete/account-delete behavior |
| Customer | Reusable current defaults and identity | Same authenticated user | `public.customers` | Soft-delete with no active Jobs; account deletion cascades |
| Device-contact selection | One-time input chosen by user | Device user | Native OS result until copied into draft | Unchosen values/IDs immediately discarded |
| Address suggestion | Ephemeral provider result | Provider during request | Edge Function response | Not retained after picker session except approved Job address text/components |

## DATA-01 — Additive Job columns

Add nullable columns to `public.jobs`:

| Column | Type | Rules |
| --- | --- | --- |
| `customer_id` | `uuid null` | FK to `public.customers(id)`; preserve through ordinary Customer soft deletion |
| `customer_phone` | `text null` | Exact user snapshot after trim policy; invalid values allowed |
| `customer_email` | `text null` | Exact user snapshot after trim policy; invalid values allowed |

Existing `customer_name` and `service_address` remain the Job-owned snapshot fields. Existing rows are not modified or backfilled.

## DATA-02 — Customers table

Create `public.customers`:

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated server-side |
| `user_id` | `uuid` | Required owner FK to `auth.users`; cascade on account deletion |
| `display_name` | `text` | Current default; trimmed; may be empty only for an already-linked hidden Customer |
| `phone` | `text null` | Current exact display/default value |
| `email` | `text null` | Current exact display/default value |
| `last_service_address` | `text null` | Current exact display/default value; not a permanent/home-address claim |
| `normalized_name` | `text` | Server-derived matching value |
| `normalized_phone` | `text null` | Server-derived only when phone is valid |
| `normalized_email` | `text null` | Server-derived only when email is valid |
| `deleted_at` | `timestamptz null` | Recoverable inactive state when no active linked Jobs exist |
| `created_at` | `timestamptz` | Server default |
| `updated_at` | `timestamptz` | Server maintained |

No uniqueness constraint exists on name, phone, email, address, or normalized variants. `last_used_at` is intentionally absent; recency derives from active linked Jobs.

## DATA-03 — Ownership, RLS, and grants

- Enable and force RLS on `customers`.
- A user may read only owned active Customers through the application query/RPC surface.
- Direct writes from the mobile role are not the authoritative mutation path; SECURITY DEFINER RPCs validate `auth.uid()` and ownership before mutations.
- Add explicit table/sequence/function grants following the repository's hardened privilege pattern.
- Every Job-to-Customer mutation verifies `jobs.user_id = customers.user_id = auth.uid()`.
- Service-role access remains server-only and is not exposed through `EXPO_PUBLIC_*` configuration.

## DATA-04 — Normalization

Normalization is server-authoritative and mirrored client-side only for immediate UX.

- Name: Unicode normalize, trim, collapse internal whitespace, and case-fold for matching. Preserve display text separately.
- Phone: parse with a standards-based phone parser using US as the default region; accept explicit international `+` values; store an E.164 normalized value only when valid.
- Email: trim, case-fold for comparison, and require a syntactically valid address before populating `normalized_email`.
- Address eligibility: trim; require at least five characters and two Unicode alphabetic characters. Address is never an identity match key.

The implementation should use a maintained open-source phone parser such as `libphonenumber-js` rather than a custom regex. Its exact version and bundle impact must be verified during implementation.

## DATA-05 — Atomic customer mutation RPC

Add an authenticated server mutation that accepts the full snapshot rather than independent field patches:

```ts
type SaveJobCustomerInput = {
  jobId: string;
  expectedJobUpdatedAt?: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceAddress?: string | null;
};
```

The transaction:

1. Locks and verifies the owned active Job.
2. Normalizes candidate values.
3. Honors an explicit owned `customerId` without heuristic reassignment.
4. If unlinked and eligible, performs DATA-06 matching; otherwise creates a Customer.
5. Writes all four Job snapshot fields and the resolved `customer_id` together.
6. Writes the exact snapshot into the linked Customer defaults, including explicit clears.
7. Updates timestamps and returns the authoritative Job/customer view.

If the snapshot is ineligible and unlinked, it writes only the Job. If it is ineligible but already linked, it keeps the link, writes exact defaults, and makes the Customer ineligible for discovery.

Job Edit should extend or supersede the existing atomic Job-detail RPC so one `Done` action cannot partially persist customer fields. Live Session must use the same customer transaction rather than separate `updateJobById` field writes.

## DATA-06 — Conservative match contract

For an eligible snapshot without an explicit Customer:

1. If both normalized phone and email are present, auto-link only when both resolve to the same single owned active Customer and neither conflicts.
2. Otherwise, auto-link only when exact normalized name plus one normalized phone/email resolves to one owned active Customer and every other non-empty identifier is equal or absent on one side.
3. If signals resolve to different Customers, more than one candidate remains, or a non-empty identifier conflicts, create a new Customer.
4. Never use address or name alone to link.

Automatic duplicate consolidation, if implemented inside this transaction, may occur only under the same unambiguous rules and must preserve all historical Job snapshots. No user-visible merge endpoint is in scope.

## DATA-07 — Recency and recomputation

The authoritative source Job is the active linked Job ordered by:

```sql
jobs.updated_at desc, jobs.id desc
```

This order drives both Customer-default recomputation and recent-Customer ordering. Search/recent queries:

- Exclude soft-deleted Customers.
- Exclude Customers whose current defaults fail REQ-02.
- Require at least one active linked Job.
- Return four rows for the blank-query recent state.
- Return at most five rows for a typed query.

Deleting/restoring a Job and recomputing its Customer occur in one transaction. Deleting the final active linked Job sets `customers.deleted_at`; restoring a linked Job clears it before recomputing.

## DATA-08 — Customer search response

The mobile-facing response contains only fields needed by the picker:

```ts
type CustomerSuggestion = {
  customerId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  serviceAddress: string | null;
};
```

Search is owner-scoped and case/accent-insensitive over display name. Phone/email/address are presentation metadata, not broad searchable identity inputs in V1.

## DATA-09 — Address autocomplete boundary

Expose an authenticated Supabase Edge Function such as `address-autocomplete`. The provider key lives in server secrets.

Request:

```ts
type AddressAutocompleteRequest = {
  query: string;
  countryCode: "us";
  limit: 5;
};
```

Provider-neutral response:

```ts
type AddressSuggestion = {
  token: string; // ephemeral within this response/session; never persisted
  displayAddress: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
};
```

The function rejects unauthenticated calls, enforces input limits, applies per-user abuse controls, sets short upstream timeouts, caps output at five, and returns typed coarse error codes. Logs redact query strings and provider payloads. Provider-specific parsing is isolated behind an adapter so a future provider switch does not alter mobile/domain types.

The selected suggestion may populate the Job's address text/components, but FieldSoli does not persist the response token, Geoapify IDs, raw JSON, coordinates, or confidence values.

## DATA-10 — Device-contact boundary

Device-contact data remains local until the user selects a person and confirms any replacement. Only the chosen name/phone/email/address values enter the ordinary Job customer mutation. No device-contact identifier, address-book snapshot, permission state, or unselected value is stored server-side.

On Android, block generated `WRITE_CONTACTS` permission and request only read access required by the chosen native API. On iOS, prefer the native single-contact picker and its least-privilege behavior. Validate exact Expo SDK 57 APIs and generated manifests during implementation.

## DATA-11 — Telemetry contract

Allowed event properties:

- Surface: Job Edit or Live Session.
- Source: recent, search, device contact, address autocomplete, or manual.
- Outcome: selected, cancelled, no result, permission denied, provider unavailable, or saved.
- Query-length bucket and latency bucket.
- Coarse provider error category.

Forbidden properties include Customer IDs, device-contact IDs, names, phone numbers, emails, addresses, typed queries, suggestion text, and raw provider errors containing request data.

## DATA-12 — Compatibility and migration

- Ship one forward-only migration; never edit prior migrations.
- Add nullable Job columns and the Customers table before shipping the mobile client.
- Regenerate `packages/api-client/src/database.types.ts` from the resulting schema.
- Existing rows keep `customer_id`, phone, and email null.
- Older clients may continue updating name/address through legacy paths; those writes do not create or update Customers.
- New clients invoke the customer RPC only after an explicit new/edit workflow interaction.
- Account export/deletion behavior must be reviewed so customer data is portable and fully removed with the account, without adding a standalone Customer CSV in this scope.

## DATA-13 — Failure and retry semantics

- Customer transaction failure is all-or-nothing.
- Live Session retains the dirty draft and may retry explicitly or on the next qualifying blur/flush.
- Address lookup failures are read-only and never affect the Job mutation.
- A stale address response cannot replace text from a newer query.
- Conflict handling returns the latest server snapshot; it must not silently overwrite a newer edit from another client.

## Relationships and lifecycle effects

| Relationship | Cardinality | Creation/update rule | Delete/archive behavior |
| --- | --- | --- | --- |
| User → Customer | One-to-many | Server assigns `user_id = auth.uid()` | Account deletion cascades |
| Customer → Jobs | One-to-many; Job link optional | Explicit selection or DATA-06 resolution | Job soft deletion recomputes; final active link soft-deletes Customer |
| Job → issued document | Existing snapshot relationship | Document copies Job customer values at issue time | Later Job/Customer edits do not rewrite document |
| Address provider → Job | No durable provider relationship | User selects/edits display address | Provider token/raw result is discarded |
| Device contact → Job | No durable native relationship | User chooses values and confirms replacement | Native ID/alternatives are discarded |

## Authorization, privacy, and retention summary

- Client authentication and server-side ownership validation are required for every Customer query/mutation and address request.
- The chosen customer values follow existing Job/account retention and export obligations.
- Unselected device contacts and unselected provider results have no server retention.
- Logs, telemetry, and errors follow DATA-11 redaction rules.
- Account deletion permanently removes Customers and new Job fields through the existing deletion workflow; TEST-28 verifies the maintained policy and implementation agree.

## Cost and quota envelope

- External metered resource: Geoapify autocomplete requests, currently assumed at 3,000/day on the free plan with attribution and no billing card.
- Expected unit consumption: one request per eligible debounced query; approximately three to five requests per completed address is the planning assumption, yielding roughly 600–1,000 completed entries/day at the project level.
- Controls: five-character/two-letter threshold, 300 ms debounce, stale cancellation, result cap five, per-user server abuse limit, and coarse request-count monitoring without query text.
- Limit behavior: return provider-unavailable and keep free-text save; never auto-upgrade or invoke a paid fallback.
- Lock-in boundary: Geoapify adapter and attribution are provider-specific; mobile/domain data and persisted Jobs are not.
- Revalidate current pricing, terms, attribution, and API behavior at implementation and release because provider terms can change.

## Verification obligations

- DATA-01 through DATA-03: TEST-01 and TEST-02.
- DATA-04: TEST-03 and TEST-10.
- DATA-05 through DATA-07: TEST-04 through TEST-08.
- DATA-08: TEST-08 and TEST-11.
- DATA-09: TEST-09, TEST-11, TEST-19, TEST-26, and TEST-27.
- DATA-10: TEST-17, TEST-18, TEST-23, and TEST-24.
- DATA-11: TEST-22.
- DATA-12: TEST-01 and TEST-28.
- DATA-13: TEST-07, TEST-16, TEST-19, and TEST-27.
