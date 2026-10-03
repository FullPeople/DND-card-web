# Dashboard density and draft safety · 2026-10-03

Local candidate only. No merge or deployment is implied.

- Shared resource appearance: background (including transparent), border width 0–8, radius 0–32, padding/gap 0–16. Default frame has no border or inset spacing. Card, editor, overview and Suite authorized projection use the same fields.
- Scale accepts 25–200%. Compact-size and explicit width/height controls reclaim actual grid cells, down to a 1×1 single-resource footprint. Scaling small saved footprints compensates the inner composition rather than shrinking it twice. Group membership and each balance remain separate.
- Divider reserves one pixel and keeps a wider pointer hit area. Existing capacity-compatible module styles now show their names.
- Closing via X, Escape, backdrop, form cancellation and module switching checks changed drafts. Cancelling preserves them. Saving blocks dismissal; local storage and Suite ACK must both settle and succeed before the dashboard becomes clean. A failed save retains its outgoing baseline for an explicit retry.
- Overview editor ownership is outside the console page and roster rows. Selection, scene removal or disappearing roster entries cannot unmount its draft. Current access controls save availability; room/scope changes disable saving. Read revocation or scope changes conceal the still-mounted draft, including its title, until original access returns. Unrelated roster/revision changes do not disable it.
- Resource form writes merge only changed fields against their opening snapshot, preserving concurrent consumption and source-owned maxima. An unchanged legacy form does not materialize new defaults.

Validation performed locally: full Web unit suite 771 passed / 25 conditionally skipped, Web TypeScript; Suite TypeScript and resource presentation 217, dashboard 220 (15 groups), layout 235/237 self-tests. The final aggregate may include other parallel fixes; counts are not additive.

Browser command: `npx playwright test --config playwright.dashboard237.config.ts`. It starts integrated fixture Vite on 5647 and the standalone App on 5648 and covers desktop/mobile footprint and frame CSS, close/discard paths, local storage rejection/retry, overview ACK failure/concurrent spend, console/roster unmount and existing dashboard interactions. Artifacts: `.local-evidence/dashboard237/`. Local browser execution remains blocked by the previously verified socket permission denial; test discovery/typecheck are not browser passes. CI screenshots are still required. The user's reference screenshot was inspected privately and is not in this repository.

The standalone compile-time boundary replaces the remote overview host with a children-only provider; its strict multiplayer-module audit is unchanged. Both integrated and standalone production builds were rerun after this boundary fix.
