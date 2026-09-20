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
- Per-user budget is enforced in `private.consume_address_autocomplete_budget`.
- Monitor coarse request counts only; logs must not include query text or provider payloads.

## Failure handling

- When quota is exhausted or Geoapify is unavailable, the function returns `rate_limited` or `unavailable`.
- Mobile clients keep manual address entry; no blocking alert.
- Disable suggestions server-side by turning off the function or removing the secret if needed.

## Provider replacement

- Adapter lives in `backend/supabase/functions/_shared/address-autocomplete.ts`.
- Swap provider implementation without a database migration; keep `AddressSuggestion.displayAddress` stable.
