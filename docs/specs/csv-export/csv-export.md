# Job Summary CSV Export

**Status:** Approved implementation contract

**Version:** V1

**Last updated:** 2026-09-11

## Summary

FieldSoli lets an authenticated user request a CSV summary of completed jobs for one calendar year. The server generates the file, stores it temporarily in a private Supabase Storage bucket, and emails a secure download link to the user's verified account email.

The link stops working 24 hours after the first email-provider attempt begins. A daily cleanup at midnight UTC deletes expired private files through the Storage API. Depending on when a link expires, an inaccessible file may remain privately stored until the next midnight UTC cleanup.

V1 is a job-level portability feature. It is not a Schedule C, tax return, invoice export, transaction ledger, or full account backup.

Estimated Tax Set-Aside is specified separately in [estimated-tax-set-aside.md](./estimated-tax-set-aside.md).

## Product behavior

### Entry point and year list

1. Open **Profile**.
2. Under **Your data**, select **Export Job Summary**.
3. The app reads the authenticated Auth user's `created_at` and the device's current IANA time zone.
4. It shows every year from the account-creation year through the current year, inclusive, newest first, with the current year selected.

Examples:

- Account created in 2026 and current year 2026: `2026`
- Account created in 2026 and current year 2027: `2027`, `2026`
- Account created in 2027 and current year 2027: `2027`

The app does not query job data to construct or filter the list. An empty year remains selectable. The server is authoritative when the user presses **Request Export**.

If the account timestamp or IANA time zone is unavailable, the app shows a retryable loading error rather than guessing.

### Request screen

The screen shows:

- the **EXPORT JOBS** heading, including after the user submits a request;
- the selected year;
- the verified account email that will receive the link;
- that the CSV includes completed jobs, customer names, service addresses, job details, revenue, and direct costs.

The recipient is not editable. The app makes no export-specific network request until the user presses **Request Export** and disables the button only while that request is in flight.

### Confirmation and empty states

After durable acceptance:

> Export requested
>
> Your 2026 job export has been requested. It will be delivered to **name@example.com** within 15 minutes. The download link expires within 24 hours from receipt.
>
> CTA: **Back to Home**

If the authoritative server query finds no eligible jobs:

> No completed jobs found for 2026.
>
> CTA: **Back to Home**

An empty request creates no export record, queue message, file, quota use, or email.

For a rate limit, show the server-provided retry time. Other synchronous failures use:

> Couldn't request your export. Try again later.

There is no client-side eligibility check, persisted cooldown, polling state, preparing state, or asynchronous failure screen. **Back to Home** closes both the export and Profile overlays.

## Eligibility and reporting year

Include one row for each job where:

- `user_id` is the authenticated request owner;
- `job_work_status = completed`;
- `deleted_at IS NULL`; and
- `completed_at` falls from local January 1 inclusive through the following local January 1 exclusive in the validated reporting time zone.

Payment status does not control eligibility. Created, last-worked, and paid dates do not determine the reporting year.

The server validates that the selected year falls between the Auth account-creation year and current year, inclusive, in the request's reporting time zone.

For the one-time launch migration, existing completed jobs with a null `completed_at` use `last_worked_at`, and existing paid jobs with a null `paid_at` use `last_worked_at`. Rows without `last_worked_at` remain null rather than guessing from `updated_at`, sessions, or other inferred data. Future transitions always use the database transition time.

## Lifecycle timestamps

Add:

- `jobs.completed_at timestamptz`
- `jobs.paid_at timestamptz`

Maintain them in the database:

- Entering or re-entering `completed` sets `completed_at` to the transition time.
- Leaving `completed` preserves the timestamp.
- Entering or re-entering the derived `paid` state sets `paid_at` to the transition time.
- Becoming unpaid or partially paid preserves the timestamp, but `paid_date` exports blank unless the job is currently paid.
- Payment-only edits do not change `completed_at`.
- New inserts are handled defensively; the launch migration applies the explicit `last_worked_at` backfill policy above.

Use the existing `jobs.last_worked_at` for `last_worked_date`.

## CSV contract

Filename: `fieldsoli-job-summary-YYYY.csv`

The fixed columns, in order, are:

| # | Column | Source and null behavior |
|---:|---|---|
| 1 | `job_id` | `jobs.id`; always present |
| 2 | `job_description` | `jobs.short_description`; always present |
| 3 | `long_description` | `jobs.long_description`; blank when null |
| 4 | `customer_name` | `jobs.customer_name`; blank when null |
| 5 | `service_address` | Current formatted address; blank when null |
| 6 | `work_status` | Current work status |
| 7 | `payment_status` | Current derived payment state |
| 8 | `created_date` | `created_at` as reporting-zone `YYYY-MM-DD` |
| 9 | `last_worked_date` | Existing `last_worked_at` as reporting-zone `YYYY-MM-DD`; blank when null |
| 10 | `completed_date` | `completed_at` as reporting-zone `YYYY-MM-DD` |
| 11 | `paid_date` | `paid_at` as reporting-zone `YYYY-MM-DD` only when currently paid; otherwise blank |
| 12 | `revenue` | `revenue_cents`; blank when null |
| 13 | `material_cost` | Active `material` costs; `0.00` when absent |
| 14 | `helper_labor_cost` | Active `helper_labor` costs; `0.00` when absent |
| 15 | `equipment_rental_cost` | Active `equipment_rental` costs; `0.00` when absent |
| 16 | `permit_cost` | Active `permit` costs; `0.00` when absent |
| 17 | `disposal_cost` | Active `disposal` costs; `0.00` when absent |
| 18 | `travel_parking_cost` | Active `travel_parking` costs; `0.00` when absent |
| 19 | `other_cost` | Active `other` costs; `0.00` when absent |
| 20 | `total_costs` | Sum of all seven cost columns |
| 21 | `net_earnings` | Revenue minus total costs; blank when revenue is null and may be negative |

`long_description` exports optional Job View/Edit body copy added in Phase 2. It is separate from the title in `job_description`.

Cost aggregation includes active costs linked directly to the job or through an active job session. Exclude deleted costs, costs attached only to deleted sessions, and unassigned Inbox costs. Count each `job_costs.id` once and use stored `total_cost_cents`.

Formatting rules:

- Keyset-page 500 jobs at a time; do not rely on the Data API's 1,000-row default.
- Sort by `completed_at DESC`, `created_at DESC`, then `job_id ASC`.
- Keep money in integer cents until rendering two decimal places without symbols or thousands separators.
- Encode UTF-8 with BOM and use RFC-4180 quoting with CRLF rows.
- Prefix text starting with `=`, `+`, `-`, `@`, tab, or carriage return with an apostrophe.
- Never log job contents, customer data, exact amounts, emails, tokens, or download URLs.

## Request and processing architecture

### Client contract

The mobile client exposes only:

```ts
requestJobExport({ year, timeZone }): Promise<
  | { status: "confirmed"; requestId: string; recipientEmail: string; deduplicated: boolean }
  | { status: "no_eligible_jobs" }
  | { status: "rate_limited"; retryAt: string }
>
```

Do not add year-list, eligibility-check, or status-polling endpoints for V1.

### Authenticated request function

`request-job-export` accepts only:

```json
{ "year": 2026, "time_zone": "America/Chicago" }
```

It performs a fresh Auth lookup, requires a confirmed email, validates the IANA time zone/year range, checks owner-scoped eligibility, and serializes acceptance per user.

- `202`: newly accepted confirmation
- `200`: in-flight same-year duplicate confirmation
- `200`: `no_eligible_jobs`
- `429`: `rate_limited` with `retry_at` and `Retry-After`
- `401`: invalid identity
- `422`: invalid input or unverified email
- `503`: failure before durable acceptance

Different years may be requested immediately. A newly accepted request for the same year is allowed every 15 minutes. An in-flight same-year duplicate is queued, processing, or ready and not yet sent; it does not consume quota or send another email. A sent, failed, expired, or revoked request does not block a later same-year request once 15 minutes have passed since that year's last newly accepted request.

The request row and queue message are committed atomically.

### Private state

Use one private `job_export_requests` table for request identity, generation/delivery states, artifact metadata, token hash/expiry, Resend ID, attempts, next retry time, and coarse failure code. Grant no client access.

Use one private `job-exports` bucket with CSV-only uploads, a 25 MiB limit, `Cache-Control: no-store`, and object paths `<user_id>/<request_id>/job-summary.csv`.

Use one Basic PGMQ queue, `job_exports`, containing request IDs only. PGMQ visibility timeout is the worker lease; do not create separate queue, delivery, cleanup, lease, or alert tables.

### Worker

Invoke `process-job-exports` every minute. The same message progresses through generation and email delivery:

1. Generate and upload if the artifact is not ready.
2. Reuse the ready artifact after retries or restarts.
3. Send the frozen email payload.
4. Delete the queue message only after Resend accepts the email.

Retry transient failures after 1, 2, 4, and 8 minutes, for five total attempts. Terminal failure marks the applicable state failed, deletes any object through the Storage API, and emits a coarse operational error.

## Email contract

Render version-controlled HTML and plain text in the Edge Function. Do not use Supabase Auth templates, Resend-hosted templates, SMTP, or an attachment.

Envelope:

- From: `FieldSoli <noreply@fieldsoli.com>`
- Reply-To: `support@fieldsoli.com`
- To: verified Auth email frozen at acceptance
- Subject: `Your YYYY FieldSoli job export is ready`
- Preview: `Download your YYYY job summary CSV before the secure link expires.`
- Resend idempotency key: `job-export/<request_id>`
- Optional tag: `category=job_export`

The HTML and plain-text versions contain the same information:

1. FieldSoli text brand header.
2. **Your job export is ready**.
3. `Your YYYY FieldSoli job summary CSV is ready to download.`
4. **Download CSV** button.
5. Exact expiry, for example: `This link expires on August 30, 2026 at 3:15 PM CDT (America/Chicago).`
6. `Anyone with this link can download the CSV until it expires. Do not forward or share it.`
7. `The file may contain customer names, service addresses, job descriptions, and financial information. Store it securely.`
8. A visible fallback URL introduced by `If the button does not work, copy and paste this link into your browser:`.
9. `If you did not request this export, do not download it. Contact support@fieldsoli.com.`
10. Minimal FieldSoli footer and support address.

The URL is:

```text
https://fieldsoli.com/exports/download#token=<opaque-token>
```

Derive the opaque 32-byte token as `HMAC-SHA-256(EXPORT_TOKEN_SECRET, request_id)`, format it as `v1.<base64url>`, and persist only its SHA-256 hash. The token does not contain a separately verified signature; redemption still uses the stored hash lookup. Deterministic derivation lets a restarted worker reconstruct the identical email payload without storing bearer plaintext. Freeze `expires_at` at 24 hours after the first Resend attempt begins, then reuse the token, timestamp, HTML, plain text, and `job-export/<request_id>` idempotency key for every retry.

Escape dynamic HTML values. Use a simple table layout and inline styles. Do not include remote images, open tracking, click tracking, unsubscribe copy, CSV attachment, job/customer details, or financial totals.

Resend API acceptance marks delivery `sent`; it does not guarantee inbox delivery. V1 uses the Resend dashboard for later bounce/suppression support rather than a webhook.

## Secure download

The public page is `https://fieldsoli.com/exports/download#token=<token>`.

The page must:

- read the fragment and immediately remove it with `history.replaceState` before network activity;
- POST `{ token }` to `redeem-job-export`;
- navigate to the returned signed URL; and
- show a generic unavailable state for every failure.

The route has no Vercel Analytics and applies `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `noindex`, and a restrictive CSP.

The redemption function validates strict token shape, hashes it, and returns identical `404 export_unavailable` responses for malformed, unknown, expired, revoked, or deleted requests. A valid request receives a private download-disposition signed URL whose TTL is the lesser of 60 seconds or the remaining bearer-token lifetime.

Do not add a custom download-attempt table in V1.

## Expiry, cleanup, and deletion

Bearer authorization stops immediately at `expires_at`, independently of file cleanup.

Run `cleanup-job-exports` once daily at midnight UTC (`0 0 * * *`). It scans the private table directly, marks expired deliveries, deletes objects through the Storage API, treats an absent object as success, and scrubs recipient email, token hash, provider ID, and object path.

Failed deletion is logged and retried at the next daily run. Raise a higher-priority error if an artifact remains more than 26 hours beyond expiry. Purge scrubbed coarse rows after seven days.

Account deletion or explicit revocation immediately revokes tokens and synchronously deletes remaining objects. Account deletion aborts and can be retried if Storage cleanup fails; it does not wait for the daily job.

## Manual configuration

Perform these steps separately for staging and production.

### Resend

1. Confirm `fieldsoli.com` is verified, sending is enabled, and SPF/DKIM pass.
2. Confirm open and click tracking are disabled. Add/validate DMARC before production if it is not already configured.
3. Create `FieldSoli Job Exports - Staging` or `FieldSoli Job Exports - Production` with **Sending access** restricted to `fieldsoli.com`.
4. Do not reuse or replace the key used for Supabase Auth SMTP.
5. Confirm `support@fieldsoli.com` is monitored.
6. Do not create a hosted template or webhook for V1.

### Supabase

Set these Edge Function values in each hosted project:

- `RESEND_EXPORT_API_KEY`
- `EXPORT_WORKER_SECRET` using at least 32 random bytes and a different value per environment
- `EXPORT_TOKEN_SECRET` using at least 32 random bytes, unique per environment and not reused as the worker secret
- `EXPORT_DOWNLOAD_BASE_URL`, ending in `/exports/download`

Create Vault entries:

- `export_project_url`: hosted project URL
- `export_worker_secret`: identical to `EXPORT_WORKER_SECRET`

The migration manages the bucket, queue, extensions, tables, and cron definitions. Cron reads the project URL and worker secret from Vault and sends `x-export-worker-secret` to the processing and cleanup functions.

Function access:

- `request-job-export`: user JWT required
- `redeem-job-export`: public and token-authenticated in code
- `process-job-exports`: private worker-secret header required
- `cleanup-job-exports`: private worker-secret header required

Never put Resend, worker, token-derivation, secret-role, or Vault values in the mobile app, marketing browser bundle, `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, committed environment files, or migration SQL.

## Verification and release gates

Automated coverage must include:

- timestamp transitions and the one-time `last_worked_at` backfill;
- time-zone account/current-year validation and DST year boundaries;
- exact 21-column order, nulls, zero/negative values, all cost types, deduplication, Unicode, multiline text, formula protection, BOM, and CRLF;
- pagination beyond 1,000 jobs;
- different-year requests, in-flight same-year deduplication, empty-year no-op, same-year rerequest after 15 minutes, and same-year 15-minute rate limiting;
- worker recovery, stable email payload/idempotency, and permanent/transient provider errors;
- exact HTML/plain-text email copy and expiration parity;
- cross-user denial, generic redemption failures, fragment removal, and absence of Analytics;
- immediate token expiry, midnight cleanup, retry, overdue logging, and account-deletion cleanup.

Before production:

1. Update the Privacy Policy and its required acceptance version to describe CSV creation, private temporary storage, Resend processing, email delivery, and up-to-next-midnight deletion.
2. Update the current-product export only when the feature is actually shipped.
3. Validate a real email in desktop and mobile clients, including button/fallback redemption and no tracking rewrite.
4. Open representative CSVs in current Excel, Numbers, and Google Sheets.
5. Deploy database changes from clean `main` after merge; treat functions, website, and mobile release as separate checkpoints.

## Non-goals

V1 excludes hours, session rows, tax calculations, tax-category mapping, arbitrary date ranges, non-completed jobs, line-item exports, notes, photos, attachments, receipts, invoices, payment transactions, refunds, customer export, ZIP archives, imports, multi-currency, and direct authenticated web delivery.

A future multi-year UI may create multiple one-year requests without changing this schema.
