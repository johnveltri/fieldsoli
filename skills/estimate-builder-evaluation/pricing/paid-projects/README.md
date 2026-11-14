# Historical completed residential work

The 2023 Census/HUD American Housing Survey records what homeowners said their projects cost and whether the household did most of the work. This evaluation excludes DIY and incomplete work, negative/missing costs, residual project categories and allocated key project fields. The source files are [national relational CSV v1.1 and value labels](https://www2.census.gov/programs-surveys/ahs/2023/). See the [frozen rules](protocol.md) and [definitions and questionnaires](https://www.census.gov/programs-surveys/ahs/data/2023.html). The project dollar amount is the homeowner's reported expenditure and can include purchases by multiple parties. No invoice, dimensions, material tier or original contractor quote is supplied by the survey.

The deterministic household split gave 17,050 training records and 4,490 eligible held-out jobs. The minimum training count was reached for 4,482, covering 31 job types. Four fire-damage jobs and four kitchen addition/conversion jobs had insufficient training peers. Retain those abstentions when reporting coverage (99.8%). There are 159 supported project/geography rows, including national rows. This is a reproducible unweighted predictive test on sampled jobs rather than a survey-weighted population estimate or a time-forward forecast.

| Point prediction | MAE | Median absolute error | Mean signed error (predicted − reported) | Within 25% | Share in training p10–p90 band |
|---|---:|---:|---:|---:|---:|
| Pooled training median | $6,847.11 | $3,200 | −$4,215.67 | 13.36% | 81.50% |
| Project type only | $5,893.33 | $2,300 | −$3,166.41 | 20.75% | 80.79% |
| Project type plus supported division | $5,853.04 | $2,400 | −$2,996.83 | 21.62% | 79.74% |

Project type accounts for most of the improvement. Adding region improved mean error by $40.29 and **worsened median absolute error by $100** compared with type alone. Across 31 types the regional model beat the pooled predictor at MAE for 28; errors rose for exterior stairs/chimney/other, driveways/walkways, and doors/windows. Categories combine different-sized jobs, and very large jobs in a right-skewed distribution contribute to negative bias. The historical spread can be large. No evidence here supports a general city, experience or finish surcharge.

[Individual blinded-split comparisons](holdout.csv) · [Results by project](by-project.csv) · [Training bands](historical-project-bands.csv) · [Summary metrics](metrics.json)

To reproduce with standard Python 3, download the two ZIPs and run:

    python3 evaluate.py '/path/to/AHS 2023 National PUF v1.1 CSV.zip' '/path/to/AHS 2023 Value Labels Package.zip' /tmp/ahs-replay

Input SHA-256: national CSV ZIP 720aaa18198f23f1d25b19630ba97105394f653f32acf6e3f907235bd2d73ac0; labels ZIP 03e0d170728d81ccd12c942985b6c809fbeae123096f2bbe23ab6d7f33ab217d. Keep all projects from a household on the same side of the split. Packaged runtime bands use only the training side. Holdout costs are for auditing and must not be looked up when predicting.
