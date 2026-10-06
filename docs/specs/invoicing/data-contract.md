# Invoicing — Data Contract

Canonical terms: Labor & Services, Revenue, material markup, Invoice customer, Net earnings, Net/hour, Estimate, Invoice. Amounts are USD integer cents. Job/Customer snapshots remain distinct. Logical fields/interfaces below are implementation contracts, not an applied migration.

## DATA-01 — Business identity and defaults

Add owner-scoped business_settings with one row per auth user, cascade on account deletion. Business name/address/phone/email/website/license are nullable trimmed text; business identity does not overwrite personal profile fields. Reuse existing field limits where present; new limits: name 200, address 1000, phone 100, email 320, website 2048, license 200 characters. Reject over-limit writes with field feedback rather than truncating silently.

Defaults: material_markup_bps integer 0; tax_rate_bps integer 0; taxable_categories set of labor/materials/billable_other_costs (initially all, inactive at rate 0); payment_terms enum due_on_receipt/net_7/net_15/net_30 (default due_on_receipt); estimate_expiration_days null/7/14/30 (default 30). Markup allows 0–100000 basis points (0–1000%); tax 0–10000 (0–100%); at most two fractional percentage digits. All is a UI bulk-selection control, not a fourth category or duplicate tax base. Empty category selection means zero taxable base; permit it without per-cost controls. These are numeric validation boundaries, not tax advice.

Version defaults with a monotonically changing revision. Settings edits affect future document previews; issued settings/business identity copies never change. The captured markup rule is DATA-02.

## DATA-02 — Cost pricing fields and inclusion

job_costs material rows gain captured markup basis points and optional explicit override basis points. Effective markup is override when present, otherwise captured value. Creating a material anywhere (Job, Live Session, Inbox) captures the current business default server-side once; reassignment and edits preserve it. Removing an override returns to the row's captured default, not today's business setting. Migrated existing rows use captured 0%. No markup dollars, labor markup, or Other Cost markup.

Nonmaterial rows gain invoice_customer boolean default false. Material rows never use that boolean; Other Costs never use material markup fields. Existing six cost categories remain unchanged. Retain internal total_cost_cents and total-only capture semantics; do not overwrite cost with customer price. Include each non-deleted Job-linked or active Session-linked cost once, with matching tenant ownership, excluding independently deleted costs/Sessions. Reparenting affects both source and destination pricing revisions. Inbox costs have no Job Revenue until attached.

## DATA-03 — Financial invariants and rounding

Job gains labor_services_cents nullable nonnegative bigint for normal component pricing, pricing_mode/version and pricing_needs_review for migration compatibility. Null Labor means Revenue remains unknown; confirmed $0 is distinct. For a complete priced Job:

```text
material markup cents per row = round_half_up(total_cost_cents × effective_markup_bps / 10000)
customer material charge = total_cost_cents + rounded markup cents
billable other charge = total_cost_cents if invoice_customer, otherwise 0
Revenue = Labor & Services + sum(customer material charges) + sum(billable other charges)
direct costs = sum(all included material and Other Cost internal totals)
Net earnings = Revenue − direct costs
Net/hour = Net earnings / actual hours, following existing zero/unknown-time display rules
taxable base = sum(customer charges whose category is selected)
tax cents = round_half_up(taxable base × tax_rate_bps / 10000)
document subtotal = Revenue; document total = subtotal + tax
```

Use exact integer/numeric arithmetic, not binary floating point for authoritative calculations. Sum rounded row markups; compute tax once on the selected-category aggregate, not independently per row. Validate final values against JS safe integers for transport and existing supported money bounds; reject overflow, NaN, negative input, malformed categories and excess precision. Tax never changes Revenue, collected_cents, direct costs or Net earnings. A $0 priced document is allowed if required values are explicit and complete. Negative Net earnings are allowed; negative normal customer charges are not.

Current jobs.revenue_cents remains the compatible read projection used by lists, metrics/completeness/payment/export. Do not rename historical Revenue as Labor or make new material costs additive during backfill. Existing row-health helpers treat material totals <=0 and Other Cost amounts <=0 as missing; reuse that interpretation for document readiness rather than claiming placeholder $0 is a complete charge. Any included material row lacking a positive amount, or billable Other Cost without a positive amount/explicit category, blocks creation; omitted/no cost rows and nonbillable incomplete Other Costs do not. No new cost-level completeness control is introduced. A complete $0 document therefore has explicit zero Labor and no unresolved material/billable-cost rows.

## DATA-04 — Allowlisted snapshot and readiness

financial_documents has owner id, active-source Job id, document id, estimate/invoice type, per-type integer number, immutable created_at/issue_date/source_timezone/valid_until or due_date/terms, currency USD, renderer_version, source fingerprint and immutable structured content. Snapshot includes copied business fields, copied Job customer_name/phone/email/service_address, Job short and long descriptions, customer-charge line items, copied tax configuration/base/amount/subtotal/total. Store line items inside the immutable payload rather than a separately mutable table in V1.

Customer presentation: customer name and service address if present; phone/email may be displayed in the document contact block. They originate from the Job snapshot, never mutable customers or auth profile data. Preview metadata excludes customer contact/address and long description.

Charges: Labor & Services, one aggregated Materials row, then billable Other Costs grouped by the six existing category names. Do not expose their free-form internal descriptions. Omit zero-valued charge rows except a zero Labor & Services row when the whole subtotal is zero; totals remain present. No material unit costs, cost quantities, markup, private Notes, Session times, internal metrics, collected amounts or arbitrary raw Job data enter this payload.

Required for creation: nonblank business name, customer name, meaningful nonblank short description (Untitled Job is not a customer-ready summary), explicit Labor amount, known included material/billable-cost amounts, valid chosen defaults/dates, no unresolved legacy review. Long description is optional, included exactly as saved when present. Preserve line breaks and escape text; no HTML/Markdown interpretation. Job saves stay permissive. Do not require customer contact/address, license, any business contact field, time tracking, cost confirmations or completed work just to create a document.

## DATA-05 — Atomic preview and creation interfaces

Authenticated preview(Job id, type, IANA timezone) returns allowlisted live content, readiness gaps, current payment projection, and source fingerprint. Fingerprint covers Job identity/pricing/payment revision, included costs/Session assignment, business settings version and render version; jobs.updated_at alone is insufficient. Issue date uses the server instant in the submitted validated device timezone. Invoice due date is that date + 0/7/15/30 calendar days; estimate valid_until + selected calendar days or null. UTC created_at remains audit time. No DST-hour arithmetic. New day or timezone requires refreshed preview before creation.

Authenticated create(Job id, type, source fingerprint, timezone, idempotency UUID) validates ownership/active Job/readiness and authoritative content. Compatible locks or serializable checks bind revision verification, numbering, snapshot and link creation in one transaction. A stale preview returns a conflict and fresh preview is shown before another explicit confirmation. Client cannot submit trusted totals, tenant ids, rendered HTML or selected public raw fields. Same owner/key/same intent returns same document; changed intent with same key is rejected. Retain owner-key mapping while document exists; no retry-age expiry that can duplicate a committed invoice.

Owner read/document list returns immutable payload, current payment projection, archive/link controls and revisions; public read returns only DATA-04 plus DATA-07 after DATA-08 eligibility. Mutation APIs accept expected control revision and only archive/link booleans. No update/delete-content API is exposed in V1. Version schema and decoder; unknown renderer versions use authenticated server-rendered HTML fallback or a clear update-required recovery, never approximate the document with a different template.

## DATA-06 — Identity, sequence and renderer preservation

One counter per owner/type, incremented transactionally. Unique(owner,type,number); numbers start at 1 and display at least five digits (grow beyond 99999). Different Jobs share the same owner/type sequence; no reset, reuse, configurable starting number, or renumbering on archive/delete. Job edits or changing type in unsaved preview do not allocate numbers. Newly creating an Invoice from a Job with an Estimate allocates an independent Invoice number, not an estimate rewrite.

Preserve every supported renderer version and its styles in the shared renderer package/server deployment. Snapshot schema and render version are immutable. Native/hosted/PDF call that canonical function; use explicit print media rules for paper without an independently implemented PDF layout. Security fixes may update rendering safely; any materially changed customer-visible content requires a new snapshot, not a silent historical edit.

## DATA-07 — Payment projection

On every fresh owner/public read derive paid = source Job's current job_payment_state == paid; otherwise unpaid, including null or unexpected compatibility partial states. No partial-payment UI, amount-paid or actual-payment inference. Apply this projection to all Invoices irrespective of invoice amount; Estimate has none. Badge and Total/Amount Due label use one consistent projection. Old Invoice totals never update to current Job Revenue or current tax. Current copied due dates never advance when a Job is marked paid/unpaid. No persisted per-Invoice paid boolean or ledger is introduced.

## DATA-08 — Ownership, links and privacy

Enable RLS and explicit grants on defaults/documents/counters/control/link tables, with owner-only private reads. Public roles cannot enumerate/read documents through direct tables or predictable ids. Use authenticated owner RPCs; privileged routines need explicit auth.uid/ownership checks, empty search_path, revoked PUBLIC execution, narrow grants and tests. Service-role credentials remain server-only. Public endpoint resolves a >=128-bit cryptographically random base64url token through a hash-indexed lookup. Store only its hash for resolution and an owner-readable protected representation sufficient to reshare the same token; never expose that representation through public payloads or SQL logs.

Every HTML/metadata/image resolution checks enabled control, active source Job and extant owner first. Disable/delete/account deletion returns the same generic unavailable response as unknown tokens; expired estimate content remains viewable because expiration is a copied business date, not token expiry. Archive is not authorization. No sitemaps, internal public listings, analytics script or search discoverability. Use noindex,nofollow, X-Robots-Tag on relevant responses, Referrer-Policy:no-referrer, restrictive CSP, escaped text, no external document resources and no arbitrary navigation in native WebView. Do not robots.txt-block the page and expect noindex to be read.

First-party public HTML and metadata/image responses are private,no-store; no static generation, ISR, cached token API result or signed asset URL bypass. Revision changes invalidate any private internal cached content; eligibility is checked before emitting any bytes. Public image uses a small approved card, not screenshot capture. Neither first-party access logs nor analytics should retain full token URLs or document/customer text; configure path masking/redaction and route exclusions before release. Rate limit public access conservatively without requiring a customer sign-in or blocking legitimate preview crawlers; do not log raw IPs longer than existing infrastructure policy.

## DATA-09 — Migration and restoration

Backfill active Jobs only, within a stable transaction/cutover: capture included existing material sums, initial markup 0, existing Other Costs false, calculate old Revenue minus Materials as Labor. Preserve old Revenue, direct costs, net earnings, timestamps, paid state, zero confirmations and exported history. Null Revenue yields null Labor, not negative materials or zero. Production currently has no negative residual among 23 active Jobs, but re-run production-evidence.md aggregate before cutover. If new active negative cases appear, abort conversion for those records and return to PM with counts; do not silently clamp or approve a new exception policy.

Deleted legacy Jobs/cost fields retain an explicit legacy pricing version and remain untouched by initial backfill. On restoration, keep historical economics and disabled links, set pricing review required. Prefill old Revenue and current included Materials; show nonnegative residual as proposed Labor when possible, otherwise show a blank Labor input with the explanation in UX-03. Owner explicitly confirms valid component pricing; before confirmation all old economic totals remain unchanged and new document creation is blocked. Restored costs capture 0% for legacy existing materials, Other Costs nonbillable. Review may change Revenue only through a deliberate owner save and then clears the review marker.

## DATA-10 — Old-client and multi-path compatibility

Add fields before replacing UI. Preserve old Revenue reads. Version Job-edit payloads; legacy revenueCents mutations express a requested final pretax total and must solve Labor against final included customer charges after that same transaction's cost edits, preserving the requested total. Missing pricing fields must not reset captured markup/overrides/billability. Negative residual from a legacy request must be rejected without partial writes; preserve old record rather than clamp. Review errors use the existing upgrade/error path; old clients cannot issue documents.

All material/Other Cost inserts, changes, soft-deletes, Session deletes/reassignments, Inbox attachment, full Job edit, Live Session edits and direct Job setters must advance appropriate pricing revisions and maintain DATA-03 projection. Preserve current fully-paid-on-Revenue-correction behavior; tax is never written to collected_cents. Race-safe recalculation is server-authoritative; client math is preview only. New explicit no-Revenue confirmation is permitted only if computed Revenue is zero, rather than zeroing recorded charges. Ordinary incompleteness still does not prevent saving a Job.

## DATA-11 — Deletion and export

Job soft deletion atomically disables every link; keep snapshots owner-recoverable, never automatically enable on restoration. Archive has no deletion effect. Account deletion revokes public eligibility before removing auth owner and cascades defaults, documents, controls, token mappings, sequence/idempotency records. No Storage PDF/image artifacts are introduced. Existing account/export cleanup still runs.

Existing Job CSV retains current headers and pretax Revenue, original direct costs, net earnings and current Job payment-status semantics; no silent header rename or tax inclusion. Document/PDF history bulk export is deferred; individual owner PDF remains available. Consent-gated events may capture type, outcome enum, durations and count buckets, never token/link, business/customer content or exact amounts.

## DATA-12 — On-demand PDF and local retention

Only explicit Download PDF invokes device printToFileAsync on canonical snapshot HTML with freshly read payment projection. No generation during create/open/link-share/crawler requests, eager prefetch or server worker. Temporary cache filename Estimate-00001.pdf / Invoice-00001.pdf; regenerate only for a new explicit request, including changed payment projection. File handoff is local via native sharing. Clean temporary artifacts after native sharing returns and best-effort on next launch, within 24 hours; do not delete while destination is accessing the file. Owner-chosen saved/external copies remain outside recall/control. No permanent PDF upload or Storage charges. Hosted page can be printed/saved using browser facilities and shared print CSS; direct browser PDF file download is not promised.

## DATA-13 — Resource envelope

Reuse existing Supabase and commercially eligible website hosting; no new PDF rendering provider. Supabase organization is confirmed Free; measured production DB 77,532,307 bytes. [Free advertised limits](https://supabase.com/pricing): 500 MB database, 1 GB file storage, 5 GB egress plus 5 GB cached egress; this snapshot design adds DB/requests/egress, not permanent file Storage. Planning scenario, not forecast: 100 owners × 10 docs/month × 12 KB average structured snapshot = ~12 MB/month raw payload; 12 months ~144 MB before indexes/row overhead. Five opens + two image fetches per document at 12 KB DB result means ~84 MB/month DB-to-web payload; browser image/HTML bytes add hosting transfer separately. Measure real sizes and overhead; assumptions are not limits or retention caps.

Alert at 70% of included DB/egress/hosting resource, measure monthly growth and public abuse. Do not delete history to remain free, auto-upgrade, or silently stop existing documents. At quota failure fail closed with service-unavailable recovery and retain all state; escalate capacity before forecast reaches 85%. No hard user doc cap is introduced. Device PDF has no provider quota; memory/page stress needs device proof. Metadata images use existing Next ImageResponse on fetch; measure CPU/bytes before launch.

The PM confirms existing Vercel Pro hosting and authorizes reuse. [Current Pro documentation](https://vercel.com/docs/plans/pro-plan) lists $20 monthly credit and base CDN allocation of 1M requests/1 TB transfer; usage beyond included resources may be billed. Actual current usage/allocation remains a release-time read-only check. Do not upgrade, add paid services, or claim this feature has guaranteed zero hosting cost. A credible no-new-service alternative is self-hosting the same Next app on existing infrastructure, trading provider fees for operational work; no newly purchased alternative server is assumed. Framework/shared HTML/standard Postgres limits vendor lock-in; auth/deployment adapters still require maintenance.

## DATA-14 — Verification ownership

Money/default/inclusion rules: TEST-01/02/04. Authoritative source/identity/idempotency: TEST-05/06/07. Payment projection: TEST-08. Renderer/PDF: TEST-09/10. RLS/links/delete/redaction: TEST-13/14/15. Migration/old clients/CSV: TEST-03. Bounds, recovery and resource envelope: TEST-16/17. No migrations, production writes or library installs are performed by this contract.
