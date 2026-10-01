# 资源仪表盘 220 浏览器回归入口

本轮采用已确认的 16 款模块、独立仪表盘弹窗及共用攻击／资源画布。旧 `resourceWidgets217.spec.ts` 与 `resourceModules218.spec.ts` 的四／六样式、主卡面直接拖动、旧管理弹窗和固定每页数量属于已替换的产品契约，保留文件供历史追溯，不再由当前配置激活。

`playwright.feedback217.config.ts`、`playwright.resource-widgets.config.ts` 和默认 `playwright.config.ts` 现在采用：

| 当前文件 | 保留的验证行为 |
| --- | --- |
| `resourceDashboard220.spec.ts` | 16 款白名单、相同尺寸画布、选择不消费、颜色图标、八点缩放、取消、左右边缘翻页、容量对应默认样式、法术池独立消费与刷新 |
| `resourceDashboard220App.spec.ts` | 实际 App 导入、仪表盘入口、尺寸、单资源设置、持久化与窄屏 |
| `resourceDashboard220Compatibility.spec.ts` | 旧用例额外覆盖的 2／4／6／9 环完整可见性、契约池、触屏消费与分页、自定义三子资源只修改选中项并刷新保留 |
| `compactDashboard220.spec.ts` | 玩家资源与共享资源的实际主题、宽窄视窗、资源操作和单项设置弹层 |
| `dashboardInteraction221.spec.ts` | 自由重叠/禁止保存、不挤动邻居、显式保存/放弃、幽灵拖入与取消、跨页与密集模块尺寸、拖动时无整卡深拷贝 |

密集法术位按新共用画布允许分页，逐页核对所有环级与余额，不再强制全部模块在一页。原来的公共资源、角色选择器、突发消费和其他 Suite 回归文件继续保留原入口，本次没有删减这些检查。仓库 CI 仍执行 `playwright.feedback217.config.ts`，会由该入口收集新用例。

配置收集检查仅证明这些用例被正确路由，不代表浏览器执行通过。最终实际执行、失败及未执行范围另见本轮验证记录；本文件不声称全套旧 CI 已重跑。

六项兼容回归已在 Windows Edge 单进程执行：首轮 5 通过、1 项因测试未悬停显示设置按钮而失败，保留原始 trace 与截图；补上实际悬停步骤后第二轮 6 项通过。第二轮额外核对所有环级标签和余额数字的字号、可见性、边界及实际数值，并对每页截图。证据位于隔离工作目录父级 `dashboard-compatibility-r1/` 与 `dashboard-compatibility-r2/`。触屏用例为浏览器触屏模拟，不等同实体设备验收。
