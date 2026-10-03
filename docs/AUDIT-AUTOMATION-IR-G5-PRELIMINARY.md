# G5 独立预审与修复记录

状态：**预审已完成；正式冻结审计尚未完成，G5 闸门未通过。**

独立审阅模型为 `gpt-6-astra`，代理 Mendel（`01a1017e-d247-7267-b4d4-935e49e5100f`）。审阅只读，不委派 Web 代码或测试修改。环境未提供 Claude；采用与实施模型不同的可用模型满足独立审计要求。

| 可复现发现 | 主实施者修复 | 验证位置 |
| --- | --- | --- |
| 协议 2 卡内伪造自定义身份，复制后可执行 AC +99 | 私有命名空间与语义校验；显式复制前验证协议 3 快照，资料绑定剥离不可信内嵌 IR | `tests/automation-ir-runtime.test.ts` |
| TCE 的 2014 条目可绑定 2024 记录 | 主身份与兼容条目 ID 路径均检查 edition | `tests/automation-ir-loader.test.ts` |
| 契约法术位升级改变环阶键后丢失消耗 | 独立持久的 pact pool 消耗归档，升降级、来源关闭、导入和休息均使用同一债务 | `tests/automation-ir-runtime.test.ts` |
| 降低最大值后切换共享次数截断消耗 | 先累计独立资源与消费账本的溢出债务，再合并共享池 | `tests/automation-ir-audit.test.ts` |
| 快照缺失目标时隐藏跨版本或引用类型错误 | 先检查规范键、类型和核心书 edition，之后再允许缺失目标 | `tests/automation-ir-audit.test.ts`、数据仓语义校验器 |

首轮修复回归命令 `npx vitest run tests/automation-ir*.test.ts`：22 通过、0 失败、0 跳过。之后新增快捷栏快照、客户端机制能力与同调施法加值检查，审计测试文件共 5 项通过。正式审计须以最终冻结提交与最终 CI 为依据，结论写入 `docs/AUDIT-AUTOMATION-IR-G5.md`。

新增 IR 浏览器组现有 4 项通过：协议 2 原卡保留及复制升级、同哈希缓存离线读取、损坏刷新不执行旧规则、有效文件哈希不能绕过规范身份校验。此记录不将局部回归当作完整审计通过。
