# FieldSoli local development and production release

FieldSoli uses a right-sized workflow for a solo developer:

- **Local Supabase is the default** for feature and schema work.
- The hosted staging project is optional rehearsal for changes that need a real hosted environment.
- The production Supabase project is changed only through an explicit, reviewed release command.
- Mobile production values come from the Expo EAS `production` environment, not the local Expo env file.

## Where EAS production values live

EAS environment variables are stored on Expo's servers for the EAS project identified in
`apps/mobile-expo/app.json`. In the Expo dashboard, open the FieldSoli project, then go to
**Project settings → Environment variables → production**.

The production build profile in `apps/mobile-expo/eas.json` contains
`"environment": "production"`. That tells EAS Build to load the server-side production set when
building. The local `apps/mobile-expo/.env.local` file is neither required nor uploaded.

The production EAS environment must contain:

- `EXPO_PUBLIC_SUPABASE_URL` — production project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — production publishable/anon key
- `EXPO_PUBLIC_POSTHOG_KEY` — production PostHog project key

The other production flags remain declared in `eas.json`. Audit the configured names with:

```bash
cd apps/mobile-expo
npx eas-cli@latest env:list --environment production
```

Create or update a public client value with this pattern:

```bash
npx eas-cli@latest env:set \
  --environment production \
  --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_URL \
  --value '<production project URL>'
```

`EXPO_PUBLIC_*` values are embedded in the app bundle. The Supabase publishable/anon key is
designed for this; database security comes from grants and RLS. Never put a service-role key or a
Supabase secret key in EAS client variables.

## Daily local workflow

Open Docker Desktop, then run:

```bash
npm run dev:local
```

This command:

1. starts the local Supabase stack;
2. reads its current API URL and publishable key;
3. writes them to ignored `apps/mobile-expo/.env.local`;
4. disables analytics locally; and
5. starts Expo/Metro.

Use `npm run local:setup` when you want to configure the stack without starting Metro. Local
Studio is at `http://127.0.0.1:54323` and local test email is at
`http://127.0.0.1:54324`.

The app configuration rejects the production Supabase project whenever
`EXPO_PUBLIC_APP_ENV` is not `production`. If an old local file points at production, run
`npm run local:setup` and restart Expo.

## Repeatable App Store screenshot data

For polished screenshots, reset a dedicated local-only fixture instead of entering data by hand:

```bash
npm run screenshots:reset
npm run mobile
```

The first command starts local Supabase, rebuilds its database from migrations, creates the
fictional account `app-store-demo@fieldsoli.local`, and seeds thirteen owned jobs with sessions,
notes, materials, other costs, legal acceptance, and an analytics choice. Five completed jobs fall
in the past-week Earnings window and ten in the past-month window, so each ranking section has
useful variation. It prints the local-only password needed to sign in from the simulator. The normal
authenticated API is checked before the command finishes, so the app uses its regular RLS-protected
reads rather than a demo bypass.

The fixture is in `backend/supabase/fixtures/app-store-demo.sql`, deliberately outside
`db.seed.sql`. It never runs during ordinary resets and refuses a non-local Supabase API URL. Use
only fictional names, addresses, and content in it. When the schema or required legal versions
change, update the fixture in the same change and rerun this command before capturing screenshots.

## Making a database change

Do not build schema changes directly in a hosted project. Create and test a migration locally:

```bash
# 1. Start the local stack and configure the app.
npm run local:setup

# 2. Create the migration file before writing SQL.
npx supabase migration new <descriptive_name> --workdir backend

# 3. Edit the generated file under backend/supabase/migrations.

# 4. Rebuild the database from every migration, then run the SQL regression tests.
npm run db:verify

# 5. Run application checks affected by the change.
npm run test:api-client
npm run test:mobile
npm run typecheck
```

`db:verify` intentionally destroys and recreates only the local database. It proves that a clean
database can be built from the committed migration chain and that RLS, compatibility, and data
behavior tests still pass.

Keep every remotely applied migration immutable. If a deployed migration needs correction, add a
new forward migration rather than editing the old file. New Data API tables must include deliberate
grants, RLS, and policies in the migration.

## Optional hosted staging rehearsal

Use staging for migrations, Auth, email, or Edge Function behavior that cannot be fully proven
locally. From a clean, committed feature worktree:

```bash
# Runs local reset/tests, links the exact staging project, shows migration history,
# and performs a remote dry-run. It does not apply anything.
npm run db:deploy:staging:plan

# Repeats the checks and requires typing the staging project ref before applying.
npm run db:deploy:staging
```

The staging project is `anypejjoovlatmrkrxvx`. The deployment wrapper always relinks and then
checks `backend/supabase/.temp/project-ref`, because `supabase link` persists the last selected
remote project.

To point a local Expo session at hosted staging temporarily, use ignored
`apps/mobile-expo/.env.local` with:

```bash
EXPO_PUBLIC_APP_ENV=staging
EXPO_PUBLIC_SUPABASE_URL=<staging Project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging publishable key>
```

Restart Expo after changing the file. When staging testing is finished, run `npm run local:setup`
to restore local Supabase. Do not point the normal local env file back at production.

## Production database checklist

Production is project `gfvqmxsiuhhujnckghpa`. Only deploy migrations after the change is merged.

1. Use a clean `main` checkout and update it from `origin/main` with a fast-forward-only pull.
2. Confirm the hosted backup/recovery option appropriate to the migration.
3. Run `npm run db:deploy:production:plan`.
4. Read the migration list and dry-run output; confirm only the expected migration files appear.
5. For live-client compatibility, make schema changes additive first. Do not remove or rename a
   field that the currently released app still uses.
6. Run `npm run db:deploy:production` and type the exact production project ref when prompted.
7. Verify the final migration list and smoke-test the affected operation with a controlled account.

The wrapper refuses production operations unless the checkout is clean and on `main`. It also
performs `npm run db:verify`, explicitly links and verifies the production project, dry-runs, and
requires an interactive target confirmation before applying.

`supabase db push` deploys database migrations only. When relevant, release these separately and
verify each one:

- Edge Functions, such as `delete-account`, using `supabase functions deploy` with an explicit
  `--project-ref`;
- hosted Auth providers, redirect URLs, SMTP, and email templates;
- Storage buckets and non-migration dashboard settings;
- production website deployment;
- EAS build, store submission, platform processing, and public store release.

If a production migration fails or causes a regression, ship a corrective forward migration.
Website rollback and mobile-store recovery are separate operations; a native build cannot undo a
database migration.

## Applying a migration with the Supabase MCP

MCP `apply_migration` is safe to use on production. It runs the SQL and records a history row, but
the row's `version` is the clock time of the apply, not the prefix of the file in
`backend/supabase/migrations/`. `supabase db push` matches on that prefix only. Leave the clock
version in place and the next `npm run db:deploy:production:plan` treats the MCP row as a remote
migration the repo does not have, and treats the repo file as not yet applied.

Use this sequence for every MCP apply:

1. The migration file must already be committed (or at least present) under
   `backend/supabase/migrations/`. Apply that file's SQL, not an edited copy.
2. Call MCP `apply_migration` with the same snake_case name as the filename suffix.
3. Read the new `version` from MCP `list_migrations`.
4. Rewrite that history row so `version` is the filename prefix. With MCP `execute_sql`:

```sql
update supabase_migrations.schema_migrations
set version = '<filename prefix>'
where version = '<version just inserted>'
  and name = '<migration name>';
```

5. Confirm `list_migrations` shows the filename prefix and no extra row for that change.

One repo file must end as one history row. If a large file is applied in more than one MCP call,
keep a single row whose `version` is the filename prefix and delete the extra history rows. Do not
re-run the SQL. History is a ledger; the schema is already applied.

Do not use `apply_migration` for this rewrite. That inserts another clock-time row.
