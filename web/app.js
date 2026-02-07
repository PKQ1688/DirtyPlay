const PLAYER_ID_KEY = "dirtyplay_player_id";
const PLAYER_NAME_KEY = "dirtyplay_player_name";
const UI_TICK_MS = 50;

const PHASE_LABELS = {
  waiting: "等待中",
  dealing: "发牌",
  preflop: "翻牌前",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  showdown: "摊牌",
};

const STATUS_LABELS = {
  active: "游戏中",
  folded: "已弃牌",
  all_in: "全下",
  out: "出局",
};

const SKILL_META = {
  peek: {
    name: "窥视",
    description: "查看目标玩家的一张随机手牌。需要选择仍在局的目标玩家。",
    passive: false,
  },
  bluff: {
    name: "虚张声势",
    description: "本街让其他玩家看到你的伪造手牌。",
    passive: false,
  },
  mist: {
    name: "迷雾",
    description: "本街让其他玩家误看到一张被替换的公共牌。翻牌后才可用。",
    passive: false,
  },
  swap: {
    name: "换牌",
    description: "替换你的一张手牌并从牌堆抽新牌，需要选择手牌索引。",
    passive: false,
  },
  counter: {
    name: "反侦察",
    description: "被动技能，自动抵消一次针对你的侦察类技能。",
    passive: true,
  },
};

const SERVER_ERROR_MAP = {
  "not in action phase": "当前不在行动阶段，暂时不能使用技能。",
  "not your turn": "还没轮到你行动。",
  "invalid player": "玩家状态异常，无法执行本次操作。",
  "skill already used": "本回合你已经使用过一次技能。",
  "heat locked": "怀疑值过高，技能已被锁定。",
  "skill not owned": "你当前并不持有该技能。",
  "counter is passive": "反侦察是被动技能，不能主动使用。",
  "invalid target": "目标无效，请重新选择在局玩家。",
  "no community cards": "当前还没有公共牌，迷雾需在翻牌后使用。",
  "invalid card index": "换牌索引无效，请重新选择。",
  "deck empty": "牌堆已空，当前不能换牌。",
  "unknown skill": "技能类型无效。",
};

const SUIT_META = {
  S: { symbol: "♠", red: false },
  H: { symbol: "♥", red: true },
  D: { symbol: "♦", red: true },
  C: { symbol: "♣", red: false },
};

const SEAT_SLOTS = {
  bottom: { name: "bottom", x: 0.5, y: 0.9 },
  "right-lower": { name: "right-lower", x: 0.7, y: 0.78 },
  "right-upper": { name: "right-upper", x: 0.84, y: 0.36 },
  top: { name: "top", x: 0.5, y: 0.14 },
  "left-upper": { name: "left-upper", x: 0.16, y: 0.36 },
  "left-lower": { name: "left-lower", x: 0.3, y: 0.78 },
};

const OTHER_SEAT_SLOTS_BY_COUNT = {
  1: ["top"],
  2: ["right-upper", "left-upper"],
  3: ["right-upper", "top", "left-upper"],
  4: ["right-lower", "right-upper", "left-upper", "left-lower"],
  5: ["right-lower", "right-upper", "top", "left-upper", "left-lower"],
};

const refs = {
  serverInput: document.getElementById("serverInput"),
  roomInput: document.getElementById("roomInput"),
  nameInput: document.getElementById("nameInput"),
  connectButton: document.getElementById("connectButton"),
  joinButton: document.getElementById("joinButton"),
  resetIdentityButton: document.getElementById("resetIdentityButton"),
  statusText: document.getElementById("statusText"),
  statusMirror: document.getElementById("statusMirror"),
  phaseText: document.getElementById("phaseText"),
  turnText: document.getElementById("turnText"),
  potText: document.getElementById("potText"),
  heatText: document.getElementById("heatText"),
  communityText: document.getElementById("communityText"),
  handText: document.getElementById("handText"),
  skillsText: document.getElementById("skillsText"),
  communityCards: document.getElementById("communityCards"),
  handCards: document.getElementById("handCards"),
  seatsLayer: document.getElementById("seatsLayer"),
  playersList: document.getElementById("playersList"),
  toCallText: document.getElementById("toCallText"),
  minRaiseText: document.getElementById("minRaiseText"),
  foldButton: document.getElementById("foldButton"),
  checkButton: document.getElementById("checkButton"),
  callButton: document.getElementById("callButton"),
  raiseButton: document.getElementById("raiseButton"),
  allInButton: document.getElementById("allInButton"),
  raiseInput: document.getElementById("raiseInput"),
  skillButtons: document.getElementById("skillButtons"),
  selectedSkillText: document.getElementById("selectedSkillText"),
  skillDescriptionText: document.getElementById("skillDescriptionText"),
  skillHintText: document.getElementById("skillHintText"),
  targetSelect: document.getElementById("targetSelect"),
  cardIdxSelect: document.getElementById("cardIdxSelect"),
  useSkillButton: document.getElementById("useSkillButton"),
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
  targetIds: [],
  connectionStatus: "未连接",
  lastSentType: "",
  lastSkillAttempt: "",
};

const uiTimers = [];
setInterval(() => stepUiTimers(UI_TICK_MS), UI_TICK_MS);

setDefaultServerUrl();
if (appState.playerName) {
  refs.nameInput.value = appState.playerName;
}
setStatus("未连接", false);
renderCommunityCards([], []);
renderHandCards([], []);
renderSeats([], [], "");
updateActionArea();
updateSkillControls();

refs.connectButton.addEventListener("click", () => {
  void connectToServer(false);
});
refs.joinButton.addEventListener("click", () => {
  void joinRoom();
});
refs.resetIdentityButton.addEventListener("click", () => {
  void switchToNewIdentity();
});
refs.foldButton.addEventListener("click", () => sendAction("fold"));
refs.checkButton.addEventListener("click", () => sendAction("check"));
refs.callButton.addEventListener("click", () => sendAction("call"));
refs.raiseButton.addEventListener("click", () => {
  const amount = Number.parseInt(refs.raiseInput.value, 10) || 0;
  sendAction("raise", amount);
});
refs.allInButton.addEventListener("click", () => sendAction("all_in"));
refs.useSkillButton.addEventListener("click", useSkill);
refs.targetSelect.addEventListener("change", updateSkillControls);
refs.cardIdxSelect.addEventListener("change", updateSkillControls);

window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;

function setDefaultServerUrl() {
  if (window.location.host) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    refs.serverInput.value = `${protocol}://${window.location.host}/ws`;
    return;
  }
  refs.serverInput.value = "ws://localhost:8080/ws";
}

async function connectToServer(forceReconnect = false) {
  const url = refs.serverInput.value.trim();
  if (!url) {
    setStatus("请输入服务器地址", true);
    return false;
  }

  if (forceReconnect) {
    await disconnectSocket();
  }

  if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
    refs.joinButton.disabled = false;
    setStatus("已连接", false);
    return true;
  }

  if (appState.ws && appState.ws.readyState === WebSocket.CONNECTING) {
    const opened = await waitForSocketOpen(appState.ws, 7000);
    if (!opened) {
      setStatus("连接超时", true);
    }
    return opened;
  }

  setStatus(`正在连接 ${url} ...`, false);
  const ws = new WebSocket(url);
  appState.ws = ws;

  ws.addEventListener("open", () => {
    setStatus("已连接", false);
    refs.joinButton.disabled = false;
  });

  ws.addEventListener("close", () => {
    refs.joinButton.disabled = true;
    setStatus("连接已断开", true);
  });

  ws.addEventListener("error", () => {
    refs.joinButton.disabled = true;
    setStatus("网络连接错误", true);
  });

  ws.addEventListener("message", (event) => {
    onMessage(event.data);
  });

  const opened = await waitForSocketOpen(ws, 7000);
  if (!opened) {
    setStatus("连接超时", true);
  }
  return opened;
}

async function joinRoom() {
  if (appState.joining) {
    return;
  }
  appState.joining = true;

  try {
    const roomId = refs.roomInput.value.trim();
    if (!roomId) {
      setStatus("请输入房间号", true);
      return;
    }

    const payload = { room_id: roomId };
    if (appState.playerId) {
      payload.player_id = appState.playerId;
    }
    const name = refs.nameInput.value.trim();
    if (name) {
      appState.playerName = name;
      localStorage.setItem(PLAYER_NAME_KEY, name);
      payload.name = name;
    }

    const connected = await connectToServer(false);
    if (!connected) {
      return;
    }

    sendMessage("join", payload);
  } finally {
    appState.joining = false;
  }
}

function sendAction(action, amount = 0) {
  if (!isConnected()) {
    setStatus("尚未连接服务器", true);
    return;
  }

  const payload = { action };
  if (amount > 0) {
    payload.amount = amount;
  }

  sendMessage("action", payload);
}

function useSkill() {
  if (!isConnected()) {
    setStatus("尚未连接服务器", true);
    return;
  }

  const currentSkillId = appState.selectedSkillId || "";
  const availability = evaluateSkillAvailability(currentSkillId);
  if (!availability.canUse) {
    setStatus(availability.reason, true);
    return;
  }

  const payload = { skill_id: currentSkillId };
  if (currentSkillId === "peek") {
    payload.target_id = refs.targetSelect.value || "";
  }

  if (currentSkillId === "swap") {
    payload.card_idx = Number.parseInt(refs.cardIdxSelect.value, 10) || 0;
  }

  appState.lastSkillAttempt = currentSkillId;
  sendMessage("skill", payload);
}

function sendMessage(type, payload) {
  if (!isConnected()) {
    return;
  }

  const message = {
    type,
    seq: ++appState.seq,
    payload,
  };

  appState.lastSentType = String(type || "");
  appState.ws.send(JSON.stringify(message));
}

function onMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (_err) {
    return;
  }

  const payload = msg.payload || {};
  switch (msg.type) {
    case "ack":
      if (payload.success === false) {
        const mappedError = friendlyServerError(payload.error || "");
        setStatus(`请求失败: ${mappedError}`, true);
        appState.lastSentType = "";
        return;
      }

      if (payload.player_id) {
        appState.playerId = String(payload.player_id);
        localStorage.setItem(PLAYER_ID_KEY, appState.playerId);
        const joinName = refs.nameInput.value.trim();
        if (joinName) {
          appState.playerName = joinName;
          localStorage.setItem(PLAYER_NAME_KEY, joinName);
        }
        setStatus(`已加入，玩家ID ${shortId(appState.playerId)}`, false);
      }
      if (appState.lastSentType === "skill") {
        appState.lastSkillAttempt = "";
      }
      appState.lastSentType = "";
      break;

    case "state":
      renderState(payload);
      break;

    case "action_req":
      appState.actionReq = normalizeActionReq(payload || {});
      updateActionArea();
      updateSkillControls();
      break;

    case "skill_effect": {
      const skillName = displaySkillName(payload);
      appState.lastSkillAttempt = "";
      if (payload.blocked) {
        setStatus(`技能被抵消: ${skillName}`, true);
      } else if (payload.result && payload.result.card) {
        setStatus(`技能生效: ${skillName} -> ${payload.result.card}`, false);
      } else {
        setStatus(`技能生效: ${skillName}`, false);
      }
      break;
    }

    case "error":
      setStatus(`服务器错误: ${payload.message || "未知错误"}`, true);
      break;

    default:
      break;
  }
}

function renderState(rawState) {
  const previousState = appState.lastState;
  const state = normalizeState(rawState);
  appState.lastState = state;

  const currentPlayerName = displayPlayerName(state.current_player, state.players);
  refs.phaseText.textContent = `阶段: ${displayPhase(state.phase)}`;
  refs.turnText.textContent = `当前行动: ${currentPlayerName}`;
  refs.potText.textContent = `底池: ${Number(state.total_pot)}`;
  refs.heatText.textContent = `怀疑值: ${Number(state.my_heat)}`;

  const skills = ensureArray(state.my_skills);
  refs.skillsText.textContent = `技能: ${skills.map((skill) => `${displaySkillName(skill)}(${String(skill.id || "")})`).join("、") || "-"}`;

  renderCommunityCards(state.community_cards, previousState.community_cards);
  renderHandCards(state.my_hand, previousState.my_hand);
  renderSkills(skills);
  renderTargets(state.players);
  renderSeats(state.players, previousState.players, state.current_player);
  renderLegacyPlayers(state.players, state.current_player);

  updateActionArea();
  updateSkillControls();
}

function renderCommunityCards(cards, previousCards) {
  refs.communityCards.innerHTML = "";
  const safeCards = ensureArray(cards);
  const safePreviousCards = ensureArray(previousCards);

  if (safeCards.length === 0) {
    refs.communityText.textContent = "公共牌: -";
    return;
  }

  safeCards.forEach((cardCode, index) => {
    const shouldAnimate = !safePreviousCards[index] || safePreviousCards[index] !== cardCode;
    refs.communityCards.appendChild(createCardElement(cardCode, { animate: shouldAnimate }));
  });

  refs.communityText.textContent = `公共牌: ${safeCards.join(", ")}`;
}

function renderHandCards(cards, previousCards) {
  refs.handCards.innerHTML = "";
  const safeCards = ensureArray(cards);
  const safePreviousCards = ensureArray(previousCards);

  if (safeCards.length === 0) {
    refs.handText.textContent = "我的手牌: -";
    return;
  }

  safeCards.forEach((cardCode, index) => {
    const shouldAnimate = !safePreviousCards[index] || safePreviousCards[index] !== cardCode;
    refs.handCards.appendChild(createCardElement(cardCode, { animate: shouldAnimate }));
  });

  refs.handText.textContent = `我的手牌: ${safeCards.join(", ")}`;
}

function renderSeats(players, previousPlayers, currentPlayerId) {
  refs.seatsLayer.innerHTML = "";
  const sortedPlayers = ensureArray(players)
    .filter((player) => normalizeStatus(player.status) !== "out" || player.id === appState.playerId)
    .slice()
    .sort((a, b) => Number(a.seat) - Number(b.seat));
  if (sortedPlayers.length === 0) {
    return;
  }

  const previousMap = new Map(ensureArray(previousPlayers).map((player) => [player.id, player]));
  const seatLayoutByPlayer = buildSeatLayoutByPlayer(sortedPlayers);

  for (const player of sortedPlayers) {
    const layout = seatLayoutByPlayer.get(player.id) || SEAT_SLOTS.bottom;
    const seatNode = document.createElement("article");
    seatNode.className = "seat";
    seatNode.style.setProperty("--seat-x", String(layout.x));
    seatNode.style.setProperty("--seat-y", String(layout.y));

    const status = normalizeStatus(player.status);
    if (player.id === currentPlayerId) {
      seatNode.classList.add("is-current");
    }
    if (status === "folded") {
      seatNode.classList.add("is-folded");
    }
    if (status === "out") {
      seatNode.classList.add("is-out");
    }

    const nameRow = document.createElement("div");
    nameRow.className = "seat-name";

    const title = document.createElement("span");
    title.textContent = player.name || `玩家${Number(player.seat) + 1}`;
    nameRow.appendChild(title);

    const idText = document.createElement("span");
    idText.className = "seat-id";
    idText.textContent = shortId(player.id);
    nameRow.appendChild(idText);

    const metaRow = document.createElement("div");
    metaRow.className = "seat-meta";
    metaRow.appendChild(makeChip(`筹码 ${Number(player.stack)}`));
    metaRow.appendChild(makeChip(`下注 ${Number(player.bet)}`));
    metaRow.appendChild(makeChip(statusLabel(status)));

    if (player.id === appState.playerId) {
      metaRow.appendChild(makeChip("自己", "self"));
    }
    if (player.id === currentPlayerId) {
      metaRow.appendChild(makeChip("行动中", "turn"));
    }
    if (player.heat_warning) {
      metaRow.appendChild(makeChip("可疑", "warning"));
    }

    const cardRow = document.createElement("div");
    cardRow.className = "seat-cards";
    const visibleCards = ensureArray(player.hand);

    if (visibleCards.length > 0) {
      visibleCards.forEach((cardCode) => {
        cardRow.appendChild(createCardElement(cardCode, { mini: true }));
      });
    } else if (shouldRenderHiddenCards(status, player.id)) {
      cardRow.appendChild(createCardElement("", { mini: true, back: true }));
      cardRow.appendChild(createCardElement("", { mini: true, back: true }));
    }

    seatNode.appendChild(nameRow);
    seatNode.appendChild(metaRow);
    seatNode.appendChild(cardRow);

    const previous = previousMap.get(player.id);
    if (previous) {
      if (Number(previous.bet || 0) !== Number(player.bet || 0)) {
        markTransientClass(seatNode, "seat-bet-change", 560);
      }
      if (String(previous.status || "") !== String(player.status || "")) {
        markTransientClass(seatNode, "seat-status-change", 560);
      }
    }

    refs.seatsLayer.appendChild(seatNode);
  }
}

function renderLegacyPlayers(players, currentPlayerId) {
  refs.playersList.innerHTML = "";

  ensureArray(players).forEach((player) => {
    const line = document.createElement("li");
    const parts = [];
    if (player.id === currentPlayerId) {
      parts.push(">>");
    }
    parts.push(`${player.name || "玩家"}(${player.id || "-"})`);
    parts.push(`seat ${Number(player.seat)}`);
    parts.push(`stack ${Number(player.stack)}`);
    parts.push(`bet ${Number(player.bet)}`);
    parts.push(normalizeStatus(player.status));
    if (player.heat_warning) {
      parts.push("suspicious");
    }
    if (ensureArray(player.hand).length > 0) {
      parts.push(`hand ${ensureArray(player.hand).join(", ")}`);
    }
    line.textContent = parts.join(" | ");
    refs.playersList.appendChild(line);
  });
}

function renderSkills(skills) {
  refs.skillButtons.innerHTML = "";
  const safeSkills = ensureArray(skills);

  let firstActionableSkill = "";
  let fallbackSkill = "";
  safeSkills.forEach((skill) => {
    const skillId = String(skill.id || "");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.skillId = skillId;
    button.textContent = `${displaySkillName(skill)} +${Number(skill.cost || 0)}`;

    if (!fallbackSkill) {
      fallbackSkill = skillId;
    }
    if (!firstActionableSkill && !isSkillPassive(skillId)) {
      const canUseLater = evaluateSkillAvailability(skillId, {
        ignoreTargetSelection: true,
      }).canUse;
      if (canUseLater) {
        firstActionableSkill = skillId;
      }
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      appState.selectedSkillId = skillId;
      updateSkillControls();
    });

    if (skillId === appState.selectedSkillId) {
      button.classList.add("is-selected");
    }

    refs.skillButtons.appendChild(button);
  });

  if (!appState.selectedSkillId || !safeSkills.some((skill) => String(skill.id || "") === appState.selectedSkillId)) {
    appState.selectedSkillId = firstActionableSkill || fallbackSkill;
  }

  if (safeSkills.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "当前无技能";
    refs.skillButtons.appendChild(empty);
  }
}

function renderTargets(players) {
  const selectedValue = refs.targetSelect.value || "";
  refs.targetSelect.innerHTML = "";
  refs.targetSelect.appendChild(new Option("目标玩家", ""));
  appState.targetIds = [];

  ensureArray(players).forEach((player) => {
    if (player.id === appState.playerId) {
      return;
    }

    const status = normalizeStatus(player.status);
    if (status === "folded" || status === "out") {
      return;
    }

    refs.targetSelect.appendChild(new Option(`${player.name || "玩家"} (${shortId(player.id)})`, player.id));
    appState.targetIds.push(player.id);
  });

  if (selectedValue && appState.targetIds.includes(selectedValue)) {
    refs.targetSelect.value = selectedValue;
  } else if (appState.targetIds.length > 0) {
    refs.targetSelect.value = appState.targetIds[0];
  }
}

function updateActionArea() {
  const validActions = ensureArray(appState.actionReq.valid_actions);
  const toCall = Number(appState.actionReq.to_call || 0);
  const minRaise = Number(appState.actionReq.min_raise || 0);

  refs.toCallText.textContent = `需跟注: ${toCall}`;
  refs.minRaiseText.textContent = `最小加注: ${minRaise}`;

  if (validActions.includes("raise")) {
    refs.raiseInput.value = String(myCurrentBet() + toCall + minRaise);
  }

  const isMyTurn = Boolean(appState.lastState.current_player && appState.lastState.current_player === appState.playerId);

  refs.foldButton.disabled = !(isMyTurn && validActions.includes("fold"));
  refs.checkButton.disabled = !(isMyTurn && validActions.includes("check"));
  refs.callButton.disabled = !(isMyTurn && validActions.includes("call"));
  refs.raiseButton.disabled = !(isMyTurn && validActions.includes("raise"));
  refs.allInButton.disabled = !(isMyTurn && validActions.includes("all_in"));
}

function updateSkillControls() {
  const currentSkill = appState.selectedSkillId || "";
  refs.selectedSkillText.textContent = `已选技能: ${currentSkill ? displaySkillName({ id: currentSkill }) : "-"}`;
  if (refs.skillDescriptionText) {
    refs.skillDescriptionText.textContent = `技能说明: ${skillDescription(currentSkill)}`;
  }

  const buttons = refs.skillButtons.querySelectorAll("button");
  buttons.forEach((button) => {
    const skillId = button.dataset.skillId || "";
    const availability = evaluateSkillAvailability(skillId, {
      ignoreTargetSelection: true,
    });
    button.classList.toggle("is-selected", skillId === currentSkill);
    button.classList.toggle("is-unavailable", !availability.canUse);
    button.setAttribute("title", availability.reason);
  });

  const availability = evaluateSkillAvailability(currentSkill);
  const needTarget = availability.needTarget;
  const needCardIndex = availability.needCardIndex;

  refs.targetSelect.style.display = needTarget ? "block" : "none";
  refs.cardIdxSelect.style.display = needCardIndex ? "block" : "none";
  if (refs.skillHintText) {
    refs.skillHintText.textContent = `可用性: ${availability.reason}`;
    refs.skillHintText.dataset.kind = availability.canUse ? "ok" : "warn";
  }
  refs.useSkillButton.disabled = !availability.canUse;
}

function myCurrentBet() {
  const me = ensureArray(appState.lastState.players).find((player) => player.id === appState.playerId);
  return Number(me?.bet || 0);
}

function isConnected() {
  return appState.ws && appState.ws.readyState === WebSocket.OPEN;
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
    if (ws.readyState !== WebSocket.CONNECTING) {
      resolve(false);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(false);
    }, timeoutMs);

    ws.addEventListener("open", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(true);
    }, { once: true });

    ws.addEventListener("error", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(false);
    }, { once: true });

    ws.addEventListener("close", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(false);
    }, { once: true });
  });
}

function disconnectSocket() {
  return new Promise((resolve) => {
    const ws = appState.ws;
    if (!ws) {
      resolve();
      return;
    }
    if (ws.readyState === WebSocket.CLOSED) {
      appState.ws = null;
      resolve();
      return;
    }
    if (ws.readyState === WebSocket.CLOSING) {
      ws.addEventListener("close", () => {
        if (appState.ws === ws) {
          appState.ws = null;
        }
        resolve();
      }, { once: true });
      return;
    }
    ws.addEventListener("close", () => {
      if (appState.ws === ws) {
        appState.ws = null;
      }
      resolve();
    }, { once: true });
    try {
      ws.close(1000, "reconnect for fresh join");
    } catch (_err) {
      if (appState.ws === ws) {
        appState.ws = null;
      }
      resolve();
    }
  });
}

function setStatus(text, isError) {
  appState.connectionStatus = String(text || "");
  const composed = `状态: ${text}`;
  refs.statusText.textContent = composed;
  refs.statusMirror.textContent = composed;
  refs.statusText.dataset.kind = isError ? "error" : "ok";
  refs.statusMirror.dataset.kind = isError ? "error" : "ok";
}

function clearIdentity() {
  appState.playerId = "";
  appState.playerName = "";
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(PLAYER_NAME_KEY);
}

async function switchToNewIdentity() {
  if (appState.joining) {
    return;
  }
  appState.joining = true;
  try {
    await disconnectSocket();
    clearIdentity();
    refs.joinButton.disabled = true;
    setStatus("已切换新玩家，请先连接再加入", false);
  } finally {
    appState.joining = false;
  }
}

function normalizeState(rawState) {
  return {
    phase: String(rawState?.phase || ""),
    total_pot: Number(rawState?.total_pot || 0),
    community_cards: ensureArray(rawState?.community_cards).map((card) => String(card)),
    my_hand: ensureArray(rawState?.my_hand).map((card) => String(card)),
    my_skills: ensureArray(rawState?.my_skills).map((skill) => ({
      id: String(skill?.id || ""),
      name: String(skill?.name || ""),
      cost: Number(skill?.cost || 0),
    })),
    my_heat: Number(rawState?.my_heat || 0),
    current_player: String(rawState?.current_player || ""),
    players: ensureArray(rawState?.players).map((player) => ({
      id: String(player?.id || ""),
      name: String(player?.name || ""),
      seat: Number(player?.seat || 0),
      stack: Number(player?.stack || 0),
      bet: Number(player?.bet || 0),
      status: String(player?.status || "active"),
      heat_warning: Boolean(player?.heat_warning),
      hand: ensureArray(player?.hand).map((card) => String(card)),
    })),
  };
}

function normalizeActionReq(rawReq) {
  return {
    player_id: String(rawReq?.player_id || ""),
    valid_actions: ensureArray(rawReq?.valid_actions).map((action) => String(action || "")),
    to_call: Number(rawReq?.to_call || 0),
    min_raise: Number(rawReq?.min_raise || 0),
    max_raise: Number(rawReq?.max_raise || 0),
    can_use_skill: rawReq?.can_use_skill !== false,
    timeout_sec: Number(rawReq?.timeout_sec || 0),
  };
}

function createCardElement(cardCode, options = {}) {
  const { mini = false, back = false, animate = false } = options;
  const node = document.createElement("div");
  node.className = `poker-card${mini ? " mini" : ""}`;

  if (back) {
    node.classList.add("is-back");
    return node;
  }

  const parsed = parseCardCode(cardCode);
  if (!parsed) {
    node.classList.add("is-back");
    return node;
  }

  if (parsed.red) {
    node.classList.add("is-red");
  }

  if (animate) {
    node.classList.add("card-enter");
  }

  const rankTop = document.createElement("span");
  rankTop.className = "rank";
  rankTop.textContent = parsed.rank;

  const suit = document.createElement("span");
  suit.className = "suit";
  suit.textContent = parsed.symbol;

  const rankBottom = document.createElement("span");
  rankBottom.className = "rank-bottom";
  rankBottom.textContent = parsed.rank;

  node.appendChild(rankTop);
  node.appendChild(suit);
  node.appendChild(rankBottom);

  return node;
}

function parseCardCode(cardCode) {
  if (typeof cardCode !== "string") {
    return null;
  }

  const value = cardCode.trim().toUpperCase();
  if (value.length < 2) {
    return null;
  }

  const suitCode = value.slice(-1);
  const rankCode = value.slice(0, -1);
  const suitMeta = SUIT_META[suitCode];
  if (!suitMeta) {
    return null;
  }

  const rankMap = {
    A: "A",
    K: "K",
    Q: "Q",
    J: "J",
    T: "10",
  };

  let rank = rankMap[rankCode] || rankCode;
  if (rankCode === "10") {
    rank = "10";
  }

  if (!/^([2-9]|10|A|K|Q|J)$/.test(rank)) {
    return null;
  }

  return {
    rank,
    symbol: suitMeta.symbol,
    red: suitMeta.red,
  };
}

function displayPhase(phase) {
  const normalized = String(phase || "").toLowerCase();
  return PHASE_LABELS[normalized] || normalized || "-";
}

function displaySkillName(skillLike) {
  const skillId = String(skillLike?.id || skillLike?.skill_id || "");
  if (skillId && SKILL_META[skillId]?.name) {
    return SKILL_META[skillId].name;
  }

  const originalName = String(skillLike?.name || "");
  if (originalName) {
    return originalName;
  }

  return skillId || "未知技能";
}

function displayPlayerName(playerId, players) {
  const target = ensureArray(players).find((player) => player.id === playerId);
  if (target) {
    return `${target.name || "玩家"} (${shortId(target.id)})`;
  }
  return shortId(playerId) || "-";
}

function shortId(id) {
  const text = String(id || "");
  if (!text) {
    return "-";
  }
  if (text.length <= 8) {
    return text;
  }
  return `${text.slice(0, 6)}...`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function relativeSeatIndex(seat, anchorSeat) {
  const seatNumber = Number(seat);
  const anchorSeatNumber = Number(anchorSeat);
  if (!Number.isFinite(seatNumber) || !Number.isFinite(anchorSeatNumber)) {
    return 0;
  }
  return ((seatNumber - anchorSeatNumber) % 6 + 6) % 6;
}

function resolveAnchorPlayer(players) {
  const me = ensureArray(players).find((player) => player.id === appState.playerId);
  if (me) {
    return me;
  }
  return players[0] || null;
}

function buildSeatLayoutByPlayer(players) {
  const sortedPlayers = ensureArray(players).slice().sort((a, b) => Number(a.seat) - Number(b.seat));
  const seatLayoutByPlayer = new Map();
  if (sortedPlayers.length === 0) {
    return seatLayoutByPlayer;
  }

  const anchorPlayer = resolveAnchorPlayer(sortedPlayers);
  if (!anchorPlayer) {
    return seatLayoutByPlayer;
  }
  seatLayoutByPlayer.set(anchorPlayer.id, SEAT_SLOTS.bottom);

  const others = sortedPlayers
    .filter((player) => player.id !== anchorPlayer.id)
    .sort((a, b) => relativeSeatIndex(a.seat, anchorPlayer.seat) - relativeSeatIndex(b.seat, anchorPlayer.seat));
  const otherSlotKeys = OTHER_SEAT_SLOTS_BY_COUNT[Math.min(5, others.length)] || OTHER_SEAT_SLOTS_BY_COUNT[5];

  others.forEach((player, index) => {
    const slotKey = otherSlotKeys[index] || "top";
    seatLayoutByPlayer.set(player.id, SEAT_SLOTS[slotKey] || SEAT_SLOTS.top);
  });

  return seatLayoutByPlayer;
}

function isSkillPassive(skillId) {
  return Boolean(SKILL_META[String(skillId || "")]?.passive);
}

function skillDescription(skillId) {
  const id = String(skillId || "");
  if (!id) {
    return "请选择技能查看效果与使用条件。";
  }
  if (SKILL_META[id]?.description) {
    return SKILL_META[id].description;
  }
  return `技能 ${id} 暂无说明。`;
}

function isActionPhase(phase) {
  const value = String(phase || "").toLowerCase();
  return value === "preflop" || value === "flop" || value === "turn" || value === "river";
}

function evaluateSkillAvailability(skillId, options = {}) {
  const { ignoreTargetSelection = false } = options;
  const id = String(skillId || "");
  const needTarget = id === "peek";
  const needCardIndex = id === "swap";

  if (!id) {
    return {
      canUse: false,
      reason: "请选择要使用的技能。",
      needTarget,
      needCardIndex,
    };
  }

  if (isSkillPassive(id)) {
    return {
      canUse: false,
      reason: "该技能为被动技能，不能主动施放。",
      needTarget,
      needCardIndex,
    };
  }

  if (!isActionPhase(appState.lastState.phase)) {
    return {
      canUse: false,
      reason: "当前不在可行动阶段。",
      needTarget,
      needCardIndex,
    };
  }

  const isMyTurn = Boolean(appState.lastState.current_player && appState.lastState.current_player === appState.playerId);
  if (!isMyTurn) {
    return {
      canUse: false,
      reason: "仅可在你的行动回合使用技能。",
      needTarget,
      needCardIndex,
    };
  }

  if (appState.actionReq.can_use_skill === false) {
    return {
      canUse: false,
      reason: "本回合技能不可用（可能已使用或怀疑值过高）。",
      needTarget,
      needCardIndex,
    };
  }

  if (id === "mist" && ensureArray(appState.lastState.community_cards).length === 0) {
    return {
      canUse: false,
      reason: "迷雾需要至少 1 张公共牌（翻牌后）。",
      needTarget,
      needCardIndex,
    };
  }

  if (id === "swap" && ensureArray(appState.lastState.my_hand).length === 0) {
    return {
      canUse: false,
      reason: "你当前没有可替换的手牌。",
      needTarget,
      needCardIndex,
    };
  }

  if (needTarget) {
    if (appState.targetIds.length === 0) {
      return {
        canUse: false,
        reason: "当前没有可窥视的目标玩家。",
        needTarget,
        needCardIndex,
      };
    }
    if (!ignoreTargetSelection && refs.targetSelect.selectedIndex <= 0) {
      return {
        canUse: false,
        reason: "请选择要窥视的目标玩家。",
        needTarget,
        needCardIndex,
      };
    }
  }

  return {
    canUse: true,
    reason: "可立即使用。",
    needTarget,
    needCardIndex,
  };
}

function friendlyServerError(errorText) {
  const raw = String(errorText || "").trim();
  if (!raw) {
    return "未知错误";
  }
  const normalized = raw.toLowerCase();
  const mapped = SERVER_ERROR_MAP[normalized];
  if (mapped) {
    return mapped;
  }
  if (appState.lastSentType === "skill" && appState.lastSkillAttempt) {
    return `${raw}（技能: ${displaySkillName({ id: appState.lastSkillAttempt })}）`;
  }
  return raw;
}

function normalizeStatus(status) {
  const value = String(status || "active").toLowerCase();
  if (value === "allin") {
    return "all_in";
  }
  return value;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "未知";
}

function shouldRenderHiddenCards(status, playerId) {
  if (!playerId || playerId === appState.playerId) {
    return false;
  }
  return status === "active" || status === "all_in";
}

function makeChip(text, extraClass = "") {
  const chip = document.createElement("span");
  chip.className = `meta-chip${extraClass ? ` ${extraClass}` : ""}`;
  chip.textContent = text;
  return chip;
}

function markTransientClass(node, className, durationMs) {
  if (!node) {
    return;
  }

  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);

  scheduleUiTask(durationMs, () => {
    if (node && node.classList) {
      node.classList.remove(className);
    }
  });
}

function scheduleUiTask(durationMs, callback) {
  uiTimers.push({ remaining: Math.max(0, Number(durationMs) || 0), callback });
}

function stepUiTimers(deltaMs) {
  for (let index = uiTimers.length - 1; index >= 0; index -= 1) {
    const task = uiTimers[index];
    task.remaining -= deltaMs;
    if (task.remaining > 0) {
      continue;
    }

    uiTimers.splice(index, 1);
    try {
      task.callback();
    } catch (_err) {
      // Ignore UI timer callback errors to avoid breaking gameplay updates.
    }
  }
}

function advanceTime(ms) {
  const total = Math.max(0, Number(ms) || 0);
  if (total === 0) {
    return renderGameToText();
  }

  const loops = Math.max(1, Math.ceil(total / UI_TICK_MS));
  const step = total / loops;
  for (let index = 0; index < loops; index += 1) {
    stepUiTimers(step);
  }

  return renderGameToText();
}

function renderGameToText() {
  const players = ensureArray(appState.lastState.players).slice().sort((a, b) => a.seat - b.seat);
  const visiblePlayers = players.filter((player) => normalizeStatus(player.status) !== "out" || player.id === appState.playerId);
  const seatLayoutByPlayer = buildSeatLayoutByPlayer(visiblePlayers);

  const seats = visiblePlayers.map((player) => {
    const layout = seatLayoutByPlayer.get(player.id) || SEAT_SLOTS.bottom;
    return {
      id: player.id,
      name: player.name,
      seat: player.seat,
      status: normalizeStatus(player.status),
      stack: Number(player.stack || 0),
      bet: Number(player.bet || 0),
      heat_warning: Boolean(player.heat_warning),
      visible_hand: ensureArray(player.hand),
      layout_slot: layout.name,
      x: layout.x,
      y: layout.y,
    };
  });

  const payload = {
    coordinate_system: "origin at top-left; x grows right; y grows down; seat x/y are normalized 0..1 in seats-layer space.",
    connection_status: appState.connectionStatus,
    phase: appState.lastState.phase || "",
    current_player: appState.lastState.current_player || "",
    total_pot: Number(appState.lastState.total_pot || 0),
    my_heat: Number(appState.lastState.my_heat || 0),
    community_cards: ensureArray(appState.lastState.community_cards),
    my_hand: ensureArray(appState.lastState.my_hand),
    my_skills: ensureArray(appState.lastState.my_skills).map((skill) => ({
      id: skill.id,
      name: displaySkillName(skill),
      cost: Number(skill.cost || 0),
    })),
    action_request: {
      valid_actions: ensureArray(appState.actionReq.valid_actions),
      to_call: Number(appState.actionReq.to_call || 0),
      min_raise: Number(appState.actionReq.min_raise || 0),
      max_raise: Number(appState.actionReq.max_raise || 0),
      can_use_skill: appState.actionReq.can_use_skill !== false,
    },
    selected_skill: appState.selectedSkillId || "",
    selected_skill_availability: evaluateSkillAvailability(appState.selectedSkillId || ""),
    target_options: appState.targetIds.slice(),
    seats,
    controls: {
      can_connect: !refs.connectButton.disabled,
      can_join: !refs.joinButton.disabled,
      fold_enabled: !refs.foldButton.disabled,
      check_enabled: !refs.checkButton.disabled,
      call_enabled: !refs.callButton.disabled,
      raise_enabled: !refs.raiseButton.disabled,
      all_in_enabled: !refs.allInButton.disabled,
      use_skill_enabled: !refs.useSkillButton.disabled,
    },
  };

  return JSON.stringify(payload);
}
