# Stage 2 remote verification, 2026-10-02

## Exact input and terminal result

- Repository: FullPeople/DND-card-web; branch: `codex/direct232-followup-20261002`.
- Published commit: [d1679ca8a546b71b99eda1133c190a2a7e1e082f](https://github.com/FullPeople/DND-card-web/commit/d1679ca8a546b71b99eda1133c190a2a7e1e082f).
- Tree: `2e20eaba592a2899a04419a3f40038562f2ff807`, exactly equal to frozen local stage2 commit `298da4533d18fac66b5de065ef408088be1c2db0`. All 77 changed-file blobs were independently hashed against the manifest before upload.
- Parent: remote first batch `0fe373bc7a3d9060626ac6a4f65ba4bc521212f2`. Branch was reread immediately before non-forced fast-forward and verified afterward, including again at 10:09 UTC.
- [Verify web #83 / run 36993074683](https://github.com/FullPeople/DND-card-web/actions/runs/36993074683), attempt 1, event push, exact SHA above: **completed / failure**, API verified 10:09 UTC.
- Verify job passed: 547 unit tests passed, 24 external-data conditional skips; TypeScript and integrated/standalone production builds passed.
- Nine browser groups finished: five success, four failure. No main merge, PR creation, deployment, player-data write, or private screenshot publication was performed.

## Browser configuration results

Counts below are executed configuration cases, not a claim of distinct product requirements. Deduplicated logical cases use test file plus title, ignoring project/browser/baseline labels and source line numbers. They include skipped definitions; this is an audit aid, not a pass count.

| Group | Configuration results (pass / skip / fail) | Group terminal | Listed executions | Logical definitions / repeats |
|---|---|---|---:|---:|
| screen-release | screen 9/0/0; release 59/0/0 | success | 68 | 68 / 0 |
| feedback-touch | feedback198 17/0/0; compat207 8/0/0; touch 6/6/0 | success | 37 | 31 / 6 |
| startup-integration | wiki-recovery 7/0/0; integration230 53/5/1 | failure | 66 | 59 / 7 |
| resources-sources | feedback217 52/0/1; source-feedback **not run** | failure | 53 | 53 / 0 |
| choices-standalone | choices 15/5/1; standalone **not run** | failure | 21 | 21 / 0 |
| automation-unified | automation209 26/0/0; unified191 18/2/0 | success | 46 | 36 / 10 |
| direct-232 | direct232 5/0/3; wiki232 **not run** | failure | 8 | 8 / 0 |
| edit-profile-232 | paired profile 12/0/0: six baseline plus six candidate | success | 12 | 6 / 6 |
| followup-230 | followup231 50/2/0; followup-ui231 62/0/0 | success | 114 | 55 / 59 |

Total: **399 passed / 20 skipped / 6 failed = 425 configuration cases**, including 6 baseline measurements. Across all groups there are 276 file/title definitions and 149 repeated executions. Cross-group repetition means the group-level logical counts must not be added as a global unique count. These counts do not add earlier local checks or CI82.

## Failure evidence and diagnosis boundaries

1. **Three direct SkillsAttacks cases** stop in import setup at `direct232SkillsAttacks.spec.ts:17`: exact accessible tab name `熟练与攻击原创验收（导入）` is absent. The grant/revoke and A4/screen column assertions have not run. Needs comparison of actual accessibility name/import result, not automatic timeout inflation. Artifact [11220262770](https://github.com/FullPeople/DND-card-web/actions/runs/36993074683/artifacts/11220262770).
2. **Training weapon hover** fails in choices and repeats under standalone integration: `automationChoices.spec.ts:135`, after translated/source-qualified weapon chips and exact UID checks succeed, hovering 战斧 yields no role tooltip within 10s. It is two execution failures of one logical test. Artifact [11220058425](https://github.com/FullPeople/DND-card-web/actions/runs/36993074683/artifacts/11220058425); integration artifact [11220811280](https://github.com/FullPeople/DND-card-web/actions/runs/36993074683/artifacts/11220811280). Handed to repair owner; product vs locator root cause not yet proven by this report.
3. **Canvas geometry**: `resourceDashboard220App.spec.ts:6`, integrated App main resource canvas versus newly opened dashboard dialog canvas differs by 2.52154541015625 pixels, violating `<2`. This occurs **before** later styling/save/reload steps; calling it a reload failure would be inaccurate. Artifact [11220426721](https://github.com/FullPeople/DND-card-web/actions/runs/36993074683/artifacts/11220426721). Handed to dashboard owner to distinguish geometry from animation timing without weakening threshold blindly.

CI82 pointer-clone regression is not cleared by this run: `npm run test:standalone` was never reached after choices failed.

## Measured editing performance

Controlled Chromium CI measurement, 4x CPU slowdown, production builds, baseline `79078c1cfb1a1ee4de15e7612a66f720321eaaab` versus candidate d1679ca8. Six paired scenarios cover A4/screen and 1 card/100 catalogue, 12 cards/100 catalogue, and 12 cards/10,000 catalogue. All 12 executions passed. This is not a representative real-player/network benchmark and not every low-load metric improved.

For 12 cards and 10,000 catalogue entries, milliseconds:

| Mode / operation | Handler p95 baseline → candidate | Paint p95 baseline → candidate |
|---|---:|---:|
| A4 short first edit | 165.7 → 65.6 | 191.5 → 135.4 |
| A4 short re-edit | 145.0 → 71.7 | 193.9 → 141.5 |
| A4 long name | 133.8 → 58.5 | 279.2 → 117.7 |
| Screen short first edit | 224.0 → 112.2 | 275.3 → 160.8 |
| Screen short re-edit | 177.8 → 110.8 | 359.2 → 211.3 |
| Screen long name | 178.6 → 97.5 | 359.2 → 203.9 |

Class drop paint (one sample per scenario) remains A4 722.7 → 634.7ms; screen 888.0 → 706.2ms. It is still a material latency target. In small screen scenarios some paint metrics regress/noise upward, e.g. 1 card/100 short re-edit p95 132.7 → 170.2ms. Do not summarize as universally smooth or all edits faster.

Raw profile artifact [11220767448](https://github.com/FullPeople/DND-card-web/actions/runs/36993074683/artifacts/11220767448) contains report and 12 metrics JSON files, no successful-case traces.

## Actual successful visual evidence

The direct artifact includes seven success screenshots: cold/warm spell menu, character tabs at 1512/1040/390px, five coins wide, saved narrow backpack. Actual pixels were inspected for 390px character tabs, wide five-coin backpack and cold spell menu:

- 390px: single-line horizontally clipped character strip with selected long-name tab visible; A4 page fits beneath it with five vertical page tabs. Small A4 text is expected from scaling; this does not establish physical phone readability.
- Wide backpack: five distinct currency cells occupy one row; thick gray frames and five page tabs retained; three major columns visually match approximately 44/24/32.
- Cold spell context menu is positioned within the visible card, rather than unstyled/full-page content; menu text and action are legible.
- Automated direct cases additionally passed warm/cold menus, Escape/blur/removal drag cleanup without viewport overflow, 12-tab Home/End selection and visibility, and five-coin quantity/movement persistence after reload. These five cases now pass on the remote browser.

Skills/attack visuals and wiki232 scenarios remain unverified in this run due earlier failures. No real room, multiplayer permissions, physical phone, real player files, live deployment or full production rules corpus was tested by this batch.

## Local evidence for ongoing repair (not repository inputs)

- Full decoded job logs: `/tmp/ci83-job-<jobid>.log`; execution dedup audit: `/tmp/ci83-execution-index.json`.
- Success and direct-failure images/traces: `/tmp/ci83-direct/direct232-browser/`.
- Training hover failure: `/tmp/ci83-choices/test-results-choices/automationChoices-weapon-p-bd968-source-qualified-references/`.
- Profile: `/tmp/ci83-profile/edit-perf232/report.json` and sibling `*/metrics.json`.
- This report is an evidence draft for the next validated integration. It does not authorize or claim publication of later mutable changes.
