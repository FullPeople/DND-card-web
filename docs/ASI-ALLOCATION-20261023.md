# Explicit level-up ASI allocation candidate

This independent follow-on starts from Web `87396a8babed8d2cd30d2eb6a6ca074b7c4fc3ca`, the completed seven-mechanism candidate in PR104. It does not modify that validated branch, merge, deploy, or restore purchase/random ability generation.

## Reproduced gap, not a regression claim

Frozen PHB Fighter 4, TCE Artificer 4 and XPHB Fighter 4 consumers could record ASI as a complete choice, but provided no ability-allocation subchoice or derived increment. Reopening retained that manual record and base scores. Existing tests deliberately specified manual allocation. The new scope is only the source-qualified XPHB ASI feat granted through its actual class-level feature; PHB/TCE record-only paths are not claimed implemented here.

## Scope and protection

An explicit +2 to one ability or +1 to two different abilities is separately confirmed. This is a derived contribution, not a rewrite of base scores. Existing cards stay unchanged until the player confirms the increase is not already included in their manual base value. Each actual grant has independent identity; source/level restrictions suspend its contribution, and replacement/restoration must preserve archived manual children and spent resources. Unknown rules and unknown saved-state versions must not execute.

## Source

Frozen public revision: `tjliqy/5etools-cn@e2623b204ddbdf2bcfa8317acfc962de89c676e2`.

- `feats.json`: canonical SHA256 `0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6`; Ability Score Improvement, XPHB p202.
- `class/class-fighter.json`: canonical SHA256 `a4c5afc0e7ec7a444d1418a04ab4fe392b9a7a25907ac0fb9b8618a79d1ee509`; XPHB Fighter and its level-grant references.

Canonical hashes mean SHA256 of JavaScript JSON.stringify(parsed JSON), not raw file bytes. Source bodies and private character data are not committed or published as artifacts.

## Validation status

Implementation and directed verification are in progress. No new passing checks, completed replay, release count or online percentage is claimed by this document. The previous stage's 18,789-record replay remains bound to its previous source; it is not evidence for these new source changes. Accurate final commits, directed results, real App desktop/narrow receipts and stage runtime report pairing will be appended before completion.
