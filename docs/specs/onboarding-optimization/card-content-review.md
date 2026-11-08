# Five-card content and scope for review

> Current owner direction, November 8: the carousel is the default signed-out landing screen. Sign in and Create account open explicit input forms; Back returns to the carousel. This supersedes the earlier first-launch-only/suppression/replay plan below. Pending verification, auth/recovery links and valid sessions bypass the carousel. Working implementation is in AuthWelcome.tsx / SignInScreen.tsx; native visual review and target-release capability claims remain release gates. Existing earlier planning remains historical.


Status: Proposed copy/visuals; format, themes, first-launch policy and replay entry approved. Planning only.

## Outcome and release

A prospective user can understand FieldSoli's core value and basic workflow before registering, or register/sign in immediately. Native iOS/Android introduction; no post-signup redesign. Five cards use the canonical selected App Store campaign order and visual language. Adapt artwork for in-app reading; use native text, platform-specific product crops and persistent account controls.

| Card | Proposed headline | Proposed supporting copy | Artwork reference / purpose |
|---|---|---|---|
| 1 | Unlimited invoices & estimates | Create estimates and invoices for your jobs. | 01: selected invoice composition; describes document capability without adding payment-processing claims. |
| 2 | Track time & expenses | Record time, materials and other costs against each job. | 02: existing time/material/expense view; explains the basic capture flow. |
| 3 | Simple. Fast. | Start with a job. Add details as you go. | 03: fast capture product view; communicates why FieldSoli exists through lightweight record keeping. |
| 4 | Take your data with you. | CSV export. No active subscription required. | 04: export view; preserve owner-approved supporting line exactly, contingent on access verification. |
| 5 | See your job earnings. | Review recorded earnings, time and costs. | 05: earnings summary; factual payoff without advice, promised savings or future-income claims. |

Headlines follow the selected store themes, not the superseded Door repair narrative. Do not invent a new common sample job if campaign imagery uses different examples. Sample figures must be clearly illustrative, never imply a real user account or live timer. Exact image adaptations need owner review in a ChatGPT prototype; existing store selection approves the reference, not every crop/layout.

## Account and browsing behavior

Create account (primary) and Sign in remain on every card. Next on 1–4; Back on 2–5; readable “1 of 5” status with visual dots. Manual swipe supported; no autoplay, wraparound or forced waiting. No separate Skip button needed because both account destinations are immediate. “About FieldSoli” on sign-in reopens card 1; replay can close back to the preserved auth screen. Signup handoff selects signup mode explicitly. No changes to field requirements, legal acceptance or recovery behavior.

Automatic first presentation is consumed when shown, even if interrupted. Subsequent launches go to auth; replay remains available. Upgrades never become new installations just because the intro preference is absent. Unknown eligibility/storage/native results bypass to auth. Recovery links and restored authenticated sessions take precedence. Persist only a device-local suppression marker; no account profile or behavioral analytics record, no per-swipe durable progress. Native install-info choice and cutoff must be frozen/tested in final data contract.

## Accessibility and failures

Native headings/supporting text, semantic controls, no artwork-only essential message. Screen-reader summary for meaningful screenshot content; redundant background/device decoration hidden. Announce settled page once; visible Next/Back permits browsing without swipe. Reduced motion uses instant/minimal paging; large text scrolls vertically without hiding account actions. Test small phones, tablets, orientation, safe areas, Android Back, focus restoration and keyboard navigation. Bundled imagery works offline; failed image leaves text/actions intact. Uncertain storage results never block signup/sign-in.

## Claim and release gates

All five themes are selected. Do not silently drop invoices or export if a gate fails. Instead block publication until the target release supports the claim or obtain revised wording from owner. In this checkout invoicing is gated by authenticated-user flag; no unauthenticated flag lookup or analytics request may be introduced to choose cards. Verify unlimited document access, target audience eligibility and CSV access without subscription in the release environment. Store artwork and dormant code alone are insufficient evidence. This is a release prerequisite, not authorization to change entitlements or rollout.

## Acceptance evidence and exclusions

Before merge: route/state/storage tests for first presentation, consumed/upgrade/unknown cases, replay, both account destinations, active form preservation, initial/live auth links and session restoration; no optional telemetry, permission prompt, business write or timer starts. Accessibility/manual paging and missing-image/offline behavior proved.

Before release: native fresh install and upgrade fixtures on iOS/Android, restore/reinstall limitation documented, reader/large text/reduced-motion/device visual review, accurate claims and prototype approval. Update current-product.html, product:export, design:check and ChatGPT assets when shipped. Keep build/submission/processing/public release separate.

Out of scope: post-login onboarding, job creation changes, guest editing, new auth methods, business surveys, earlier analytics consent, website/store redesign, competitor capture, new tracking/provider, pricing or financial semantics changes.

## Remaining approval and contract manifest

Approve/revise the five headline/body pairs and review the adapted visual prototype before final implementation readiness. State model, data contract, UX contract and test contract are all Required; final spec and build plan follow these approvals, per feature-shaping skill. No code changed or tests run for this documentation-only update.

## Latest carousel visual revision

Owner requested a white background card containing each slide’s heading, body and enlarged artwork. Removed the visible Illustrative example label, numerical page count and left/right arrows. Swipe remains; dots remain visible and are touch/screen-reader page controls with selected state. Sample meaning remains in accessible artwork summaries. Create account and Sign in remain outside the white card and available on every slide. First-slide native simulator screenshot: docs/product/chatgpt/onboarding/white-card-simulator-review.png.

Latest owner refinement: no visible subtitles on any slide. Increase white-card top padding from 16 to 28 points. Pagination uses 8-point round dots and a 24-point active capsule, all in FieldSoli primary text color; no visible count/arrows/example label. Headings and artwork summaries remain accessible.

Spacing refinement: white-card top padding is now 60 points; pagination uses 4-point horizontal padding around each 8-point dot / 24-point active capsule, creating a compact centered group matching the owner reference.

Artwork spacing refinement: moved the image up 28 points (top margin 16 → -12) while retaining the title’s 60-point top padding. Existing asset transparency still supplies separation.

Owner asset replacements: export now uses the matching Job summary · 2026 table proof; time/expenses uses the matching historical $485/$435 job-summary capture clipped to the supplied region. Active-visit screenshot requested for Simple. Fast. is pending access to the original file; previous artwork remains until supplied.

Owner restored the exact store-reference subtitles on cards 1, 4 and 5: “No monthly document limits.”; “CSV export. No active subscription required.”; “Understand profitability to inform future pricing”. Cards 2 and 3 have no subtitle. This owner-approved copy supersedes earlier no-subtitle direction and proposed body text. Existing headings, artwork and compact dots remain.

Latest image selection: owner supplied card-02-screen-door.png and card-03-minimized-visit.png directly in the app onboarding assets. Replaced Track time & expenses with the paid Screen door replacement summary and Simple. Fast. with the minimized active visit. Display original files unchanged; no generated reconstruction or source-crop fallback.

Latest framing/alignment: Track time & expenses screenshot is clipped to a rounded card with a fine neutral border. Simple. Fast. uses the supplied minimized-visit screenshot unchanged over decorative lower-phone hardware with a home indicator and floating shadow; this is static artwork, not a new native Live Activity implementation. Every artwork region is now measured from the bottom of the actual title/subtitle block to the bottom of the white card and vertically centered there, superseding fixed negative margins. Larger text retains vertical scrolling. Pagination updates from onScroll during dragging, rather than waiting for momentum to end; regression test verifies selected dots before swipe completion. Forty focused tests, mobile TypeScript and whitespace checks pass.

Export composition now uses the actual export-screen capture in decorative upper-phone hardware, with its Export Job Summary heading and spreadsheet preview floating in front. Simple. Fast. lower-phone top cut edge is reduced from 3 to 1 point to keep attention on the activity.

Lower-phone crop refinement: top 20% now fades from transparent to opaque via an SVG alpha mask on the decorative hardware/screen only. The supplied floating activity screenshot and shadow stay opaque. This supersedes the thin hard top-edge treatment. No new dependency or raster modification.

Phone fade refinement: extended the lower-phone alpha fade from the top 20% to the top 50% of the phone; floating activity remains opaque.

Phone crop refinement: removed the upper 25% of the lower-phone graphic via its SVG viewport (y=70 of 280). Physical scale and bottom anchoring are preserved, with fade rebased to the new top; floating activity artwork is unchanged.

Cropped phone centering: composition bounds now use the cropped phone height and floating activity bounds, excluding the removed upper quarter, so the entire visible group centers in the remaining space below the text.

Wordmark refinement: trademark rendered separately at 9 points in regular PT Serif, aligned as a small superscript rather than inheriting the bold title weight.

Owner trademark proportion reference: TM is now 6.4 points against the 20-point FieldSoli wordmark (32%), regular weight, with a 3-point gap and raised alignment. This supersedes the initial 9-point treatment.

Account-action colors: use Brand/Primary (#A3421F) for form primary CTAs and carousel Create account; carousel Sign in remains secondary with the same orange text and outline. Disabled form actions retain their existing disabled behavior.

Carousel Sign in restored to primary dark text and subtle neutral outline at owner request. Create account and form primary actions retain brand orange.

Owner added exact subtitles: Track time & expenses — “Easily log materials and other job costs.”; Simple. Fast. — “Capture now, organize later with quick actions & live visits.” The measured text-block layout includes these subtitles before calculating each artwork’s centered remaining region.
