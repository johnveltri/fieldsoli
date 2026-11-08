# State model

Source of truth: Supabase authenticated session and durable legal rows; UI pending email is not authentication. Analytics status comes from existing consent resolver. Process states are derived, except the local pending-signup navigation hint in data-contract.md.

| ID | State / transitions | Failure and recovery |
|---|---|---|
| STATE-01 | Signed out → submitting explicit signup → awaiting code if no session; an immediate valid session goes to legal resolution. | Disable duplicate submission. Failure leaves form and inline error. Never infer success from a returned user object alone. Clear passwords on successful signup; no automatic signup retry after uncertain response. |
| STATE-02 | Awaiting code → verifying → authenticated legal resolution only on validated provider session for expected email. | Wrong/expired/reused code stays here; resend user initiated and throttled. Network uncertainty checks current session before another verification. Initial/live legacy links and recovery retain their route precedence. |
| STATE-03 | App restart → restore valid session or pending-email verification view; user can leave to sign in or edit email. | Persist only bounded pending email/time, clear on success/cancel/account change. After 24h discard pending view; sign-in/recovery available. Editing email starts an explicit new request and clears old pending identity; never patches another account. |
| STATE-04 | Authenticated → legal resolving → ready if exact required versions exist, otherwise genuine acceptance required. | Read errors use existing matching user/version cache only; otherwise Retry/sign out, not a misleading updated-terms prompt. Missing evidence and real newer versions use acceptance UI. No analytics or business shell before legal resolution. |
| STATE-05 | Legal ready → existing analytics consent resolution → blocking choice if missing → Home. | Preserve existing default-off/withdrawal/account isolation and existing unavailable-consent behavior. Owner superseded the post-first-job invitation. |
| STATE-06 | Existing consent choice → Allow analytics / No thanks → existing resolver and Home. | No post-job invitation, new marker or changed consent persistence. |

Duplicate/concurrent events: serialize signup/code calls; same-code replay must not mint an additional session. Account switch cancels pending async updates and prevents session/consent/marker leakage. A late grant must not reverse a newer withdrawal. Session renewal remains existing auth behavior; no code or password retained for renewal.
