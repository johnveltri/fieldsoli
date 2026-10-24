# Geoapify address autocomplete runbook

## Secret

- Store `GEOAPIFY_API_KEY` in Supabase Edge Function secrets for `address-autocomplete`.
- Never expose the key in mobile env (`EXPO_PUBLIC_*`) or client bundles.

## Rotation

1. Create a replacement key in the Geoapify dashboard.
2. Set the new secret in Supabase (`supabase secrets set GEOAPIFY_API_KEY=...`).
3. Deploy `address-autocomplete`.
4. Revoke the prior key after smoke-testing a non-production project.

## Quota monitoring

- Free plan hard cap: 3,000 requests/day project-wide.
- Per-user budget is enforced in `private.consume_address_autocomplete_budget` (100/day hosted).
- Local `seed.sql` raises that cap to 1000/day so Geoapify testing is not blocked.
- Monitor coarse request counts only; logs must not include query text or provider payloads.

## Failure handling

- When quota is exhausted or Geoapify is unavailable, the function returns `rate_limited` or `unavailable`.
- Mobile clients keep manual address entry; no blocking alert.
- Disable suggestions server-side by turning off the function or removing the secret if needed.

## Provider replacement

- Adapter lives in `backend/supabase/functions/_shared/address-autocomplete.ts`.
- Swap provider implementation without a database migration; keep `AddressSuggestion.displayAddress` stable.

## Hosted Dev setup and key changes

The mobile `.env.local` selects a backend but does not deploy its functions or
update hosted secrets. For FieldSoli Dev (`anypejjoovlatmrkrxvx`), update the
server-only `GEOAPIFY_API_KEY` secret whenever the provider key changes, and
ensure `address-autocomplete` is deployed. Keep JWT verification enabled.
Never copy the provider key into `EXPO_PUBLIC_*` variables.

After an authorized key update, smoke-test both Job Edit and Business Details
through the simulator using a synthetic query; suggestions and attribution
must appear. Do not save test addresses over existing drafts. Unknown provider
failures keep manual entry available. Logs contain bounded reason codes only
(`provider_timeout`, `provider_auth`, `provider_rate_limited`,
`provider_http_error`, `provider_network`, `unknown`), never URLs, keys or queries.

Provider requests have a 12-second deadline; the client allows 18 seconds for
authentication, budget enforcement and the provider request. Both remain bounded.
Production (`gfvqmxsiuhhujnckghpa`) requires its own separately authorized secret
and deployment operations; a Dev update does not change production.
