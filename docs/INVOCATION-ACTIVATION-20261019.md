# XPHB Armor of Shadows activation candidate

Learning an invocation remains a saved record. The reviewed
`Armor of Shadows|XPHB` record now offers a separate opt-in activation beside
the learned slot, including when no other feature group is displayed. Activation
grants the uniquely resolved XPHB Mage Armor snapshot. Its payment menu and saved
cast receipt say self only; it costs no spell slot and does not create a use
counter. The original spell range and all source prose remain unchanged.

Cancelling activation or replacing its learned slot removes the automatic spell.
A saved activation pauses when the learned quota or enabled source no longer
permits it, and resumes from retained answers when that ownership returns.
Pre-existing manual spells and character notes remain separate. Old learned
answers and manually added invocation selections do not silently become free
casts. Altered spell declarations, other editions, corrupt answers and broadened
saved target constraints cannot execute this reviewed grant.

Source: [2024 Basic Rules invocation options](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#EldritchInvocationOptions),
checked 2026-10-19. The actual frozen optional-feature input has SHA-256
`031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844`.
The actual-source test verifies this lock and the Warlock/spell input locks,
resolves the translated spell UID, saves/reopens the grant and checks its
original range. Only authored fixture metadata and hashes are committed.

Reproduction: four workflow tests failed before implementation. A subsequent
render test reproduced the missing activation entry point before its repair.
Current validation: ten workflow/source/render tests pass; 128 tests pass across
ten related suites, with five pre-existing optional-source cases skipped.
TypeScript passes after materializing the sparse checkout's supporting files.
The new actual-source test runs with `DND_AUTOMATION_INPUTS`; it is not skipped in
this local evidence.

An additional failing regression reproduced a later download invalidating an
already saved spell snapshot. Resolution now preserves the character's stored
spell before considering a same-ID catalog revision, matching source-spell
planning and offline reopening.

This is a local follow-up candidate based on ASI source commit
`fd6b8cb09a79dba12e39a426f31fd4885c4f3d47`. Its own full-corpus evidence,
builds, complete suite, isolated browser acceptance and remote CI remain pending.
The ASI batch's running replay uses a separate immutable checkout and does not
certify these newer invocation bytes.

This grant records the self cast and its payment. Mage Armor's duration,
armor eligibility and AC effect still need player adjudication; this is not an
encounter-effect evaluator. Other invocations, PHB variants and Artificer
infusion activation require separate reviewed mechanisms.

Rollback: revert this source candidate together with any later paired runtime
ledger adoption. Retained activation answers become inert; manual spell
selections and base character data need no migration. No merge or deployment.
