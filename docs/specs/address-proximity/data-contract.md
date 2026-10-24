# Address proximity data contract

- DATA-01: `AddressProximity = { latitude: number; longitude: number }`; finite, latitude [-90,90], longitude [-180,180]. Round both to two decimals on device and server. Zero is valid.
- DATA-02: Legacy autocomplete request remains `{ query, countryCode: 'us', limit }`; new optional `proximity` adds Geoapify `bias=proximity:longitude,latitude`. Suggestion responses remain unchanged.
- DATA-03: `{ action: 'resolve_business_proximity' }` accepts no other properties. The authenticated server reads only the caller's `business_settings.address` with user-scoped RLS. No client account/address override.
- DATA-04: Business response is `{ status: 'ok', proximity: AddressProximity | null }`. Errors retain existing bounded codes. Geocode at most two U.S. candidates; accept confidence >=0.9 at building/street/postcode/city level. Multiple qualifying rounded points are ambiguous and yield null.
- DATA-05: Only the installation-level permission-attempt flag is persisted locally. Device/business points live in memory with state-model lifetimes. Cache invalidation changes a generation so old promises cannot repopulate caches.
- DATA-06: Provider key stays server-only. No account ID, auth token or device IP is forwarded to Geoapify. Application logs and analytics contain no coordinates, queries, business address, provider URLs or raw payloads.
- DATA-07: Existing daily budget is consumed once per actual provider lookup; a missing business address needs no provider call. Each geocoding request adds one provider credit; ordinary autocomplete costs are unchanged. No paid plan change or quota increase.

No schema migration, coordinate backfill, persistent geocoding cache, or changes to Job/customer snapshots. An older client still receives ordinary suggestions. An older server may not resolve the new operation; the app degrades to ordinary suggestions.

Geoapify generally retains successful API request data up to 24 hours; FieldSoli's memory-only handling does not imply provider-side ephemeral processing. See the canonical Privacy Policy and store review in plan.md.
