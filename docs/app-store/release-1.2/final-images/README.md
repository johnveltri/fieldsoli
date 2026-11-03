# FieldSoli 1.2 final images

These seven PNGs are the canonical selected assets. Revisions overwrite these filenames.

Fresh landscape [Android tablet artwork](android-tablets/README.md) is stored separately, with one five-image set per Nexus 7 and Pixel Tablet.

The five [Android screenshot adaptations](android/README.md) are stored separately in `android/`, with minimal edge-to-edge frames and no Dynamic Island. They are 1080 × 1920 and reuse the supplied app screens with iOS status bars removed.

Invoicing retains the selected **v3 layout and content**; time and expenses retains the **v2 screen** showing individual time, materials, and costs. All five portrait images share the hardware from image 02. The header and search creative use that same frame and the selected invoice screen.

| Final image | Dimensions |
| --- | --- |
| [01-unlimited-invoices-estimates.png](01-unlimited-invoices-estimates.png) | 1320 × 2868 |
| [02-track-time-expenses.png](02-track-time-expenses.png) | 1320 × 2868 |
| [03-simple-fast.png](03-simple-fast.png) | 1320 × 2868 |
| [04-take-data-with-you.png](04-take-data-with-you.png) | 1320 × 2868 |
| [05-job-earnings-insights.png](05-job-earnings-insights.png) | 1320 × 2868 |
| [06-app-store-header.png](06-app-store-header.png) | 3840 × 1646 |
| [07-app-store-search-results.png](07-app-store-search-results.png) | 3840 × 2560 |

The header and search subtitle is exactly “Simple time & expense tracking for contractors.” See [creative asset notes](../creative-assets/README.md) for specifications and current composition.

Superseded image proofs, duplicate finals, and derived previews were removed. Original app screenshots remain in `../source-screenshots/`. Historical prompts and validation records remain in `../design-proofs/`.

The [portrait compositor](../design-proofs/compose-consistent-frames.py) refreshes source UI and hardware using these selected finals as its layout inputs. The [landscape compositor](../creative-assets/authoring/compose-creative-assets.py) uses the selected invoice final and retained backdrop. Neither creates duplicate proof images or numbered final versions.

Cleanup verified that all seven PNGs remained byte-for-byte unchanged. Store upload or publication has not been performed.
