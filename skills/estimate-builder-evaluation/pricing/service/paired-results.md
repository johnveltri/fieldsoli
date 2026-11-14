# Same-target comparison

Run `python3 evaluate.py` then `python3 paired.py`. The same 15 rows in `fictional_proxies.csv` serve as targets for both predictions. The historical comparator repeats an original contractor-provided fictional price. It does not simulate a pricing prediction the old skill made. The alternative takes the median of four other providers for that case. Each dishwasher and microwave donor has explicit haul pricing or free haul. The disposal rows omit the provider whose price automatically includes haul. Remaining disposal prices omit a haul charge; flange and incidental parts vary and some cards leave end-of-job disposition unspecified. No geographical adjustments, weights, tuned thresholds, or fitting. This additional comparison was specified after the original holdout results were known; it reuses those cards rather than purporting to be a new prospective test.

| Target, five providers per task | Historical / researched MAE | Historical / researched WAPE | Within ±20%, historical / researched | Closer, historical / researched |
|---|---:|---:|---:|---:|
| Dishwasher installation and haul | $25.41 / $28.57 | 10.74% / 12.08% | 4 / 4 | 2 / 3 |
| Over-range microwave installation and haul | $47.58 / $36.28 | 23.74% / 18.11% | 2 / 4 | 2 / 3 |
| Disposal installation, homeowner keeps old unit | $22.20 / $20.20 | 13.39% / 12.18% | 4 / 4 | 2 / 3 |
| All 15 | $31.73 / $28.35 | 15.79% / 14.11% | 10 / 12 | 6 / 9 |

WAPE is total absolute error divided by total observed dollars. The matched estimate lowered overall MAE by $3.38 but raised dishwasher MAE. It brought Grand, Tucker and Voorhees microwave predictions inside ±20% and moved Carmona’s microwave outside. Both methods missed the Tucker dishwasher and Brown disposal. The largest new error was Carmona’s $259.90 microwave package versus $178.50 predicted ($81.40). There were no ties or abstentions. The itemized CSV includes every target, both predictions, errors, wins, threshold outcomes and donor identities. [Paired predictions](paired.csv)

The local source and accepted-quote exercises are recorded separately in [behavior replay](behavior-replay.md). Looking up the same local retailer is source retrieval, not a held-out prediction.
