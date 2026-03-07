# DirtyPlay Playwright 测试计划

> 版本: v1.0 — 2026-03-07
> 基于代码分析（`web/app.js`、`server/internal/game/room.go`、`protocol/types.go` 等）制定

---

## 已知问题（代码分析直接识别）

| 编号 | 问题描述 | 代码位置 | 优先级 |
|------|---------|---------|------|
| BUG-001 | 添加 1 个 AI 后游戏立即开局，玩家无机会再添加更多 AI | `room.go:92-98`：ticker 每秒检测 `ActiveCount() >= 2` 即启动 | P0 |
| BUG-002 | 行动按钮始终禁用（"无法控制"）| `app.js:877`：`canActNow` 同时依赖 `isMyTurn`（来自 `state` 消息）和 `ownsActionReq`（来自 `action_req` 消息）；若两者时序错位则永久禁用 | P0 |
| BUG-003 | Bot 死循环风险：`sendActionRequest()` 中 `botAct()` 返回 false 时退出循环，人类玩家可能收不到 `action_req` | `room.go:389-426` | P1 |
| BUG-004 | 重连场景：re-join 使用邀请码而非 player_id 时，若 localStorage 中无 player_id，新建玩家而非恢复旧席位 | `room_manager.go:118` | P1 |

---

## 测试覆盖全景

```
Group 1:  大厅加载与导航         (TC01–TC06)
Group 2:  建房与等待室           (TC07–TC11)
Group 3:  开局逻辑 [含 BUG-001] (TC12–TC17)
Group 4:  玩家行动控制 [含 BUG-002] (TC18–TC30)
Group 5:  Bot 行为               (TC31–TC34)
Group 6:  技能系统               (TC35–TC45)
Group 7:  游戏状态显示           (TC46–TC54)
Group 8:  手牌流程               (TC55–TC59)
Group 9:  刷新重连               (TC60–TC65)
Group 10: 边界情况与错误处理     (TC66–TC70)
Group 11: 响应式布局             (TC71–TC73)
Group 12: 调试导出(renderGameToText) (TC74–TC78)
```

---

## Group 1: 大厅加载与导航

### TC01 — 页面正常加载
**目的**: 确认服务器可访问、JS 无崩溃
**前置**: 服务器已启动（`go run cmd/server/main.go`）
**步骤**:
1. 打开 `http://localhost:8080`

**断言**:
- HTTP 响应状态码 = 200
- 页面 `<title>` 包含 "DirtyPlay"
- `#createRoomBtn` 可见且可点击
- `#joinRoomBtn` 可见且可点击
- `#lobbyScreen` 可见，`#gameScreen` 不可见（`display:none`）
- 控制台无 JavaScript 错误（监听 `page.on('pageerror')`）

---

### TC02 — 初始连接状态文字
**目的**: 确认 WebSocket 连接前状态提示正确
**步骤**:
1. 打开大厅页面，不进行任何操作

**断言**:
- `#statusText` 文字包含 "未连接"
- `#gameScreen` `display` 为 `none`
- `#waitingRoom` 不可见

---

### TC03 — 加入房间码客户端校验（短码）
**目的**: 验证短于 6 位的房间码被前端拦截
**步骤**:
1. 打开大厅
2. 填写 `#lobbyNameInput` = "TestUser"
3. 填写 `#roomCodeInput` = "ABC"（3位）
4. 点击 `#joinRoomBtn`

**断言**:
- `#lobbyError` 可见且文字 = "请输入6位邀请码"
- 页面停留在大厅（`#lobbyScreen` 仍可见）
- WebSocket **未**被创建（无网络连接发出）

---

### TC04 — 加入不存在的房间码（服务端错误）
**目的**: 验证无效 6 位码返回友好中文错误
**步骤**:
1. 打开大厅
2. 填写名称 = "TestUser"
3. 填写 `#roomCodeInput` = "ZZZZZZ"
4. 点击 `#joinRoomBtn`

**断言**:
- `#lobbyError` 可见且文字包含 "邀请码无效"（来自 `SERVER_ERROR_MAP` 或服务端原文）
- 页面停留在大厅

---

### TC05 — 空昵称建房（默认名称回退）
**目的**: 验证空昵称时服务端分配默认名
**步骤**:
1. 清空 `#lobbyNameInput`
2. 点击 `#createRoomBtn`

**断言**:
- 成功进入游戏屏（`#gameScreen` 可见）
- 座位中玩家名显示非空（服务端返回 "Player1" 等默认名）

---

### TC06 — 返回大厅按钮
**目的**: 验证游戏中可以返回大厅
**步骤**:
1. 建房进入等待室
2. 点击 `#backToLobbyBtn`

**断言**:
- `#lobbyScreen` 重新可见
- `#gameScreen` 隐藏
- `#statusText` 或 `#lobbyError` 无残留错误
- WebSocket 连接已关闭（状态显示"未连接"或 WS readyState = CLOSED）

---

## Group 2: 建房与等待室

### TC07 — 建房成功，邀请码正确显示
**目的**: 验证房间创建后 UI 同步
**步骤**:
1. 填写名称 = "HostPlayer"
2. 点击 `#createRoomBtn`

**断言**:
- `#gameScreen` 可见
- `#roomCodeBadge` 文字长度 = 6（大写字母+数字）
- `#waitingCode` 与 `#roomCodeBadge` 内容一致
- `#statusText` 包含 "已创建房间"
- `#waitingRoom` 可见（phase = waiting）

---

### TC08 — 等待室玩家计数
**目的**: 验证等待室人数提示正确
**步骤**:
1. 建房后（1名玩家）

**断言**:
- `#waitingPlayerCount` 文字包含 "1" 和 "6"（格式：`当前 1 人 / 最多 6 人`）
- `#waitingRoom` 内提示文字包含 "满2人自动开局"

---

### TC09 — 等待室控件可见性
**目的**: 验证等待室中关键控件存在
**断言**:
- `#addBotBtn` 可见
- `#copyCodeBtn` 可见
- `#waitingCode` 非空
- 行动按钮（`#foldButton` 等）均处于 `disabled` 状态

---

### TC10 — 复制邀请码按钮（功能存在）
**步骤**:
1. 建房后点击 `#copyCodeBtn`

**断言**:
- 无 JS 错误产生（剪贴板 API 不可用时静默失败 `.catch(() => {})` ✓）

---

### TC11 — addBotBtn 仅在等待阶段可见
**目的**: 确认游戏开始后等待室隐藏
**步骤**:
1. 建房，添加 1 个 bot 后等待游戏自动开始
2. 观察 `#waitingRoom` 状态

**断言**:
- 游戏开始后 `#waitingRoom` `display = none`
- `#addBotBtn` 不可见

---

## Group 3: 开局逻辑（⚠️ 含 BUG-001）

### TC12 — [BUG-001] 添加 1 个 AI 后游戏自动开始
**目的**: 复现并验证 BUG-001 — 用户无法在开局前添加更多 bot
**步骤**:
1. 建房（1 名玩家）
2. 点击 `#addBotBtn` 1次

**观测（当前行为）**:
- 约 1 秒内游戏自动开始（服务端 ticker 每秒检查 `ActiveCount() >= 2`）
- 玩家无法再点击 `#addBotBtn`（等待室已隐藏）

**期望行为（应修复）**:
- 添加 bot 后不应立即开局，应等待玩家点击 "开始游戏" 按钮
- 或：`minPlayersToStart` 提高至 3（但会影响最小游戏规模）
- 或：提供延迟（如 "3秒后自动开局"）给玩家添加更多 bot

**断言（验证修复后）**:
- 添加 1 个 bot 后，游戏 **不** 立即开始（phase 仍 = waiting）
- `#waitingRoom` 仍可见
- `#addBotBtn` 仍可用
- 玩家主动点击"开始游戏"后，game 才进入 preflop

---

### TC13 — 两名真实玩家加入触发开局
**目的**: 验证 2 人直接加入（无 bot）游戏同样自动开始
**步骤**:
1. 浏览器 A 建房，获得邀请码
2. 浏览器 B 用邀请码加入同一房间
3. 等待游戏开始

**断言**:
- 两个浏览器均显示 phase ≠ "waiting"
- 两个浏览器均看到 2 个座位
- 两个浏览器均收到 2 张手牌

---

### TC14 — 开局后牌局阶段正确
**步骤**:
1. 建房 + 添加 1 bot → 等待开局

**断言**:
- 初始 phase 为 "preflop"（dealing 为中间态，应快速过渡）
- `#phaseText` 显示 "阶段: 翻牌前"
- `#potText` 显示 pot > 0（大小盲已入池：5+10=15）

---

### TC15 — 开局后手牌发放
**断言**:
- `#handCards` 包含 2 个牌元素（`.poker-card`）
- 调试导出 `my_hand` 数组长度 = 2
- 牌面格式符合规范（如 "AH"、"9S"、"TC"）

---

### TC16 — 开局后对手座位显示
**断言**:
- `.seat` 元素数量 = 2（1 人 + 1 bot）
- 对手座位显示背面牌（`.is-back` 类）
- 座位显示筹码量 = 1000（初始）

---

### TC17 — 房间最多 6 人限制
**步骤**:
1. 建房后连续点击 `#addBotBtn` 5次（添加5个bot = 1+5=6人）
2. 尝试再添加第 7 个

**断言**:
- 前 5 次成功（若游戏还未开始）
- 第 6 次点击（超出上限）无法添加，可能显示错误

---

## Group 4: 玩家行动控制（⚠️ 含 BUG-002）

### TC18 — [BUG-002] 等待玩家回合时行动按钮启用
**目的**: 复现并验证 BUG-002 — 按钮始终 disabled
**步骤**:
1. 建房 + 添加 bot → 开局
2. 等待 `current_player` = 自己（可通过调试导出检查）

**观测（当前可能行为）**:
- 即使 `state.current_player === playerId`，行动按钮仍为 disabled

**根因分析**:
- `canActNow = isActionPhase(phase) && isMyTurn && ownsActionReq`
- `ownsActionReq` 需要 `action_req` 消息中 `player_id === playerId`
- 若 `state` 消息先到、`action_req` 未到，或 `syncActionReqWithState` 错误清空 `actionReq`，则 `ownsActionReq = false`

**断言（修复后）**:
- 收到 `action_req` 后 `#foldButton`/`#checkButton`/`#callButton` 中至少一个 `disabled = false`
- 调试导出 `controls.fold_enabled || controls.check_enabled || controls.call_enabled` = true

---

### TC19 — 行动按钮与 valid_actions 对应
**步骤**:
1. 等到玩家回合（preflop，有大盲 to_call > 0）

**断言**:
- `#foldButton` 不 disabled（`valid_actions` 含 "fold"）
- `#callButton` 不 disabled（`valid_actions` 含 "call"，因有 to_call）
- `#checkButton` disabled（preflop 首轮不含 "check"）
- 调试导出 `action_request.valid_actions` 与按钮状态一致

---

### TC20 — Fold 行动
**步骤**:
1. 等到玩家回合
2. 点击 `#foldButton`

**断言**:
- 行动后 `current_player` 不再是自己
- 调试导出 `seats` 中自己的 `last_action = "fold"` 或 `status = "folded"`
- `#actionLogList` 新增 fold 记录
- 行动按钮重新 disabled（不是自己的回合）

---

### TC21 — Check 行动（preflop 大盲 check）
**场景**: 2人游戏，preflop 小盲 call 后，大盲可以 check
**步骤**:
1. 小盲 call → 大盲回合
2. 点击 `#checkButton`

**断言**:
- 阶段进入 flop 或 turn（下一阶段）
- `#communityCards` 出现 3 张牌

---

### TC22 — Call 行动
**步骤**:
1. 等到玩家回合（to_call > 0）
2. 点击 `#callButton`

**断言**:
- 底池增加（`total_pot` 增加 = to_call 金额）
- 玩家筹码减少对应金额
- 回合前进

---

### TC23 — Raise 行动（金额校验）
**步骤**:
1. 等到玩家回合（`valid_actions` 含 "raise"）
2. 设置 `#raiseInput` 值 = `min_raise_to`（调试导出获取）
3. 点击 `#raiseButton`

**断言**:
- Raise 成功，底池增加
- `#raiseInput` 初始值已被 `updateActionArea()` 预填为最小加注额

---

### TC24 — All-in 行动
**步骤**:
1. 等到玩家回合
2. 点击 `#allInButton`

**断言**:
- 玩家筹码变为 0
- 玩家 `status` = "all_in"
- 边池正确创建（若对手筹码不足）

---

### TC25 — 非行动阶段按钮不可用
**步骤**:
1. 游戏处于 waiting 或 showdown 阶段

**断言**:
- 所有行动按钮均 disabled（`foldButton.disabled = true` 等）

---

### TC26 — 非自己回合按钮不可用
**步骤**:
1. 游戏进行中，但 `current_player` 是 bot（等待 bot 行动时）

**断言**:
- 所有行动按钮均 disabled
- `#useSkillButton` disabled

---

### TC27 — 行动后回合推进（轮转验证）
**步骤**:
1. 记录行动前 `current_player`
2. 执行一个行动
3. 等待 state 更新

**断言**:
- `current_player` 已变为下一位玩家（不再是自己）
- `#turnText` 文字更新

---

### TC28 — 行动日志实时更新
**步骤**:
1. 执行 fold/check/call 任意行动

**断言**:
- `#actionLogList` 的 `<li>` 数量增加
- 新条目包含玩家名和行动类型（中文：弃牌/过牌/跟注）

---

### TC29 — Raise 金额输入验证（前端预填）
**步骤**:
1. 等到玩家回合（含 raise 权限）

**断言**:
- `#raiseInput` 的 value 已被 `updateActionArea()` 预设为 `minRaiseTo`
- `#minRaiseText` 显示正确的最小加注增量
- `#maxRaiseText` 显示正确的加注上限

---

### TC30 — 发送行动后按钮暂时 disable
**目的**: 防止重复点击
**步骤**:
1. 点击 `#foldButton`
2. 立即检查按钮状态

**断言**:
- 点击后按钮立即进入 disabled（因 `current_player` 变更前客户端状态更新）

---

## Group 5: Bot 行为

### TC31 — Bot 自动行动
**步骤**:
1. 建房 + 添加 1 bot → 开局
2. 等待 bot 的回合（`current_player` 是 bot）

**断言**:
- Bot 在 5 秒内自动完成行动（不需要人类点击）
- `#actionLogList` 出现 bot 的行动记录
- `current_player` 切换到下一个玩家

---

### TC32 — Bot 行动不占用人类控制权
**断言**:
- Bot 行动期间，人类的行动按钮仍 disabled（`current_player` ≠ 自己）
- Bot 行动完成后，若轮到人类，按钮应启用

---

### TC33 — 全 bot 完成一轮
**步骤**:
1. 建房 + 5 个 bot（若游戏会自动开始）

**断言**:
- 游戏能自动完成整手牌（preflop → showdown → 新手牌）
- 无超时，无死循环

---

### TC34 — 超时机制（Bot 代为行动）
**步骤**:
1. 等到玩家回合
2. 不操作，等待 30 秒超时

**断言**:
- 超时后自动 fold 或自动行动
- 游戏继续进行（不卡死）
- `#actionLogList` 显示超时行动记录

---

## Group 6: 技能系统

### TC35 — 技能面板显示
**步骤**:
1. 开局后查看技能面板

**断言**:
- `#skillButtons` 内有至少 1 个技能按钮
- `#skillsText` 显示技能名（如 "窥视(peek)"）

---

### TC36 — Counter（反侦察）被动技能不可主动使用
**前置**: 玩家持有 counter 技能
**步骤**:
1. 等到自己回合
2. 点击 counter 技能按钮
3. 点击 `#useSkillButton`

**断言**:
- `#useSkillButton` disabled（或：点击后显示 "该技能为被动技能，不能主动施放"）
- `#skillHintText` 包含 "被动技能"

---

### TC37 — Mist（迷雾）翻牌前不可用
**前置**: 玩家持有 mist 技能
**步骤**:
1. Preflop 阶段，选择 mist 技能

**断言**:
- `#useSkillButton` disabled
- `#skillHintText` 包含 "翻牌后" 或 "至少 1 张公共牌"

---

### TC38 — Mist 翻牌后可用
**前置**: 玩家持有 mist，当前为 flop/turn/river
**断言**:
- 选中 mist 后 `#useSkillButton` 不 disabled（若轮到自己）
- 点击使用后 `#statusText` 包含 "技能生效"

---

### TC39 — Peek（窥视）需选择目标
**前置**: 玩家持有 peek
**步骤**:
1. 等到自己回合
2. 选择 peek 技能

**断言**:
- `#targetSelect` 可见（`display` 非 none）
- `#cardIdxSelect` 不可见
- 若 `#targetSelect` 未选目标（value=""），`#useSkillButton` disabled
- 选择目标后 `#useSkillButton` 启用

---

### TC40 — Swap（换牌）需选择手牌索引
**前置**: 玩家持有 swap
**步骤**:
1. 等到自己回合
2. 选择 swap 技能

**断言**:
- `#cardIdxSelect` 可见（`display` 非 none）
- `#targetSelect` 不可见
- `#useSkillButton` 启用（有手牌时）

---

### TC41 — 技能使用后 heat 增加
**步骤**:
1. 使用一次 peek（heat+15）

**断言**:
- `#heatText` 数值增加 15
- 调试导出 `my_heat` 对应增加

---

### TC42 — heat ≥ 70 警告显示
**前置**: 触发怀疑值 ≥ 70
**断言**:
- 对手座位出现 "可疑" 标签（`.seat` 中含 `.action.warning` chip）
- `#heatText` 显示高于 70 的数值

---

### TC43 — heat ≥ 100 技能锁定
**前置**: 自身 heat ≥ 100
**断言**:
- 所有技能按钮标记为不可用（`.is-unavailable` 类）
- `#useSkillButton` disabled
- 提示文字包含 "怀疑值过高" 或 "锁定"

---

### TC44 — 每手牌结束 heat 衰减
**步骤**:
1. 使用技能使 heat > 0
2. 完成一手牌

**断言**:
- 下一手牌开始时 `my_heat` 减少 10

---

### TC45 — 每回合只能使用一次技能
**步骤**:
1. 使用一次技能成功
2. 再次点击 `#useSkillButton`

**断言**:
- 第二次显示错误 "本回合你已经使用过一次技能"
- `#useSkillButton` 变为 disabled（`can_use_skill = false`）

---

## Group 7: 游戏状态显示

### TC46 — 阶段文字正确切换
**步骤**:
1. 跟踪游戏从 preflop 到 showdown

**断言**:
- `#phaseText` 依次显示：
  - "阶段: 翻牌前"（preflop）
  - "阶段: 翻牌"（flop）
  - "阶段: 转牌"（turn）
  - "阶段: 河牌"（river）
  - "阶段: 摊牌"（showdown）

---

### TC47 — 公共牌按阶段递增显示
**断言**:
- Preflop: `#communityCards` 无牌（0 张）
- Flop: 3 张
- Turn: 4 张
- River: 5 张
- `#communityText` 文字与牌数对应

---

### TC48 — 底池在大小盲后正确显示
**步骤**:
1. Preflop 开始时检查

**断言**:
- `#potText` 显示 15（小盲5+大盲10）
- `#mainPotText` 显示 "主池: 15"
- `#sidePotsText` 显示 "边池: -"（无边池时）

---

### TC49 — 当前行动玩家高亮
**断言**:
- 当前行动玩家的 `.seat` 元素含 `is-current` 类
- 座位内含 "行动中" chip
- `#turnText` 显示该玩家名

---

### TC50 — 对手手牌背面显示
**断言**:
- 其他玩家座位显示背面牌（`.is-back` 类的 `.poker-card`）
- `player.hand` 在 state 消息中为空（服务端隐藏）

---

### TC51 — 摊牌阶段揭示所有手牌
**步骤**:
1. 等待游戏到达 showdown

**断言**:
- 存活玩家的座位出现正面牌（非 `.is-back`）
- 调试导出中 `visible_hand` 有内容

---

### TC52 — 胜者筹码分配
**步骤**:
1. 记录 showdown 前各玩家筹码
2. showdown 结束后检查

**断言**:
- 底池金额分配给胜者
- 所有玩家筹码总和不变（守恒）

---

### TC53 — 行动日志包含盲注
**步骤**:
1. 开局后检查 `#actionLogList`

**断言**:
- 存在 "小盲" 条目
- 存在 "大盲" 条目
- 条目格式：`玩家名 + 行动 + 金额`

---

### TC54 — Dealer 位置标记
**步骤**:
1. 检查首局 DealerSeat

**断言**:
- 调试导出 `seats` 中存在玩家位置数据（`layout_slot`）
- 多手牌后 DealerSeat 在玩家间轮换

---

## Group 8: 手牌完整流程

### TC55 — 完整一手牌（preflop → showdown）
**步骤**:
1. 建房 + 1 bot → 开局
2. 等待游戏自动完成（bot 和人类各行动）或手动操作完成一手

**断言**:
- 阶段依次经过：preflop → flop → turn → river → showdown
- 整手牌在 60 秒内完成

---

### TC56 — 摊牌后自动开始下一手
**步骤**:
1. 等待 showdown 结束

**断言**:
- 3~5 秒后新手牌开始（`hand_seq` 递增）
- 手牌重置（新的 2 张牌）
- 公共牌清空
- 底池归零

---

### TC57 — hand_seq 单调递增
**步骤**:
1. 完成 3 手牌

**断言**:
- 每手 `hand_seq` 比前一手大（调试导出）

---

### TC58 — 筹码耗尽玩家出局
**前置**: 某玩家 all-in 且落败
**断言**:
- 出局玩家 `status = "out"`
- 出局玩家筹码 = 0
- 下一手牌该玩家不参与（`status` 保持 "out"）

---

### TC59 — Dealer 按钮每手轮换
**步骤**:
1. 记录第 1 手 `dealer_seat`
2. 完成 2 手牌后检查

**断言**:
- 第 2 手的 `dealer_seat` 不同于第 1 手

---

## Group 9: 刷新重连

### TC60 — 刷新后 player_id 从 localStorage 恢复
**步骤**:
1. 建房，记录 `appState.playerId`（通过 evaluate）
2. `page.reload()`
3. 检查 localStorage

**断言**:
- 刷新后 `localStorage.getItem('dirtyplay_player_id')` 与原 playerId 一致

---

### TC61 — 重连恢复游戏状态
**步骤**:
1. 建房 + bot → 开局
2. 记录当前 phase 和 my_hand
3. `page.reload()`
4. 重新输入邀请码 + 同一名称 → 加入

**断言**:
- 重连后 phase 与刷新前相同
- `my_hand` 与刷新前相同（服务端保留手牌）
- `#statusText` 包含 "牌局进行中"

---

### TC62 — 重连后若轮到自己，行动按钮应启用
**步骤**:
1. 在自己回合时刷新
2. 重连同一房间

**断言**:
- 重连后收到新的 `action_req` 消息
- 行动按钮重新启用

---

### TC63 — 重连使用旧 player_id 恢复席位
**步骤**:
1. `page.reload()`
2. 填写相同名称，`#roomCodeInput` 填入原邀请码
3. 点击 `#joinRoomBtn`

**断言**:
- 重连后 `appState.playerId` 与刷新前一致（因 join_room 携带 player_id）
- 自己座位仍在 "bottom" 位置（`layout_slot = "bottom"`）

---

### TC64 — 另一浏览器加入不影响已有玩家状态
**步骤**:
1. 浏览器 A 已在游戏中
2. 浏览器 B 使用邀请码加入

**断言**:
- 浏览器 A 的 phase、hand 不变
- 浏览器 A 收到新的 state 消息（含新玩家）

---

### TC65 — 断线重连 bot 代行（超时逻辑）
**步骤**:
1. 在自己回合时关闭 WebSocket（模拟断线，`page.evaluate(() => appState.ws.close())`）
2. 等待 `evictTimeout = 8 秒`

**断言**:
- 8 秒后服务端检测到断线，自动处理该玩家的回合
- 游戏继续进行（bot 正常完成后续行动）

---

## Group 10: 边界情况与错误处理

### TC66 — 房间满员（6人）
**步骤**:
1. 建房 + 添加 5 个 bot
2. 用第 7 人（新浏览器）尝试加入

**断言**:
- 返回错误 "room full"（映射为中文）
- 新浏览器停留在大厅，显示错误

---

### TC67 — WebSocket 断开状态提示
**步骤**:
1. 进入游戏后执行 `page.evaluate(() => appState.ws.close())`

**断言**:
- `#statusText` 变为 "状态: 连接已断开"（`data-kind="error"`）

---

### TC68 — 服务端错误消息中文化
**步骤**:
1. 不在自己回合时，尝试发送 action（通过 evaluate 直接调用 `sendAction('fold')`）

**断言**:
- `#statusText` 或界面提示为中文（通过 `SERVER_ERROR_MAP` 映射）
- 例如 "not your turn" → "还没轮到你行动。"

---

### TC69 — 大写邀请码容错
**步骤**:
1. 在 `#roomCodeInput` 输入小写 "abcdef"

**断言**:
- `input` 事件自动转为大写（`e.target.value = value.toUpperCase()`）
- 提交时服务端收到大写码

---

### TC70 — 连续快速点击行动按钮
**目的**: 防止重复发送行动导致错误
**步骤**:
1. 在自己回合快速连点 `#foldButton` 3次

**断言**:
- 只发送 1 次 action 消息
- 第 2、3 次点击时按钮已 disabled，无法发送

---

## Group 11: 响应式布局

### TC71 — 桌面端（1440×900）
**断言**:
- 大厅按钮可见
- 侧边面板（行动、技能、状态、日志）可见
- 无横屏提示（`.orientation-tip` 不可见 / display:none）

---

### TC72 — 移动端竖屏（375×812）
**断言**:
- `.orientation-tip` 可见（提示切换横屏）
- 大厅按钮可见且可点击
- 核心功能不受影响（可创建房间）

---

### TC73 — 移动端横屏（812×375）
**断言**:
- `.orientation-tip` 不可见或 `display:none`
- 牌桌内容可见

---

## Group 12: 调试导出（renderGameToText）

### TC74 — 大厅状态调试导出
**步骤**:
1. 大厅页面调用 `window.render_game_to_text()`

**断言**:
- `controls.can_connect = true`
- `controls.can_join = true`
- `controls.create_room_enabled = true`
- `phase = ""`（未进入游戏）

---

### TC75 — 游戏中调试导出禁用大厅入口
**步骤**:
1. 进入游戏后调用调试导出

**断言**:
- `controls.can_connect = false`
- `controls.can_join = false`
- `controls.create_room_enabled = false`

---

### TC76 — 行动按钮与调试导出一致
**步骤**:
1. 自己回合时检查调试导出

**断言**:
- `controls.fold_enabled = !document.getElementById('foldButton').disabled`
- `controls.check_enabled = !document.getElementById('checkButton').disabled`
- `controls.call_enabled = !document.getElementById('callButton').disabled`
- 调试导出与实际 DOM 状态100%一致

---

### TC77 — 调试导出座位 layout_slot
**断言**:
- 自己的 seat 的 `layout_slot = "bottom"`
- 其他玩家 `layout_slot` 为有效值（"top"、"right-upper" 等）
- `x` 和 `y` 为 0~1 之间的浮点数

---

### TC78 — 调试导出 recent_actions 结构
**步骤**:
1. 完成至少 1 次行动

**断言**:
- `recent_actions` 数组非空
- 每个条目含 `player_name`、`action`、`phase`、`amount`
- 按时间序（`seq` 递增）排列

---

## 测试优先级矩阵

| 优先级 | 测试用例 | 说明 |
|--------|---------|------|
| **P0 / 阻断性** | TC12, TC18, TC19, TC20, TC55 | 核心玩法完全无法使用 |
| **P1 / 高** | TC14–TC17, TC21–TC30, TC31–TC33, TC60–TC63 | 主要功能流程 |
| **P2 / 中** | TC35–TC45, TC46–TC54, TC07–TC11 | 技能、显示、等待室 |
| **P3 / 低** | TC71–TC73, TC74–TC78, TC03–TC06 | 布局、调试工具、输入校验 |

---

## 建议的测试文件结构

```
web/
  tests/
    01-lobby.spec.mjs          # Group 1–2
    02-game-start.spec.mjs     # Group 3 (BUG-001)
    03-actions.spec.mjs        # Group 4 (BUG-002) ← 最关键
    04-bots.spec.mjs           # Group 5
    05-skills.spec.mjs         # Group 6
    06-game-display.spec.mjs   # Group 7–8
    07-reconnect.spec.mjs      # Group 9
    08-edge-cases.spec.mjs     # Group 10–11
    09-debug-export.spec.mjs   # Group 12
    helpers/
      utils.mjs                # getSnapshot, waitForPhase, createRoom, etc.
      constants.mjs            # PAGE_URL, timeouts
```

---

## 共享测试工具函数（需在 helpers/utils.mjs 中实现）

```js
// 获取页面调试快照（调用 render_game_to_text）
getSnapshot(page)

// 等待游戏进入指定阶段
waitForPhase(page, phase, timeout)

// 等待游戏开始（phase !== "waiting"）
waitForGameStart(page, timeout)

// 等待轮到自己行动
waitForMyTurn(page, timeout)

// 创建房间并返回邀请码
createRoom(page, playerName)

// 用邀请码加入房间
joinRoomByCode(page, code, playerName)

// 添加 N 个 bot
addBots(page, count)

// 执行安全行动（优先 check，其次 call，最后 fold）
performSafeAction(page, snapshot)

// 完成整手牌（等待 showdown 结束）
waitForHandEnd(page, timeout)
```

---

*本文档作为 Playwright 测试实现的规格说明，实现时以文档中的「断言」为准，「步骤」为参考。*
