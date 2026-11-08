# Pre-signup introduction decision packet

> Current owner direction, November 8: the carousel is the default signed-out landing screen. Sign in and Create account open explicit input forms; Back returns to the carousel. This supersedes the earlier first-launch-only/suppression/replay plan below. Pending verification, auth/recovery links and valid sessions bypass the carousel. Working implementation is in AuthWelcome.tsx / SignInScreen.tsx; native visual review and target-release capability claims remain release gates. Existing earlier planning remains historical.


Historical packet status: Shaping at the time of writing; implementation was subsequently approved by the owner (see current direction above). User-facing date: November 4, 2026 (America/Chicago). Source revision inspected: f8700fd8cc5f6def75cbfb5b9a8c565cc8a801a3 plus concurrent working-tree changes.

## Proposed direction and smallest release

Introduce FieldSoli before registration through 3–5 optional swipeable cards, referencing the selected App Store portrait campaign. Create account and Sign in remain available on every card; Next/Back also support browsing. Ship on native iOS and Android. This is a material auth-entry UX change with a small local persistence boundary, not a redesign of onboarding after signup.

Why now: let prospective users understand the product before committing to an account, with continuity from the store listing. Comprehension is the desired outcome; conversion improvement is a hypothesis, not an acceptance promise.

## Approved decisions

- Swipeable 3–5-card format, covering value, purpose and basic flow.
- App Store images are the visual reference, not necessarily verbatim full-screen bitmaps.
- Users never need to finish or swipe through cards to register/sign in.
- Analytics consent remains post-login; no pre-consent capture or backfill.
- Competitor-specific screen collection canceled; no emulator prerequisite.
- Planning only. No app implementation or external actions.

## Proposed release boundary

Included: card content and local artwork adapted from the canonical portrait campaign; accessible native headings/body/buttons; horizontal paging plus Next/Back, page count, persistent account actions; direct signup-mode handoff; auth/recovery/deep-link bypass; local dismissal/eligibility; interruption, asset/storage failure behavior; optional replay if approved; ChatGPT visual review and mobile evidence.

Excluded: real job creation, post-login checklists/activation, guest workspaces, business questionnaires, account-form/auth-method changes, permission prompts, earlier analytics consent, new tracking SDK/events, pricing or capability entitlement changes, website/store redesign, competitor installs and production A/B testing.

No backend schema or API, new provider, paid service or financial lifecycle change proposed. The introduction must describe the target build accurately and cannot expose hidden capabilities through a marketing claim.

## Evidence considered

- `app/sign-in.tsx` renders `SignInScreen` only after auth restoration; the component defaults to sign-in. Signup handoff needs an explicit supported mode entry without remounting away an active form.
- `SignInScreen.tsx` already handles initial/live auth URLs and recovery modes. Intro routing must not swallow those paths.
- `src/lib/authStorage.ts` has persisted auth with legacy migration; session absence alone does not identify a new user. There is no verified existing install-history marker in this evidence pass.
- Existing AsyncStorage, design tokens/buttons, safe-area, gesture and animation dependencies provide a baseline; no pager dependency found/needed for a fixed small set.
- `useInvoicingFlag.ts` exists; an invoice preview in selected store artwork does not establish universal capability availability. Release-specific claims need verification.
- Canonical portrait images: `docs/app-store/release-1.2/final-images/01-unlimited-invoices-estimates.png` through `05-job-earnings-insights.png`. Image 02 visually inspected: slate/rust backdrop, cream headline, black phone frame and actual time/material/cost UI. Its baked-in heading should become native accessible card text; avoid shrinking the entire poster beneath another device frame.
- Brand/marketing voice guides and prior research packet reviewed. `current-product.html` freshness remains uncertain; not used as shipped truth. No roadmap access.

## PM decisions requested

| ID | Question | Recommendation | Consequence |
|---|---|---|---|
| D1 | Five store themes or four-card purpose/capture/organize/review story? | Five store themes, with accurate build-specific claims. | Determines card count/content and which release capabilities must be verified. App Store reference alone did not approve its exact narrative/copy. |
| D2 | Automatic first show: new installations only, or all signed-out installations once after update? | New installations only; never interrupt existing users. | Strict new-install detection may need a prior migration marker or platform install/update evidence. If unavailable, choose explicit replay-only for uncertain existing installs rather than silently calling them new. |
| D3 | Reopen after dismissal? | “About FieldSoli” on sign-in, opens card 1. | Adds one signed-out entry; no account-settings navigation change needed. |

D1–D3 resolved by owner: five App Store themes; first launch only without interrupting existing users; replay from sign-in. These are approved requirements, not pending questions. Exact proposed copy is in card-content-review.md.

## Agent-decided implementation assumptions

- Fixed bundled content, no remote content management or dynamic personalization.
- Prefer existing design-system controls and React Native scrolling/paging primitives; compare platform screen-reader behavior before selecting the pager. Existing gesture/reanimated tools available. Reputable external pager is a fallback only if native quality is inadequate, with license/version review before adoption. Custom gesture engine or third-party onboarding SDK adds unjustified maintenance/cost.
- Do not collect user-specific content. One device-local intro preference, independent from account/consent/business data, suffices in principle; exact shape follows eligibility decision.
- Authenticated and recovery/deep-link entry always bypass; storage/asset failures never trap account access. No permission request belongs in these cards.
- Retain existing product-context files until shipment; after meaningful shipped UI change update current-product.html, product:export, design:check and local ChatGPT visuals. No Figma.

## Known risks / rules to settle in contracts

- Eligibility on an upgraded signed-out installation; “no intro flag” is not proof of fresh installation.
- Background/termination: recommend no disk writes on every swipe; retain index in memory, reopen at card 1 until explicitly dismissed; dismissal persists. This replaces earlier draft suggestion of persisted last page if approved in contracts.
- Dismissal write failure: allow auth navigation immediately, retain session-memory suppression; next launch may re-show according to eligibility. No endless loading or retries blocking auth.
- Auth action from any card: enter intended mode, preserve form state when returning and do not automatically submit; reset/confirmation URL takes precedence over introduction.
- Invoicing/export/unlimited claims require target-build proof; do not remove/change a chosen theme silently when verification conflicts—surface the release dependency.
- Static sample artwork is decorative evidence, not interactive business UI; native text supplies accessible meaning. Test large text, reduced motion, screen reader page/focus behavior and constrained layouts.

## Contract applicability

| Artifact | Status | Rationale |
|---|---|---|
| spec.md | Required after decisions | Scope/requirements/approved wording and traceability. |
| state-model.md | Required, pending | Eligibility, browsing, bypass, dismissal, replay, interrupted/auth return. |
| data-contract.md | Required, pending | Local preference/migration/failure semantics and privacy boundary. |
| ux-contract.md | Required, pending | Exact cards/copy, account/paging controls, responsive/accessibility/surface states. |
| test-contract.md | Required, pending | Routing/persistence/privacy layers plus native device and visual proof. |
| plan.md | Required after contracts stable | Concrete file changes/order and independent release gates. |

## Expected verification

Before merge: requirement-to-test map, eligibility/dismissal/storage failure, signup/sign-in modes and preserved form, initial/live recovery URLs, signed-in bypass, no optional events queued/captured, no business writes, bundled-asset failure and page control tests. Test user-observable behavior rather than mirroring implementation.

Before release: supported iOS/Android fresh install and upgrade/signed-out cases, screen readers/large text/reduced motion, small phones/tablets/rotation/system Back/safe area, offline auth handoff, accurate claims against candidate build and owner ChatGPT visual/copy review. Separate mobile build, store submission, processing and public-release checks. No new provider/quota/cost surface expected.

## Readiness and throughput

Readiness: Blocked on final card copy/visual approval and release capability verification; D1–D3 are resolved. No final spec/contracts/plan generated while those product decisions remain open, per the feature-shaping skill.

This scoping pass: 3 PM questions asked, 1 completed answer round, 3 fast PM answers received, 5 implementation assumptions resolved above, 0 approved consequential decisions reopened. Time/active effort: Unknown (not instrumented). Rule coverage: not yet defined, not claimed. Prior research history remains in research-and-decisions.md and competitor-research-archive.md; this packet owns the current scope decision inventory. Where proposals conflict, resolve during approval rather than inferring an implementation rule.

## Approved scope clarification after owner answers

Five cards in store campaign order: invoices/estimates, time/expenses, simplicity, export, earnings. Native iOS/Android. Automatic display only on the first eligible launch of a new installation; upgrades and signed-in/recovery entries bypass. Replay from sign-in begins at card 1 without resetting dismissal. Create account and Sign in remain persistent. No full poster text embedded as the sole accessible content.

First launch means one automatic presentation attempt, not replay until all cards are completed. Persist suppression when the auto presentation is claimed; process-memory suppression prevents duplicate presentation during storage failure. On an unreadable preference, ambiguous install history, restored data or missing native install evidence, default to auth with replay available. No writes on every swipe. Backgrounding retains current page in memory; relaunch after an automatic presentation goes to auth. This honors first-launch-only rather than the earlier unfinished-intro replay proposal.

Technical evidence: Expo SDK 57 [Application API](https://docs.expo.dev/versions/v57.0.0/sdk/application/) exposes installation time excluding updates (Android firstInstallTime; iOS document-root creation time). A conservative fixed release cutoff plus local intro marker can exclude older installations. This is not proof of lifetime person/account history; reinstall can have a new install date. Never promise to detect an existing person with erased local history. Native method/restore behavior must be proven in upgrade tests; uncertainty bypasses.

expo-application is not currently in the lockfile. Before adding it, compare a narrow local native install-info module with the SDK-matched official package. Prefer official package if license and SDK compatibility are verified; no hosted service, identifiers, network request, quota or paid tier is needed. Do not read Android ID or vendor ID. This is an implementation dependency decision, not a request to install software now.
