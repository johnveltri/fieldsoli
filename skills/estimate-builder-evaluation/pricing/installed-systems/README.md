# Historical residential air-source heat pump costs in Massachusetts

A prospective-rule, retrospective comparison on real program installations. MassCEC identifies this as its larger residential ASHP program, open November 2014 through March 2019. Its separate whole-home pilot has a different population. We used the residential project's **Total Costs** field in historical dollars, retaining a recorded installation date and a later or same-day rebate payment date. Equipment Costs and Rebate Amount are separate workbook columns. These records establish that the agency recorded a completed, rebate-paid installation. We have no receipts for the amount each homeowner remitted to the contractor. [MassCEC database landing page](https://www.masscec.com/public-records-requests) · [Public workbook](https://files-cdn.masscec.com/uploads/Residential%20ASHP%20Data_For%20Website%20%282%29.xlsx) · [MassCEC program history](https://www.masscec.com/blog/masscec-pilot-showcases-success-whole-home-heat-pumps)

## Who was held out

The public workbook downloaded November 13, 2026 had 20,094 Massachusetts rows with a project-state value. We excluded 3,082 for date validity, 29 for an unusable cost or outdoor-unit count, four for missing site information, 23 duplicate site/date/input/cost records and 64 conflicting same-site/date records. That left 16,892. The chronological split fell on September 26, 2018. We dropped 1,356 older installations without a recorded rebate payment before that date, then removed 41 later rows with a matching training site. Abbreviations and spelling differences can cause the same address to appear distinct. Individual people and addresses stay out of outputs.

- **Training** included 12,156 projects installed January 21, 2015 through September 20, 2018. Median reported total was $8,261.78.
- **Holdout** included 3,339 projects installed September 26, 2018 through March 20, 2019. Median reported total was $9,539.01. Rebate payments were recorded through November 20, 2019.

## Predictions on later completed installations

Predictions were the earlier statewide median, earlier median for 1/2/3+ outdoor units, or earlier median for the combination of outdoor and indoor head counts. A group needed 20 training records. The third model used an indoor/outdoor group for 688 of 3,339 holdouts, falling back to the outdoor grouping for 2,651. All models used identical projects and unadjusted dollars. [Frozen protocol](protocol.md)

| Holdout metric | Flat median | Outdoor count | Outdoor + indoor when available |
|---|---:|---:|---:|
| Mean absolute error | $5,148.00 | $4,806.98 | $4,413.37 |
| Median absolute error | $3,661.78 | $3,165.00 | $2,838.75 |
| Bias, prediction minus reported cost | −$2,721.80 | −$2,776.53 | −$2,484.55 |
| Predicted within 25% of reported total | 28.48% | 27.70% | 35.58% |
| Covered by training 10th–90th percentile band | 76.01% | 76.28% | 76.55% |
| Mean width of that band | $12,897.86 | $11,721.08 | $10,679.56 |

The two-count model reduced MAE by $734.63, or 14.3%, versus flat. Outdoor count alone reduced overall MAE but slightly reduced the share within 25%. For the 2,525 single-outdoor-unit holdouts the outdoor-only estimate missed by $4,449 on average versus $4,374 flat. The biggest group improvements came from multi-outdoor-unit installations. Most estimates from the best rule were still more than 25% away from the recorded total.

| Outdoor units | Holdout n | Earlier median | Later median | Flat / two-count MAE |
|---|---:|---:|---:|---:|
| 1 | 2,525 | $7,060 | $8,172 | $4,374 / $4,091 |
| 2 | 671 | $11,630 | $14,200 | $7,366 / $5,369 |
| 3 or more | 143 | $12,400 | $13,995 | $8,409 / $5,629 |

The data support asking about equipment count and indoor distribution when scoping an ASHP installation. Other cost differences remain unresolved, including system design, scope elsewhere in the building, local provider and date. These historical totals should not be copied into a current estimate, used to price repairs or treated as a measure of HVAC installer skill.

## Replay

Download the workbook from MassCEC. From this folder run `python3 evaluate.py /path/to/workbook.xlsx`. Python's standard library is sufficient. The script pins the original workbook's SHA-256 fingerprint and emits only aggregates. [Evaluation script](evaluate.py) · [Complete results](results.json)
