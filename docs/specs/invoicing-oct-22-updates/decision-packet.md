# Invoicing October 22 updates — decision packet

Status: Decisions resolved; see readiness.md.
Date: 2026-10-22. Branch: `invoicing/oct-22-updates`.
Source reviewed: `b84c2c3`. Reports came from TestFlight on a physical iPhone 17 Pro Max; exact installed build and iOS version have not yet been verified.

## Proposed direction

Make address entry, document access after interruptions, customer sharing, and pricing display dependable within existing Job and Settings flows. Cover all ten supplied issues in one scoped update. Preserve existing document snapshots, invoice-backed Revenue, Paid confirmation, and manual address entry.

This is shaping only. Product code, deployment, and release submission have not started. The final spec, contracts and execution plan are now supplied in this directory.

## Scope and proposed acceptance checks

| ID | User report / intended change | Proposed acceptance evidence |
| --- | --- | --- |
| REQ-01 | Job Edit address search returns API suggestions. | Trace authenticated client → deployed endpoint → budget RPC → provider response → visible selectable results. Check valid search, no matches, timeout, unauthorized, quota exhaustion, rapid typing, selection, and manual save. A loading state must always settle. Diagnose the deployed environment before assuming a mobile code defect. |
| REQ-02 | Add address suggestions to Business Details. | Reuse the Job address hook/panel, US scope, threshold, debounce, maximum four results, attribution, draft selection, and existing Done/cancel semantics. Manual text stays editable and savable on failure. No new provider. |
| REQ-03 | Fix document preview from the Job FAB on Paid and In Progress jobs. | Exercise FAB and Job Edit entry points with no documents and existing documents across planned/in-progress/completed/paid states. Preserve default type and explicit type switching unless PM changes them; merely opening preview must not create a document or change work/payment status. Creation retains existing Paid replacement confirmation rules. |
| REQ-04 | Recover an open estimate/invoice after switching apps. | Background/foreground both saved and unsaved previews, including while loading and during native sharing. Return to the same document identity/type; settle into ready or actionable retry without requiring close/reopen. Never create or share automatically. Reject stale async responses and refetch mutable payment/link controls before sharing. |
| REQ-05 | Show material customer price beneath cost in Job View. | Keep the primary cost right-aligned. Put `{formatted amount} with markup` beneath it in existing secondary typography/color. Use row-total customer charge, before tax, calculated with existing rounding and override/default rules. Show the secondary amount for complete material costs, including explicit zero markup; omit fabricated amounts for incomplete costs. VoiceOver distinguishes cost from price with markup. Verify wrapping at large text sizes. |
| REQ-06 | Format phone numbers on hosted estimates/invoices. | Business and customer US ten-digit numbers display as `(000) 000-0000`; a leading US country code is handled. Preserve unsupported/international/extension-bearing values without losing digits. Formatting is presentation-only; stored snapshot and dialing values remain unchanged. Shared renderer changes must be checked in native preview, hosted page, and explicit PDF output. |
| REQ-07 | Stop an unexpected “Buddy name” in Messages sharing. | Identify whether the text occurs in recipient, body, or native suggestions. Pass only a validated saved-document customer phone as recipient; missing/invalid phone opens recipient selection without a fabricated contact. Preserve snapshot contact ownership. Inspect composer on physical device without sending. An iOS-assigned contact display name is not proven to originate in FieldSoli. |
| REQ-08 | Improve disabled web-link copy. | Use the requested exact neutral text `Invoice/Estimate no longer exists.` for unknown, disabled, archived, or deleted links, with no identifying metadata. Keep actual service outage separate with retry. Owner access to a saved document remains possible. |
| REQ-09 | De-emphasize FieldSoli in rich previews and put amount in SMS text. | Proposed message: `Invoice for $1,234.56 from {business name}\n{url}` (Estimate equivalent). Proposed card: business name, document type, immutable full total; small `Issued {formatted issue date}`. Keep number on the actual document. No customer identity, service address, private costs, or live Paid status in preview metadata. PM approved including the Job short title as well. |
| REQ-10 | Avoid deleting default zero for Material Markup and Tax Rate. | Reuse Job Edit's zero-entry behavior: focus on numeric zero exposes an empty editable draft; typing starts the new number. Blur without entry restores zero; nonzero values remain editable. Focus alone does not make settings dirty. Verify decimals, zero, clearing, cancel, save, keyboard and VoiceOver. |

## Questions for PM

1. **Approved:** Paid and In Progress jobs support both creating a new invoice and opening existing invoices, preserving Paid rules. Existing default remains Invoice for completed/paid and Estimate otherwise, with explicit switching in unsaved preview.
2. **Approved:** Include business name, document type, total and Job short title in the link preview, with small `Issued {formatted issue date}` and no customer name/address. This replaces existing UX-07/UX-09 number-first sharing requirements.
3. **Answered:** “Buddy name” appeared in the To/recipient field. Validate the saved phone and native handoff, then distinguish app-supplied recipient from an iOS-resolved display name; no root cause is confirmed.

## Current-state evidence

- `apps/mobile-expo/src/components/ds/customer/useAddressAutocomplete.ts`: 300 ms debounce; five-character/two-letter threshold; latest-request guard; provider errors hide suggestions; rate-limit latch resets when disabled. A thrown lookup would bypass the success/error completion path. This is a diagnostic lead, not a confirmed cause.
- `packages/api-client/src/addressAutocomplete.ts` invokes the authenticated `address-autocomplete` endpoint and maps structured error responses.
- `backend/supabase/functions/address-autocomplete/index.ts`: explicit user authentication, budget RPC, server-side `GEOAPIFY_API_KEY`, structured failures. Deployment, secret presence, RPC availability and real provider results remain unverified.
- `apps/mobile-expo/src/screens/BusinessSettingsScreen.tsx`: address is free text today; markup/tax focus toggles formatting but retains zero.
- `apps/mobile-expo/src/screens/JobDetailScreen.tsx`: FAB invokes the view controls ref; Job Edit has separate controls and a save-before-preview path.
- `apps/mobile-expo/src/components/invoicing/InvoicingJobControls.tsx`: `openPreview` calls unsaved preview; defaults vary by work status. AppState active calls document-list reload; inspect unsaved preview reload, WebView recovery, modal ownership and async cancellation separately. Existing resume handling alone does not prove the reported behavior works.
- `apps/mobile-expo/src/components/ds/ViewActivityBuckets.tsx`: material rows currently render one right-side `priceLabel` with an accessibility label; no secondary charge.
- `packages/document-renderer/src/pricing.ts`: current effective markup is override, otherwise business default, with round-half-up cents. Current code supersedes older memory about captured per-row defaults; do not change pricing semantics in this update.
- `packages/document-renderer/src/render.ts`: business/customer phone strings are rendered directly.
- `apps/mobile-expo/src/lib/documentShare.ts`: shared body leads with document number. SMS adapter in InvoicingJobControls passes snapshot phone directly to `SMS.sendSMSAsync`.
- `apps/marketing/src/lib/share-document.ts`, `src/app/share/[token]/page.tsx`, `opengraph-image.tsx`: metadata and image already exist; current generic unavailable copy and card hierarchy are explicit change targets.
- Existing `docs/specs/invoicing/` and `docs/specs/job-customers/` own snapshot, sharing, address attribution, privacy, and lifecycle rules. This update must amend their conflicting copy/direction when approved.
- Brand source: `docs/product/brand-strategy.md`. `current-product.html` was not used as evidence. No roadmap inspection.

## Product Design direction

Use the current material row as the code target and preserve its hierarchy, spacing, quantity, tap and delete behavior. Stack primary cost and secondary customer price on the right; do not add another card or new navigation. Reuse existing typography and foreground tokens. Consumer-facing preview should emphasize the sender's business and amount; include the immutable Job short title per PM approval. This is a design brief, not a visually verified mockup or completed Product Design build. Capture the current row and verify the final row at implementation time.

Component comparison: existing row/panel primitives provide brand fit and minimal maintenance; native input and SMS primitives retain platform keyboard/composer behavior; an additional UI library would duplicate existing capabilities and add bundle/maintenance cost; custom work should be limited to amount composition and metadata layout. No additional package is currently justified.

## Dependency, privacy and operating constraints

- Reuse Geoapify behind the existing authenticated server boundary. Never ship its key or log raw queries, addresses, contacts, document tokens or exact financial values.
- Verified provider free tier: 3,000 credits/day, up to 5 requests/second; autocomplete costs one credit/request. Existing DB budget defaults are 100/user/day and 2,900/project/day shared across entry points. Adding Business Details consumes the same budget, not an additional allowance. Planning example only: 100 active users × 20 requests/day = 2,000 credits; actual traffic and account plan are unverified. Per-second quota protection must also be evaluated.
- Preserve attribution and review commercial/data-source terms for the deployed provider plan. Manual address entry is the credible no-cost fallback; do not adopt a paid replacement or upgrade automatically. Provider-neutral interface limits lock-in; maintaining shared cancellation, budget and fallback logic is the ongoing cost. Before approaching limits, measure safe aggregate counts and request a separate paid-tier decision.
- No schema migration is assumed. If diagnosis proves one necessary, document an additive migration, rollback/recovery approach and old-client compatibility before execution.
- Use existing allowlisted document fields for previews. Destination services can retain cached previews; removing a hosted link cannot promise cache recall. Actual iMessage rendering requires a physical-device check against a fresh URL.

Authoritative sources checked 2026-10-22:

- [Geoapify pricing](https://www.geoapify.com/pricing/) and [per-API credits](https://www.geoapify.com/pricing-details/).
- [Expo SMS](https://docs.expo.dev/versions/latest/sdk/sms/): phone recipient API; SMS unavailable in iOS simulator. Keep installed Expo-compatible package rather than upgrading to match latest documentation.
- [Supabase function secrets](https://supabase.com/docs/guides/functions/secrets): separate local/production configuration. Changelog Markdown fetch and Apple rich-preview documentation fetch were unavailable in the research tool; verify relevant current docs before platform-specific implementation.

## Contract applicability and planned execution

All four supporting contracts are Required: state-model.md (lookup/resume/retry), data-contract.md (provider, snapshot contacts, derived prices, public metadata), ux-contract.md (all surfaces/copy/accessibility), test-contract.md (cross-layer and physical-device proof). All required files are supplied; see spec.md and readiness.md.

Planned order after decisions: establish repro/build context and diagnose address service; repair/reuse address flow; fix FAB/resume with focused component tests; add derived material display and zero-entry behavior; update shared phone rendering, recipient validation, message text and hosted metadata; synchronize parent contracts/product exports/maintained Figma where affected; run readiness review before implementation approval.

Verification before merge: requirement-mapped unit/component/API/renderer/marketing tests, typecheck, relevant edge/DB checks if those layers change, visual/accessibility checks, no private metadata leaks. Verify actual address-provider success separately from mocked tests. Current tests have not been run because no implementation has changed.

Verification before release: exact source/build/environment match; independently verify any needed function deployment and website deployment; physical iPhone 17 Pro Max TestFlight checks for address selection, Paid/In Progress FAB, app switching, SMS recipient, fresh iMessage preview, keyboard and large text. Verify EAS build, submission and Apple processing independently. No production mutation or release authorized by this shaping packet.

Non-goals/deferred: new provider, address verification/deliverability, contact management, snapshot rewrites, payment semantics redesign, new accounting features, guaranteed third-party cache recall. No supplied issue is intentionally dropped.

## Readiness and throughput

Readiness: Ready for Implementation; final contracts and review are recorded in this directory. Technical root causes remain investigation tasks rather than invented confirmed findings. Product Design visual verification remains required during implementation.

PM questions asked: 3. PM-agent answered decision rounds: 3. Fast PM answers used instead of research: 3. Material decisions resolved independently: 4 (reuse provider/panel, preserve pricing semantics, shared phone presentation, reuse zero-entry pattern). Consequential decisions reopened after approval: 0. Total elapsed shaping time, active PM time and active agent investigation time: Unknown (not measured).
