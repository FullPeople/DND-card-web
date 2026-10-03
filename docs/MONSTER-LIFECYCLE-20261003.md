# Monster lifecycle repair candidate — 2026-10-03

This candidate starts at Web main `35a00a6774476616520d248b4c3f3adaba3cfdbc` and pairs with an independent Suite dev candidate based on `c8397b04192ac26c4e954de813501c67acfdd783`. It does not merge or deploy either repository. The separately proposed card-presentation changes are not silently included.

## Corrected behavior

- Partial condition receipts cannot overwrite missing resources with `undefined`; transport runtime is normalized without writing defaults back into stored characters.
- Monster runtime and document ordering use the host sequence, including catalog, direct receipt and background snapshot paths. Explicit empty arrays remove entries; absent fields preserve the last valid projection.
- Character and monster snapshots on the same token are separate identities. Explicit `monster:<token id>` targets route monster conditions, resources, vitals and edits without accidentally resolving the character binding.
- Both authorized sheets are switchable. GM-owned selected tokens use their current access grant without adding every GM creature to the player overview.
- The paired host uses native token ownership, retires removed monster/HP components, ignores retained stale HP payloads after explicit disable, and rechecks access after asynchronous reads and inside writes.

The existing main-branch announcement browser check incorrectly counted the archived general release as the current emergency dice notice. The test now verifies the actual current channel history title and every item, plus the retained prior release. Product notices are unchanged.

## Validation boundary

Synthetic host/SDK checks and real browser UI tests are distinct. The new browser suite uses the production App, drag/drop, transport and components with an original synthetic host; it does not claim a live authenticated Owlbear room was tested. Local Chromium could not start because the environment denied its singleton socket; browser execution is assigned to the exact candidate GitHub CI. See the final handoff for exact SHAs and CI outcomes.

Old stable-plugin automatic monster popovers are outside this Workbench repair. Web and Suite should be reviewed as a pair; do not deploy one half and infer dual-target support is complete.
