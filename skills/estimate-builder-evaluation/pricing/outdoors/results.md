# Outdoor price comparison results

Verified November 13, 2026. All dollars are USD. Each test fixed its rule before its corresponding holdout document was opened. No contractor was contacted. The scoring inputs are public service offers and competitive bids. This evaluates numerical methods against those records. It does not test an individual language model's ability to interview or predict paid residential invoices.

## Weekly mowing rates

The initial search returned GG Garden's own Sarasota table first. The next eligible independent primary provider was EasyDay in Minnesota. Calculators, secondary surveys and simulated training exercises were ineligible. GG's schedule has per-visit rates for seven size bands up to 11,000 sq ft. Although it bills an even monthly amount year-round, the training data uses only its explicitly stated per-mow column. Its spring/summer cadence is weekly. For GG the lower band owns an overlapping closing endpoint. Its first band explicitly excludes 5,000 sq ft. A more detailed edge/access scope could shift the actual price. [GG Garden price card](https://gggardenlawncare.com/price/)

| Split and area | Held-out offer per visit | Area-based prediction | Flat training median | Absolute error, area / flat |
|---|---:|---:|---:|---:|
| Minnesota, 8,000 sq ft | $46.75 | $47 | $47 | $0.25 / $0.25 |
| Texas supplement, 5,000 sq ft | $42–55 | $44 | $47 | $2 / $5 to lower bound |
| Texas supplement, 10,000 sq ft | $56–81 | $50 | $47 | $6 / $9 to lower bound |

- **Initial holdout.** One eligible endpoint from one provider. Both methods had $0.25 mean absolute error and +$0.25 bias. EasyDay lists $55 base for up to 8,000 sq ft and a 15% weekly discount. The 14,000-sq-ft endpoint falls outside training coverage. The service includes trim and blow. This single observation does not favor tiering. [EasyDay mowing card](https://easydayservicesmn.com/)
- **Supplement.** One eligible provider, two endpoints. Mean absolute error to the lower bounds was $4 tiered versus $7 flat, with −$2 bias for both. The posted ranges also show that both predictions fit the small band and both miss the medium band. Just Right Lawns includes mowing, edging, trimming and blowing. Its open upper band has no finite endpoint. [Just Right Lawns](https://justrightlawns.com/about/pricing)
- **Source exclusions.** Three supplementary lawn searches were completed. Spruce's primary FAQ simultaneously lists two different schedules for identical sizes without resolving which applies. Lawn Panther specifies a first-visit size limit but does not map recurring rates to two sizes. Handyman Eugene sells prepaid monthly mowing packs. Tiny's gives no weekly cadence for its price list. SimpliLawn labels the input lot size. These were excluded under the supplementary protocol. [Spruce](https://www.sprucelawncareservice.com/faqs) · [Lawn Panther](https://lawnpanther.com/lawn-mowing/) · [Handyman Eugene](https://handymaneugene.com/lawn-care-leaf-cleanup/) · [Tiny's](https://tinyslawncare.wixsite.com/eugene) · [SimpliLawn](https://simplilawn.com/lawn-care/portland-or/lawn-mowing)

GreenPal reported 51,898 Maryland mowing transactions through October 1, 2026 and a $47 median accepted price in its recent state activity summary. That is a marketplace-reported aggregate with mixed sizes and frequencies. The field test has no paired paid homeowner invoice, dimensions and scope with which to validate the model against payment. [GreenPal Maryland transaction report](https://www.yourgreenpal.com/maryland-lawn-care-services)

## Installed fence bid rates

The Toms River, New Jersey 2022 negotiated bid tabulation has three companies pricing the same purchase-and-install specification with 10-foot post spacing, 24-inch tie spacing and six heights (3, 4, 6, 8, 10 and 12 feet). All six base items were retained. Gates, optional spacing, hourly work and markup were excluded. Use EB Fence's rate at the same height to predict the other two bidder columns. The constant alternative uses EB's six-rate median of $48.375 per installed foot. [Toms River bid tabulation](https://www.tomsrivertownship.com/DocumentCenter/View/9829/2022-Fencing-Bid-Tab---Negotiated)

| Per installed linear foot | Height-aware | Constant |
|---|---:|---:|
| Mean absolute error, 12 held-out cells | $19.88 | $23.83 |
| Mean signed error (prediction minus bid) | −$14.67 | −$14.00 |

The two held-out providers quoted $24.50–120/ft across six sizes on one municipal procurement. Height reduced average absolute error by $3.95/ft (16.6%). At 12 feet the height-based estimate was still $63.20/ft below Accent's bid, and at four feet it missed Accent's bid by more than the constant. These figures measure between-bidder differences on this procurement. A privacy fence for a homeowner needs its own material, hardware and local site scope.

## Historic paving estimate check

The frozen South Florida comparator was $12–18/sq ft, midpoint $15, for standard concrete or $14–22, midpoint $18, for permeable concrete. The contemporaneous source is an installer's advertised current planning range. [Craft Pavers](https://craft-pavers.com/services/paver-installation/)

**Zero strictly qualifying unit-price rows.** Flat Earth's April 29, 2024 estimate 10737 states 554 sq ft of walkway for $3,800 and 493 sq ft of driveway for $4,950. Both were quoted as lump sums, with pavers themselves separate. The standard material option adds $3,450 for both together, an alternative surface adds $6,950, and a permeable base adds $4,500 if selected. Treating the two base lines as all-in unit prices would omit materials. One cannot allocate the material lump sum to the individual areas from the document. [Original estimate in the Lake Worth Beach CRA packet](https://cms2.revize.com/revize/lakeworth/Document%20center/Agendas%20%26%20Minutes/2024/May%2014%2C%202024/VIII.a%20Commerical%20Grants%20-%2015%20N.%20E%20Street.pdf)

**Exploratory arithmetic, separate from the frozen score.** The standard-material option delivers $12,200 over 1,047 stated sq ft, equivalent to $11.65/sq ft, slightly below the guide's $12 floor. A second contractor in the same packet (estimate 4536, dated April 28) priced about 1,047 sq ft of permeable paving at $13,611 and driveway/parking base at $1,215. The scoped sum of $14,826 equates to about $14.16/sq ft, within the $14–22 comparison range. Steps and document preparation are separate. These are two offers for one commercial-site grant application with different assemblies and scope. Neither proves payment, and the dates differ from the current comparator. [Original bids](https://cms2.revize.com/revize/lakeworth/Document%20center/Agendas%20%26%20Minutes/2024/May%2014%2C%202024/VIII.a%20Commerical%20Grants%20-%2015%20N.%20E%20Street.pdf)

## Reproduction

From this directory run `python3 score.py` and `python3 score_fencing.py`. Each prints held-out predictions and exposure counts. The frozen methods are in [initial mowing protocol](protocol.md), [supplement protocol](supplement-protocol.md) and [fence protocol](fence-protocol.md). [Mowing inputs](mowing.csv) and [fence bids](fencing.csv) preserve rates in their original units. The estimates above are descriptive tests with at most two independent held-out providers per comparison. Material and deck examples in the skill are published supplier or installer prices without an independent deck job holdout.

## Decking grade and supplier comparison

A separate [frozen test](deck-protocol.md) compared two 16-foot grooved Trex Enhance boards across two independent suppliers. Schillings' Chicagoland list prices are $2.29/linear ft for Basics Clam Shell and $3.09 for Naturals Foggy Wharf. Beckerle's March 22, 2026 Haverstraw, NY list priced the same two boards at $44.80 and $56.00 each. Skip suppliers showing no public prices, seconds and sales. Trex's own ordering guide verifies the named grades and board profiles. [Schillings](https://schillings.com/length/16/) · [Beckerle's branch list](https://beckerlelumber.com/xls/inventory-suglist.PDF) · [Trex ordering guide](https://prod-lowes.trex.com/content/dam/trex/literature/ordering-guides/Spring%202025%20Lowes%20Ordering%20Guide.pdf)

| Per 16-ft board | New York list | Grade-aware prediction | Flat average | Signed error, grade / flat |
|---|---:|---:|---:|---:|
| Clam Shell | $44.80 | $36.64 | $43.04 | −$8.16 / −$1.76 |
| Foggy Wharf | $56.00 | $49.44 | $43.04 | −$6.56 / −$12.96 |

**Both methods had $7.36 MAE and −$7.36 bias** across one held-out supplier and two products. Grade awareness better predicted the held-out price spread ($12.80 versus $11.20 observed), but both predictions were low. Source dates and dealer/market change together. No evidence here isolates a regional multiplier or verifies contractor-installed or paid deck totals.
