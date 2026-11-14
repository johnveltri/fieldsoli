# Residential remodel price evidence

Two historical holdouts test different predictions. The first tests aggregate cost benchmarks for specific project specifications and regions. The second tests owner-reported costs on individual jobs grouped only by room and who performed the work. The old skill preserved supplied prices and abstained on both numeric predictions. Its pricing coverage was zero, so it has no numeric error score.

## Publisher benchmark holdout

The [protocol](protocol.md) froze both methods and all 20 targets before regional target pages were opened. Give both methods the same 2025 national job cost for the exact prototype/tier. The baseline ends there. The second method applies its 2024 region-to-national cost ratio. Fit inputs were the national tables and the prior-year regional tables. The targets were the subsequent regional tables. These are complementary table entries from a shared publisher model rather than 20 independent actual contracts. Minor kitchen retains cabinetry boxes; use the [project definition](https://www.jlconline.com/cost-vs-value/minor-kitchen-remodel-midrange/) to distinguish that scope from a major replacement. [Remodeling 2025 Cost vs. Value Report](https://www.costvsvalue.com/) · [2025 methodology, published September 18, 2025](https://www.jlconline.com/cost-vs-value/2025/methodology/)

| Method | Mean absolute % error | Median absolute % error | Mean absolute dollar error | Worst absolute % error | Within 10% |
|---|---:|---:|---:|---:|---:|
| US job cost for the same project and tier | 2.64% | 2.23% | $1,966 | 5.38% | 20/20 |
| Same cost × prior regional ratio | 1.41% | 1.18% | $1,130 | 3.40% | 20/20 |

The ratio improved 15 of 20 comparisons. Worst regional miss was a 3.40% underprediction for a Mountain minor kitchen, where the national-only value missed by 0.11%. Mountain major midrange kitchen, South Atlantic minor kitchen, New England major midrange kitchen and East North Central major midrange kitchen also became less accurate. Every signed percentage error is in [errors.csv](errors.csv). Same-year national aggregates contain some target markets. This tests regional refinement with a contemporaneous national anchor, not prediction of a future national price. The geographic improvement was not tested for another publisher, another period, or nonstandard scopes.

To reproduce, obtain the public publisher HTML pages for 2024 and 2025, national and regions new-england, mountain, south-atlantic and east-north-central. The URLs use https://www.jlconline.com/cost-vs-value/YEAR/ for national, and append REGION/ for each region. Save as jlc-remodel-YEAR-national.html or jlc-remodel-YEAR-REGION.html in a local folder. The archived skill contains no publisher cost table. [Publisher reuse guidelines](https://www.jlconline.com/cost-vs-value/2025/re-use-and-licensing-guidelines/)

```sh
python3 evaluate.py /path/to/local/pages --errors /tmp/remodel-errors.csv
```

## Household project holdout

The [2023 Census/HUD AHS national public use file v1.1](https://www.census.gov/programs-surveys/ahs/data/2023.html) identifies remodeling types 12 (bath) and 13 (kitchen), DIY status 1 (yes) and 2 (no), reported expenditure, and anonymous household ID. Jobs counted here have positive dollars and valid DIY status. The household ID hash assigns every project at an address to the same split. All 3,048 training projects were separate from the 668 households reporting the 790 test projects. This is an unweighted prediction exercise on the survey records; it does not estimate national population percentiles using AHS survey weights. Survey responses may be edited or imputed. No square footage, finish tier or labor-only split was imputed.

| Method | Dollar MAE | Median absolute % error | Within 25% | Empirical 10th–90th interval coverage |
|---|---:|---:|---:|---:|
| Pooled median across kitchen, bath and DIY status | $10,999 | 72.4% | 13.0% | 81.0% |
| Median by kitchen/bath and DIY status | $10,261 | 64.7% | 21.6% | 80.0% |

Even the improved point missed the 25% threshold on 78.4% of individual projects. The wider historical bands are useful context when scope is vague. They do not protect a fixed bid. National point and interval scores for this test do not validate the separate 2025 Houzz major-remodel figures or any local labor-only pricing. Use actual scope, current selections and local unit costs to narrow a job.

```sh
curl -fLsS 'https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20National%20PUF%20v1.1%20CSV.zip' -o /tmp/ahs-2023.zip
python3 households.py /tmp/ahs-2023.zip
```

Expected archive SHA-256: 720aaa18198f23f1d25b19630ba97105394f653f32acf6e3f907235bd2d73ac0. Both scripts use the Python standard library. Inputs verified November 2026.
