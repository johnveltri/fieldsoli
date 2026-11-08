# Signup to first value

Status: Product choices resolved; technical readiness review pending. Not shipped.
Date: 2026-11-08
Source revision: `6282b507b4ecff1033f920516286d48f0dd655a8` plus inspected working tree.

## Proposed direction and smallest useful release

Remove repeated work before adding onboarding. First deliver email-code verification into an authenticated app session and preserve actual signup legal acceptance. Simplify registration to email, password and the existing explicit legal checkbox. Follow with the first-job copy and optional analytics timing decisions below. Retain returning-user password login and recovery. The three reported Apple Ads downloads do not establish opens, auth-screen exposure or a causal abandonment rate.

## Approved decisions

- Owner approved the priority order: remove repeated work, simplify signup/evaluate Apple, improve first-use value, review optional analytics timing.
- In this shaping chat the owner selected **Email code in the app** over an email-link flow.
- Owner selected **remove first name, last name and password confirmation from initial registration**; names remain editable later.
- Preserve actual accepted legal versions; do not suppress genuine reacceptance or store plaintext passwords.
- Existing introduction work remains separate: `../onboarding-optimization/card-content-review.md` specifies five cards with persistent Create account and Sign in, first-launch eligibility, and recovery/session precedence. This feature consumes its explicit signup entry; it does not replace its copy, assets or approval process.

## Evidence considered

| Source | Finding and consequence |
|---|---|
| Owner's production walkthrough | Signup works but crosses email/browser/app, repeats password/legal steps and gates entry on analytics. Firsthand observation; binary not independently inspected here. |
| `apps/mobile-expo/src/screens/SignInScreen.tsx:333` | Unconfirmed signup attempts password sign-in, clears password and returns to check-email before legal writes at line 366 onward. Explains lost acceptance in this code path. |
| `apps/mobile-expo/src/context/AuthContext.tsx:149` | Signup carries names but no acceptance versions. No-session signup is supported. |
| `apps/marketing/src/app/auth/confirmed/page.tsx` | Static confirmation page explicitly opens `fieldsoli://sign-in`; it does not establish an app session. |
| `apps/mobile-expo/src/lib/supabase.ts` and `app.json` | URL-session detection disabled; iOS association is webcredentials only. Secure link handoff would require additional design/configuration; chosen code flow avoids that dependency. |
| `packages/api-client/src/consent.ts` | Durable legal records require an authenticated user; unique user/document/version upserts preserve prior records. Latest-by-time resolution needs care if an older client later accepts an older version. |
| Consent migrations and `backend/supabase/tests/consent_tables_rls.test.sql` | Legal rows have server default timestamp, source, app version/platform, user ownership and account-deletion cascade. Do not grant anonymous writes to solve signup. |
| `backend/supabase/migrations/20260502120000_create_profiles.sql` | Names are nullable. Profile UI supports later editing; downstream name-dependent surfaces still need regression coverage. |
| `apps/mobile-expo/src/screens/HomeScreen.tsx:330` | Existing no-jobs surface already has Create my first job; current body includes coaching language inconsistent with the marketing voice guide. Loading/error must not be mistaken for no jobs. |
| `apps/mobile-expo/src/shell/AuthenticatedAppChrome.tsx` | Legal resolution precedes analytics resolution. Missing analytics choice prompts before main content. Job-created callback opens job detail; later prompt must not interrupt capture or editing. |
| `apps/mobile-expo/src/lib/analytics/consentSync.ts` | Missing/unavailable consent remains off; withdrawal dominates stale grants. Preserve this behavior and account isolation. |
| `backend/supabase/config.toml` | Local email confirmations currently disabled, OTP length six, expiry 3600s, resend frequency 1s. These are **not production settings** and cannot prove production verification behavior. |

No roadmap inspected. `current-product.html` was not used as current-product evidence. Existing unrelated creative/onboarding working-tree changes were left alone.

## Provider evidence

Reviewed 2026-11-08:

- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates): templates can include a code in place of the link; `verifyOtp` accepts email and token. Provider notes that link scanners may consume links. Recommendation: signup verification code, not an unsolicited migration of all existing users to passwordless login.
- [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow): exchange depends on locally retained verifier; cross-device and overlapping flows require recovery. This alternative is not selected.
- [Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple): native Apple integration preferred on native platforms; name is not in the ID token and is ordinarily provided only at first authorization. Native-only integration avoids OAuth secret-rotation obligations.
- [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [rate limits](https://supabase.com/docs/guides/auth/rate-limits): references for remaining provider review. Do not assume account merging from display names or relay emails; do not assume local email quotas match the hosted account.
- Changelog markdown initially failed in the web reader; subsequent authorized HTTPS fetch succeeded. CLI-v3 breaking change requires installed CLI command discovery before migration work. No SDK upgrade proposed.

## Remaining PM decisions

| ID | Decision | Recommendation | Consequence |
|---|---|---|---|
| D3 | Analytics timing | Home immediately with analytics off; offer a dismissible choice after first saved job, at a safe boundary after editing. Settings always available. | Removes a startup gate; less optional analytics coverage, no retroactive event capture. Exact dismissal/replay contract must be resolved. Alternative: current startup timing or Settings only. Owner approved in this chat. |
| D4 | First-job wording | Owner-approved exact copy: Heading: “Start with your first job.” Body: “Keep time, materials & expenses with the work. Add a job now and fill in details as you go.” Button: “Create my first job”. | Clarifies payoff without changing capture, business data or forcing a sample job. Owner revised and approved the exact text recorded here. |

All four product choices are settled. Do not ask for them again. D3 applies after a saved first job and at a safe return to Home; dismissal leaves analytics off.

## Agent decisions and architecture recommendation

- Keep existing password rules for this release; changing backend policy is separate from removing repeated input. Preserve password autofill/show-hide and recovery.
- Reuse existing inputs, buttons, auth storage and legal record table. Prefer one semantic native code field with paste/autofill over six inaccessible custom boxes or a new OTP SDK. No new vendor justified.
- Recommend capturing a bounded, versioned signup acceptance declaration at account creation into durable rows, server timestamped and tied to the newly created user. Initial request metadata is a declaration of a user action, **not authorization evidence**; never repeatedly trust mutable metadata to bypass the legal gate. Inspect an insert-only auth-user trigger against existing profile trigger behavior before freezing the data contract. It must ignore absent legacy payloads, reject malformed new payloads safely, preserve exact versions, never infer acceptance for legacy accounts, and never grant anonymous table writes.
- No historical backfill from account creation time, current terms, waitlist acceptance, or an assumed checkbox. Missing evidence uses genuine legal acceptance. Version changes between signup and verification still require current documents.
- OTP success must yield a provider-validated session for the intended email/account. Clear password on submission success; never persist password/code. Do not automatically retry signup on verification timeout. Reconcile session first to avoid duplicate consumption.
- Preserve old email links during rollout; do not remove the old confirmation landing or recovery route. Mixed-client email template behavior needs an explicit compatibility test and release sequence.

## Deferred

Apple sign-in implementation follows the initial email fixes; evaluation remains part of this initiative. It needs explicit account-linking/relay-email behavior, nonce/token validation, cancellation/revocation/deletion and existing-user recovery tests, native entitlement/provider review, platform scope and owner approval. No automatic merge of business records.

Guest editing, sample business data, passwordless returning-user migration, password-policy changes, forced tours, new analytics providers, pre-consent funnel tracking, pricing/entitlement changes and production experimentation are excluded. Existing pre-signup cards keep their own contracts and claim-release gates.

## Readiness and next work

**Readiness: Blocked.** Product decisions are resolved. Public legal versions now verified as 2026-11-02; provider compatibility remains a technical readiness gate; see readiness.md. These are pending, not tool denials. No product code, migrations, production settings or deployments changed.

D3/D4 are settled; draft spec and separate contracts are now recorded. `state-model.md`, `data-contract.md`, `ux-contract.md`, `test-contract.md` are all **Required**: auth is asynchronous and recoverable, consent is durable and permissioned, screens change, and proof spans database/provider/native boundaries. Draft contracts and plan are reviewable; they are not final implementation authorization while the readiness gates remain open.

Before merge: prove confirmed-email-on signup in a local/sandbox provider environment; correct/wrong/expired/replayed code, rate limiting/resend, duplicate account responses, lost response/app kill, cross-account isolation, legal version rollover and both-row atomicity, legacy clients, nullable names, optional analytics default-off/withdrawal and accessible native forms. Mocks alone are insufficient for provider and database boundaries.

Before release: verify actual hosted template/expiry/rate/SMTP limits without exposing secrets; exercise fresh install and upgrade on iOS/Android with real email delivery, native password/code autofill, screen readers/text scaling/keyboard, recovery and old-client links. Separate database, template/provider, website, native build, submission, processing and public release gates; obtain required production authorization. Update current-product.html only when shipped behavior changes; run product:export/design:check and refresh ChatGPT visual assets. No Figma work.

No new paid dependency selected. Expected email workload remains one confirmation plus user-requested resends per signup, with bounded attempts. Hosted provider/tier/free quota and upgrade trigger remain unverified; inspect before freezing deployment readiness, do not purchase or change tiers. Local Mailpit is the no-cost integration-test path; production SMTP deliverability cannot be replaced by Mailpit evidence.

## Shaping throughput

- PM questions asked: 4; decision rounds: 2 (both answered).
- Fast PM answers used instead of agent research: 4.
- Material independent decisions: 4 (preserve password policy, reuse native/design-system controls, no historical consent backfill, preserve legacy link/recovery path).
- Consequential approved decisions reopened: 0.
- Elapsed shaping, active PM and active agent time: Unknown; not instrumented.
- Final contract coverage: not yet assessed; no readiness claim from document completeness.

## Follow-up verification

Read-only public HTTPS fetch verified both published legal dates/versions match local 2026-11-02 constants. Existing confirmation.html has only a link, no code. Lockfile resolves supabase-js 2.103.0; installed auth-js documents email verifyOtp. No live provider configuration tool is exposed by the connected Supabase tool catalog; hosted template/limits/SMTP configuration still needs a read-only management/browser inspection or a supplied sanitized export. No approval rejection occurred.

## Subsequent owner revision

Owner instructed: “fix the issue with restarting the app stranding signup. Let's leave the blocking modal before home for consient. fix p2.” This explicitly supersedes D3's post-job invitation; retain the current consent modal before Home. Restart recovery and neutral delivery/recovery copy are authorized fixes.
