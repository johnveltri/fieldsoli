# AI Handyman Estimate Builder: 100-request field test

**Completed-job pricing:** [Blind multi-city estimates compared with itemized homeowner payments](paid-handyman-jobs/report.md).

**Current pricing:** [Chicago replay of all 100 requests, local comparisons, corrections and independent provider check](chicago-replay/report.md).

For subsequent market-price research and independent price-error measurements, see the [pricing evaluation](pricing/report.md).

**83 passed cleanly, 11 had a minor issue, and 6 needed a scope correction before the homeowner should receive the estimate.** The recurring problem was the difference between a caution in the estimator’s private review and a promise in the homeowner’s copy. No unsupported dollar figure was found in the 100 final estimates.

| Requests and full transcripts | Clean pass | Minor issue | Needs revision |
|---|---:|---:|---:|
| [1–25: Interior repairs and small installations](cases-001-025.md) | 19 | 4 | 2 |
| [26–50: Appliances and larger remodels](cases-026-050.md) | 20 | 2 | 3 |
| [51–75: Outdoor work and property care](cases-051-075.md) | 21 | 3 | 1 |
| [76–100: Estimate revisions, pricing and difficult handoffs](cases-076-100.md) | 23 | 2 | 0 |
| **Baseline** | **83** | **11** | **6** |

**What worked.** In #52 the model turned 64 feet including a 4-foot opening into 60 billable fence feet, adding the gate and demolition once for $2,850. In #80 it kept an actual-area sheathing rate outside the $640 base, required written approval, and stopped at soft framing for a separate carpenter. In #85 it recognized $300 as the homeowner’s ceiling and did not offer the work for $300. In #89 it preserved the $115 handle repair without turning it into a price for drain diagnosis. Deposit credits, mutually exclusive options, service minimums and per-visit prices also kept their intended meanings.

**What needed revision.** These six quotes were not ready to send as written:

| Case | What was missing from the homeowner's decision |
|---|---|
| #2 — prehung exterior door | $950 was labor only, and nobody had agreed who supplied flashing and trim consumables. |
| #10 — TV over fireplace | The bracket and backing were verified. The promised mounting location still depended on fireplace clearance. |
| #41 — bathroom refresh | $1,800 was the handyman’s labor. The customer needed a draft identifying the vanity footprint and hookup handoff. |
| #42 — bathroom demolition and tile | The copy called the demolition limits and tile surfaces “agreed” before they had been marked. |
| #43 — cabinet doors | The contractor priced installing 18 fronts; responsibility for buying fronts and hardware was still open. |
| #60 — sod over a plumbing trench | The surface prep price depended on the plumber handing over settled, ready backfill. |

The 11 minor findings are recorded beside their transcripts. Examples include wording that implies an extra follow-up to give caulk cure instructions, too many fence questions in one turn, and an unnecessary hypothetical extra-footage clause on a measured baseboard job. A minor issue means the core estimate remained usable; it is not counted as a clean pass.

**Changes and replays.** The shared instruction now requires the estimator to carry a material open issue into the corresponding homeowner line, keep the figure attached to what it covers, and mark the copy as a draft. The same principle applies to structured items. The exterior-door reference now distinguishes installing flashing and trim from buying those materials. We replayed all six material cases plus #90 (structured output). Six of seven passed on the first replay; #2 still missed the supply question. After the door-specific edit, #2 passed. See the [eight replay transcripts and verdicts](retests.md). This is a targeted confirmation for seven cases, not a new 100-case score; the ten remaining minor findings were addressed in the follow-up below.

**Follow-up on the remaining findings.** Each of the other ten minor cases passed its targeted replay. Across the two rounds, all 17 original findings have a passing targeted replay. The 83 original clean passes were evaluated on the baseline version. [Ten follow-up conversations](minor-issue-replays.md)

**Method.** These are 100 distinct, fictional homeowner requests. The skill’s actual interlocutor is the contractor, so each request was relayed by a contractor. Before execution we wrote a contractor reply and a case-specific expectation for every request. Evaluators received only the requests and skill first. They recorded the interviews before seeing the replies, then produced separate contractor reviews and homeowner drafts. The runner did not receive the expectations as an answer key. Three evaluator agents handled four batches of 25; these were separate response records per job, not 100 isolated model sessions. The original source files and the skill’s technical references were local. No homeowner, contractor, external estimating service or live FieldSoli integration was involved.

**Scoring.** A clean pass required a relevant first question and an estimate that respected the supplied work, quantities, pricing coverage, handoffs, and any conditions or approval steps. A material omission, unsupported commitment, or scope-changing contradiction was “needs revision.” A wording, interview-efficiency or presentation issue with the essential deliverable intact was “minor.” We reviewed the generated text, checked all displayed final dollar amounts against inputs or arithmetic, and recalculated the six cases that showed derived dollar figures. A hypothetical homeowner budget appearing in a request counts as input, but it was also reviewed for whether it was misrepresented as a price. Quotes and allowances are synthetic; the test does not validate local rates, construction design, legal compliance, or performance interpreting actual photographs.

**Use the evidence.** The [scorecard](scorecard.csv) has a searchable row per request. The [machine-readable baseline](baseline.jsonl) contains each input, expectation, first response, contractor reply, final review, homeowner copy and grade. For fresh testing, give the estimator the request field first and the contractor_reply field only after the interview. Keep the expected output and grades hidden. The [baseline instructions](baseline-instructions.md) and [baseline door reference](baseline-carpentry.md) preserve the original versions of the two changed files. The [archived baseline instructions and complete reference tree](baseline-runtime.zip) preserve the inputs for reproducing the original evaluation. The pre-edit fingerprint of the skill instructions plus reference tree was `c2e7dc30da4bfa47c9261a9087dfa055cd46332ff4e13650144da89622f21ed7`.
