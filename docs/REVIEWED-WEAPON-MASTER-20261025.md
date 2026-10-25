# PHB2014 Weapon Master：明确四武器熟练

本独立批次继承已验 Web PR115 d3540abcf9f9600cdb683433e7b05a767a1dd0a8 / Data PR69 6fa33744c13243ad13f5937193fc3522d38ad87c。上一批 11 Web workflows、Data CI 与 90 实际 UI 全部通过，旧验收 head 不移动；没有合并或部署。

目标为真实 PHB2014 职业 ASI 替代槽显式选择 Weapon Master，确认 STR/DEX +1（上限20）与四种不同、来源明确的简易/军用武器熟练。纯派生训练必须进入实际攻击熟练加值，而非仅卡面标签；手工完整或空训练覆盖、公式、装备、HP 与资源保持不改写。不将未确认/手工拖入直接生效，不猜新版本同名规则。

真实冻结 Wizard ASI4 来源红例已复现：本批拟确认输入下 STR 仍13、不是14；这不是声称已有玩家分配入口。当前为实施阶段，版本/旧端保存撤回兼容正在独立核对，来源/API/测试仍未冻结，暂无发布可用声明。

候选原 fromFilter 存在翻译漂移，不能声称直接执行字符串成功。拟采用来源审校的精确身份与 canonical 类型/mundane 语义限定，保留52候选中37 PHB、10 DMG及5其它来源各自证据。OotA unknown 稀有度按同版上游 isMundane 明确可计；无edition条目仍保留 normalized both，仅允许经核对的精确2014兼容身份。Net 是合法武器熟练目标，不因没有伤害字段拒绝；魔法武器不作为候选，仅按真实baseItem继承所选种类。未知形状/来源不得自动授予。

当前不新增通用角色 schema、服务端、凭据或安全设置，不恢复已取消项目；完整阶段回放和实际 UI 仅在源冻结后验收。

## 冻结前实现、红例与验证

实现使用独立 reviewedWeaponMaster v1 局部状态，不迁移原 reviewedFeats v1。实测拒绝了最初共用v2方案：旧消费者 d354 会因此将已有 Tough HP36降到28并影响旧授予归档。新方案保留原五条专长效果；旧端普通编辑/导出/IndexedDB可保留不透明新字段，但不理解WM选择撤回/重选/降升历史，旧端相关操作后返回新版仍须撤回再确认，不能宣称仅回滚代码就安全。

真实冻结 Wizard ASI4 首红是属性13而非14；随后第二红是属性已生效而实际 Longsword 攻击仍2而非4。接入专属WM派生训练后实际熟练PB+2，Net熟练可选而不伪造伤害。DMG10个确切火器候选另需显式“本角色已获DM允许取得所选火器熟练”确认，单独启用DMG不足。这是根据冻结 Firearms|DMG p267 ruleType O 的保守授权边界，不声称规则原文规定某个UI复选框。

范围准确为52个已审基础武器种类，不是整个fromFilter域：items.json中的Iron Ball|IDRotF、Oversized Longbow|WDH两个特殊物品仍手动，Psychic Blade|XPHB为另一版特性武器，不纳入PHB规则。本批不实现火器装填/爆发/弹药等额外机制，不创建物品或重写手工攻击公式。

源冻结前独立审查发现并修复：不同active集合相减混入普通跨版训练；新增引擎拒绝吞掉合法XPHB待适配与_copy诊断；魔法baseItem继承接受XDMG伪both版本。均保留实际旧d354对照或先红反例，不能以删warning或弱化断言拿绿。最终 c00bfbb16ee3cda3a6f4fc38cf7150f0b2efc817 / src bfd9c3de86d14845785e763c4e5e829f9bb10db9 修正严格来源版本、五补充合法魔法变体保留。核心早期270通过，最终相关151/151零skip＋tsc；独立真实旧图/XPHB/冻结魔法18/18零skip。这些组有重叠，不相加当覆盖率。

UI新增3个实际App流程、两视口共6，保留旧90，总96仅发现未执行。源码归属变化会清草稿，延迟提交再次核card/source/binding/manual基础值；复用已验证的workspace-active-id、siteSources、HP textbox和稳定data-reference选择定位。工作流从全新目录实际下载9输入逐项hash/index匹配，新来源与旧消费者绑定206项零skip；magicvariants必须5cc0bbe而非e2623，保持原冻结4a4b0f哈希。没有启动本地浏览器。

最终准确远端配对、单次阶段回放、96真实UI及CI尚未完成；本批未合并部署，不能称当前发布可用。

末轮跨仓真实审计继续保留了两个导入混搭红例：DMG2014魔法长剑的type仅改为M|XPHB，或baseItem省略来源，均曾错误获得WM熟练PB（实际5、应3）。ef6534ad0e3329fa7b46ba02149e89799a85941f 仅收紧新matcher：完整type精确相同，baseItem恰两段非空、来源显式，不吞命名空间、不默认PHB，不修改通用旧trained/weaponType。最终相关152/152零skip＋tsc，独立真实旧图13＋冻结6共19/19零skip；src tree4d40c102e1ecd0617c39dd9b33d711d34e9c5103。此前审阅结论均绑定各自旧提交，不冒充这个修订已跑过所有组；最后准确Data及阶段验收继续待完成。
