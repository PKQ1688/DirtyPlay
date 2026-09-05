# DirtyPlay 开发工作流

这里维护可执行命令与验证选择；协作规则统一放在 [AGENTS.md](../AGENTS.md)。以下命令在仓库根目录执行，另有说明除外。

## 环境与启动

- Go 版本要求见 `server/go.mod`，Node.js 要求见锁定的 Playwright 包（当前为 Node.js 18+）。
- Web 无打包步骤；首次安装回归依赖执行 `npm ci`，缺少浏览器时执行 `npx playwright install chromium`。不要依赖个人 Codex 技能目录中的 Playwright 回退路径。
- Godot 仅在涉及 `client/` 时需要，当前 `client/project.godot` 标记为 4.5。

在单独终端启动本地服务：

```bash
cd server
go run ./cmd/server
```

默认页面为 `http://127.0.0.1:8080`，WebSocket 为 `/ws`。已有服务时先核对是否为当前仓库实例；端口被其他程序占用时换端口，不结束未知进程：

```bash
cd server
DIRTYPLAY_ADDR=127.0.0.1:18080 go run ./cmd/server
```

此时在测试命令前设置 `DIRTYPLAY_URL=http://127.0.0.1:18080`。静态目录默认从 `./web`、`../web` 查找，特殊启动目录可设置 `DIRTYPLAY_WEB_DIR`。测试结束后清理本任务启动的进程。

## 按改动选择检查

| 改动 | 起点 | 扩大验证的条件 |
| --- | --- | --- |
| 文档、指令、Skill | diff、路径/命令与 Skill 元数据检查 | 改了可执行入口时实际运行该入口 |
| Go 局部逻辑 | `cd server && go test ./internal/game`，替换为相关包；对改动文件执行 `gofmt` | 共享协议、牌局流程或多包影响：`go test ./...` 与 `go build ./...` |
| Go 并发/连接生命周期 | 相关包测试 | 按影响范围执行 `go test -race ./internal/game ./internal/ws` |
| Web 交互、状态显示 | `npm run check:web` 与相关 E2E 场景 | 共享状态或流程变化时执行完整 `npm run verify:e2e` |
| CSS、响应式布局 | `DIRTYPLAY_TEST_ONLY=responsive npm run verify:e2e` 并查看截图 | 交互区域变化时补相关场景 |
| 技能规则与效果 | `cd server && go test ./internal/skill ./internal/game` | 浏览器技能交互变化时补 `npm run verify:skills` |
| Godot 场景/GDScript | Godot 打开项目，F5 运行受影响流程并检查错误 | 协议变化时同时验证服务端及受影响客户端 |

这些是选择依据，不是每次任务都必须完整执行的清单。

## 浏览器场景与证据

现有脚本直接由 Node 执行，不使用 Playwright Test 的 `.spec` 发现机制。E2E、技能覆盖和功能冒烟都要求先启动服务。

```bash
# 示例：只验证行动与重连
DIRTYPLAY_TEST_ONLY=actions,reconnect npm run verify:e2e

# 快速开局、暂停、速度、快捷键的补充冒烟
npm run verify:features
```

`DIRTYPLAY_TEST_ONLY` 只适用于 `verify:e2e`，使用下列精确名称（逗号分隔）；未设置时执行全部场景：

| 名称 | 场景 |
| --- | --- |
| `lobby` | 大厅与手动开局 |
| `auto_start` | 双人自动开局与加入错误 |
| `room_full` | 满房与等待室上限 |
| `actions` | 行动控制与防重复点击 |
| `skills` | 技能面板与调试导出 |
| `reconnect` | 刷新重连 |
| `disconnect` | 断线代行 |
| `hand_flow` | 手牌流程 |
| `responsive` | 桌面、移动端横竖屏 |

- E2E 证据在 `output/playwright/full-test/`；读取本次 `test-summary.json`，检查目标场景确实执行、`total > 0` 且 `failCount = 0`。未知筛选名称会在启动浏览器前报错。
- 技能覆盖证据在 `output/playwright/skill-coverage/`；检查本次 `skill-coverage-summary.json` 的 `missingSkills` 为空。脚本依赖随机发牌，最多尝试 80 次；未覆盖时区分抽样不足和真实失败，不循环重跑到通过。
- `verify:features` 对暂停/恢复、速度切换及 P/Escape 快捷键进行断言；行动区文字和牌型内容仅作日志观察，涉及这些行为时补对应检查。
- UI 改动查看相应截图与浏览器错误；截图写入失败可能只记录警告。记录实际看到的证据，不沿用旧产物。
- `docs/playwright-test-plan.md` 是历史场景清单，旧行号、缺陷状态和部分预期需要重新核实。

## 交付

检查 `git diff --check`、diff 和新增文件，简要报告改动、实际执行的检查及剩余限制。当前仓库没有 GitHub Actions CI；上述命令用于本地工作流，不表示已配置远端自动验证。
