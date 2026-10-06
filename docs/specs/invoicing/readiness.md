# Invoicing — Readiness Review

Reviewed: 2026-10-06. Source revision: b85ebe5. Branch: codex/invoicing-shaping.

**Readiness: Ready for Implementation.** This is a completed shaping contract, not an implementation or release approval. No product tests/builds have run for this feature.

## Contract coverage

| Rule family | Defined | Mapped to required test evidence | Mapped to implementation/gates |
| --- | ---: | ---: | ---: |
| Product REQ | 15 | 15 | 15 |
| State STATE | 10 | 10 | 10 |
| Data DATA | 14 | 14 | 14 |
| UX | 12 | 12 | 12 |
| Test TEST | 17 | 17 evidence rows | 17 |

State model, data contract, UX contract, and test contract are all Required and present separately. No consequential PM decision or technical architecture blocker remains. Platform/device behavior and quota/hosting measurements are explicitly required implementation evidence rather than inferred successful validation.

## Separate cross-artifact review

- Source order: current user approvals control; assistant research recommendations are contextual. Current implementation and the aggregate production check support migration boundaries. Shipped-product HTML was not used as verified evidence.
- Financial ownership: Job owns current pricing and payment status; immutable document owns copied amounts/content/dates; business defaults affect future additions/previews. No invoice ledger, partial balance or tax-in-Revenue meaning slips into the contracts.
- Migration/restoration: active backfill preserves economic history. Deleted Jobs stay legacy until explicit review after restoration. Initial 0%/nonbillable migration does not apply today's business markup to older costs. New active negative residual at cutover pauses affected conversion and returns counts to PM rather than clamping silently.
- Document privacy: explicitly approved short/long summaries and contact block are allowlisted; Notes, time/cost/markup/earnings never publish. Metadata excludes long description/customer/contact data. Bearer-link limitations, third-party preview/PDF recall and noindex semantics are stated honestly.
- Live status: all old/differently priced Invoices follow Job Paid/Unpaid on fresh read. Frozen prices/dates and PDF-at-export status are consistent; no claim of a payment record is made.
- Lifecycle/recovery: stale preview, concurrent creation/counters, uncertain commit, app termination, destination cancellation, offline status, toggle conflict, disabled-link owner PDF, deletion and restoration are specified across state/data/UX/test/plan.
- Dependencies/cost: one HTML/CSS renderer, maintained MIT-native modules, existing Next/Vercel Pro and Supabase Free. PDF has no eager generation/permanent storage/server vendor. Actual resource/spend/device proof is required before launch; no new purchase/upgrade is authorized.
- Accessibility/consumer quality: wrappers reuse proven components with explicit field/keyboard/safe-area/assistive requirements. Real WebView/composer/print evidence is required, not inferred from library documentation or mocked tests.
- Contradictions: none remaining after resolving the draft's old pending-decision wording and clarifying that existing zero-cost placeholders are incomplete for document readiness. A zero-total document with explicit zero Labor and no incomplete charges remains supported.
- Unplanned requirements/plan tasks, missing artifacts, state/data/UX/test mismatches: none found in the final review. Every defined rule family maps to the test contract and execution plan; the automated identifier audit supplements this semantic review.

## Required implementation evidence

Before merge: authoritative financial/default/date fixtures, local migration/legacy-client/RLS/race proof, immutability and live status, exact UI/error/navigation behavior, renderer/browser/PDF/security checks and relevant mobile/API/marketing/typechecks.

Before deployment/release: fresh read-only migration aggregate, staging financial before/after evidence, public revocation/cache/deletion/log checks, existing resource/spend readings, iOS/Android physical-device preview/composer/PDF/accessibility/interruption proof, compatible renderer/client versions, separate database/web deployment and native submission/processing/public-release gates, product-context/design closeout. test-contract.md owns detailed evidence; plan.md owns command/order mapping.

## Deferred work

Receipts/payments/partial balances, signatures/acceptance, automatic jurisdiction taxes, discounts/pricebooks, extra markup systems, edit-issued-document behavior, custom branding/routes, configured numbering, server/browser one-click PDF download, permanent PDF archive, bulk document export, delivery tracking and external cache recall. None are implementation prerequisites.

## Shaping throughput

- PM question groups asked: 11, in 5 batches.
- PM-agent decision rounds: 4.
- Fast PM product answers used instead of inference: 10; one answer requested a production check.
- Material technical decisions resolved independently: 6, recorded in decision-packet.md.
- Consequential decisions reopened after approval: 0.
- Total elapsed shaping time: Unknown; active PM time: Unknown; active agent investigation time: Unknown. No timing or time-saved claims are inferred.

## Artifacts

- docs/specs/invoicing/spec.md
- docs/specs/invoicing/state-model.md
- docs/specs/invoicing/data-contract.md
- docs/specs/invoicing/ux-contract.md
- docs/specs/invoicing/test-contract.md
- docs/specs/invoicing/plan.md
- docs/specs/invoicing/decision-packet.md
- docs/specs/invoicing/production-evidence.md
- docs/specs/invoicing/technical-evidence.md
- docs/specs/invoicing/readiness.md

Documentation validation is limited to identifier/traceability/whitespace checks, current-source inspection, scoped production read-only aggregates, primary-source dependency review and the semantic cross-artifact review above. Implementation validation remains unexecuted.
