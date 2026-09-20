# 自定义扩展包 v1

在网页“规则与扩展”中下载编写示例。包使用 UTF-8 JSON，`schemaVersion: 1`。整包验证成功后安装；失败不改变角色或已安装包。

- `id`：3–80 位小写字母、数字、点、横线或下划线，作为独立命名空间；不能使用 `kiwee`。
- `name`、`version`：名称和 `x.y.z` 精确版本。
- `editions`：`["2014"]`、`["2024"]` 或两者。
- `requires`：例如 `[{"id":"author.base","version":"1.0.0"}]`。依赖必须先安装同一版本，不能循环。禁用依赖会暂停依赖方的效果。
- `conflicts`：冲突包的 id 数组，双方任一声明都会阻止安装。
- `entries`：1–3000 项。每项有包内简单 `id`、`kind`、`name`、正文 `entries`，可附 `raw`、`effects`、`choices`。

类型包括 `class`、`subclass`、`race`、`background`、`feat`、`spell`、`item`、`feature`、`condition`、`rule`。

## 效果

```json
[
  { "op": "add", "target": "int", "value": 1 },
  { "op": "proficiency", "skill": "history" }
]
```

数值目标为六项属性 `str/dex/con/int/wis/cha`，以及 `ac`、`speed`、`hp`。`add` 增加，`set` 设定。熟练操作接受内部技能键。不会执行 JavaScript、`eval` 或任意文件/网络操作。

常规护甲计算后应用 AC 的设定与加值；HP 设定取代常规上限后应用加值。多条 `set` 以选择顺序最后一条为准。人工修正最后应用。

## 选择

```json
{
  "id": "knowledge",
  "label": "选择一项知识技能",
  "count": 1,
  "options": ["arcana", "history", "nature", "religion"]
}
```

无 `kind` 的选择在卡内显示；选中技能键可授予熟练。指定 `kind` 的选择从 Wiki 拖入，可以用 `refs` 限定名称与来源、`featureType` 限定特性类型、`spellLevel` 限定环阶。

更新已安装包不会改写角色中的资料快照。如要采用新版条目，请移除旧选项后从新目录填入，并核对选择。可通过撤销回到旧快照。删除包也不会删除角色已选内容，来源禁用才会暂停其效果。

完整的事件栈、条件执行和资源自动消耗不属于 v1 指令集；未知操作直接拒绝导入。
