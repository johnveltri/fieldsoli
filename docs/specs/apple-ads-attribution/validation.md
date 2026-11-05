# Validation — Apple Ads attribution

Implementation validated locally on November 3, 2026 (America/Chicago). These are source checks, not installed-production or release evidence. The original workspace remains uncommitted; selected changes are isolated in a separate review checkout.

| Check | Result |
| --- | --- |
| Analytics, consent, conditional disclosure and account-deletion client suites | PASS: 7 suites, 31 tests |
| Focused document creation, existing-invoice selection, recovery and finalization checks | PASS: 8 tests; 41 unrelated cases excluded from this focused run |
| Full existing invoicing component suite | 41 pass, 8 fail. All eight failures independently reproduced with the unchanged HEAD component and same tests. Failures concern retrying a failed copy preview and existing native-share dismissal handlers. No new attribution failure established. Temporary baseline copies removed. |
| Mobile TypeScript | PASS: `npx tsc -p apps/mobile-expo/tsconfig.json --noEmit` |
| Expo native-module autolinking | PASS: resolves `FieldSoliAppleAds` pod and `FieldSoliAppleAdsModule` |
| CocoaPods | PASS: `pod install --no-repo-update` after allowing dependency network access |
| Native Release iPhoneOS bridge | PASS: `FieldSoliAppleAds` arm64 Swift compile and target build succeeded, signing disabled |
| Product export and design validation | PASS: `npm run product:export`, `npm run design:check` |
| Diff whitespace validation | PASS: `git diff --check` |
| Live Apple attribution, production build installation, PostHog ingestion and retained-user journey | NOT RUN; requires enabled disclosures, new native release and an authorized physical-device ad-attributed install |
| Native prompt visual verification | NOT RUN; source-derived local HTML reference provided, default-off runtime UI remains unchanged |

Native build command, from `apps/mobile-expo/ios`:

```sh
xcodebuild -project Pods/Pods.xcodeproj -scheme FieldSoliAppleAds \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/fieldsoli-appleads-derived CODE_SIGNING_ALLOWED=NO build
```

The successful build explicitly compiled `modules/apple-ads-attribution/ios/FieldSoliAppleAdsModule.swift` for arm64. It was a native pod target build, **not a full app archive**, device install or App Store submission. The earlier sandboxed attempts failed on Xcode cache/service access; running the same target with host build access succeeded. No app was installed over the user's build.

The focused Jest commands used `--runInBand --forceExit`; existing test lifecycle/open-handle behavior is not claimed repaired. New attribution tests mock token and HTTP exchange; no real user or advertiser data was sent. Test cases include allowlist filtering, ineligible builds, same-account cache restore, account switching, transient retries, exhausted failures, timeout abort, negative/unknown/unsupported distinctions, late logout result suppression, withdrawal and first-time grant after decline.

## Remaining owner/release decisions

1. Approve advertising-acquisition disclosure wording and determine how prior analytics grants will be renewed or otherwise made appropriate for this purpose. Consent timing stays after authentication; moving it earlier is explicitly excluded.
2. Publish the approved disclosure/update store privacy answers through their existing release process, then set `EXPO_PUBLIC_APPLE_ADS_ATTRIBUTION_ENABLED=true` in the intended native release build environment. It is deliberately unset/default false here.
3. Build/archive/release the full app and verify a real attributed install, consent, synthetic job/invoice and later return against PostHog and Apple Ads. The two previously known physical iPhones were unavailable; neither was inspected or changed in this implementation.
4. Coordinate the existing analytics foundation follow-up for durable event delivery, full deletion-race verification, session/visit identity, duplicate screens and meaningful activation. Current fire-and-forget delivery still limits conclusions from missing events.

Existing unrelated App Store creative asset edits were left untouched. No campaign settings, spending, remote PostHog configuration, database state, effective legal policy/version, production installation or account records were changed.
