# Data contract

| ID | Meaning, ownership and invariants |
| --- | --- |
| DATA-01 | Reuse authenticated provider-neutral address endpoint and existing string address fields. Shared account budget covers Job and Business entry. Only selected or manually entered text persists on existing save; cancel discards. Provider key remains server-only. No raw provider payload, coordinates or provider IDs persist. Keep attribution. |
| DATA-02 | Material customer charge equals row total cost plus round-half-up markup using explicit override, else current business default. Reuse canonical calculation and integer cents. Show complete explicit-zero costs; incomplete cost has no invented charge. This is current Job pricing, distinct from immutable document totals. Settings changes do not rewrite snapshots. |
| DATA-03 | Owner document identity, immutable contacts/content/total and separately mutable payment/link controls remain distinct. Latest owner read gates native sharing/PDF. Never fill missing snapshot phone from a newly changed Job/customer. |
| DATA-04 | Normalize valid US ten-digit or +1 numbers for SMS; invalid values result in no recipient. International supported phone formats may remain valid; names and arbitrary strings never qualify. Presentation formatting applies to business/customer US numbers without mutating stored data. Unsupported formats and extensions retain original readable content. HTML escaping remains required. |
| DATA-05 | Rich metadata uses only existing allowlisted business name, type, short description and immutable full total. No customer contacts/address, private cost/markup, token text or dynamic Paid state. Disabled/unknown/deleted/archived URLs share generic output and no previous identifying image. Preserve no-store/noindex and public access checks. |
| DATA-06 | Zero-focus is transient editing state. Untouched focus/blur stays numeric zero and clean; decimals use existing percentage-to-basis-points validation. No new persisted representation. |

No migration/backfill expected. If runtime diagnosis identifies a missing existing migration or function, compare exact deployed state and plan authorized deployment; never invent a schema workaround. Preserve old-client compatibility.

Dependency envelope, verified sources, budget and free-tier fallback are recorded in decision-packet.md. Actual traffic/plan unknown; shared DB daily budget does not itself prove compliance with provider per-second limits. No raw address/contact/token/amount diagnostic logging; safe bounded status codes and aggregate counts suffice.
