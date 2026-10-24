# PHB 2014 invocation spell qualification stage

Draft, unpublished follow-up to Web PR106 / Data PR60. The accepted preceding heads are preserved. This stage covers Beast Speech, Mask of Many Faces and Misty Visions, not their complete spell effects.

## Player scope

A source-qualified PHB Warlock explicitly learns each invocation through the existing class choice. The respective Speak with Animals, Disguise Self and Silent Image grants offer repeatable at-will casting with no spell-slot expenditure. Only Misty Visions explicitly waives material components. This does not grant the other invocations a material-component waiver.

Spell targets, actual animal communication or illusion adjudication, concentration, duration, components not waived, and invocation replacement timing remain manual. Other editions, imported lookalikes and unreviewed invocations do not automatically gain this payment authorization.

## Source and verification

Frozen upstream revision: `tjliqy/5etools-cn@e2623b204ddbdf2bcfa8317acfc962de89c676e2`. The three existing frozen inputs (optionalfeatures, PHB spells and Warlock class) are hash checked; publisher text is not committed. Beast Speech is PHB p110; Mask of Many Faces and Misty Visions are p111.

The initial three authored metadata tests fail because the baseline does not recognize these invocation rules. This is an actual missing mechanism, not an environment failure. Targeted implementation, canonical spell identity negative cases, full source workflows and actual browser validation are in progress. No new full replay, browser pass or release availability is claimed until the corresponding receipts are attached.

## Delivery boundary

An incremental branch preserves prior verified work. This stage is not merged or deployed. A source replay witness is not a whole-rule completion or a current-release percentage. Exact final commits and verification receipts will replace the pending stage evidence at closure.

## Identity regression reproduced during expansion

The first child-spell negative test pass recorded 24 failures and 9 passes. Existing free-payment authorization could accept a matching translated name with a different canonical spell identity, edition or copied payload, or an altered child parent/grant key. The bounded fix revalidates the reviewed PHB spell and the exact source ownership at planning/payment time, without assigning free usage to manual spells or unrelated innate arrays. Additional review covers the parent choice grant receipt and display-name-only edits. These failures remain part of the record rather than being counted as passes.

First final directed result: 10 files, 352 tests passed, zero skips, including both exact frozen-source groups. TypeScript and diff whitespace checks pass. An independent review reran 15 identity/payment negative or display-edit positive probes, confirmed mutation-free rejection, and found no blocking issue in the bounded scope. These are not the still-pending browser, stage-wide replay or release receipts.
