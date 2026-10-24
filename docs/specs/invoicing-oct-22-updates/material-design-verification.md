# Material price design verification

REQ-05 / UX-03 implementation reuses the existing Job View material row and typography: cost remains primary; `{amount} with markup` appears underneath, right-aligned, in `bodySmall` / secondary foreground with `Spacing/4`. No icon or card was introduced. The row may grow and wrap. Accessible row labels distinguish cost from price with markup. Canonical pricing and component behavior are covered by `ViewActivityBuckets.test.tsx` (9 tests passed); the mobile TypeScript check passed.

## Figma maintenance attempt — October 24, 2026

The Figma `figma-use` and `figma-generate-library` skills were loaded before inspection. The intended reconciliation scope was the maintained material row only, with before/after screenshots and no changes to archives or experiments.

Repository mapping `packages/design-system/figma-map.json` points to file `TdvsllfeXrnkvBqR4qb3fn`, maintained page `2022:4069` (`07 Current App — Maintained`) and Job Detail node `2025:561`. In the connected file, `getNodeByIdAsync('2022:4069')` returned null. A subsequent read-only root inspection confirmed the file key and returned only these pages:

| Live page | ID |
| --- | --- |
| 05 Screenshots | 1967:69 |
| 01 Raw Imports | 6:2 |
| 02 Design System | 8:232 |
| 03 Screens | 8:233 |
| 04 Marketing Website | 1956:2 |

The maintained page and the mapped archive-index, experiments and next-design-system pages were absent from this connected file state. No canvas mutations were made. Pages 01–05 were preserved. Figma session ID: `277bf84a-a245-4fb3-aafa-65cd94018d64`.

Figma maintenance and matching before/after visual verification remain pending until the expected maintained page is available in the connected file. No visual parity claim is made. Physical iPhone layout, large text, VoiceOver, and matching-device screenshots also remain release verification work; passing component tests and TypeScript do not establish those outcomes.
