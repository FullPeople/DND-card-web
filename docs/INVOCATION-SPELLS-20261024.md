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

## Frozen stage result

The one full replay completed at 2026-10-24T04:19:10.395Z: 18,789 records, 229 exact frozen inputs, 169 consumer modules (all prior gates retained, actions.ts added). Consumer source is bbf9df7c588a24c50b7faaf39ec938eec658cdf5; producer source is 1c6b16493d09d1b4ccfbcbf4736772ba46b325cd. Report SHA256: 354601e62e9a07389910133fceb534f5b4fa5034a76d6d7d48ffbe532708708f. Data authority: c43d0b6ba8525a7578597e05bced812e94d46f27. Exact-source workflow: 58 passed. Remote dedicated tests on source: 646 passed, 2 existing conditional skips, 28 files; TypeScript passed.

Reviewed 4,561 / at-least-one-mechanism witness 6,537 / unavailable 522 / unresolved 0 remain unchanged. These are not whole-rule or online counts. No second full replay was started.

A legitimate local paired candidate passed provenance checks, but Chromium startup failed with socket permission denial before UI interactions; 8 attempts recorded the same launch condition before the suite was stopped (exit 130). No sandbox/launch security flags were changed, and no local browser bypass was attempted. The standard remote CI is still required to execute the final 26 player workflows. Final exact-head CI and browser receipts remain pending.

## First real-browser run retained

On paired head 33417ca8e997857597af364996465bf371d1caa6, run 40062215614 / job 120777969439 executed 26 cases: 22 previous cases passed and all 4 new cases failed. Artifact 12547189741 (SHA256 f1141c7280c4cfb7089e5fdcdcb8788b0862de3ed8e38e20a15b5e90fcbf4659) retains the traces. Screenshots and actual UI source showed test assumptions: the minimal Warlock fixture uses prepared-mode known-spell storage, completed choices intentionally hide their entry chip, and narrow third-drop completion leaves the workspace open. Test-only navigation/locator corrections preserve actual manual 1/3 spell uses, resource equality, source archive/restoration IDs, revoke checks and real readonly-cast rejection. No retries, skips, expanded timeout or source changes. The 169-module replay is not repeated. New exact-head 26-case result remains pending.

## Second real-browser run retained

On eeca4e335e36b34f5a99a0a2bcd3aef7f4bc8913, run 40063426916 / job 120781583467 executed 26 cases: 24 passed, 2 failed. Artifact 12548701273 SHA256 a7dfc1854641b7ee03789eab985282e461f042c5e99f7239be3db62effcc1399 preserves the traces. The two failures occurred only at the final assertion on archived sourceGrant.active metadata; all preceding learning/casting/reopening/replacement/removal and manual 1/3 checks executed successfully. Both source suspension/restoration and readonly scenarios passed.

The archive intentionally preserves settings while removing active selections. Independent probes on both actual saved-card traces verified all 8 old spell IDs had sourceSpellEnabled=false, no payment offers, rejected free actions and byte-identical state afterward. The test-only correction now checks complete archived original rows, absence from live selections, actual API rejection for all four revoked IDs per card and unchanged manual state; it does not delete or weaken the authorization requirement. Source remains bbf9df7, replay is not repeated, and the new exact-head UI result remains pending.
