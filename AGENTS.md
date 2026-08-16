# AGENTS.md

## Cursor Cloud specific instructions

This is an npm-workspaces monorepo for **FieldSoli**. The runnable pieces are:

| Service | Path | What it is | Run (dev) |
|---------|------|------------|-----------|
| Mobile app | `apps/mobile-expo` | Expo / React Native app (the primary product) | `npm run mobile` (Metro on `:8081`) |
| Marketing site | `apps/marketing` | Next.js 16 marketing + waitlist site | `npm run marketing` (`:3000`) |
| Backend | `backend/supabase` | Local Supabase (Postgres, Auth, Studio) | `npx supabase start --workdir backend` |

Shared packages live in `packages/*` (`api-client`, `design-system`, `shared-types`).

### Startup (services are NOT auto-started; the update script only runs `npm install`)

Docker Engine and the `postgres-client` (`psql`) are pre-installed in the VM image but daemons/services are not running on boot. To get a full stack:

1. Start Docker (needed only for local Supabase): `sudo dockerd &` then `sudo chmod 666 /var/run/docker.sock` so the `ubuntu` user can reach it without sudo. The `ubuntu` user is already in the `docker` group. `/etc/docker/daemon.json` is configured for `fuse-overlayfs` with the containerd snapshotter disabled (required for Docker-in-Docker here) — do not change it.
2. Start Supabase: `npx supabase start --workdir backend` (first run pulls images; subsequent runs are fast). Get URLs/keys with `npx supabase status --workdir backend`.
3. Start an app: `npm run marketing` and/or `npm run mobile`.

### Backend / Supabase notes

- Local URLs and ports are documented in `backend/LOCAL_DEV.md` (API `:54321`, DB `:54322`, Studio `:54323`, Mailpit `:54324`). Migrations in `backend/supabase/migrations` are applied automatically on `supabase start` / `db reset`.
- `npm run test:db` runs `psql`-based SQL tests against the local DB on `:54322` and REQUIRES the local Supabase stack to be running first.

### Mobile app (`apps/mobile-expo`)

- `apps/mobile-expo/.env` is committed and points `EXPO_PUBLIC_SUPABASE_URL` at a HOSTED Supabase project, so `npm run mobile` works without local Supabase. To run against local Supabase instead, override `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the anon key from `supabase status` (see `backend/LOCAL_DEV.md`).
- There are no iOS/Android simulators and no `react-native-web` in the cloud VM, so the mobile UI cannot be opened in a browser here. Validate the mobile app via `npm run test:mobile` (Jest) and by confirming Metro bundles it, e.g. `curl "http://localhost:8081/apps/mobile-expo/index.bundle?platform=ios&dev=true"` (Metro's server root is the monorepo root, hence the `apps/mobile-expo/` prefix).

### Marketing app (`apps/marketing`)

- The waitlist API (`/api/waitlist`) needs env vars. Create `apps/marketing/.env.local` (gitignored) with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `WAITLIST_RATE_LIMIT_SALT`. For local dev, point URLs at `http://127.0.0.1:54321` and use the Publishable key (as anon) and Secret key (as service role) printed by `npx supabase status --workdir backend`. Restart `npm run marketing` after creating/editing this file. Without it the site still renders, but waitlist submission fails.

### Lint / test / typecheck (from repo root)

- Standard commands are in the root and per-app `package.json` `scripts`. Root: `npm test` (api-client + marketing + design-system vitest), `npm run test:mobile`, `npm run test:db`, `npm run typecheck`, marketing lint via `npm run lint -w @fieldsolo/marketing`.
- Known pre-existing issues on `main` (NOT caused by env setup): `npm run typecheck` reports errors in some mobile test files / analytics event names, and marketing `lint` reports one `react-hooks/set-state-in-effect` error plus `next/image` warnings. These do not block running the apps or the test suites.
