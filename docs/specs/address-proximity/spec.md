# Proximity-ranked address suggestions

Status: approved and implemented locally, not a native/store release. Approved October 24, 2026.

## Outcome and requirements

- REQ-01: All address fields (Job capture/edit, Live Session, Business Details) favor nearby matches without excluding relevant distant matches. Preserve four U.S. suggestions, attribution, debounce and manual entry.
- REQ-02: First Address focus requests native foreground location permission directly. No extra consent modal. Denial never blocks entry or causes repeated automatic prompts.
- REQ-03: Ranking priority is approximate device point, previously saved business address, then no explicit proximity bias. Unsaved business-address text never defines proximity.
- REQ-04: Privacy Choices groups Address suggestions and Contacts under Device permissions using the same switch style as Analytics. Switches reflect OS access; first requests use the native prompt and later changes open FieldSoli's device Settings.
- REQ-05: Device coordinates are rounded on device before transmission. Coordinates are memory-only, excluded from application logs/analytics, and never attached to Jobs.
- REQ-06: Privacy version 2026-10-24 uses the existing legal agreement gate for everyone. Terms version remains 2026-09-20.

## Acceptance and non-goals

Each rule maps to the test contract. No radius restriction, strict distance sorting, address autofill from GPS, background tracking, persisted coordinates, CRM changes, or Figma maintenance.

## Artifact manifest

| Artifact | Applicability |
| --- | --- |
| state-model.md | Required: permission, async resolution, interruption and cache lifetimes |
| data-contract.md | Required: new permissioned provider data and authenticated operation |
| ux-contract.md | Required: native permission and Privacy Choices recovery |
| test-contract.md | Required: native, provider, legal and account boundaries |
| plan.md | Required: implementation and release sequence, evidence |

## Approved choices

All address fields; first field tap; soft provider bias; approximate-only transmission; saved-business fallback even while editing Business Details; Privacy Choices recovery. Privacy agreement uses the normal version bump, not a special compatibility exception. OS permission is installation-wide; proximity caches are account-scoped. No database migration.
