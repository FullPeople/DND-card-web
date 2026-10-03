# 闸门 G0 · 2026-10-03

结论：通过。仅证明本轮 Node 24 云端源码基线，不代表完整自动化目标达成。

## 命令与原始输出

基线与远端：`git fetch origin && git rev-parse HEAD origin/main`，退出0，两行均为：

```text
80c94e082fcbf11be10893622b03d4220bff4d60
```

隔离：`git worktree add -b codex/automation-ir-20261003 /workspace/dnd-automation-web HEAD`，退出0。

`npm ci` 首次退出254，关键输出：

```text
npm error code ENOENT
npm error syscall mkdir
npm error path /home/agent/.npm/_cacache
npm error enoent ENOENT: no such file or directory, mkdir '/home/agent/.npm/_cacache'
```

该目录不在工作区可写范围内。仅调整缓存位置，未改锁文件、版本或完整性校验。

`npm ci --cache /workspace/npm-automation-cache`，退出0：

```text
added 61 packages in 2s
```

`npm run check`，退出0：

```text
 Test Files  99 passed | 1 skipped (100)
      Tests  729 passed | 24 skipped (753)
✓ 397 modules transformed.
✓ built in 437ms
```

包含 Vitest、`tsc -b` 与集成版 Vite 构建。单元通过729 / 跳过24 / 失败0。24项按既有条件跳过，因本轮未配置 DND_AUTOMATION_CORE_DATA、DND_AUTOMATION_BASEITEMS、DND_AUTOMATION_FEATS、EQUIPMENT_SOURCE_DIR、CLASS_AUDIT_DIR、DND_BOOK_RITUAL_DATA；不视为真实资料验证。

`npm run build:standalone`，退出0：

```text
✓ 363 modules transformed.
✓ built in 407ms
```

`node -e "const a=require('./dist-standalone/standalone-audit.json');console.log(JSON.stringify({singlePlayer:a.singlePlayer,multiplayerModules:a.multiplayerModules}))"`，退出0：

```json
{"singlePlayer":true,"multiplayerModules":[]}
```

完整日志与命令退出码位于本工作树忽略目录 `evidence/automation-ir/g0/`，首次失败日志未删除。

## 测试契约与边界

既有测试契约变更：无。没有修改断言、skip、超时或重试。未执行浏览器配置、远端CI、真实登录房间或实体设备；尚未接入IR。Node 24满足项目最低版本，Node 22同条件仍待核对。构建原有大chunk提示保留。

附件236基线已过时；本轮以237已发布交接和本机729/24复测为准。第1期先做数据分母与候选盘点，不将结构字段或Foundry命中冒充规则完整支持。
