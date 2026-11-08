# Signup to first value

Status: Draft contracts; product choices approved; technical readiness blocked.
Last updated: 2026-11-08
Feature source: Owner's production signup walkthrough and approved four decisions in decision-packet.md.

## Outcome and scope

A new user registers with email/password and legal acceptance, confirms an email code in FieldSoli, and reaches useful job creation without password reentry, duplicate acceptance and then resolves the existing optional analytics choice before Home. iOS and Android; preserve existing login/recovery and the separate pre-signup introduction initiative.

Smallest useful release: durable acceptance plus email-code verification. Follow in dependency order with simpler fields, first-job copy while retaining consent before Home. All are part of this approved initiative; Apple implementation remains a later slice.

| ID | Product requirement | Acceptance evidence |
|---|---|---|
| REQ-01 | Explicit Create account entry uses email, password and legal checkbox; names and confirmation are absent. Existing password rules and sign-in/recovery remain. | TEST-01 |
| REQ-02 | In-app email code establishes the correct provider session without browser or password repetition on the primary path. | TEST-02,03,09 |
| REQ-03 | Preserve actual signup acceptance of exact document versions durably, without fabricating prior acceptance or hiding real updates. | TEST-04,05 |
| REQ-04 | Use owner-approved Home copy and existing first-job capture; no automatic sample job or forced business setup. | TEST-06 |
| REQ-05 | Retain the existing blocking analytics choice before Home. Analytics stays off without explicit consent; Settings remains available. | TEST-07,08 |
| REQ-06 | Preserve old clients, existing accounts, intro/session/recovery precedence, privacy and accessibility. | TEST-01,03,05,08,09,10 |

## Artifact manifest

| Artifact | Applicability | Rationale |
|---|---|---|
| state-model.md | Required | Async verification, interruption and consent timing. |
| data-contract.md | Required | Account/acceptance records and account-scoped local prompt state. |
| ux-contract.md | Required | Signup, verification, Home and choice interactions change. |
| test-contract.md | Required | Provider, database and native boundaries require distinct proof. |

## Approved decisions and agent assumptions

Four product choices and exact copy are in decision-packet.md and ux-contract.md. Agent assumptions: preserve password policy; use native semantic input and existing design-system controls; keep old links; store no credentials outside existing secure session storage. Owner subsequently directed that the existing blocking consent modal remain before Home; post-job consent timing is superseded. Pending code entry restores for up to 24 hours; successful authentication or explicit cancellation clears the navigation hint. Ambiguous signup/resend responses use conditional delivery language and provide sign-in/reset recovery.

Non-goals: guest data, passwordless migration, new providers, entitlement changes, new financial lifecycle, pre-consent tracking, new marketing claims. Deferred: Apple implementation and secure linking contract; independent introduction assets/approval remain owned by onboarding-optimization.

Open blocker: signup-OTP/template compatibility evidence in readiness.md. Current published legal versions have been verified. No production or implementation authorization inferred from this draft.
