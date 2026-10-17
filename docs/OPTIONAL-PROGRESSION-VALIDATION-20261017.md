# Complete optional-feature tables at the source-reading boundary

This independent candidate fixes two raw-source validation omissions. It is
not merged or published. The production build and full CI remain blocked by
the unchanged runtime coverage guard until the original locked corpus can be
replayed against this consumer.

## Defect, source and expectation

At Web main `307056e68d4fcbb0788278043dfc56941d8d10ed`,
`sourceProgressionCount([1,3,null],2)` returns 3. An `EI` declaration for
`Warlock|XPHB` therefore opens three learning slots, and `optionalChoiceSupport`
marks it verified by comparing only that cell. A malformed or changed cell at
another level does not participate in either decision.

The expectation uses existing evidence rather than new rule interpretation:

- The existing [source-qualified evidence](https://github.com/FullPeople/DND-card-web/blob/307056e68d4fcbb0788278043dfc56941d8d10ed/src/core/automation/classChoiceEvidence.json)
  stores complete 20-level AI and both EI tables. The [official 2024 Warlock
  table](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Warlock)
  supplies the level-based invocation totals; no rule prose or table is copied
  into this change.
- [Data draft PR30's contract](https://github.com/FullPeople/dnd5e-automation-data/blob/b11cd828e5a4e5a85776bc243354a7e37599c677/docs/OPTIONAL-PROGRESSION-ARRAY-IR-20261010.md)
  requires dense arrays of exactly 20 safe integer counts from 0 through 100.
  That draft has not been merged; fixing its producer alone would not repair
  this independent Web raw-source reader.
- Fresh public [Artificer](https://5e.kiwee.top/data/class/class-artificer.json)
  and [Warlock](https://5e.kiwee.top/data/class/class-warlock.json) structures were
  inspected on 2026-10-17. Artificer TCE `/class/0/optionalfeatureProgression/0/progression`,
  Warlock PHB `/class/0/optionalfeatureProgression/0/progression` and Warlock
  XPHB `/class/1/optionalfeatureProgression/0/progression` are each dense,
  20-element safe-count arrays and match the corresponding existing evidence
  element for element. This is a current-source structure comparison, not a
  replay of the locked corpus or qualification of complete mechanics.

Current raw bytes: Artificer 165274 bytes, SHA-256
`21b0bdb40757381f78ad8f4b1ff44ccda9e9d23b646ad4449dbb9f2c63a1eba9`;
Warlock 166621 bytes, SHA-256
`4c5c188a6f555772b046d6ba260c8e30a2070f7e4266fc71f9cca04de19f948e`.
Raw inputs remain in ignored local evidence, never in the public commit.

## Minimal behavior change and preservation

Both boundaries use one complete-array predicate. Any missing level, hole,
invalid number or extra level rejects the whole array. Valid levels are 1–20.
The source reader returns unknown, shows no available learning slots or
candidates, and exposes pending/unavailable support. Existing saved slots and
snapshots stay visible as retained, inactive records.

Verified support now requires the complete supplied array to match the existing
source-qualified evidence. A complete safe table with a different total at
another level remains source-declared, with manual learning records available.
Sparse object quota lookup is unchanged; objects are not promoted to verified
array evidence. Legacy AI retains its existing opening-level verification limit;
later infusion totals remain source-declared.

There is no new prerequisite interpreter, item activation, ability grant,
resource recovery, player-data migration or UI redesign. The old happy-path
fixtures used shortened authored arrays; they now supply complete authored
tables while retaining their previous tested level quotas and assertions.

## Red/green and full validation

- New regressions before editing production code: **17 failed / 5 passed**.
  After the fix: **22 passed**. New plus related class-entry/support tests:
  **46 passed**, with no skips.
- Cases cover truncated/overlong arrays, holes, invalid earlier/future cells,
  invalid levels, all complete quotas, sparse objects, differing reviewed
  tables, and the support API's independent rejection of incomplete evidence.
- A saved learning answer survives invalidation, JSON export/import validation,
  offline snapshot lookup and source repair. New picks while invalid are
  rejected atomically; answers, snapshots, manual abilities, notes and consumed
  runtime values remain intact, with no additional character selection.
- TypeScript `tsc -b`, `git diff --check` and pinned Data export blob provenance
  verification passed.
- Full `npm test`: **1522 passed / 17 failed / 91 skipped**. The 17 failures all
  report `Runtime coverage is stale for current consumer code`, in the two
  existing progress/snapshot suites. The focused progress gate separately
  reports **338 passed / 17 failed / 20 skipped**.
- `npm run build`, `npm run build:standalone` and runtime provenance checking
  fail at that same strict guard. The normal class-choice Playwright run was
  attempted, but its dev server was rejected by the guard before any browser
  scenario ran. No production build or browser pass is claimed.

## Exact missing replay material

The main ledger matches all 70 baseline consumer modules; this candidate changes
exactly the two declared reader/support modules. No consumer hashes or guards
are rewritten to make that ledger appear current.

The original 229-input cache, including `index.json` with `rows` of URL, path
and declared parsed-body SHA-256, is unavailable in this workspace. A readable
cache path has been requested. Current public samples do not substitute for it:

| Input | Locked parsed-body SHA-256 | Current `sha256(JSON.stringify(body))` |
| --- | --- | --- |
| Artificer | `c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7` | `598326a65637616f62bc5124a81775fc6c43ffc296418df623a30d6a07bf1b0d` |
| Warlock | `34721a04db792923cf0a19fbab3f90616093d9f6519a7cfe6f81a9eb52e775d4` | `b0b6fde9a3eba8d02116890197ed9d7f91578a8b14e619464143a88a20f626a3` |

With the original cache, run the unchanged Data producer against the frozen
Web consumer commit, inspect all per-record differences, and submit the real
new ledger/pin through independent draft review. Only then can the strict
runtime gate, both builds, browser tests and exact-commit CI be completed.
Do not replace input locks, hand-edit witness counts or use the historical
unrelated release exception.

## Intake, isolation and rollback

Data main is `171f775f3eba4cf94ce6f8365ee247d19e6bded6`. Data PR30, PR31,
PR37, PR39 and PR41 remain unchanged drafts. Web had no open PR, and no issue
assignment or current competing work for this boundary was found. Open player
feedback and the other session's release work are untouched. This branch starts
directly from the inspected Web main; the original worktree is preserved.

Read `AGENTS.md`, current handoff and relevant project lessons, product,
acceptance and status guidance. Neither tracked `.agents/skills` nor workspace
`.agents` contains an applicable skill. The current task's no-merge/no-deploy
boundary overrides historical standing publication instructions.

Data files, source/evidence tables, coverage guards and locks are unchanged.
The existing 18789 inventory, 4561 reviewed and 6537 partial mechanism-witness
counts are not increased or recertified. Whole-rule and live completion remain
unknown. No credentials, permissions, real player records, cancelled PR48 work
or generic plugin maintenance are changed.

Revert this PR's single commit to restore the two production modules and authored
fixtures together. No live/player migration is involved. The PR records the
actual SHA and exact-commit CI outcome; this blocked draft is a reviewable fix,
not a release candidate with completed gates.
