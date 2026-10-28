# Five-family test-contract correction

The first exact-source CI run, [40638535142](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40638535142), executed 674 cases against Web `2d5033c584b752e3445401351bdfb206a450da74`: 672 passed, two failed, zero skipped. All eight mounted cases executed; seven passed. Input/checkout verification and the locked install succeeded. The three closed metadata artifacts were verified separately; raw source bodies and raw child logs were not published.

This corrective checkpoint changes tests only. Product `src`, workflows, dependencies, source inputs, all 674 case identities, assertion budgets and retries remain unchanged.

- The darkvision workflow contract used an obsolete exact command substring containing only the original two family globs. It now parses the executable command arguments and requires the at-will, darkvision, ability-floor and movement globs exactly once, with the sole worker option unchanged. It rejects arbitrary extra options rather than treating a loose string match as proof.
- The optional-list mounted test assumed an inline spell picker and a `data-entry-id` attribute. The actual spell workspace uses Wiki drag slots; `Reference` exposes `data-reference`. The corrected host uses the existing real Reference / EntryDragProvider pointer path, exact full entry identity, one enabled candidate and one owned target slot. The original navigation, unique owner allocation, persistence and manual-state assertions remain. It does not force a disabled click or add a product-only test hook.
- An existing SSR case additionally verifies the actual Reference identity representation. Local directed checks passed 18/18, and the installed compiler passed with zero diagnostics. The corrected mounted interaction is still **not run locally**; exact-head CI must prove it.

The original failing results remain historical, not replaced with the corrected head's results. The corrected gate must execute all 674 cases, including all eight mounted cases, before acceptance. This is not a new full-catalog replay, whole-entry completion, release, merge or deployment.
