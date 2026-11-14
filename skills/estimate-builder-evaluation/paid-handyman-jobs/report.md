# Blind estimates versus actual household payments

The first revision helped on two of 12 fresh jobs. Median absolute percentage error fell from **36.6% to 31.9%**, but only **2/12** estimates landed within 20% of payment under either version. The other ten point estimates did not move. A historic chimney job accounted for most of the dollar error; it remains in the score. On seven more projects explicitly involving handymen, the final revision did **not** improve any point estimate; only **2/7** were within 20%. Across the three rounds there are **31 distinct jobs and 105 reconciled paid components** in 24 named cities or service areas, plus one state-only record. These are nominal job-year USD, not current quotes.

## Results by test round

| Round | Average absolute error, old → new | Median absolute % error | Within 20% | Actual inside range | Mean range width | Mean signed error¹ |
|---|---:|---:|---:|---:|---:|---:|
| Development: used to choose revisions (12) | $392.17 → $340.58 | 17.3% → 17.3% | 7 → 8 | 12 → 11 | $2,116.67 → $2,104.17 | -$7.17 → -$19.75 |
| Fresh test: first revision, unseen payments (12) | $1,863.41 → $1,852.91 | 36.6% → 31.9% | 2 → 2 | 10 → 10 | $4,360.08 → $4,360.08 | $913.52 → $924.02 |
| Additional handyman cases: final follow-up, unseen payments (7) | $1,168.81 → $1,168.81 | 23.3% → 23.3% | 2 → 2 | 6 → 6 | $4,237.86 → $4,237.86 | $992.05 → $992.05 |

¹ Forecast minus payment; positive means the forecast was high. Range coverage is an observed count, not a confidence level. Development results are in-sample. Compare the two points on the same job, not the raw development error against the raw fresh-set error.

## What changed and what still missed

- **Downers Grove, IL:** Original $3,250 → revised $2,900; owner paid $1,800 for seven rooms and the return to paint baseboards. The revised estimate removed an unsupported priority/repair allowance. The owner negotiated down the original requested bill: a price concession is real, but it is not a transferable production rate.
- **Lexington, KY:** $4,050 → $4,230; $5,200 paid. The original equipment estimate was only $150 low, whereas removal and installation were $800 estimated vs $1,800 paid. The revised skill checks a complete specialist installation price and how a wholesale equipment deal affects cost recovery. The new figure is still $970 low.
- **Maryland urgent spring repair:** $535 → $500 against $950 paid. The local installed menu check made this estimate worse; it did not establish the actual dealer’s price or spring grade.
- **Sugar Land, TX:** A mixed handyman visit was $425 under both methods vs $290 paid. Flashing was $245 vs $240; moving the high spots of soil was $180 vs $50. The final follow-up asks for soil volume, carry distance and availability of onsite disposal before budgeting a second substantial block of labor.
- **Houston and Cypress, TX:** The two model-specific HVAC checks improved the points: $605 → $721 vs $936 paid, and $365 → $375 vs $485. Current menus were treated as imperfect evidence for a 2022 price. The forecasts still ran low.
- **Spokane, WA:** Both methods put chimney/fireplace restoration at $20,519 vs $4,383.27 paid. The exterior line alone was $13,500 vs $2,219.73. Scope text named a refractory coating but supplied no treated length or repointing area. The final skill requests measured coverage and a specialist quote before offering a job total. Neither historical score was changed.
- **Katy, TX:** Door overhaul $1,213 vs $2,491.40 paid. The lifetime spring pair was $520 estimated vs $1,189.70 paid. The final skill keeps the dealer-specific warranty package pending when only ordinary spring prices are supported. In Spokane it also asks for measured surfaces and returns before totaling a full room skim or historic exterior.

**Ordinary handyman versus specialist:** In the first fresh set, T01 explicitly hired a handyman; its error was $135 (46.6%) in both runs. The other eleven hired trades, remodelers or retailers. Their MAE was $2,020.54 → $2,009.08 (approximately, from rounded means). Among the 11 fresh cases other than the chimney job, MAE was $565.93 → $554.47. That sensitivity does not replace the full result.

**Seven additional jobs explicitly involving handymen.** On these fresh jobs, the original and final planning methods scored 7 and 7 complete job totals, respectively. All seven points stayed unchanged. These are conditional planning scenarios, not accepted quotes. Another estimator independently following the original guide declined to issue all seven complete prices without better inputs and priced only one of 23 component lines. That difference in willingness to estimate is a limitation of this instruction-based skill. See [its unedited coverage decisions](independent-quote-readiness-extra.jsonl).

## Development: used to choose revisions

| Case | Market, year | Scope and source | Original | Revised | Paid | Revised minus paid |
|---|---|---|---:|---:|---:|---:|---:|
| D01 | Durham, NC, 2017 | [Crawl-space pump and basin](https://home.costhelper.com/sump-pump.html) | $430 | $430 | $450 | -$20 |
| D02 | Lexington, KY, 2020 | [Matched heat-pump changeout](https://home.costhelper.com/heat-pump.html) | $4,050 | $4,230 | $5,200 | -$970 |
| D03 | San Jose, CA, 2017 | [Toilet, install and haul-away](https://home.costhelper.com/replace-toilet.html) | $605 | $605 | $475 | $130 |
| D04 | Roswell, GA, 2016 | [Four replacement locks](https://home.costhelper.com/door-lock.html) | $310 | $399 | $535 | -$136 |
| D05 | San Jose, CA, 2013 | [Garage door, windows and opener](https://home.costhelper.com/garage-door.html) | $1,655 | $1,655 | $1,400 | $255 |
| D06 | Stanton, CA, 2011 | [50-gallon water heater and permit](https://home.costhelper.com/water-heater-comments-5.html) | $1,237 | $1,202 | $1,180 | $22 |
| D07 | Maryland (city unreported), 2025 | [Urgent spring pair](https://www.reddit.com/r/GarageDoorService/comments/1od7s0g/i_am_in_md_just_paid_950_to_get_a_broken_spring/) | $535 | $500 | $950 | -$450 |
| D08 | Spring Valley, WI, 2009 | [Interior walls and sprayed ceilings](https://home.costhelper.com/painting-interior-comments-1.html) | $2,140 | $2,140 | $2,286 | -$146 |
| D09 | Austin, TX, 2020 | [Trim and finish PAX closet](https://awwsam.com/2020/01/how-we-ikea-hacked-our-closet.html) | $2,890 | $2,890 | $2,482 | $408 |
| D10 | Fairfield, CT, 2020 | [Install stair runner, resize hall runner](https://www.myseasonedhome.com/new-blog/stair-runner-and-painted-stairs) | $510 | $510 | $500 | $10 |
| D11 | Loganville, GA, 2015 | [Interior painting and deck](https://www.bowerpowerblog.com/my-best-friend-carlos/) | $2,760 | $2,760 | $3,200 | -$440 |
| D12 | Downers Grove, IL, 2009 | [Patch seven rooms, return for baseboards](https://home.costhelper.com/painting-interior-comments-1.html) | $3,250 | $2,900 | $1,800 | $1,100 |

## Fresh test: first revision, unseen payments

| Case | Market, year | Scope and source | Original | Revised | Paid | Revised minus paid |
|---|---|---|---:|---:|---:|---:|---:|
| T01 | Sugar Land, TX, 2024 | [Flashing repair and soil removal](https://photos.harstatic.com/364660226/supplement/pdf-4.pdf?ts=2024-12-18T18%3A50%3A15.400) | $425 | $425 | $290 | $135 |
| T02 | Houston, TX, 2025 | [Insulated window and shower seals](https://photos.harstatic.com/407203828/supplement/pdf-6.pdf?ts=2025-02-08T19%3A32%3A38.970) | $727 | $727 | $490.31 | $236.69 |
| T03 | Cypress, TX, 2022 | [System check + hard-start kit](https://photos.harstatic.com/206718241/supplement/pdf-5.pdf?ts=2022-04-19T22%3A54%3A02.550) | $365 | $375 | $485 | -$110 |
| T04 | Houston, TX, 2022 | [Two tune-ups + two Turbo 200 capacitors](https://photos.harstatic.com/283749919/supplement/pdf-4.pdf?ts=2024-01-10T00%3A53%3A49.470) | $605 | $721 | $936 | -$215 |
| T05 | Spokane, WA, 2023 | [Three chimneys and fireplace restoration](https://www.historicspokane.org/wp-content/uploads/Special-Valuation-Application-238-E-13th-Avenue_Submitted-5_29_2024-.pdf) | $20,519 | $20,519 | $4,383.27 | $16,135.73 |
| T06 | Spokane, WA, 2023 | [Bedroom cracks, full skim and sanding](https://www.historicspokane.org/wp-content/uploads/Special-Valuation-Full-Application-Fotheringham-House.pdf) | $1,799 | $1,799 | $2,897.75 | -$1,098.75 |
| T07 | Spokane, WA, 2018 | [Eight historic door faces](https://www.historicspokane.org/wp-content/uploads/2018/12/Thomas-House-Special-Valuation-Application-FULLsmall-1.pdf) | $1,750 | $1,750 | $2,267.74 | -$517.74 |
| T08 | Spokane, WA, 2017 | [Bosch dishwasher supplied and installed](https://www.historicspokane.org/wp-content/uploads/2018/05/Trogdon-House-Full-Special-Valuation-2018.pdf) | $781 | $781 | $754.80 | $26.20 |
| T09 | Sutton, MA, 2023 | [Supply and fit 27 custom oak vents](https://www.fourgenerationsoneroof.com/refinish-red-oak-vs-replace-white-oak-cost/) | $2,640 | $2,640 | $3,100 | -$460 |
| T10 | Bon Air, VA (Richmond area), 2013 | [Recessed lights and attic wiring](https://www.younghouselove.com/can-it-2/) | $400 | $400 | $272 | $128 |
| T11 | Katy, TX, 2024 | [Garage door hardware overhaul](https://photos.harstatic.com/416874783/supplement/pdf-1.pdf?ts=2025-07-21T11%3A36%3A05.017) | $1,213 | $1,213 | $2,491.40 | -$1,278.40 |
| T12 | Spokane, WA, 2017 | [Exterior repaint and porch paint](https://www.historicspokane.org/wp-content/uploads/2018/05/717-W-Waverly-Place-SV.pdf) | $5,430 | $5,430 | $7,323.44 | -$1,893.44 |

## Additional handyman cases: final follow-up, unseen payments

| Case | Market, year | Scope and source | Original | Revised | Paid | Revised minus paid |
|---|---|---|---:|---:|---:|---:|---:|
| X01 | Arroyo Grande, CA, 2025 | [Gate, picket, toilet seal and paint pickup](https://media.hd.pics/1/br77yqmg98.pdf) | $330 | $330 | $430 | -$100 |
| X02 | Honolulu, HI, 2025 | [Doors, trim and three window ledges](https://www.financialsamurai.com/the-cost-to-remodel-a-rundown-two-bedroom-in-law-unit/) | $8,040 | $8,040 | $4,000 | $4,040 |
| X03 | New York City, NY, 2022 | [Open kitchen wall and add a peninsula](https://www.apartmenttherapy.com/white-galley-kitchen-redo-5000-dollars-37108486) | $7,800 | $7,800 | $4,500 | $3,300 |
| Y01 | Cleveland, TN area, 2022 | [Laundry closet to custom pantry](https://www.lelaburris.com/custom-pantry-cost/) | $1,478 | $1,478 | $1,801 | -$323 |
| Y02 | Los Angeles, CA (San Fernando Valley), 2018 | [Paint small bathroom; hang mirrors and hooks](https://sivanayla.com/2018/07/11/before-after-guest-bathroom-remodel/) | $435 | $435 | $400 | $35 |
| Y03 | Pittsburgh, PA (south metro service area), 2018 | [Replace two doors and install dryer vent](https://www.angi.com/companylist/us/pa/monongahela/ace-handyman-services-south-pittsburgh-reviews-10452145.htm?page=2) | $1,105 | $1,105 | $917 | $188 |
| Y04 | Lakeland, FL area, 2026 | [Relocate fixtures and frame attic access](https://www.bbb.org/us/fl/lakeland/profile/handyman/ace-handyman-services-lakeland-0733-235972943/complaints) | $411 | $411 | $606.64 | -$195.64 |

**Where the handyman-only round was off.** In [Honolulu](https://www.financialsamurai.com/the-cost-to-remodel-a-rundown-two-bedroom-in-law-unit/), the point was $8,040 versus $4,000 spent. The door-and-trim package drove it ($7,350 estimated, $3,000 paid); the estimator actually undervalued the three window ledges ($690 vs $1,000). In the [New York apartment](https://www.apartmenttherapy.com/white-galley-kitchen-redo-5000-dollars-37108486), wall removal was close ($1,650 vs $1,500), but installation was $3,100 vs $1,000. Owners participated in both projects. In [Arroyo Grande](https://media.hd.pics/1/br77yqmg98.pdf), the four-task visit came in higher than estimated: $360 labor/pickup plus $70 materials vs $275 plus $55 predicted. A uniform discount would worsen that job. The next useful calibration is measured door/cabinet packages, paid helper hours and a distinction between a standalone contractor call and an owner-assisted add-on, tested on another untouched set.

Evidence for that seven-job cohort: one zero-balance handyman invoice, four homeowner project accounts, one Angi customer review, and one BBB payment dispute with a provider response. Two cases use separate local franchises in the same national network; independent provider pricing is not guaranteed. For the BBB case, the service subtotal is derived from the paid amount less the stated material line. Some locations refer to a market served, rather than a verified home municipality. No source was treated as an audited invoice when it was only a customer report.

## How to interpret and reproduce the test

Separate researchers extracted redacted scopes and retained the evidence. The estimating agent ran the archived skill without web access, source links, provider names or paid amounts. The developer saw the development payments after the 12 baseline development forecasts froze. Some of the first test scopes were visible for researching independent price menus, but none of their payments were used to select changes. The test cases and all baseline forecasts froze before the revised test forecasts. Only then were their payments opened. The same evaluator applied the revised guide to its own original assumptions, so this measures a controlled change in method, not variation between different estimators. The revised development replay remained blind to its answers but is not independent validation. See the [protocol](protocol.md), [original runtime](before.zip), [first revision tested](after.zip) and [final runtime](final.zip).

Evidence varies. Development includes first-person cost submissions, a forum post and homeowner project narratives; several amounts or dates are approximate. In the original fresh set, five records come from Houston-area disclosure packets, five from separate Spokane historic rehabilitation filings, and two from homeowner project accounts. One receipt was marked paid by hand; some others have matching checks, a zero balance, or a sworn expense ledger. T05 has conflicting invoice/payment years; T09–10 are self-reported, with a partly approximate amount in T10. Maryland D07 is state-only. Large trade packages, historic work and two cities are overrepresented. Do not interpret this as a representative distribution of paid handyman jobs. Tax, returns, discounts, owner purchases and bundled labor were reconciled case by case; an itemized job can include bundled labor and materials. No customer records, signatures or payment details are reproduced here; the user can inspect the linked originals.

[Download the full job-by-job scorecard](job-comparisons.csv). [Compare every estimated component with the corresponding receipt lines](line-review.csv). The original classifications, receipt caveats and source links are in payments-*.jsonl; estimate inputs, assumptions and line prices are in scope-*, old-* and new-*. Run `python3 validate.py` then `python3 score.py` from this folder. The original 100 synthetic requests and Chicago provider offers are separate tests; they are not counted here.
