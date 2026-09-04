const PLAYER_ID_KEY = "dirtyplay_player_id";
const PLAYER_NAME_KEY = "dirtyplay_player_name";
const SOUND_KEY = "dirtyplay_sound";
const AUTO_NEXT_KEY = "dirtyplay_auto_next";
const SPEED_KEY = "dirtyplay_speed";
const UI_TICK_MS = 50;

const PHASE_LABELS = {
  waiting: "等待室",
  dealing: "发牌中",
  preflop: "翻牌前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  showdown: "摊牌结算",
};

const STATUS_LABELS = {
  active: "在局",
  folded: "已弃牌",
  all_in: "All-in",
  out: "出局",
};

const ACTION_LABELS = {
  blind: "下盲",
  blind_sb: "小盲",
  blind_bb: "大盲",
  fold: "弃牌",
  check: "过牌",
  call: "跟注",
  raise: "加注",
  all_in: "全下",
  out: "离桌",
};

const HAND_CATEGORY_LABELS = {
  0: "高牌",
  1: "一对",
  2: "两对",
  3: "三条",
  4: "顺子",
  5: "同花",
  6: "葫芦",
  7: "四条",
  8: "同花顺",
};

const RANK_NAMES = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

const SKILL_META = {
  peek: {
    name: "窥视",
    cost: 15,
    description: "偷看指定在局对手的一张暗手牌。需选择在局对手。",
    passive: false,
  },
  bluff: {
    name: "虚张声势",
    cost: 20,
    description: "本街让其他玩家误看到你的伪造假手牌。",
    passive: false,
  },
  mist: {
    name: "迷雾",
    cost: 25,
    description: "本街让对手看错一张公共牌。需翻牌后才可用。",
    passive: false,
  },
  swap: {
    name: "换牌",
    cost: 30,
    description: "丢弃你的一张手牌并从牌堆顶部抽一张新牌。",
    passive: false,
  },
  counter: {
    name: "反侦察",
    cost: 5,
    description: "被动防御技能，受到对手窥视时自动抵消并消耗。",
    passive: true,
  },
};

const SERVER_ERROR_MAP = {
  "not in action phase": "当前不在行动阶段，暂时不能使用技能。",
  "not your turn": "还没轮到你行动。",
  "invalid player": "玩家状态异常，无法执行本次操作。",
  "not enough players": "至少需要 2 名玩家才能开始游戏。",
  "game already started": "牌局已经开始，不能再执行等待室操作。",
  "skill already used": "本回合你已经使用过一次技能。",
  "heat locked": "怀疑值过高（≥100），千术已被锁定。",
  "skill not owned": "你当前并不持有该技能。",
  "counter is passive": "反侦察是被动技能，受到窥视时自动触发抵消。",
  "invalid target": "目标无效，请重新选择在局玩家。",
  "no community cards": "当前还没有公共牌，迷雾需在翻牌后使用。",
  "invalid card index": "换牌索引无效，请重新选择。",
  "deck empty": "牌堆已空，当前不能换牌。",
  "unknown skill": "技能类型无效。",
  "room full": "房间已满，无法继续加入或添加 AI。",
  "game paused": "游戏已暂停，请先继续游戏。",
  "game not started": "牌局尚未开始。",
  "not in showdown or waiting": "当前没有可开始的下一手牌。",
};

const SUIT_META = {
  S: { symbol: "♠", name: "黑桃", red: false },
  H: { symbol: "♥", name: "红桃", red: true },
  D: { symbol: "♦", name: "方片", red: true },
  C: { symbol: "♣", name: "梅花", red: false },
};

const SEAT_SLOTS = {
  bottom: { name: "bottom", x: 0.5, y: 0.86 },
  "right-lower": { name: "right-lower", x: 0.85, y: 0.68 },
  "right-upper": { name: "right-upper", x: 0.85, y: 0.24 },
  top: { name: "top", x: 0.5, y: 0.11 },
  "left-upper": { name: "left-upper", x: 0.15, y: 0.24 },
  "left-lower": { name: "left-lower", x: 0.15, y: 0.68 },
};

const OTHER_SEAT_SLOTS_BY_COUNT = {
  1: ["top"],
  2: ["right-upper", "left-upper"],
  3: ["right-upper", "top", "left-upper"],
  4: ["right-lower", "right-upper", "left-upper", "left-lower"],
  5: ["right-lower", "right-upper", "top", "left-upper", "left-lower"],
};

const refs = {
  // Lobby
  lobbyScreen: document.getElementById("lobbyScreen"),
  gameScreen: document.getElementById("gameScreen"),
  lobbyNameInput: document.getElementById("lobbyNameInput"),
  quickPlayBtn: document.getElementById("quickPlayBtn"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  lobbyRulesBtn: document.getElementById("lobbyRulesBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  lobbyError: document.getElementById("lobbyError"),

  // Topbar
  backToLobbyBtn: document.getElementById("backToLobbyBtn"),
  pauseGameBtn: document.getElementById("pauseGameBtn"),
  speedToggleBtn: document.getElementById("speedToggleBtn"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  gameRulesBtn: document.getElementById("gameRulesBtn"),
  roomCodeBadge: document.getElementById("roomCodeBadge"),
  handSeqBadge: document.getElementById("handSeqBadge"),
  statusText: document.getElementById("statusText"),

  // Waiting Room
  waitingRoom: document.getElementById("waitingRoom"),
  waitingCode: document.getElementById("waitingCode"),
  copyCodeBtn: document.getElementById("copyCodeBtn"),
  quickStartBtn: document.getElementById("quickStartBtn"),
  addBotBtn: document.getElementById("addBotBtn"),
  startGameBtn: document.getElementById("startGameBtn"),
  waitingPlayerCount: document.getElementById("waitingPlayerCount"),

  // Table Meta & Surface
  phaseText: document.getElementById("phaseText"),
  turnText: document.getElementById("turnText"),
  potText: document.getElementById("potText"),
  mainPotDetail: document.getElementById("mainPotDetail"),
  mainPotText: document.getElementById("mainPotText") || {},
  sidePotsText: document.getElementById("sidePotsText") || {},
  heatText: document.getElementById("heatText") || {},
  turnTimerText: document.getElementById("turnTimerText"),
  turnBanner: document.getElementById("turnBanner"),

  // Result & Pacing
  handResult: document.getElementById("handResult"),
  handResultTitle: document.getElementById("handResultTitle"),
  handResultDetail: document.getElementById("handResultDetail"),
  nextHandControl: document.getElementById("nextHandControl"),
  nextHandBtn: document.getElementById("nextHandBtn"),
  autoNextCheck: document.getElementById("autoNextCheck"),

  // Zones
  communityCards: document.getElementById("communityCards"),
  mistActiveWarning: document.getElementById("mistActiveWarning"),
  seatsLayer: document.getElementById("seatsLayer"),
  handCards: document.getElementById("handCards"),
  handRankBadge: document.getElementById("handRankBadge"),
  handSwapHint: document.getElementById("handSwapHint"),

  // Actions
  toCallBadge: document.getElementById("toCallBadge"),
  foldButton: document.getElementById("foldButton"),
  checkButton: document.getElementById("checkButton"),
  callButton: document.getElementById("callButton"),
  allInButton: document.getElementById("allInButton"),
  raiseButton: document.getElementById("raiseButton"),
  raiseSlider: document.getElementById("raiseSlider"),
  raiseInput: document.getElementById("raiseInput"),
  betPresetButtons: Array.from(document.querySelectorAll(".bet-preset")),

  // Skills
  heatSummaryText: document.getElementById("heatSummaryText"),
  heatMeterLabel: document.getElementById("heatMeterLabel"),
  heatMeterFill: document.getElementById("heatMeterFill"),
  skillCardTray: document.getElementById("skillCardTray"),
  skillActionDrawer: document.getElementById("skillActionDrawer"),
  drawerSkillName: document.getElementById("drawerSkillName"),
  drawerSkillCost: document.getElementById("drawerSkillCost"),
  drawerSkillDesc: document.getElementById("drawerSkillDesc"),
  drawerSkillHint: document.getElementById("drawerSkillHint"),
  skillTargetPicker: document.getElementById("skillTargetPicker"),
  targetChips: document.getElementById("targetChips"),
  useSkillButton: document.getElementById("useSkillButton"),
  cancelSkillDrawerBtn: document.getElementById("cancelSkillDrawerBtn"),

  // Dialogs
  pauseDialog: document.getElementById("pauseDialog"),
  resumeGameBtn: document.getElementById("resumeGameBtn"),
  pauseRulesBtn: document.getElementById("pauseRulesBtn"),
  pauseRestartBtn: document.getElementById("pauseRestartBtn"),
  pauseLeaveBtn: document.getElementById("pauseLeaveBtn"),
  speedBtns: Array.from(document.querySelectorAll(".speed-btn")),
  rulesDialog: document.getElementById("rulesDialog"),
  closeRulesBtn: document.getElementById("closeRulesBtn"),
  actionLogList: document.getElementById("actionLogList"),
  toastStack: document.getElementById("toastStack"),

  // Hidden legacy elements for backwards compatibility
  targetSelect: document.getElementById("targetSelect") || { value: "" },
  cardIdxSelect: document.getElementById("cardIdxSelect") || { value: "0" },
  skillsText: document.getElementById("skillsText") || {},
  selectedSkillText: document.getElementById("selectedSkillText") || {},
  skillDescriptionText: document.getElementById("skillDescriptionText") || {},
  skillHintText: document.getElementById("skillHintText") || {},
  skillButtons: document.getElementById("skillButtons") || {},
  playersList: document.getElementById("playersList") || {},
};

const appState = {
  ws: null,
  seq: 0,
  playerId: localStorage.getItem(PLAYER_ID_KEY) || "",
  playerName: localStorage.getItem(PLAYER_NAME_KEY) || "",
  joining: false,
  lastState: normalizeState({}),
  actionReq: normalizeActionReq({}),
  selectedSkillId: "",
  selectedTargetId: "",
  selectedCardIdx: 0,
  targetIds: [],
  connectionStatus: "未连接",
  lastSentType: "",
  lastSkillAttempt: "",
  screen: "lobby",
  currentRoomCode: "",
  currentRoomId: "",
  _pendingJoinCode: "",
  actionPending: false,
  actionTimeRemainingMs: 0,
  actionTimeTotalMs: 0,
  lastRenderedResultKey: "",
  isPaused: false,
  gameSpeed: localStorage.getItem(SPEED_KEY) || "normal",
  autoNextHand: localStorage.getItem(AUTO_NEXT_KEY) !== "false",
  swapModeActive: false,
  autoNextTimer: null,
};

class SoundFXEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem(SOUND_KEY) !== "off";
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(SOUND_KEY, this.enabled ? "on" : "off");
    return this.enabled;
  }

  play(type) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (type === "card") {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(450, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
      } else if (type === "chip") {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.06);
      } else if (type === "win") {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t + i * 0.08);
          gain.gain.setValueAtTime(0.15, t + i * 0.08);
          gain.gain.linearRampToValueAtTime(0.01, t + i * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + i * 0.08);
          osc.stop(t + i * 0.08 + 0.2);
        });
      } else if (type === "skill") {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.22);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      }
    } catch (_e) {}
  }
}

const soundFx = new SoundFXEngine();

// ── Initial Setup ──
showLobby();
if (appState.playerName) {
  refs.lobbyNameInput.value = appState.playerName;
}
if (refs.autoNextCheck) {
  refs.autoNextCheck.checked = appState.autoNextHand;
}
updateSpeedUI();
updateSoundButtonLabel();

const uiTimers = [];
setInterval(() => stepUiTimers(UI_TICK_MS), UI_TICK_MS);

// ── Event Bindings ──

// Lobby Events
refs.quickPlayBtn.addEventListener("click", () => { void createRoom(true); });
refs.createRoomBtn.addEventListener("click", () => { void createRoom(false); });
refs.joinRoomBtn.addEventListener("click", () => { void joinByCode(); });
refs.lobbyRulesBtn.addEventListener("click", openRules);
refs.roomCodeInput.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });
refs.lobbyNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { void createRoom(true); } });

// Waiting Room
refs.quickStartBtn.addEventListener("click", quickStart);
refs.addBotBtn.addEventListener("click", addBot);
refs.startGameBtn.addEventListener("click", startGame);
refs.copyCodeBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(appState.currentRoomCode).catch(() => {});
  showToast("邀请码已复制");
});

// Topbar Events
refs.backToLobbyBtn.addEventListener("click", () => { void disconnectSocket(); showLobby(); });
refs.pauseGameBtn.addEventListener("click", togglePause);
refs.speedToggleBtn.addEventListener("click", cycleSpeed);
refs.soundToggleBtn.addEventListener("click", () => {
  soundFx.toggle();
  updateSoundButtonLabel();
});
refs.gameRulesBtn.addEventListener("click", openRules);
refs.closeRulesBtn.addEventListener("click", closeRules);
refs.rulesDialog.addEventListener("click", (e) => { if (e.target === refs.rulesDialog) closeRules(); });

// Pause Dialog
refs.resumeGameBtn.addEventListener("click", resumeGame);
refs.pauseRulesBtn.addEventListener("click", () => { closePauseModal(); openRules(); });
refs.pauseRestartBtn.addEventListener("click", () => { closePauseModal(); quickStart(); });
refs.pauseLeaveBtn.addEventListener("click", () => { closePauseModal(); void disconnectSocket(); showLobby(); });
refs.speedBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    setSpeed(btn.dataset.speed || "normal");
  });
});

// Action Events
refs.foldButton.addEventListener("click", () => sendAction("fold"));
refs.checkButton.addEventListener("click", () => sendAction("check"));
refs.callButton.addEventListener("click", () => sendAction("call"));
refs.allInButton.addEventListener("click", () => sendAction("all_in"));
refs.raiseButton.addEventListener("click", () => {
  const amount = Number.parseInt(refs.raiseInput.value, 10) || 0;
  sendAction("raise", amount);
});
refs.raiseSlider.addEventListener("input", (e) => {
  refs.raiseInput.value = e.target.value;
  updateActionArea();
});
refs.raiseInput.addEventListener("input", (e) => {
  refs.raiseSlider.value = e.target.value;
  updateActionArea();
});
refs.betPresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.potFraction) {
      applyBetPreset(Number(button.dataset.potFraction));
    } else if (button.dataset.presetBb) {
      applyBbPreset(Number(button.dataset.presetBb));
    }
  });
});

// Skills
refs.useSkillButton.addEventListener("click", useSkill);
refs.cancelSkillDrawerBtn.addEventListener("click", closeSkillDrawer);
refs.targetSelect.addEventListener("change", (e) => {
  appState.selectedTargetId = e.target.value || "";
  updateSkillDrawer();
});
refs.cardIdxSelect.addEventListener("change", (e) => {
  appState.selectedCardIdx = Number.parseInt(e.target.value, 10) || 0;
});

// Result & Next Hand
refs.nextHandBtn.addEventListener("click", nextHand);
refs.autoNextCheck.addEventListener("change", (e) => {
  appState.autoNextHand = e.target.checked;
  localStorage.setItem(AUTO_NEXT_KEY, String(appState.autoNextHand));
  if (!appState.autoNextHand && appState.autoNextTimer) {
    clearTimeout(appState.autoNextTimer);
    appState.autoNextTimer = null;
  } else if (appState.autoNextHand && !refs.handResult.hidden) {
    renderHandResult(appState.lastState.result);
  }
});

// Keyboard Shortcuts
document.addEventListener("keydown", handleGlobalShortcuts);

// Expose globals for automated test verification
window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;

// ── Networking ──

function buildServerUrl() {
  if (window.location.host) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/ws`;
  }
  return "ws://localhost:8080/ws";
}

async function connectToServer(forceReconnect = false) {
  const url = buildServerUrl();
  if (forceReconnect) {
    await disconnectSocket();
  }
  if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
    appState.connectionStatus = "已连接";
    return true;
  }
  if (appState.ws && appState.ws.readyState === WebSocket.CONNECTING) {
    const opened = await waitForSocketOpen(appState.ws, 7000);
    if (opened) {
      appState.connectionStatus = "已连接";
    } else {
      setStatus("连接超时", true);
    }
    return opened;
  }
  setStatus("正在连接...", false);
  const ws = new WebSocket(url);
  appState.ws = ws;

  ws.addEventListener("close", () => {
    if (appState.ws !== ws) return;
    appState.ws = null;
    appState.connectionStatus = "未连接";
    appState.actionPending = false;
    updateActionArea();
    setStatus("连接已断开", true);
  });
  ws.addEventListener("error", () => {
    if (appState.ws !== ws) return;
    appState.actionPending = false;
    updateActionArea();
    setStatus("网络错误", true);
  });
  ws.addEventListener("message", (event) => {
    onMessage(event.data);
  });

  const opened = await waitForSocketOpen(ws, 7000);
  if (opened && appState.ws === ws) {
    appState.connectionStatus = "已连接";
  } else if (!opened && appState.ws === ws) {
    setStatus("连接超时", true);
  }
  return opened;
}

function waitForSocketOpen(ws, timeoutMs) {
  return new Promise((resolve) => {
    if (!ws) {
      resolve(false);
      return;
    }
    if (ws.readyState === WebSocket.OPEN) {
      resolve(true);
      return;
    }
    let timer = null;
    const onOpen = () => {
      cleanup();
      resolve(true);
    };
    const onClose = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("close", onClose);
      ws.removeEventListener("error", onClose);
    };
    timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    ws.addEventListener("open", onOpen);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", onClose);
  });
}

async function disconnectSocket() {
  const ws = appState.ws;
  if (ws) {
    appState.ws = null;
    appState.connectionStatus = "未连接";
    try {
      ws.close();
    } catch (_e) {}
  }
}

function isConnected() {
  return Boolean(appState.ws && appState.ws.readyState === WebSocket.OPEN);
}

function sendMessage(type, payload) {
  if (!isConnected()) return;
  const ws = appState.ws;
  const message = {
    type,
    seq: ++appState.seq,
    payload,
  };
  appState.lastSentType = String(type || "");
  try {
    ws.send(JSON.stringify(message));
  } catch (_e) {
    if (appState.ws === ws) {
      appState.connectionStatus = "未连接";
      setStatus("网络错误", true);
    }
  }
}

// ── Screen Navigation & Rooms ──

function showLobby() {
  appState.screen = "lobby";
  appState.lastState = normalizeState({});
  appState.actionReq = normalizeActionReq({});
  appState.actionPending = false;
  appState.isPaused = false;
  appState.selectedSkillId = "";
  appState.selectedTargetId = "";
  appState.selectedCardIdx = 0;
  appState.swapModeActive = false;
  clearActionTimer();
  if (appState.autoNextTimer) {
    clearTimeout(appState.autoNextTimer);
    appState.autoNextTimer = null;
  }
  closePauseModal();
  appState.lastRenderedResultKey = "";
  refs.lobbyScreen.style.display = "";
  refs.gameScreen.style.display = "none";
  showLobbyError("");
  appState.connectionStatus = isConnected() ? "已连接" : "未连接";
  setStatus(appState.connectionStatus, false);
  updateActionArea();
}

function showGame(roomId, code) {
  appState.screen = "game";
  appState.currentRoomId = roomId;
  appState.currentRoomCode = code;
  appState.actionPending = false;
  refs.lobbyScreen.style.display = "none";
  refs.gameScreen.style.display = "";
  refs.roomCodeBadge.textContent = code ? `房号: ${code}` : "";
  refs.waitingCode.textContent = code || "";
  updateActionArea();
}

function showLobbyError(msg) {
  refs.lobbyError.textContent = msg;
  refs.lobbyError.style.display = msg ? "" : "none";
}

async function createRoom(quickStart = false) {
  const name = refs.lobbyNameInput.value.trim();
  showLobbyError("");
  const connected = await connectToServer(false);
  if (!connected) {
    showLobbyError("无法连接到服务器");
    return;
  }
  if (name) {
    appState.playerName = name;
    localStorage.setItem(PLAYER_NAME_KEY, name);
  }
  sendMessage("create_room", {
    quick_start: Boolean(quickStart),
    name: name || undefined,
  });
}

async function joinByCode() {
  const code = refs.roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    showLobbyError("请输入 6 位有效邀请码");
    return;
  }
  const name = refs.lobbyNameInput.value.trim();
  showLobbyError("");
  const connected = await connectToServer(false);
  if (!connected) {
    showLobbyError("无法连接到服务器");
    return;
  }
  if (name) {
    appState.playerName = name;
    localStorage.setItem(PLAYER_NAME_KEY, name);
  }
  appState._pendingJoinCode = code;
  sendMessage("join_room", {
    code,
    player_id: appState.playerId || "",
    name: name || undefined,
  });
}

function addBot() {
  sendMessage("add_bot", {});
}

function quickStart() {
  sendMessage("quick_start", {});
}

function startGame() {
  sendMessage("start_game", {});
}

function nextHand() {
  if (appState.autoNextTimer) {
    clearTimeout(appState.autoNextTimer);
    appState.autoNextTimer = null;
  }
  if (appState.isPaused) {
    setStatus("游戏已暂停，请先继续游戏。", true);
    return;
  }
  if (appState.screen !== "game" || (appState.lastState.phase !== "showdown" && appState.lastState.phase !== "waiting")) {
    return;
  }
  refs.handResult.hidden = true;
  sendMessage("next_hand", {});
}

function togglePause() {
  if (appState.screen !== "game") return;
  if (appState.isPaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function pauseGame() {
  if (appState.screen !== "game" || appState.lastState.phase === "waiting" || !isConnected()) return;
  appState.isPaused = true;
  if (appState.autoNextTimer) {
    clearTimeout(appState.autoNextTimer);
    appState.autoNextTimer = null;
  }
  sendMessage("pause", {});
  if (!refs.pauseDialog.open) refs.pauseDialog.showModal();
}

function resumeGame() {
  appState.isPaused = false;
  sendMessage("resume", {});
  closePauseModal();
  if (refs.handResult && !refs.handResult.hidden) {
    renderHandResult(appState.lastState.result);
  }
}

function closePauseModal() {
  if (refs.pauseDialog.open) {
    refs.pauseDialog.close();
  }
}

function cycleSpeed() {
  const speeds = ["normal", "fast", "slow"];
  const next = speeds[(speeds.indexOf(appState.gameSpeed) + 1) % speeds.length];
  setSpeed(next);
}

function setSpeed(speed) {
  appState.gameSpeed = speed;
  localStorage.setItem(SPEED_KEY, speed);
  updateSpeedUI();
  showToast(`对局节奏: ${speedLabel(speed)}`);
  if (refs.handResult && !refs.handResult.hidden) {
    renderHandResult(appState.lastState.result);
  }
}

function speedLabel(s) {
  if (s === "fast") return "快速";
  if (s === "slow") return "慢速";
  return "正常";
}

function updateSpeedUI() {
  if (refs.speedToggleBtn) {
    refs.speedToggleBtn.textContent = `速度: ${speedLabel(appState.gameSpeed)}`;
  }
  refs.speedBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.speed === appState.gameSpeed);
  });
}

function updateSoundButtonLabel() {
  if (refs.soundToggleBtn) {
    refs.soundToggleBtn.textContent = soundFx.enabled ? "音效: 开" : "音效: 关";
  }
}

// ── Message Ingestion ──

function onMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (_e) {
    return;
  }
  const payload = msg.payload || {};
  switch (msg.type) {
    case "room_created":
      if (payload.player_id) {
        appState.playerId = String(payload.player_id);
        localStorage.setItem(PLAYER_ID_KEY, appState.playerId);
      }
      showGame(String(payload.room_id || ""), String(payload.code || ""));
      setStatus("已创建房间", false);
      break;

    case "ack":
      handleAck(payload);
      break;

    case "state":
      handleState(payload);
      break;

    case "action_req":
      handleActionReq(payload);
      break;

    case "skill_effect":
      handleSkillEffect(payload);
      break;

    case "error":
      setStatus(friendlyServerError(payload.message || "请求失败"), true);
      break;

    default:
      break;
  }
}

function handleAck(payload) {
  if (payload.player_id) {
    appState.playerId = String(payload.player_id);
    localStorage.setItem(PLAYER_ID_KEY, appState.playerId);
  }
  if (!payload.success) {
    appState.actionPending = false;
    updateActionArea();
    const reason = friendlyServerError(payload.error || "操作失败");
    if (appState.screen === "lobby") {
      showLobbyError(reason);
    } else {
      setStatus(reason, true);
    }
  } else if (payload.room_id) {
    showGame(payload.room_id, appState._pendingJoinCode || "");
    setStatus("已加入房间", false);
  }
}

function handleState(payload) {
  const previousState = appState.lastState;
  const state = normalizeState(payload);
  appState.lastState = state;

  if (state.paused !== undefined) {
    appState.isPaused = Boolean(state.paused);
    if (appState.isPaused && !refs.pauseDialog.open) {
      refs.pauseDialog.showModal();
    } else if (!appState.isPaused && refs.pauseDialog.open) {
      refs.pauseDialog.close();
    }
    if (appState.isPaused && appState.autoNextTimer) {
      clearTimeout(appState.autoNextTimer);
      appState.autoNextTimer = null;
    }
  }

  // Auto clear action pending once current player changes
  if (state.current_player !== appState.playerId) {
    appState.actionPending = false;
  }

  refs.handSeqBadge.textContent = state.hand_seq ? `第 ${state.hand_seq} 手` : "";
  refs.phaseText.textContent = `阶段: ${PHASE_LABELS[state.phase] || state.phase || "-"}`;

  const currentP = state.players.find((p) => p.id === state.current_player);
  refs.turnText.textContent = currentP ? `行动中: ${currentP.name || "玩家"}` : "行动中: -";
  refs.potText.textContent = `底池: $${state.total_pot || 0}`;
  const pots = ensureArray(state.pots);
  const mainPot = pots.find((pot) => String(pot.kind || "") === "main") || pots[0];
  const mainPotAmount = Number(mainPot?.amount || 0) || Number(state.total_pot || 0);
  refs.mainPotDetail.textContent = `主池: $${mainPotAmount}`;
  refs.mainPotText.textContent = `主池: ${mainPotAmount}`;
  const sidePots = pots.filter((pot, index) => String(pot.kind || "") !== "main" && !(index === 0 && !pot.kind));
  refs.sidePotsText.textContent = sidePots.length > 0
    ? `边池: ${sidePots.map((pot, index) => `#${index + 1} ${Number(pot.amount || 0)}`).join(" / ")}`
    : "边池: -";

  // Update Heat UI
  const heat = Number(state.my_heat || 0);
  refs.heatSummaryText.textContent = `${heat} / 100`;
  refs.heatMeterLabel.textContent = `${heat} / 100`;
  refs.heatText.textContent = `怀疑值: ${heat}`;
  refs.heatMeterFill.style.width = `${Math.min(100, Math.max(0, heat))}%`;
  refs.heatMeterFill.style.background = heat >= 100 ? "var(--fold-red)" : heat >= 70 ? "var(--heat-orange)" : "var(--call-green)";

  updateWaitingRoom(state);
  renderSeats(state.players, previousState.players, state.current_player);
  renderCommunityCards(state.community_cards, previousState.community_cards);
  renderHandCards(state.my_hand, previousState.my_hand);
  renderSkillCards(state.my_skills);
  renderActionLog(state.recent_actions);
  renderHandResult(state.result);
  updateHandRankBadge(state.my_hand, state.community_cards, state.phase);

  // Sound effects for cards
  if (state.community_cards.length > previousState.community_cards.length) {
    soundFx.play("card");
  }
  if (state.phase === "showdown" && previousState.phase !== "showdown") {
    soundFx.play("win");
  }

  updateActionArea();
  updateTurnBanner(state.current_player === appState.playerId);
}

function handleActionReq(payload) {
  appState.actionPending = false;
  appState.actionReq = normalizeActionReq(payload);
  const timeoutSec = Math.max(1, Number(appState.actionReq.timeout_sec || 30));
  appState.actionTimeTotalMs = timeoutSec * 1000;
  appState.actionTimeRemainingMs = timeoutSec * 1000;
  setDefaultRaiseAmount();
  renderSkillCards(appState.lastState.my_skills);
  updateActionArea();
  renderTurnTimer();
}

function handleSkillEffect(payload) {
  const skillId = payload.skill_id || "";
  const meta = SKILL_META[skillId] || { name: skillId };
  if (payload.blocked) {
    setStatus(`技能被抵消: ${meta.name}`);
    showToast(`对手反侦察生效，【${meta.name}】被抵消`, "warn");
  } else if (payload.result && payload.result.card) {
    const cardStr = payload.result.card;
    const cardMeta = parseCardString(cardStr);
    const cardText = cardMeta ? `${cardMeta.symbol} ${cardMeta.label}` : String(cardStr);
    setStatus(`技能生效: ${meta.name}`);
    showToast(`【${meta.name}】生效：获得牌面【${cardText}】`, "ok");
  } else {
    setStatus(`技能生效: ${meta.name}`);
    showToast(`【${meta.name}】施放成功`, "ok");
  }
  closeSkillDrawer();
}

// ── Hand Rank Evaluator (牌型算法) ──

function parseCard(cStr) {
  if (typeof cStr !== "string") return null;
  const value = cStr.trim().toUpperCase();
  if (value.length < 2) return null;
  const suitChar = value.slice(-1);
  const rankChar = value.slice(0, -1);
  let rank = 0;
  if (/^[2-9]$/.test(rankChar)) rank = Number.parseInt(rankChar, 10);
  else if (rankChar === "10" || rankChar === "T") rank = 10;
  else if (rankChar === "J") rank = 11;
  else if (rankChar === "Q") rank = 12;
  else if (rankChar === "K") rank = 13;
  else if (rankChar === "A") rank = 14;
  if (rank === 0 || !SUIT_META[suitChar]) return null;
  return { rank, suit: suitChar, code: value };
}

function evaluateBestHand(cards) {
  if (!cards || cards.length < 5) return { category: -1, text: "等待发牌" };
  let best = { category: -1, kickers: [] };
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const h = evaluate5Cards([cards[i], cards[j], cards[k], cards[l], cards[m]]);
            if (compareRank(h, best) > 0) {
              best = h;
            }
          }
        }
      }
    }
  }
  return best;
}

function evaluate5Cards(cards) {
  const rankCounts = {};
  const suitCounts = {};
  cards.forEach((c) => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  });

  let flushSuit = null;
  for (const [s, cnt] of Object.entries(suitCounts)) {
    if (cnt === 5) flushSuit = s;
  }

  if (flushSuit) {
    const fRanks = cards.map((c) => c.rank);
    const straightHighVal = checkStraight(fRanks);
    if (straightHighVal > 0) {
      return {
        category: 8,
        kickers: [straightHighVal],
        text: straightHighVal === 14 ? "皇家同花顺" : `同花顺 (${RANK_NAMES[straightHighVal]}高)`,
      };
    }
    fRanks.sort((a, b) => b - a);
    return {
      category: 5,
      kickers: fRanks,
      text: `同花 (${RANK_NAMES[fRanks[0]]}高)`,
    };
  }

  const allRanks = Object.keys(rankCounts).map(Number);
  const straightHighVal = checkStraight(allRanks);
  if (straightHighVal > 0) {
    return {
      category: 4,
      kickers: [straightHighVal],
      text: `顺子 (${RANK_NAMES[straightHighVal]}高)`,
    };
  }

  const groups = Object.entries(rankCounts).map(([r, count]) => ({ rank: Number(r), count }));
  groups.sort((a, b) => {
    if (a.count === b.count) return b.rank - a.rank;
    return b.count - a.count;
  });

  if (groups[0].count === 4) {
    return {
      category: 7,
      kickers: [groups[0].rank],
      text: `四条 (${RANK_NAMES[groups[0].rank]})`,
    };
  }
  if (groups[0].count === 3 && groups[1] && groups[1].count === 2) {
    return {
      category: 6,
      kickers: [groups[0].rank, groups[1].rank],
      text: `葫芦 (${RANK_NAMES[groups[0].rank]}带${RANK_NAMES[groups[1].rank]})`,
    };
  }
  if (groups[0].count === 3) {
    return {
      category: 3,
      kickers: [groups[0].rank],
      text: `三条 (${RANK_NAMES[groups[0].rank]})`,
    };
  }
  if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    return {
      category: 2,
      kickers: [groups[0].rank, groups[1].rank],
      text: `两对 (${RANK_NAMES[groups[0].rank]}和${RANK_NAMES[groups[1].rank]})`,
    };
  }
  if (groups[0].count === 2) {
    return {
      category: 1,
      kickers: [groups[0].rank],
      text: `一对 (${RANK_NAMES[groups[0].rank]})`,
    };
  }

  const ranksDesc = allRanks.sort((a, b) => b - a);
  return {
    category: 0,
    kickers: ranksDesc,
    text: `高牌 (${RANK_NAMES[ranksDesc[0]]})`,
  };
}

function checkStraight(ranks) {
  if (ranks.length < 5) return 0;
  const present = {};
  ranks.forEach((r) => {
    present[r] = true;
    if (r === 14) present[1] = true;
  });
  for (let high = 14; high >= 5; high--) {
    if (present[high] && present[high - 1] && present[high - 2] && present[high - 3] && present[high - 4]) {
      return high;
    }
  }
  return 0;
}

function compareRank(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

function updateHandRankBadge(myHandCodes, communityCodes, phase) {
  if (!refs.handRankBadge) return;
  const myParsed = ensureArray(myHandCodes).map(parseCard).filter(Boolean);
  const commParsed = ensureArray(communityCodes).map(parseCard).filter(Boolean);

  if (myParsed.length < 2) {
    refs.handRankBadge.textContent = "等待发牌...";
    refs.handRankBadge.className = "hand-rank-badge";
    return;
  }

  if (commParsed.length === 0) {
    const c1 = myParsed[0];
    const c2 = myParsed[1];
    const high = Math.max(c1.rank, c2.rank);
    const low = Math.min(c1.rank, c2.rank);
    const suited = c1.suit === c2.suit;
    if (high === low) {
      refs.handRankBadge.textContent = `口袋对子 (${RANK_NAMES[high]})`;
      refs.handRankBadge.className = "hand-rank-badge rank-high";
    } else if (suited) {
      refs.handRankBadge.textContent = `同花连牌 (${RANK_NAMES[high]}-${RANK_NAMES[low]}s)`;
      refs.handRankBadge.className = "hand-rank-badge";
    } else {
      refs.handRankBadge.textContent = `起手牌 (${RANK_NAMES[high]}-${RANK_NAMES[low]})`;
      refs.handRankBadge.className = "hand-rank-badge";
    }
    return;
  }

  const allCards = [...myParsed, ...commParsed];
  const evalResult = evaluateBestHand(allCards);
  refs.handRankBadge.textContent = evalResult.text || "高牌";

  if (evalResult.category >= 5) {
    refs.handRankBadge.className = "hand-rank-badge rank-monster";
  } else if (evalResult.category >= 2) {
    refs.handRankBadge.className = "hand-rank-badge rank-high";
  } else {
    refs.handRankBadge.className = "hand-rank-badge";
  }
}

// ── Rendering Functions ──

function renderCommunityCards(cards, previousCards) {
  refs.communityCards.innerHTML = "";
  const arr = ensureArray(cards);
  arr.forEach((code, idx) => {
    const isNew = idx >= (previousCards || []).length;
    const cardEl = createCardElement(code, { isNew });
    refs.communityCards.appendChild(cardEl);
  });
}

function renderHandCards(cards, previousCards) {
  refs.handCards.innerHTML = "";
  const arr = ensureArray(cards);
  arr.forEach((code, idx) => {
    const isNew = idx >= (previousCards || []).length;
    const cardEl = createCardElement(code, { isNew });
    if (appState.swapModeActive) {
      cardEl.classList.add("is-swap-selectable");
      cardEl.title = `点击换掉此手牌 (第 ${idx + 1} 张)`;
      cardEl.addEventListener("click", () => {
        executeSwapCard(idx);
      });
    }
    refs.handCards.appendChild(cardEl);
  });
  if (refs.handSwapHint) {
    refs.handSwapHint.style.display = appState.swapModeActive ? "block" : "none";
  }
}

function renderSeats(players, previousPlayers, currentPlayerId) {
  refs.seatsLayer.innerHTML = "";
  const sorted = ensureArray(players)
    .filter((p) => normalizeStatus(p.status) !== "out" || p.id === appState.playerId)
    .sort((a, b) => Number(a.seat) - Number(b.seat));

  if (sorted.length === 0) return;
  const layoutMap = buildSeatLayoutByPlayer(sorted);
  const winnerIds = new Set(ensureArray(appState.lastState.result?.winners).map((w) => w.player_id));

  for (const player of sorted) {
    const layout = layoutMap.get(player.id) || SEAT_SLOTS.bottom;
    const seatNode = document.createElement("article");
    seatNode.className = "seat";
    seatNode.style.setProperty("--seat-x", String(layout.x));
    seatNode.style.setProperty("--seat-y", String(layout.y));

    const status = normalizeStatus(player.status);
    if (player.id === currentPlayerId) seatNode.classList.add("is-current");
    if (status === "folded") seatNode.classList.add("is-folded");
    if (status === "out") seatNode.classList.add("is-out");
    if (winnerIds.has(player.id)) seatNode.classList.add("is-winner");

    // Action Bubble
    if (player.last_action && player.last_action !== "blind") {
      const bubble = document.createElement("div");
      bubble.className = `action-bubble bubble-${player.last_action}`;
      bubble.textContent = `${ACTION_LABELS[player.last_action] || player.last_action} ${player.bet > 0 ? "$" + player.bet : ""}`;
      seatNode.appendChild(bubble);
    }

    const nameRow = document.createElement("div");
    nameRow.className = "seat-name";
    const leftG = document.createElement("div");
    leftG.style.display = "flex";
    leftG.style.alignItems = "center";
    leftG.style.gap = "6px";

    const avSpan = document.createElement("span");
    avSpan.className = "seat-avatar";
    avSpan.textContent = player.id === appState.playerId ? "YOU" : `P${Number(player.seat || 0) + 1}`;
    leftG.appendChild(avSpan);

    const titleSpan = document.createElement("span");
    titleSpan.textContent = player.name || `玩家 ${Number(player.seat) + 1}`;
    leftG.appendChild(titleSpan);
    nameRow.appendChild(leftG);

    const idSpan = document.createElement("span");
    idSpan.className = "seat-id";
    idSpan.textContent = shortId(player.id);
    nameRow.appendChild(idSpan);

    const metaRow = document.createElement("div");
    metaRow.className = "seat-meta";
    metaRow.appendChild(makeChip(`$${Number(player.stack || 0)}`));
    if (Number(player.bet || 0) > 0) {
      metaRow.appendChild(makeChip(`下注 $${Number(player.bet)}`));
    }
    metaRow.appendChild(makeChip(statusLabel(status)));

    if (player.id === appState.playerId) metaRow.appendChild(makeChip("自己", "self"));
    if (Number(player.seat) === Number(appState.lastState.dealer_seat)) metaRow.appendChild(makeChip("D", "dealer"));
    if (player.id === currentPlayerId) metaRow.appendChild(makeChip("行动中", "turn"));
    if (player.heat_warning) metaRow.appendChild(makeChip("可疑", "warning"));

    const cardRow = document.createElement("div");
    cardRow.className = "seat-cards";
    const visibleCards = ensureArray(player.hand);
    if (visibleCards.length > 0) {
      visibleCards.forEach((c) => cardRow.appendChild(createCardElement(c, { mini: true })));
    } else if (shouldRenderHiddenCards(status, player.id)) {
      cardRow.appendChild(createCardElement("", { mini: true, back: true }));
      cardRow.appendChild(createCardElement("", { mini: true, back: true }));
    }

    seatNode.appendChild(nameRow);
    seatNode.appendChild(metaRow);
    seatNode.appendChild(cardRow);

    refs.seatsLayer.appendChild(seatNode);
  }
}

function renderSkillCards(skills) {
  refs.skillCardTray.innerHTML = "";
  refs.skillButtons.innerHTML = "";
  const arr = ensureArray(skills);

  appState.targetIds = appState.lastState.players
    .filter((p) => p.id !== appState.playerId && normalizeStatus(p.status) === "active")
    .map((p) => p.id);
  if (!appState.targetIds.includes(appState.selectedTargetId)) {
    appState.selectedTargetId = appState.targetIds[0] || "";
  }

  refs.targetSelect.innerHTML = "";
  refs.targetSelect.appendChild(new Option("目标玩家", ""));
  appState.targetIds.forEach((targetId) => {
    const target = appState.lastState.players.find((player) => player.id === targetId);
    refs.targetSelect.appendChild(new Option(`${target?.name || "对手"} (${shortId(targetId)})`, targetId));
  });
  refs.targetSelect.value = appState.selectedTargetId;
  refs.cardIdxSelect.value = String(appState.selectedCardIdx);

  if (arr.length === 0) {
    refs.skillCardTray.innerHTML = '<p class="empty-skills-hint">当前无可用技能牌</p>';
    refs.skillsText.textContent = "技能: -";
    closeSkillDrawer();
    return;
  }

  if (appState.selectedSkillId && !arr.some((skill) => skill.id === appState.selectedSkillId)) {
    closeSkillDrawer();
  }

  refs.skillsText.textContent = `技能: ${arr.map((skill) => `${(SKILL_META[skill.id] || {}).name || skill.id}(${skill.id})`).join("、")}`;

  arr.forEach((skill) => {
    const meta = SKILL_META[skill.id] || { name: skill.id, cost: skill.cost || 15 };
    const cardEl = document.createElement("div");
    cardEl.className = "skill-card-item";
    cardEl.dataset.skillId = skill.id;
    if (meta.passive) cardEl.classList.add("is-passive");
    if (appState.selectedSkillId === skill.id) cardEl.classList.add("is-selected");

    const avail = evaluateSkillAvailability(skill.id);
    if (!avail.canUse && !meta.passive) {
      cardEl.classList.add("is-disabled");
    }

    cardEl.innerHTML = `
      <span class="skill-name">${meta.name}</span>
      <span class="skill-cost-badge">+${meta.cost} 怀疑</span>
    `;

    cardEl.addEventListener("click", () => {
      selectSkill(skill.id);
    });

    refs.skillCardTray.appendChild(cardEl);

    const legacyButton = document.createElement("button");
    legacyButton.type = "button";
    legacyButton.dataset.skillId = skill.id;
    legacyButton.textContent = `${meta.name} +${meta.cost}`;
    legacyButton.disabled = !avail.canUse && !meta.passive;
    legacyButton.classList.toggle("is-selected", appState.selectedSkillId === skill.id);
    legacyButton.classList.toggle("is-unavailable", !avail.canUse);
    legacyButton.title = avail.reason;
    legacyButton.addEventListener("click", () => selectSkill(skill.id));
    refs.skillButtons.appendChild(legacyButton);
  });

  if (appState.selectedSkillId) {
    updateSkillDrawer();
  }
}

function selectSkill(skillId) {
  const meta = SKILL_META[skillId];
  if (!meta) return;
  if (meta.passive) {
    showToast("反侦察是被动技能，受到对手窥视时自动抵消", "ok");
    return;
  }
  appState.selectedSkillId = skillId;
  if (skillId === "swap") {
    appState.swapModeActive = true;
    renderHandCards(appState.lastState.my_hand, appState.lastState.my_hand);
  } else {
    appState.swapModeActive = false;
    renderHandCards(appState.lastState.my_hand, appState.lastState.my_hand);
  }
  updateSkillDrawer();
  renderSkillCards(appState.lastState.my_skills);
}

function closeSkillDrawer() {
  appState.selectedSkillId = "";
  appState.swapModeActive = false;
  refs.skillActionDrawer.style.display = "none";
  renderHandCards(appState.lastState.my_hand, appState.lastState.my_hand);
}

function updateSkillDrawer() {
  const skillId = appState.selectedSkillId;
  if (!skillId) {
    refs.skillActionDrawer.style.display = "none";
    refs.selectedSkillText.textContent = "已选技能: -";
    refs.skillDescriptionText.textContent = "技能说明: -";
    refs.skillHintText.textContent = "可用性: -";
    refs.targetSelect.style.display = "none";
    refs.cardIdxSelect.style.display = "none";
    return;
  }
  const meta = SKILL_META[skillId];
  if (!meta) return;

  refs.skillActionDrawer.style.display = "flex";
  refs.drawerSkillName.textContent = meta.name;
  refs.drawerSkillCost.textContent = `+${meta.cost} 怀疑值`;
  refs.drawerSkillDesc.textContent = meta.description;
  refs.selectedSkillText.textContent = `已选技能: ${meta.name}`;
  refs.skillDescriptionText.textContent = `技能说明: ${meta.description}`;

  const avail = evaluateSkillAvailability(skillId);
  refs.drawerSkillHint.textContent = avail.reason;
  refs.drawerSkillHint.dataset.kind = avail.canUse ? "ok" : "warn";
  refs.skillHintText.textContent = `可用性: ${avail.reason}`;
  refs.skillHintText.dataset.kind = avail.canUse ? "ok" : "warn";
  refs.useSkillButton.disabled = !avail.canUse;
  refs.targetSelect.style.display = skillId === "peek" ? "" : "none";
  refs.cardIdxSelect.style.display = skillId === "swap" ? "" : "none";
  refs.targetSelect.value = appState.selectedTargetId;
  refs.cardIdxSelect.value = String(appState.selectedCardIdx);

  // Render Target Picker for Peek
  if (skillId === "peek") {
    refs.skillTargetPicker.style.display = "flex";
    refs.targetChips.innerHTML = "";
    const activeTargets = appState.lastState.players.filter((p) => p.id !== appState.playerId && normalizeStatus(p.status) === "active");
    if (!activeTargets.some((target) => target.id === appState.selectedTargetId)) {
      appState.selectedTargetId = activeTargets[0]?.id || "";
      refs.targetSelect.value = appState.selectedTargetId;
    }
    activeTargets.forEach((t) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `target-chip ${appState.selectedTargetId === t.id ? "active" : ""}`;
      chip.textContent = `${t.name || "对手"}`;
      chip.addEventListener("click", () => {
        appState.selectedTargetId = t.id;
        updateSkillDrawer();
      });
      refs.targetChips.appendChild(chip);
    });
  } else {
    refs.skillTargetPicker.style.display = "none";
  }
}

function executeSwapCard(cardIdx) {
  appState.selectedCardIdx = cardIdx;
  useSkill();
  appState.swapModeActive = false;
  renderHandCards(appState.lastState.my_hand, appState.lastState.my_hand);
}

function useSkill() {
  if (!isConnected()) {
    setStatus("尚未连接服务器", true);
    return;
  }
  const skillId = appState.selectedSkillId;
  const avail = evaluateSkillAvailability(skillId);
  if (!avail.canUse) {
    setStatus(avail.reason, true);
    return;
  }

  const payload = { skill_id: skillId };
  if (skillId === "peek") {
    payload.target_id = appState.selectedTargetId || "";
  }
  if (skillId === "swap") {
    payload.card_idx = Number(appState.selectedCardIdx || 0);
  }

  soundFx.play("skill");
  appState.lastSkillAttempt = skillId;
  sendMessage("skill", payload);
}

function evaluateSkillAvailability(skillId) {
  const meta = SKILL_META[skillId];
  if (!meta) return { canUse: false, reason: "未知技能" };
  if (meta.passive) return { canUse: false, reason: "被动技能：受窥视时自动触发抵消" };
  if (appState.isPaused) return { canUse: false, reason: "游戏已暂停，请先继续游戏" };

  const isMyTurn = Boolean(appState.lastState.current_player && appState.lastState.current_player === appState.playerId);
  if (!isMyTurn) return { canUse: false, reason: "仅在你的行动回合可以使用技能" };

  const myState = myPlayerState();
  if (Number(myState?.heat || 0) >= 100) return { canUse: false, reason: "怀疑值已满 (≥100)，千术已被锁定" };
  if (!appState.actionReq.can_use_skill) return { canUse: false, reason: "本回合已使用过技能" };

  if (skillId === "mist" && (!appState.lastState.community_cards || appState.lastState.community_cards.length === 0)) {
    return { canUse: false, reason: "需要公共牌（翻牌后可用）" };
  }
  if (skillId === "peek") {
    const activeTargets = appState.lastState.players.filter((p) => p.id !== appState.playerId && normalizeStatus(p.status) === "active");
    if (activeTargets.length === 0) return { canUse: false, reason: "场上没有其他活跃目标" };
    if (!appState.selectedTargetId || !activeTargets.some((target) => target.id === appState.selectedTargetId)) {
      return { canUse: false, reason: "请选择有效的目标玩家" };
    }
  }
  return { canUse: true, reason: "条件满足，可立即施放" };
}

// ── Action Controls (下注面板) ──

function updateActionArea() {
  const validActions = ensureArray(appState.actionReq.valid_actions);
  const toCall = Number(appState.actionReq.to_call || 0);
  const minRaise = Number(appState.actionReq.min_raise || 0);
  const maxRaise = Number(appState.actionReq.max_raise || 0);
  const me = myPlayerState();
  const myStreetBet = Number(me?.bet || 0);
  const minRaiseTo = myStreetBet + toCall + minRaise;

  const isMyTurn = Boolean(appState.lastState.current_player && appState.lastState.current_player === appState.playerId);
  const ownsActionReq = Boolean(appState.actionReq.player_id && appState.actionReq.player_id === appState.playerId);
  const canActNow = isActionPhase(appState.lastState.phase) && isMyTurn && ownsActionReq && !appState.actionPending && !appState.isPaused;
  const canRaiseNow = canActNow && validActions.includes("raise");

  let raiseVal = Number.parseInt(refs.raiseInput.value, 10);
  if (!Number.isFinite(raiseVal) || raiseVal < minRaiseTo) {
    raiseVal = minRaiseTo;
  }
  const validRaiseValue = raiseVal >= minRaiseTo && raiseVal <= maxRaise;

  refs.toCallBadge.textContent = toCall > 0 ? `需跟注: $${toCall}` : `当前无人加注`;

  // Buttons label & state
  refs.foldButton.disabled = !(canActNow && validActions.includes("fold"));
  refs.allInButton.disabled = !(canActNow && validActions.includes("all_in"));

  if (toCall === 0) {
    refs.checkButton.style.display = "";
    refs.callButton.style.display = "none";
    refs.checkButton.disabled = !(canActNow && validActions.includes("check"));
  } else {
    refs.checkButton.style.display = "none";
    refs.callButton.style.display = "";
    refs.callButton.disabled = !(canActNow && validActions.includes("call"));
    refs.callButton.querySelector(".btn-main-text").textContent = `跟注 $${toCall}`;
  }

  refs.allInButton.querySelector(".btn-main-text").textContent = maxRaise > 0 ? `全下 $${maxRaise - myStreetBet}` : "全下";

  // Raise Controls
  refs.raiseButton.disabled = !(canRaiseNow && validRaiseValue);
  refs.raiseButton.textContent = `加注到 $${raiseVal} [R]`;
  refs.raiseSlider.disabled = !canRaiseNow;
  refs.raiseSlider.min = String(minRaiseTo);
  refs.raiseSlider.max = String(maxRaise);
  refs.raiseSlider.value = String(raiseVal);
  refs.raiseInput.disabled = !canRaiseNow;

  refs.betPresetButtons.forEach((btn) => {
    btn.disabled = !canRaiseNow;
    if (btn.dataset.potFraction) {
      const frac = Number(btn.dataset.potFraction);
      const potAfter = Number(appState.lastState.total_pot || 0) + toCall;
      const target = myStreetBet + toCall + Math.round(potAfter * frac);
      btn.textContent = `${frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "满"}池 ($${Math.min(maxRaise, Math.max(minRaiseTo, target))})`;
    }
  });
}

function setDefaultRaiseAmount() {
  const me = myPlayerState();
  const myStreetBet = Number(me?.bet || 0);
  const toCall = Number(appState.actionReq.to_call || 0);
  const minRaise = Number(appState.actionReq.min_raise || 0);
  const minRaiseTo = myStreetBet + toCall + minRaise;
  refs.raiseInput.value = String(minRaiseTo);
  refs.raiseSlider.value = String(minRaiseTo);
}

function applyBetPreset(fraction) {
  const me = myPlayerState();
  const myStreetBet = Number(me?.bet || 0);
  const toCall = Number(appState.actionReq.to_call || 0);
  const minRaise = Number(appState.actionReq.min_raise || 0);
  const maxRaise = Number(appState.actionReq.max_raise || 0);
  const minRaiseTo = myStreetBet + toCall + minRaise;
  const potAfterCall = Number(appState.lastState.total_pot || 0) + toCall;
  const target = myStreetBet + toCall + Math.round(potAfterCall * Math.max(0, fraction));
  const finalVal = Math.min(maxRaise, Math.max(minRaiseTo, target));
  refs.raiseInput.value = String(finalVal);
  refs.raiseSlider.value = String(finalVal);
  updateActionArea();
}

function applyBbPreset(multiplier) {
  const me = myPlayerState();
  const myStreetBet = Number(me?.bet || 0);
  const toCall = Number(appState.actionReq.to_call || 0);
  const minRaise = Number(appState.actionReq.min_raise || 0);
  const maxRaise = Number(appState.actionReq.max_raise || 0);
  const minRaiseTo = myStreetBet + toCall + minRaise;
  const bb = Number(appState.lastState.big_blind || 10);
  const target = myStreetBet + toCall + bb * multiplier;
  const finalVal = Math.min(maxRaise, Math.max(minRaiseTo, target));
  refs.raiseInput.value = String(finalVal);
  refs.raiseSlider.value = String(finalVal);
  updateActionArea();
}

function sendAction(action, amount = 0) {
  if (!isConnected()) {
    setStatus("尚未连接服务器", true);
    return;
  }
  if (appState.actionPending) return;

  const validActions = ensureArray(appState.actionReq.valid_actions);
  if (!validActions.includes(action)) {
    setStatus(`当前不能执行【${ACTION_LABELS[action] || action}】`, true);
    return;
  }

  const payload = { action };
  if (action === "raise") {
    payload.amount = Number(amount || refs.raiseInput.value || 0);
  }
  soundFx.play("chip");
  appState.actionPending = true;
  sendMessage("action", payload);
  updateActionArea();
}

// ── Hand Result & Log ──

function renderHandResult(result) {
  if (!result || !Array.isArray(result.winners) || result.winners.length === 0) {
    refs.handResult.hidden = true;
    if (appState.autoNextTimer) {
      clearTimeout(appState.autoNextTimer);
      appState.autoNextTimer = null;
    }
    return;
  }
  refs.handResult.hidden = false;
  const winners = result.winners;
  const winnerNames = winners.map((w) => w.player_name || "玩家").join("、");
  const totalWon = winners.reduce((acc, w) => acc + (w.amount || 0), 0);
  const handDesc = winners[0].hand_category !== undefined && winners[0].hand_category >= 0
    ? `(${HAND_CATEGORY_LABELS[winners[0].hand_category] || "成牌"})`
    : "";

  refs.handResultTitle.textContent = `胜者: ${winnerNames}`;
  refs.handResultDetail.textContent = `赢得底池 $${totalWon} ${handDesc}`;

  // Pacing control
  if (appState.autoNextHand && !appState.isPaused && appState.screen === "game") {
    if (appState.autoNextTimer) clearTimeout(appState.autoNextTimer);
    const delay = appState.gameSpeed === "fast" ? 1500 : appState.gameSpeed === "slow" ? 4500 : 3000;
    appState.autoNextTimer = setTimeout(() => {
      appState.autoNextTimer = null;
      nextHand();
    }, delay);
  } else if (appState.autoNextTimer) {
    clearTimeout(appState.autoNextTimer);
    appState.autoNextTimer = null;
  }
}

function renderActionLog(actions) {
  refs.actionLogList.innerHTML = "";
  const arr = ensureArray(actions).slice(-10);
  arr.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.player_name || "玩家"}: ${ACTION_LABELS[item.action] || item.action} ${item.amount ? "$" + item.amount : ""}`;
    refs.actionLogList.appendChild(li);
  });
}

// ── Turn Timer & Banner ──

function stepUiTimers(deltaMs) {
  if (appState.isPaused) return;
  if (appState.actionTimeRemainingMs > 0) {
    appState.actionTimeRemainingMs = Math.max(0, appState.actionTimeRemainingMs - deltaMs);
    renderTurnTimer();
  }
}

function renderTurnTimer() {
  const isMyTurn = appState.lastState.current_player === appState.playerId;
  if (!isMyTurn || appState.actionTimeRemainingMs <= 0) {
    refs.turnTimerText.textContent = isMyTurn ? "轮到你行动" : "等待对手";
    refs.turnTimerText.className = "meta-pill turn-timer-pill";
    return;
  }
  const sec = Math.ceil(appState.actionTimeRemainingMs / 1000);
  refs.turnTimerText.textContent = `倒计时: ${sec}s`;
  refs.turnTimerText.className = sec <= 5 ? "meta-pill turn-timer-pill is-urgent" : "meta-pill turn-timer-pill is-active";
}

function clearActionTimer() {
  appState.actionTimeRemainingMs = 0;
  appState.actionTimeTotalMs = 0;
  renderTurnTimer();
}

function updateTurnBanner(isMyTurn) {
  refs.turnBanner.hidden = !isMyTurn || appState.lastState.phase === "showdown" || appState.lastState.phase === "waiting";
}

// ── Shortcuts & Modals ──

function handleGlobalShortcuts(e) {
  if (appState.screen !== "game" || refs.rulesDialog.open) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
  const key = e.key.toUpperCase();
  if (key === "ESCAPE" || key === "P") {
    e.preventDefault();
    togglePause();
    return;
  }
  if (key === " " || key === "SPACE") {
    if (appState.isPaused) {
      e.preventDefault();
      resumeGame();
      return;
    }
    if (!refs.handResult.hidden) {
      e.preventDefault();
      nextHand();
      return;
    }
  }
  if (appState.isPaused) return;

  if (key === "F") refs.foldButton.click();
  else if (key === "K") refs.checkButton.click();
  else if (key === "C") refs.callButton.click();
  else if (key === "R") refs.raiseButton.click();
  else if (key === "A") refs.allInButton.click();
}

function openRules() {
  refs.rulesDialog.showModal();
}

function closeRules() {
  refs.rulesDialog.close();
}

// ── Helper Utilities ──

function createCardElement(code, options = {}) {
  const el = document.createElement("div");
  if (options.back || !code) {
    el.className = `poker-card is-back ${options.mini ? "mini" : ""}`;
    return el;
  }
  const parsed = parseCardString(code);
  if (!parsed) {
    el.className = `poker-card is-back ${options.mini ? "mini" : ""}`;
    return el;
  }
  el.className = `poker-card ${parsed.red ? "is-red" : "is-black"} ${options.mini ? "mini" : ""} ${options.isNew ? "card-enter" : ""}`;
  el.innerHTML = `
    <span class="rank">${parsed.label}</span>
    <span class="suit">${parsed.symbol}</span>
    <span class="rank-bottom">${parsed.label}</span>
  `;
  return el;
}

function parseCardString(code) {
  if (typeof code !== "string") return null;
  const value = code.trim().toUpperCase();
  if (value.length < 2) return null;
  const suitChar = value.slice(-1);
  const rankChar = value.slice(0, -1);
  const meta = SUIT_META[suitChar];
  if (!meta || !/^(10|[2-9TJQKA])$/.test(rankChar)) return null;
  return {
    label: rankChar === "T" ? "10" : rankChar,
    symbol: meta.symbol,
    red: meta.red,
  };
}

function makeChip(text, kind = "") {
  const span = document.createElement("span");
  span.className = `seat-chip ${kind ? "chip-" + kind : ""}`;
  span.textContent = text;
  return span;
}

function showToast(msg, kind = "ok") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.textContent = msg;
  refs.toastStack.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

function setStatus(msg, isError = false) {
  refs.statusText.textContent = msg;
  refs.statusText.dataset.kind = isError ? "error" : "ok";
}

function friendlyServerError(msg) {
  return SERVER_ERROR_MAP[msg] || msg || "操作异常";
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "未知";
}

function normalizeStatus(status) {
  return String(status || "").toLowerCase();
}

function isActionPhase(phase) {
  return ["preflop", "flop", "turn", "river"].includes(String(phase || "").toLowerCase());
}

function shortId(id) {
  if (!id) return "";
  return id.length > 6 ? id.slice(0, 6) : id;
}

function ensureArray(val) {
  return Array.isArray(val) ? val : [];
}

function myPlayerState() {
  return appState.lastState.players.find((p) => p.id === appState.playerId);
}

function shouldRenderHiddenCards(status, playerId) {
  if (playerId === appState.playerId) return false;
  return status === "active" || status === "all_in";
}

function buildSeatLayoutByPlayer(players) {
  const map = new Map();
  if (!players || players.length === 0) return map;
  const meIndex = players.findIndex((p) => p.id === appState.playerId);
  if (meIndex >= 0) {
    map.set(players[meIndex].id, SEAT_SLOTS.bottom);
    const others = [...players.slice(meIndex + 1), ...players.slice(0, meIndex)];
    const slots = OTHER_SEAT_SLOTS_BY_COUNT[others.length] || OTHER_SEAT_SLOTS_BY_COUNT[5];
    others.forEach((p, i) => {
      map.set(p.id, SEAT_SLOTS[slots[i]] || SEAT_SLOTS.top);
    });
  } else {
    const slots = ["bottom", "right-lower", "right-upper", "top", "left-upper", "left-lower"];
    players.forEach((p, i) => {
      map.set(p.id, SEAT_SLOTS[slots[i % slots.length]]);
    });
  }
  return map;
}

function normalizeState(state) {
  const rawState = state || {};
  return {
    phase: String(rawState.phase || "waiting"),
    paused: Boolean(rawState.paused),
    total_pot: Number(rawState.total_pot || 0),
    pots: ensureArray(rawState.pots).map((pot) => ({
      kind: String(pot?.kind || ""),
      amount: Number(pot?.amount || 0),
      eligible_count: Number(pot?.eligible_count || 0),
    })),
    community_cards: ensureArray(rawState.community_cards).map((card) => String(card || "")),
    my_hand: ensureArray(rawState.my_hand).map((card) => String(card || "")),
    my_skills: ensureArray(rawState.my_skills).map((skill) => ({
      id: String(skill?.id || ""),
      name: String(skill?.name || ""),
      cost: Number(skill?.cost || 0),
    })),
    my_heat: Number(rawState.my_heat || 0),
    players: ensureArray(rawState.players).map((player) => ({
      id: String(player?.id || ""),
      name: String(player?.name || ""),
      seat: Number(player?.seat || 0),
      stack: Number(player?.stack || 0),
      bet: Number(player?.bet || 0),
      total_bet: Number(player?.total_bet ?? player?.totalBet ?? 0),
      status: String(player?.status || "active"),
      last_action: String(player?.last_action || ""),
      acted_this_round: Boolean(player?.acted_this_round),
      heat_warning: Boolean(player?.heat_warning),
      hand: ensureArray(player?.hand).map((card) => String(card || "")),
    })),
    current_player: String(rawState.current_player || ""),
    dealer_seat: Number(rawState.dealer_seat ?? -1),
    hand_seq: Number(rawState.hand_seq || 0),
    recent_actions: ensureArray(rawState.recent_actions).map((action) => ({
      seq: Number(action?.seq || 0),
      hand_seq: Number(action?.hand_seq || 0),
      phase: String(action?.phase || ""),
      player_id: String(action?.player_id || ""),
      player_name: String(action?.player_name || ""),
      action: String(action?.action || ""),
      amount: Number(action?.amount || 0),
      to: Number(action?.to || 0),
    })),
    result: rawState.result ? {
      reason: String(rawState.result?.reason || ""),
      winners: ensureArray(rawState.result?.winners).map((winner) => ({
        player_id: String(winner?.player_id || ""),
        player_name: String(winner?.player_name || ""),
        amount: Number(winner?.amount || 0),
        hand_category: Number(winner?.hand_category ?? -1),
      })),
    } : null,
  };
}

function normalizeActionReq(req) {
  return {
    player_id: req.player_id || "",
    valid_actions: ensureArray(req.valid_actions),
    to_call: Number(req.to_call || 0),
    min_raise: Number(req.min_raise || 0),
    max_raise: Number(req.max_raise || 0),
    can_use_skill: Boolean(req.can_use_skill),
    timeout_sec: Number(req.timeout_sec || 30),
  };
}

function updateWaitingRoom(state) {
  const isWaiting = state.phase === "waiting";
  const players = ensureArray(state.players);
  const total = players.length || 0;
  const fundedPlayers = players.filter((player) => Number(player.stack || 0) > 0).length;
  const me = players.find((player) => player.id === appState.playerId);
  const isBusted = Boolean(me && Number(me.stack || 0) <= 0);

  refs.waitingRoom.style.display = isWaiting ? "" : "none";
  if (isWaiting) {
    refs.waitingPlayerCount.textContent = isBusted
      ? "筹码已用完，点击快捷开局会自动重新买入 1000 筹码。"
      : `当前 ${fundedPlayers} 名就绪玩家 · ${total} 个席位 / 最多 6 人`;
  }
  refs.addBotBtn.disabled = !isWaiting || total >= 6;
  refs.startGameBtn.disabled = !isWaiting || fundedPlayers < 2;
  refs.quickStartBtn.disabled = !isWaiting;
  refs.pauseGameBtn.disabled = appState.screen !== "game" || isWaiting;
  refs.quickStartBtn.textContent = isBusted ? "重新买入并补满 AI" : "补满 AI 立即开局";
}

function displaySkillName(skill) {
  const id = String(skill?.id || skill?.skill_id || "");
  return SKILL_META[id]?.name || String(skill?.name || id || "未知技能");
}

function calculatePotsFromPlayers(players) {
  const safePlayers = ensureArray(players);
  const hasAllIn = safePlayers.some((player) => normalizeStatus(player.status) === "all_in" && Number(player.total_bet || 0) > 0);
  if (!hasAllIn) {
    const total = safePlayers.reduce((sum, player) => sum + Number(player.total_bet || 0), 0);
    if (total <= 0) return [];
    const eligibleCount = safePlayers.filter((player) => {
      const status = normalizeStatus(player.status);
      return Number(player.total_bet || 0) > 0 && status !== "folded" && status !== "out";
    }).length;
    return [{ kind: "main", amount: total, eligible_count: eligibleCount }];
  }

  const contributions = safePlayers
    .map((player) => ({
      amount: Number(player.total_bet || 0),
      folded: ["folded", "out"].includes(normalizeStatus(player.status)),
    }))
    .filter((entry) => entry.amount > 0);
  if (contributions.length === 0) return [];

  const levels = [...new Set(contributions.map((entry) => entry.amount))].sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  levels.forEach((level) => {
    if (level <= previous) return;
    let playerCount = 0;
    let eligibleCount = 0;
    contributions.forEach((entry) => {
      if (entry.amount < level) return;
      playerCount += 1;
      if (!entry.folded) eligibleCount += 1;
    });
    const amount = (level - previous) * playerCount;
    if (eligibleCount === 0 && pots.length > 0 && pots[pots.length - 1].eligible_count > 0) {
      pots[pots.length - 1].amount += amount;
    } else {
      pots.push({ kind: pots.length === 0 ? "main" : "side", amount, eligible_count: eligibleCount });
    }
    previous = level;
  });
  return pots;
}

function renderGameToText() {
  const players = ensureArray(appState.lastState.players).slice().sort((a, b) => Number(a.seat) - Number(b.seat));
  const visiblePlayers = players.filter((player) => normalizeStatus(player.status) !== "out" || player.id === appState.playerId);
  const seatLayoutByPlayer = buildSeatLayoutByPlayer(visiblePlayers);
  const pots = ensureArray(appState.lastState.pots).length > 0
    ? ensureArray(appState.lastState.pots)
    : calculatePotsFromPlayers(players);
  const isGameScreen = appState.screen === "game";
  const seats = visiblePlayers.map((player) => {
    const layout = seatLayoutByPlayer.get(player.id) || SEAT_SLOTS.bottom;
    return {
      id: player.id,
      name: player.name,
      seat: player.seat,
      status: normalizeStatus(player.status),
      stack: Number(player.stack || 0),
      bet: Number(player.bet || 0),
      total_bet: Number(player.total_bet || 0),
      last_action: String(player.last_action || ""),
      acted_this_round: Boolean(player.acted_this_round),
      heat_warning: Boolean(player.heat_warning),
      visible_hand: ensureArray(player.hand),
      layout_slot: layout.name,
      x: layout.x,
      y: layout.y,
    };
  });

  return JSON.stringify({
    screen: appState.screen,
    coordinate_system: "origin at top-left; x grows right; y grows down; seat x/y are normalized 0..1 in seats-layer space.",
    connection_status: appState.connectionStatus,
    phase: appState.screen === "lobby" ? "" : appState.lastState.phase || "",
    paused: appState.isPaused,
    current_player: appState.lastState.current_player || "",
    is_my_turn: appState.lastState.current_player === appState.playerId,
    dealer_seat: Number(appState.lastState.dealer_seat ?? -1),
    player_count: players.length,
    hand_seq: Number(appState.lastState.hand_seq || 0),
    total_pot: Number(appState.lastState.total_pot || 0),
    pots: pots.map((pot) => ({
      kind: String(pot.kind || ""),
      amount: Number(pot.amount || 0),
      eligible_count: Number(pot.eligible_count || 0),
    })),
    my_heat: Number(appState.lastState.my_heat || 0),
    community_cards: ensureArray(appState.lastState.community_cards),
    my_hand: ensureArray(appState.lastState.my_hand),
    my_skills: ensureArray(appState.lastState.my_skills).map((skill) => ({
      id: skill.id,
      name: displaySkillName(skill),
      cost: Number(skill.cost || 0),
    })),
    result: appState.lastState.result,
    action_request: {
      player_id: appState.actionReq.player_id || "",
      valid_actions: ensureArray(appState.actionReq.valid_actions),
      to_call: Number(appState.actionReq.to_call || 0),
      min_raise: Number(appState.actionReq.min_raise || 0),
      max_raise: Number(appState.actionReq.max_raise || 0),
      can_use_skill: appState.actionReq.can_use_skill === true,
      timeout_sec: Number(appState.actionReq.timeout_sec || 0),
      timeout_remaining_ms: Number(appState.actionTimeRemainingMs || 0),
    },
    selected_skill: appState.selectedSkillId || "",
    selected_skill_availability: appState.selectedSkillId ? evaluateSkillAvailability(appState.selectedSkillId) : null,
    target_options: appState.targetIds.slice(),
    recent_actions: ensureArray(appState.lastState.recent_actions),
    players,
    seats,
    controls: {
      can_connect: appState.screen === "lobby" && !refs.createRoomBtn.disabled,
      can_join: appState.screen === "lobby" && !refs.joinRoomBtn.disabled,
      create_room_enabled: appState.screen === "lobby" && !refs.createRoomBtn.disabled,
      join_room_enabled: appState.screen === "lobby" && !refs.joinRoomBtn.disabled,
      fold_enabled: !refs.foldButton.disabled,
      check_enabled: !refs.checkButton.disabled,
      call_enabled: !refs.callButton.disabled,
      raise_enabled: !refs.raiseButton.disabled,
      all_in_enabled: !refs.allInButton.disabled,
      use_skill_enabled: !refs.useSkillButton.disabled,
      quick_start_enabled: isGameScreen && !refs.quickStartBtn.disabled,
      add_bot_enabled: isGameScreen && !refs.addBotBtn.disabled,
      start_game_enabled: isGameScreen && !refs.startGameBtn.disabled,
    },
  });
}

function advanceTime(ms) {
  const total = Math.max(0, Number(ms) || 0);
  if (total === 0) return renderGameToText();
  const loops = Math.max(1, Math.ceil(total / UI_TICK_MS));
  const step = total / loops;
  for (let index = 0; index < loops; index += 1) {
    stepUiTimers(step);
  }
  return renderGameToText();
}
