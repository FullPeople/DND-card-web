# Charged item spells: bounded source checkpoint

This independent candidate implements eleven source-qualified, one-charge item spell branches attached to eleven canonical physical item owners and eleven edition-qualified spell targets. Six branches require no spell attack or save statistic; five use an explicit source-fixed save DC. No class statistic or unused owner DC is borrowed. The remaining seven conditional and twenty-one unresolved UID/statistic candidates stay held, not counted as implemented.

## Actual workflow and ownership

- First record the genuine owned physical item and its current known charge balance through the existing charge workflow. Explicit spell-source activation never creates, resets or restores that pool.
- Each cast requires fresh confirmation and current source, item, equipment/attunement, edit and lock authority. It stages one new existing physical-pool debit and commits that debit with its bound cast receipt atomically. Duplicate, no-op or failed inner payments cannot become a new cast.
- The owned spell child has no independent counter, ordinary learned/prepared entitlement, slot substitute, free route or manual recharge editor. Manual spells, other item instances and unrelated resources remain separate.
- Native reopen, source suspension, withdrawal, relearn and duplicate callbacks do not refill spent charges. Intentional bookkeeping Undo/redo retains current permission and lock checks and preserves unrelated later/manual edits.
- Known last-charge holds remain. Spell effects, damage, concentration, action economy, unverified triggers, recharge and item-destruction consequences are not automated by this checkpoint.

## Compatibility and proof boundary

The carrier is versioned and source-bound. An actual frozen older consumer was exercised for native round-trip and payment denial; older clients do not gain a free, check or slot cast. Preserving unknown fields does not make old-client editing safe. Unknown future versions remain inactive/read-only; users must not use an old client to modify the owned item, source or charge history.

Fresh local validation passed **113/113, zero skipped or retried**: 47 source checks, 22 real workflows, 16 guards, 11 actual older-consumer/native checks, eight new SSR checks and nine retained at-will SSR checks. The first 22 workflow failures remain recorded. The first combined result was 103 passed, one guard failure and nine legacy cases not run because of a missing pinned-fixture environment variable. The guard had incorrectly required rejection across a source-proven transport-revision-only equipment change; the corrected case proves identical rebound identity, one physical pool/debit and canonical/alias disable protections. No product authority was relaxed.

The installed compiler passed with zero diagnostics. Four authored mounted DOM cases have **not run locally**. These source/core/SSR results are not full App, paired runtime-report, whole-entry, release or production acceptance. This checkpoint is not merged or deployed and claims no automation-page percentage increase.
