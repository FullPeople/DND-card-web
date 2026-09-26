# 头像损坏导致角色卡打不开（196）

## 现象

玩家反馈：绑定棋子的角色卡打不开，提示「枭熊角色读取失败：Error: 头像数据无效。」，玩家并没有更换头像。

## 原因

角色文档里的 `portrait.data` 被存成了棋子图片地址（`https://…/token-portrait.png`），而 `validateCharacter` 要求 `data:image/(webp|png|jpeg);base64,…`，于是每次读取都抛错。

写入来源在 `src/ui/Portrait.tsx`：没有自定义头像时，用绑定棋子的图片 URL 作为显示回退（`src/platform/workbench.ts` 的 `tokenPortrait`；suite 侧 `src/workbench/token-portrait.ts` 只接受 http(s) 地址，注释写明「never copy image bytes into a card」）。但编辑模式下头像上方 70% 是不可见的移动/缩放热区（`characterPages.css`：`.portrait-controls{inset:0;opacity:0}`、`.portrait-move{height:70%}`），指针停在头像上滚动，或按下拖动/点一下，热区就把回退对象整个写进角色（`edit(c=>{c[field]=next})`）。图片看起来没变（还是那张棋子图），所以玩家认为「没有改过头像」。

修复前复跑取证：一次滚轮即产生

```
{"path":["portrait"],"after":{"data":"https://assets.example.com/token-portrait.png","x":0,"y":0,"zoom":1.568…,"frameWidth":103,"frameHeight":112}}
```

此后打开这张卡时 `App.tsx` 的读取 effect 抛错并提示「枭熊角色读取失败」，角色不会落到本地。同一个坏字段还会让整份**本机工作区**在启动校验（`acceptWorkspace` → `validateCharacter`）失败，玩家会看到「本机记录读取失败」。

第二条损坏路径（未在本次现场出现，同样修掉）：`frame()` 按当前视图宽度重新归一化坐标，换屏幕尺寸后 x/y 会放大到 ±300 以外，`frameWidth` 也可能取到 0，一次拖动即可写出越界数据。

## 改动

1. `src/core/validation.ts`：抽出 `storedImage`（与原来逐字一致的头像/立绘规则）；新增 `readCharacter`：读取失败且原因只涉及头像/立绘时，只丢这两个字段再校验一次，返回 `{character, repaired}`；其他损坏照旧抛出。
2. `src/ui/App.tsx`：枭熊文档读取与「核对并采用枭熊数据」改走 `readCharacter`，修好当次打开并提示；`acceptWorkspace`（本机工作区、上一次保存恢复）先逐角色修复图片字段，其余内容仍严格校验。
3. `src/ui/Portrait.tsx`：棋子图片回退只用于显示——没有自定义头像时不渲染移动/缩放热区、不绑定滚轮，任何操作都不会把 URL 写进角色；`frame()` 把 x/y 夹到 ±300、frameWidth/Height 夹到 1–2000。

## 验证

- 红灯（修复前复跑）：`tests/e2e/portrait-196.spec.ts` 滚轮用例断言到 `portrait.data` 被写成 URL；坏头像用例断言到角色卡没打开（`.identity-name` 仍是本机占位角色）；本机工作区用例断言不到修复提示（临时还原严格校验后单独复跑确认）。
- 绿灯：3/3 通过（新增 `playwright.portrait196.config.ts`，端口 5419）。
- 新增 `tests/portrait-196.test.ts`（3 项）：回退地址、超长、越界、非法协议、frameWidth 0 都不算已存头像；坏头像只丢头像、其余字段与角色可用性不变、修好后可再次通过校验；非图片损坏仍然抛出。
- 回归：177 项单元测试全通过；`character-pages.spec.ts` 中真正操练头像的用例（上传 → 滚轮缩放 → 拖动 → 刷新后变换保留）通过。
- 构建：`tsc -b` 与 `vite build` 通过。

## 边界与后续

- 只做「读取时修复」，没有自动回写枭熊文档：坏的 `portrait` 分支会留在文档里，每次打开提示一次；玩家重新设置头像并保存即覆盖它（`documentChanges` 会把新的 `portrait` 分支发回去）。不自动写回是因为 `save` 会置 `workbenchDirty` 并暂停跟随远端更新，确认失败时可能长时间停在「正在同步至枭熊…」。要彻底清掉文档里的坏分支，需要单独评估一次窄范围修复写入。
- 同一个坏字段对原生/插件侧是无害的：suite 只把 `tokenPortrait` 放进发给网页的 state，不读 `dnd_card_web.portrait`。
- `character-pages.spec.ts`（5 失败）与 `cards-177.spec.ts`（3 失败）的其余失败与本改动无关，集中在 `.class-features`/`.class-subclasses` 选择器、调色板描边色（`rgb(17,17,17)` vs `rgb(0,0,0)`）、背包输入框等，都是本轮未发布的本地 UI 修订造成的既有失败；未在本机做发布版 A/B。
- 未在真实枭熊房间验收（本机无真实房间环境）。
