# Startup presentation and announcement order · local candidate

The approved four PNGs, #FFFF56 background, movement keyframes, .33 s final-pose hold and .45 s fade remain unchanged. Previously React mounted Announcement immediately: native showModal enters the browser top layer and could interrupt the ordinary intro overlay. The root also became visible at the beginning of fade-out. A higher z-index cannot fix that ordering.

The inline shell now waits for loaded/decoded PNGs, actual CSS animation completion/cancellation, the approved pose hold, application readiness, and actual opacity-transition completion/cancellation. A persistent phase snapshot plus event drives React's announcement and first-setup gate. The root remains hidden through fade-out. Slow-load diagnostics, failed-program recovery, failed logo assets, reduced motion, navigation cancellation and BFCache restoration have separate paths. No announcement acknowledgement is written during startup.

The Suite workbench copies this same Web shell. Its bridge includes the startup snapshot on handshake/heartbeat and explicit phase changes; host automatic notices wait while the authenticated current client is starting. No client remains a valid ready state. Retired client completions cannot unlock a new entry. Existing origin, session and exact source checks still guard direct messages; relay messages use the existing authenticated channel.

Host eligibility/open requests no longer write daily or seen keys. A successful content render and visible paint records daily exposure; explicit acknowledgement records the version. Failed, unexposed or cancelled opens remain unread. The host modal lives in the Owlbear room; the workbench normally opens in a separate tab.

Local verification:
- Web startup lifecycle and announcement unit tests: 20 passed.
- Suite startup/announcement lifecycle self-test: 30 assertions passed.
- Suite announcement channel/guide state self-test: 45 assertions passed.
- Existing announcement-inline test: 9 assertions passed.
- Suite TypeScript passed. Aggregate Web type/build verification belongs to the combined candidate because other workers are editing it concurrently.
- New production-browser configuration: `npx playwright test --config playwright.startup-order.config.ts` (12 discovered cases, standalone and Suite; screenshots/report/trace in `.local-evidence/startup-order`). Existing Suite `tools/announcement-scope-browser.mjs` now checks visible exposure versus explicit acknowledgement and active-intro host gating.

Local Chromium is blocked before opening any page by a socket permission denial. Browser tests/screenshots, paired production builds, CI and real-room verification are not claimed as passed here. No push, merge, deployment or player-data action was performed by this change.

## Navigation and recovered-host review correction

A non-persisted pagehide also happens during reload. It now leaves the host gate blocked throughout the interval before the replacement document's JavaScript/hello. Only a verified closed, previously authenticated WindowProxy may release the gate without new-document completion; the existing transport heartbeat inspects that fact, without a guessed delay. Relay-only cancellation cannot prove closure and therefore remains blocked until a new client completes.

The recovered-host ping path establishes the client snapshot before continuing, and initial host eligibility runs after bridge registration. Web hello/ping/startup messages carry document timeOrigin. The gate rejects lower-generation messages even when the old client ID is first seen after host recovery; known retired IDs remain rejected. No-client initial startup and explicit older-client compatibility remain supported.

Joined gate + automatic daily-subscriber regressions cover reload's no-hello gap, replacement fade, late completion, verified close, relay-only uncertainty and first-seen stale generations after host recovery. Updated Suite lifecycle self-test: 44 assertions passed; announcement-scope unit: 45 passed; Suite TypeScript passed. Updated Web startup plus handshake/instant-selection/selection regressions: 45 passed. Browser host-scope regression now includes the navigation gap and stale first-seen hello; browser execution remains pending CI.

BFCache review additionally covers A → B → Back: a persisted pageshow gives restored A a fresh activation identity and monotonic activation time, resets only the read-only handshake, and sends its real current presentation phase. It preserves the workspace and does not replay operations or restart/skip the animation. This allows the restored document to supersede B without accepting delayed messages from either old activation. Joined host regression and the actual Web bridge pageshow regression pass; latest totals are Suite lifecycle 49 assertions and Web startup/bridge 46 tests. Suite TypeScript passed again. Truly unobserved windows before host rediscovery cannot block the explicit no-client-ready state; this is not a universal cross-window startup guarantee.
