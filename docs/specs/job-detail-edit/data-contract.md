# Job Detail Edit Data Contract

## Scope and terminology

- Canonical business terms: Job, Session, Note, Material, Other cost, Edit draft, Done, explicit date/clock/material breakdown state. **Customer** in this release means the job’s display name string, not a Customer entity.
- Existing source of truth: `public.jobs`, `public.sessions`, `public.notes`, `public.job_costs` (materials and other costs). There is no `customers` table.
- New or changed data boundaries: session date/clock explicitness, material quantity/unit-price explicitness, nullable revenue preserved through the view model, and RPC `public.apply_job_detail_edit` applying an idempotent draft **diff** in one transaction.

## Entities and ownership

| Entity | Meaning | Owner/tenant | Source of truth | Retention/deletion |
|---|---|---|---|---|
| Job | Work record | `jobs.user_id` = auth user | `public.jobs` | Soft-delete `deleted_at` (existing) |
| Session | Visit / time on a job | session `user_id` + parent job owner | `public.sessions` | Soft-delete / `session_status = deleted` (existing) |
| Note | Text on job or session | note `user_id` | `public.notes` | Soft-delete `deleted_at` |
| Material | `job_costs` where cost type is material | cost `user_id` | `public.job_costs` | Soft-delete `deleted_at` |
| Other cost | Non-material `job_costs` | cost `user_id` | `public.job_costs` | Soft-delete `deleted_at` |
| Edit draft | Uncommitted UI snapshot | Device only | Memory | Discarded on Back confirm, kill, or successful Done |

## Fields

| ID | Entity.field | Type/format | Required/default | Meaning and validation | Source | Sensitive? |
|---|---|---|---|---|---|---|
| DATA-01 | jobs.short_description | text | Required, non-blank; **max 60 characters** (client writers clamp) | Job title (hero field) | User | No |
| DATA-01b | jobs.long_description | text null | Optional; blank stored as null | Longer description under the title. Not a completeness field. | User | No |
| DATA-02 | jobs.customer_name | text | Optional, empty string stored as empty/null per existing writer | Customer **display name on the job only**. Not a foreign key. A later Customers feature may add `jobs.customer_id` and keep this as a denormalized label; this RPC must not invent that column. | User | Yes |
| DATA-03 | jobs.service_address | text | Optional | Service address | User | Yes |
| DATA-04 | jobs.revenue_cents | bigint null | Optional; empty field → null; must be ≥ 0 if set | Quoted/earned revenue | User | No |
| DATA-05 | sessions.started_at / ended_at | timestamptz | Required storage bounds for ended sessions | Clock bounds. Missing user date/time may use a synthesized current-date 09:00 local start. `ended_at >= started_at`; zero-duration is valid partial data but is not meaningful work evidence. | User or system | No |
| DATA-06 | sessions.clock_times_explicit | boolean | NOT NULL, default **true** | True when the user set start or end on Edit (or the row came from live/manual time pickers). False for duration-only Edit saves. Existing rows backfill **true**. | User/System | No |
| DATA-07 | sessions.started_tz | text | Set on duration-only and timed saves when known | IANA zone used to interpret the local date / 09:00 synthesis | System | No |
| DATA-08 | notes.body | text | Required non-blank to persist | Note body | User | No |
| DATA-09 | material description, total_cost_cents | text / bigint | Description optional; total ≥ 0 and primary | Total remains user-entered unless both quantity and unit price are explicit, in which case total = round(unit cost × quantity). | User/Derived | No |
| DATA-10 | material quantity, unit, unit_cost_cents, quantity_explicit, unit_cost_explicit | numeric / text / bigint / boolean / boolean | Quantity and unit price are independently optional; numeric values ≥ 0; UOM uses `ea` as its storage fallback | Explicitness flags preserve whether quantity or unit price was actually captured. UOM is shown with a captured breakdown; missing numeric counterparts remain missing after round-trip. | User/System | No |
| DATA-11 | other cost cost_type, cost_type_explicit, total as cost cents, description | enum / boolean / int / text | Type, amount, and description independently optional; amount ≥ 0 | Missing type stores safe enum fallback plus `cost_type_explicit=false`. | User | No |
| DATA-12 | session_id on note/cost | uuid null | Optional | Attach to an **ended** session on this job; exactly one parent (job or session) as today. Removing the session unassigns visible draft children before apply. | User | No |
| DATA-13 | sessions.calendar_date_explicit / clock_start_explicit / clock_end_explicit | boolean | NOT NULL | Records which date and clocks the user actually entered so synthesized storage timestamps are never treated as captured facts. | User/System | No |

Child client ids: new rows use client-generated UUIDs. Create operations are owner/job-safe upserts, so an identical retried Done succeeds without duplicates after a lost response.

## Relationships and lifecycle effects

| Relationship | Cardinality | Creation rule | Update rule | Delete/archive behavior |
|---|---|---|---|---|
| Job → Sessions | 1:N | Manual ended sessions via RPC creates | Times / flag via RPC updates | Soft-delete ids in diff; never in_progress |
| Job/Session → Notes | N | Create with job or ended session parent | Body and parent | Soft-delete |
| Job/Session → Materials / other costs | N | Same parent rule as existing writers | Fields and parent | Soft-delete |
| Live in-progress session | 0..1 per job | Not created by this RPC | Not updated by this RPC | Not deleted by this RPC |

## Invariants and calculations

- Apply is one database transaction. Failure → no partial child or identity writes.
- Diff only: update/delete ids must already belong to the job and user. Unknown ids → reject the transaction.
- Do not delete or update `session_status = 'in_progress'`.
- Do not set `clock_times_explicit = false` on a live (`entry_mode = live`) row.
- When `clock_times_explicit` is false, View **must not** present `timeRangeLabel`; show date + duration only (DATA-06 + REQ-07).
- Duration hours = (`ended_at` − `started_at`) in hours, same as `sessionDurationHours` today.
- Material `total_cost_cents` is primary. Recompute it as `round(unit_cost_cents * quantity)` only when both breakdown values are explicit; otherwise preserve the entered total independently.
- Skip brand-new rows that are completely empty. Persist non-empty partial sessions, materials, and other costs. Blank new notes are omitted; a cleared existing note is deleted. The job title is the only client-side Done blocker.
- A session contributes to `last_worked_at`, record completeness, or automatic `not_started` → `in_progress` only when it has an explicit calendar date and meaningful duration; live sessions retain existing behavior.
- Delete job uses existing `deleteJobById` (not the apply RPC) and is immediate.
- `apply_job_detail_edit` must not create or update a customers table. `payload.job` identity fields are `shortDescription`, `longDescription`, `customerName`, `serviceAddress`, `revenueCents` only.

## Interfaces

| Interface | Direction | Request/event/file shape | Response/result | Auth | Idempotency/versioning |
|---|---|---|---|---|---|
| `public.apply_job_detail_edit(p_job_id uuid, p_payload jsonb)` | Client → DB | See payload below | `{ "status": "ok" }` on success; validation failures **raise** `apply_job_detail_edit:<code>` so the transaction rolls back | `authenticated`; invoker RLS | Same payload retry is owner/job-safe upsert by client ids; not a replace-all |
| `deleteJobById` | Client → DB | Existing | Existing | Existing | Existing |
| `fetchJobDetail` | Client → DB | Existing + session/material explicitness columns | View model includes explicit date/clock flags, nullable revenue, authoritative material total, and nullable quantity/unit cost with explicitness | Existing | — |

### Apply payload (logical)

```json
{
  "job": {
    "shortDescription": "string",
    "longDescription": "string",
    "customerName": "string",
    "serviceAddress": "string",
    "revenueCents": 0
  },
  "sessions": {
    "create": [{ "id": "uuid", "startedAt": "iso", "endedAt": "iso", "calendarDateExplicit": false, "clockStartExplicit": false, "clockEndExplicit": false, "startedTz": "IANA" }],
    "update": [{ "id": "uuid", "startedAt": "iso", "endedAt": "iso", "calendarDateExplicit": true, "clockStartExplicit": true, "clockEndExplicit": true, "startedTz": "IANA" }],
    "deleteIds": ["uuid"]
  },
  "notes": {
    "create": [{ "id": "uuid", "body": "string", "sessionId": null }],
    "update": [{ "id": "uuid", "body": "string", "sessionId": null }],
    "deleteIds": ["uuid"]
  },
  "materials": {
    "create": [{ "id": "uuid", "description": "string", "totalCostCents": 2500, "quantity": 2, "quantityExplicit": true, "unit": "ea", "unitCostCents": null, "unitCostExplicit": false, "sessionId": null }],
    "update": [{ "id": "uuid", "description": "string", "totalCostCents": 2500, "quantity": null, "quantityExplicit": false, "unit": "ea", "unitCostCents": 1250, "unitCostExplicit": true, "sessionId": null }],
    "deleteIds": ["uuid"]
  },
  "otherCosts": {
    "create": [{ "id": "uuid", "costType": "disposal", "description": "", "costCents": 1, "sessionId": null }],
    "update": [{ "id": "uuid", "costType": "disposal", "description": "", "costCents": 1, "sessionId": null }],
    "deleteIds": ["uuid"]
  }
}
```

`revenueCents` may be `null`. Error codes: `unauthorized`, `not_found`, `invalid`, `conflict` (in_progress targeted).

## Authorization, privacy, and retention

- Authentication and ownership boundary: `auth.uid()` must own the job; children must match that job and user (existing RLS + RPC checks).
- RLS/service-role: `SECURITY INVOKER`; revoke default `PUBLIC` execute and grant `EXECUTE` to `authenticated` only. Client-supplied child UUIDs require insert grants on `id` for `sessions`, `notes`, and `job_costs`; upsert conflict handling must re-check user and job ownership rather than overwriting an unrelated row.
- Sensitive fields, logs, analytics: do not log address, customer, note bodies, or full email. Feature-flag evaluation sends the Supabase user UUID as `distinct_id` only. `job_saved` may include counts/buckets already used on `job_saved`.
- Export, deletion, and retention: unchanged; duration-only sessions still appear in job export as time bounds (internal timestamps). Export is not updated in this feature.

## Migration and compatibility

- Existing-row behavior: existing sessions retain captured date/clock semantics. Existing material rows backfill quantity and unit-price explicitness to true because the legacy material forms captured both values; new total-only rows write both flags false.
- Backfill: new explicitness columns receive deterministic values that preserve the existing View/Edit presentation; new writes always provide explicitness in the RPC payload.
- Old-client compatibility: old app does not send the flag; View still formats a time range from `started_at`/`ended_at`, so duration-only sessions created by a new client may show 9:00–10:00 on old builds.
- Rollback or forward-fix: drop RPC and stop calling it; column can remain (harmless). Forward-fix View hide rule is the honest display.

## Cost and quota envelope

- Free-tier resources consumed: one Postgres function invocation and a handful of row writes per Done (typically less than today’s N sheet round-trips).
- Expected usage: a few Dones per job per day per user.
- Limit/upgrade trigger: ordinary DB CPU/row volume, not a new product quota.
- Lock-in: none beyond existing Supabase.

## Verification obligations

- Column default true; new duration-only false (TEST-09, TEST-10).
- RPC transaction atomicity and in_progress rejection (TEST-07, TEST-15, TEST-18).
- Material total calculation (TEST-11).
- RLS: other user’s job rejected (TEST-18).
