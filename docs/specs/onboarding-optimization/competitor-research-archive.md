# Onboarding optimization: research and decision packet

**Status:** Exploring; Readiness: Blocked pending product decisions and firsthand validation.  
**Date:** 2026-11-04  
**Scope:** Separate onboarding initiative requested by the owner. Planning only. Analytics work currently underway retains post-login consent timing.

## Scope correction — owner direction

The owner clarified that the primary initiative is the flow introducing FieldSoli **before signup**. Creating jobs and post-onboarding UX are separate considerations. This supersedes the initial first-job recommendation and the earlier activation question; no response to that question is needed. Nothing in the initial recommendation was approved.

## Proposed direction

Introduce FieldSoli's value with a short, optional product demonstration before asking someone to register. Compare a compact visual introduction against a guided fictional example. Keep account creation easy to reach and returning-user sign-in direct. This is a recommendation awaiting concept approval, not an implementation contract.

## Current implementation evidence

Reviewed working tree based on `f8700fd8cc5f6def75cbfb5b9a8c565cc8a801a3`. Concurrent attribution and other work is present; findings describe code inspected, not independently verified released binaries. No existing files changed by this initiative. Did not use current-product.html as evidence or inspect the roadmap.

| Surface | Observed implementation | Implication |
|---|---|---|
| `apps/mobile-expo/src/screens/SignInScreen.tsx` | Signup requires first/last name, email, password, confirmation and legal acceptance; has check-email/resend and recovery paths. Signup guidance says to start with one real job. | Inspect field necessity and email handoff before adding more introduction screens. Changing auth requires its own approved scope. |
| `apps/mobile-expo/src/shell/AuthenticatedAppChrome.tsx` | Analytics choice resolves after a user session and legal gate; missing consent prompts. | Preserve this timing in current analytics work. Future timing is a separate decision. |
| `apps/mobile-expo/src/screens/JobsScreen.tsx` | Open-jobs empty message is “All caught up! No open jobs.”; loading, error and search-empty branches exist. | Distinguish genuinely new accounts from returning accounts with zero open jobs. Do not infer first use from this count alone. |
| `apps/mobile-expo/src/components/ds/CaptureComposerSheet.tsx` | Job commit enabled with a nonblank title and no busy operation. | Reuse low-friction capture; no new customer/business setup prerequisite. |
| `apps/mobile-expo/src/lib/devicePermissions.ts`, `addressLocation.ts`, `components/ds/customer/importDeviceContact.ts` | Existing explicit contacts/location permission helpers and denial handling. | Audit exact trigger points at runtime; do not add a permission bundle to startup. |

Runtime first-install, first-session, app-kill and return checks remain unperformed. No simulator chosen or modified.

## Background evidence: setup and tasks (not pre-signup flow proof)

All sources accessed 2026-11-04. These are authoritative published descriptions, **not firsthand app walkthroughs**. They do not establish current mobile screen order, skip behavior, consent timing, paywall placement, experiment variants or conversion performance. No external accounts created, terms accepted, trials activated or customer messages sent.

| Product | Verified published evidence | Evidence limit | Implication to test |
|---|---|---|---|
| Jobber | [Basic setup guide](https://help.getjobber.com/en/articles/first-steps-basic-account-set-up/), updated Oct 28, describes company details, business profile/templates, personal details, tax, team, mobile app and payments. It routes Core users to a separate guide. | Setup recommendations for Connect/Grow, not proof these are mandatory signup steps. | Separate getting useful work done from configuring a business; inspect Core as the closer solo comparator. |
| Joist | [Estimate creation](https://support.joistapp.com/en/articles/9212926-how-do-i-create-an-estimate) describes manual, AI and template entry on iOS; saving allows later editing or sending. [Website](https://www.joist.com/) advertises instant signup and a no-card trial. | Task documentation and marketing, not verified onboarding or actual signup requirements. Android article contains invoice/estimate wording inconsistencies. | A tangible document draft can show value; do not assume three entry choices are better for beginners. |
| Contractor+ | [Account setup guide](https://support.contractorplus.app/en/articles/9335688-set-up-your-contractor-plus-account) documents email verification, personal details/password, photo, acquisition question, business workspace/address/services/description, then dashboard. | Published website-based flow; mobile parity, mandatory fields and current variants unknown. | Audit setup burden. Copy information collection only where it changes a user outcome now. |
| SimplyWise Cost Estimator | [Role FAQ](https://www.simplywise.com/blog/ufaq/account-management-how-do-i-change-my-role-e-g-from-contractor-to-handyman/) states onboarding asks role for internal research and it does not alter features. [Direct invoice guide](https://www.simplywise.com/blog/ufaq/how-do-i-create-an-invoice-without-creating-an-estimate/) documents invoice creation without an estimate. | Cost Estimator, not Receipt Scanner. Complete signup, generated estimate quality, trial and permissions sequence unverified. | Avoid research-only questions as gates; preserve direct task entry when users arrive with a specific need. |

No competitor is proven best in class by this research. Their published capabilities cannot establish usability or justify copying their onboarding wholesale.

## Pre-signup research findings and limits

Additional public-web inspection on 2026-11-04:

| Product | Pre-registration evidence | Unknowns |
|---|---|---|
| Jobber | [Homepage](https://www.getjobber.com/) presents broad workflow value, product imagery and customer proof before trial CTA. Following that CTA reaches [signup](https://www.getjobber.com/sign-up/): work email/password, Google/Apple alternatives, marketing-email choice and terms disclosure. No form submitted. | Native app introduction, preference questions, mandatory/skip order, accessibility and regional/experiment variants. Marketing email choice is not evidence of analytics consent. |
| Joist | [Homepage](https://www.joist.com/) presents estimating/invoicing/payment value, product images, reviews and no-card trial messaging. Get Started resolves to [signup](https://pro.joistapp.com/signup). | Signup rendered no useful form content in text extraction. Native welcome, questions, consent and registration sequence remain unverified. |
| Contractor+ | [Public account guide](https://support.contractorplus.app/en/articles/9335688-set-up-your-contractor-plus-account) begins with signup/email/terms and describes acquisition and business questions later. [Live web entry](https://my.contractorplus.app/) had no readable page content in direct extraction; search index showed password-free sign-in and a signup link. | Native pre-account introduction and all exact required/optional behaviors. Indexed login text is weaker than live runtime observation; guide may describe older auth. |
| SimplyWise Cost Estimator | [Role FAQ](https://www.simplywise.com/blog/ufaq/account-management-how-do-i-change-my-role-e-g-from-contractor-to-handyman/) confirms an onboarding role question for internal research, with no experience change. [Suite homepage](https://www.simplywise.com/) introduces several apps. | FAQ does not locate the question before or after account creation. Native Cost Estimator value sequence, choices, demo, paywall and consent order unknown. Do not substitute Receipt Scanner or suite landing for Cost Estimator onboarding. |

These findings verify public website content and published documentation only. They do not establish firsthand native app flows or competitor effectiveness. The earlier setup/task ledger is background, not proof of pre-signup onboarding. No account creation is necessary to research the requested pre-account boundary.

## Continued native research — actual attempts and remaining access needs

Research continued 2026-11-04 rather than treating the initial gap as a completed comparison.

### Device discovery

- Read-only `xcrun simctl list devices booted` initially failed under the sandbox (CoreSimulator connection/log permission errors). The approved read-only escalation succeeded: **no iOS simulator booted**. Available iOS 26.2 and 26.5 phones/tablets are all shut down. No simulator was booted or reset and no device was selected on the owner's behalf.
- `adb devices -l` initially failed to start its local socket under the sandbox; approved escalation succeeded. One Android device is available: `emulator-5554`, model `sdk_gphone16k_arm64`.
- Read-only `adb -s emulator-5554 shell pm list packages` succeeded. **None of Jobber, Joist, Contractor+ or SimplyWise is installed**. Play Store is present. No app installation, launch, login or store account interaction was attempted. The ADB inventory command started the normal local ADB service; no emulator data/settings were changed.
- Native research therefore needs a user-selected target and authorized official-store installs, or access to an already provisioned research device. A booted emulator alone is not proof that the four apps can be inspected. Do not acquire third-party APKs to bypass this prerequisite.

### Public demonstration screening

| Product | Source inspected / result | What it establishes | Exact remaining blocker |
|---|---|---|---|
| Jobber | Opened [Jobber Mobile App Quick Start Guide](https://www.youtube.com/watch?v=MPoa6-XgDo4) in Chrome. Channel: The Bulletproof Handyman Business; page displayed “3y ago.” Opening description covers clock-in, jobs, receipts and completing visits. Opening frame checked at 0:06. | Native-use demonstration candidate, **not a verified first-launch/pre-signup recording**. Rejected as evidence of introduction sequence; no full-video claim. Other search signup candidates describe website registration. | No installed app on available Android emulator; no selected iOS target. No suitable native pre-account video verified in this pass. |
| Joist | Opened [Workyard's review](https://www.workyard.com/compare/joist-review), published Aug 13, 2024, updated Oct 12, 2026. Authors report October hands-on iOS/web testing. Their current report names an iOS branded welcome and email/password, Google/Apple sign-in; screenshot captions explicitly distinguish iOS sign-in from **web** tour/subscribe welcome. | Third-party firsthand **report**, not our firsthand walkthrough. Supports investigating a welcome plus account choices, but does not prove full pre-signup order or that the guided tour is before signup. Search excerpts returned older, conflicting descriptions; current opened article takes priority. Workyard is a competing vendor. | Native app absent; no complete current pre-account recording inspected. Reviewer account/build and pre-account sequence not reproducible from article. |
| Contractor+ | Public setup guide with step images inspected; searches for mobile signup/onboarding videos returned guide/login/pricing material rather than a verified native first-launch recording. | Guide verifies its documented website sequence only. Published mobile coachmark claim does not locate coachmarks before signup. | Native app absent and no suitable pre-account public recording found in this search pass. Do not infer no introduction exists. |
| SimplyWise Cost Estimator | Opened [official video library](https://www.youtube.com/@simplywise-estimates/videos), which displayed 395 videos; visible titles center on tasks. Opened [Overview on How to Use the Cost Estimator App](https://www.youtube.com/watch?v=WfoLdLyc-Ks), listed as 1y ago. Observed title frame at 0:03 and native “Describe Project” screen at 1:07, chapter “Creating a new project.” | Firsthand observation of a vendor's **recorded native task screen**, not firsthand pre-signup flow. Neither sampled point establishes onboarding order. Generic SimplyWise signup search results included Receipt Scanner, excluded from Cost Estimator evidence. | Cost Estimator absent on emulator; no clean-install pre-account recording verified. Role FAQ still does not say whether the question precedes account creation. |

No full native pre-signup flow is verified for any competitor yet. The exact missing prerequisite is now device provisioning/selection, rather than an unexplored generic evidence gap. Public videos and reviewer descriptions cannot fill unshown screen transitions, skip behavior or current consent order. All attempts above were read-only except routine browser navigation/playback and starting the ADB discovery service; no terms, trials, accounts or software installs were performed. Sandbox inventory failures were resolved, not automatic-review denials. Installation and device selection are **not attempted / awaiting authorization**, not denied or uncertain.

Next concrete research action: owner selects `emulator-5554` (or another device) and authorizes installing the four official-store apps solely to inspect up to registration. Store authentication or any terms acceptance remains a separate boundary if encountered. Then capture each observed screen/choice, exact version and source evidence before settling the competitor comparison.

## Authorized installation attempt — 2026-11-04

Owner approved installing Jobber, Joist, Contractor+ and SimplyWise from official stores on the Android emulator for pre-signup research. Device selection and install authorization are now resolved; the earlier pending-authorization language above describes the previous checkpoint only.

- Target: `emulator-5554` / Pixel 10, existing agent-device session `dex-android`.
- New research session open initially returned `DEVICE_IN_USE`, explicitly naming the existing session. Session discovery confirmed the same device; reused that session as suggested, without resetting/closing it.
- Opened `com.android.vending` successfully with agent-device. Interactive snapshot exposes only **Options** and **Sign in**. Google Play is signed out; no app search/install surface is available.
- Saved [Google Play sign-in evidence](evidence/android-play-store-sign-in.png).
- **Exact blocker for each of the four apps:** official-store installation cannot proceed until the owner signs Google Play into a Google account on this emulator. No credentials were provided/entered, no Google account created, no terms accepted and no trial initiated. No install was started, so no uncertain install outcome requires checking.
- Status: installation authorized but **blocked by store authentication**, not denied. No automatic-review denial occurred. No repeated app-install permission request is needed.
- Next action: owner signs Google Play in on the emulator, handling any account/terms prompts, then research resumes with the already-authorized official-store installs and pre-signup inspection. The emulator is left at Google Play's sign-in screen; no app data or device settings changed. No research session was closed because the reused session predates this task.

## Current FieldSoli pre-signup baseline

`apps/mobile-expo/app/sign-in.tsx` sends unauthenticated users to `SignInScreen`; that component initializes in `signIn` mode with “Welcome back.” Signup is another mode in the same component. No dedicated introduction is present on this inspected route. This is a code finding, not a first-install binary walkthrough. The first-job empty-state finding above is outside the proposed release.

## Concepts to compare in ChatGPT

| Concept | Experience before registration | Benefit | Risk / complexity | Position |
|---|---|---|---|---|
| A: Compact visual introduction | Welcome with real product preview; optional short feature sequence; Create account and Sign in always easy to reach. | Fast orientation without demanding answers or business data. | Can become a disposable carousel if previews repeat slogans. | Recommended first prototype and simplest release candidate. |
| B: Choose what to explore | Optional choice such as time/expenses or estimates/invoices changes the next demonstration; skip goes to overview. | Relevance when users arrive with different needs. | Adds friction and false personalization if every choice leads to identical content. | Compare against A; collect no choice solely for research. |
| C: Guided sample walkthrough | Tap through a clearly labeled fictional job and its time, expenses and document views, then register. | Shows behavior and connected value before commitment. | More accessibility, navigation and maintenance work; confusing sample data can imply real records. | Prototype as a viable alternative; read-only isolated sample, not a guest workspace. |

Candidate journey, not approved copy: welcome → optional product demonstration → registration. Sign in bypasses introduction. A user ready to register can skip demonstration. No account, real job, contacts import or business setup is needed to understand the product. Previews must match available released behavior, with sample figures labeled; no financial claims or fake personalized results.

Proposed smallest release: concept A with a concise, optional visual introduction and explicit handoff to existing registration. Keep current account requirements, legal gates and post-login analytics consent timing. Number/order of previews and exact copy require prototype review. No post-signup checklist, first-job redesign or account simplification in this release.

## Decisions for owner

| ID | Decision | Recommendation / consequence |
|---|---|---|
| D1 | Preferred concept to prototype: A compact visual introduction, B optional interest choice, or C guided sample? | A and C are the clearest comparison; A is the initial release recommendation. B is useful only if the answer changes what is shown. |
| D2 | What should the introduction emphasize first: time/expenses, estimates/invoices, or the connected job record? | Connected job record can demonstrate both; owner positioning preference is needed before exact copy/visual hierarchy. |
| D3 | Mobile only, or coordinated marketing-web introduction? | Mobile first; use website/store context as research, without expanding this release into a website rebuild. |
| D4 | Should a later prototype test earlier optional analytics consent? | Keep post-login baseline for the initial release; optionally compare a pre-signup choice after a value preview as a separate privacy-reviewed variant. Never make consent required to continue. |

The pre-signup scope is approved by the correction; the concepts and release boundary above remain proposals. Current analytics timing is an explicit constraint. No decision about activation, job creation, financial semantics, pricing or auth method is needed for this release.

## Research completion plan

1. Inspect native clean-start pre-account flows for all four competitors on a consistent platform. Record version/date/locale, acquisition entry, screen order, value claims, preview format, preference questions and their observable effect, back/skip/sign-in routes, permissions, analytics choices, paywalls and the exact account-creation boundary. Do not submit registration, accept terms or activate trials. Record unknowns when access ends.
2. Verify FieldSoli first launch, signed-out return, reinstall, app interruption, sign-in and password-reset/confirmation deep-link bypass on user-selected simulators. Existing app data must be preserved; do not reset an arbitrary simulator. No runtime changes performed yet.
3. Build ChatGPT concept prototypes after concept/positioning decisions. Compare existing design-system components with native paging/navigation and a custom sample demonstrator. Avoid adding a carousel dependency unless native/existing primitives are inadequate; assess accessibility and licensing before adopting one.
4. Prepare a formative test protocol with independent tradespeople: explain what FieldSoli does in their own words, locate a relevant capability, skip to registration, find sign-in, and recover after interruption. Compare A vs C with matched content, not different claims. Proposed five participants for qualitative findings; recruiting requires separate authorization. No external messages sent.
5. Use findings to settle exact journey/copy, local completion semantics and consent variant. Then write spec, contracts and implementation plan. Do not invent a final build plan before these consequential decisions are resolved.

## Hypotheses and measurement

| Hypothesis | Evaluation | Guardrail |
|---|---|---|
| A product preview improves comprehension before signup compared with the current sign-in-first entry. | Ask participants what the app supports and why they would register; compare against current entry. | Accurate capabilities and no unsupported earnings or time-saving claims. |
| A guided sample increases confidence enough to justify its added steps. | Compare A and C on comprehension, relevance, confidence and ability to reach signup unaided. | Easy skip; no real record creation or draft migration. |
| An optional interest choice improves relevance only when it changes the demonstration. | Compare B with the same content presented without a question; observe confusion and effort. | No personal/business details required; do not imply personalization beyond actual behavior. |
| Clear sign-in/skip routes prevent introduction from obstructing returning or ready users. | Test signed-out returning users, direct links, system Back, termination and accessibility navigation. | No forced replay, lost auth link or trapped navigation. |

Primary outcome: informed willingness to proceed, demonstrated comprehension and successful registration handoff. Registration completion is a downstream diagnostic; job activation/retention are separate workstreams, not this release's definition. Screen count or analytics opt-in rate alone cannot define success.

Analytics denominators must name their population: consented users who reach an observable step, not all installs. With current timing, optional telemetry cannot describe pre-signup abandonment. Use consented usability research; do not backfill earlier events or repurpose operational logs to circumvent declined analytics. Establish baselines before numeric targets or powered experiments. Persisting a local introduction-completion preference must be distinguished from optional behavioral analytics; define storage/reset/account semantics in the data contract.

## Permissions and privacy

Recommend asking for contacts/location/camera access only at the corresponding user action, explaining its immediate purpose and retaining a manual alternative. [Apple privacy guidance](https://developer.apple.com/design/human-interface-guidelines/privacy) supports contextual permission requests. Verify Android platform guidance when writing the platform contract. Analytics consent, legal acknowledgement and ATT are separate decisions; no legal compliance conclusion follows from this research. Earlier consent would require explicit anonymous/account identity, withdrawal, local queue, retention and cross-account isolation contracts before implementation.

## Contract applicability and readiness

This is material, cross-cutting shaping. No final product spec or executable build plan is written while the revised D1–D4 remain unresolved, as required by the feature-shaping skill.

| Artifact | Applicability | Why / planned path |
|---|---|---|
| State model | Required, pending | Pre-signup navigation, bypass, interruption and completion; `state-model.md`. |
| Data contract | Required, pending | Local introduction preferences/completion, reset behavior and consent boundaries; no guest business records; `data-contract.md`. |
| UX contract | Required, pending | Journeys, exact approved copy, accessibility, all surface states and platform behavior; `ux-contract.md`. |
| Test contract | Required, pending | Introduction, auth handoff, persistence, privacy and device proof; `test-contract.md`. |
| Product spec / build plan | Pending decisions | `spec.md` and `plan.md` after evidence and approval. |

Expected verification before merge: trace every approved rule to tests; cover new/returning/account-switch eligibility, introduction interruption/replay, skip/back/sign-in routes, auth deep-link bypass, consent withdrawal and absence of unsolicited permission prompts. Compare existing design-system components, native primitives, maintained open-source options and custom work for accessibility, quality and maintenance; reuse is the baseline, not automatic approval. Add no dependency without current licensing/cost review.

Before release: fresh-install and upgrade walkthroughs on supported iOS/Android, small/large text and screen readers, keyboard/safe-area/back behavior, offline/retry, privacy/store disclosures where changed, owner review of ChatGPT prototypes, and separate build/submission/processing/public-release gates. For meaningful shipped changes update current-product.html, run product:export and design:check, and refresh local ChatGPT visuals. No Figma sync.

Deferred: creating real jobs, post-signup activation/empty states, editable guest workspaces and migration, account-form simplification, social/passwordless auth, imports, AI onboarding, pricing changes and production experiments. Read-only fictional previews remain an in-scope concept for comparison.

## Blockers and throughput

Readiness: **Blocked**. Product direction questions pending; native pre-account competitor runtime evidence and FieldSoli runtime checks incomplete. Four official-store installs are authorized but blocked by Google Play authentication on emulator-5554. No action denied or uncertain; account creation, terms acceptance, trials and installation were not performed. Existing analytics work is unaffected.

- PM questions asked: 1 superseded question in chat; 4 revised decisions presented here.
- Completed PM-agent decision rounds: 1 scope correction; revised concept decisions pending.
- Fast PM answers used: 1 scope correction.
- Material planning decisions resolved independently: current analytics boundary preserved; source confidence labeled; no accounts/dependencies added. Previous capture-first proposal superseded.
- Consequential approved decisions reopened: 0.
- Total elapsed shaping time / active PM time / active agent investigation time: Unknown (not instrumented).
- Contract rule coverage: not yet defined; no readiness or coverage claim.
