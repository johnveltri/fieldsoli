# Address proximity test contract

| Test | Owning rules | Required proof |
| --- | --- | --- |
| TEST-01 | REQ-01, DATA-01/02 | API and provider tests: optional point, rounding, invalid/boundary/zero coordinates, longitude-first bias, legacy request and unchanged response |
| TEST-02 | REQ-02, STATE-01/03, UX-01/02 | Mobile service/hook: ask on empty focus once, denial/blocked/expired permission, no repeated prompt, no fix after denial |
| TEST-03 | REQ-03, STATE-02/04/08 | Mobile: device wins; fallback/null; services disabled, timeout, rejected and late fix, blur/query staleness |
| TEST-04 | DATA-03/04/07 | Server/client: resolver has no caller address/user, confidence and ambiguity, invalid/missing response, bounded timeout, existing budget contract; hosted authentication/RLS checks |
| TEST-05 | REQ-05, STATE-06/07, DATA-05/06 | Mobile: TTLs, deduplication, background/inactive/foreground, account switch, sign-out, explicit invalidation and ignored old-generation response; inspect safe logging |
| TEST-06 | REQ-04, STATE-05, UX-04/05 | Privacy Choices component/service: matching switches, metadata-only reads, first native request, later Settings, OS-controlled state and foreground refresh, limited Contacts shown on, per-permission failure isolation; native accessibility and text scaling |
| TEST-07 | REQ-06, UX-06 | Current legal constants match policy; prior version requires normal reacceptance; new signup/waitlist uses current privacy and unchanged Terms |
| TEST-08 | REQ-01/02/03, UX-03 | Hosted Dev real provider plus iOS/Android native builds: all address entry points, draft/keyboard continuity, approximate grant/denial, fallback, Settings recovery |

Use fictional addresses and designated QA accounts. Native tests require an explicitly selected simulator/emulator and a build from this checkout with the new module/config. A different installed build or mocked test cannot prove native permission behavior. Provider verification must not persist synthetic edits over an existing business address.

Before merge: automated tests, typechecking, native config inspection, product export/check. Before native release: hosted Dev provider/authentication/RLS evidence, both platform native checks, deployed public privacy version and store disclosures, backward-compatible function deployment to the release environment. Record unavailable gates as not run or blocked, never pass.
