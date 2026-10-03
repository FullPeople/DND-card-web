**第八轮 CI 独立终态核对：通过。结合已入库的同冻结技术通过报告，G5 可以放行。**

本补充关闭 `a804d3b` 技术报告中保留的 CI 证据缺口，不改写任何旧冻结报告。**G6 尚未开展，整体任务的九条 DoD 尚未全部完成。**

**一、冻结与远端终态**

已执行 `gh run view`，并另外通过 GitHub API 读取 run、jobs 和十八份原始日志。

| 项目 | 独立核实结果 |
|---|---|
| 仓库 | `FullPeople/DND-card-web` |
| Run | [37139204468](https://github.com/FullPeople/DND-card-web/actions/runs/37139204468) |
| 完整 SHA | `a804d3be3a16558c874db43ce6e2332a2950ad8b` |
| 分支 | `codex/automation-ir-20261003` |
| 触发方式 | `push` |
| Run attempt | `1` |
| 状态 | `completed` |
| 结论 | `success` |
| 创建时间 | `2026-10-03T17:04:59Z` |
| 最后更新时间 | `2026-10-03T17:16:02Z` |

十八个 job 的 `head_sha` 全部与上述完整 SHA 一致。当前工作树 HEAD 也仍为该提交，未发现 tracked 源码变化。

数据冻结仍为 `5f24e49380777d189fc4aefda712c780ac9bbc0f`。

**二、证据完整性**

本地证据目录：

[evidence/automation-ir/ci-37139204468](/workspace/dnd-automation-web/evidence/automation-ir/ci-37139204468)

核对结果：

- `jobs.json`：十八个 job 的 ID、状态、结论与远端 API 一致，保存的完整 SHA 一致。
- `summary.json`：十八组齐全，八十二条原文引用均能在对应远端日志中找到。
- 十八份 `*.log`：由审计员通过 GitHub API 重新读取，与本地文件**逐字节一致，18/18**。
- 未发现失败或 flaky 统计、`Retry #`、`##[error]` 记录。
- 当前冻结的 workflow 确实包含 **verify＋17 个浏览器组**，没有用历史“14 组”口径漏算任务。
- 十七个浏览器组共二十九条检查命令均出现 `Check passed`；其中包括独立严格类型检查，不能把二十九条全部称为浏览器测试配置。

workflow 对每条命令使用 `bash -eo pipefail`，任一命令失败会使组最终非零退出。原始日志和 job 终态共同支持各检查成功。

**三、逐 job 终态**

下表各项均已独立核对为 **`completed / success`**。

| Job | Job ID | 终态 |
|---|---:|---|
| verify | 111249944749 | completed / success |
| dashboard-appearance | 111250048295 | completed / success |
| screen-release | 111250048334 | completed / success |
| choices-standalone | 111250048337 | completed / success |
| feedback-touch | 111250048341 | completed / success |
| armor-feature-followup | 111250048347 | completed / success |
| automation-unified | 111250048357 | completed / success |
| automation-ir | 111250048366 | completed / success |
| monster-lifecycle | 111250048371 | completed / success |
| direct-232 | 111250048378 | completed / success |
| portrait-frame | 111250048380 | completed / success |
| card-fixes-235 | 111250048391 | completed / success |
| resources-sources | 111250048395 | completed / success |
| startup-order | 111250048433 | completed / success |
| followup-230 | 111250048436 | completed / success |
| startup-integration | 111250048439 | completed / success |
| class-drop-profile-232 | 111250048579 | completed / success |
| edit-profile-232 | 111250048580 | completed / success |

**四、逐命令原始统计**

统计按命令分别记录，不跨配置相加。日志未打印零项时，表中的零由完整命令日志、成功退出及无失败／跳过摘要共同确认。

verify 原文：

```text
Test Files  107 passed | 1 skipped (108)
Tests       898 passed | 25 skipped (923)
```

因此 `npm run check` 的测试结果为 **898 通过／25 跳过／0 失败**。文件级跳过与测试级跳过不是两个可相加的数字。

| 浏览器组 | 实际命令 | 原始摘要 | 通过／跳过／失败 |
|---|---|---|---:|
| dashboard-appearance | `npx playwright test --config playwright.dashboard237.config.ts` | `2 skipped`；`30 passed (1.5m)` | **30/2/0** |
| screen-release | `npx playwright test --config playwright.screen.config.ts` | `9 passed (1.6m)` | **9/0/0** |
| screen-release | `npm run test:release` | `59 passed (3.2m)` | **59/0/0** |
| choices-standalone | `npx playwright test --config playwright.choices.config.ts` | `5 skipped`；`18 passed (2.5m)` | **18/5/0** |
| choices-standalone | `npm run test:standalone` | `19 passed (2.4m)` | **19/0/0** |
| feedback-touch | `npx playwright test --config playwright.feedback198.config.ts` | `17 passed (1.7m)` | **17/0/0** |
| feedback-touch | `npx playwright test --config playwright.compat207.config.ts` | `9 passed (42.4s)` | **9/0/0** |
| feedback-touch | `npx playwright test --config playwright.touch.config.ts` | `6 skipped`；`6 passed (31.6s)` | **6/6/0** |
| armor-feature-followup | `npx playwright test --config playwright.armor-offsets.config.ts` | `5 passed (34.1s)` | **5/0/0** |
| armor-feature-followup | `npx playwright test --config playwright.feature-armor.config.ts` | `7 passed (34.4s)` | **7/0/0** |
| automation-unified | `DND_AUTOMATION_TEST_MODE=standalone npx playwright test --config playwright.automation209.config.ts` | `26 passed (4.6m)` | **26/0/0** |
| automation-unified | `npx playwright test --config playwright.unified191.config.ts` | `2 skipped`；`18 passed (1.3m)` | **18/2/0** |
| automation-ir | `npx playwright test --config playwright.automation-ir.config.ts` | `4 passed (34.1s)` | **4/0/0** |
| monster-lifecycle | `npx playwright test --config playwright.monster-lifecycle.config.ts` | `8 passed (46.7s)` | **8/0/0** |
| direct-232 | `npx playwright test --config playwright.direct232.config.ts` | `13 passed (1.7m)` | **13/0/0** |
| direct-232 | `npx playwright test --config playwright.wiki232.config.ts` | `17 passed (2.4m)` | **17/0/0** |
| portrait-frame | `npx playwright test --config playwright.portrait-frame.config.ts` | `1 skipped`；`9 passed (1.7m)` | **9/1/0** |
| card-fixes-235 | `npx playwright test --config playwright.card-fixes235.config.ts` | `10 passed (1.3m)` | **10/0/0** |
| resources-sources | `npx playwright test --config playwright.feedback217.config.ts` | `57 passed (4.4m)` | **57/0/0** |
| resources-sources | `npx playwright test --config playwright.source-feedback.config.ts` | `22 passed (2.8m)` | **22/0/0** |
| startup-order | `npx playwright test --config playwright.startup-order.config.ts` | `12 passed (52.2s)` | **12/0/0** |
| startup-order | `npx playwright test tests/e2e/threeDragonFullscreen.spec.ts --project=chromium` | `2 passed (9.7s)` | **2/0/0** |
| followup-230 | `npx playwright test --config playwright.followup231.config.ts` | `2 skipped`；`52 passed (5.3m)` | **52/2/0** |
| followup-230 | `npx playwright test --config playwright.followup-ui231.config.ts` | `68 passed (4.3m)` | **68/0/0** |
| startup-integration | `npx playwright test --config playwright.wiki-recovery.config.ts` | `7 passed (45.3s)` | **7/0/0** |
| startup-integration | `npx playwright test --config playwright.integration230.config.ts` | `5 skipped`；`58 passed (6.3m)` | **58/5/0** |
| class-drop-profile-232 | `node tools/profileClassDrops232.mjs` | `32 passed (6.2m)` | **32/0/0** |
| edit-profile-232 | `node tools/profileCharacterEdits232.mjs` | `12 passed (4.3m)` | **12/0/0** |

冻结中的脚本映射已核对：

```text
npm run test:release
→ playwright test --config playwright.release.config.ts

npm run test:standalone
→ playwright test --config playwright.standalone.config.ts
```

**五、构建及非测试检查**

verify 中以下操作均成功：

```text
npm ci
npm run check
  → vitest run
  → tsc -b && vite build
npm run build:standalone
  → tsc -b && vite build --mode standalone
```

两次构建原文：

```text
✓ built in 771ms
✓ built in 801ms
```

`class-drop-profile-232` 中独立严格检查成功，实际命令为：

```bash
node node_modules/typescript/bin/tsc \
  --ignoreConfig --noEmit --allowImportingTsExtensions \
  --target ES2022 --lib ES2022,DOM,DOM.Iterable \
  --module ESNext --moduleResolution Bundler \
  --jsx react-jsx --strict --skipLibCheck \
  --esModuleInterop --resolveJsonModule \
  --types vite/client,node tools/profileClassDrops232.spec.ts
```

这是成功的类型检查，不计作通过了多少条测试。其后的性能浏览器命令另列为 **32/0/0**。

workflow 中按条件跳过的 Firefox 安装、失败时上传等步骤，不计入测试 skipped 数，也不构成 job 未完成。

**六、只读核对复现命令**

远端 run 和完整 job 终态：

```bash
gh run view 37139204468 \
  --repo FullPeople/DND-card-web \
  --json databaseId,headSha,headBranch,status,conclusion,event,url,createdAt,updatedAt,jobs

gh api \
  'repos/FullPeople/DND-card-web/actions/runs/37139204468/jobs?per_page=100'
```

下面的命令重新从 GitHub API 读取十八份日志，在内存中与本地证据比较，不写文件：

```bash
cd /workspace/dnd-automation-web
python3 - <<'PY'
import concurrent.futures
import json
import pathlib
import re
import subprocess

repo = 'FullPeople/DND-card-web'
run = '37139204468'
sha = 'a804d3be3a16558c874db43ce6e2332a2950ad8b'
base = pathlib.Path('evidence/automation-ir/ci-' + run)

def api(path):
    return subprocess.check_output(['gh', 'api', path], timeout=90)

meta = json.loads(api(f'repos/{repo}/actions/runs/{run}'))
remote = json.loads(api(
    f'repos/{repo}/actions/runs/{run}/jobs?per_page=100'
))
saved = json.loads((base / 'jobs.json').read_text())
summary = json.loads((base / 'summary.json').read_text())

assert meta['head_sha'] == sha
assert meta['status'] == 'completed'
assert meta['conclusion'] == 'success'
assert remote['total_count'] == len(remote['jobs']) == 18
assert saved['headSha'] == sha
assert len(saved['jobs']) == len(summary) == 18

ansi = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')

def check(job):
    group = (
        'verify' if job['name'] == 'verify'
        else re.search(r'^browsers \(([^,]+),', job['name']).group(1)
    )
    assert job['head_sha'] == sha
    assert job['status'] == 'completed'
    assert job['conclusion'] == 'success'

    raw = api(f"repos/{repo}/actions/jobs/{job['id']}/logs")
    assert raw == (base / (group + '.log')).read_bytes(), group

    text = ansi.sub('', raw.decode('utf-8'))
    row = next(s for s in summary if s['group'] == group)
    assert row['job'] == job['id']
    assert row['status'] == job['status']
    assert row['conclusion'] == job['conclusion']
    for line in row['rawSummaryLines']:
        assert line in text, (group, line)

    local_job = next(
        j for j in saved['jobs']
        if j.get('databaseId', j.get('id')) == job['id']
    )
    assert local_job['status'] == job['status']
    assert local_job['conclusion'] == job['conclusion']
    return group, job['id'], len(raw)

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(check, remote['jobs']))

for group, job_id, size in results:
    print(group, job_id, 'completed/success',
          'remote log equals local', size, 'bytes')

print('verified jobs:', len(results))
print('verified summary lines:',
      sum(len(s['rawSummaryLines']) for s in summary))
PY
```

本次实际核对为：

```text
jobs=18
success=18
sameRawLogs=18
sameFrozenSha=18
mismatches=0
verifiedSummaryLines=82
```

**七、G5 闸门裁定与后续边界**

同一冻结的技术通过正文已保存为：

[AUDIT-AUTOMATION-IR-G5-DELTA-A804.md](/workspace/dnd-automation-web/docs/AUDIT-AUTOMATION-IR-G5-DELTA-A804.md)

其结论保持：

- HB1、HB2 已关闭；
- 本轮 G5 runtime／delta 范围未发现未关闭 P0、P1、P2；
- 原反例、129 项独立聚焦验证及身份／正常账本实验通过；
- 当时仅保留第八轮 CI 完整终态的独立核对。

本补充现已确认同冻结 **verify＋17 个浏览器组全部成功**，原始日志、逐命令统计和本地证据一致。因此：

**`a804d3be3a16558c874db43ce6e2332a2950ad8b` 的 G5 技术与 CI 证据闭合，G5 通过，可以进入计划规定的 G6 阶段。**

这不表示 G6 已经开始或完成，也不表示整体 DoD 全部完成：

- 生产 18,789 条口径未变；指定核心 6,396 条仍全部 `needsAnnotation`。
- test-only reviewed samples 不计生产覆盖。
- 技术正文中记载的后续流水线、对外材料及整体交付待办继续保留。
- G8 尚未完成。
- 此前失败冻结的报告和日志继续保留，不因本冻结通过而改写。

本轮仅进行只读 CI 核对，没有修改文件、创建提交或重新运行技术测试。
