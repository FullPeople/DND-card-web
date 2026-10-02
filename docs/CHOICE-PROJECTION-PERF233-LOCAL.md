# Choice projection performance follow-up · 2026-10-02

## Evidence before this patch

CI85's retained synthetic class-drop comparison passed all 32 cases. Candidate artifacts were source-mapped using their matching retained production assets. All measurements use Chromium at forced 4× CPU slowdown, original fixtures, 12 cards and either 100 or 10,000 catalog spells. No player data or publisher snapshot was used.

Unprofiled candidate naming samples (three independent pages per cell):

| Mode/catalog | Per-run input dispatch median range | Per-run two-rAF median range | Latest-input dispatch range |
| --- | ---: | ---: | ---: |
| A4 / 100 | 21.7–26.2 ms | 43.6–49.5 ms | 20.0–26.2 ms |
| A4 / 10,000 | 54.6–61.1 ms | 73.5–81.0 ms | 52.3–62.0 ms |
| Screen / 100 | 63.1–64.9 ms | 81.4–82.9 ms | 58.4–67.2 ms |
| Screen / 10,000 | 96.6–99.5 ms | 114.9–117.2 ms | 85.2–93.8 ms |

Source-mapped **sampled CPU totals across the separate profiled operation**, not per-input latency:

- 10,000-entry class drop: `sheetChoices` inclusive approximately 472 ms A4 / 630 ms screen; its `classSpellChoices` child approximately 430 / 565 ms. Spell-list source/name normalization was a large child cost. Overview called the full projection independently for all four training fields, and FeaturePanels repeated it.
- Naming with no class: A4 `sheetChoices` inclusive approximately 394 ms over the complete name sequence; `classSpellChoices` self approximately 344 ms, scanning/building spell candidates despite there being no caster.
- Screen naming: CharacterTabs' layout-effect rectangle reads approximately 353 ms over the sequence, even with only 100 catalog entries. The effect depended on the entire characters array and forced geometry reads after every display edit.
- `planSourceSpells` self was approximately 10–15 ms in the large-catalog drop profiles. These traces do not justify removing reconciliation or attributing the majority of delay to that map.
- Playwright's own snapshot traversal accounts for substantial separate recorded CPU (approximately 380–450 ms per operation). Idle/program samples and runner overhead must not be attributed to application functions.

The profiled sample is not pooled with the three unprofiled samples. Two rAF callbacks measure frame opportunities, not actual presentation or INP. Dispatch capture-to-bubble is an event-dispatch bound, not React-only duration. No literal zero-latency or near-instant acceptance is claimed.

## Narrow change

1. Return class spell choices before scanning the catalog when there is no active caster. Apply cheap level eligibility before class-list name/source matching; retain all previous option ordering, saved-snapshot precedence and source-qualified matching.
2. Derive one shared choice projection from App's existing immutable mechanics snapshot and current catalog identity. Display-only name/player edits share this read-only projection. Every mechanical/identity/profile/catalog snapshot change invalidates it. Independently mounted components fall back safely. Mutable core draft APIs remain uncached.
3. Reveal the active character tab on active-ID/list-membership changes and actual observed strip/tab width changes, rather than synchronous measurement after every unrelated character object replacement. Keyboard navigation and resize visibility remain supported.

No persistence, history mutation, permissions, source reconciliation, resource granting or runtime serialization was changed.

## Verification and remaining boundary

- Targeted choice/projection/display-edit/source-choice/resource tests: **54 passed / 18 external-data skipped**.
- TypeScript and `git diff --check`: passed.
- Direct browser config discovery: 12 cases including two new A4/screen projection lifecycle cases.
- New differential unit tests cover level/edition/filter ordering, permissions, imported aliases, duplicate IDs, mutable catalog additions, snapshot invalidation, name/player sharing, independent consumers, undo-style original snapshots, import and spent-resource preservation.
- New production-browser cases cover display edits, active-tab visibility after width changes, class removal/undo, readonly toggling, reload, untouched other cards and spent resources. These cases have only been discovered locally; browser execution remains pending authorized CI.
- The **same unchanged** `node tools/profileClassDrops232.mjs` and original edit-performance comparison must run on the final candidate to establish before/after behavior. New browser latency is not yet measured. This is a focused candidate, not deployment or performance acceptance.
