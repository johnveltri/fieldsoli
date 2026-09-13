#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$repo_root/apps/mobile-expo"

commit="$(git -C "$repo_root" rev-parse --short HEAD)"
branch="$(git -C "$repo_root" branch --show-current)"
version="$(node -p "require('./app.json').expo.version")"
message="${branch} @ ${commit}: ${version} Android internal"

# release-env.js validates hosted production Supabase and analytics settings.
# Running through env:exec supplies those EAS-managed values without writing
# them into the repository's local environment files.
exec npx eas-cli@latest env:exec production \
  "npx eas-cli@latest build --platform android --profile production --submit --non-interactive -m \"${message}\"" \
  --non-interactive
