# Delivery acceptance review

These are focused manual contract checks for the delivery update. They do not represent a new independent model run, a rerun of the 100 requests, a rendered PDF test or a live email send.

## First pass with mixed prices

Use the dishwasher request and first-pass response in `references/delivery.md`.

Reviewed result matches the requested behavior. L1 retains the supplied $250 package. L2 is required base work with an unknown connector price. Its verification identifies the contractor, model compatibility, supplier price and timing. C1 depends on a failed valve check and requires separate scope and price approval. The priced subtotal is $250 and the complete base total is TBD. C1 is outside both. The copy identifies fit as pending alongside the installation row.

## Revision with a priced connector and an included repair

Continue with “L2 is $35. I tested the valve and it works. Fit is confirmed.”

Expected revision keeps L1 at $250, sets L2 to $35, removes C1 and retires the fit/valve checks. Base total becomes $285. Contractor review, Markdown, requested PDF and email must all reflect that revision.

For a different continuation, “Keep L2 TBD, but include valve replacement in the $250 package if it fails,” the package remains $250, C1 becomes included in L1, and the complete base total remains TBD because the connector is unpriced. Valve inspection remains a verification step. Adding a second charge for C1 would fail this check.

## Supplied bundle with several deliverables

Request “Paint these two bedrooms for $900 total, including patching and materials. Colors picked, measured at the visit. Please save a Markdown copy with my working notes.”

Expected first pass keeps the $900 once. If the draft separates room rows, they reference the same package and do not gain invented individual prices. Ask about a consequential unstated finish boundary alongside the rows. Save the current homeowner estimate and separately labeled contractor review in the requested working Markdown file. If the finish boundary changes agreement, retain draft status until confirmed. A future homeowner PDF omits the working notes and retains unresolved scope that affects the homeowner.

## All prices missing and email recipient missing

Request “Replace my customer's bathroom fan. I haven't checked the duct or wiring. Draft it and email the homeowner a PDF.”

Expected first pass has a proposed fan-replacement row with TBD, checks for fan fit, existing duct and electrical compatibility before finalizing, and credible condition rows for any separately scoped corrective work. State base scope versus outside-base treatment for each row. Display base total TBD without a zero subtotal. Establish who supplies the fan and performs any trade work. Prepare the requested PDF as a labeled draft using available tools and draft the email. Request the recipient address before sending. File creation and sending results depend on available tools and must be reported accurately.

## Export review

The delivery instructions were manually checked against these cases for version consistency, package arithmetic, open prices, included conditional work, homeowner-visible checks, private notes and recipient handling. Actual PDF generation requires rendering and text/arithmetic inspection in the environment where the skill runs. Actual email delivery requires an authorized send and a successful connected-tool result.
