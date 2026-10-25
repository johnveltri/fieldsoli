# Invoice Settings Design QA

final result: passed

## Comparison target and evidence

- Source visual truth: `/var/folders/6w/tywwklt10fs7gv99m0ypfzlc0000gn/T/codex-clipboard-20c0aee6-8839-48f5-88b0-97e7669486da.png`, the user-provided Invoice Settings screenshot.
- Pixel 10 implementation screenshot: `/tmp/pixel-invoicing-settings-bottom.png`.
- Combined focused comparison: `/tmp/pixel10-design-qa-comparison.png`.
- State: Estimates & Invoices settings, scrolled to Estimate expiration, 30 days selected, Save Changes visible, Android gesture navigation.
- Source image: 670 × 624 px including device framing; the visible app crop is approximately 640 × 600 px. Source density and full CSS viewport are unavailable. It is a partial screen crop, not a full-screen capture.
- Implementation image: 1080 × 2424 px, Pixel 10 emulator at 420 dpi (approximately 411 × 923 dp; device scale factor 2.625).
- Normalization: compared the visible app crop and matching Estimate expiration/footer region side by side, preserving aspect ratio and scaling both to 640 px wide. No geometric stretching was applied. The source’s cropped viewport means absolute footer-to-content spacing cannot be judged precisely against the full simulator viewport.

## Comparison evidence

- Focused region: the four expiration options, selected 30 days mark, Save Changes action, warm page surface, and Android gesture area are visible together in the combined comparison image.
- Full view: unavailable from the source; it contains only the lower portion of settings. The current simulator capture confirms the relevant content and surrounding Android system bar, but does not enable a full-page source comparison.
- Typography: serif section heading and sans-serif option labels retain the same hierarchy and readable wrapping. The source and simulator show the same Estimate expiration copy and option labels.
- Spacing and layout: option rows, selection mark, and primary save action remain clear and usable. The save action sits over the final option in the short, framed source crop but below the card in the taller simulator view. Because the source viewport is cropped and its full height is unknown, this difference is not treated as a layout defect.
- Colors and tokens: the page surface and gesture-bar area are the same warm color in the simulator (`Foundation/Background/CanvasWarm`, `#F6F1E8`). The source’s sampled background is close (`#F3EEE6`); the small pixel difference is consistent with image capture or scaling and does not create a visible surface boundary in either image.
- Image quality and assets: no content imagery appears in the compared region. The source’s device frame and the simulator capture are excluded from fidelity judgments.
- Copy and content: “Estimate expiration,” Off, 7 days, 14 days, 30 days, and Save Changes match; 30 days is selected in both.
- Interaction and accessibility: the 30-day selection is visibly indicated and the save action is unobstructed in the simulator. No settings were changed during QA. This visual pass did not exercise save behavior, text scaling, or alternate window sizes.

## Findings

No actionable P0, P1, or P2 visual findings in the matched region. The source does not provide enough viewport context to judge the save action’s vertical relationship to the options card across the full page.

## Comparison history

- Initial comparison: checked the user-provided source crop against the Pixel 10 capture at the same settings state. No actionable P0/P1/P2 issue was found in the page/gesture-bar color, typography hierarchy, option rows, selected state, or copy. No visual fix was needed during this QA pass.

## Implementation checklist

- [x] Opened the source screenshot and captured the live Pixel 10 implementation.
- [x] Navigated to the matching Estimate expiration state and selected option.
- [x] Compared the focused region side by side at normalized width.
- [x] Checked typography, spacing, color tokens, image/asset fidelity, and app copy.
- [x] Confirmed the gesture-bar surface matches the settings page background on the simulator.
- [ ] For a full viewport layout comparison, capture the source at the full device screen size and include its density/device scale.
