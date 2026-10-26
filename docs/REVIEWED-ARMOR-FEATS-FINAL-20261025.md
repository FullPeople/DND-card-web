## Validated draft: PHB2014 armor feats, not merged or deployed
Accepted Web head d3540abcf9f9600cdb683433e7b05a767a1dd0a8 (tree bfcc0cc90d8d7d61e0b41e586d7af015118a1dfe, src a166aaddca3cf0f3d6d3c1a376a720e78b63943f), paired Data6fa33744c13243ad13f5937193fc3522d38ad87c. All11 Web workflows and exact Data CI success, verified2026-10-25T04:24Z. Previous accepted PR114/68 heads preserved.

## Player capabilities
PHB2014 Lightly/Moderately/Heavily Armored via genuine reviewed legacy class ASI replacement slots. Explicit STR/DEX+1 (Heavy STR only), cap20, light→medium/shield→heavy prerequisite chain; prior-source only, no self/future authorization. Pure derived ability/training effects, no default consent from manual feat drag. Manual full or empty training overrides preserved. Withdrawal/replacement removes only own consent; source/level suspension retains intent; reopen/undo/redo/readonly protected.
Necessary TrainingChips fix: untouched auto focus/blur no longer adopts derived training as manual. Explicit Enter preserves existing save-current-value semantics once, including empty; Escape/external/permission changes discard stale drafts.
Strict XPHB compatibility retains legitimate Lightly typed level4 and existing lawful medium/heavy stored training. Previously unsupported XPHB medium/heavy typed choices remain closed. No new XPHB attribute/HP/save automation from same names.

## Exact validation
- [Actual90 UI, attempt1](https://github.com/FullPeople/DND-card-web/actions/runs/40160589373):45desktop+45narrow,0fail/skip/unrun/retry. All84 previous and6 new passed in THIS run. Six new successful screenshots individually inspected, both ZIP sizes/digests verified. Test merge908612af5a88759e12b9827d0fb5462a51ac6ef0 has exact accepted tree.
  Desktop job121071110200/artifact12586711717; narrow121071110312/artifact12586198612.
- [Main CI](https://github.com/FullPeople/DND-card-web/actions/runs/40160589401):3628 unit passed/245 environment-conditional skipped, full existing browser matrix success,189module/report gate,build/typecheck passed.
- Each specialty viewport:1774 old directed passed/2 existing skips plus247 new directed/0skip. Do not add duplicate viewport executions.
- [Data CI](https://github.com/FullPeople/dnd5e-automation-data/actions/runs/40157637380/job/121062317978):824 Vitest/11 existing G3 environment skips,14 Node,6 Python,9 real probes;11 source workflows2048 cases including armor503/passive235, all pass;build pass. Pipeline job conditionally skipped, no deployment.
- Exact corrected full replay18789records/229inputs/189modules, sourceWeb00b5be642ec17879ab697179938a4b3e341c4813/Datafa85faec7468406303b10be79c4c6b3e0259ec1f, finished2026-10-25T03:15:41.008Z. SHA2563f48d83d253c29b03af0fa798b6bb190f1e98292d37f8719728b3ed361977506.
- Armor503 steps,204 realPHB source paths/16inputs/87modules; passive235/136paths/15inputs/87modules,0fail/skip.

## Honest failures and corrections
Initial bea1 complete replay was diagnostic, not accepted: PHB name-only filtering also blocked legitimate XPHB4 training. Corrected strict source/shape isolation has272 focused and85+20 independent boundary checks, plus new503 source proof. Old level1 XPHBLightly aggregate witness is invalid and removed; legal4 flow separately restored. Both old broken and corrected reports coincidentally show6535, not equivalent behavior.
First actual f29e run88pass2fail: disabled candidate name adjacent SMALL broke textContent boundary. Second a7c run84pass6fail: CSS checked prefix broke accessible-name postclick locator. Both receipts/traces/ZIPs preserved; not combined with final90. Final test-only stable data-reference helper has16 offline DOM regressions plus related checks/independent review, retains unique/disabled/pressed assertions/default waits,150s and retries0. Source unchanged after00b5; no unnecessary full replay for test repairs.

## Boundaries
4561 reviewed/6535 at least-one-mechanism witnesses/522 unavailable/0 unresolved are NOT whole-rule or released counts. Only change from accepted previous6536 is invalid XPHBLightly level1 witness removal, not loss of lawful4 capability.
2014 shield training itself adds no extra AC; general nonproficient casting/disadvantage/heavy-strength speed/equip lifecycle remain manual. Stable source-level ordering does not reconstruct real multiclass chronology. cap20 uses frozen renderer default contract, not claimed inaccessible WotC text. No full rules uploaded.
Old consumer opaque confirmation preservation does not prove authorization lifecycle safety: after old-client forget/reselect or manual base/HP edits, return to new client and withdraw/reconfirm. No schema/server/security expansion. jsdom26.1.0 dev-only; existing audit warnings not fixed. No merge/deploy or production-availability claim.