# Source-qualified worn-item resistance: first-pass checkpoint

This checkpoint implements a real owned-equipment to derived-defense workflow for 30 source-qualified item owners: 20 Dragon Scale Mail records across distinct 2014/2024 identities and ten concrete 2014 Ring of Resistance records. It is not 30 completed entries, automatic damage settlement or a runtime-progress percentage increase.

## Player behavior

- A current single physical root item must be worn and attuned, source-enabled and authenticated by its entire canonical or actual catalog-composition snapshot. Canonical and coherent alias disabling both suspend the projection without deleting records.
- The existing armor-slot conflict predicate also gates Dragon Scale Mail resistance. Its existing AC route is retained; rings do not consume an armor slot.
- Each concrete reviewed item supplies only its one source-qualified damage type. A generic ring is not a free player damage-type selector. Immunity, detection, advantage, timed effects, curses and other branches are not inferred.
- The derived resistance union preserves existing infusion values and provenance and deduplicates equal types. The existing AutomationPanel displays the closed set and held/inactive reasons, including in read-only rendering. Review/export wording now says automatic resistance rather than falsely labelling every source as an infusion; unverified Owlbear defenses remain empty.
- HP, temporary HP, manual notes, source snapshots, stored choices, equipment, attunement and spent resources are never rewritten by calculation. Damage reduction and HP application remain explicitly manual. No holding flag, persisted protocol or new permission system is introduced.

Ten concrete 2024 Ring of Resistance records remain held because their attunement condition is not explicitly proved by the reviewed metadata. Omission is not proof that attunement is unnecessary, and a manual attuned checkbox does not repair missing source policy. Their editions are not merged with 2014 records. Other resistance-tagged items remain unreviewed rather than receiving effects from a tag alone.

## Evidence and limitations

Three original item inputs are byte/hash locked, a subset of the existing 229-input corpus. Four grouped source checks cover all 30 canonical and 30 actual catalog-composition forms and the ten held headers. All 30 existing-engine canonical numeric cases then failed specifically at the missing resistance assertion with the product projection absent; the App numeric loop was not reached after the first canonical failure and is not represented as App numeric RED.

After implementation, 57/57 groups passed without skips or retries: 45 new-family source, numerical, guard, lifecycle and SSR groups plus twelve retained infusion-projection cases. All 60 canonical/App numerical paths were reached. Source and assertion bytes were unchanged during that window. The final installed compiler has zero diagnostics. Its first failure was a required-property deletion in an intentional malformed test; an erased type annotation preserves the tested runtime and assertions byte-for-byte.

An initial private evidence-generation wrapper failed to resolve its external idb import before reading inputs. The failure is retained. The corrected wrapper bundles the already installed exact locked idb 8.0.3; no source, policy, network access, assertions or budgets changed. Execution inherited the startup network-deny, one-worker and 512 MB constraints.

Two mounted interactions are authored but NOT RUN. Panel source/equipment transitions in the passed SSR checks are explicit prop/state rerenders, not inventory gestures. Full-App, old saved-card compatibility beyond the observed native round trips, and release acceptance are not claimed. Old clients do not calculate this new derived projection. Previous family results are not relabelled as this source's acceptance.

This source-only checkpoint is stacked on Draft PR126 at 5b429566475a77b69ed7a08749139321a6ca4b9e. Fresh grouped source-bound replay/report pairing, broader exact-head CI and 148 full-App checks remain open. The earlier pending G1 report operation is untouched. No new report witness, whole-entry completion, merge or deployment is claimed.
