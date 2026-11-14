# First-pass line items across 100 requests

Every request in the final reviewed set produced customer-visible items on the first turn. Ninety-nine replies used a table. The contractor who requested structured output received an items array. The active-leak reply gave immediate safety guidance first and offered a TBD assessment only after the leak was controlled.

| Run | Requests | What the review found |
|---|---:|---|
| Starting version, commit 5655338 | 100 | 98 replies contained amount-bearing line items. The bid review showed an edit comparison and the emergency reply gave safety guidance alone. Across the suite, 25 replies warranted a scope or breakdown revision, including the bid review. The safety-only reply was counted separately. |
| First revision | 100 | All 100 produced line items. A second review flagged 13 with problems inside the rows, including optional work counted in the base, overlapping charges and independent items sharing a price. |
| Final targeted replay | 13 | Replayed each flagged request from its original text using the final instructions. The other 87 final records are their full second-run replies. |

The final targeted replay separated finish paint from patching, refrigerator door removal from the carry, matching cabinet fronts from end panels, and individual water, sewer and electrical upgrades from the garage conversion. The outside outlet and shower leak cases put the possible repair after diagnosis and outside its subtotal. All 13 targeted replies supplied the corrected rows.

The contractor’s follow-up answers from the original suite were withheld. That matters for the $200 hood and $300 screen door, where the owner gave a budget. Their estimate amounts remained TBD. The existing $280 wall-repair and $400 backsplash bids kept their amounts. The proposed paint and hauling options received separate TBD rows.

The updated skill asks whether the owner could approve one item and decline another, whether a different trade would price it, and whether the same work is already counted. For example, a washer relocation can require separate water, drain and electrical work. An accessible appliance hookup has a different scope from installing those services. For proposed work that depends on diagnosis, the customer can approve the diagnostic service and decide on the repair after seeing the finding and price.

[100-row scorecard](scorecard.csv) · [Final requests and full answers](final.jsonl) · [Original first replies](initial.jsonl) · [Full second run](second-run.jsonl) · [Test protocol](protocol.md)

These were agent-generated replays in batches using the skill and its references. Agents received the original customer wording and could reuse formatting across a batch. Reviewers examined the content of the rows against the request, including where an option or finding could change the amount. The structured checks verify case identity, visible amount fields, quoted prices and budget handling. Run `python3 verify.py` from this directory to repeat those checks. This exercise measures first-response behavior across these prompts. It does not measure local price accuracy or variability across separate live ChatGPT sessions.
