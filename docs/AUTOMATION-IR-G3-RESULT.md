# G3 execution evidence — 2026-10-03

User authorization: all execution-plan work approved, with evidence and rollback. This gate records implemented derivation and reviewed dispositions; it does not claim full corpus automation or Web integration.

Implemented pure structured families: abilities; scoped proficiencies; permanent traits; resources/recovery; class casting/feature models; equipment/charges/typed packages; additional spells; typed inline choices. Appendix C has 81 audited fields (48 mechanisms, remaining identity/display/expansion/excluded fields). Derived English tokens must resolve through finite vocabularies/catalogue identities; no publisher body is copied into the artifact.

Actual Node24 `npm test`, with locked corpus and unchanged Web baseline paths: **43 passed / 0 skipped / 0 failed** in Vitest, including **11 actual-data equivalence groups**, 14 structured cases and 18 validation cases; original inventory runner **14 passed / 0 skipped / 0 failed**. Node22.12.0 separately ran all 43 Vitest cases without skips/failures and strict TypeScript successfully. Node24 strict build also passed. Existing Web tests/assertions/skips and runtime remain unchanged. When external paths are absent, the eleven actual-data groups explicitly skip and state why; that run is not the real-data gate evidence.

The unchanged Web source is checked against `80c94e082fcbf11be10893622b03d4220bff4d60`; selected real input SHA and byte counts are verified before comparison. Small source subsets retain faithful mechanical token types and have file/pointer/SHA provenance, with explicit absent payloads.

Reviewed differences: (1) preserve XPHB Cleric 7GP correction as a source-SHA-bound numeric annotation, page68; (2) derive Foundry dice-pool count while keeping roll-expression support explicitly incomplete. Optionalfeature progression represents one cumulative quota with ascending levels. Unresolved equipment parts keep a typed marker and currency instead of being silently dropped; the executor must reject atomic delivery of such a package at G5. These implement the user's authorized migration/unknown-visibility goals; no heuristic interpretation of an ambiguous daily spell pool was approved.

55 reviewed identity aliases fix color-template expansion. Draft has **18,789 canonical records**, all automatically **needsAnnotation**, with **3 third-party identity gaps** and **2 conflicting third-party keys** still visible. The locked G1 denominator remains18,792 (including those3 unresolved identities). The core denominator remains6396: PHB1519, XPHB1448, DMG1171, XDMG2258, all pending annotation. Core books have no remaining English-template identity gap. Foundry mapping/orphans and body-level semantics still require G4–G6; no complete-automation count is claimed.

Two locked-input full runs emitted byte-identical automation.json, coverage-report.json/md and derivation-diagnostics.json. Artifact hashes/byte counts are recorded in reports/g3/summary.json. Large draft artifacts remain in ignored .cache/g3-final and .cache/g3-replay. Tracked reports contain source/kind denominators, diagnostic families and reviewed dispositions, not bodies.

Failure evidence retained in evidence/g3/: initial schema source-colon/empty feature-type errors; cross-edition unresolved references; resource literal-type test correction; missing catalogue context; unresolved purse/currency omission; cumulative quota review. Fixes retained strict validation, added explicit gaps/markers and corrected the derivation/input contract. No existing assertion or skip was weakened. One new synthetic assertion was corrected from numeric-string to normalized integer, consistent with the protocol; package-part assertions were strengthened to require the unresolved marker.

Commands:

```sh
DND_AUTOMATION_REAL_DATA=/workspace/dnd5e-automation-data/.cache/upstream/kiwee DND_WEB_EQUIVALENCE_REPO=/workspace/DND-card-web npm test
npm run build
DND_AUTOMATION_REAL_DATA=/workspace/dnd5e-automation-data/.cache/upstream/kiwee DND_WEB_EQUIVALENCE_REPO=/workspace/DND-card-web npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- node node_modules/vitest/vitest.mjs run
npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- node node_modules/typescript/bin/tsc -p tsconfig.json
node --experimental-strip-types src/cli.ts derive --offline --out .cache/g3-final
node --experimental-strip-types src/cli.ts derive --offline --out .cache/g3-replay
```

Rollback: isolated G3 commit can be reverted without touching Web source/runtime; `automation-g2-protocol-20261003` is the prior restoration tag. Next: G4 Foundry whitelist, unknown-key reporting, mapping tests and main-agent review of Fighter/Cleric/Barbarian/Wizard rows. No deployment, player data or main-branch merge is authorized by this implementation step.

| File | SHA-256 |
| --- | --- |
| evidence/g3/all-real-tests.log | ad5673f897a1bf33ae790d1d5f3f440a9792a74f363bb1cf631936df19a69026 |
| evidence/g3/build-final.log | d82e05ad8e5f9e9747fedd1c054d49732aeea428d4a92b59bbb0311bfc56d7ba |
| evidence/g3/node22-real-tests-final.log | f52b9a26c2e17dcff98c04d7995190dd4e4ba4ccca2aa685eb6a2f5200ac9c34 |
| evidence/g3/node22-build-final.log | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| aliases/identities.json | b3c7c0d375aceea85cd48adfa387b370b4b8e8e4cd7ce16879766230fd536c5a |
| aliases/input-corrections.json | ef22ce08286c66c022cf07844112d0963d25e616c88a91fb71e0d46a58a015bf |
| reports/g3/summary.json | 7a2057b5a052ab7d1a6a88e6d59551a86ceaffbe51db4f10c399d53848a8a073 |
