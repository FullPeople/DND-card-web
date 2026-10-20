# 2026-10-20 · 配对账本后的全量单测

当前整合候选全量 1,734 项通过、94 项条件跳过，单工作线程执行，未排除用例或放宽时限。机制证据另为 355 项通过、20 项条件跳过，26 个文件有通过证据、22 个完整通过；两组重叠，不累计。完整 229 输入回放及 Data141633 配对同字节检查通过。类型、各正式构建、整合后的浏览器与最终 CI 仍继续核对。
# 2026-10-20 · 独立完整回放与账本已配对

第三批接续第二批最终候选 `1cb1de1`，仅响应式样式、测试与记录变化，73 个受审计模块与消费提交 `c1bd2a7` 的字节一致。229 份冻结输入、18,789 条记录完成完整真实回放，来源快照和逐条回执与上批相同。Data PR50 的 `141633eb0f79c37e6d02d9402b4ec24f08bbbc96` 提交保存权威同字节账本，Web 已按 SHA-256 锁定。

4,561 条已核对，6,538 条至少一个机制有回执；本次回放未增加有机制回执的记录数，不能由此宣称整条完成。首次内存不足后以原绑定、未经编辑的检查点续跑并最终退出 0，未更换输入、探针或放宽校验。法师护甲 AC、持续时间与护甲资格继续手动。整合后全量检查、正式构建和最终 CI 仍需分别通过；本批未获合并或发布批准。
# 2026-10-20 · 第三批有序接续

为避免后续两批规则源码叠加却缺少整体验证，本候选在独立第三批分支接续第二批 `8cee067` 基线；首批与第二批分支保持原范围，第三批审阅差异只包含本祈唤。原 F 盘候选不动。规则源码无冲突，状态文档双方保留。整合后实际来源、浏览器与类型检查重新执行，独立完整回放及配对账本尚待完成。

法师护甲的 AC、持续时间和护甲资格仍需手动处理，不能把显式授予与随意施法当作整条规则完成。以下接续和原候选结果保留为历史。

# 2026-10-20 · 独立候选接续验证

已在当前首批 Web `837dded` 基线上接续原 `bb5a5b6` 的四个提交，原 F 盘候选保持不动，也没有混入首批或属性生成分支。源码接续没有冲突，状态文档保留双方记录。

当前 11 项祈唤检查全部通过，实际冻结 XPHB 职业／祈唤／法术输入没有跳过；七个相关文件共 69 项通过、10 项条件跳过，类型检查通过。桌面与 390px 两项真实浏览器流程通过：显式启用、自身随意施法及回执、资源不变、保存重开、取消后保留原手工法术和笔记。截图已检查。

原浏览器样例只列出过，没有执行通过；本次先适配已改变的按钮名称和实际存储接口，再按当前页面／编辑状态等待后执行，没有为测试改规则源码或放宽功能断言。保存后切页与重开等待保留。

完整回放、配对账本、全量检查、构建和最终 CI 仍待后续独立批次完成。仅验证法术授予与支付；法师护甲的 AC、持续时间、护甲资格仍手动，不是整条规则完成，未合并或发布。

## 2026-10-19 原候选记录

以下验证状态保留为历史，以本节上方的接续结果为准。

# XPHB Armor of Shadows activation candidate

Learning an invocation remains a saved record. The reviewed
`Armor of Shadows|XPHB` record now offers a separate opt-in activation beside
the learned slot, including when no other feature group is displayed. Activation
grants the uniquely resolved XPHB Mage Armor snapshot. Its payment menu and saved
cast receipt say self only; it costs no spell slot and does not create a use
counter. The original spell range and all source prose remain unchanged.

Cancelling activation or replacing its learned slot removes the automatic spell.
A saved activation pauses when the learned quota or enabled source no longer
permits it, and resumes from retained answers when that ownership returns.
Pre-existing manual spells and character notes remain separate. Old learned
answers and manually added invocation selections do not silently become free
casts. Altered spell declarations, other editions, corrupt answers and broadened
saved target constraints cannot execute this reviewed grant.

Source: [2024 Basic Rules invocation options](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#EldritchInvocationOptions),
checked 2026-10-19. The actual frozen optional-feature input has SHA-256
`031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844`.
The actual-source test verifies this lock and the Warlock/spell input locks,
resolves the translated spell UID, saves/reopens the grant and checks its
original range. Only authored fixture metadata and hashes are committed.

Reproduction: four workflow tests failed before implementation. A subsequent
render test reproduced the missing activation entry point before its repair.
Current validation: eleven workflow/source/render tests pass; 129 tests pass across
ten related suites, with five pre-existing optional-source cases skipped.
TypeScript passes after materializing the sparse checkout's supporting files.
The new actual-source test runs with `DND_AUTOMATION_INPUTS`; it is not skipped in
this local evidence.

An additional failing regression reproduced a later download invalidating an
already saved spell snapshot. Resolution now preserves the character's stored
spell before considering a same-ID catalog revision, matching source-spell
planning and offline reopening.

The activation entry point remains visible when its spell catalog is missing.
It explains the unresolved dependency and cannot be confirmed until that exact
source-qualified spell is uniquely loaded. Loading data alone never creates a
new activation answer.

This is a local follow-up candidate based on ASI source commit
`fd6b8cb09a79dba12e39a426f31fd4885c4f3d47`. Its own full-corpus evidence,
builds, complete suite, isolated browser acceptance and remote CI remain pending.
An authored browser flow covers the visible activation, self-cast receipt,
unchanged resources, reload and cancellation while retaining the manual spell.
Listing that test succeeds; it is not yet a browser pass.
The ASI batch's running replay uses a separate immutable checkout and does not
certify these newer invocation bytes.

This grant records the self cast and its payment. Mage Armor's duration,
armor eligibility and AC effect still need player adjudication; this is not an
encounter-effect evaluator. Other invocations, PHB variants and Artificer
infusion activation require separate reviewed mechanisms.

Rollback: revert this source candidate together with any later paired runtime
ledger adoption. Retained activation answers become inert; manual spell
selections and base character data need no migration. No merge or deployment.
