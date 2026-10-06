# Invoicing — Technical Evidence and Alternatives

Reviewed 2026-10-06. Repository evidence uses b85ebe5. This file records current sources and implementation rationale, not device test results or installed dependencies.

## Renderer and platform comparison

| Option | Fit and tradeoff | Disposition |
| --- | --- | --- |
| Existing design-system native components | Good app chrome/field entry, but cannot also render identical hosted HTML/print output. | Reuse around document, not as a second document template. |
| Native primitives | Platform print/share/composer UX and no rendering service fees; print engines still vary. | Use via maintained Expo adapters. |
| Maintained open-source WebView/Expo libraries | Same HTML in native; SDK-compatible integration, platform accessibility/printing validation and a new binary required. | Selected, version pins/lockfile during implementation. |
| Custom native invoice/PDF implementation | Three templates and accessibility/pagination maintenance; conflicts with shared HTML requirement. | Rejected. |
| Server headless browser/PDF vendor | Cross-browser file delivery, but compute/queue/storage or vendor fees. | Excluded by PM's explicit on-demand cost constraint; native-only export meets supplied sheet flow. |

The canonical renderer is a pure, versioned HTML/CSS function in a shared package imported by mobile and Next.js. Native WebView accepts inline HTML. Native print accepts the same HTML with print media styles. Hosted web uses server-rendered markup; no customer-facing JavaScript is needed to render content. PDF layouts/pagination are tested on each real engine, not assumed byte/pixel-identical.

## Verified dependency facts

- [Expo WebView documentation](https://docs.expo.dev/versions/latest/sdk/webview/) supports inline HTML and currently recommends react-native-webview 13.16.1. Existing app is Expo SDK57; use Expo's compatible installer and lock the resolved version rather than unbounded latest. [WebView license](https://github.com/react-native-webview/react-native-webview/blob/master/LICENSE) is MIT.
- [Expo Print](https://docs.expo.dev/versions/latest/sdk/print/) exposes HTML-to-local-PDF printing on iOS/Android; file output goes to app cache. Its web behavior opens a print dialog. iOS HTML printing does not support local asset URLs; prefer text-only V1/self-contained embedded assets. Android print margins depend on WebView and @page styles. Recommended SDK57 version observed: ~57.0.2.
- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) shares local files on native; local-file URI sharing is unavailable on web. Check availability. Do not enable an inbound share extension just to export a PDF. SDK57 recommended version observed: ~57.0.22.
- [Expo SMS](https://docs.expo.dev/versions/latest/sdk/sms/) opens a user-controlled composer with recipient/message prefill. Android returns unknown outcome; callbacks are not reliable delivery proof.
- [Expo MailComposer](https://docs.expo.dev/versions/latest/sdk/mail-composer/) enumerates clients and supports OS composing. Its default iOS composer requires configured Apple Mail, so it does not alone fulfill a direct Gmail shortcut. Use a thin availability-aware native adapter, prove target composer/prefill on physical devices, and retain the explicit More fallback. No Gmail API/OAuth/email service is added.
- [Android intent documentation](https://developer.android.com/guide/components/intents-common#Email) supplies the platform email intent boundary. [WhatsApp click-to-chat](https://faq.whatsapp.com/5913398998672934) is the provider's public recipient-link facility; uninstalled/invalid-recipient paths need device validation. An undocumented iOS Gmail compose URL is not treated as a guaranteed API.
- Expo libraries use the [Expo MIT license](https://github.com/expo/expo/blob/main/LICENSE). Evaluate/pin only modules actually needed: WebView, Print, Sharing, SMS, Clipboard and native file cleanup; a thin email/Android-intent adapter may need MailComposer/IntentLauncher. Existing expo-linking remains reusable. Retain license notices. No paid SDK, account creation or remote renderer dependency.

## Public hosting and rich-card delivery

Reuse apps/marketing (Next16) and existing Vercel Pro, confirmed by PM. Add /share/[token] and a guarded image route returning the small metadata card. [Next ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response) can generate PNGs from JSX/CSS at request time; it supports a subset of CSS and a 500KB bundle bound. Keep the card simple, font/assets self-contained, and verify response CPU/size. It is a separate summary card, not another implementation of the full document renderer. No stored screenshot or PDF.

Public HTML/image endpoints verify link/Job/owner eligibility on every request. Response no-store and dynamic routes prevent first-party cached copies bypassing disable. Compute reduction comes from compact templates and device PDF rather than unsafe public-document caching. [Google noindex documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing) requires crawler access to read the directive; robots.txt blocking cannot substitute for noindex. Third-party preview caches are outside revocation.

## Resource and release evidence

Supabase metadata confirms the organization Free plan and production-evidence.md measures database size. [Pricing](https://supabase.com/pricing) includes 500MB database, 1GB file storage, 5GB egress plus 5GB cached egress, and 500K Edge Function invocations. The preferred authenticated mutation uses database RPC and existing hosting, not a PDF Edge Function. Measure database/index bytes, fetch counts and payload sizes under DATA-13's planning scenario.

The PM confirms Vercel Pro; API verification was unavailable after connector authentication. [Pro documentation](https://vercel.com/docs/plans/pro-plan) provides credit/usage information; check actual team allocation/remaining spend before release. Keep CPU/transfer usage visible, use existing spend alerts, and do not buy capacity without PM authorization. Existing small static renderer + Postgres has low additional provider lock-in; authentication/hosting operations still need maintenance. Self-hosting on existing infrastructure is a technically credible fee alternative but adds operational work and is not selected.

No external research is used as tax/jurisdiction advice. The Supabase changelog markdown fetch failed; no Supabase implementation occurred. Recheck current changelog and relevant RLS/RPC docs before actual migration work, as required by the Supabase skill. Device adapters, PDF pagination/accessibility and quota readings are explicit implementation evidence gates, not unverified claims that tests passed.
