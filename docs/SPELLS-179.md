# 法术页交互与规则来源（本地 179）

本轮删除法术页的法术位格；法术位资源仍由原来的资源系统保存、消耗和同步。宽屏法术格为五列、14 px 高，长名字省略；窄屏重排提高至 24 px 以保留点击和阅读空间。

左键与拖拽在已学／职业法术表和预备区之间移动法术。右键为操作菜单，不固定提示。悬停继续走共用 Wiki／Tooltip 预览。预备区和下方列表互斥显示同一个条目；存储仍保留学习资格和独立的预备引用，所以取消预备不会遗失法术书记录。

## 数据推导

`spellcastingRules.ts` 使用来源字段，无职业名称分支：

- `preparedSpellsChange: level` 或只有 `spellsKnownProgression`：学习制界面，已选法术可直接使用。
- `preparedSpellsChange: restLong`：预备制；无书本学习字段时，按该职业等级和启用来源派生可用全法表。
- 预备字段加 `spellsKnownProgressionFixed`：法术书池，只列玩家实际记录的法术。
- `modeOverride` 保留编辑模式的手动覆盖；“跟随职业”恢复资料推导。

职业法术表通过已有 `_spellClasses`／`classes.fromClassList` 匹配来源与名字。等级上限优先读该职业表，不使用兼职角色更高的合计法术位等级。整张职业法术表只用于显示；玩家真正预备某个法术时才存入这一项，不将全表写进角色 metadata。

## 官方核对

[2014 职业规则](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes)：诗人、游侠、术士和邪术师使用已知法术；牧师、德鲁伊、圣武士预备职业法表；法师预备自己书中的法术。

[2024 法术准备表](https://www.dndbeyond.com/sources/dnd/br-2024/spells#SpellPreparationbyClass)和[2024 职业细则](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes)：诗人、术士、邪术师虽改用 Prepared 一词，仍只在升级时替换一个；本界面继续使用学习制。牧师、德鲁伊、法师长休可任意替换，法师仍限自己的法术书。圣武士、游侠长休只替换一个，属于预备制但不同于任意重新选满。

界面不强制休息时机或自行消耗玩家名额，沿用手动角色卡约定。源数据无法明确说明的自定义职业不会因为译名类似而获得整张全法表。

## 本地验证

`tests/spells-179.test.ts` 覆盖 2014／2024 已学与预备推导、法术书与全表区别、兼职按单职业等级筛选、手动覆盖、容量失败不创建空项、取消预备保留同一身份。`tests/e2e/spells-179.spec.ts` 覆盖桌面布局、左键／拖拽预备、右键菜单与 tooltip 优先级、Wiki 悬停、刷新保存、全表与学习制界面。

截图：`F:/CodexWork/2026-09-20/w-xu/spells179-wizard.png`。测试仅使用原创虚构法术；未部署。
