# Address proximity QA

Date: October 24, 2026
Build: local native Debug build from `codex/proximity-address-suggestions`
Environment: hosted FieldSoli Dev (`anypejjoovlatmrkrxvx`)
Device: iPhone 17 Pro, iOS 26.2 (`95208464-318A-445B-9AFE-942C65AD574C`)
Account: existing user-signed-in Dev test account; fictional records only
Flags: local `invoicing` and `job-detail-fullscreen-edit` enabled for this QA run

## Passed

- First address-field tap showed the native foreground location prompt. The request used the approved purpose string, and the address editor remained usable.
- Approximate location worked with iOS Precise Location disabled. With the simulator set to fictional Chicago coordinates and the query `Maple Ave`, the top results were Chicago, Oak Park, and Berwyn, demonstrating device proximity bias.
- After changing app Location permission to Never, entering an address did not prompt again and autocomplete continued.
- Account → Privacy Choices now uses matching native switches for Analytics, Address suggestions, and Contacts. The last two share the Device permissions section, with no badges, chevrons or row subtitles. First Contacts tap showed the native permission prompt; denial left the switch off. A later Contacts tap and the already-requested location switch opened FieldSoli's app-specific Settings with Location and Contacts controls visible. Returning preserved actual OS state. Evidence: `device-permission-settings.png`, the refreshed product screenshot, and root `design-qa.md`.
- Job Edit address suggestions rendered in the full-screen editor. The edit was closed and the draft discarded; the saved job remained unchanged.
- With local test flags enabled, Account displayed Business Details and Estimates & Invoices.

## Fallback result and remaining checks

- ACCEPTED / reproduced platform limitation: after Settings was left inside Location, returning directly to FieldSoli and tapping Contacts reopened Location. Both switches use the generic app-settings URL, and iOS retains the prior subpage. The initial root-page checks did not cover this path. Evidence: `contacts-reopens-location.png`. The user explicitly chose to retain separate switches and accept this iOS limitation; root `design-qa.md` records that decision. No permissions or analytics settings were changed while reproducing this report, and no individual permission targeting is claimed.
- The signed-in account's original Springfield business address returned `null` from `resolve_business_proximity`; ordinary results (Keene, Erving, Royalston, Claremont) remained available. The contract intentionally returns null when no unique geocode meets its confidence/feature-type threshold.
- To test a qualifying result, the Dev account's business address was temporarily changed to the city-level value `Chicago, IL`. With device access set to Never, the query `Maple Ave` returned Chicago first, followed by Oak Park and Berwyn. This verifies the fallback ranking path and cache invalidation after saving. Evidence: `business-fallback-chicago.png` and the initial no-point result in `business-fallback-unresolved.png`.
- The original saved business address was restored exactly and confirmed in Business Details. No other business fields were edited. Job Edit search was discarded; the saved job still displayed its original address.
- Not exercised on this target: approximate permission expiry, location services disabled, a provider timeout, ambiguous geocodes, account switching, repeated budget exhaustion, app background/foreground cache invalidation, or a physical iPhone.
- Android runtime was not tested. Production deployment, public privacy-policy publication, and store-console disclosure submissions remain release gates.

## Data and artifacts

The Dev account's business address was temporarily changed for this fallback test and restored exactly. The Job Edit draft used for address search was discarded. No job, customer, or financial records were changed. Simulator screenshots are stored alongside this report; the Privacy Choices product visual is `docs/product/chatgpt/address-location-privacy-choices.png`.

During the initial Device permissions follow-up, Contacts changed from not requested to denied through the native prompt. No contact access was granted or contact data read. Location remained Never, and Analytics remained off at that checkpoint. The user subsequently changed location/analytics settings; reproducing the retained-subpage issue preserved those user choices. Full/limited Contacts access is covered by focused component/service tests, not a runtime grant in this follow-up.
