# Invoicing — Build Plan

## Readiness basis

Approved spec.md, state-model.md, data-contract.md, ux-contract.md and test-contract.md. Source revision b85ebe5. Product decisions resolved; existing Vercel Pro reuse approved. No product implementation or production mutation is authorized by shaping alone. Ready for Implementation is distinct from tested or ready to release.

## Current-state findings

Business profile currently exposes personal name/trades in packages/api-client/src/profiles.ts. Revenue is editable via jobs.ts, useJobEditDraft.ts, JobDetailScreen and LiveSessionBottomSheet; lists/earnings/completeness/export/payment logic consume it. job_costs carries Materials and six Other Cost types, total-only capture and Job/Session/Inbox parentage. Customer contacts and descriptions are Job-owned values. Read-only production check found 23 active Jobs with no negative material residual, 71 deleted Jobs including one negative residual; exclude all deleted Jobs from backfill. Website is apps/marketing. Required direct native preview/PDF libraries are not installed. See decision-packet.md, production-evidence.md and technical-evidence.md for detailed sources.

## Change map

| Area | Expected files/systems | Owning rules |
| --- | --- | --- |
| Pricing/defaults/documents DB | backend/supabase/migrations generated through CLI; backend/supabase/tests; local schema/RLS/RPCs; delete-account integration | REQ-01..05/08/09/12/13; STATE-01/03..05/08..10; DATA-01..11 |
| Shared document schemas/calculations | packages/shared-types/src; new packages/document-renderer with versioned HTML/CSS and fixtures; existing money/Job models | REQ-02/07/09; DATA-03..07; UX-04/09/10 |
| API and all capture paths | packages/api-client/src/profiles.ts (personal compatibility), new businessSettings.ts and financialDocuments.ts, jobs.ts, materials.ts, otherCosts.ts, inbox.ts, liveSessions.ts, applyJobDetailEdit.ts, jobDetail.ts and generated database.types.ts | REQ-01..05/08..14; DATA-01..12 |
| Native settings/pricing | apps/mobile-expo/src/screens/ProfileScreen.tsx; JobDetailScreen.tsx; screens/jobDetailEdit/useJobEditDraft.ts and JobDetailEditMode.tsx; components/ds/EditMaterialBottomSheet.tsx and Other Cost edit flow; LiveSessionBottomSheet.tsx | REQ-01..06/14; STATE-01/02; UX-01..04 |
| Native preview/Docs/share/PDF | New DocumentPreviewScreen, DocumentShareSheet and Docs section components; existing overlay/header/FAB/keyboard primitives; SDK dependencies/app.config.ts/package-lock.json | REQ-06..11/14/15; STATE-02..09; UX-04..08/10..12 |
| Hosted public/owner rendering | apps/marketing/src/app/share/[token]/page.tsx; guarded card image route; authenticated owner-render fallback route; server-only resolver and shared renderer | REQ-07/09/12/15; DATA-04..08/13; UX-09/10 |
| Metrics/exports/deletion/analytics | Existing Job list/earnings/financial completeness/API projection; _shared/job-export-content.ts and export SQL views; delete-account/index.ts; analytics route exclusions | REQ-02/05/13; DATA-03/07..11; UX-12 |
| Closeout | docs/product/current-product.html and maintained design exports; this feature's implementation evidence | REQ-15; TEST-09..17 release gates |

Expected new filenames are implementation suggestions, not unapproved endpoints or extra product behavior. Trace all callers with rg before editing; do not assume Job Edit is the only pricing entry. Existing root API test script does not include otherCosts.test.ts; run it explicitly and add new feature suites to maintained scripts.

## Dependency-aware sequence

1. **Prove the selected platform path locally** (REQ-07/10/15, DATA-06/12/13, UX-07..11; TEST-09/10/11/17).
   - Build a synthetic versioned HTML fixture with long description, Unicode and multipage rows. Verify inline WebView, native Print-to-file and native Sharing using Expo SDK57-compatible modules. Do not install plugins or buy services; use package additions and lockfile in the implementation branch.
   - Evaluate app destination adapters and truthful More fallback on physical iOS/Android. Confirm no inbound share extension or unintended permission. Keep single HTML content/layout; reject screenshot PDF or a second template.
   - Record version/license/bundle/build/PDF/accessibility evidence before expanding UI. If a required platform cannot render/share the canonical content, stop and resolve the technical blocker instead of adding an unapproved paid fallback.
2. **Add schema and authoritative calculations** (REQ-01..05/08/09/12/13; STATE-01/03..05/08..10; DATA-01..11; TEST-01..08/13..15).
   - Discover installed CLI help; create an additive migration with supabase migration new and --workdir backend, following repository deployment guidance. Generate filenames through CLI, not guessed timestamps.
   - Add defaults/pricing fields, version/review markers, immutable documents/payloads, counters/idempotency/control/link storage, ownership policies/grants and strict server validation.
   - Implement inclusion/recalculation across direct/Session costs and reparent/delete operations; lock affected Jobs in deterministic order. Keep revenue_cents read projection and existing payment triggers compatible.
   - Implement preview/create/read/list/control RPCs, owner-safe server fallback, counter/key race handling and Job/account revocation. Local DB tests must prove these boundaries before connected UI.
3. **Implement financial compatibility and staged backfill** (REQ-02/05/13, STATE-01/09, DATA-03/09/10/11, UX-02/03; TEST-03/04/08/15).
   - Add versioned payload support before enabling new UI. Legacy Revenue edits solve Labor after final cost changes; missing new fields never reset persisted pricing attributes. Failed negative requests abort atomically.
   - Build representative legacy fixtures; migrate active Jobs with unchanged economic snapshots/timestamps/payment. Leave deleted Jobs legacy; review after restore. Run aggregate production check immediately before cutover read-only; if new active negative cases appear, report counts to PM without applying an invented policy.
   - Compare old/new exports, list/earnings/completeness and paid-state behavior. Do not change CSV columns or Revenue's pretax meaning.
4. **Implement shared renderer and guarded website** (REQ-07/09/12/15, DATA-04..08/13, UX-04/09/10; TEST-07..09/13/14/17).
   - Add shared payload decoder, canonical renderDocument(version,payload,paymentProjection), HTML escaping and CSS including @media print/@page. Maintain historical render versions.
   - Add dynamic public page/card routes using token hash lookup and eligibility before rendering. Server-only credentials; safe data transfer, noindex/nofollow/no-store/referrer/CSP headers, sitemap omission, no analytics and token-path log masking. Never use generic public table reads or cache bypasses.
   - Produce rich-card PNG only on image fetch through existing Next ImageResponse; no screenshots/PDF generation. Owner-render fallback verifies authenticated ownership independently of public enablement.
5. **Integrate business defaults and pricing UX** (REQ-01..06/14, STATE-01/02, DATA-01..05/09/10, UX-01..04/10/11; TEST-01..05/16).
   - Add Profile forms, tax multiselect and approved copy/defaults. Update all revenue-entry/cost flows, captured overrides/reset, billability checkbox and restored-pricing review. Reuse tested sheet/keyboard/overlay components after quality checks.
   - Keep ordinary Job saves permissive; separate document readiness. Client derived amounts must reconcile to authoritative saved projections. No API-only implementation with forgotten capture callers.
6. **Integrate creation, Docs, sharing and explicit PDF** (REQ-06..11/14/15, STATE-02..09, DATA-04..12, UX-04..12; TEST-05..12/16).
   - Add Share FAB, live selector/preview and Create & Share. Persist/recover unknown-outcome request keys; do not create fresh docs on retry/cancel. Implement stale-source review and disabled/offline recovery.
   - Add supplied View→Edit Docs→Preview navigation, newest-first rows, read-only metadata, independent controls and Generate new after saving Job draft. Refresh payment projection on focus/foreground and before actions.
   - Implement link handoffs and usable recipient prefill with truthful app fallback. Download PDF alone invokes native rendering to local cache then native sharing; archived/link-disabled owner export remains allowed. Clean transient artifacts without prematurely deleting handoff files.
7. **Verify feature and complete release evidence** (all REQ/STATE/DATA/UX rules; TEST-01..17).
   - Record source-linked unit/component/DB/API/web coverage and physical-device proofs under DATA-14. Exercise exact failures/interruption/accessibility/print/caches; perform separate read-only contract-versus-implementation audit.
   - Measure real resource sizes/load and existing Vercel Pro usage/spend. Configure existing alerts/route logs safely; do not purchase capacity or silently remove history.

## Test execution map and commands

| Tests | Implementation step / gate | Expected evidence |
| --- | --- | --- |
| TEST-01/02/04/05 | 2,5 | Authoritative money/default/date/readiness tests + native form/component tests. |
| TEST-03 | 2,3 / deployment | Local migration and legacy-client financial diffs, restoration proof, fresh aggregate production check. |
| TEST-06/07/08 | 2,4,6 | Transaction/race/key recovery and immutability/projection/renderer-version proof. |
| TEST-09/10/11 | 1,4,6 / submission | Native/browser/PDF screenshots and real composer/file/accessibility outcomes, zero eager PDF calls. |
| TEST-12 | 6 | Exact Docs navigation/control/conflict tests. |
| TEST-13/14/15 | 2,4,7 / deployment | Real RLS/HTTP/cache/deletion/log payload proof. |
| TEST-16/17 | 1,5,6,7 / release | Failure surface/device matrix and measured capacity/spend evidence. |

Use Node >=22.13.0 <23 and lockfile clean install for implementation validation. Existing commands: npm run test:api-client; explicit Vitest Other Costs/new feature suites; npm run test:edge-functions; npm run test:marketing; npm run test -w mobile-expo -- --runInBand; npm run typecheck; npm run marketing:build. Add the new renderer/API/test suites to repository test discovery. Local DB only: npm run db:verify plus new invoicing DB suite, registered in root test:db. DB reset is local and destructive to local fixtures; never run a production reset. Platform smoke builds/device tests supplement automated checks. Do not repeatedly broaden successful tests without a new failure/change.

## Migration/release sequence

1. Local additive schema/RPC and legacy-client tests; no production feature exposure.
2. Staging migration/server functions and financial diff/RLS tests; existing deploy scripts separate dry-run and apply. Verify linked project/ref and --workdir backend. No Supabase push during shaping.
3. Website preview using staging data, dynamic routes/card/access/cache proof and representative client versions; then approved production schema/backfill and server web deployment with public creation feature gated until validated.
4. Native build with new dependencies/config and physical-device evidence. New native modules require new binaries; an OTA-only rollout is insufficient.
5. iOS/Android submission and processing are separate from public availability. Use release skills only when release is separately authorized.
6. Enable user-facing feature only after compatible back-end/website/native versions and all test-contract gates pass. Recheck DB/hosting headroom and alerts; do not infer release safety from Vercel-only CI.

Rollback disables new creation/UI gates while keeping compatible reads, existing public links and stored renderer versions available. Do not drop documents/pricing fields, reverse backfill destructively, or delete issued history to roll back a mobile version. Use additive forward fixes for financial data; if access security fails, revoke affected links through authorized controls while resolving it. Historical amounts stay stable.

## Product-context closeout

After implementation, update current-product.html from verified behavior, npm run product:export and npm run design:check, synchronize maintained design exports without editing archived design pages, and record release/test evidence here. Review privacy/help copy for public bearer links/live payment state/local PDFs; update consent/legal revision only if policy text changes under existing process. No documentation should imply payment processing or proof of payment. Shaping alone does not revise shipped-product documentation or Figma screens.
