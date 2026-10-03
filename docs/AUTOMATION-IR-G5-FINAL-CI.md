# G5 最终冻结 CI 原始统计

Web runtime 冻结 `a804d3be3a16558c874db43ce6e2332a2950ad8b`。
[第八轮 CI](https://github.com/FullPeople/DND-card-web/actions/runs/37139204468)：verify + 17 个浏览器任务，18/18 success。
各 process 分别报告，不跨配置或轮次累计。原输出未打印零跳过/零失败时，零由该命令成功结束确认，不伪造原文行。
独立终态核对以另附审计补充为准。原始 job 日志保存在忽略的 `evidence/automation-ir/ci-37139204468/`。

## armor-feature-followup

Job 111250048347: completed / success。

```text
2026-10-03T17:05:51.2683931Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:23.5356520Z ##[group]npx playwright test --config playwright.armor-offsets.config.ts
2026-10-03T17:06:58.2607812Z   5 passed (34.1s)
2026-10-03T17:06:58.2781938Z ##[group]npx playwright test --config playwright.feature-armor.config.ts
2026-10-03T17:07:33.3328057Z   7 passed (34.4s)
```

## automation-ir

Job 111250048366: completed / success。

```text
2026-10-03T17:05:44.7122536Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:11.0801146Z ##[group]npx playwright test --config playwright.automation-ir.config.ts
2026-10-03T17:06:45.8608188Z   4 passed (34.1s)
```

## automation-unified

Job 111250048357: completed / success。

```text
2026-10-03T17:05:48.1616433Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:09.8551497Z ##[group]DND_AUTOMATION_TEST_MODE=standalone npx playwright test --config playwright.automation209.config.ts
2026-10-03T17:10:46.7021452Z   26 passed (4.6m)
2026-10-03T17:10:46.7239064Z ##[group]npx playwright test --config playwright.unified191.config.ts
2026-10-03T17:12:05.2108101Z   2 skipped
2026-10-03T17:12:05.2108616Z   18 passed (1.3m)
```

## card-fixes-235

Job 111250048391: completed / success。

```text
2026-10-03T17:05:44.9444639Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:07.7788230Z ##[group]npx playwright test --config playwright.card-fixes235.config.ts
2026-10-03T17:07:29.0254219Z   10 passed (1.3m)
```

## choices-standalone

Job 111250048337: completed / success。

```text
2026-10-03T17:05:58.5866486Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:42.0421102Z ##[group]npx playwright test --config playwright.choices.config.ts
2026-10-03T17:09:14.2400862Z   5 skipped
2026-10-03T17:09:14.2401188Z   18 passed (2.5m)
2026-10-03T17:11:36.1936136Z   19 passed (2.4m)
```

## class-drop-profile-232

Job 111250048579: completed / success。

```text
2026-10-03T17:05:46.3150607Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:14.1681952Z ##[group]node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --allowImportingTsExtensions --target ES2022 --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution Bundler --jsx react-jsx --strict --skipLibCheck --esModuleInterop --resolveJsonModule --types vite/client,node tools/profileClassDrops232.spec.ts
2026-10-03T17:06:14.6256137Z ##[group]node tools/profileClassDrops232.mjs
2026-10-03T17:12:32.2614093Z   32 passed (6.2m)
```

## dashboard-appearance

Job 111250048295: completed / success。

```text
2026-10-03T17:05:44.2423697Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:05.5859223Z ##[group]npx playwright test --config playwright.dashboard237.config.ts
2026-10-03T17:07:39.1542071Z   2 skipped
2026-10-03T17:07:39.1542563Z   30 passed (1.5m)
```

## direct-232

Job 111250048378: completed / success。

```text
2026-10-03T17:05:43.7920420Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:05.1572897Z ##[group]npx playwright test --config playwright.direct232.config.ts
2026-10-03T17:07:49.1428438Z   13 passed (1.7m)
2026-10-03T17:07:49.1631033Z ##[group]npx playwright test --config playwright.wiki232.config.ts
2026-10-03T17:10:11.3864388Z   17 passed (2.4m)
```

## edit-profile-232

Job 111250048580: completed / success。

```text
2026-10-03T17:05:45.9912778Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:07.4388873Z ##[group]node tools/profileCharacterEdits232.mjs
2026-10-03T17:10:28.4225149Z   12 passed (4.3m)
```

## feedback-touch

Job 111250048341: completed / success。

```text
2026-10-03T17:05:45.7822406Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:06.3931148Z ##[group]npx playwright test --config playwright.feedback198.config.ts
2026-10-03T17:07:47.0914423Z   17 passed (1.7m)
2026-10-03T17:07:47.1099503Z ##[group]npx playwright test --config playwright.compat207.config.ts
2026-10-03T17:08:29.9691124Z   9 passed (42.4s)
2026-10-03T17:08:29.9851598Z ##[group]npx playwright test --config playwright.touch.config.ts
2026-10-03T17:09:02.0326347Z   6 skipped
2026-10-03T17:09:02.0327005Z   6 passed (31.6s)
```

## followup-230

Job 111250048436: completed / success。

```text
2026-10-03T17:05:44.2744118Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:10.2140554Z ##[group]Run npx playwright install --with-deps firefox
2026-10-03T17:06:23.0565074Z ##[group]npx playwright test --config playwright.followup231.config.ts
2026-10-03T17:11:42.8993418Z   2 skipped
2026-10-03T17:11:42.8993762Z   52 passed (5.3m)
2026-10-03T17:11:42.9421156Z ##[group]npx playwright test --config playwright.followup-ui231.config.ts
2026-10-03T17:16:00.6010621Z   68 passed (4.3m)
```

## monster-lifecycle

Job 111250048371: completed / success。

```text
2026-10-03T17:05:50.5587429Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:13.0835837Z ##[group]npx playwright test --config playwright.monster-lifecycle.config.ts
2026-10-03T17:07:00.6377604Z   8 passed (46.7s)
```

## portrait-frame

Job 111250048380: completed / success。

```text
2026-10-03T17:05:45.3752540Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:05.9715187Z ##[group]npx playwright test --config playwright.portrait-frame.config.ts
2026-10-03T17:07:46.6545751Z   1 skipped
2026-10-03T17:07:46.6546843Z   9 passed (1.7m)
```

## resources-sources

Job 111250048395: completed / success。

```text
2026-10-03T17:05:45.2706933Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:06.5217159Z ##[group]npx playwright test --config playwright.feedback217.config.ts
2026-10-03T17:10:34.0769515Z   57 passed (4.4m)
2026-10-03T17:10:34.1008800Z ##[group]npx playwright test --config playwright.source-feedback.config.ts
2026-10-03T17:13:20.8163903Z   22 passed (2.8m)
```

## screen-release

Job 111250048334: completed / success。

```text
2026-10-03T17:05:43.9200777Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:04.1346630Z ##[group]npx playwright test --config playwright.screen.config.ts
2026-10-03T17:07:38.3675290Z   9 passed (1.6m)
2026-10-03T17:10:48.1385181Z   59 passed (3.2m)
```

## startup-integration

Job 111250048439: completed / success。

```text
2026-10-03T17:05:44.1105416Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:07.1875758Z ##[group]npx playwright test --config playwright.wiki-recovery.config.ts
2026-10-03T17:06:53.4145705Z   7 passed (45.3s)
2026-10-03T17:06:53.4353720Z ##[group]npx playwright test --config playwright.integration230.config.ts
2026-10-03T17:13:14.3313720Z   5 skipped
2026-10-03T17:13:14.3314053Z   58 passed (6.3m)
```

## startup-order

Job 111250048433: completed / success。

```text
2026-10-03T17:05:51.9581613Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T17:06:24.2429219Z ##[group]npx playwright test --config playwright.startup-order.config.ts
2026-10-03T17:07:17.0349763Z   12 passed (52.2s)
2026-10-03T17:07:17.0488409Z ##[group]npx playwright test tests/e2e/threeDragonFullscreen.spec.ts --project=chromium
2026-10-03T17:07:27.3162555Z   2 passed (9.7s)
```

## verify

Job 111249944749: completed / success。

```text
2026-10-03T17:05:23.8915449Z  Test Files  107 passed | 1 skipped (108)
2026-10-03T17:05:23.8920925Z       Tests  898 passed | 25 skipped (923)
```
