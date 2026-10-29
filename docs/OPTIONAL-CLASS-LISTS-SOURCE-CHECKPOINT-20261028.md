# Source checkpoint: explicit optional class spell lists

This isolated development branch adds first-pass list eligibility for seven exact PHB 2014 class owners, using the independently verified TCE optional-feature tables and the existing frozen spell lookup. It is not merged, deployed, release-ready, or a new complete-catalog runtime report. The progress-page denominator and percentages are unchanged.

## Implemented scope

- Seven qualified owners: Bard, Cleric, Druid, Paladin, Ranger, Warlock and Wizard. Their tables contain 101 owner/spell associations across 68 distinct spell targets; eight associations already belong to the same owner's base list and retain that independent access.
- The player explicitly attests that inclusion was discussed with the DM and separately chooses this optional feature for the owned class. This is not a new two-person authentication system. Enabling a book alone does not opt in a class.
- Confirmation makes qualified spells eligible for the existing learn/prepare workflow. It does not add spells, preparation slots, capacity or free casts. Existing class-level, quota, preparation and ordinary paid-cast checks remain in force.
- The spell page exposes a class-scoped control and its actual choice workspace. Related navigation retains the same host and owner, including cantrips. Confirmation, withdrawal and delayed edits use live edit/lock authority.
- Withdrawal and class removal revoke optional-only eligibility without deleting manual spells, another class's spells, or base-list access. Saved state and explicit Undo/redo retain existing protected-history semantics; reopening or re-adding an old owner is not a new confirmation.
- Full source identity, canonical and transport IDs, enabled sources and current owned-class context are checked. Unknown future state is preserved inactive, not converted to a new confirmation.

## Source and validation

The runtime fixtures use eleven already frozen original inputs (2,351,778 canonical bytes). Semantic qualification additionally verifies `tjliqy/5etools-cn` revision `5cc0bbe2c2b241a334e731af4448bdba2168e8bd`, `data/book/book-tce.json`, 465,199 raw bytes, SHA-256 `0745f1a881ce2b9e25a13f66923821aa333e3df0622ce9135c273cfb4d62cf33`. This independent policy proof does not extend the 229-input runtime corpus. Its prose is not committed or included in artifacts.

Actual missing-workflow RED tests were preserved for all seven owners. The frozen local source then passed **220/220** checks with no skips: 183 source checks, seven real selection/preparation to paid-cast/reopen/withdrawal flows, ten guard cases, fourteen SSR/callsite cases and six offline fetch contracts. The installed TypeScript compiler reported zero diagnostics. The first compiler failure and earlier checkpoints remain distinct from this final result.

Four mounted interaction cases are authored but **not run locally** because the installed jsdom dependency is absent. The CI wiring uses the normal locked dependency install, strict private input materialization and the fixed immutable semantic-source fetcher. CI/browser results are not claimed here. Existing runtime-lock validation is unchanged; this source checkpoint does not substitute its new source for an older paired report.

## Explicit holds and limits

- Sorcerer's 21 associations remain held because the pinned source heading/owner and introductory paragraph conflict. Its four existing base overlaps remain accessible; none of these 21 are silently granted as new optional access. All twelve base overlaps across the original eight owners are preserved.
- Warlock high-level/Arcanum and other separate casting mechanisms are not implemented by this list-access adapter.
- The other 186 source-defined base-list rows and unqualified optional sources are unchanged, not declared complete.
- Unknown saved-card revisions and changes made by old clients cannot be universally detected. The UI warns the player to withdraw, review and explicitly reconfirm after such changes.
- SSR and callsite checks are not mounted DOM, full App, multiplayer authority or complete-entry acceptance. This family adds real list-selection capability, not whole-entry completion or new progress-page credit.
