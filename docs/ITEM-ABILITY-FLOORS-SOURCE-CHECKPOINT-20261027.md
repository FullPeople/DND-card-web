# Worn and attuned item ability floors: source checkpoint

This independent source-only checkpoint follows `233107aeb79e3980a9e12cd0958f49503174ff2b`. It is outside the frozen ordinary/limited/item-charge report and does not replace that report's evidence. Not merged or deployed.

## Implemented mechanism

Eighteen source-verified item identities (nine DMG 2014 and nine XDMG 2024) project their fixed ability floors only while the authentic unique single owned root item is explicitly equipped and attuned. The reviewed floors are Constitution/Intelligence/Strength 19 and the six giant-strength belt floors 21/23/23/25/27/29 in each edition. Full source snapshots, pack, edition, headers, canonical and alias identity, and current source eligibility remain required. A higher existing score is never lowered; competing floors use the maximum.

The projection runs after natural advancement caps and before derived modifiers. It does not rewrite base abilities, manual adjustments, saved character structure, HP/resources or source records. Existing saved-effect legacy-source policy is retained across character-edition changes; source-entry edition and complete fingerprints are still strict. Equipment-only source-choice eligibility remains visibly held where the source policy is not reviewed, rather than inventing a universal rule against equipment qualifications.

## Directed evidence and remaining work

The actual pinned item input first produced 18 expected failing floor cases. A later existing-policy review exposed two failing cross-edition cases; the redundant character-edition restriction was corrected without relaxing entry identity. The final four directed files passed 37 checks with zero skips (19 source, 10 fundamental guards, three legacy-policy and five server-rendered UI checks), and the installed compiler passed. An earlier separate 111-case retained regression gate preceded that last policy correction and is not claimed as a final-source rerun. The original red results and first type-check failure remain recorded.

CI wiring uses the existing verified full-input materializer and a required pinned-input environment, with no fallback or source-test skips. No new upstream content snapshot is published.

A separate single-worker, 512 MB, startup-denied offline check passed all three real-loader routes: cold loading of the three original equipment inputs, warm parsed cache and raw-cache rebuild. Each route authenticated all eighteen complete entry fingerprints and expected floors through the real reader JSON codec, App last-write-wins map and card catalog publication; warm/rebuild made no fetches, and unexpected requests were zero. The installed compiler also passed after adding this test. This closes the observed equipment-loader composition gap only: mounted App/DOM/browser, browser worker scheduling, unknown saved-card compatibility, exact-head CI and paired runtime-report acceptance remain unproved. Formula-derived resource capacities/recovery and unreviewed equipment-only prerequisite policies remain manual or explicitly held; no resource refill, attunement procedure or slot-limit automation is claimed.

This is partial mechanism implementation, not whole-entry completion. No progress-page percentage increase or new replay witness is claimed. The embedded historical report is not new proof for this source.
