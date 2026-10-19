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

Initial reproduction: five tests failed before implementation. Focused final
validation: 24 passed, with five pre-existing optional real-source cases skipped
in the older overlap suite; the new actual-source case ran and passed.
TypeScript passed. Full replay, paired Data adoption, full suite and browser
validation are recorded by the final delivery update; the initial build correctly
rejects the previous ledger after consumer bytes change.

Rollback: revert this source change together with its subsequent Data ledger
adoption. Stored allocation answers remain ordinary retained answers and are
inert without this evaluator. No base-score migration needs reversal.

This is a review candidate. No merge or deployment is authorized for this task.
