# Owner-sync Web：首轮 CI 证据（2026-10-03）

## 固定输入与终态

- [完整运行 37130137123](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123)，分支 `fix/obr-owner-sync-20261003`。
- 远端源码：`be1bfe92556b045dce91bb69a9f9cf2186883531`；与当时本地 `04d0168430612f520826e8ac3250cc1a11b65361` 的树一致。
- GitHub API 最终状态：`completed / failure`。18 个 job 全部终态：verify 成功；17 个浏览器组中 14 成功、3 失败。
- 下表保留每个命令自己的结果。配置间有重复用例，**不把这些次数相加当作独立覆盖**，也不与本地单元或其他批次相加。

## 全部 job

| Job（直接链接） | 终态 | 配置命令结果，按日志顺序 |
| --- | --- | --- |
| [verify](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223439715) | success | 单元 825 通过 / 25 条件跳过；类型及双构建通过 |
| [feedback-touch](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520088) | failure | 1 failed；16 passed (2.1m)；9 passed (45.1s)；6 skipped；6 passed (34.1s) |
| [owner-sync](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520089) | failure | 1 failed；12 passed (1.1m) |
| [choices-standalone](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520118) | success | 5 skipped；18 passed (2.5m)；19 passed (2.3m) |
| [followup-230](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520122) | success | 2 skipped；52 passed (5.5m)；68 passed (4.7m) |
| [automation-unified](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520133) | success | 26 passed (3.7m)；2 skipped；18 passed (1.2m) |
| [card-fixes-235](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520134) | success | 10 passed (1.4m) |
| [dashboard-appearance](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520139) | success | 2 skipped；30 passed (1.7m) |
| [monster-lifecycle](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520148) | success | 8 passed (47.5s) |
| [startup-integration](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520157) | success | 7 passed (43.8s)；5 skipped；58 passed (6.3m) |
| [edit-profile-232](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520160) | success | 12 passed (3.3m) |
| [armor-feature-followup](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520167) | success | 5 passed (34.5s)；7 passed (34.5s) |
| [screen-release](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520175) | failure | 9 passed (1.6m)；4 failed；55 passed (3.6m) |
| [resources-sources](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520181) | success | 57 passed (3.8m)；22 passed (2.6m) |
| [portrait-frame](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520183) | success | 1 skipped；9 passed (1.6m) |
| [direct-232](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520193) | success | 13 passed (1.5m)；17 passed (2.1m) |
| [startup-order](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520206) | success | 12 passed (49.9s)；2 passed (10.3s) |
| [class-drop-profile-232](https://github.com/FullPeople/DND-card-web/actions/runs/37130137123/job/111223520231) | success | 32 passed (5.4m) |

## 六项首轮失败与修订

1. **owner-sync，撤权后姓名控件断言**：原断言要求姓名 input 仍存在且不可编辑。实际截图及 trace 显示当前只读工作台把姓名切成 `.assign-token-name` 按钮；玩家姓名、力量基础值具有 `readonly` 属性。修订为明确验证姓名 input 消失、姓名阅读视图保留、上述两个稳定字段不可编辑，并增加重新授权后姓名恢复可编辑。原 debounce 不发 save、迟到 ACK 不恢复权限、直接写入被拒断言全部保留。对应提交：`95852efd50b705d06d740182c127ca5a18c3cbd9`。
2. **feedback-touch，怪物资料锁与血条锁**：旧夹具只给组件传入怪物 target，没有向工作台发布 selection；新发送边界找不到当前目标而拒绝 lock。夹具补真实 selection 消息；仍须分别产生一个 lock 与一个 statsLock，且 locked 值保持原断言。
3. **screen-release，inventory-race 连续移动**：目录给出 writable inventory 却把 cards 置空。新边界不承认不存在的角色授权；补与背包一致的当前 card grant，保留两次手势、远端数量、fresh revision、最终位置及逐帧不回弹断言。
4. **screen-release，inventory-race 拒绝移动**：同一缺失授权导致请求根本未抵达夹具宿主，因而没有可拒绝的 held request。沿用上述夹具修订，保留真实拒绝后的 toast 与网格几何断言。
5. **screen-release，inventory-queue 并发队列**：夹具及 replay 同样遗漏 card grant；另从 trace 发现 JSX fixture 缺少 Vite React preamble。补相符目录与 preamble，保留移动/数量/回执/跨场景断言。
6. **screen-release，save-race ACK 边界**：夹具只发 ready 与 selection，没有完成 catalog 握手。新发送边界拒绝写入；每个 case 先发布相符 catalog 再 selection。保留全部 20 个延迟交错 case、每个两次 save 与最终 HP=3 断言。

第 2–6 项对应提交：`89761dc20408108ec631b4a4c99f761accb5b61c`。以上修改仅限测试，未放宽运行代码权限边界，未删除、跳过用例或降低现有并发/持久数据断言。

## 本地复核、保留证据与边界

- 测试修订后 `npm run check`：825 通过 / 25 条件跳过，类型与集成构建通过；`npm run build:standalone` 通过。
- owner-sync 发现 13 项；release 发现 59 项；feedback198 发现 17 项。发现列表不等同浏览器执行成功。
- 18 份原始 job 日志、run/jobs/artifact API JSON、三组失败截图及 trace 已保留于忽略的 `.local-evidence/owner-sync/ci-initial-*`。17 份产物对应 16 个不同 ZIP（owner-sync 两份同 digest），均已下载并核对 GitHub SHA-256。
- 本地 Chromium socket EPERM 与云浏览器 localhost 限制仍存在，未尝试绕过。修订后浏览器结论须等待新候选 SHA 的 GitHub CI。
- 本轮没有合并、部署、操作真实房间或玩家数据；实际多人房间和实体设备仍不属于上述夹具验收范围。

