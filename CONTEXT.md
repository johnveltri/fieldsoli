# Context — FieldSoli

## Project

**FieldSoli** — design system and app work under this repo. The **`design-system/`** tree holds shared tokens, components, preview, and Expo font loading.

## Design workflow

As of 2026-10-24, design work happens in ChatGPT. Figma Pro has been cancelled.
Do not automatically sync to Figma, maintain Figma pages or mappings, or require Figma verification for product changes. Existing Figma links, exports, and mappings are historical references and may be stale.

For meaningful shipped changes, update `docs/product/current-product.html`, run `npm run product:export` and `npm run design:check`, and refresh local ChatGPT visual assets when the UI changes. See `docs/product/chatgpt/project-instructions.txt` and `docs/product/prototyping-workflow.html`.

## Historical Figma references

- **File:** [FieldSoli App](https://www.figma.com/design/TdvsllfeXrnkvBqR4qb3fn/Field-Book-App---gig-work-for-skilled-trade) (`fileKey`: `TdvsllfeXrnkvBqR4qb3fn`).
- **Components** generally live in the file’s Components area (e.g. frame **“Components”** — node id may vary by branch/version).

## Historical component reference

- **Job Card** — Single component in Figma: [`661:2`](https://www.figma.com/design/TdvsllfeXrnkvBqR4qb3fn/Field-Book-App---gig-work-for-skilled-trade?node-id=661-2). Spacing uses **`design-system/tokens/spacing.json`** via bound **Spacing/** variables. Spec: **`design-system/components/job-card/spec.json`**. See **`LEARNINGS.md`** for MCP notes.

## Fonts / stack (high level)

- Web preview and Expo load FieldSoli fonts via **`design-system/fonts.css`**, **`design-system/expo/loadFieldSoloFonts.ts`**, and related typings.

## Where to look next session

- **`LEARNINGS.md`** — Historical Figma MCP pitfalls and layout notes; the ChatGPT design workflow above supersedes the old Figma-first preference.
- **`design-system/scripts/`** — Ad-hoc scripts when needed (experimental Job Card MCP payloads were removed).
