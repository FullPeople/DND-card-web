# Startup delivery and transparent reveal, 2026-10-03

Local candidate based on Web `04d0168430612f520826e8ac3250cc1a11b65361` (same tree as published owner-sync candidate `be1bfe92556b045dce91bb69a9f9cf2186883531`). No release number or announcement change; original 240 animation is preserved. This report is not a deployment receipt.

## Confirmed causes and changes

1. The built document placed the entire card stylesheet in a parser/render-blocking `<link rel="stylesheet">`. Standalone CSS is 291,184 bytes (56,043 gzip); integrated CSS is 330,047 bytes (63,708 gzip). It blocked first paint and the inline body startup script, even though the yellow shell needs only its own inline CSS. Build output now preloads the same stylesheet with the existing matching cross-origin mode, applies it asynchronously using `media=print → all`, and does not fade to the card until both the application and all styles are ready. Failed CSS retains the recovery panel and hides an unstyled application. React recovery remains independently visible.
2. Four original 500×500 PNGs total 241,159 bytes, and the logo correctly waits for all four downloads/decodes. Their original bytes and hashes are unchanged. Pixel-identical lossless WebP delivery is 114,564 bytes, 52.5% smaller. Each image has early preload, high fetch priority and async decode. Exact decoded RGBA hashes and both formats' hashes are in `STARTUP-LOSSLESS-ASSETS.json`; `tools/optimizeStartupLogo.py` reproduces the conversion. Failed image preloads remain nonfatal, matching the previous image-error behavior.
3. Optional Wiki, editing library and offline installer started after a workspace commit plus one frame, even while the logo was still downloading/animating. They now start after the presentation completes and one paint; failure/recovery still releases these tasks. Data/functions were not removed. This specifically reduces competing transfers/initialization during the intro.
4. The overlay already faded its opacity, but the underlying root remained hidden throughout that fade. That exposed the page background. The ready, styled card is now visible underneath during the fade; the overlay and all four layers fade together to transparent. The root stays inert and the overlay captures input until completion. Announcements/onboarding remain gated on completion, not a guessed timeout.

Unchanged choreography: yellow `#FFFF56`; original positions/rotations; all four layers animate 1.9 s, reach full opacity at 0.95 s, start 0/.14/.28/.42 s, then preserve the .33 s final hold and .45 s fade. No lobby or text is reintroduced.

## Network evidence and boundaries

Read-only HTTPS checks against the still-live, unmodified 240 pages from this cloud route:

- Separate new connections, no compression requested: `/card/` TTFB 7.324 s, TLS ready 5.561 s, total 9.351 s; `/suite-dev/workbench/` TTFB 6.445 s, TLS ready 3.244 s, total 7.396 s.
- A subsequent gzip HTTP/2 session: first `/card/` TTFB 5.973 s (TLS 4.037 s), 3,923 transferred HTML bytes. Reusing that connection: `/card/` .320 s, Suite .196 s and .216 s TTFB (Suite 3,919 bytes).
- HTML responses were `Cache-Control: no-cache, must-revalidate`, gzip enabled, nginx. These are curl route/connection measurements, not browser cache measurements or the user's ISP/real Owlbear room. They show a substantial pre-HTML connection component that frontend code cannot remove on a first visit. No server/CDN/TLS settings were changed.
- Existing service-worker navigation still prefers fresh HTML with a 1.5 s fallback to cached HTML. That availability/update contract was retained; do not claim zero pre-yellow delay or complete resolution of all network latency.

The core application remains substantial: standalone core JS 628,883 raw / 208,753 gzip; integrated core JS 772,449 raw / 255,365 gzip. This patch removes the shell's dependency on downloading that graph rather than claiming its download/parse work disappeared. DOM/user timing now separates inline shell, CSS readiness, logo decode, app entry, workspace read/validation, usable card, waiting, fade and completion.

## Validation

- Red baseline: the new lifecycle assertions run against `04d0168` fail in four specific cases: image-preload error tolerance, CSS wait gate, CSS error after React ready, and transparent reveal selector. 12 pre-existing scenarios pass. This establishes behavior differences; it is not browser speed evidence.
- Green candidate: 24 dedicated lifecycle/style/cache tests pass. Full unit suite: 831 passed, 25 conditional skips (106 passed files, one skipped file). TypeScript and both standalone/integrated builds pass. `git diff --check` passes.
- Pillow independently compared all 1,000,000 RGBA bytes per layer: exact for all four. Original PNGs contain no ICC/gamma metadata. Browser RGBA comparisons are additionally included for CI.
- Prepared CI: 18 standalone/integrated startup-order cases cover loading/failed CSS, slow program/images, complete choreography, reduced motion, cancelled/reentered fades, input lock and announcements. Four performance cases each record cold and warm navigation: standalone and an integrated Suite entry inside an iframe, unthrottled and 32 KiB/s + 150 ms. Reports include navigation timings, paint, marks, transfer sizes, decode endpoints and long tasks. Routing is intentionally not used in the benchmark because Playwright routing disables the HTTP cache; external rule fetches use an empty synthetic fetch response. The preview serves gzip and explicit asset caching. This is a synthetic local production benchmark, not a logged-in Owlbear/relay test.
- Local browser execution remains blocked by the previously verified process/socket and cloud-localhost restrictions. No bypass was attempted. New browser tests were discovered/typechecked, not declared passed locally. Exact-commit CI and screenshots remain required after integration/push. Suite host/permissions/real room behavior remains the owner-sync task's separate verification.

Suite needs no startup source patch: `build-workbench-dev.mjs` copies the verified Web integrated `dist`, including the lossless assets and service worker. Only authorized branch push/CI is pending with the integration owner; no main/dev merge or deployment is performed here.
