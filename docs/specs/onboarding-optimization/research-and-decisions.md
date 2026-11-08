# FieldSoli pre-signup introduction: research and decision packet

> Current owner direction, November 8: the carousel is the default signed-out landing screen. Sign in and Create account open explicit input forms; Back returns to the carousel. This supersedes the earlier first-launch-only/suppression/replay plan below. Pending verification, auth/recovery links and valid sessions bypass the carousel. Working implementation is in AuthWelcome.tsx / SignInScreen.tsx; native visual review and target-release capability claims remain release gates. Existing earlier planning remains historical.


**Updated:** 2026-11-04. **Status:** Exploring, planning only. **Readiness:** Blocked for implementation pending card copy/visual/behavior approval and prototype validation. Research packet complete for review.

## Current owner direction

Introduce the app **before signup**. Job creation and post-signup activation are separate considerations. The owner subsequently stopped competitor-specific screen collection and requested best-practice research instead. Do not pursue installs or wait for emulator sign-in. Preserve current post-login analytics consent timing in the analytics work underway.

This packet supersedes earlier recommendations. [Historical competitor research](competitor-research-archive.md) preserves the evidence and device work, but competitor access is no longer a prerequisite. No implementation, deployment, accounts, trials, external communications or product-code changes are authorized by this planning task. The owner is offline; finish recommendations without inventing approval.

## Approved format and proposed narrative

Owner selected **3–5 swipeable cards** introducing FieldSoli's value, why it exists and its basic flow. This supersedes the single-welcome recommendation; format is settled, not an open decision. Recommend **four cards** to give purpose, capture, organization and review one focused beat each. Four is an editorial choice within the approved range, not a research-proven optimum. Exact copy, visuals and interaction details below remain proposals.

Pre-signup education only. Swiping never creates a job, starts a timer, sends a document or records payment. The carousel is not assumed to improve conversion; research informs brevity, control and testing within the owner's selected format.

## Evidence and confidence

Reviewed 2026-11-04. Platform guidance, empirical findings and FieldSoli inference have different evidentiary strength. No source establishes a universal screen count or guaranteed conversion uplift.

| ID | Source and finding | Application | Limitation |
|---|---|---|---|
| E1 | [Apple HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) recommends brief optional onboarding, interaction and postponing nonessential setup. | Skippable cards, no setup burden. | Platform recommendation, not conversion evidence. Official indexed content available; main page required JS and Markdown fetch failed. |
| E2 | [NN/G: Mobile Tutorials](https://www.nngroup.com/articles/mobile-tutorials/), March 2020: 70 participants and four relatively simple iPhone apps; card tutorials did not improve task success/time and increased perceived difficulty. | Do not assume an instructional carousel helps. | Older, four apps, iOS task performance; not pre-signup conversion or FieldSoli audience. Does not prove every introduction fails. |
| E3 | [NN/G: Mobile-App Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/), June 2020, distinguishes promotion, customization and instruction; favors relevant customization and minimal instruction. | Clarify purpose; avoid duplicating store marketing and research-only questions. | Expert synthesis, no FieldSoli effect estimate. |
| E4 | [Material onboarding](https://m1.material.io/growth-communications/onboarding.html) distinguishes quickstart, meaningful self-selection and benefit introduction. | Compare patterns; choices must visibly change experience. | Legacy Material 1, not a current Android requirement. Do not adopt its autoplay suggestion here. |
| E5 | [Android runtime permissions](https://developer.android.com/training/permissions/requesting) recommends contextual requests and usable fallback after denial. [Apple privacy guidance](https://developer.apple.com/design/human-interface-guidelines/privacy) also emphasizes context. | No contacts/location/camera/notification bundle in an introduction. | Device permission differs from analytics consent, legal acceptance and ATT; no legal conclusion inferred. |

Synthesis: strong support for reducing forced effort and retaining user control; weaker evidence that a pre-signup preview improves registration for this audience. Test that central assumption rather than equating more onboarding with better onboarding.

## FieldSoli context

Read `docs/product/brand-strategy.md` and `docs/product/marketing-voice.md`: respect experienced tradespeople, interrupted field use, factual capabilities and clear visual quality. Avoid coaching slogans, fake personalization, testimonials or savings claims.

Implementation previously inspected at working tree based on `f8700fd8cc5f6def75cbfb5b9a8c565cc8a801a3`; concurrent work exists. This is code evidence, not a shipped-binary walkthrough:

- `apps/mobile-expo/app/sign-in.tsx` routes signed-out users to `SignInScreen`; `src/screens/SignInScreen.tsx` starts in sign-in mode with “Welcome back.” No dedicated introduction on that route.
- `src/shell/AuthenticatedAppChrome.tsx` resolves optional analytics after session/legal gate. Preserve it.
- Real-job capture already supports minimal entry, but improving that flow is outside scope.
- Verify every depicted feature against the target public release/flags. Brand parity lists and historical Figma do not establish availability. `current-product.html` was not used as current evidence; roadmap not inspected.

## Approved visual reference and optionality

Owner identified the App Store images as the reference for these cards and confirmed users must not have to swipe through them. Use the selected portrait campaign under `docs/app-store/release-1.2/final-images/` as the starting point: concise factual headlines, actual product screens, slate/rust palette and consistent device imagery. The header/search asset README documents that campaign continuity; those wide placements are supplementary, not the mobile card template.

Adapt the artwork to in-app layouts instead of embedding a whole screenshot advertisement: keep card headings/body as accessible native text, retain legible product imagery, and reserve space for persistent account actions. Reuse the campaign's approved capability language where relevant; previous card copy and fictional Door repair sequence remain proposals, not a requirement to replace campaign content. Review the portrait images in the next visual-design pass before selecting the final 3–5 cards. Store creative is a visual/copy reference, not independent verification that every capability is available in the target build.

**Create account and Sign in are available from the first card and stay available on every card.** Browsing is optional. Swipe and Next/Back offer ways to explore; neither is required to reach registration. No completion requirement or consent implication.

## Four-card narrative and visual concepts

Use one consistent, clearly fictional **Door repair** example across cards 2–4. Product UI is the evidence, with a small amount of editorial simplification for legibility. Sample previews are non-editable artwork, not fake tappable controls. Proposed wording follows the marketing voice guide; owner approval still needed.

| Card | Narrative job | Proposed headline | Proposed body | Visual concept |
|---|---|---|---|---|
| 1 | Why we exist / value | **Less paperwork between jobs.** | **FieldSoli keeps your jobs, time and expenses together, without a complicated setup.** | A clean composition of a job record with time and expense details attached. Warm brand color and real product shapes, not a stock tradesperson or success slogan. Communicate a lighter record of work, not a crew/dispatch system. |
| 2 | Basic flow: capture | **Capture work as you go.** | **Record time, add a note or save a material cost. Fill in the details when you have time.** | Door repair with a compact recorded visit, a short note and a material-cost entry. Visually establish capture now/refine later. Do not animate a running timer that appears to be real. |
| 3 | Basic flow: organize | **Keep it with the job.** | **Bring time, notes and materials together in one job record.** | The same entries shown inside Door repair, using a readable job-detail crop. A subtle spatial relationship links capture to the job; no arrows explaining every icon or mandatory customer setup. |
| 4 | Payoff / review / invitation | **See how the job added up.** | **Review recorded earnings, time and costs alongside the work.** | Same job's earnings/time/cost summary with labeled sample figures and its work history. No future-income promise, tax/accounting implication, or claim that these figures are automatically imported. Create account remains available, as on earlier cards. |

Why this order: purpose → capture → connected record → recorded outcome. It explains the workflow without pretending the user has completed it or teaching a financial lifecycle before registration. “Why we exist” is expressed through reduced administration rather than founder backstory or coaching language. No price, free-tier or unlimited claim is necessary to convey the purpose.

**Capability/copy verification:** the inspected implementation supports jobs, visits, notes and materials, but every visual/claim needs release-build verification. The current-product HTML has an old July review marker and mixed newer updates; it is a clue, not authoritative proof. Estimates/invoices remain excluded from this draft pending target-release verification. Do not use a historical Figma frame as current product evidence.

### Three- and five-card variants within approved scope

- **Three cards:** merge capture and organization into one coherent product visual. Keep purpose and recorded-outcome cards. Prefer this if testing finds the middle two repetitive.
- **Five cards:** split the outcome into a distinct, verified document capability and a record-review payoff only if the public release supports it and users need the distinction. Do not add a fifth card merely to reach a count; no legal, permission, survey or signup-form card as padding.
- Default remains four. Comparing these editorial cuts does not reopen the chosen swipeable-card direction.

## Candidate navigation and behavior

- First eligible launch opens card 1. Manual horizontal paging with visible **Next**; swiping is an additional route, never the only route.
- Persistent **Create account** and **Sign in** on cards 1–4 bypass the remaining cards. They make skipping explicit through the desired destination; a separate Skip intro control is unnecessary. Neither action implies analytics consent.
- **Create account** remains the primary account action throughout. **Next** is a secondary browsing control on cards 1–3; **Back** appears on cards 2–4. Card 4 still supports backward swipe and Back; no wrapping from card 4 to card 1.
- Show dots plus a readable **1 of 4** indicator; update with page changes. Avoid tiny dots as the sole controls. Announce the settled page once to screen readers; no repeated narration during drag.
- No separate ambiguous Skip destination: Create account goes to signup, Sign in goes to existing-account authentication.
- Proposed intro-exit behavior: Sign in and Create account on any card mark it dismissed locally; app relaunch then returns to existing auth entry rather than replaying. Background/termination before an exit can reopen the last viewed card. Exact persistence/version/reset policy belongs in state/data contracts before implementation.
- Registration Back returns predictably without erasing input; proposed destination is the card from which the user exited. Do not automatically resubmit or create an account on return. Password-reset/confirmation links bypass cards; authenticated users never see them.
- No autoplay, timed advancement, forced completion or hidden gestures. No forms, quizzes, permissions or account data inside cards. No standalone demo after the cards in the initial candidate.

## Accessibility and visual quality

- One heading and short supporting statement per card. Give visuals meaningful summaries where they add information; mark redundant decorative layers as decorative. Do not expose a flat image of essential text as the only accessible explanation.
- Logical reading order: card heading/body/visual summary, page status, Back/Next, then persistent Create account/Sign in. Final order should be tested on real platforms. Move focus to the new heading after button navigation; support native screen-reader paging without gesture conflicts.
- Explicit button labels and generous platform-sized touch targets; readable contrast, non-color page state and large text. Permit vertical scrolling at large text sizes rather than shrinking copy or hiding account actions. Scale/crop decorative artwork before sacrificing readable text.
- Respect reduced motion. A restrained page transition may establish continuity; no parallax or motion required to understand the sample. Support portrait/tablets, safe areas, keyboard traversal and Android Back (previous card from 2–4; ordinary platform exit behavior from 1).
- Use existing FieldSoli typography/buttons/tokens and a small controlled pager. Compare native/platform paging and existing dependencies before a custom implementation. No onboarding SDK or provider justified. Verify screenshot accuracy locally and in ChatGPT; no Figma sync.

## Proposed quality and privacy rules

- No real business data, survey answers or account required to view preview. No pre-consent analytics collection/queueing or later backfill.
- Account creation and sign-in reachable without completing education. Skip does not mean consent or disinterest.
- No forced replay after logout or over authenticated/recovery routes. Define device-local dismissed/completed preference and reset/version behavior before implementation; do not promise once-ever across reinstalls/devices.
- Recover safely after interruption; no unexpected submissions, guest-data migrations or cross-account content.
- Bundle lightweight preview assets locally. Asset failure leaves account actions usable; offline registration limitations explained at handoff.
- Semantic headings/buttons, logical focus/restoration, meaningful visual descriptions, text scaling, visible controls on small screens/tablets, safe areas/system Back. No information available only through swipe, color or animation. Respect reduced motion; no timed advancement.
- Compare existing design-system components/native navigation with a small custom read-only preview. Reuse is a baseline, not proof of quality. No tour SDK or carousel dependency justified; no new provider, paid tier or database migration assumed.

Keep analytics choice post-login for the initial candidate. Earlier consent remains a separately approved research variant, not the goal of introduction. Do not bundle analytics with terms, signup, device permissions or marketing email. Current timing prevents measuring the complete pre-signup funnel with optional analytics; use consented usability research instead of backfilling or repurposing operational logs to circumvent refusal. A future earlier-consent design needs identity, retention, queue/withdrawal and cross-account review. ATT/legal applicability requires actual data-use analysis; this packet makes no compliance determination.

## Testable hypotheses and research protocol

Create a ChatGPT prototype of the approved card format; review the proposed copy/visuals before implementation. Proposed first qualitative round: five independent tradespeople; useful for finding issues, not population percentages or powered conversion claims. Recruiting/contact requires separate authorization. Balance first exposure across variants or use separate participants to avoid learning contamination; compare preferences afterward.

| Hypothesis | Test | Revise/reject if |
|---|---|---|
| Four cards communicate purpose and workflow. | After first exposure, ask what FieldSoli is for and how capture, job record and review relate. Compare current auth entry as a reference, not as a format veto. | Users recite slogans but cannot explain usefulness or infer automatic accounting/payment processing. |
| Capture and organization deserve separate cards. | Compare four-card vs merged three-card cut using matched content and balanced first exposure. | Middle cards feel repetitive or sequencing obscures the simple workflow. |
| Visual continuity clarifies the flow. | Use the same sample throughout; ask users to explain what changed between cards. | They think several jobs were created or sample figures belong to them. |
| Skip/sign-in preserve user control. | Immediate signup/sign-in, swipe and buttons, large text/screen reader, relaunch and recovery links. | Forced completion, tiny controls, replay loops, lost input or trapped auth route. |

Neutral prompts: “What do you think you can do here?”, “What would you do next?”, “Is anything unclear before you decide whether to create an account?” Record comprehension errors, assistance, accidental taps, expectations and trust concerns. Avoid “Do you like onboarding?” as the success criterion. Use fictional work, no real customer/financial data.

Decision rule: keep added content only when it improves useful understanding/confidence without obstructing signup/sign-in. If a card adds no value, merge/rewrite it within the approved 3–5-card range; propose larger scope changes to the owner rather than silently replacing the chosen format. Set numerical targets after observing a baseline. Conversion alone can reward misleading promises; expectation match is a guardrail. Real-job activation remains separate.

## Owner review: format settled, details proposed

No response needed to reapprove a carousel. Remaining focused review items:

| ID | Decision | Recommendation / consequence |
|---|---|---|
| D1 | Approve four-card story and proposed wording? | Purpose → capture → organize → review. Four cards by default; three-card merge available if redundant. |
| D2 | Should estimates/invoices enter this story when public-release support is verified? | Keep this first draft on verified core; add document content only when it improves understanding, without implying unshipped capability. |
| D3 | Approve navigation/return/persistence behavior above? | Explicit Next/Back, Skip intro to signup, Sign in throughout, local dismissal; requires state/data contract. |

Agent resolved: research stays independent of competitor access; no new dependency; preserve auth/privacy boundary; propose four cards within owner's chosen range. Exact visual execution/copy and eligibility semantics remain unapproved. Analytics consent remains post-login and is not another open decision in this packet.

## Contract applicability and next gates

Material flow. Feature-shaping skill requires unresolved consequential decisions to be settled before final spec/build plan. All files below are **Required, pending** rather than empty placeholder deliverables:

| Artifact | Owns |
|---|---|
| `spec.md` | Approved outcome, scope, requirements and decisions. |
| `state-model.md` | Entry/skip/preview/auth transitions, replay, interruption and deep-link bypass. |
| `data-contract.md` | Local preference/reset/version semantics, synthetic content and privacy boundary. |
| `ux-contract.md` | Approved journey/copy, surface states, accessibility, visuals/platform behavior. |
| `test-contract.md` | Rule traceability, auth routing, persistence, privacy, device/visual evidence. |
| `plan.md` | Files/order, migration/compatibility and release gates after contracts stabilize. |

Likely seams: sign-in route/auth routing, new intro surface, local preference helper, existing design-system components and sample assets. This is not authorization to modify them now.

Before merge: approved rules mapped to tests; new/returning/logout/recovery eligibility, skip/back/focus, interruption/storage errors, no business writes or pre-consent events, current visual evidence. Recheck concurrent changes before planning edits.

Before release: iOS/Android fresh-install/upgrade, screen readers/text scaling/reduced motion, small screens/tablets/offline/keyboard/safe areas, preview accuracy against released build, owner copy/visual approval. Keep mobile build, submission, processing and public-release gates distinct. For meaningful shipped UI changes update `docs/product/current-product.html`, run `npm run product:export` and `npm run design:check`, and refresh local ChatGPT visuals. No Figma verification.

## Completion and throughput

**Readiness: Blocked for implementation; research packet complete for review.** Remaining decisions: card narrative/copy, release-verified visuals and navigation/eligibility approval plus validation. Swipeable 3–5-card format is approved. Emulator authentication and competitor capture are not blockers. Deferred: competitor screens, post-signup activation, editable guest mode, auth simplification, questionnaires, pricing, earlier consent and production experiments.

Artifacts: this packet; `competitor-research-archive.md`; prior `evidence/android-play-store-sign-in.png`. Archive contains superseded checkpoints. Previously enabled physical keyboard and restarted Pixel 10 with owner approval; runtime configuration showed `hw.keyboard=true` and Android detected QWERTY. No competitor install/account/trial occurred. No device action in this research pass.

Throughput: original question superseded; three current detail decisions presented for later review, not an overnight response request. Owner scope corrections and research stop incorporated. No consequential approved product decision reopened. Total elapsed/active PM/active agent time: Unknown, not instrumented. Contract coverage not defined yet; no implementation-readiness claim based on document completeness.
