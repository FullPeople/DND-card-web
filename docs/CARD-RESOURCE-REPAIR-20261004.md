# 撤读后的角色卡文档释放：245基线候选

## 基线与范围

2026-10-04 19:56 UTC重新从官方GitHub API与git fetch核对Web main，两者均为`40d9dfee082545f52dc05f782ab2da274d1d0bad`。隔离分支`codex/card-resource-repair-20261004`只整合原候选`af9fb07178d9babae99f385b35a59cb953421429`；生产代码无冲突，STATUS历史按追加方式保留。原候选和工作树保持不变。

用户授权本晚推送独立分支并持续修复CI，合并与部署由用户自行进行。本分支不改发布版本，不合并main/dev，不部署，不涉及三龙独立站、FUS、后台或玩家数据。

## 行为

撤销读取权限后，清除`observedDocuments`、`WorkbenchRevisions.documents`和App当前`appliedDocument`所持有的完整body。只撤销编辑权限仍保留可读body。退役body留下纯数字revision水位；重新授权后，低于水位的迟到body不能复活，当前或更新body可重新读取。拒收body不影响ACK promise、库存回执及其他有效批结果收束。

目录摘要、仍可读卡、未决/不确定/失败草稿与既有恢复语义保留。没有借机改变地图、库存水位或通信协议。原始引用释放红绿和未解决边界见[原候选记录](CARD-ACCESS-LIFETIME-LOCAL-20261004.md)；不把受控引用释放称为真实Edge内存泄漏根治。

## 当前组合验证

- 全量单元：909通过、26条件跳过；116文件通过、1条件跳过。
- `npm run build`、`npm run build:standalone`通过，包含TypeScript；`node tools/checkStartupBoundary241.mjs`通过。仅既有大chunk提示。
- owner-sync浏览器组新增3项：真实App撤读隐藏/重新授权版本门禁；在途草稿隔离、重新授权与迟到ACK；过期body重试退出loading后可再次成功。配置现可发现18项/5文件。
- 已知当前本地浏览器socket EPERM限制，没有绕过。浏览器行为结果以独立分支的精确SHA GitHub CI为准；此处不把测试发现列表写成通过。
- Web完整矩阵保留全部既有21组，owner-sync组执行上述新增用例；新增本分支push触发。
- Web权限/设置面板仍固定已发布245配套Suite `24a498d317d4f107fdb29e320a4647e3f50b0252`，避免无关依赖漂移。最终Suite组合应精确pin本分支Web提交并在Suite CI验证。Web独立矩阵不冒称已绑定尚未冻结的Suite新候选。

独立审阅逐字节核对三处生产差量与原af9一致，并独立重跑13项lifetime回归全部通过；未发现静态阻断。新增浏览器场景特别是冻结时钟后的重新授权时序仍须CI首跑验证。发布SHA与远端终态CI需在实际完成后由最终回执说明。真实登录房间、用户原设备与实体手机尚未现场验证。

## 首次CI与夹具修正

首次精确SHA `fdfb6ce5ad411220f4de017dd0437e4790e1b6b3` 的[Web CI](https://github.com/FullPeople/DND-card-web/actions/runs/37230549746)中，owner-sync 17通过/1失败。失败是新增草稿用例把已在245紧凑布局中隐藏的旧`.save-status`当成可见UI；截图显示角色草稿保留且顶部“同步核对”入口可见。已改为保留状态文本断言并检查实际可见的“同步核对”入口与弹窗说明/导出按钮，原草稿、迟到ACK、不重复发送和pending清空断言全部保留。没有改生产样式或放宽权限恢复要求。首次[失败artifact](https://github.com/FullPeople/DND-card-web/actions/runs/37230549746/artifacts/11313935747)保留，修正后的完整CI仍以最终回执为准。
