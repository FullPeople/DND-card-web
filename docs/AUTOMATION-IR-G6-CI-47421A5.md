# G6 单模块 Web CI · 47421a5

完整 [CI 37147383958](https://github.com/FullPeople/DND-card-web/actions/runs/37147383958)：verify 与 17 个浏览器矩阵作业均 success（18/18）。

验证提交 `47421a5f14963da7b19eb0c080be8a6f313c4d54`；日志按 GitHub job API 保存原始字节，下面逐组引用统计及检查命令。

单元 898 通过／25 环境跳过／0 失败；两构建、严格类型、单机审计通过。
各组多个命令分开报告，不累计成一次测试。无失败项由作业 success 与日志共同确认。

测试契约变更：`spellWikiFeedback` 刷新前增加“已保存到本机”确认；原次数断言、skip、超时、重试、预算未改。用户已全授权执行和验证；首次两个 CI 失败、trace 与修复说明保留在 [单模块记录](AUTOMATION-IR-G6-SINGLE-MODULE.md)。

G6 核心覆盖、G7 可写 fork 演练和 G8 最终审计仍待完成；这次通过不代表全覆盖交付。

## verify

作业 `111274027133`：success；原始日志 `evidence/automation-ir/ci-37147383958/verify.log`。

```text
2026-10-03T19:18:17.8867771Z  Test Files  107 passed | 1 skipped (108)
2026-10-03T19:18:17.8869616Z       Tests  898 passed | 25 skipped (923)
```

## startup-order

作业 `111274100653`：success；原始日志 `evidence/automation-ir/ci-37147383958/startup-order.log`。

```text
2026-10-03T19:18:37.8193126Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:58.4067375Z ##[group]npx playwright test --config playwright.startup-order.config.ts
2026-10-03T19:19:53.4999644Z   12 passed (54.3s)
2026-10-03T19:19:53.5228444Z ##[group]npx playwright test tests/e2e/threeDragonFullscreen.spec.ts --project=chromium
2026-10-03T19:20:07.7310225Z   2 passed (13.4s)
```

## card-fixes-235

作业 `111274100654`：success；原始日志 `evidence/automation-ir/ci-37147383958/card-fixes-235.log`。

```text
2026-10-03T19:18:36.7230807Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:02.6984298Z ##[group]npx playwright test --config playwright.card-fixes235.config.ts
2026-10-03T19:20:19.1575380Z   10 passed (1.3m)
```

## startup-integration

作业 `111274100658`：success；原始日志 `evidence/automation-ir/ci-37147383958/startup-integration.log`。

```text
2026-10-03T19:18:41.9318041Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:12.0186601Z ##[group]npx playwright test --config playwright.wiki-recovery.config.ts
2026-10-03T19:19:55.9243277Z   7 passed (43.3s)
2026-10-03T19:19:55.9374115Z ##[group]npx playwright test --config playwright.integration230.config.ts
2026-10-03T19:26:02.0516421Z   5 skipped
2026-10-03T19:26:02.0517051Z   58 passed (6.1m)
```

## screen-release

作业 `111274100672`：success；原始日志 `evidence/automation-ir/ci-37147383958/screen-release.log`。

```text
2026-10-03T19:18:39.8244420Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:07.2348140Z ##[group]npx playwright test --config playwright.screen.config.ts
2026-10-03T19:20:31.9497302Z   9 passed (1.4m)
2026-10-03T19:23:06.4096179Z   59 passed (2.6m)
```

## portrait-frame

作业 `111274100673`：success；原始日志 `evidence/automation-ir/ci-37147383958/portrait-frame.log`。

```text
2026-10-03T19:18:34.6639065Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:54.7257061Z ##[group]npx playwright test --config playwright.portrait-frame.config.ts
2026-10-03T19:20:21.8574036Z   1 skipped
2026-10-03T19:20:21.8575208Z   9 passed (1.4m)
```

## resources-sources

作业 `111274100675`：success；原始日志 `evidence/automation-ir/ci-37147383958/resources-sources.log`。

```text
2026-10-03T19:18:40.8374137Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:05.4044339Z ##[group]npx playwright test --config playwright.feedback217.config.ts
2026-10-03T19:23:19.7182219Z   57 passed (4.2m)
2026-10-03T19:23:19.7351969Z ##[group]npx playwright test --config playwright.source-feedback.config.ts
2026-10-03T19:26:03.3421824Z   22 passed (2.7m)
```

## dashboard-appearance

作业 `111274100680`：success；原始日志 `evidence/automation-ir/ci-37147383958/dashboard-appearance.log`。

```text
2026-10-03T19:18:39.4442887Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:02.2718502Z ##[group]npx playwright test --config playwright.dashboard237.config.ts
2026-10-03T19:20:35.0652433Z   2 skipped
2026-10-03T19:20:35.0652894Z   30 passed (1.5m)
```

## armor-feature-followup

作业 `111274100682`：success；原始日志 `evidence/automation-ir/ci-37147383958/armor-feature-followup.log`。

```text
2026-10-03T19:18:34.8138405Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:01.7829268Z ##[group]npx playwright test --config playwright.armor-offsets.config.ts
2026-10-03T19:19:35.5956720Z   5 passed (33.3s)
2026-10-03T19:19:35.6092764Z ##[group]npx playwright test --config playwright.feature-armor.config.ts
2026-10-03T19:20:10.7224941Z   7 passed (34.6s)
```

## monster-lifecycle

作业 `111274100683`：success；原始日志 `evidence/automation-ir/ci-37147383958/monster-lifecycle.log`。

```text
2026-10-03T19:18:34.3194845Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:55.6375738Z ##[group]npx playwright test --config playwright.monster-lifecycle.config.ts
2026-10-03T19:19:44.5580950Z   8 passed (48.0s)
```

## class-drop-profile-232

作业 `111274100701`：success；原始日志 `evidence/automation-ir/ci-37147383958/class-drop-profile-232.log`。

```text
2026-10-03T19:18:37.3094855Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:00.3673489Z ##[group]node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --allowImportingTsExtensions --target ES2022 --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution Bundler --jsx react-jsx --strict --skipLibCheck --esModuleInterop --resolveJsonModule --types vite/client,node tools/profileClassDrops232.spec.ts
2026-10-03T19:19:00.6374612Z ##[group]node tools/profileClassDrops232.mjs
2026-10-03T19:24:31.3380115Z   32 passed (5.5m)
```

## choices-standalone

作业 `111274100702`：success；原始日志 `evidence/automation-ir/ci-37147383958/choices-standalone.log`。

```text
2026-10-03T19:18:34.4660708Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:57.1566516Z ##[group]npx playwright test --config playwright.choices.config.ts
2026-10-03T19:21:40.4563417Z   5 skipped
2026-10-03T19:21:40.4563933Z   18 passed (2.7m)
2026-10-03T19:24:05.9245526Z   19 passed (2.4m)
```

## automation-unified

作业 `111274100715`：success；原始日志 `evidence/automation-ir/ci-37147383958/automation-unified.log`。

```text
2026-10-03T19:18:36.3592979Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:58.2563537Z ##[group]DND_AUTOMATION_TEST_MODE=standalone npx playwright test --config playwright.automation209.config.ts
2026-10-03T19:23:29.1528695Z   26 passed (4.5m)
2026-10-03T19:23:29.1869132Z ##[group]npx playwright test --config playwright.unified191.config.ts
2026-10-03T19:24:47.0916905Z   2 skipped
2026-10-03T19:24:47.0917342Z   18 passed (1.3m)
```

## edit-profile-232

作业 `111274100717`：success；原始日志 `evidence/automation-ir/ci-37147383958/edit-profile-232.log`。

```text
2026-10-03T19:18:38.8790150Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:19:01.9804217Z ##[group]node tools/profileCharacterEdits232.mjs
2026-10-03T19:23:11.6020882Z   12 passed (4.1m)
```

## feedback-touch

作业 `111274100736`：success；原始日志 `evidence/automation-ir/ci-37147383958/feedback-touch.log`。

```text
2026-10-03T19:18:36.8645274Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:58.8842384Z ##[group]npx playwright test --config playwright.feedback198.config.ts
2026-10-03T19:20:55.8359907Z   17 passed (1.9m)
2026-10-03T19:20:55.8605463Z ##[group]npx playwright test --config playwright.compat207.config.ts
2026-10-03T19:21:42.4224570Z   9 passed (45.7s)
2026-10-03T19:21:42.4418666Z ##[group]npx playwright test --config playwright.touch.config.ts
2026-10-03T19:22:18.6027296Z   6 skipped
2026-10-03T19:22:18.6027794Z   6 passed (35.3s)
```

## automation-ir

作业 `111274100738`：success；原始日志 `evidence/automation-ir/ci-37147383958/automation-ir.log`。

```text
2026-10-03T19:18:36.2804953Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:58.5942601Z ##[group]npx playwright test --config playwright.automation-ir.config.ts
2026-10-03T19:19:34.7998853Z   4 passed (35.4s)
```

## direct-232

作业 `111274100760`：success；原始日志 `evidence/automation-ir/ci-37147383958/direct-232.log`。

```text
2026-10-03T19:18:34.9679907Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:52.8991073Z ##[group]npx playwright test --config playwright.direct232.config.ts
2026-10-03T19:20:26.6728049Z   13 passed (1.6m)
2026-10-03T19:20:26.6939458Z ##[group]npx playwright test --config playwright.wiki232.config.ts
2026-10-03T19:22:31.8665539Z   17 passed (2.1m)
```

## followup-230

作业 `111274100785`：success；原始日志 `evidence/automation-ir/ci-37147383958/followup-230.log`。

```text
2026-10-03T19:18:35.0388041Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T19:18:54.2487030Z ##[group]Run npx playwright install --with-deps firefox
2026-10-03T19:19:03.0372084Z ##[group]npx playwright test --config playwright.followup231.config.ts
2026-10-03T19:24:16.9408910Z   2 skipped
2026-10-03T19:24:16.9409154Z   52 passed (5.2m)
2026-10-03T19:24:16.9631936Z ##[group]npx playwright test --config playwright.followup-ui231.config.ts
2026-10-03T19:28:20.5376662Z   68 passed (4.1m)
```

回滚：保留分支历史；Web main 没有合并，线上没有部署。默认数据仍使用已验证的 G5 草稿，不提前宣称核心四书完成。
