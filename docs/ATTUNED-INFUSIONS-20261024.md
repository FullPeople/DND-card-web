# Three bounded TCE attuned infusion mechanisms

This candidate adds Repeating Shot, Repulsion Shield and Resistant Armor to the reviewed infusion registry. The source-qualified identities and hashes are in `src/core/automation/infusionEvidence.json`. Upstream revision: `e2623b204ddbdf2bcfa8317acfc962de89c676e2`.

## Player workflow

Learn the option through the existing Artificer choice, select a qualified nonmagical item and explicitly confirm binding. Merely learning or previewing a target grants nothing. Use inventory attunement; Repulsion Shield also requires the separate current-holding confirmation. Resistant Armor requires an explicit damage type and never defaults one. Replacing a shield clears holding intent; changing the resistance type replaces, not stacks. Save/reopen keeps explicit choices. Source restriction, lost level prerequisites or unsupported equipment suspends effects without overwriting manual data. Existing capacity and duplicate-mechanism/item conflicts still apply; dropping below capacity suspends the set instead of silently deleting a player's record.

Repeating Shot adds a fixed +1 only to supported actual ranged attack modes. A custom ammunition-tagged melee/thrown-only target has no supported ranged mode and displays that limitation. Repulsion Shield adds fixed +1 AC at Artificer level 6+, while equipped, attuned and held. Resistant Armor displays one of ten selected resistances at Artificer level 6+, while the armor is equipped and attuned. No automatic damage reduction or executable Owlbear defense is exported.

## Manual boundaries

Loading, ammunition creation, shield charges, dawn recovery, reaction timing and forced movement remain manual. Long-rest touching and death-expiry lifecycle remain manual. The implementation does not count these whole source rules as fully automated or currently released.

## Validation checkpoint

Source candidate `72335d195cc5639ca1055a1ac2af0a1a356c787e`; Data proof producer `7d5dbd401aef191ac6395777f79d0424b57aaec2`. Eight directed files: 213 passes, zero skips. The frozen-source workflow: 23 steps passed. TypeScript passed. Initial remote directed regression suite: 430 passed, two pre-existing conditional skips; the formal build correctly rejected the previous ASI runtime ledger as stale. Four new browser cases are defined, not yet executed. The full 18,789-record/229-input stage calibration completed on 2026-10-23T21:09:28.168Z, preserving 168 consumer module gates. It resumed from 4,795 existing receipts after interruption, not from zero. The report SHA256 is fa5bb1655173c39a2c901f6abbd5e60b09bbde698536dbcb4f965168ee283aa4. The paired Data authority is 455b0c8a91289d6d560176085cad395c45e2695c. Browser validation remains pending and the formal gate stays unchanged. Draft PR106 and Data PR60 are not merged or deployed.
