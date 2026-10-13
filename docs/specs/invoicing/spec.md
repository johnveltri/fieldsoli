# FieldSoli Estimates, Invoices, and Sharing

Status: Approved product spec. Invoice-backed revenue implementation is in progress.
Feature source: PM pasted invoicing plan and Branch · Competitive invoicing research.
Last updated: 2026-10-13. Source revision reviewed: b85ebe5; product decisions extended by the approved Invoice-backed Job Revenue plan.

## Outcome and scope

A solo operator maintains Job pricing once, previews professional customer-facing output, and shares a saved Estimate or Invoice by link or optional PDF. The Job remains the operational record for actual costs and time; one selected immutable Invoice snapshot is the authoritative source for Job Revenue. An Invoice's content and prices never change after creation.

The first release includes business identity/defaults, material markup, billable Other Costs, derived Revenue, native preview/share/Docs management, hosted pages, rich previews, and on-demand PDF. It is free for users. It introduces no payment processing or new subscription purchase.

## Approved decisions

- D-01: Only the selected revenue Invoice follows the Job's Paid/Unpaid state. Other invoices keep their last stored payment status. This is a Job status indication, not evidence of payment processing.
- D-02: Preserve all existing Job amounts, documents and links during migration. Do not select a historical Invoice automatically. On the next Complete/Paid, explicit replacement or revenue-selection action, the owner chooses an existing Invoice or creates one. Deleted Jobs retain existing restoration review behavior.
- D-03: Tax is one business rate with category multi-select Labor & Services, Materials, Billable Other Costs. All selects all three. No cost-level tax controls.
- D-04: Materials without an explicit override use the current business default markup. Changing that default reprices existing Job materials and future document snapshots; explicit overrides, including 0%, stay fixed. Settings explain this. New Other Costs start nonbillable.
- D-05: Separate per-owner Estimate/Invoice sequences start 00001. Estimate expiration is Off/7/14/30 days, default 30. Payment terms default Due upon receipt; Net 7/15/30 derive the due date. Names, summary, and complete charges are required only for document creation.
- D-06: Deleting a Job disables public access but retains its snapshots. Restoring the Job does not silently re-enable links. Account deletion removes snapshots and links.
- D-07: Complete and Paid finish through financial review and leave the Job with a selected Invoice. Create that Invoice when none is selected; sharing remains optional. A selected Invoice remains the Revenue source when current costs change. Replacing it is explicit.
- D-08: A Job has one selected revenue Invoice. Selecting another archives/disables the prior Invoice's link, while preserving the chosen Invoice's existing archive/link controls. Job Edit changes are staged until Done. A Paid Job changing to a different invoice total requires confirmation of the new total; cancellation preserves the source and Paid state.
- D-09: Invoice creation solidifies the then-current business material markup on materials without an explicit override; existing explicit values, including 0%, are preserved. Estimates do not solidify markup. Clearing a material override resumes the current default for future calculations and never changes saved invoice Revenue.
- Documents include the Job's short and long descriptions. Private Notes, time, costs, markup, earnings, and hourly metrics never enter the public payload.
- PDF generation happens only after Download PDF is selected. A saved document is content plus a renderer version, not a PDF. No server PDF provider, PDF queue, or permanent PDF storage.
- Reuse the existing Vercel Pro website, confirmed by the PM. Do not upgrade hosting or buy another provider.
- Preserve supplied Docs navigation and the rich-preview card's business name, type/number, short description, and total. Prior ChatGPT assistant suggestions do not override these decisions.

## Product requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| REQ-01 | Store business identity and estimate/invoice defaults once in Profile; do not add required onboarding steps. | TEST-01 |
| REQ-02 | Replace editable Revenue with Labor & Services across Job capture/edit; derive pretax Revenue and preserve internal cost and Net earnings/Net/hour meanings. | TEST-02, TEST-03 |
| REQ-03 | Apply the current business material markup default whenever no explicit override is present; reprice existing Jobs on default changes while preserving explicit overrides and issued documents. | TEST-02, TEST-04 |
| REQ-04 | Invoice customer adds an equal Other Cost charge while retaining the internal cost; business tax selects customer-charge categories. Tax is excluded from Revenue and net earnings calculations. | TEST-02, TEST-04 |
| REQ-05 | Preserve existing financial history, amounts, documents, links, null/zero confirmations and payment behavior during migration. Adopt invoice-backed Revenue only at explicit finalization, replacement or selection; never auto-select historical invoices. | TEST-03, TEST-18 |
| REQ-06 | Share FAB opens unsaved preview with a type selector; default Estimate for unfinished work, Invoice for completed work regardless of payment. Either type can be selected before creation. | TEST-05 |
| REQ-07 | One versioned HTML/CSS renderer supplies native, hosted, and PDF content; professional black-and-white mobile/desktop/print layouts. | TEST-09, TEST-10 |
| REQ-08 | Create & Share atomically freezes the approved data, assigns its number and enabled link, then opens sharing. Finalization creates/selects an Invoice without requiring sharing. Concurrent/retried/interrupted requests do not duplicate documents. | TEST-06, TEST-07, TEST-18 |
| REQ-09 | Keep saved content/prices/type/number/dates immutable. A selected Invoice alone follows Job Paid/Unpaid; unselected Invoices retain their last payment status. Job Revenue equals the selected Invoice pretax subtotal. | TEST-07, TEST-08, TEST-18 |
| REQ-10 | Share via Messages, WhatsApp, Gmail, More, Copy link, Open in browser, or explicit Download PDF; prefill usable contact values copied into the saved document from the Job and allow user-controlled completion. | TEST-10, TEST-11 |
| REQ-11 | Documents shows nonarchived documents in View; tapping a row opens Preview. Job Edit shows saved documents, Preview, Archive & Disable Link and Use for Job Revenue controls, plus Create Invoice/Estimate. | TEST-08, TEST-12, TEST-18 |
| REQ-12 | Serve high-entropy bearer links without public discovery/indexing; archiving disables the link, and public access requires an active link. Publish only the allowlisted snapshot. | TEST-13, TEST-14 |
| REQ-13 | Respect Job/account deletion and restoration, tenant boundaries, and analytics consent/redaction; existing economic CSV semantics remain compatible. | TEST-03, TEST-14, TEST-15 |
| REQ-14 | Keep incomplete Job capture permissive; document creation requires complete customer-facing data. Recover from stale data, failed save, offline use, cancelled sharing and PDF errors without losing history or silently creating another document. | TEST-05, TEST-06, TEST-10, TEST-16 |
| REQ-15 | Avoid eager PDF/asset work and paid renderer services; measure the resource envelope and verify eligible hosting before launch. Preserve consumer-grade accessibility and platform behavior. | TEST-09, TEST-10, TEST-16, TEST-17 |

## Artifact manifest

| Artifact | Applicability | Path | Rationale |
| --- | --- | --- | --- |
| State model | Required | state-model.md | Creation/retry, payment projection, sharing/PDF, deletion and restoration. |
| Data contract | Required | data-contract.md | Money semantics, snapshots, ownership, public access and migration. |
| UX contract | Required | ux-contract.md | Profile/Job/Docs/preview/share/web/PDF and exact copy. |
| Test contract | Required | test-contract.md | Financial, migration, security, device/browser and release evidence. |
| Build plan | Required | plan.md | Ordered changes, compatibility, and execution gates. |

## Constraints and acceptance examples

- Field-speed simplicity: no pricebook, CRM, billing-rate/time pricing, compulsory tax setup, or extra requirements for ordinary Job saves. Document readiness does not require a completed Job, time tracking, or internal-cost review confirmations.
- $400 Labor & Services, $100 Materials with 20% markup, $50 billable Disposal, $20 nonbillable Parking gives Revenue $570, costs $170, Net earnings $400. With 10% tax on all categories, tax is $57 and document total $627; Revenue stays $570.
- Before invoice adoption, that component pricing proposal calculates Revenue as above. After selection, Revenue is the chosen Invoice's saved pretax subtotal, while Net earnings and Net/hour use current costs and time. Late costs and time remain editable without changing the selected Invoice.
- Creating an Invoice records the current business markup as an explicit override only for materials without one. A later default change or cleared override cannot change the selected Invoice's saved Revenue.
- Changing a business name, tax/default setting, customer or Job prices after saving does not alter an issued document. Marking a Job Paid changes only its selected Invoice's stored status; older Invoices retain their last status.
- Complete/Paid always use final financial review. If an Invoice is already selected, finalization uses its saved total even when current proposed charges differ. Replace Invoice is an explicit action; paid replacement with a different total confirms the new amount before the source/status changes.
- A document survives cancellation of the destination share composer. Returning to Docs can reshare that same number and link.
- Archive hides a row from Job View and disables its public link. Fresh public HTML and metadata/image responses become unavailable. Exported PDFs and already cached external previews cannot be recalled.
- An owner can produce a PDF for an archived or link-disabled document; disabled link destinations remain unavailable until explicitly enabled. No link is enabled by an attempted share.
- The public page contains personal/business information and financial amounts deliberately selected by the user. Noindex does not provide authentication. Do not claim the URL is confidential, uncrawlable, or impossible to index.

## Agent-decided implementation assumptions

Data/UX contracts own precise validation, rounding, dates, safe fallback, retry and security rules. Use USD consistently with the existing product; currency conversion and additional currencies are outside this release. Completed means the backend work status, not its UI Paid alias. On Hold and Cancelled default Estimate; their unsaved selector remains available.

Use the existing Next.js website, a shared pure HTML/CSS renderer, native WebView/print/share primitives and existing design-system wrappers. Exact package versions are selected through Expo's SDK-compatible install and locked during implementation; dependencies are not installed during shaping. Technical alternatives and cost evidence are in technical-evidence.md.

## Non-goals and deferred work

Receipts, payment processing or evidence, partial payments/balances, refunds, deposits as separate entities, estimate acceptance/signatures, automated tax jurisdictions/advice, per-cost tax rules, labor/Other Cost markup, discounts, pricebooks, document editing, auto-send, delivery/read tracking, numbering configuration, business branding, business-name URLs, and permanent PDF archives. A new document is a fresh Job snapshot; estimate-to-invoice conversion is not a separate financial transaction.

## Open blockers

None. Existing hosting usage/spend and platform proof are implementation/release evidence gates, not unresolved product decisions. Final shaping readiness and coverage are recorded in readiness.md; production launch still requires the gates in test-contract.md and plan.md.
