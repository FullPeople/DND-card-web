# DND Card Web

Read docs/PRODUCT.md, docs/ACCEPTANCE.md and docs/STATUS.md before continuing.

- This is an independent web migration; never edit or reset the Godot source or the reference native apps.
- Preserve the original character sheet's gray StyleBox framing, bottom labels, paper layout and information hierarchy. Do not replace it with a generic dashboard.
- Rules identify missing choices on the sheet. Users browse and drag content themselves; no compulsory next-next wizard.
- 2014 and 2024 have separate identities and rule profiles. Never merge by display name.
- Rule evaluation must be pure and independent of React, browser storage and native interfaces.
- Source snapshots, rule behavior, user choices and runtime resources have distinct ownership. Refresh must not grant one-time resources again.
- Disabling a source preserves user choices and shows their restricted state. Imports validate before mutation. Unknown rules must be visible, not silently treated as supported.
- Do not publish private character files or upstream content snapshots into this public repository.
- Meaningful tests cover transitions, persistence recovery, rules, imports and real browser flows. Never call the product complete based only on a build or mocked tests.
- User authorized creating the public GitHub repository and advancing implementation. Record concrete validation and limitations in docs/STATUS.md.
- C++ is a later stage; keep small async platform interfaces without building a speculative native framework now.

