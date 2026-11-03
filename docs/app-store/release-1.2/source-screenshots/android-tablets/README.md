# Android tablet captures

Captured November 2, 2026 from this worktree through Expo Go SDK 57 on Android 15. These are fresh native Android captures, rather than phone-screen adaptations. All selected captures are landscape: Nexus 7 (`emulator-5556`) at 1920 × 1200 and Pixel Tablet (`emulator-5558`) at 2560 × 1600.

The local Metro server uses port 8083 at `exp://127.0.0.1:8083` through an explicit ADB reverse for each emulator. The direct emulator host address was also checked during diagnosis. The ignored mobile environment points to FieldSoli Dev (`anypejjoovlatmrkrxvx`) and opts into `FIELDSOLI_ANDROID_TABLET_PREVIEW=true`. The dynamic config override permits rotation for local development only; EAS and release exports retain the release configuration. The existing Android native plugin already permits landscape. This preview is not evidence of a production APK test.

## Demo state

The owner explicitly approved resetting only `app-store-demo@fieldsoli.example` to the existing fictional screenshot fixture. The guarded reset verified the reserved account marker and absence of attachments, then restored 13 jobs and Carter Home Services settings. No production data, Auth identity, or password was changed. Updated dev legal terms were accepted with explicit owner authorization.

The fixture's active visit was captured and then ended through the Nexus UI. A database verification found no sessions without an end time. Edits were inspected and cancelled; no invoice or estimate was sent. Export was previewed without requesting an email.

## Preview setup

Expo Go was updated in place to SDK 57. Emulator clocks were synchronized with the Mac; automatic time was disabled because the emulators reverted to an old date and failed certificate validation. Rotation was locked to landscape (Nexus rotation 1; Pixel Tablet rotation 0). Expo's floating Tools button was hidden for clean captures. Android animation settings were restored to 1 after a temporary diagnostic change.

Capture runs were serialized after testing reduced-memory configurations. The final Pixel session uses its normal memory allocation and automatic graphics. Nexus was closed after its captures to avoid running both tablets alongside the unrelated phone emulator. Existing emulator data was preserved. Device controls and buttons in the campaign remain original pixels, scaled uniformly. Separate proof cards are explicitly recorded in the compositor's validation manifest.

## Observed limitations

This is a targeted capture/setup run, not a complete release regression. The source snapshot's aggregate earnings Costs field shows materials rather than total materials plus other costs. Net earnings and the ranking views are used for image five; the issue was not concealed by redrawing numbers. Re-capture aggregate cards from the corrected source before using those cards in marketing. The Pixel preview retained a stale local active-visit banner after the visit ended on Nexus. Restarting the preview refreshed it; the final export capture has no stale banner. Pixel’s final export and earnings captures use Metro’s minified (`--no-dev --minify`) JavaScript preview, still pointed at hosted Dev. This does not validate a release binary. The original invoice/time/active-visit captures use the development bundle with invoicing enabled.

## Pixel recovery

Expo Go was reinstalled in place, preserving saved app data and the demo sign-in. An all-data reset was rejected by automatic approval review and was not performed. The later approval for that reset was not used because data-preserving recovery succeeded. Native logs showed Wi-Fi disconnects caused by IP reachability failures during bundle loading. `cmd wifi set-ipreach-disconnect disabled` was applied on the selected Pixel emulator. Network speed was set to full and delay to none. A complete approximately 21 MB bundle transfer over ADB loopback was verified. Cold startup remained slow, but the preview was then observed loaded and responding.

## Final verification

Both five-image landscape sets were visually reviewed. All ten PNGs are RGB at 2560 × 1600; original native content is uniformly scaled. Six complete native CTA interiors (invoice, active visit, and export on each tablet) passed exact pixel comparisons after the separate proof cards were applied. The local preview orientation config passed five assertions covering default, opt-in, and production-build/export guards. `git diff --check` passed. No store upload or release build was performed. The assets and capture support files are prepared for repository review.
