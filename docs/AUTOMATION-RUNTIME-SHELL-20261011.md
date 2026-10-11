# 2026-10-11 · 运行覆盖审计只在规则代码改动时重跑

## 问题

`docs/data/automation-runtime-coverage.json` 固定了 63 个消费者模块的 SHA-256（由 Data 仓库 `scripts/audit_runtime_coverage.ts` 生成：适配器打包的全部 `src/` 输入，外加一组显式列出的界面模块）。其中 `src/ui/App.tsx` 是顶层壳，几乎每次界面改动都会碰到它；一旦散列不符，`vite build`、`vite dev` 与 `verify:automation-runtime` 就以 `Runtime coverage is stale for current consumer code` 拒绝，必须回到 Data 仓库对 18,789 个身份重新探测一遍。整库审计很慢，而界面壳的改动根本不会改变任何计算结果。

## 现在的规则

- 新增 `docs/data/automation-runtime-shell.json`：列出「外壳」模块，每条带理由。当前只有 `src/ui/App.tsx`、`src/platform/buildMode.ts`、`src/platform/requestTimeout.ts`。
- `tools/automationRuntimeCoverage.ts`：被固定的模块散列不符时，若在外壳名单里，记为 `consumerDrift`，构建与校验照常通过；否则仍然拒绝，错误里带上模块路径。
- 名单本身受约束：`src/core/**` 与 `src/data/**` 永远不能列入（守卫直接报 `Rule code cannot be declared shell`）；条目必须有 `path` 和非空 `reason`；最多 32 条。`src/platform/storage.ts` 与 `src/cloud/room.ts` 处在资料读入路径上，故意没有列入。没有名单文件时行为与以前完全一样（任何漂移都拒绝）。
- 漂移不是悄悄放过：清单 `runtimeAudit.consumerDrift` 列出路径（`validProgress` 校验其格式），进度页在「已实装」下方显示「实装统计审计于源码 xxxxxxx，此后仅外壳文件有改动：…」；`verify:automation-runtime` 的 `runtime-provenance.json` 与控制台输出也带 `consumerDrift`。
- 测试：`tests/automationProgress.test.ts` 覆盖「外壳漂移被记录、规则代码漂移被拒绝、名单不能豁免 core/data、缺少 reason 的名单无效、没有名单时任何漂移都拒绝」。

因此本分支（只有 `src/ui/App.tsx` 漂移）不再需要重新审计即可构建；CI 的 `web.yml` 各步骤（`verify:automation-runtime --data-repository`、`verify:automation-progress`、`npm run check`、`build:standalone`）都走同一个守卫。

## 仍然需要整库审计的情况

任何 `src/core/**`、`src/data/**` 或显式列出的自动化界面模块（`AutomationPanel`、`ChoiceWorkspace`、`FeaturePanel`、`Overview`、`SourceSpellControls`、`ClassChoiceRecords`、`SheetChoicesContext`、`choiceCatalog`、`entryDragIntent`、`validation`、`quickbar`、`resourceWidgets`、`classChoiceEvidence.json`）改动后，仍按既有流程在 Data 仓库重跑 producer 并重绑定：

```bash
node --experimental-strip-types scripts/audit_runtime_coverage.ts "<干净的 Web checkout>" "<原公共缓存>" reports/progress/runtime-coverage.json
node --experimental-strip-types scripts/verify_runtime_consumer.ts "<同一 Web checkout>"
```

然后复制报告到 `docs/data/automation-runtime-coverage.json`，更新 `.lock.json` 的 `revision` 与 `sha256`，运行 `npm run verify:automation-runtime -- --data-repository <Data checkout>`。

## 建议同步修改 Data 仓库（可选，本会话无权限推送）

让 producer 从一开始就不固定外壳模块，两边口径一致。`scripts/audit_runtime_coverage.ts` 第 54–55 行：

```ts
// 读取 Web 侧名单；core/data 永远不算外壳
const shellPolicy=JSON.parse(readFileSync(join(webRoot,'docs/data/automation-runtime-shell.json'),'utf8'));
const shell=new Set<string>((shellPolicy.shell||[]).map((s:any)=>s.path).filter((p:string)=>/^src\/(?!core\/|data\/)[\w./-]+$/.test(p)));
const modules=Object.keys(bundle.metafile!.inputs).map(p=>resolve(p)).filter(p=>p.replaceAll('\\','/').startsWith(resolve(webRoot).replaceAll('\\','/')+'/src/')).map(p=>({path:p.slice(resolve(webRoot).length+1).replaceAll('\\','/'),sha256:sha(readFileSync(p))})).filter(m=>!shell.has(m.path)).sort((a,b)=>a.path.localeCompare(b.path));
for(const path of ['src/ui/AutomationPanel.tsx','src/ui/ChoiceWorkspace.tsx','src/ui/Overview.tsx','src/ui/SheetChoicesContext.ts','src/ui/SourceSpellControls.tsx','src/ui/ClassChoiceRecords.tsx','src/ui/FeaturePanel.tsx','src/ui/choiceCatalog.ts','src/ui/entryDragIntent.ts','src/core/validation.ts','src/core/quickbar.ts','src/core/resourceWidgets.ts','src/core/automation/classChoiceEvidence.json'])if(!modules.some(m=>m.path===path))modules.push({path,sha256:sha(readFileSync(join(webRoot,path)))});
```

即：显式名单去掉 `src/ui/App.tsx`，并过滤掉 Web 名单里的外壳路径。`verify_runtime_consumer.ts` 只核对报告里列出的模块，不需要改。改完后下一次 producer 生成的报告就不再包含外壳模块，Web 侧守卫的漂移分支自然不会触发。
