# Explicit level-up ASI allocation candidate

This independent follow-on starts from Web `87396a8babed8d2cd30d2eb6a6ca074b7c4fc3ca`, the completed seven-mechanism candidate in PR104. It does not modify that validated branch, merge, deploy, or restore purchase/random ability generation.

## Reproduced gap, not a regression claim

Frozen PHB Fighter 4, TCE Artificer 4 and XPHB Fighter 4 consumers could record ASI as a complete choice, but provided no ability-allocation subchoice or derived increment. Reopening retained that manual record and base scores. Existing tests deliberately specified manual allocation. The initial checkpoint covered source-qualified XPHB ASI feats. The final combined scope below also implements explicit allocation for 68 reviewed PHB/TCE class-feature grant profiles; optional replacement feat effects remain manual.

## Scope and protection

An explicit +2 to one ability or +1 to two different abilities is separately confirmed. This is a derived contribution, not a rewrite of base scores. Existing cards stay unchanged until the player confirms the increase is not already included in their manual base value. Each actual grant has independent identity; source/level restrictions suspend its contribution, and replacement/restoration must preserve archived manual children and spent resources. Unknown rules and unknown saved-state versions must not execute.

## Source

Frozen public revisions: class files use `tjliqy/5etools-cn@e2623b204ddbdf2bcfa8317acfc962de89c676e2`; feats use `5cc0bbe2c2b241a334e731af4448bdba2168e8bd`. Both are fixed revisions with separate canonical byte checks.

- `feats.json`: canonical SHA256 `0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6`; Ability Score Improvement, XPHB p202.
- `class/class-fighter.json`: canonical SHA256 `a4c5afc0e7ec7a444d1418a04ab4fe392b9a7a25907ac0fb9b8618a79d1ee509`; XPHB Fighter and its level-grant references.

Canonical hashes mean SHA256 of JavaScript JSON.stringify(parsed JSON), not raw file bytes. Source bodies and private character data are not committed or published as artifacts.

## Validation status

Implementation and directed verification are in progress. No new passing checks, completed replay, release count or online percentage is claimed by this document. The previous stage's 18,789-record replay remains bound to its previous source; it is not evidence for these new source changes. Accurate final commits, directed results, real App desktop/narrow receipts and stage runtime report pairing will be appended before completion.

## First remote checkpoint and exact-source failure retained

Web PR105, source `d44bb0af01f7ec279c550f282b95cb1dbc1dfa08`, is stacked on PR104; Data PR59 producer `1525c6c9416f4a801c2e315511314741b2da2204` is stacked on PR58. The identical local tree passed 61 directed tests with 3 existing external-fixture skips, plus TypeScript. Six real App tests were discovered only.

The separate exact frozen-source workflow proof then found an additional lifecycle gap: reopening without a catalog and downgrading correctly suspended the level-6 ASI, but restoring the class level without a catalog did not restore the source feature needed to activate the saved allocation. This assertion is retained and blocks completion. The stage-wide replay has not been started while this source fix is pending; old evidence is not reused as if it verified this case.

The offline source-feature recovery is now narrowly implemented and directionally verified: 70 tests passed, 3 existing external-fixture skips; TypeScript passed. A concurrent unchanged-5-second source-test timeout is retained separately; the serial group passed without changing the timeout or assertions. The allocated feat instance and its archived descendants are retained; the reconstructed source feature receives a new selection ID from its saved entry snapshot, not an old source-feature child-tree restoration. Exact end-to-end proof is rerun against the next checkpoint.

## Adjacent legacy ASI batch

The candidate now also handles the 68 previously reviewed PHB/TCE class-level ASI grant profiles (12 PHB classes plus TCE Artificer). Unlike XPHB, these are actual class features with an explicit saved ASI plan, not generated feat selections. The same explicit +2 or different +1/+1 allocation is source-qualified, capped at 20 and derived separately from base values. Optional replacement feat effects, sidekicks and unknown source profiles remain manual.

Legacy allocations retain the actual source-feature ID and its manual descendant tree through downgrade/offline restoration. Removing the allocation while parked keeps the source tree for later restoration without the bonus. Source-disabled upgrade cannot create a replacement that strands the original; cyclic owner data is not consumed by source reconciliation. Separate reviewer findings and regression tests were retained. These statements describe candidate implementation, not release certification.

Thirteen frozen class files cover all 68 source profiles; their canonical hashes and exact feature hashes are in legacyAsiEvidence.json. Recovery provenance independently maps all thirteen to e2623b2, and CI re-downloads and re-verifies all fourteen inputs including feats. Browser acceptance now contains ten desktop/narrow flows, not yet executed. The prior completed seven-mechanism candidate stays untouched; this adjacent ASI batch receives one final stage calibration after source freeze.

Combined directed validation after legacy integration: 9 files, 113 passed / 3 pre-existing external-fixture skips; all fourteen new frozen inputs were available, including all 68 legacy profiles. TypeScript passed. Actual App tests remain ten discovered, not executed; exact stage-wide replay and final report pairing remain pending.

## Frozen combined checkpoint

Web source `0f8530e1293d232bf1f20fd9be7d8dd07c9284f2` and Data producer `e0b0c2e380d1d4ed3f250bf9a43d817a7439dc66` passed the exact-source 27-step workflow replay (0 failures). This is consumer API/persistence evidence, not browser evidence. One stage-wide replay began at 2026-10-23 16:00:53 UTC with these frozen sources; the ten actual UI cases are still pending.

Initial CI correctly rejected the workflow download of feats from the class-file revision. Independent retrieval confirmed the original feats freeze uses `5cc0bbe2c2b241a334e731af4448bdba2168e8bd`, raw SHA256 `6712bbf38c5955415aa2b0b155d9ecbd13d8e1914d0a8f212ce44cce13866fbc` (426735 bytes), exactly equal to the retained input. Only workflow download provenance is corrected; expected canonical hashes and source code are unchanged. The main CI also correctly rejected the still-old runtime ledger until final pairing.

Stage replay finished at 2026-10-23 17:25:47 UTC: 18,789 records, 229 verified inputs, 168 modules (all previous 164 retained plus four ASI modules), SHA256 `c42e168432e78c644cd7e2f8dcf2bcb358a8ec64475de4842d7748651431287a`. The executor disconnected after 15,269 receipts; the same binding resumed those receipts rather than starting over. Consumer-byte verification and nine real-consumer probe scenarios passed; one/two/four-worker and interrupted-resume results matched serial results. Data report checkpoint: `3c8897c2f7367b39045e7b2ab3419c6b24e6b5a9`. Counts remain 4,561 reviewed / 6,537 at-least-one witnesses / 522 unavailable, with no unresolved observations. These are not full-rule or release availability counts. Ten UI tests still await the paired CI run.
