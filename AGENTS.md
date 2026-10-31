# Design and product-context maintenance

Design work happens in ChatGPT as of 2026-10-24; the user has cancelled Figma Pro.

- Do not automatically sync to Figma, maintain Figma pages or `packages/design-system/figma-map.json`, or require Figma verification for changes.
- Existing Figma links, exports, and mappings are historical references and may be stale. Use the implementation and verified product documentation for current behavior.
- For meaningful shipped product changes, update `docs/product/current-product.html`, run `npm run product:export` and `npm run design:check`, and refresh local ChatGPT visual assets when the UI changes.
- Develop and review new designs in ChatGPT. Record approved decisions and local artifacts in the repository; keep shipped, approved but unshipped, and exploring work distinct.

# Marketing voice

- Before writing or revising public-facing marketing, read and follow [the marketing voice guide](docs/product/marketing-voice.md). Use direct, factual language that respects experienced tradespeople; avoid coaching slogans and forced audience slogans.
