# Privacy Choices — Device permissions design QA

final result: passed

## Comparison target and evidence

- Scope: the user's requested refinement of the existing native Privacy Choices screen. Preserve the supplied Analytics switch, card, type, and spacing; replace Location with Device permissions and use matching switches for Address suggestions and Contacts. This is an existing app change, not a new web prototype.
- Source visual: `docs/qa/2026-10-24-address-proximity/privacy-choices-switch-reference.png`, copied from the user's supplied attachment (646 × 712 pixels, cropped app content).
- Native implementation: `docs/product/chatgpt/address-location-privacy-choices.png` (1206 × 2622 pixels). Selected target: iPhone 17 Pro, iOS 26.2; native viewport 402 × 874 points at 3× density. Same local Debug build and hosted Dev account as the address-proximity QA report; updated JavaScript loaded through Metro.
- State: Analytics off, location off, Contacts off. Contacts was explicitly denied in the first native permission prompt; no contacts were read. The source also shows Analytics and location off.
- Density/crop normalization: the source is already cropped and resized by the user. Resize the implementation to 666 pixels wide, then crop `(10, 81, 656, 931)` to match the source's approximately 600-pixel card width and app-content origin. This yields a 646 × 850 region, taller than the source because the requested Contacts row is new. Exact full-screen source viewport is unavailable, so do not infer pixel-level screen-chrome differences.
- Combined comparison: `docs/qa/2026-10-24-address-proximity/privacy-choices-switch-comparison.png` (source left; implementation right). Opened together in one comparison image. The focused controls are readable in this same comparison; a separate magnification was unnecessary. Also reviewed the complete native screenshot to check Legal and Delete Account remain reachable without clipping.

## Findings

- Accepted platform limitation: Contacts can reopen the previously visited Location subpage. Reproduced after the user report: enter Location from FieldSoli Settings, return directly to FieldSoli, then tap Contacts. iOS resumes Location despite receiving the generic app-settings URL. Evidence: `docs/qa/2026-10-24-address-proximity/contacts-reopens-location.png`. On October 24 the user explicitly chose to retain separate switches and accept iOS's navigation behavior, superseding the proposed shared action. Do not claim individual permission targeting or a guaranteed Settings root page.

There are no remaining actionable P0/P1/P2 findings within this scoped design review. The accepted navigation limitation remains documented; this pass does not claim broader release verification.

- Fonts and typography: existing display heading, section typography, and bold row labels match the supplied source. Device permissions fits on one line at the tested text size; row labels remain aligned.
- Spacing and layout rhythm: existing Analytics card geometry and section gaps are preserved. The device card adds one row with the established separator and row height. All three switch tracks align on the right. Additional vertical height is the requested Contacts row.
- Colors and tokens: existing warm canvas, white card, subtle borders, and native gray off switches are consistent. Granted states use the same shared accent track as Analytics (component behavior; no runtime grant claimed in this follow-up).
- Image quality and assets: no new imagery or generated assets. Existing back control and native switches remain sharp; screenshot normalization is for comparison only, not rendered UI.
- Copy and content: Device permissions replaces Location; Address suggestions is retained, Contacts is added, and both permission rows have no subtitle, badge or chevron. Accessibility hints explain the first native prompt and subsequent Settings route; limited Contacts access is announced.

## Interaction verification

- Native: first Contacts tap → system prompt; Don't Allow → off switch; later Contacts tap → FieldSoli Settings with Contacts/Location controls; return → both switches remain off. Location tap → the same app-specific page, without repeating its native prompt. Opening Privacy Choices itself did not prompt.
- Platform constraint: iOS exposes app-specific Settings, not supported links directly to the individual Location/Contacts subpages. Before the first request, iOS omits that permission's control from app Settings; the approved first native request resolves that dead end.
- Follow-up reproduction: leaving Settings inside Location and later tapping Contacts resumes Location. There is no documented public Settings API option to select Contacts or reset this internal navigation stack. A successful URL open does not prove the desired destination. Permission values still refreshed correctly; this reproduction did not change permissions or consent.
- Automated: 3 focused suites / 22 tests passed, including allowed/limited states, non-optimistic values, permission refresh, failure isolation, first native prompt, later Settings, and existing address-location lifetimes. Typechecking passed.
- Not claimed: Android runtime, full VoiceOver/TalkBack session, larger accessibility text sizes, or a newly granted native Contacts state. These remain release coverage.

## Comparison history and checklist

- The supplied source intentionally had an Off badge and chevron for location; those are replaced per the user's request, not treated as visual drift.
- Runtime discovery found Settings had no Contacts control before its first native request. The user approved a first native prompt followed by Settings on later taps. Implemented and verified that path before the final comparison.
- Final comparison found no visual fixes requiring another capture iteration. Product documentation and the local ChatGPT screenshot/reference were updated; product export, design checks, and `git diff --check` passed.
- Reopened after the user found the retained-Settings-subpage case. After considering a shared management action, the user explicitly chose to keep separate switches and accept the iOS link limitation. No shared action or additional guidance was implemented. The documented product decision closes this design finding without changing or concealing the reproduced platform behavior.
