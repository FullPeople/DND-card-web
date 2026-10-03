# G6 职业等级公式修复完整CI回执

2026-10-03。验证SHA `c5b3a29630b8c441ecf82ed5abaaed751370f37c`，GitHub Actions [37151509207](https://github.com/FullPeople/DND-card-web/actions/runs/37151509207) verify及17浏览器组全部success。18份原始作业日志已取回，保存于忽略的`evidence/automation-ir/ci-37151509207/`，不把组间统计相加。

本轮修复实际父职业公式绑定/歧义可见未绑定，新增两项债务/来源回归。双Node本地各900通过/25环境跳过/0失败，类型/两构建与单机审计通过，IR浏览器4/0/0。以下保留本次CI实际命令与原始统计；未改既有断言/skip/超时/预算。此前失败留痕、G5通过和47421a5旧CI结论保留。G6核心已审1190/6396仍未清零、G7实际fork待外部建仓、G8未过；默认仍G5草稿，不合Web main或部署。

## verify

作业`111286190534`：success。原始日志`evidence/automation-ir/ci-37151509207/verify.log`。

```text
2026-10-03T20:26:12.0692405Z  Test Files  107 passed | 1 skipped (108)
2026-10-03T20:26:12.0694849Z       Tests  900 passed | 25 skipped (925)
```

## screen-release

作业`111286268206`：success。原始日志`evidence/automation-ir/ci-37151509207/screen-release.log`。

```text
2026-10-03T20:26:30.0019437Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:50.5551096Z ##[group]npx playwright test --config playwright.screen.config.ts
2026-10-03T20:28:25.5152593Z   9 passed (1.6m)
2026-10-03T20:31:41.3454599Z   59 passed (3.3m)
```

## monster-lifecycle

作业`111286268212`：success。原始日志`evidence/automation-ir/ci-37151509207/monster-lifecycle.log`。

```text
2026-10-03T20:26:34.8218882Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:56.9146638Z ##[group]npx playwright test --config playwright.monster-lifecycle.config.ts
2026-10-03T20:27:46.5709860Z   8 passed (48.8s)
```

## portrait-frame

作业`111286268223`：success。原始日志`evidence/automation-ir/ci-37151509207/portrait-frame.log`。

```text
2026-10-03T20:26:33.5368978Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:56.5456798Z ##[group]npx playwright test --config playwright.portrait-frame.config.ts
2026-10-03T20:28:38.4605378Z   1 skipped
2026-10-03T20:28:38.4605890Z   9 passed (1.7m)
```

## feedback-touch

作业`111286268225`：success。原始日志`evidence/automation-ir/ci-37151509207/feedback-touch.log`。

```text
2026-10-03T20:26:29.9930160Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:52.3890502Z ##[group]npx playwright test --config playwright.feedback198.config.ts
2026-10-03T20:28:47.2009071Z   17 passed (1.9m)
2026-10-03T20:28:47.2240943Z ##[group]npx playwright test --config playwright.compat207.config.ts
2026-10-03T20:29:33.7241545Z   9 passed (45.7s)
2026-10-03T20:29:33.7458277Z ##[group]npx playwright test --config playwright.touch.config.ts
2026-10-03T20:30:09.6363457Z   6 skipped
2026-10-03T20:30:09.6364103Z   6 passed (35.1s)
```

## dashboard-appearance

作业`111286268241`：success。原始日志`evidence/automation-ir/ci-37151509207/dashboard-appearance.log`。

```text
2026-10-03T20:26:29.7371107Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:48.1563917Z ##[group]npx playwright test --config playwright.dashboard237.config.ts
2026-10-03T20:28:01.5484524Z   2 skipped
2026-10-03T20:28:01.5484777Z   30 passed (1.2m)
```

## card-fixes-235

作业`111286268248`：success。原始日志`evidence/automation-ir/ci-37151509207/card-fixes-235.log`。

```text
2026-10-03T20:26:29.0982133Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:51.8143580Z ##[group]npx playwright test --config playwright.card-fixes235.config.ts
2026-10-03T20:28:15.9883976Z   10 passed (1.4m)
```

## startup-integration

作业`111286268250`：success。原始日志`evidence/automation-ir/ci-37151509207/startup-integration.log`。

```text
2026-10-03T20:26:29.6874015Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:52.9049413Z ##[group]npx playwright test --config playwright.wiki-recovery.config.ts
2026-10-03T20:27:39.7064264Z   7 passed (45.9s)
2026-10-03T20:27:39.7302751Z ##[group]npx playwright test --config playwright.integration230.config.ts
2026-10-03T20:34:00.9343445Z   5 skipped
2026-10-03T20:34:00.9343787Z   58 passed (6.3m)
```

## resources-sources

作业`111286268261`：success。原始日志`evidence/automation-ir/ci-37151509207/resources-sources.log`。

```text
2026-10-03T20:26:30.3456048Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:52.1815808Z ##[group]npx playwright test --config playwright.feedback217.config.ts
2026-10-03T20:31:14.3287469Z   57 passed (4.4m)
2026-10-03T20:31:14.3525874Z ##[group]npx playwright test --config playwright.source-feedback.config.ts
2026-10-03T20:34:00.7207065Z   22 passed (2.8m)
```

## armor-feature-followup

作业`111286268268`：success。原始日志`evidence/automation-ir/ci-37151509207/armor-feature-followup.log`。

```text
2026-10-03T20:26:30.1866228Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:50.7493690Z ##[group]npx playwright test --config playwright.armor-offsets.config.ts
2026-10-03T20:27:28.1260457Z   5 passed (36.5s)
2026-10-03T20:27:28.1478472Z ##[group]npx playwright test --config playwright.feature-armor.config.ts
2026-10-03T20:28:08.4621569Z   7 passed (39.5s)
```

## startup-order

作业`111286268277`：success。原始日志`evidence/automation-ir/ci-37151509207/startup-order.log`。

```text
2026-10-03T20:26:29.7603607Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:51.9813499Z ##[group]npx playwright test --config playwright.startup-order.config.ts
2026-10-03T20:27:48.0620805Z   12 passed (55.1s)
2026-10-03T20:27:48.0880085Z ##[group]npx playwright test tests/e2e/threeDragonFullscreen.spec.ts --project=chromium
2026-10-03T20:28:03.9400523Z   2 passed (14.9s)
```

## choices-standalone

作业`111286268320`：success。原始日志`evidence/automation-ir/ci-37151509207/choices-standalone.log`。

```text
2026-10-03T20:26:30.8077746Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:54.7370519Z ##[group]npx playwright test --config playwright.choices.config.ts
2026-10-03T20:29:26.3399272Z   5 skipped
2026-10-03T20:29:26.3399706Z   18 passed (2.5m)
2026-10-03T20:31:47.7620286Z   19 passed (2.3m)
```

## automation-ir

作业`111286268344`：success。原始日志`evidence/automation-ir/ci-37151509207/automation-ir.log`。

```text
2026-10-03T20:26:28.8460433Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:49.7725740Z ##[group]npx playwright test --config playwright.automation-ir.config.ts
2026-10-03T20:27:25.8986199Z   4 passed (35.3s)
```

## automation-unified

作业`111286268357`：success。原始日志`evidence/automation-ir/ci-37151509207/automation-unified.log`。

```text
2026-10-03T20:26:35.7136099Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:56.9862093Z ##[group]DND_AUTOMATION_TEST_MODE=standalone npx playwright test --config playwright.automation209.config.ts
2026-10-03T20:31:29.7030099Z   26 passed (4.5m)
2026-10-03T20:31:29.7267906Z ##[group]npx playwright test --config playwright.unified191.config.ts
2026-10-03T20:32:46.3140582Z   2 skipped
2026-10-03T20:32:46.3141110Z   18 passed (1.3m)
```

## followup-230

作业`111286268358`：success。原始日志`evidence/automation-ir/ci-37151509207/followup-230.log`。

```text
2026-10-03T20:26:38.7195564Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:27:07.8042567Z ##[group]Run npx playwright install --with-deps firefox
2026-10-03T20:27:23.8790679Z ##[group]npx playwright test --config playwright.followup231.config.ts
2026-10-03T20:32:34.6464518Z   2 skipped
2026-10-03T20:32:34.6464808Z   52 passed (5.2m)
2026-10-03T20:32:34.6677421Z ##[group]npx playwright test --config playwright.followup-ui231.config.ts
2026-10-03T20:36:36.3522663Z   68 passed (4.0m)
```

## direct-232

作业`111286268359`：success。原始日志`evidence/automation-ir/ci-37151509207/direct-232.log`。

```text
2026-10-03T20:26:34.0583760Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:56.2992237Z ##[group]npx playwright test --config playwright.direct232.config.ts
2026-10-03T20:28:41.6205684Z   13 passed (1.7m)
2026-10-03T20:28:41.6440682Z ##[group]npx playwright test --config playwright.wiki232.config.ts
2026-10-03T20:31:04.5544505Z   17 passed (2.4m)
```

## class-drop-profile-232

作业`111286268371`：success。原始日志`evidence/automation-ir/ci-37151509207/class-drop-profile-232.log`。

```text
2026-10-03T20:26:33.0592319Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:54.9962045Z ##[group]node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --allowImportingTsExtensions --target ES2022 --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution Bundler --jsx react-jsx --strict --skipLibCheck --esModuleInterop --resolveJsonModule --types vite/client,node tools/profileClassDrops232.spec.ts
2026-10-03T20:26:55.2842142Z ##[group]node tools/profileClassDrops232.mjs
2026-10-03T20:32:22.0667055Z   32 passed (5.4m)
```

## edit-profile-232

作业`111286268381`：success。原始日志`evidence/automation-ir/ci-37151509207/edit-profile-232.log`。

```text
2026-10-03T20:26:33.3862681Z ##[group]Run npx playwright install --with-deps chromium
2026-10-03T20:26:57.1712105Z ##[group]node tools/profileCharacterEdits232.mjs
2026-10-03T20:31:56.6071505Z   12 passed (4.9m)
```
