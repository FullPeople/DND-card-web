`irFixture.ts` is an explicit test authoring adapter for existing structural
fixtures. It calls a frozen copy of the independent data derivation code, then
attaches the resulting declarative fixture record. It never infers mechanisms
from prose. Application modules must not import this directory.

`structured-models.generated.js` was bundled by esbuild 0.28.2 from the G5
working tree of `FullPeople/dnd5e-automation-data` (`derive/structured` plus
`makeContext`); its provenance and exact digest are recorded in the G5 runbook.
This source bundle contains no publisher corpus or player data. It uses the
repository's existing source license.

Expected numbers and safety assertions remain authored in the original tests.
Narrative mechanisms require explicit `Mechanics` fixtures. Runtime tests also
use hostile raw fields to prove that this adapter cannot serve as an application
fallback. Fixture verdicts are excluded from coverage reports.
