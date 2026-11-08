# Current review status — 2026-11-08

Implementation is ready for PR review, not production release. The latest owner decisions and implemented behavior supersede the historical progress entries below: analytics consent remains before Home; verification continuation appears only for the matching known pending signup; the default signed-out screen is the five-card carousel. The owner reported successful hosted-Dev signup reaching the dashboard. Production has not been changed.

Release gates: deploy the migration before the new client; verify both conditional confirmation-template branches with the actual provider and old/new clients; exercise real native restart, email expiry/resend and recovery; review accessibility and artwork/capability claims on the target release. No merge or deployment is included in this PR request.

# Readiness review

**Readiness: Blocked.** Four owner product decisions resolved. Implementation is in progress; the mobile form, email template and additive migration are drafted. Nothing has been deployed or applied to the local database outside rollback-only test transactions.

## Remaining technical gates

- **B1 — resolved for current published version.** On 2026-11-08 an authorized read-only HTTPS fetch of https://fieldsoli.com/privacy and /terms returned effective date November 2, 2026 and version 2026-11-02 for both, matching local constants. The stale rollout note is not a reason to request approval again. Freeze these exact current versions for the initial trigger allowlist. Before a future version change, preserve version-addressable published content and coordinate app requirements; this is a release compatibility obligation.
- **B2 — provider compatibility/cost envelope.** Local confirmations are OFF; production settings/template/SMTP tier, OTP length/expiry and installed SDK signup-code behavior were not inspected live or exercised. Confirm these read-only and run an authorized disposable local/sandbox signup-code integration proof before claiming technical readiness. No provider setting change or test production account creation is authorized here. Supabase changelog fetched successfully through read-only HTTPS after the web reader rejected markdown. Relevant CLI-v3 change means discover installed CLI commands before migration work; no installed SDK upgrade is proposed. Installed lockfile resolves supabase-js 2.103.0 and its auth-js source documents verifyOtp(email, token, type=email), but source support does not substitute for provider proof.

These are pending investigations, not automatic-review denials or execution uncertainty. All remaining product intent is settled. The shaping skill requires separate implementation request after readiness approval; this is not an implementation task completion claim.

## Cross-artifact pass

- Product coverage: 6/6 requirements mapped to TEST scenarios and plan steps.
- State coverage: 6/6 groups mapped.
- Data coverage: 8/8 groups mapped.
- UX coverage: 7/7 groups mapped.
- Test scenarios: 10/10 with layer/environment/evidence specified; none executed in this shaping pass.
- No missing applicable contract. Current-version allowlist is 2026-11-02 for both documents; provider code length/template cannot be finalized until B2.
- No added business lifecycle, pricing, or intro-card behavior. Analytics consent timing explicitly changes earlier post-login gating by current owner instruction, while preserving consent semantics.

## Deferred and gates

Apple implementation/account linking remains deferred after evaluation in decision-packet.md; dedicated native nonce/relay/account-linking contract required before implementation. Guest mode, password-policy changes and passwordless-login migration excluded. Intro cards remain independently approved but unshipped planning work.

Before merge: planned automated tests and real local Auth/Postgres evidence. Before public release: real sandbox email/native fresh-install/upgrade/accessibility evidence, production configuration review, product-context exports/design checks and distinct deployment/submission/processing/release approvals. See test-contract.md and plan.md.

## Throughput

PM questions: 4. PM-agent decision rounds: 2. Fast owner answers used instead of inference: 4. Material independent decisions: 4 (see packet). Consequential decisions reopened: 0. Elapsed/active PM/active agent time: Unknown, not instrumented.

Artifacts: decision-packet.md, spec.md, state-model.md, data-contract.md, ux-contract.md, test-contract.md, plan.md, readiness.md in docs/specs/signup-to-first-value/. All four supporting contracts Required.


## Implementation progress — 2026-11-08

Home copy and simplified signup/code UI are drafted; signup attaches the explicit legal declaration and a migration records it. Focused mobile Home and SignIn suites passed (31 tests); mobile TypeScript check passed. A rollback-only local PostgreSQL test verified two acceptance rows, legacy no-payload behavior, invalid-version rejection and metadata-update isolation. These do not prove the full DB/RLS contract. Local auth is currently configured for automatic email confirmation; the confirmation-on provider integration is still outstanding. The confirmation template now conditionally sends the code for the new client and the legacy link otherwise; both branches need real provider rendering and old/new-client tests.

Previously outstanding (recovery now implemented; see follow-up below): safe timeout/session reconciliation, legal lookup behavior for older client writes, post-first-job analytics (subsequently cancelled by owner), full error/accessibility handling, end-to-end email/provider tests, native visual review and release gates. The changes are work in progress and must not be merged or released as complete. User authorized implementation but did not authorize deployment.

Read-only production dashboard inspection: email confirmation enabled; email OTP length 8 digits, expiry 3600 seconds; per-user email minimum interval 60 seconds; token verification and sign-in/signup limits each 30 requests per five minutes per IP. Hosted email-per-hour value was redacted in the UI; actual template, SMTP quota, and confirmation-on integration remain unverified. Local OTP length is six; the code field must not hardcode either length. No production setting was changed.

## Follow-up: restart recovery and ambiguous signup responses

Owner retained the existing consent modal before Home and cancelled the post-job invitation. Pending verification now stores normalized email and creation time only, expires after 24h, restores on signed-out restart, and clears on authentication or cancellation/email change. Unconfirmed sign-in routes to code entry; manual code entry is available from sign-in for valid emails even without storage. Initial/live auth links and active input take precedence over restoration. Signup/resend copy is conditional about delivery, with sign-in/reset routes rather than claiming an email was sent for obfuscated signup success. New tests cover actual component unmount/remount, state expiry/corruption/storage failures, session cleanup, recovery options and initial-link/input races. Provider rendering and native fresh-install/upgrade QA remain release gates. No production changes made.

Follow-up validation: 55 tests passed across pendingSignup, SignInScreen, AuthContext, HomeScreen and App.legal-gate; mobile TypeScript and git diff --check passed. This includes component unmount/remount and storage-failure recovery; it is not a native force-quit/email delivery test.

## Dev migration applied — 2026-11-08

At the owner's explicit request, applied only signup_legal_acceptance to FieldSoli (Dev), project anypejjoovlatmrkrxvx. Supabase recorded migration version 20261108201807; the local migration filename was aligned to that version. Read-only verification confirmed the enabled auth.users INSERT trigger, private security-definer function with empty search_path, and no direct EXECUTE permission for anon/authenticated. Production was not contacted for mutation. This action did not deploy the confirmation email template or change confirmation/SMTP settings. Runtime signup/email verification remains a separate test.

## Owner happy-path result and verification UI simplification

Owner reported a successful happy-path signup reaching the dashboard, with a dashboard screenshot showing the approved first-job copy. This is owner-reported device evidence, not independent agent verification of every intermediate step. Owner requested only Verify email (primary, disabled with empty code), Resend email (secondary), and the standard upper-left Back on verification. Implemented that hierarchy, shortened copy to “Enter the verification code for {email}.”, and retained recovery/email editing through Back to sign-in. Consent remains before Home.

## Signed-out carousel preview

Integrated the transferred onboarding assets into AuthWelcome.tsx. The signed-out landing now uses five swipeable cards, accessible headings/body/page status, explicit paging controls and persistent Create account / Sign in actions. Forms retain their state on Back; pending verification and auth links bypass the carousel. No install-time native dependency, first-launch marker, new provider or introductory analytics event was added. Source hashes of cards 02–05 verified against native manifest. First card remains the selected generated invoice artwork; remaining cards use actual screenshot cutouts. The native layout, assistive technology and invoice/export/unlimited claims still need owner/release verification; no deployment or public-release claim is made.

Sign-in refinement: removed the full-width verification action that appeared for any syntactically valid email. Only a matching known pending signup gets a small Continue email verification link; unconfirmed password sign-in still restores code entry if local state is missing/expired/unavailable.

## PR validation — 2026-11-08

Focused mobile suites passed: 59 tests across AuthWelcome, SignInScreen, pendingSignup, AuthContext and HomeScreen. Mobile TypeScript, API consent/analytics-consent tests (8), the rollback-only local migration regression, product export, design checks and whitespace checks passed. The legal-gate suite is recorded separately in the PR validation. These checks do not replace the provider/native release gates above.

Resend follow-up: successful resend starts a 60-second local cooldown. A rate-limited response uses the seconds in the provider message when available, otherwise a 60-second retry delay with explicit notice that broader email limits may require longer. Countdown uses wall-clock time, disables only resend, and leaves code verification available.

Resend success copy clarified to “Check your inbox for a verification code.” This directs the next action without claiming delivery or exposing account status; the code-entry screen no longer mentions legacy confirmation links.

## P2 compatibility corrections

Signup metadata describes the account, not the client requesting a resend. Confirmation emails therefore retain the confirmation-link CTA and fallback URL in both metadata branches; only the code section is conditional. This supersedes earlier code-only email notes. Explicit user_already_exists / User already registered errors return to sign-in, preserve the normalized email, and clear pending verification. Ambiguous no-session signup still supports code entry with visible inline Sign in / reset your password actions. Existing recovery guidance behind Back alone was insufficient.

Regression checks cover both email-template branches and ambiguous/explicit registration responses. The template test evaluates the current conditional branches locally; actual hosted Go rendering and old/new-client token consumption still require provider integration QA. No hosted templates or settings changed in this correction.
