# XPHB ASI allocation candidate

Players can explicitly choose the reviewed XPHB Ability Score Improvement's
one-score +2 or two-score +1 allocation after selecting the feat. The 21
allocations use the source's numeric metadata and a source-qualified evidence
record. They affect derived scores, modifiers and dependent sheet values, up to
20. Existing source and equipment ability operations retain their original
order, including on unallocated attributes. Base scores, notes and
runtime resource balances are never rewritten.

The new `selection-id:feat-abilities` answer is opt-in. Existing manual cards do
not acquire any automatic increase. The choice explains that an old allocation
already included in base scores must remain manual unless the player changes
that ownership explicitly. Clicking a chosen allocation again removes it.

The existing class-grant archive retains the allocation answer and selection ID
through replacement, source disablement, downgrade, restoration and offline
save/reopen. Unsupported identities, inherited records, altered allocation
shapes, multiple/corrupt answers and pre-existing explicit ability effects do
not acquire this evaluator. PHB legacy ASI, other feats, invocations and infusion
activation remain outside this batch.

Source: [2024 Basic Rules, Ability Score Improvement](https://www.dndbeyond.com/sources/dnd/br-2024/feats#AbilityScoreImprovement),
checked 2026-10-19. The frozen local feats input has SHA-256
`0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6`.
Only authored fixture metadata and hashes are committed; publisher prose and
the 229 frozen inputs remain local and read-only.

Validation completed 2026-10-20:

- Five workflow tests failed before implementation; two additional operation-order
  regressions failed before repair. All 11 primary ASI tests, including the frozen
  actual-source workflow, pass. Data adds 11 actual-source lifecycle assertions.
- Complete Web suite: 1,650 passed, 92 existing optional/historical cases skipped,
  zero final failures. The initial Node 22 child-process type-loader failure was
  resolved with `NODE_OPTIONS=--experimental-strip-types`; no assertion or gate
  was relaxed. TypeScript, standard build and standalone build pass.
- Real Edge browser acceptance passes at 1512 x 982 and 390 x 844. Each runs
  all 21 choices, confirms +2 STR (18/+4, DEX 13/+1), saves and reloads with
  the same scores/modifiers, replaces with +1 STR/+1 DEX (17/+3, 14/+2),
  then cancels the allocation (16/+3, 13/+1). No assertions were removed.
  Initial locator names were corrected against the actual UI. The apparent
  reopen failure was a test race: App switches pages in a React transition,
  while the old overview also contains this choice. The test now waits for
  the requested tab and tabpanel before acting; no runtime fix was required.
  Temporary diagnostics were removed. Physical touch hardware was not tested.
- One completed full replay covers 229 frozen inputs and all 18,789 identities,
  bound to consumer `fd6b8cb09a79dba12e39a426f31fd4885c4f3d47` and 71 exact
  imported module blobs. Final adoption changes only tests, documentation and
  copied evidence, so those consumer bytes remain identical.
- Data artifact: `ccf474fbf8e83eb1a50db397deed2e9029b8415c`, report SHA-256
  `a7c1132041819447d31da7ada6d040e090ec5e08783b28ade5781a36837757f1`,
  Git blob `bbf623cd472d2601e5b09a68e20f75e758778c44`. Web's copied report
  and lock pass committed-blob provenance verification.
- Reviewed identities remain 4,561. Identities with at least one verified usable
  mechanism increase from 6,537 to 6,538; this does not mean 6,538 whole rules
  are complete. Only XPHB Ability Score Improvement changes from manual to
  implemented; unavailable remains 522, unresolved remains zero.
- PR45/46 were combined only in a disposable validation branch. Their producer
  comparison against Data main has zero mechanism, diagnostic or handled-field
  differences over all 18,789 identities. Their separate draft branches remain
  unchanged. Full details and the source/mechanism checklist live in Data PR47.

Review order: [Data PR47](https://github.com/FullPeople/dnd5e-automation-data/pull/47)
then [Web PR89](https://github.com/FullPeople/DND-card-web/pull/89). A future merge
must keep the locked Data commit reachable, or update the lock to an accessible
merged commit containing the identical report blob and reverify it. Final exact
head CI belongs to the PR checks; no historical or synthetic merge run stands
in for an exact-head result.

Rollback: revert this source change together with its subsequent Data ledger
adoption. Stored allocation answers remain ordinary retained answers and are
inert without this evaluator. No base-score migration needs reversal.

This is a review candidate. No merge or deployment is authorized for this task.
