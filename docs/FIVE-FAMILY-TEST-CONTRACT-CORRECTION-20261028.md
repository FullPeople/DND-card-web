# Five-family test-contract correction

The first exact-source CI run, [40638535142](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40638535142), executed 674 cases against Web `2d5033c584b752e3445401351bdfb206a450da74`: 672 passed, two failed, zero skipped. All eight mounted cases executed; seven passed. Input/checkout verification and the locked install succeeded. The three closed metadata artifacts were verified separately; raw source bodies and raw child logs were not published.

This corrective checkpoint changes tests only. Product `src`, workflows, dependencies, source inputs, all 674 case identities, assertion budgets and retries remain unchanged.

- The darkvision workflow contract used an obsolete exact command substring containing only the original two family globs. It now parses the executable command arguments and requires the at-will, darkvision, ability-floor and movement globs exactly once, with the sole worker option unchanged. It rejects arbitrary extra options rather than treating a loose string match as proof.
- The optional-list mounted test assumed an inline spell picker and a `data-entry-id` attribute. The actual spell workspace uses Wiki drag slots; `Reference` exposes `data-reference`. The corrected host uses the existing real Reference / EntryDragProvider pointer path, exact full entry identity, one enabled candidate and one owned target slot. The original navigation, unique owner allocation, persistence and manual-state assertions remain. It does not force a disabled click or add a product-only test hook.
- An existing SSR case additionally verifies the actual Reference identity representation. Local directed checks passed 18/18, and the installed compiler passed with zero diagnostics. The corrected mounted interaction is still **not run locally**; exact-head CI must prove it.

The original failing results remain historical, not replaced with the corrected head's results. The corrected gate must execute all 674 cases, including all eight mounted cases, before acceptance. This is not a new full-catalog replay, whole-entry completion, release, merge or deployment.

## Remaining mounted host correction

The second exact-source run, [40643346560](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40643346560), executed all 674 cases: 673 passed, one failed, zero skipped. All eight mounted cases ran, with seven passed. The darkvision workflow contract passed; the same optional-list multiclass mounted case remained failing. Ordinary validation passed separately. Neither run is accepted as the complete gate.

The real `Reference` pointer handler requires a Wiki or keyword-preview ancestor. The authored catalog lacked that production host class, so it never started a drag. A bounded node-environment contract executed the actual handler: the original host produced one pass / one failure; adding the authentic Wiki class produced two passes, retaining the absent-host negative. This is handler proof, not mounted DOM proof.

This follow-up changes only the test host and adds an exact ancestor assertion and a fixed sequence of body-free diagnostic stage markers. Product source, all prior behavioral assertions, all 674 case identities, budgets, dependency locks and source inputs remain unchanged. No forced click or animation stub was added. The next exact-head CI diagnosis runs only the four existing optional-list mounted cases, with exact identity/count checks and no fallback to the full gate. The complete 674-case gate remains required after that real mounted flow is proven.
