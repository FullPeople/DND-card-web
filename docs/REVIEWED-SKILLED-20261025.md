# PHB2014 Skilled bounded implementation, not published

This batch follows accepted Web PR116 `52d5be10e161464d5e0846d1dc2202ea1169754b` and Data PR70 `4af8999023b61263b78388d21f66be46cf05922e`. Those heads remain unchanged. New work uses `codex/cloud-reviewed-skilled-20261025`; no merge or deployment is authorized.

## Player capability

A genuine reviewed 2014 class ASI replacement can select Skilled and explicitly confirm exactly three distinct skills or tool kinds in any mixture. The finite reviewed domain is 18 PHB skills and 39 PHB tool kinds: 37 specific tools and land/water vehicle categories. It is not three skills plus three tools, and does not cover every published tool. Catalog groups, individual carts/ships, unsupported magical/supplement tools and unknown sources do not silently grant proficiency.

Derived skills affect actual checks and passive scores without duplicating proficiency or granting expertise. Derived tool proficiency is shown with its PHB source; this does not implement a new automatic tool-check, crafting or vehicle subsystem. No inventory, resources, abilities or HP are granted. Manual proficiency/expertise, final numerical overrides and bonuses remain untouched. Explicit full or empty manual tool training overrides its display without suppressing the skill part.

Confirmation belongs to the actual class ASI instance. Incomplete/duplicate/unsupported choices do not apply; source, level and feature restrictions suspend retained intent. Replacing/forgetting/withdrawing clears only the owned confirmation; reselection requires fresh confirmation. Readonly, retained-card drafts, cancelled edits, delayed confirmation and save-failure paths are tested. PHB repeatability and XPHB behavior are separate.

## Source and compatibility boundaries

Source identities and mechanics are frozen and hashed; no full upstream rule text is uploaded. See the paired Data PHB Skilled source review for all input hashes and provenance. A manifest covers 55 actual source entries plus two vehicle categories. It is a bounded adapter, not a generic mixed-proficiency executor.

Independent optional `reviewedSkilled` v1 avoids changing existing `reviewedFeats` v1 or the global character/server schema. Exact old Web52d5be10 ordinary native/export/collection/linked/IndexedDB/backup roundtrips preserve the unknown field and existing passive feats. That is NOT full lifecycle safety: the old client cannot clear unknown confirmation when it forgets/reselects Skilled; old downgrade/reupgrade can change the original grant identity. After old-client edits to these choices, return to the supporting client, withdraw and reconfirm. Code-only rollback is not claimed safe for all new intent states. No cloud account or production deployment is accepted by local tests.

## Red cases and review corrections

- Frozen Wizard4 through normalize, feature sync and real legacy ASI choice initially had no mixed-three control and Perception 0/untrained instead of 2/trained, passive 12.
- A legitimate imported alias initially bypassed disabling the canonical Skilled entry. Both canonical and instance availability are now enforced while preserving legitimate aliases.
- PHB tool links on a 2024 card initially pointed at XPHB through ordinary display formatting. New derived references retain PHB explicitly without rewriting existing manual text.
- Pre-CI independent review ran the installed Playwright selector engine offline and caught invalid panel-prefixed relative `has` locators. All three chains were corrected and retained as negative tests; this is not a browser pass.

## Validation checkpoint

Core/UI/neighbor directed checks: 429 passed at core checkpoint, overlapping groups are not summed. Final new UI suite: 50 passed; additional exact-option16 and previous armor/weapon Overview6 passed. All 68 reviewed legacy ASI source slots and 57 candidate identities are exercised. Type checks passed. Exact old-consumer checks: 7 passed, with lifecycle limits above explicitly demonstrated.

Data c3f1bf12990aea73222e7575d7629de65c75d299 full suite: 883 Vitest passed / 11 existing conditional skips, 14 Node passed, TypeScript build passed. The c3f commit at 06:06:35Z preceded full-suite start at 06:06:41Z.

Actual App acceptance is pending: eight new cases, desktop and narrow, plus all previous 96 gives 104 planned. Discovery is not execution. The 20-input source download/hash/index workflow was checked offline using the exact existing frozen files; actual clean remote retrieval, final source workflow, full-stage replay, accurate paired report/lock and complete exact-head CI still require their own results. No historical batch count is a current release completion percentage.

Final local source workflow: 226/226, no failure/skip, 19 frozen inputs, 92 current modules and 90 exact old-consumer modules. It includes all 68 ASI slots and all four three-choice mixtures. Local full Web suite: 3,987 passed, 214 conditional skipped, 17 stale-runtime-ledger failures in two evidence-boundary files. These failures remain failures until the final stage report is paired; they are not waived. TypeScript passed. Product source tree is `8edaa9060b43ca982a59d5f99c5f22ee8678180d`; local initial source proofs are distinct from future remote-bound reports.

## Exact remote stage completed, real App acceptance still pending

One full replay bound to Web `def2e57db717f2eebbb361259f7b18dec4d3e1da` and Data source `7ef606533e3287cf5c0d85d08afb19b0a2944114` completed 2026-10-25T06:36:02.374Z: 18,789 records, 229 exact inputs, 196 consumer modules. Report SHA256 `e99fe60d1b1472e33f9cf93eaead7d4e6b5e785937bc567c67483dda7f53460a`; all records identical to the previous accepted stage. 4,561 reviewed / 6,535 at-least-one-witness / 522 unavailable / 0 unresolved are not whole-rule or published completion. New owned workflows add real player capabilities without falsely inflating this coarse metric.

Exact remote workflows all passed with no skips: Skilled226, Weapon Master209, armor503, passive235. Their separate exact input/module bindings are retained. Final Data report commit `c9f606e853aae9a0618ae504adb161fed3a8a663` contains the common runtime report and all four source proofs; Web lock uses that real commit.

Initial source CI also independently downloaded and verified the 20 exact inputs, then passed previous targeted1774 with2 existing skips plus reviewed592 with0 skips and TypeScript. Formal build was correctly blocked by the previous runtime ledger before pairing; actual browser tests were not executed on that checkpoint. Final paired 104 actual App cases and complete exact-head CI remain pending. No merge or deployment.

## First actual App failure and exact catalog fix (2026-10-25)

The first final-head browser run `40169909521` on `f92044c2` is not accepted: desktop 48 passed / 4 new Skilled cases failed at disabled confirmation; narrow was cancelled and is not a full result. Original logs, traces and screenshots are retained. The root cause is a product integration error, not a timing/locator issue: actual `loadCatalog` always injects the project's PHB land/water training-category handles, but the finite-kind conflict check only recognized publisher skill/tool rows. Thus the legitimate vehicle options were misclassified as conflicting identities. The normalize-only directed fixtures had omitted that catalog seed.

The correction authenticates only the two exact PHB2014 v2 authored category handles, with fixed identity, kind, pack, revision and raw category declaration. It does not accept arbitrary English matches, groups, air vehicles, carts/boats or changed source/mechanics. A canonical handle with altered English/source is still a conflict; duplicate invalid rows cannot be hidden by catalog ordering. Malformed non-array effects/choices/dependencies are rejected. Both the earlier table-backed disable ID and actual App category ID suspend the whole retained three-choice binding; disabling an individual Cart item does not disable a vehicle proficiency category.

Two new directed red failures preceded the correction and are retained. Focused Skilled plus passive/armor/weapon neighbors: 556 passed, no skips, using the exact frozen source and old consumer gates; TypeScript passed. Browser assertions were strengthened to require each target option enabled, not relaxed. These are not Chromium acceptance. Because product source changed, the earlier full replay is now historical; one new exact-source replay, source workflow proofs, Data pair and final 104 actual App cases are required before acceptance. No merge or deployment.
