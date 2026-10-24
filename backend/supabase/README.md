# Supabase (FieldSoli backend)

This folder is the **source of truth** for schema and local tooling. Remote Supabase projects use the same migrations via `db push` / CI.

## Layout

- `config.toml` — local stack (API, DB, Studio ports, etc.).
- `migrations/` — ordered SQL migrations (apply to hosted project with `supabase db push` after linking).
- `seed.sql` — normal local seed, intentionally empty for FieldSoli.
- `fixtures/app-store-demo.sql` — fictional screenshot fixture, loaded by the local reset
  or the Dev-only hosted demo reset wrapper.

## CLI commands (from repo root)

Supabase CLI treats **`backend`** as the project root (the directory that contains this `supabase/` folder).

```bash
# Start local Postgres + API + Studio (requires Docker)
npx supabase start --workdir backend

# Stop local stack
npx supabase stop --workdir backend

# Reapply migrations + seed
npx supabase db reset --workdir backend

# Rebuild local DB and add the repeatable App Store screenshot account/data.
npm run screenshots:reset
```

## Hosted project

Use the target-verifying scripts documented in
[`docs/development-and-release.md`](../../docs/development-and-release.md), rather than raw
`supabase link` / `db push` commands. The raw link is persistent, which makes it too easy to leave
the checkout connected to the wrong hosted project.

```bash
npm run db:deploy:staging:plan
npm run db:deploy:staging
npm run db:deploy:production:plan
npm run db:deploy:production
```

## Hosted Dev screenshot fixture

`npm run screenshots:reset:dev` recreates only the reserved, marked demo account's
app dataset in FieldSoli (Dev), `anypejjoovlatmrkrxvx`, then configures Expo for
that project. It preserves other accounts and does not reset schema. Configure
its administrative token in ignored `.env.screenshots-dev.local`; the first run
saves a separate random demo password there. See the
[hosted Dev setup and reset contract](../../docs/development-and-release.md#hosted-dev-screenshot-data).

## Env for `apps/mobile-expo`

Use the project **Project URL** and **anon public** key as:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Local defaults after `supabase start` are shown in the CLI output (`API URL` and `anon key`).

## Env for `apps/marketing`

The waitlist form submits through a server-side route handler using the **service role** key (never expose as `NEXT_PUBLIC`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WAITLIST_RATE_LIMIT_SALT` (a random server-only secret used to hash IP addresses for abuse prevention)

See [`apps/marketing/.env.example`](../apps/marketing/.env.example). Local values come from `npx supabase status --workdir backend`.

## Waitlist signups

Marketing waitlist rows live in `public.waitlist_signups`. RLS is enabled with **no policies**, so anon/authenticated clients cannot read or write the table. Inserts happen only via the marketing app's `/api/waitlist` route (service role). The route uses a honeypot, same-origin checks, strict payload limits, and an atomic per-IP hash rate limit. View, filter, export, and update `status` (pending/invited/converted) in Supabase Studio.

The Expo app still uses the publishable anon key for Supabase Auth and session refresh. Shared
schema migrations no longer grant direct public-table access to the `anon` role.

## Storage buckets

New attachment rows default to the Supabase Storage bucket named `fieldsolo` (technical id — keep).
Existing attachment rows can still reference their original bucket value. Before pushing the
storage default migration to a hosted project, create or confirm the `fieldsolo` bucket in
Supabase Storage.

## Jobs in the app

Job Detail loads **`fetchFirstJobIdForCurrentUser`** → **`fetchJobDetail`**: only rows the **authenticated user** can see under RLS (typically **`jobs.user_id = auth.uid()`**). If none exist, the UI shows **no jobs**. `seed.sql` is intentionally empty by default; create real user-owned jobs in local dev. For repeatable screenshot data, run `npm run screenshots:reset`; it uses a real local account and its ordinary ownership policies, not a demo bypass.

For active client tables (`sessions`, `notes`, `job_costs`), authenticated reads/writes require both:
- row ownership (`user_id = auth.uid()`)
- parent ownership (referenced `job_id` / `session_id` resolves to rows owned by `auth.uid()`)

`job_costs` is the generalized storage table; the launch UI writes and displays only
`cost_type = 'material'`. Attachments and activity events remain inaccessible to app roles until
their features and policies are implemented. Client hard deletes are disabled; normal deletion is
performed through the existing soft-delete fields.

There is no seed-demo bypass policy or demo-claim RPC in the shared schema.

## Local-only open table access

Shared migrations are secure by default. If you need the old local debugging behavior where the
`anon` role can read/write public tables directly, apply
[`snippets/enable_local_anon_table_access.sql`](./snippets/enable_local_anon_table_access.sql)
manually in local Studio SQL or `psql`.

To revert to the secure default, reset the local database:

```bash
npx supabase db reset --workdir backend
```

## Authentication (email / password only)

**Local (`config.toml`):** SMS signup is off (`[auth.sms]` / `enable_signup = false`); OAuth blocks like `[auth.external.apple]` stay `enabled = false`. Email signup is on under `[auth.email]`. Confirmations default to off locally (`enable_confirmations = false`) so new users can sign in immediately—turn confirmations on for production-like testing if needed. Passwords must contain at least eight characters.

**Hosted:** In the [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Providers**, disable every provider except **Email** (disable Phone, Apple, Google, and any others you do not use). Under **Email**, enable “Email” / password sign-in as required by your app.

**Rebrand / URL Configuration (FieldSoli):** Project display name is FieldSoli. Under **Authentication → URL Configuration**, set Site URL to `https://fieldsoli.com` (or your primary web origin) and include both domains in Redirect URLs during transition (`https://fieldsoli.com/**` and `https://fieldsolo.com/**`). The mobile app passes `emailRedirectTo: https://fieldsoli.com/auth/confirmed` on signup so confirmation emails land on the marketing **Email confirmed** page (not the homepage). After deploy, smoke: create account → confirm email → `/auth/confirmed` → **Open FieldSoli & log in** deep link. Update Auth email templates and SMTP sender name/address to FieldSoli / `@fieldsoli.com` if custom SMTP is enabled. Do not rename the `fieldsolo` storage bucket.

**Auth email templates:** Branded HTML lives in `backend/supabase/templates/` and is wired for local Auth in `config.toml`:

| Template | Local config key | File |
| --- | --- | --- |
| Confirm sign up | `auth.email.template.confirmation` | `templates/confirmation.html` |
| Reset password | `auth.email.template.recovery` | `templates/recovery.html` |
| Password changed | `auth.email.notification.password_changed` | `templates/password_changed_notification.html` |

Hosted projects do **not** pick these up from `config.toml`. Paste each file’s HTML into **Authentication → Email Templates** (and enable the password-changed security notification). Keep subjects aligned with local config.

### Custom SMTP (production Auth mail)

Supabase’s built-in Auth mailer is rate-limited (on the order of **2 emails/hour** on hosted projects) and is not intended for production. Configure **custom SMTP** to send from `@fieldsoli.com` and to raise the Auth email rate limit. See [Auth rate limits](https://supabase.com/docs/guides/deployment/going-into-prod#auth-rate-limits) and [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

**Google Workspace vs transactional mail:** Keep Workspace for human inboxes (`support@fieldsoli.com`, `privacy@fieldsoli.com`). Do **not** use Gmail/Workspace SMTP for Supabase Auth. Use a transactional provider on the same domain.

**Provider:** [Resend](https://resend.com) with verified domain `fieldsoli.com`.

#### Resend setup

1. In Resend → **Domains**, confirm `fieldsoli.com` is **Verified** (SPF/DKIM/DMARC as Resend instructs).
2. **API Keys → Add API Key**
   - **Name:** `FieldSoli Supabase Auth`
   - **Permission:** Sending access (or Full access)
   - **Domain:** `fieldsoli.com` (not “All domains”)
3. Copy the key once; it is the SMTP **password** (never commit it to git).

#### Supabase hosted project (FieldSoli)

Dashboard → **Project Settings → Authentication → SMTP** (or **Authentication → SMTP Settings**):

| Field | Value |
| --- | --- |
| Enable custom SMTP | On |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` |
| Password | Resend API key from step above |
| Sender email | `noreply@fieldsoli.com` |
| Sender name | `FieldSoli` |

Secrets live **only** in the Supabase dashboard, not in this repo.

#### Branded templates (hosted)

After SMTP works, ensure hosted templates match the repo (paste HTML from `templates/`):

- **Confirm sign up** → `confirmation.html`
- **Reset password** → `recovery.html`
- **Security notifications → Password changed** → `password_changed_notification.html`

#### Verify delivery and rate limits

1. Send a test Auth email (e.g. sign up with a throwaway address when email confirmation is enabled, or trigger **Reset password** from the dashboard/API).
2. Confirm the message is from **FieldSoli** / `noreply@fieldsoli.com`, not default Supabase Auth copy.
3. Dashboard → **Authentication → Rate Limits** → increase **email sending** to a sensible beta cap (custom SMTP must be enabled first).

#### Local development

Default local Auth email goes to **Mailpit** (CLI `supabase start`). To test real Resend delivery locally, uncomment `[auth.email.smtp]` in `config.toml` and set `RESEND_API_KEY` in your environment (see commented block there). Day-to-day dev can stay on Mailpit.

## Edge Function: `delete-account`

The mobile app calls `delete-account` to remove the authenticated user. When PostHog analytics is enabled in production, set these **function secrets** (Project Settings → Edge Functions → Secrets) so account deletion also queues PostHog person/event removal:

- `POSTHOG_PERSONAL_API_KEY` — personal API key with person delete scope (never ship to the client)
- `POSTHOG_PROJECT_ID` — numeric project id from PostHog project settings
- `POSTHOG_API_HOST` — optional; defaults to `https://us.posthog.com` (API host, not the capture/ingestion host)

If the PostHog secrets are absent, account deletion still succeeds; analytics cleanup is skipped locally.

Account deletion first revokes every active Job Summary export and removes all
known or deterministic export object paths. If an export worker is currently
generating a file, the function returns retryable `409 export_cleanup_pending`
without deleting the Auth user; retrying after the worker observes the
revocation completes deletion. Storage cleanup failures likewise leave the
account intact instead of orphaning a private CSV.

## Job Summary CSV exports

The export pipeline is migration-managed: it creates the private `job-exports`
Storage bucket, `job_export_requests`, the durable `job_exports` PGMQ queue,
and schedules a protected processor every minute plus a midnight-UTC cleanup.
Do not add Storage policies or table grants for client roles.

Before deploying the functions, configure these values separately in **each**
Supabase project under **Edge Functions → Secrets** (or with `supabase secrets set`):

- `RESEND_EXPORT_API_KEY` — a Resend sending-only key restricted to
  `fieldsoli.com`; use a separate key from Supabase Auth SMTP.
- `EXPORT_WORKER_SECRET` — unique cryptographically random value of at least
  32 bytes. It protects cron invocations of the processing and cleanup functions.
- `EXPORT_TOKEN_SECRET` — a different unique cryptographically random value of
  at least 32 bytes. The worker HMACs the request id with it to reconstruct the
  same opaque 32-byte bearer token during retries while the database stores
  only the token SHA-256 hash. Never reuse `EXPORT_WORKER_SECRET`.
- `EXPORT_DOWNLOAD_BASE_URL` — staging’s deployed marketing URL or
  `https://fieldsoli.com/exports/download` in production.

Create these two Supabase Vault secrets in each hosted project before the
migration schedules can run:

```sql
select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'export_project_url');
select vault.create_secret('THE-SAME-EXPORT_WORKER_SECRET', 'export_worker_secret');
```

The migration reads those Vault entries at runtime and sends the worker secret
only in `x-export-worker-secret`; do not put URLs, API keys, or secrets in
migration SQL. Confirm the `process_job_exports` and `cleanup_job_exports`
entries appear in `cron.job` after deployment.

### Resend setup and email contract

In Resend, verify `fieldsoli.com` with SPF/DKIM (and DMARC before production),
create the restricted sending key above, disable open and click tracking, and
make sure `support@fieldsoli.com` is monitored. Do not configure a Resend
template, webhook, CSV attachment, or tracking pixel: the deployed processor
renders both HTML and plain-text email versions.

Every accepted export is sent from `FieldSoli <noreply@fieldsoli.com>` with
Reply-To `support@fieldsoli.com` and subject `Your YYYY FieldSoli job export is
ready`. It contains the download button and text fallback URL, exact local-zone
expiry, bearer-link warning, sensitive-data warning, unexpected-request advice,
and support address—but no job/customer/financial data and no attachment.
