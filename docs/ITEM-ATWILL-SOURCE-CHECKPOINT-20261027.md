# Owned-item at-will casting — initial source checkpoint

This isolated checkpoint implements two verified DMG2014 sources: Helm of
Comprehending Languages and Boots of Levitation. It is not merged or deployed.
The broader structural candidate inventory is not an implementation count.

The player explicitly confirms the owned physical item. Current source,
edition, unique ownership, worn/attuned marks and edit/GM authority are checked
again. The resulting free spell remains attached to that item, not a learned
spell or ordinary preparation allocation. Boots' self-only restriction is
authenticated in the action request and performer, not only displayed text.

Withdrawal, stale/duplicate requests, source suspension, native persistence,
opaque future data and current-authority Undo/redo have directed coverage.
Unrelated generic item benefits and manual data remain independent. The UI
acknowledges a validated current source-owned intent, not a callback return or
untrusted saved nonce.
An occupied generated child ID is not adopted without matching ownership and
full target/configuration. A manual collision holds this new source without
overwriting the existing spell's settings or preparation.

Validation: 12 functional/ownership checks and 18 source checks passed in
separate current-source runs; seven SSR/call-site checks passed;
types passed. Three DOM workflows are authored but were not run locally because
the installed DOM dependency is unavailable. Earlier failures/timeouts were
retained; assertions and five-second case budgets were not relaxed.
The actual spell-page readonly expression is exercised for every current
guarded namespace and the new item route; the original missing-forwarding
failure is retained. This is composition/SSR evidence, not a mounted viewer run.

Spell effects, timing/action economy, components, casting statistics, damage,
duration, concentration and upcast effects remain manual. Actual worn and
attunement procedures, eligibility and slot limits require player verification.
This is partial source-casting support, not whole-item completion or safe
old-client editing.

The coverage report inherited from the parent is historical and is not paired
to this source. No new witness count, percentage, whole-catalog replay, actual
App result or exact-head CI acceptance is claimed by this checkpoint. It does
not reuse the separate parent candidate's browser results. No raw source prose,
real cards or private inputs are included.
