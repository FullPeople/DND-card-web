# Owned-item at-will casting — source checkpoint

This isolated checkpoint implements 13 verified physical item versions
(five DMG2014 and eight XDMG2024), with 20 exact direct-or-self free-spell
branches. The 45 other structural candidates remain held. The initial two-source
checkpoint is retained in commit `0a1764542e05a7b8da30ec73d9ea39a74b6706a5`.
This is not merged or deployed; structural inventory is not implementation.

The player explicitly confirms the owned physical item. Current source,
edition, unique ownership, equipped/attuned marks and edit/GM authority are checked
again. The resulting free spell remains attached to that item, not a learned
spell or ordinary preparation allocation. Boots' self-only restriction is
authenticated in the action request and performer, not only displayed text.
Source-specific action timing is also bound to the performer and displayed
separately from ordinary spell timing, including Ring of Jumping's bonus action.
This does not enforce action economy or apply spell effects.

Withdrawal, stale/duplicate requests, source suspension, native persistence,
opaque future data and current-authority Undo/redo have directed coverage.
Unrelated generic item benefits and manual data remain independent. The UI
acknowledges a validated current source-owned intent, not a callback return or
untrusted saved nonce.
An occupied generated child ID is not adopted without matching ownership and
full target/configuration. A manual collision holds this new source without
overwriting the existing spell's settings or preparation.

Validation: 94 focused core/source/adjacent checks passed, including actual
execution of all 20 branches across the 13 source versions. Nine SSR/call-site
checks and types passed. Two authored native cards from the initial checkpoint
preserved intent, owned children and manual data while missing cached timing
was derived from the current verified rule; contradictory cached timing is held.
Three DOM workflows are authored but were not run locally because
the installed DOM dependency is unavailable. Earlier failures/timeouts were
retained; assertions and five-second case budgets were not relaxed.
The actual spell-page readonly expression is exercised for every current
guarded namespace and the new item route; the original missing-forwarding
failure is retained. This is composition/SSR evidence, not a mounted viewer run.

Spell effects, action economy, components, casting statistics, damage,
duration, concentration and upcast effects remain manual. Actual wearing/holding
and attunement procedures, eligibility and slot limits require player verification.
This is partial source-casting support, not whole-item completion or safe
old-client editing.

The coverage report inherited from the parent is historical and is not paired
to this source. No new witness count, percentage, whole-catalog replay, actual
App result or exact-head CI acceptance is claimed by this checkpoint. It does
not reuse the separate parent candidate's browser results. No raw source prose,
real cards or private inputs are included.
