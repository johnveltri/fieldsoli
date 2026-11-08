# Build plan — draft, blocked on readiness gates

Basis: spec.md and all four contracts. Source revision/evidence: decision-packet.md. Do not start product implementation until readiness gates resolve and owner approves implementation per shaping skill.

| Step | Files/systems | Rules and verification |
|---|---|---|
| 1 | Read-only published legal source/version check, provider template/OTP/SMTP settings, existing auth hook inventory | B1/B2 in readiness.md; freeze DATA-03 version allowlist and UX-07 code length. No live mutation. |
| 2 | New additive Supabase migration/private signup trigger, consent API lookup/tests and legal-version fixtures | REQ-03; DATA-02–04; STATE-04; TEST-04,05. Generate migration with supported CLI workflow; local DB first. Preserve profile trigger and permissions. |
| 3 | AuthContext.tsx, SignInScreen.tsx, secure pending-verification helper, compatible confirmation template artifact, existing auth URLs/recovery tests | REQ-01,02,06; STATE-01–03; DATA-01,05,08; UX-01–04; TEST-01–03,09. Stop immediate password-signin probe for successful unconfirmed signup; classify outcomes without enumeration. |
| 4 | HomeScreen.tsx and tests, shared intro signup-entry integration | REQ-04,06; STATE-05; UX-05,07; TEST-01,06,10. Preserve approved five-card planning separately. |
| 5 | AuthenticatedAppChrome.tsx, AnalyticsConsentPromptModal.tsx or extracted disclosure/card, consentSync/storage and tests | REQ-05,06; STATE-05,06; DATA-06,07; UX-06; TEST-07,08,10. Owner superseded consent relocation: preserve existing pre-Home modal and consent behavior. No invitation marker or analytics SDK/provider change. |
| 6 | Native QA evidence, provider/migration results, local ChatGPT visuals | All requirements; TEST-01–10. Fix discrepancies before merge/release. |

Migration: no historical acceptance backfill. Add trigger first, supporting missing legacy payload; preserve server timestamp and existing unique constraint. Ensure all-or-nothing two-row insert and signup transaction. Exact required-version membership prevents newer records from being masked by older client acceptances. Test rollback in local snapshot; durable acceptance records survive code rollback. No destructive reset of production.

Release sequence: (1) resolve B1/B2 and obtain required migration/provider approval; (2) deploy additive DB hook; (3) publish backward-compatible email template/code+legacy-link and any legal version resources; (4) independently verify website/recovery; (5) native build and device QA; (6) submission; (7) processing; (8) public release. Provider/browser compatibility must be proven before each affected gate. No template-only change that strands installed clients. Rollback keeps both old/new confirmation entry paths and existing acceptance rows.

No paid dependency added. Real hosted limits and cost thresholds recorded at step 1; maintain existing provider/tier absent explicit approval. Reuse native inputs and existing design-system components; no new OTP library.

Closeout when shipped: update docs/product/current-product.html to actual behavior, run npm run product:export and npm run design:check, refresh local ChatGPT visuals, reconcile this approved feature with separate introduction work without overwriting concurrent artifacts. Do not update shipped documentation to imply draft behavior is live.
