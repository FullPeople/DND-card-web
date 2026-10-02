# Dashboard editor follow-up (2026-10-02)

## Implemented contract

- The sheet's 快捷栏 heading opens the full editor in viewing and editing modes. The separate dashboard button and resource pager are removed. Weapon/attack organization is available from its title.
- Resource modules use one vertically scrolling surface. Existing `page`, `x`, `y`, `w`, and `h` data remain compatible: stored pages are now vertical coordinate bands, without page navigation. Editing includes one empty band for expansion. Reading does not rewrite layouts.
- The desktop editor has a central layout preview, right-side candidate library, and lower new/selected module settings. At narrow widths the library follows the settings vertically.
- New modules explicitly choose single or multiple resources. Multi-resource setup accepts a group title and independently named, current, optionally capped children. Manual resources never infer a connection to real spell slots from their names.
- Candidate styles are filtered by single/multiple mode and capacity. Saved style identity stays unchanged after capacity changes; incompatible existing values remain readable without silently changing the artwork or counters.
- Toolbar deletion removes a module from the visible quickbar only. Its resources remain intact and can be restored from the library. Existing child-resource deletion retains its explicit settings action.
- `contentScale` is optional layout metadata, validated between 0.5 and 2. It scales inner text, numbers, icons, and spacing without changing layout geometry. Saved absence means 1.
- Icon arrays omit redundant fractions, segmented strips retain fractions, the ring uses close diagonal current/max values, and unbounded resources omit upper-limit symbols. The single-use style defaults to a compact 2×2 box.
- Unset attack/resource divider defaults to 40%; saved divider preferences remain authoritative.

## Data and performance

Existing source generation/destruction, locks, resource values, and mature maximum overrides are retained. The editor still uses a detached draft and an explicit save with conflict detection. A cancelled draft cannot mutate the opening card. Unrelated incoming counters merge while conflicts fail visibly.

The initial editor formerly cloned the whole character twice. The opening baseline now keeps the immutable React character snapshot while `createDashboardDraft` makes the detached editing copy. App edits clone before mutation; source data and opening baseline are not modified by this editor. This removes a verified duplicate clone, but it is not a measured end-to-end cold-open performance result. Cold/warm network, parse, mount, and long-task timings require real browser execution.

## Validation limits

Focused core/draft and face tests were added for filtering, fixed style identity, independent child values, manual slot names, internal scale, cancellation, external counter merges, and conflicts. Browser tests are being updated for the approved contract rather than retaining obsolete always-visible-16-style and equal-pixel-size assumptions.

Local Chromium cannot launch because of the execution environment's socket permission error, and the supported cloud browser blocks localhost. Neither restriction was bypassed. Real browser interaction and screenshot review must be completed in the authorized remote CI before claiming UI acceptance. Private feedback screenshots were inspected but are not included in the repository.

Adaptive sizing policy, what to do when an existing selected style becomes ineligible, and the unspecified second linkage remain undecided; no destructive migration or inferred automation was added.
