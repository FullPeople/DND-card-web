# G2 execution evidence — 2026-10-03

User authorization: all execution-plan phases approved, with evidence and rollback required. No stage confirmation remains pending. Technical gates still apply.

G2 complete: JSON Schema 2020-12 protocol/overlay schemas; shared browser-safe identity; whitelisted arithmetic/dice parser; all eleven invariants; public-note stripping; three appendix E mechanism-subset fixtures with explicit limitations; protocol and coverage definitions; Node 22 CI validation job. This is protocol completion, not semantic corpus coverage or Web integration.

Latest Node 24 `npm test`: Vitest **18 passed, 0 skipped, 0 failed**; original inventory runner **14 passed, 0 skipped, 0 failed**. `npm run build`: strict TypeScript exit 0. Node **22.12.0** independently ran the same 18 Vitest and 14 inventory tests, with no failures/skips, and strict TypeScript exit 0. Full logs stay in ignored `evidence/g2/`; file hashes and exact commands are recorded here and in `reports/g2/validation-summary.json`.

Commands:

```sh
npm test
npm run build
npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- node node_modules/vitest/vitest.mjs run
npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- node --experimental-strip-types --test test/inventory.test.ts
npm exec --yes --package=node@22.12.0 --cache /workspace/npm-automation-cache -- node node_modules/typescript/bin/tsc -p tsconfig.json
```

Initial failure retained: strict schema compilation rejected missing `type: array` on conditional maxItems/minItems. Added explicit array types to the schema; validation was not weakened. strictRequired=false only permits reusable conditional schemas to compile; runtime required validation remains enforced and tested. Recovery `all` originally overlapped the formula string branch; excluded `all` from that branch to retain unambiguous oneOf validation.

The appendix E Second Wind record is schema-positive but semantic-negative because healing settlement is deferred. Dwarf is a bounded four-modifier fixture, not complete trait coverage. Magic Initiate requires a matching spell catalogue and its extra recovery/slot interpretation is documented. No fixture was substituted into the coverage report.

No existing Web tests/assertions/skips or runtime code changed. The original Web worktree remains clean and unchanged. Independent repository G1 reports stay intact. Stage rollback: revert this isolated G2 commit; the Web repository has no dependency on it yet. Emergency baseline tag in each worktree: `automation-g1-baseline-20261003`.

Next: G3 field-family derivation and real-data equivalence against the unchanged Web implementation. Do not proceed to G4 until equivalence is complete or differences have recorded dispositions under the user's authorization.

| File | SHA-256 |
| --- | --- |
| schema/automation-ir.schema.json | 1397e5e543391b0b4830ba12211cc2c290e66af1259eca2861cfe3ca1f907235 |
| schema/overlay.schema.json | c8c3f6ae3601a704f94e978037c38ae6a4e988cd7b0395339026a13b588ad77c |
| src/identity.ts | 011676d56801e0193c89fa903e698d59bdebe6d19a40cd232956d54e5928291b |
| evidence/g2/tests.log | 0d9d756acc2846fc6e28d2fe221843e30067ca3c916084b7ffece4c0b1ad5d7d |
| evidence/g2/build.log | 7ab4b8718dce6f7f8d2f761e99a1e356597d3a1060496aa795e20e2e034a05a0 |
| evidence/g2/node22-vitest.log | 118b4a71ee24c7a10b19b4aea298146c013056701bcbce827d5ca727299fb272 |
| evidence/g2/node22-inventory.log | e61f8e609317b2a43acc9928d71d235667504e77e641b4328dae1261660ff9f5 |
| evidence/g2/node22-build.log | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
