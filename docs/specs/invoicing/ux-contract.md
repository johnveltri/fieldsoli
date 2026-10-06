# Invoicing — UX Contract

Primary user: solo residential handyman in interrupted mobile field work. Preserve the existing Job capture rhythm. Native controls surround one customer-document renderer; the hosted document never exposes editor/share-management controls.

## UX-01 — Business settings

Profile gains two rows: “Business info” and “Estimate & Invoice Settings,” opening full-screen forms using existing overlay/header/keyboard primitives. Business info fields: “Business name,” “Address,” “Phone,” “Email,” “Website,” “License # (optional). Display names from DATA-01; no automatic personal-name substitution. All can be saved blank; document creation separately validates names.

Settings: “Default material markup,” percentage input (initial 0), helper “Applies to new materials added.” “Tax rate” (initial 0), “Apply tax to,” independent options “Labor & Services,” “Materials,” “Billable Other Costs,” and “All.” All checks all categories; deselecting one clears All's selected state; All unticks all when all were selected. Indeterminate/accessibility state describes a subset. At 0% the rate visibly communicates no tax; keep selection stable. “Payment terms”: “Due upon receipt,” “Net 7,” “Net 15,” “Net 30.” “Estimate expiration”: “Off,” “7 days,” “14 days,” “30 days.” Defaults and validation follow DATA-01, not new UX arithmetic.

Loading shows form skeleton and disables Save until loaded. Missing settings opens defaults; read failure shows “Could not load settings.” / “Retry” without overwriting stored values. Footer “Save”; busy “Saving…”; failure “Could not save settings. Try again.” Preserve input. Dirty Back offers “Discard changes?” with “Keep editing” / “Discard”; successful save returns to Profile. Offline: “Connect to save changes.” Local drafts are not queued for background saving.

## UX-02 — Job pricing inputs

Replace the editable Revenue field wherever present with “Labor & Services.” Existing Revenue remains a derived metric in summaries/lists/earnings. Display material internal cost, customer price, and optional percentage override in the existing material edit flow; adding markup must not force quantity/unit breakdown for total-only materials. Override label “Markup”; helper “Customer price includes markup.” Reset action “Reset to original markup” uses DATA-02 captured value. Empty Labor is unknown, not $0. Existing zero/no-Revenue confirmation remains conditional on DATA-10's computed-total rule.

Other Cost edit adds one checkbox “Invoice customer” and helper “Adds this cost to the customer’s estimate or invoice.” No tax checkbox or markup input. Internal cost amount/category are unchanged. Keep billability reachable without a new accounting screen. Derived Revenue, Net earnings and Net/hour visibly update with client preview, then reconcile to authoritative server totals on save. Save failure retains inputs and never falsely announces updated pricing. Do not expose internal economics in the document preview.

## UX-03 — Restored legacy pricing review

Initial migration adds no normal active-Job dialog. Restored legacy Jobs show “Review pricing” in Job Edit and a document-creation blocker. Show “Previous Revenue,” “Materials,” and the proposed Labor & Services. If Materials exceed old Revenue, do not prefill negative Labor into an ordinary input: show “Materials exceed the previous Revenue. Enter Labor & Services to confirm the new pricing.” Keep old economic totals visible until explicit review save. Primary “Confirm pricing”; failure “Could not save pricing. Try again.” Ordinary restoration/Job use is available; only new documents need confirmed pricing. Historical owner snapshots remain viewable. Review never changes customer-facing history.

## UX-04 — Unsaved preview and content

Add a Send/Share FAB to the full-screen Job detail surface, accessibility label “Share job document.” Do not replace the work/payment primary action. From Job View, FAB opens unsaved preview; from Job Edit save through the existing Done flow before opening it, never publish uncommitted edits. Generate new in Docs uses the same entry.

Full-screen native preview has native Back/header and a lightweight Estimate / Invoice selector outside the document at the top, only in unsaved mode. Default Estimate for Not Started/In Progress/On Hold/Cancelled; Invoice for Completed or its Paid display state. Selector does not modify Job work/payment status.

Document header: type, “Estimate #00001” / “Invoice #00001,” business identity, customer contact/address block. Unsaved number placeholder “Number assigned on creation.” Summary shows short description as title and long description as plain multiline body. Content hierarchy: Labor & Services, Materials, named category other charges under DATA-04, Subtotal, Tax, final total. Estimate labels: “Estimate date,” optional “Valid until,” “Total.” Invoice labels: “Invoice date,” “Due date,” optional payment-terms text, “Paid” / “Unpaid”; final “Total” if paid or “Amount Due” if unpaid. Tax $0 remains a visible row. No hourly pricing, Notes, attachments/photos, cost totals or markup disclosure. Optional empty contact/license fields disappear cleanly.

Unsaved primary “Create & Share Estimate” / “Create & Share Invoice”; busy “Creating…”. Loading document uses an accessible loading indicator and reserved space. Creation gaps show “Complete these details before sharing:” followed by the precise fields from DATA-04 and “Edit details” linking to Profile or Job Edit; keep a read-only incomplete preview available with blanks outside any saved snapshot. Do not run the work-completion wizard. Typing is not required on the preview itself.

## UX-05 — Saved preview and recovery

Saved preview has no type selector and uses “Share Estimate” / “Share Invoice.” Native header identifies number; copied content remains read-only. Returning to the app refreshes live payment projection before sharing/PDF. A stale creation error says “This Job changed. Review the updated preview before sharing.” Refresh preview and require a new explicit Create & Share tap; never silently send unseen new prices. Timeout says “Could not confirm creation. Try again.” Retry retains the creation request key. Definite failure says “Could not create this document. Try again.” No partial document/number is presented.

Empty Docs: “No documents yet.” and Generate new. Saved document read failure: “Could not load this document.” / “Retry.” Offline cached owner preview shows outside the document “Offline — payment status may be out of date.” Disable fresh-read-dependent actions with “Connect to share or create a PDF.” Do not present cached status as freshly verified. Back after successful create returns to Job; the saved document remains even if sharing was cancelled. Owner access remains possible when public link is disabled/archived.

## UX-06 — Docs management

Job View section title “Docs”; rows show type, number and snapshot date, newest first, deterministic id tiebreaker. Archived rows are omitted. Tapping any row enters Job Edit and scrolls/focuses its Docs section; do not automatically open Preview. Job Edit lists all saved docs, marking archived rows “Archived.” Each document has read-only “Type,” “Number,” “Date,” a “Preview” row action, “Archived” checkbox and “Shared link enabled” checkbox. Include “Generate new” at end, opening unsaved preview after saving outstanding Job edits through the existing Done mechanism.

Toggles save their controls immediately and independently of the Job draft, with inline progress and disabled repeated taps. On failure restore authoritative value and show “Could not update document settings. Try again.” A conflict refetches and says “Document settings changed. Try again.” Disabling does not delete/archive; archive does not disable. Helper below link control: “Anyone with an enabled link can view this document.” A disabled document also shows “Shared link disabled.” Deleted Job restoration keeps this checkbox unchecked until explicit user action.

## UX-07 — Share sheet and app destinations

Custom sheet title “Share Estimate” / “Share Invoice,” showing its number. Horizontal shortcuts in specified order: “Messages,” “WhatsApp,” “Gmail,” “More.” Vertical rows: “Copy link,” “Open in browser,” “Download PDF.” More opens native link sharing; link text is “Estimate #00001 from {business name}\n{url}” or Invoice equivalent. Messages/WhatsApp prefill usable phone, Gmail usable email from the saved document's customer snapshot copied from the Job; reshares must not silently use a newly assigned customer's current Job contacts. If missing/invalid, do not force contact edits or fabricate a recipient—let a supported composer choose. Gmail subject “Estimate #00001 from {business name}”; body is the same link text.

User reviews and sends in destination app; FieldSoli never sends automatically or labels a document Sent/Delivered based on handoff. Query availability using narrowly configured platform schemes/packages. If unavailable or composer fails: “{app} is unavailable. Use More to share this link.” with “More” and “Cancel”; do not silently open a different app under a Gmail label. A destination that can share content but cannot prefill recipients hands off without recipient and reports no delivery guarantee. Device proof is required for each adapter; unverified private schemes are not assumed reliable.

Copy success “Link copied.” Browser failure “Could not open this link. Try again.” Share cancellation returns to saved preview with no error. Link-dependent rows are disabled if shared link is off, with “Enable the shared link in Docs to share a link.” Keep Download PDF usable for an owner after a fresh read; selecting Share must never re-enable automatically. Sheet swipe/back restores preview focus; no touch-through to Job controls.

## UX-08 — Explicit PDF

Only Download PDF begins “Creating PDF…”; show progress, coalesce repeat taps, allow Back to return while safely discarding unused local result. Generate from the saved document and refreshed status, never live unsaved Job data. Success opens native file sharing where the user chooses Save/Print/app. Filename follows DATA-12. Do not claim Download PDF automatically saves to Downloads or Files.

Failure “Could not create the PDF. Try again.” Retry reuses document identity and never creates another snapshot. Missing native sharing support shows “PDF sharing is unavailable on this device.” Do not upload a PDF or add a paid fallback. Native handoff cancellation returns to preview without an error. Printed/previously exported files keep their captured Paid/Unpaid status; subsequent exports reflect a fresh current status. Public browser users can use browser Print/Save as PDF; no automatic PDF fetch or new hosted PDF download service.

## UX-09 — Hosted document and metadata

Enabled /share/{token} loads the same document renderer without app UI/editor controls, a mobile fluid layout and bounded desktop page. Server-render HTML and metadata for preview crawlers. No login required. Never load tracking scripts or fetch external resources from within document content. Unknown/disabled/deleted link shows “This document is unavailable.” Do not expose existence, customer/owner, archive state or previous metadata. Service outage uses “This document is temporarily unavailable. Please try again.” and Retry; it must not look like a valid empty or Paid invoice.

Rich-preview title “Estimate from {business name}” / “Invoice from {business name}”; card contains business name, document type/number, short description and immutable total. Display fieldsoli.com as site name. Do not put long description, customer name/contacts/address, token, or dynamic Paid status in the card. Graceful wrapping/ellipsis for card text only; full document content is never silently truncated. Link previews may be cached by destination services after disabling; no recall promise.

## UX-10 — Layout, interaction and accessibility

Black text on white document, restrained borders/spacing, readable typography and semantic headings/tables; no future brand-color assumption. At matched mobile viewport the native WebView document and browser use the same HTML/CSS. Screen is fluid from 320 CSS px; desktop cap 816 CSS px including comfortable padding. Print uses US Letter default, 0.5-inch margins and compatible A4 scaling; table labels/values align and totals remain readable. Break long descriptions/rows over pages intentionally, repeat relevant headers and avoid orphaning totals where feasible. Print suppresses native/browser controls. Identical rendering means common content/design; page pagination and browser/system glyph rasterization can differ.

Text remains selectable/zoomable, not a screenshot; no user-scalable=no. Web semantic reading order business/document identity → customer → summary → charges → totals/status. Native focus stays in one document accessibility tree; wrappers must not duplicate it. Use screen-reader labels for selector/checkbox states, loading/success announcements, 44pt iOS/48dp Android touch targets, AA contrast, system text scaling for chrome, portrait/landscape/tablet safe areas. Currency/date columns must wrap without hiding values. Honor reduced motion; transitions improve continuity, not delay sharing. Keyboard-aware settings/material sheets keep Save visible and errors near the field; OS Back/gesture behavior follows established overlay conventions.

## UX-11 — Component and platform selection

Reuse ProfileRowsCard, OverlaySlideHost, existing material/cost and keyboard-aware sheet/header primitives for app chrome after checking focus, safe areas and accessibility quality. Native share/print handles destination/file operations. react-native-webview hosts canonical HTML rather than duplicating it with native rows. Custom work is limited to the pure HTML/CSS template, Docs rows and the lightweight destination sheet; no new third-party invoice editor or PDF rendering SDK. Compare device/browser outcomes in TEST-09/10; existing components alone do not satisfy the quality gate. Exact dependency choices and limits are in technical-evidence.md.

## UX-12 — Analytics and evidence

Use existing consent gates. Observe creation success/failure/duration, destination handoff enum, PDF success/failure/duration and control changes with bounded metadata only. Never log exact amounts, customer/business names, description, token, link URL, email/phone or renderer payload. Do not add public-page view tracking or infer payment/delivery from link openings. Diagnostic errors use safe enums rather than raw provider payloads. Test surface-state loading/empty/ready/busy/error/offline/cancellation conditions under TEST-16 and all exact critical copy under source-mapped tests; manual evidence covers platform accessibility, print and real app adapters.
