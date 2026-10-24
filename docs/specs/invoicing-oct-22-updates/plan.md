# Build plan

Readiness basis: spec.md and four supporting contracts in this directory; source reviewed b84c2c3; all PM questions resolved in decision-packet.md. Ready for implementation approval. Code roots below are repository-relative.

## Ordered change map

1. Establish exact TestFlight version/build/iOS and reproduce reports. Record current deployment configuration and safe request outcomes. Trace `packages/api-client/src/addressAutocomplete.ts`, `backend/supabase/functions/address-autocomplete/index.ts`, `_shared/address-autocomplete.ts`, existing budget migration and `apps/mobile-expo/src/components/ds/customer/useAddressAutocomplete.ts`. Repair the demonstrated failing layer, including bounded completion/cancellation where necessary. Never expose secrets or blindly redeploy. REQ-01, TEST-01.
2. Reuse address hook and AddressSuggestionPanel in `apps/mobile-expo/src/screens/BusinessSettingsScreen.tsx`; preserve draft persistence, keyboard, attribution and manual entry. Reuse current zero-entry pattern for markup/tax in the same screen. REQ-02/10, TEST-01/09.
3. Trace `JobDetailScreen.tsx` view/edit controls refs and `InvoicingJobControls.tsx` preview, modal, AppState and WebView lifecycle. Fix access/recovery at proven cause; retain saved identity, unsaved type, idempotency and Paid guards. Extend focused mobile tests. REQ-03/04, TEST-02/03.
4. Thread canonical material charge into Job View data/row in `ViewActivityBuckets.tsx` (and API/shared type mapper if missing); preserve cost label and reuse pricing rules. Update corresponding design-system spec/Figma if affected. REQ-05, TEST-04.
5. Add presentation-only phone formatting to `packages/document-renderer/src/render.ts` and tests. Validate snapshot recipient in `InvoicingJobControls.tsx`/documentShare helper and test native adapter arguments. Update amount-first body in `documentShare.ts` and callers. REQ-06/07/09, TEST-05/06/08.
6. Update `apps/marketing/src/lib/share-document.ts`, `src/app/share/[token]/page.tsx`, and `opengraph-image.tsx` with neutral unavailable copy and approved business/type/amount/title hierarchy. Test privacy, long strings and outage distinctions. REQ-08/09, TEST-07/08.
7. Synchronize parent invoicing UX-07/09 and applicable Customer/address contracts; update current-product documentation/exports and maintained Figma for meaningful visible changes. Keep historical archive and experiments separate. Validate contract consistency and required source-mapped evidence. REQ-01–10, TEST-01–09.

## Verification execution

Use repo commands `npm run test:mobile`, `npm run test:document-renderer`, `npm run test:marketing`, `npm run test:edge-functions`, appropriate API tests and `npm run typecheck`, narrowed to changed areas where supported. Add actual address hook/API tests explicitly if root scripts omit them. Run relevant DB tests only if schema/budget/RPC behavior changes. Run `npm run product:export` and `npm run design:check` for product closeout. Record exact commands/results; tests have not run during shaping.

TEST-01 belongs to steps 1/2; 02/03 to step 3; 04 to step 4; 05/06 to step 5; 07/08 to steps 5/6; 09 to step 2. Device and release obligations are in test-contract.md and are blocking evidence where mocks cannot prove behavior.

## Compatibility and deployment

No new schema/provider/package or backfill expected. Preserve old-client data interfaces and immutable snapshots. If diagnosis requires an existing migration or function configuration change, verify exact target, dry run and recovery plan before separately authorized application. Never change pricing semantics to satisfy a display fix.

After merge and separate authorization: verify required DB state first; deploy changed function/config if needed and smoke-test; deploy hosted website/metadata and smoke-test enabled/disabled/outage links; build mobile from exact source with correct production environment; verify EAS build; submit once; verify Apple processing; run physical TestFlight matrix; independently authorize public release. Server/web rollbacks must retain old-client compatibility and revocation checks. Do not promise external rich-preview cache invalidation.
