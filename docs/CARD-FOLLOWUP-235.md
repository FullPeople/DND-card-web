# Card follow-up: eight requested changes

Candidate based on Web `2df749a9e020c0baee6a372d081fc4e33fcddc95`, paired with Suite dev `6ecaa586` (stable main is a separate lineage). This work changes a repair branch only; it does not merge or deploy.

## Scope

1. The approved four original PNG components enter with translation, rotation and opacity on a full `#FFFF56` background. No lobby or ordinary startup text is shown. The overlay fades after both the animation and card initialization finish. Slow-loading and failure recovery remain available. The PNGs and motion values match the approved source at `83299f46b3ec62fb0a1bc9f8cb62f366f614b67c`, `prototypes/logo-lobby/`. Original PNG byte hashes and startup ordering are tested; the assets are included in the offline shell.
2. Ability fields show the evaluated total at rest. Focusing an editable field exposes the stored base value; committing updates that base, then displays the derived total again.
3. Already-owned numerical bonuses and feature-resource formulas no longer stop merely because the card edition changes or an older racial-ability marker is absent. Explicitly disabled selections and sources remain disabled. Catalog, automatic spell grants, spell synchronization and casting edition filters remain unchanged.
4. Token-image fallback portraits use the same framing controls as explicit portraits, without persisting the fallback image URL as a new portrait. Visibility eyes sit beside the title text.
5. The main-page spell frame has a persistent edit-mode visibility control. Hidden frames disappear outside editing and the adjacent content expands.
6. Wizard spellbook rituals appear as a “来自仪式施法” section inside prepared spells, rather than a separate outer frame.
7. Spell-slot headings use “共用” only for multiclass cards. Default resource rows gain layout-neutral separators. Player overview resources use the dashboard layout/editor and no longer display the layout-disrupting resource-count text.
8. Dragging a tool from proficiency-oriented equipment entries carries a proficiency intent and does not switch to inventory or add an inventory item. The same tool dragged from the actual equipment catalog retains ordinary inventory behavior.

## Validation

Local final validation: 711 unit tests passed, 24 existing external-data cases skipped; TypeScript, integrated and standalone production builds passed. Ten new browser scenarios were discovered for the dedicated workflow group. Suite 16 regression scripts passed, including the paired announcement check after correcting its required checkout environment variable; the paired dev build passed. Remote CI results are reported against the exact pushed commit. Browser tests must run in the remote verification workflow: the local Chromium process fails before page navigation with a socket-permission error. Unit tests, type checks and production builds do not substitute for browser or actual-room results. No actual player data or production rooms are changed by this candidate.
