---
name: fieldsoli-android-play-internal-release
description: Build and submit the current FieldSoli production Android app to Google Play internal testing with the EAS production environment, then verify EAS build and submission status. Use when asked to ship a new FieldSoli Android/Play Store internal testing build; do not use for iOS/TestFlight releases or Play Store production/public rollout.
---

# FieldSoli Android Play Internal Release

## Outcome

Submit one new FieldSoli production Android build to the Google Play **internal** track without allowing the local development environment to override the production release configuration. Report the release as separate, evidence-backed gates:

1. source and local validation;
2. EAS build;
3. EAS submission to Google Play internal testing; and
4. Google Play processing and internal-tester availability.

Do not call the release Play-ready until the final gate is confirmed.

## Release Boundary

- Use this skill only in the FieldSoli repository, from a clean, intended source commit. A current `main` checkout is a valid release source; do not create a release branch or edit source merely to ship a build.
- The user must explicitly authorize the EAS build and Google Play upload. A request such as “push a new build for Play Store internal testing” is authorization. Read-only release checks are always safe.
- Treat the production environment values as EAS-managed. Never copy their values into `.env` files, source code, terminal output, chat responses, or `EXPO_PUBLIC_*` local files.
- Current production identity: project `@veltrija/fieldsolo`, Android package `com.veltriventures.fieldsoli`, Play submit track `internal`. Re-check `apps/mobile-expo/eas.json` and `apps/mobile-expo/app.json` before releasing if either was changed.

## Preflight

From the repository root:

1. Inspect `git status --short --branch` and `git log -1 --oneline`. Stop for direction if the working tree has unrelated changes or the intended source is ambiguous.
2. Run `npm ci` only when dependencies are absent or the checkout is dependency-less. Then run:

   ```bash
   npm run test -w mobile-expo -- --runInBand
   ```

3. Confirm EAS authentication:

   ```bash
   cd apps/mobile-expo
   npx eas-cli@latest whoami
   ```

4. Confirm no Android production build is already queued or in progress:

   ```bash
   npx eas-cli@latest build:list --platform android --limit 3 --non-interactive
   ```

5. Validate the dynamic Expo config using the remote production environment, without creating local env files:

   ```bash
   npx eas-cli@latest env:exec production \
     "EXPO_PUBLIC_APP_ENV=production npx expo config --json >/dev/null" \
     --non-interactive
   ```

   `eas env:exec` loads values stored in the EAS environment, but does not load
   `eas.json` build-profile `env` values. `EXPO_PUBLIC_APP_ENV=production` is a
   non-secret production-profile setting needed only to make this local config
   evaluation follow the same environment branch as the remote build.

`release-env.js` deliberately rejects a local Supabase URL during production config evaluation. If an ordinary `eas build` fails with that error, do not weaken the guard or export secrets locally: use the production-environment wrapper below.

## Build and Submit

Run the repository helper from the root:

```bash
.agents/skills/fieldsoli-android-play-internal-release/scripts/submit-play-internal.sh
```

It executes the build inside `eas env:exec production`, which makes the EAS-managed production Supabase and PostHog variables available for both dynamic config evaluation and the remote build. `eas.json` owns `EXPO_PUBLIC_APP_ENV=production`, `android.buildType: app-bundle`, `submit.production.android.track: internal`, and remote `versionCode` auto-increment.

Capture the exact EAS build and submission IDs printed by the command. Do not create another build while either remains queued or in progress.

## Verify Each Gate

From `apps/mobile-expo`, poll the exact IDs until terminal:

```bash
npx eas-cli@latest build:view <build-id> --json
npx eas-cli@latest submit:view <submission-id> --json
```

- `FINISHED` build plus `FINISHED` submission proves the AAB was uploaded to Google Play on the internal track. It does not prove Google processing or tester availability.
- After submission finishes, confirm the new `versionCode` appears in [Google Play Console](https://play.google.com/console) under **Testing → Internal testing**. Report any remaining Google processing separately.
- If EAS reports a queue/outage while the build is healthy, keep polling the same build ID. Do not create a duplicate.
- If a completed build’s submission fails, inspect its terminal error. Retry submission of that completed build before rebuilding:

  ```bash
  npx eas-cli@latest env:exec production "npx eas-cli@latest submit --platform android --profile production --latest --non-interactive" --non-interactive
  ```

## Completion Report

State the source commit, app version/`versionCode`, test result, EAS build ID and terminal status, submission ID and terminal status, and Google Play processing/internal-testing state. If Google is still processing, say the release has been uploaded but is not yet confirmed available to internal testers.
