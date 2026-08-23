# 🃏 DirtyPlay - 千术德州扑克

一款创新的德州扑克游戏，将经典德州扑克与**技能牌（千术）**和**怀疑值系统**相结合，带来全新的策略体验。

## ✨ 游戏特色

- **德州扑克核心**：完整的德州扑克规则，支持盲注、下注、All-in、侧池计算
- **技能牌系统**：使用"千术"技能牌来窥视对手、欺骗敌人或操控牌局
- **怀疑值机制**：使用技能会积累怀疑值，过高会被对手察觉甚至禁用技能
- **视图隔离**：服务端维护真实状态，每个玩家只能看到属于自己的视图
- **AI 对手**：支持与 AI 玩家对战

## 🛠️ 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 客户端 | Godot 4.3 | 跨平台游戏引擎，支持 Web 导出 |
| 服务端 | Go 1.22+ | 高性能并发服务器 |
| 通信协议 | WebSocket | 实时双向通信 |
| 数据格式 | JSON | 简单易调试的消息格式 |

## 📁 项目结构

```
DirtyPlay/
├── client/                      # Godot 4 客户端
│   ├── project.godot            # Godot 项目配置
│   ├── scenes/                  # 场景文件
│   │   ├── main_menu.tscn       # 主菜单
│   │   └── game_table.tscn      # 牌桌场景
│   ├── scripts/                 # GDScript 脚本
│   │   ├── autoload/            # 全局单例
│   │   │   ├── game_manager.gd  # 游戏状态管理
│   │   │   └── network.gd       # WebSocket 通信
│   │   └── ui/                  # UI 控制
│
├── server/                      # Go 服务端
│   ├── go.mod                   # Go 模块配置
│   ├── cmd/server/              # 程序入口
│   │   └── main.go
│   └── internal/                # 内部包
│       ├── ws/                  # WebSocket 服务
│       │   ├── hub.go           # 连接管理中心
│       │   ├── client.go        # 客户端连接
│       │   ├── message.go       # 消息处理
│       │   └── server.go        # HTTP/WS 服务器
│       ├── game/                # 游戏核心逻辑
│       │   ├── room.go          # 房间管理
│       │   ├── room_manager.go  # 房间管理器
│       │   ├── player.go        # 玩家状态
│       │   ├── state.go         # 游戏状态机
│       │   ├── pot.go           # 底池/侧池计算
│       │   ├── conn.go          # 连接接口
│       │   └── view_builder.go  # 视图构建器
│       ├── poker/               # 扑克牌逻辑
│       │   ├── card.go          # 卡牌定义
│       │   ├── deck.go          # 牌堆管理
│       │   ├── hand.go          # 牌型定义
│       │   └── evaluator.go     # 牌型评估
│       ├── skill/               # 技能系统
│       │   ├── skill.go         # 技能定义
│       │   ├── effects.go       # 技能效果
│       │   └── heat.go          # 怀疑值系统
│       ├── protocol/            # 通信协议
│       │   ├── message.go       # 消息结构
│       │   └── types.go         # 类型定义
│       └── ai/                  # AI 系统
│           └── bot.go           # AI 玩家逻辑
│
├── web/                         # 浏览器可视化客户端与验证脚本
│   ├── index.html               # 页面入口
│   ├── app.js                   # UI 与交互逻辑
│   ├── styles.css               # 样式
│   └── skill_coverage_verify.mjs # Playwright 技能覆盖验证
│
└── docs/                        # 文档
    └── game_plan.md             # 详细技术方案
```

## 🎮 游戏规则

### 基础规则

- **玩家人数**：2-6 人
- **起始筹码**：1000
- **盲注**：小盲 5 / 大盲 10

### 游戏流程

```
等待玩家 → 发牌 → 翻牌前 → 翻牌 → 转牌 → 河牌 → 摊牌结算
```

### 技能牌系统

| 类型 | 技能名 | 效果 | 怀疑值 |
|------|--------|------|--------|
| 信息 | 窥视 | 查看对手一张手牌 | +15 |
| 欺诈 | 虚张声势 | 让对手看到假手牌 | +20 |
| 欺诈 | 迷雾 | 让对手看错公共牌 | +25 |
| 操作 | 换牌 | 弃一张牌，抽一张新牌 | +30 |
| 防御 | 反侦察 | 免疫一次信息技能 | +5 |

**使用规则：**
- 每个行动回合最多使用 1 张技能牌
- 使用时机：在自己回合的下注动作前
- 手牌上限：3 张

### 怀疑值系统

- **积累**：使用技能会增加怀疑值
- **警告阈值 (70)**：对手收到"此人行为可疑"提示
- **锁定阈值 (100)**：无法使用任何技能
- **衰减**：每手牌结算后 -10

## 🚀 快速开始

### 环境要求

- **Go 1.22+**
- **Godot 4.3+**

### 启动服务端

```bash
cd server

# 安装依赖
go mod download

# 运行服务器
go run cmd/server/main.go
```

服务端默认运行在 `ws://localhost:8080/ws`

### 启动客户端

1. 使用 Godot 4 打开 `client/project.godot`
2. 按 F5 运行游戏

### 启动浏览器可视化客户端（推荐）

1. 启动服务端（会同时托管 `web/` 静态页面）：

```bash
cd server
go run cmd/server/main.go
```

2. 浏览器打开：`http://localhost:8080`
3. 输入昵称后点击“快速开局”即可直接对战 3 名 AI
4. 若要与好友游玩，可创建好友房并分享 6 位邀请码

### 浏览器可视化界面说明

- 公共牌、手牌、玩家席位均为可视化卡牌组件（红黑花色区分）
- 当前行动玩家席位会高亮
- 摊牌或弃牌结束后会展示赢家、奖金与牌型，并自动续下一手
- 提供行动倒计时、快捷加注、键盘快捷键和内置玩法说明
- 公共牌发牌、下注变化、状态变化包含轻量动画反馈
- 移动端支持横屏可玩（竖屏会提示切换横屏）
- 调试接口：
  - `window.render_game_to_text()`：输出当前可视状态 JSON
  - `window.advanceTime(ms)`：推进 UI 计时/动画队列

### 浏览器技能回归（一键覆盖验证）

在服务端运行后，可执行以下命令自动覆盖验证 `counter / mist / peek / bluff / swap`：

```bash
npm run verify:skills
```

验证完成后会生成：

- 汇总结果：`output/playwright/skill-coverage/skill-coverage-summary.json`
- 每个技能的截图与断言：`output/playwright/skill-coverage/*.png` 与 `output/playwright/skill-coverage/*.json`

### 构建生产版本

**服务端：**
```bash
cd server
go build -o bin/server cmd/server/main.go
./bin/server
```

**客户端（Web 导出）：**
1. 在 Godot 中：`Project → Export → Add Preset → Web`
2. 配置导出路径并导出

## 📡 通信协议

### 消息格式

```json
{
  "type": "action",
  "seq": 1,
  "payload": { ... }
}
```

### 主要消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `join` | C→S | 加入房间 |
| `ready` | C→S | 准备就绪 |
| `action` | C→S | 游戏动作（下注/弃牌等） |
| `use_skill` | C→S | 使用技能 |
| `game_state` | S→C | 游戏状态更新 |
| `player_view` | S→C | 玩家视图更新 |
| `error` | S→C | 错误消息 |

## 🔧 开发指南

### 添加新技能

1. 在 `server/internal/skill/skill.go` 定义技能类型
2. 在 `server/internal/skill/effects.go` 实现技能效果
3. 在 `client/scripts/ui/game_table.gd` 增加技能选择与发送逻辑
4. 在 `client/scripts/autoload/game_manager.gd` 调整 `use_skill` 请求字段（如需要）

### 调试技巧

- 服务端日志会输出详细的游戏状态变化
- 客户端可通过 Godot 的 Remote 面板查看运行时状态
- WebSocket 消息可通过浏览器开发者工具监控

## 📖 文档

- [详细技术方案](docs/game_plan.md) - 完整的游戏设计和技术实现文档

## 📄 许可证

本项目仅供学习和研究使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Happy Playing! 🎰**
