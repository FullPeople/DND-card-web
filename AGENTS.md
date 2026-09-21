# DND Card Web

Read docs/PRODUCT.md, docs/ACCEPTANCE.md and docs/STATUS.md before continuing.

- This is an independent web migration; never edit or reset the Godot source or the reference native apps.
- Preserve the original StyleBox appearance: thick dark-gray frames, light-gray contents and gray title bands with white text. The current local UI revision uses cut corners on every frame, with the title and content clipped together. Keep the approved reference-sheet hierarchy and fixed A4/five tabs; never replace this with a generic dashboard.
- Only background, race, class, subclass and size use animated dashed outer frames. Other outer frames stay solid; internal missing-entry styling is a later UI iteration. Preserve working fill links and choices.
- Latest status visual contract: design/STATE-EFFECTS-PROPOSAL.md. All effects may coexist across all five pages; editing restores normal layout. Invisible status temporarily makes otherwise solid frames dashed. Death saves replace the former status box; status bubbles live beside the edition title.
- During the current UI feedback phase, make local changes and provide screenshots. Batch full validation and publication after the user requests it; do not push each visual iteration.
- The current manual-sheet mode does not generate quota/choice prerequisites or a right-side filling state. Players freely edit proficiency and choices. Attach only explicit source references and named feature content; never branch on specific class/feature names. Identity gaps still link to the catalog.
- 2014 and 2024 have separate identities and rule profiles. Never merge by display name.
- Rule evaluation must be pure and independent of React, browser storage and native interfaces.
- Source snapshots, rule behavior, user choices and runtime resources have distinct ownership. Refresh must not grant one-time resources again.
- Disabling a source preserves user choices and shows their restricted state. Imports validate before mutation. Unknown rules must be visible, not silently treated as supported.
- Do not publish private character files or upstream content snapshots into this public repository.
- Meaningful tests cover transitions, persistence recovery, rules, imports and real browser flows. Never call the product complete based only on a build or mocked tests.
- User authorized creating the public GitHub repository and advancing implementation. Record concrete validation and limitations in docs/STATUS.md.
- C++ is a later stage; keep small async platform interfaces without building a speculative native framework now.
