# Portable estimate record

Keep the job title, promised result, readiness and contractor review at job level. Record one item per meaningful decision. On a structured-output request use a customer object with items and a separate contractor_review object with changes, assumptions and open items. Never include internal questions in the homeowner copy.

| Item field | Meaning |
|---|---|
| type | included, condition, owner_action, boundary or open_question |
| description | Observable deliverable, decision or limit in the contractor's words |
| quantity, unit, quantity_status | Use null when unknown. Preserve ranges, approximate, measured or contractor-confirmed status and original wording. |
| responsibility | Person doing, buying, checking or deciding. Unknown stays null. |
| trigger | Observable discovery for a condition, otherwise null |
| pricing | status (unpriced, supplied_fixed, supplied_unit_rate, supplied_allowance, researched_planning_range, historical_comparison or included_in_bundle), supplied wording, coverage and base treatment. Keep each supplied figure once at its correct coverage. |
| approval_step | For extras, when and how the homeowner sees the price or measured extent and authorizes proceeding. Preserve a specified method. |
| timing | When an owner action, check or visit is due, if established |

If one fixed figure covers several lines, record it once at job or group level and reference that group on the lines. Keep any quoted unit rate separate from the base. A rate can be known while its extension is unknown.

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
