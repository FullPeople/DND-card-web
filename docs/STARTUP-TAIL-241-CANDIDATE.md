# 241 post-logo tail: measured cause and bounded candidate

Source examined: deployed Web main `9e8cf1fdafcb29d5573a8467418ea32b9ad41f70`. This source does not contain the separate owner-sync/startup candidate `b336325`. The live `/card/` HTML normalized SHA-256 is `bfc35491f9c0b5fec4fddbfe513690f6aa13247ab6606099612293cf3be74b6c`, identical to the local 9e8cf1 production build; its primary App/core/CSS/index asset names also match. This candidate leaves 241 logo files, inline image treatment, animation timing, styles, release numbers and announcements unchanged.

## Evidence before edits

Read-only [profile run 37135294108](https://github.com/FullPeople/DND-card-web/actions/runs/37135294108), artifact `startup-tail241-profile`, used new isolated browser contexts without user cookies/login, private cards or real room connections. The Suite sample was its public workbench entry without a room fragment. Production data was real except explicitly labeled empty-fixture controls.

One live fresh context, with initial editing preference null and final false, reproduced a **7.119-second pause after the last logo layer ended**:

- Last layer ended: 9.028 s; intended hold ended: 9.358 s
- Card CSS finished: 9.622 s; stylesheet event: 9.626 s
- App entry response finished: 12.012 s
- Shared `card-core-B5XCFCXc.js` response finished: **15.732 s** (207,006 transferred bytes; gzip and immutable caching headers confirmed)
- Main module stage event: 15.768 s
- IndexedDB open: 16.099–16.100 s; workspace read: approximately 0.1 ms
- Evaluated card ready/fade: 16.147 s; longest observed task: 50 ms

No Wiki/catalog/rule-data requests occurred before completion. This particular slow live sample used the empty-data control. Another real-data fresh sample was already ready before the animation ended. It is incorrect to attribute that difference to mocking: the two runs had different real network response timings.

Under identical local gzip delivery, 64 KiB/s and 150 ms latency, fresh real/empty-data 241 samples were both ready at 6.288 s. Thus the evidence rejects a newly blocking default Wiki/data await as the cause of this reproduced tail. The saved-editing case was separate: its runtime request added roughly 174 ms locally; the fresh context had editing=false. There is no additional five-second animation timer.

The last gate in the reproduced fresh tail was critical JavaScript arrival, followed by normal module execution/render, not logo loading, the database, a timer, or rule-data parsing. This does not establish that every user's network has the same timings.

A same-run released-230 build (`4e398a39a5cb37e5e632ae377fdf2488cdc3924c`) used the same dependency versions. Its actual paper mount was approximately 4.915 s versus 241's 6.289 s. The legacy 230 ready event fired before its IndexedDB read, so it must not be compared directly to 241's stronger ready gate. Combined critical JS/CSS gzip grew by about 18 KB; 241's embedded-image HTML also grew from roughly 2.3 KB to 83.5 KB gzip. These are delivery changes, not proof that the old Wiki split was reversed.

## Candidate changes

- Extract pure class-compatibility queries/fingerprints from migration transactions, the lock glyph from the resource editor, and condition-entry data from the visual component. Existing calculations, migration signatures and exports remain compatible.
- Verify the actual built import graph: migration transaction and source-spell mutation implementation cannot belong to the first-card static chunk graph. Previously a tiny dynamic `cardRuntime` wrapper re-exported mutation implementation already in core; the implementation is now in a separate lazy chunk.
- Keep workspace validation, current character and pure derived values as ready prerequisites. Restore a saved editing preference asynchronously, with the switch disabled and aria-busy while pending; its download no longer hides the complete read-only card. The preference is preserved and automatically restored after load. No empty placeholder card is used as a readiness substitute.
- Release deferred tools after a failed opening so a subsequently restored backup can use editing/Wiki; announcement completion remains a separate gate.

Measured standalone core gzip: 208,662 → 200,669 bytes (about 3.8%); first stylesheet gzip: 56,043 → 54,469. This is a modest reduction. **It does not prove elimination of the fresh-user 5–7-second network tail.** Saved-editor and recovery fixes must be reported separately from fresh-start transfer performance.

## Verification status

- Original 9e8cf1 fails the new failed-recovery unit case (two previous cases pass), and fails the built static-boundary check because migration/source-spell implementation is in core.
- Candidate: 801 unit tests pass, 25 conditional skips; focused migration/recovery tests and TypeScript pass; both production builds and static-boundary checks pass. Independent review found no validation, fingerprint, stale-permission or saved-data safety blocker.
- Dedicated browser cases block the actual editing chunk and require the original card name, HP and resource balance to survive while readable; the saved preference must resume after release. A backup-recovery case requires both editing and Wiki to load afterward. These tests run only against production builds.
- The next candidate workflow builds fixed 230 and 241 baselines alongside the candidate, profiles all with identical delivery, records baseline saved-editor blocking as a negative control, then runs candidate browser cases. Actual CI outcomes remain required; local browser restrictions were not bypassed.
