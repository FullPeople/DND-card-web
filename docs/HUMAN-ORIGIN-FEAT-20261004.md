# Human origin-feat choice · independent candidate

## Report and baseline

Reported 2026-10-04: the 2024 Human versatility trait cannot accept an origin feat through automation. Checked remote `main` at `04d8a84` before creating the isolated candidate. Public `/card/release.json` still identified `standalone-1.0.243`, announcement `0.1.34`, runtime source `fbccf5725e93e605b016858d3f45d35bddb27f08` during diagnosis. This is not a release receipt.

The actual XPHB Human data declares `feats[].anyFromCategory.category: ["O"]`. Its generated Versatile trait (currently translated as 多用) has a filter tag with `category=o`. Catalog feats store `category: "O"`. The prior exact-case comparison therefore produced zero candidates for `human:trait:2:filter:0`; the UI also mistook the empty result for a non-Wiki choice and showed no drop slot. Existing fighting-style examples use uppercase `FS`, which is why they did not reveal the mismatch.

## Narrow change

- Compare the declared category code case-insensitively; retain category, edition, source and exact entry identities. No race/class/feat-name branches and no “any feat” fallback.
- Keep the existing `:filter:0` answer and grant identities. Do not add a second choice from the parent race's structural declaration.
- De-duplicate saved snapshot/catalog identities with saved snapshots first. A newer catalog label or body does not silently replace the owned snapshot.
- Retain the Wiki feat drop slot while candidates load. Existing saved grants remain available from their snapshots.
- Apply the existing source/optional-feat/duplicate checks to new selections, excluding the grant already owned by this same choice. Repeated drops remain no-ops; replacement and clearing retain their normal source ownership.

Both standalone and Suite-integrated builds use these shared modules. No Suite host, backend, player document, automation-IR branch, release version or deployment package is changed.

## Validation

- Red baseline: the original two focused tests failed before editing. Re-running the expanded five-test suite against isolated `04d8a84`, including current external Human/feat data, produced five failures.
- Candidate: authored metadata tests cover category and edition, source bubble, capacity, invalid options, non-repeatable duplicates, repeated drop, replacement, clearing, nested supported skill choices, disabling/re-enabling sources, export/import, delayed catalog and saved-snapshot precedence.
- External data test reads snapshots outside this repository. It verifies the actual Human trait and all 13 normalized XPHB origin entries (10 base feats and three declared variants), then selects an actual origin feat without changing player data. Full upstream snapshots are not committed.
- Final local full check: 837 unit tests passed / 25 external-condition skips, TypeScript and integrated build passed; standalone build passed separately. Seven origin-specific tests include the current external-data test. Independent review found and verified fixes for snapshot precedence and custom-option fallback; no remaining actionable findings. Remote CI receipts follow separately.
- New browser regression targets standalone and integrated entry builds, using only authored fixtures. Local Chromium launch was blocked by `socket() ... Operation not permitted`, including an approved retry; the dot cloud browser reported `ERR_BLOCKED_BY_CLIENT` for localhost. No browser scenario ran locally. CI must provide the browser result; discovery/type checking is not a browser pass.

## Explicit limits

This restores selecting/granting the feat. It does not claim all nested origin-feat rules are supported. Existing Magic Initiate filter-string spell choices remain explicitly unsupported by the current source-spell resolver; Crafter's explicit tool-choice shape is supported, while Musician/Skilled specialized proficiency fields are separate gaps. A synthetic supported nested skill choice exercises the ownership/persistence path, not those unsupported real rules.

The current product deliberately leaves general feat prerequisites to the player/DM (`tests/core.test.ts`). This patch preserves that policy rather than introducing a new prerequisite evaluator. General/epic/wrong-edition feats are still excluded from an origin-only candidate set. The pre-existing broad prose parser can treat a replacement sentence as another choice (observed on Fighting Style); that separate behavior is not expanded or claimed fixed here.

User authorized publishing this independent branch and running CI after local diagnosis. No merge or deployment is authorized.
