# Inbox, New Job, Quick Capture, Live Session Data Contract

## Scope and terminology

- **Inbox item** — note or material with `job_id IS NULL AND session_id IS NULL` (existing definition in [`packages/api-client/src/inbox.ts`](../../../packages/api-client/src/inbox.ts)).
- **Composer draft** — in-memory New Job snapshot until **Add Job**; not persisted to disk.
- **Live capture** — note/material rows parented to the active `in_progress` session (or job+session per existing writers).
- **Job identity (live)** — `jobs.short_description`, `jobs.long_description`, `jobs.customer_name`, `jobs.service_address`, `jobs.revenue_cents` updated immediately from the overlay via `updateJobById`, not via Edit draft RPC.

No new tables. Optional additive API helper for title-required job create.

## Entities and ownership

| Entity | Meaning | Owner/tenant | Source of truth | Retention/deletion |
|---|---|---|---|---|
| Inbox note | Unassigned quick note | `notes.user_id` | `public.notes` | Soft-delete; assign sets `job_id` |
| Inbox material | Unassigned quick material | `job_costs.user_id` | `public.job_costs` | Soft-delete; assign sets `job_id` |
| Job (composer create) | New work record | `jobs.user_id` | `public.jobs` | Created only on **Add Job** |
| Live session | In-progress timer | `sessions.user_id` | `public.sessions` | Unchanged; one per user |
| Live session children | Notes/materials on live session | row `user_id` | `notes` / `job_costs` | Immediate CRUD |

## Fields

| ID | Entity.field | Type/format | Required/default | Meaning and validation | Source | Sensitive? |
|---|---|---|---|---|---|---|
| DATA-C01 | composer.title | text | Required to commit; max 60 | Job title; no default `Untitled Job` | User | No |
| DATA-C02 | composer.longDescription | text | Optional | Maps to `jobs.long_description` | User | No |
| DATA-C03 | composer.customerName | text | Optional | Maps to `jobs.customer_name` | User | Yes |
| DATA-C04 | composer.serviceAddress | text | Optional | Maps to `jobs.service_address` | User | Yes |
| DATA-C05 | composer.revenueCents | bigint null | Optional ≥ 0 | Maps to `jobs.revenue_cents` | User | No |
| DATA-C06 | composer.children | draft arrays | Optional | Sessions, materials, other costs, notes — same shapes as Edit draft | User | No |
| DATA-Q01 | note.body | text | Non-blank trim | Quick Note / Inbox note minimum | User | No |
| DATA-Q02 | material.description | text | Non-blank trim | Quick Material minimum | User | No |
| DATA-Q03 | material.total_cost_cents | bigint | ≥ 0; required with description | Total-first minimum; qty/unit optional | User | No |
| DATA-I01 | inbox assign jobId | uuid | Required on assign | Sets `job_id`; `session_id` stays null | User | No |
| DATA-L01 | live session started_at | timestamptz | Existing | Editable in place on overlay | User | No |
| DATA-L02 | live note/material parent | session id | Live session id | `createNote` / `createMaterial` with `sessionId` | System | No |
| DATA-L03 | live job identity patch | partial job | Per `updateJobById` | Immediate field updates from overlay | User | Yes for PII fields |

## Relationships and lifecycle effects

| Relationship | Cardinality | Creation rule | Update rule | Delete/archive behavior |
|---|---|---|---|---|
| User → Inbox items | 0:N | Quick capture create with null parents | Inbox edit updates body/fields | Swipe delete soft-deletes |
| Inbox item → Job | 0:1 | Assign sets `job_id` | Does not auto-pick session | Item leaves Inbox list |
| Composer → Job | 0:1 | **Add Job** insert | N/A until committed | Dismiss = no row |
| Composer children → Job | 0:N | After insert via apply RPC if draft non-empty | N/A at compose time | Same as Edit Done rules for partial rows |
| Live session → captures | 1:N | Immediate create on overlay | Immediate update/delete | End session keeps rows on job |

## Invariants and calculations

- **Create job:** `short_description` = trimmed composer title; must be non-blank. Do **not** call `createBlankJobForCurrentUser` on flag-on path.
- **Material minimum (quick/Inbox):** `description` + `total_cost_cents` sufficient to save; omitted quantity or unit cost is stored as `null` with its explicitness flag set to `false`, so the total remains authoritative.
- **Inbox assign:** `updateNote(id, { jobId, sessionId: null })` or `updateMaterial(id, { jobId, sessionId: null })`.
- **Live identity:** `updateJobById` rejects or skips blank `shortDescription`; other fields may be cleared to empty string/null per existing normalizer.
- **Live capture:** `createNote({ sessionId: liveId, jobId: liveJobId, body })` / `createMaterial({ sessionId: liveId, jobId: liveJobId, ... })` — exact parent shape matches existing live overlay writers.
- **No `apply_job_detail_edit` from live overlay.** Composer-at-create may use apply RPC once for bundled children.
- Confirm-none timestamps (`no_revenue_confirmed_at`, `materials_reviewed_at`, `other_costs_reviewed_at`) are **not** writable from live overlay.
- One in-progress session per user (`sessions_one_active_per_user_idx`).

## Interfaces

| Interface | Direction | Request/event shape | Response/result | Auth | Idempotency |
|---|---|---|---|---|---|
| `createJobForCurrentUser` (new or extended) | Client → DB | `{ shortDescription, ...optional identity }` insert | `jobId` | Owner RLS | New insert each call |
| `apply_job_detail_edit_atomic` | Client → DB | Composer children only after create | `{ status: 'ok' }` | Owner | Client ids on creates |
| `createNote` / `updateNote` / `deleteNote` | Client → DB | Existing | Existing | Owner | Existing |
| `createMaterial` / `updateMaterial` / `deleteMaterial` | Client → DB | Existing | Existing | Owner | Existing |
| `updateJobById` | Client → DB | Partial `UpdateJobInput` | void | Owner | Last write wins |
| `createLiveSession` / `updateLiveSessionStartedAt` / end APIs | Client → DB | Existing | Existing | Owner | `23505` on duplicate live |
| `listInboxNotes` / `listInboxMaterials` | Client → DB | Existing | Inbox items | Owner | — |
| `job-detail-fullscreen-edit` flag | Client → PostHog | Existing | boolean | UUID distinct_id | Fail closed to legacy |

## Authorization, privacy, and retention

- All writes: authenticated owner only (existing RLS).
- Inbox lists only current user’s unassigned rows.
- Customer name and service address on live overlay follow same sensitivity as Job Edit; no new analytics fields with raw PII.

## Migration and compatibility

- **Flag off:** `createBlankJobForCurrentUser` + `initialEditOpen` unchanged; Inbox tap → assign; legacy material sheet validation; legacy live UI.
- **Flag on:** new code paths only; no required schema migration.
- Additive `createJobForCurrentUser(client, { shortDescription, ... })` recommended; may share normalizer with `updateJobById` / apply payload.
- Old clients: unaffected until flag enabled for user.

## Cost and quota envelope

- Composer with children: 1 insert + 0–1 apply RPC (vs today’s insert + Edit Done loop).
- Live immediate persist: N small updates (acceptable; same as legacy overlay sheet saves).
- No new third-party dependency.

## Verification obligations

- TEST-N01–N03, TEST-Q01–Q02, TEST-I01–I03, TEST-L04–L05, TEST-F02; blank title rejected on create and live identity patch.
