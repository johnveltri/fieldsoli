# Portable estimate record

Keep the job title, promised result, readiness and contractor review at job level. Record one item per meaningful decision. On a structured-output request use a customer object with items and a separate contractor_review object with changes, assumptions and open items. Never include internal questions in the homeowner copy.

| Item field | Meaning |
|---|---|
| type | included, condition, option, alternative, owner_action, boundary or open_question |
| description | Observable deliverable, decision or limit in the contractor's words |
| quantity, unit, quantity_status | Use null when unknown. Preserve ranges, approximate, measured or contractor-confirmed status and original wording. |
| responsibility | Person doing, buying, checking or deciding. Unknown stays null. |
| trigger | Observable discovery for a condition, otherwise null |
| pricing | status (unpriced, supplied_fixed, supplied_unit_rate, supplied_allowance, researched_planning_range, historical_comparison or included_in_bundle), supplied wording, coverage and base treatment. Keep each supplied figure once at its correct coverage. |
| approval_step | For extras, when and how the homeowner sees the price or measured extent and authorizes proceeding. Preserve a specified method. |
| timing | When an owner action, check or visit is due, if established |
| id | Stable row identifier across revisions and requested exports, such as L1, C1 or O1 |
| verification | For each TBD, the specific check, measurement, selection or quote, who resolves it, when, and the scope or price decision it settles. Unknown responsibility is explicitly pending. |
| total_treatment | Base scope with price pending, included in a named package, outside base requiring approval, optional outside base, or coverage pending and excluded from priced subtotal. Distinguish scope inclusion from a priced amount. |

Keep proposed options and replacement alternatives outside the base. Attach the price and approval to the individual option or condition; in structured output render an unpriced amount as TBD or use a null amount with an explicit TBD display label.

If one fixed figure covers several lines, record it once at job or group level and reference that group on the lines. Keep any quoted unit rate separate from the base. A rate can be known while its extension is unknown.

Examples of decisions that need separate amounts:

- Put matching finish paint outside a patch or smoothing base until selected. In a reface or kitchen rebuild, give cabinet fronts, fabricated tops, backsplash and optional end-panel work their own coverage. For landscaping, an owner can choose edging separately from weeding.
- Count the same access operation once. If door removal for delivery is a conditional row, the carry row covers the clear-route move. A torn interlock in adjoining siding has a different remedy from repairing backing or the weather layer.
- A new appliance circuit and mounting reinforcement need different providers or work. In a multi-appliance job, identify the affected appliance and the specific service, such as a dryer exhaust change or new washer valves. Split new water, sewer and electrical service for a detached building.
- A specialist can assess material without being hired to remediate it. Keep the assessment and any later treatment separate. When inspection could find functioning equipment or an already-repaired leak, put outlet replacement or active-source repair in a conditional row after the diagnostic base.

For researched pricing record evidence URL or quote ID, source and check dates, geography, currency, unit, inclusions, lower/upper values when supported and confidence limitations. Keep historical comparisons outside the base and identify the contractor’s explicit adoption when converting a planning figure to a quoted price.

Example condition in a structured customer record:

```json
{
  "type": "condition",
  "description": "Replace additional damaged casing within the agreed trim repair area.",
  "quantity": null,
  "unit": "linear foot",
  "quantity_status": "unknown until removal",
  "responsibility": "contractor",
  "trigger": "Removing the first board exposes soft wood in the adjoining casing.",
  "pricing": {"status": "supplied_unit_rate", "wording": "$18 per linear foot", "coverage": "additional casing only", "base_treatment": "outside base"},
  "approval_step": "Show the exposed wood, measure the additional length with the homeowner, and get approval for the extended price before cutting.",
  "timing": "after removal"
}
```

The rate belongs only to this example. Use prices from the current contractor's input.
