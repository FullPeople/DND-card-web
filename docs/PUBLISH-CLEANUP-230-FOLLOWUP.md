# 230 后续：发布与桌面启动包清理

用户要求保留国内 `/card/` 网页版和质量验收，移除 GitHub Pages 发布及桌面单机打包逻辑。本组仅修改 Web 仓库的发布配置、相关脚本和说明，未执行线上发布、删除站点、删除历史 release/下载或修改账号设置。源码基线为 `4e398a39a5cb37e5e632ae377fdf2488cdc3924c`，工作分支为 `codex/web230-followup-20261001`；阶段提交与推送由主任务统一记录。

## 已改

| 需求 | 改动 | 保留内容 |
| --- | --- | --- |
| 移除 Pages 发布 | `.github/workflows/web.yml` 改名为 `Verify web`，删除 `configure-pages`、`upload-pages-artifact` 和整个 `deploy` job；仅保留 `contents: read` 权限 | 单元与普通构建、单机网页版构建、双构建验收产物、全部六个浏览器矩阵组及失败证据上传 |
| 移除桌面单机打包与入口 | 删除 `tools/standalone/Start.cmd`、`Serve.ps1`；删除 `package-layout225.py` 中桌面下载 ZIP 生成逻辑和 `deploy-layout225.py` 中相应新 ZIP 的发布允许项 | 许可、对应源码 ZIP、静态网页包、历史资产叠加保留机制和发布守卫 |
| 明确网页构建边界 | `buildDomestic.mjs` 注释改为国内 `/card` 浏览器构建 | `build`、`build:standalone`、`build:domestic`、开发入口与单机验收命令全部保留；`package.json` 未改 |
| 更新现行说明 | README 去掉 Pages 备用入口、Windows 启动包说明和过时桌面计划；STANDALONE 明确为单机网页版；DOMESTIC-HOSTING 按当前发布流程整理；VALIDATION 修正现行 CI 自动 Pages 发布描述 | 185/183 的历史验证、其他历史发布回执、源码下载、离线缓存和跨地址迁移说明 |

审查未发现 Electron、Tauri 或其他原生桌面打包工程。现有“桌面包”实际是 Windows 脚本启动浏览器和本地静态服务器；国内站所需的 `build:standalone` 仍然是正常网页版构建。其他 C++ 平台接口的历史架构讨论和桌面骰子参考经验未按关键词删除。

国内站在当前 workflow 中没有自动部署 job。原 Pages 配置和上传步骤位于 `verify`，因此它们失败时会影响后续浏览器验收。清理后验收产物上传与浏览器验收只依赖正常 Web 验证；国内发布仍需核对这些质量结果，仓库推送本身不会更新线上网站。

## 实测与证据

本机使用 Node `v24.19.0`、npm `11.9.0`；现有 CI 的 Node 22 要求保持。

| 检查 | 结果与边界 |
| --- | --- |
| PyYAML 解析和基线比较 | 通过：仅 `verify` / `browsers`；六个浏览器矩阵组及逐条命令完全不变；非 Pages 的 verify 步骤、触发器和并发设置完全不变；无 Pages action、环境或写权限 |
| 脚本语法 | 通过：两份 Python 发布脚本 AST 解析、`node --check tools/buildDomestic.mjs` |
| 删除/保留检查 | 通过：两份 Windows 启动脚本不存在；打包脚本不再生成桌面下载 ZIP；部署脚本仍复制旧目录后叠加新产物，历史资产保留代码未删 |
| `git diff --check`（本组文件） | 通过 |
| 共享树第一次 `npm run build` | 未通过：其他并行 UI 改动尚未收口，`ChoiceWorkspace.tsx:35` 的 hint 类型与 `ResourceModuleFace.tsx:44` 的 variant 类型报错。未修改这些文件；已报主任务协调。该次失败不归因于发布清理，也不作最终组合验证结论 |
| 已确认 230 基线 + 本组改动的隔离 `npm run build` | 通过：TypeScript 和 Vite 集成网页构建，361 模块 |
| 同一隔离输入 `npm run build:standalone` | 通过：TypeScript 和 Vite 单机网页版构建，330 模块；`standalone-audit.json` 为 `singlePlayer: true`、`multiplayerModules: []`，审计269个源模块 |

隔离输入从上述 HEAD 的 `git archive` 物化，只覆盖本组八份修改文件并删除两份 Windows 启动脚本，复用安装好的依赖，不包括其他并行 UI 改动。目录为 `.local-evidence/web230-publish-cleanup/build-check/`；结构检查为 `workflow-verification.json`，构建日志为 `build-integration.log` 和 `build-standalone.log`，均在其父目录。构建保留既有大于 500 KB chunk 的提示，没有将其当成失败或隐藏。

## 尚未执行与剩余边界

本组未运行 GitHub Actions、完整浏览器矩阵、真实 Suite 宿主、真实房间或线上发布；最终组合的类型、双构建和浏览器结果由主任务收口。YAML 解析与基线比较仅证明配置结构和质量步骤保留，不能代替实际 CI。`actionlint` 在本环境未安装。

225 脚本仍有原来的固定版本、基线与恢复守卫，仅保留作历史审阅范本，不应直接执行它们升级已部署的230。此轮没有运行这些服务器脚本，亦未读取或操作真实玩家数据。线上旧 Pages 站点及桌面下载保留，用户后续访问旧域名时仍需用完整 JSON 备份迁移至国内地址。
