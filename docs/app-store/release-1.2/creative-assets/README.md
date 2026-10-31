# App Store header and search-results assets

Prepared October 31, 2026. These extend the selected 1.2 campaign; they are separate from the five portrait screenshots.

| Placement | Final file | Size | Format |
| --- | --- | --- | --- |
| Product page header | [06-app-store-header.png](../final-images/06-app-store-header.png) | 3840 × 1646 | RGB PNG, no alpha |
| Search results | [07-app-store-search-results.png](../final-images/07-app-store-search-results.png) | 3840 × 2560 | RGB PNG, no alpha |

## Copy and rationale

**Unlimited invoices & estimates**

Simple time & expense tracking for contractors.

The headline preserves the approved first screenshot's concrete capacity difference and explicit invoice/estimate terminology. Supporting copy carries “simple” and contractor intent. The earlier exploration “Simple estimates & invoices / Unlimited documents” was superseded because “documents” was vague and weakened continuity with the 1.2 strategy. Historical exploration prompts remain under `authoring/`; superseded raster explorations were removed during cleanup.

These assets support recognition and conversion in their placements. Text inside them is not a substitute for searchable app name, subtitle, keywords, or descriptive metadata, and no keyword-indexing benefit is asserted.

## Design and source fidelity

Both assets use the slate/rust campaign palette, approved headline lettering, the same black device hardware as image 02, and the invoice content selected in v3. Original device/screen pixels are uniformly scaled and composited; native controls and figures are not regenerated. No FieldSoli wordmark is added.

Built-in imagegen supplied the backdrop and initial explorations. The final composition is reproduced by [compose-creative-assets.py](authoring/compose-creative-assets.py). The final backdrop prompt is recorded in [backdrop-v1-prompt.txt](authoring/backdrop-v1-prompt.txt).

## Specifications and safe areas

Verified against [Apple's creative asset specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications) and the Photoshop templates linked from [Apple's asset best practices](https://developer.apple.com/app-store/asset-best-practices/) on October 31, 2026.

Template safe areas were read from the downloaded Apple PSDs, rendered locally with macOS `sips`:

- Header: x=1097–2743, y=493–1154 within 3840 × 1646.
- Search results: x=836–3004, y=765–1795 within 3840 × 2560.

## Current composition

At the owner's request, the current images use the full canvas rather than constraining the layout to the template safe areas above. The headline, supporting copy, and phone are enlarged. No safe-area border is included in the final images.

Exact current copy:

> Unlimited invoices & estimates
>
> Simple time & expense tracking for contractors.

The subtitle wraps after “tracking” without changing its words or punctuation. The headline has been reduced to give the subtitle and phone more breathing room, especially in the wide header. Revisions overwrite the same unversioned header and search filenames; no numbered revisions are retained.

The validation record confirms dimensions, RGB output, full-canvas bounds, source hashes, and sampled native UI fidelity. The full final images were visually reviewed. App Store Connect's device/orientation Preview has not been checked; upload, approval, and publication have not been performed.

## Source retention

Only the required backdrop, prompts, and compositor remain in `authoring/`. Derived cutouts, headline extracts, guides, crop previews, and duplicate output PNGs were removed. The compositor now writes only the canonical assets in `final-images/` and its validation record.
