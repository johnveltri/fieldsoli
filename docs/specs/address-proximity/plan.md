# Implementation and delivery evidence

Status: implemented and deployed to hosted Dev; selected iOS simulator checks completed, including business-address fallback with a qualifying city-level result. No production/store release claimed.

## iOS binary validation correction

Apple rejected iOS 1.2.0 build 22 with ITMS-90683 because `motionUsagePermission: false` omitted `NSMotionUsageDescription` while Expo Location still linked Core Motion APIs. The config now supplies an explicit description explaining the location-services dependency and that motion/fitness data is not requested or collected. No motion APIs were added to the application. Release validation must inspect the generated native plist for this key; successful EAS upload alone does not establish Apple processing acceptance.

## PR review focus correction

Address input focus is tracked separately from retained suggestion visibility in both Customer fields and Business Details. Blur ends location resolution and ignores pending autocomplete responses while keeping completed suggestions tappable. Cache invalidation on foreground return cannot start another lookup until the input is focused again.

Automated follow-up under Node 22.13.1 passed the six focused mobile suites (55 tests), mobile TypeScript checking, product export, design validation, and diff whitespace checks. Coverage includes blur followed by background/foreground, late location responses, refocus, and suggestion selection after blur. The review also found 11 app-shell test failures that reproduced on both the original PR head and its base in the isolated review setup. No new native runtime evidence or visible layout change is claimed for this correction; existing visual references remain applicable.

## Sequence

1. Add server validation, optional proximity bias and authenticated saved-business resolver. Preserve JWT verification, user-scoped RLS, budgets and redacted errors.
2. Add Expo location config, temporary caches, shared address-hook resolution and Privacy Choices recovery. Invalidate on account/lifecycle/business-save boundaries.
3. Update privacy version and canonical policy, website constants/tests and product-context assets. Terms stays unchanged.
4. Run focused tests, typechecking and native config introspection; deploy the backward-compatible function to hosted Dev and smoke-test fictional queries.
5. Verify selected native targets. Publish the policy and store disclosures, deploy the function to production, then release rebuilt native clients through the separate release workflow.

## Store disclosure review — October 24, 2026

- Apple: transmitted device coordinates have two decimals; declare Coarse Location for App Functionality. Precise coordinates never leave the device. Treat collection as optional; do not assume an ephemeral-processing exemption because Geoapify describes request retention. Conservatively treat authenticated processing as linked to the account unless a separate substantiated de-identification review establishes otherwise. No tracking purpose.
- Google Play: Android requests coarse permission only; declare Approximate Location for App Functionality, optional, collected, encrypted in transit. Do not claim ephemeral-only processing given provider retention. Confirm the provider contract before using the service-provider exception to Google's sharing definition; default to disclosing sharing if that exception is unverified.
- Existing business addresses remain account-linked personal information. Forward geocoding and provider retention are disclosed in the policy. Store-console answers must reflect the actual release build; this code change does not submit either console form.

Sources checked: [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/), [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469), [Geoapify privacy](https://www.geoapify.com/privacy-policy/). These are implementation-specific disclosure recommendations, not evidence of a submitted store form.

## Evidence

- Branch: `codex/proximity-address-suggestions`, based on the clean detached checkout supplied for this task.
- Node 22.13.1; `npm run typecheck` passed.
- API client: 18 suites / 151 tests passed. Edge Function shared contracts: 5 suites / 20 tests passed. Marketing/legal: 11 suites / 53 tests passed.
- Focused mobile: 8 suites / 72 tests passed. Full mobile run: 74 suites / 532 tests; two failures were stale privacy-version expectations. Updated those two tests for the approved version bump; their targeted rerun passed 2 suites / 28 tests. The other 530 assertions passed in the full run.
- `npm run product:export`, `npm run design:check`, and `git diff --check` passed.
- Expo config introspection: iOS foreground purpose text matches the approved copy, reduced accuracy defaults on, no Always strings/background modes; Android coarse permission included and fine permission explicitly removed. This is configuration evidence, not Android runtime evidence.
- Hosted Dev verified as **FieldSoli (Dev)**, project `anypejjoovlatmrkrxvx`. Deployed `address-autocomplete` version **7**, active, JWT verification **true**, bundle SHA-256 `919cdc91c1e6a7f19a2910bac7fb6801e28ce93509a3ddf5ac8edc836d4f9161`. Prior version 6 was read before deployment.
- Initial authenticated Dev smoke attempt could not sign in with the skill's saved demo credentials (`invalid_credentials`). No Job/business data was changed. The user chose to sign in to an existing Dev test account on the simulator instead.
- Selected iOS target: **iPhone 17 Pro, iOS 26.2**, UDID `95208464-318A-445B-9AFE-942C65AD574C`. Native Debug build from this checkout succeeded (zero errors; one duplicate C++ library linker warning), installed `com.veltriventures.fieldsoli`, and was tested against hosted Dev using the user's signed-in test account. Expo Location 57.0.22 is included.
- Runtime PASS: the first Address field tap displayed the native foreground-location prompt. Approximate access worked with Precise Location disabled. With a fictional Chicago simulator location and query `Maple Ave`, suggestions began with Chicago, Oak Park, and Berwyn results. When access was changed to Never, address entry continued without another permission prompt.
- Runtime PASS (updated Device permissions design): Privacy Choices displays matching Analytics, Address suggestions, and Contacts switches. Address suggestions and Contacts share the Device permissions card, without subtitles, badges or chevrons. First Contacts tap showed the native permission dialog; denial kept its switch off. The next tap opened FieldSoli's app-specific Settings with both Location and Contacts controls visible. The already-requested location switch opened the same page without another prompt. Returning preserved the actual OS off states. iOS exposes no supported link to either individual permission subpage. The refreshed visual is `docs/product/chatgpt/address-location-privacy-choices.png`; the comparison and scoped design review are recorded in root `design-qa.md`.
- Follow-up validation: focused mobile permission/screen suites passed 3 suites / 22 tests, including OS-controlled switch values, first prompt versus Settings, limited Contacts, unavailable permission isolation, and location-cache invalidation. Typechecking passed. Granted/limited switch states are component-tested; this native follow-up deliberately denied Contacts and left both device permissions off.
- ACCEPTED platform limitation: the user reported, and the same simulator reproduced, Contacts reopening the previous Location subpage after returning directly to FieldSoli. Both controls use Apple's supported app-settings link; iOS retains the internal Settings navigation stack and offers no documented option to target Location/Contacts or reset that stack. On October 24 the user explicitly chose to retain separate switches and accept this behavior, superseding the shared-action proposal. Root `design-qa.md` records this accepted constraint. Evidence: `docs/qa/2026-10-24-address-proximity/contacts-reopens-location.png`. Do not claim individual permission targeting or a guaranteed Settings root page.
- Runtime PASS: checked both Allowed and Never settings states and recovery route. Tested Job Edit address search without saving the job; closed the edit flow and discarded the draft, preserving the saved Job. Account showed Business Details and Estimates & Invoices with the local test flags enabled.
- Runtime PASS: the original saved Springfield business address resolved to `null` under the service confidence/feature-type rules, so ordinary autocomplete results remained available. To exercise a qualifying fallback, the Dev test account's business address was temporarily set to the city-level value `Chicago, IL`; with device permission set to Never, `Maple Ave` returned Chicago first, followed by Oak Park and Berwyn. The original saved address was restored exactly and confirmed in Business Details. The address-only change also exercised cache invalidation after saving. Evidence: `docs/qa/2026-10-24-address-proximity/business-fallback-chicago.png` and `business-fallback-unresolved.png`.
- Runtime NOT TESTED: Android emulator/device, real-device permission flow, approximate-permission expiry, background/foreground cache invalidation, explicit location-services-off behavior, account-switch cache isolation, provider timeout behavior, ambiguous/missing business geocodes, and repeated budget exhaustion. These remain verification gates.
- Android native runtime, physical devices, store-console submissions, published website policy, production function deployment and store release are separate unrun release gates.
