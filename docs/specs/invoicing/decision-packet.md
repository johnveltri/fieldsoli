# Estimates, Invoices, and Sharing — Decision Packet

Date: 2026-10-06
Readiness: Ready for Implementation — product choices resolved; see spec.md and readiness.md for the final contracts. The original question table below is historical.
Source revision: b85ebe5. Working branch: codex/invoicing-shaping.

## Proposed direction

Let a solo operator turn the Job they already maintain into a professional Estimate or Invoice, preview the exact customer-facing output, and share a saved document through a hosted link or PDF. Preserve field-speed Job capture, trustworthy net earnings, and historical customer-facing documents.

This is a coupled foundation: pricing changes affect Jobs, Materials, Other Costs, completeness, payment status, analytics, exports, and future financial documents. The smallest useful release is the user's supplied estimate/invoice scope, without payment processing, receipts, partial-payment UI, or Pro branding.

## Source interpretation

- The pasted plan is the primary product direction. The referenced ChatGPT conversation, “Branch · Competitive invoicing research,” was read for context; assistant recommendations are not approvals.
- Preserve the pasted Docs navigation: Job View row opens Job Edit's Docs section; explicit Preview opens the saved document. Do not replace this with the prior assistant's direct-preview alternative.
- Preserve the specified rich-preview card: business name, document type/number, short description, and total. It excludes customer contact details but still intentionally publishes description and amount to preview crawlers.
- The truncated line “Document numbers have separate in” is interpreted as separate Estimate and Invoice sequences; starting values remain proposed below.
- Invoice due date derives from terms. Due upon receipt is the approved default; this supersedes “Due date — today.”
- Work status supplies the default type; the unsaved selector allows either type. Saved type is fixed.

## Direction already supplied by the user

1. Reusable business name, address, phone, email, website, and optional license number; material markup percentage, 0%-default tax with business-level multi-select Labor & Services / Materials / Billable Other Costs and an All control, payment terms, and estimate expiration. No per-cost tax checkbox.
2. Material markup can be changed for an individual material.
3. Replace the Revenue input with Labor & Services. Revenue = Labor & Services + customer-facing Materials + billable Other Costs. Materials customer charge = internal cost + markup. All direct costs remain costs, including passed-through costs. Use Net earnings and Net/hour terminology.
4. Other Costs gain “Invoice customer,” producing an equal customer charge; no Other Cost markup.
5. One HTML/CSS document renderer powers native preview, hosted web, and PDF. Black and white, mobile-first, bounded desktop/print width. A document is a saved content snapshot rendered as a page; PDF generation occurs only when Download PDF is selected, never on creation, sharing a link, preview, or crawler access.
6. Share FAB opens live unsaved preview. Saving freezes customer-facing data, assigns a number, creates a hosted URL, then opens the share sheet. Existing documents use “Share Estimate” / “Share Invoice.”
7. Share sheet offers Messages, WhatsApp, Gmail, More, Copy link, Open in browser, and Download PDF. PDF opens native sharing. Recipient details come from the saved document's copied Job customer snapshot; later Job reassignment cannot silently change a historical document's recipient.
8. Job View's Docs section omits archived rows. Job Edit includes them; type, number, and snapshot date are read-only. Archive and link enablement are independent controls; “Generate new” creates another snapshot.
9. Free hosted route is /share/<random-token>. Branded routes/colors are deferred Pro work. Anyone possessing the URL can access an enabled document; exclude from sitemap/discovery and request no indexing/following while allowing link-preview retrieval.
10. Invoices display Paid/Unpaid and Total/Amount Due accordingly. Every saved Invoice reflects its Job's current Paid/Unpaid status, even if an older Invoice has a different total. The badge and Total/Amount Due label are live; amounts/content remain immutable. No payment records, payment method, receipt, or amount-paid/balance accounting in V1.

## PM decisions received on 2026-10-06

- D-01B approved, with dependent clarification: every Invoice follows the Job's current status. Estimate content has no payment badge. PDF captures the status at explicit generation time; an already exported file cannot update.
- D-02A approved: preserve Revenue with initial 0% material markup and nonbillable Other Costs. PM requested a production check before adopting the negative-residual exception; see production-evidence.md.
- D-03 replaced by the approved business-level category multi-select and All control. User-configured rate applies to selected customer-charge categories, including material markup inside the Materials price. This does not provide jurisdiction advice.
- D-04 approved: capture the business markup on new materials; changes affect future additions. Settings helper copy: “Applies to new materials added.” New Other Costs default Invoice customer unchecked.
- D-05 approved: separate Estimate and Invoice sequences starting 00001; expiration Off/7/14/30 days, default 30; required business/customer names, summary, complete customer-facing amounts. Default payment terms: Due upon receipt; Net 7/15/30 remain options.
- D-06 approved: Job deletion disables public access while retaining recoverable snapshots; account deletion removes documents and disables links.
- On-demand PDF added as an explicit cost constraint. Selected implementation: device-side PDF generation with no permanent server PDF storage or rendering provider.
- Dependent restoration decision: exclude deleted Jobs from the initial migration and require pricing review on restoration.
- Public summary: include both short and long Job descriptions; keep Notes and other internal fields private.
- Hosting: the PM confirms existing Vercel Pro and authorizes reuse; no new plan or provider purchase.

The question table below preserves the original decision history; resolved alternatives are not current blockers.

## Current-state evidence

| Area | Evidence | Implication |
| --- | --- | --- |
| Business profile | packages/api-client/src/profiles.ts currently exposes first name, last name, trades | Business identity/defaults need an explicit persisted boundary; personal name is not automatically a business name. |
| Pricing capture | apps/mobile-expo/src/screens/jobDetailEdit/useJobEditDraft.ts; packages/api-client/src/jobs.ts | Revenue is currently editable and included in atomic Job editing. New derived Revenue needs compatible writes and all capture paths reviewed. |
| Completeness | apps/mobile-expo/src/lib/jobFinancialCompleteness.ts | Positive Revenue or confirmed no Revenue satisfies one completeness leg; deriving prices must preserve null/zero/confirmed-none meaning. Document readiness must remain separate from work completion. |
| Costs | packages/api-client/src/materials.ts and otherCosts.ts | Materials and Other Costs persist in job_costs, with Job or Session parentage; total-only material capture exists. Pricing must use authoritative total cost and avoid excluding Session-linked rows. |
| Customer identity | docs/specs/job-customers/data-contract.md; backend/supabase/migrations/20260920180000_job_customers.sql | Copy Job-owned customer fields, never render an issued document from mutable Customer defaults. |
| Payment state | backend/supabase/migrations/20260924210000_no_revenue_marked_paid.sql | Generated payment state depends on Revenue/collected amounts and confirmed-zero paid behavior. Revenue corrections currently preserve fully paid state; schema also contains compatibility for partial rows. |
| Native integration | apps/mobile-expo/src/screens/JobDetailScreen.tsx, ProfileScreen.tsx; apps/mobile-expo/package.json | Expo 57; WebView, printing, file/share libraries are not direct dependencies in this package. Native preview and PDF require dependency evaluation and a new build. |
| Hosted surface | apps/marketing/src/app; apps/marketing/package.json | Existing Next.js marketing app is a potential host; no observed document renderer or share route. |
| Deletion/export | packages/api-client/src/account.ts; backend/supabase/functions/delete-account; backend/supabase/functions/_shared/job-export-content.ts | Account deletion and CSV output need explicit document/pricing coverage. Job deletion is soft deletion. |

No current-product.html claims were used: freshness was not established. Production was queried read-only at the PM's request; no live data changed. Current findings come from this checkout and the scoped production check, rather than assuming older Customer planning notes describe shipped behavior.

## Questions for PM — sent in two independent batches

| ID | Decision | Choices / proposed direction | Consequence |
| --- | --- | --- | --- |
| D-01 | Paid status after an invoice is issued | A: entire invoice stays frozen; create a new Paid invoice. B: freeze content/prices but update saved invoice payment status. | A preserves literal immutability but leaves old links Unpaid. B requires a separate mutable status model and an explicit rule for which invoices change, especially when amounts differ. |
| D-02 | Existing Job migration | A: preserve Revenue using Labor & Services = old Revenue − 0%-markup Materials, Other Costs initially nonbillable; review negative residuals. B: keep legacy pricing until explicit conversion. | Never silently add existing material costs to historic Revenue. A needs an exception flow; B adds a visible dual-pricing model and conversion guard. |
| D-03 | Tax on billable Other Costs | A: exclude Other Costs in V1. B: add a per-cost taxable checkbox. | Labor/Materials/Both alone does not define Other Costs taxation. This is configured arithmetic, not jurisdiction advice or automatic compliance. |
| D-04 | Defaults over time | Proposal: capture markup when a material is added; future default changes affect only future rows. New Other Costs default “Invoice customer” unchecked. | Changing business defaults cannot unexpectedly reprice already recorded work. Inbox/Session materials must capture consistently. |
| D-05 | Document defaults and creation guard | Proposal: independent sequences start 00001; estimate expiration Off/7/14/30 days, default 30; derive invoice due date from terms; require business name, customer name, summary, and complete customer-facing charges to create. | Jobs remain permissive. This adds only a document-creation guard. No requirement for time tracking or cost-completeness confirmations solely to issue a document. |
| D-06 | Deleting a Job | Proposal: public documents become unavailable, snapshots stay recoverable with the Job. Account deletion removes snapshots and disables links. | Defines public exposure and retention; restoring a Job must not silently reactivate links without an agreed rule. |

These questions are preference/financial-lifecycle decisions, not requests for permission to investigate. Responses may require a short dependent round; for example D-01B needs invoice-level status ownership, and D-02A needs the negative-residual resolution policy.

## Agent-resolved technical direction for later contracts

- Separate immutable document content from mutable archive/link controls. Archive alone does not revoke access.
- Use an allowlisted customer-facing payload. Never publish internal costs, markup percentages, net earnings, Net/hour, sessions, private notes, or arbitrary Job JSON. The short summary needs an explicit selection rule; a long description is not automatically public.
- Atomic server creation should validate ownership and authoritative source revision, calculate rounded amounts, allocate the sequence, and persist the snapshot/link together. A retained idempotency key prevents duplicate documents on retry or interruption. Cancelling sharing after creation does not delete the document.
- A stale unsaved preview must refresh and obtain a renewed creation action rather than silently sharing unseen changes. Failed creation keeps the preview recoverable; existing documents remain shareable after a cancelled destination handoff.
- Preserve the canonical renderer version/styles with the snapshot or a supported version mapping so future template changes do not silently alter saved documents. Native controls wrap the renderer; they are not a second document implementation.
- Public resolution must check link enablement on HTML, metadata/image, and any hosted PDF requests. Avoid public immutable caches that defeat revocation. Downloaded PDFs and third-party cached previews cannot be recalled.
- Link tokens must have cryptographic entropy and must not appear in analytics event payloads. Owner access must not rely on possession of the public token. Text must be escaped and renderer resources tightly controlled.
- Noindex is a crawler directive, not access control. Google must be allowed to fetch a page to see the directive; do not block the route in robots.txt and assume it cannot be indexed. Apply relevant response headers to PDF/image resources too. [Google documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Investigation resolved / implementation evidence gates

- The approved behavior and final applicability manifest are in spec.md. All four supporting contracts and plan.md are written separately.
- production-evidence.md records the requested aggregate production check; technical-evidence.md records selected renderer/PDF/dependency/hosting choices and current authoritative sources.
- Platform printing/composer/accessibility proof and real resource measurement remain required implementation evidence under TEST-09/10/11/17. They are not claimed complete during shaping.
- The original decision questions above are retained as history. There are no unresolved PM choices. Final contracts supersede the proposals/alternatives in that historical table.

## Expected verification scope

Before merge: financial fixtures and rounding; total-only and Session-linked costs; migration preserving Revenue/net earnings including negative/zero/null cases; Paid/Unpaid compatibility; idempotent concurrent creation and numbering; tenant isolation; allowlisted public payload; revoke/archive/delete behavior; HTML escaping; renderer visual/accessibility and PDF pagination checks; appropriate mobile/API/backend/marketing validation. Stable TEST identifiers belong in the final test contract, not a prematurely approved plan.

Before release: local migration/old-client compatibility evidence, staging hosted-link and metadata/PDF checks, iOS/Android device preview/share/print tests, offline/interruption recovery, disabled-link/cache checks, free-tier forecast, and separate backend/web deployment, native build/submission/processing/public-release gates. Maintain current-product and design exports after implementation under repository guidance.

## Deferred

Receipts, payment processing/details, partial-payment UX, automatic tax jurisdiction lookup, labor/Other Cost markup, estimate acceptance/signatures, configured numbering, custom branding, and business-name URLs. No speculative payment entities or future-provider commitments are approved here.

## Readiness and throughput

- Verdict: Ready for Implementation; final audit and exact coverage in readiness.md.
- PM question groups asked: 11 in 5 batches. PM-agent decision rounds completed: 4.
- Fast PM product answers used instead of inference: 10; one answer explicitly requested production investigation.
- Consequential decisions reopened after approval: 0; follow-ups resolved previously undefined edges.
- Material technical decisions resolved independently: 6 (atomic/idempotent creation, server-authoritative calculations, versioned renderer reuse, allowlisted public payload, checked revocation/cache boundary, local on-demand PDF).
- Total elapsed shaping time, active PM time, active agent investigation time: Unknown; timing was not instrumented.
- Validation: source inspection, aggregate read-only production queries, current primary documentation, rule-ID/traceability/whitespace checks and a separate cross-artifact review. No implementation tests ran, no product code changed and no production data changed.
