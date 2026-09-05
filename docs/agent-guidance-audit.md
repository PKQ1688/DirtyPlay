# Agent 指令与工作流审计

审计日期：2026-09-05。目标模型：GPT-6 Astra。

## 结论与范围

本次将共享约定集中到 `AGENTS.md`，把具体回归流程放到按需读取的工作流文档与仓库 Skill，并修正影响验证可信度的测试脚本。保留用户的 Git、生产操作与系统配置授权边界。

审计前仓库有 `AGENTS.md`、`CLAUDE.md`、npm 脚本及历史测试计划；未发现仓库级 `SKILL.md`、`.agents/skills/`、`.codex/` 配置或 `.github/workflows/`。`server/internal/skill/` 是游戏技能代码，不是 Agent Skill。个人配置与已安装插件不属于本次仓库修改范围。

## 发现与处理

| 发现 | 处理 |
| --- | --- |
| AGENTS 只描述 Godot + Go，且声称没有自动化测试 | 补上主要 Web 客户端、现有 Go 测试与真实命令 |
| AGENTS 与 CLAUDE 重复维护架构、命令和约定，后者还复制易漂移的数值与协议清单 | CLAUDE 只指向共享约定；定位具体实现，不复制完整游戏规格 |
| 缺少自主执行、澄清边界与验证停止条件 | 常规决策自行推进；具体授权不足才询问；按影响选择检查 |
| 缺少可复用的 Agent Skill | 新增 `.agents/skills/dirtyplay-verify/SKILL.md`，只负责回归选择、执行与证据汇总 |
| npm 只暴露技能覆盖命令 | 增加 Web 语法、E2E 和功能冒烟入口，保留原技能覆盖命令 |
| E2E 未校验筛选名，可能零测试成功退出 | 未知名称在浏览器启动前失败，包含正确/错误名称混合的情况 |
| 房号徽标已带文字前缀，旧脚本仍要求整个徽标恰好六位；错误提示文案也已变化 | 从邀请码字段取值，验证徽标包含相同代码；校验提示含义、停留大厅及未发起连接 |
| 功能冒烟的速度、恢复和快捷键只打印结果；超时参数位置不正确 | 添加行为断言，修正 `waitForFunction` 参数，并在 `finally` 关闭浏览器 |
| 历史测试计划要求以旧断言为准 | 标明历史状态，改为确认当前需求后使用；README 同步实际客户端和工作流入口 |

## 官方依据与适配

- [GPT-6 Astra 模型指导](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)：自主完成、指令冲突、委派与适度验证是本次规则调整的依据；按仓库风险保留明确授权边界。
- [AGENTS.md 加载规则](https://learn.chatgpt.com/docs/agent-configuration/agents-md)：共享规则集中于标准入口，不依赖 `CLAUDE.md` 自动成为 Codex 指令，也不增加无用途的覆盖文件。
- [官方 Skill 指南](https://learn.chatgpt.com/docs/build-skills)：使用仓库 `.agents/skills/<name>/SKILL.md`、必需的 `name`/`description` 元数据与明确触发范围；具体命令按需读取。
- [Codex 最佳实践](https://learn.chatgpt.com/guides/best-practices)：采用简短且准确的约定、明确完成条件及可复用的真实工作流。复杂任务才需要计划；没有增加每次都要执行的审计清单。

本次没有写入模型、推理档位或权限配置。仓库提示词不能切换宿主模型或启用运行时能力；在宿主选择 GPT-6 Astra，按任务难度与实测质量调整推理档位，不能把最高档位等同于所有任务的最优性能。

## 验证与限制

| 检查 | 结果 |
| --- | --- |
| `npm run check:web` | 4 个 JavaScript 文件语法检查通过 |
| `go test ./...`（`server/`） | 全部包通过；使用临时 `GOCACHE` 适配沙箱缓存限制 |
| 无效 E2E 筛选 `typo`、`lobby,typo` | 均退出 1，并明确报告未知场景 |
| `DIRTYPLAY_TEST_ONLY=lobby,skills npm run verify:e2e` | 20 项通过、0 失败；本次服务为 `127.0.0.1:18080` |
| `npm run verify:features` | 快速开局及暂停、恢复、速度、P/Escape 断言通过 |
| 官方 Skill `quick_validate.py`（通过 uv 临时环境运行） | `Skill is valid!` |
| 本地 Markdown 链接、npm 依赖与锁文件一致性、`git diff --check` | 通过 |

浏览器汇总：`output/playwright/full-test/test-summary.json`，截图与其同目录；这些生成产物被 Git 忽略。首轮大厅回归失败后，根据当前实现修正了上述文案和房号取值问题，再运行受影响场景，未修改游戏逻辑来迎合测试。

共享入口 `AGENTS.md` + `CLAUDE.md` 从 107 行、4,784 字节变为 39 行、3,688 字节；具体命令与审计依据移到按需文档。这是文本体积变化，不能直接换算成 token、吞吐量或质量提升。

人工检查 Skill 的触发边界：行为改动后的回归、指定 Go 包测试、Godot 协议兼容性验证属于范围；修改说明文档不触发游戏回归。这是描述与流程审查，不等同于独立模型行为评测。

后续比较模型表现时，可固定代表任务与验收标准，记录完成率、误停次数、无效/重复检查、用时和用量。只有可重复的结果才用于评价性能提升。当前未新增远端 CI；E2E 只执行了上述两个场景，未运行全部九组、随机技能全覆盖或 Godot 场景回归。
