# Owner-sync Web：第二轮 CI 证据（2026-10-03）

- [完整运行 37131339021](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021)，精确远端 SHA：`488252d1f51f155956953406c71febaab4f52524`。
- GitHub API 终态：`completed / failure`。verify 成功；17 个浏览器组中 14 成功、3 失败。
- 下表逐命令保留结果，配置之间有重复用例，不汇总为独立浏览器覆盖，也不加到前轮或本地计数。

| Job（直接链接） | 终态 | 配置命令结果，按日志顺序 |
| --- | --- | --- |
| [verify](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226898498) | success | 单元 831 通过 / 25 条件跳过；类型及双构建通过 |
| [dashboard-appearance](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226980984) | success | 2 skipped；30 passed (1.6m) |
| [choices-standalone](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226980987) | success | 5 skipped；18 passed (2.7m)；19 passed (2.3m) |
| [owner-sync](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226980991) | failure | 1 failed；12 passed (57.8s) |
| [feedback-touch](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226980998) | success | 17 passed (2.2m)；9 passed (44.6s)；6 skipped；6 passed (40.7s) |
| [armor-feature-followup](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981000) | success | 5 passed (31.2s)；7 passed (34.5s) |
| [startup-integration](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981004) | success | 7 passed (46.4s)；5 skipped；58 passed (6.3m) |
| [screen-release](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981013) | success | 9 passed (1.6m)；59 passed (3.1m) |
| [card-fixes-235](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981021) | success | 10 passed (1.5m) |
| [resources-sources](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981024) | success | 57 passed (3.6m)；22 passed (2.7m) |
| [startup-order](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981029) | failure | 2 failed；16 passed (1.0m)；3 failed；1 passed (3.5m)；2 passed (12.2s) |
| [direct-232](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981038) | failure | 1 failed；12 passed (1.8m)；17 passed (2.4m) |
| [class-drop-profile-232](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981040) | success | 32 passed (5.4m) |
| [followup-230](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981050) | success | 2 skipped；52 passed (5.6m)；68 passed (4.7m) |
| [edit-profile-232](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981056) | success | 12 passed (4.1m) |
| [automation-unified](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981066) | success | 26 passed (3.7m)；2 skipped；18 passed (1.4m) |
| [portrait-frame](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981107) | success | 1 skipped；9 passed (1.5m) |
| [monster-lifecycle](https://github.com/FullPeople/DND-card-web/actions/runs/37131339021/job/111226981370) | success | 8 passed (41.9s) |

## 首轮问题实际复验

- feedback198 怪物 lock / statsLock 通过，该命令 17/17。
- release 中两条 inventory-race、inventory-queue、save-race 均通过，该命令 59/59。
- owner-sync 仍为 12/13，但这次失败发生在旧姓名断言之前的 `clock.pauseAt(new Date())`：`Cannot fast-forward to the past`。因此不能把首轮姓名断言及其后续撤权链宣称已通过。

## 第二轮失败、证据与修订

1. **owner-sync 测试时钟竞争（1项）**：默认安装使用浏览器当前时钟，随后 Node 取时可能略早。修订 `11f991adce3761a1f31cf26be244dc642d2cc63c` 先取浏览器 `clockNow`，从 `clockNow-60_000` 安装，再暂停于同一个 `clockNow`；最终时刻不跨过连接断线阈值。80 ms debounce 之后的 150 ms 推进、撤权/重新授权/迟到 ACK、直接拒写及零 save 断言保留。
2. **direct232 十二标签键盘交互（1项）**：重载后只等待 12 个 tab DOM，即执行 focus/Home。trace 的 `call@1007` 表明该时刻为 `<div id="root" inert="">`，开场可见退场阶段尚不允许焦点。修订 `8d8cf5d99a43fd5391ed5747bca54be681b30c6f` 等待开场移除及 root 解除 inert，再明确检查 focus 成功。12 tab、单行、各宽度下 Home/End 选中与无溢出断言保留；运行时 inert 未更改。
3. **startup-order 开场素材比较（2项）**：新增 PNG/WebP 浏览器 canvas 逐字节比较失败（涉及第 1/2/4 层）。启动专项核对源 RGBA 与原素材散列一致，新增量化 alpha、完全不透明像素、位置及三种背景最终合成误差门槛。此时新合成探针尚未运行，不能据源字节一致宣称浏览器合成无差异。
4. **startup latency（3项）**：一个测试在 documentElement 尚未建立时读取 dataset；两个 iframe 夹具以 about:blank 顶层发起请求，触发 Chrome local-network 检查。启动专项使用 null-safe 采样与同源正常顶层夹具修订，未改变安全 flags。另将启动期间实测出现的 151 KB header/favicon 预载延至开场 complete。启动专项差量为 `d413484`，新探针结果以之后精确 SHA 的 CI 为准。

## 本地与保存边界

- `8d8cf5d` 后本地完整 check：831 通过 / 25 条件跳过；类型、集成及 standalone 双构建通过。
- 18 份原始 job 日志、API 终态及全部 17 份 ZIP 产物已在忽略的 `.local-evidence/owner-sync/ci-second/` 保留，下载散列均与 GitHub SHA-256 相符。owner/direct 的实际截图与 trace 已查看，未删除首轮证据。
- 浏览器重验等待下一候选 SHA；本地浏览器限制未绕过，没有由单元或发现列表代替实际浏览器执行。
- 没有合并、部署或修改玩家数据；真实多人房间和实体设备未因此验收。

