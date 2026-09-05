/**
 * DirtyPlay 端到端回归测试
 * 覆盖测试方案中的大厅、等待室、开局、行动、重连、断线代行、响应式与调试导出关键场景。
 */
import fs from "node:fs";
import path from "node:path";

const PAGE_URL = process.env.DIRTYPLAY_URL || "http://127.0.0.1:8080";
const OUTPUT_DIR = path.resolve("output/playwright/full-test");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE_PORTRAIT = { width: 375, height: 812 };
const MOBILE_LANDSCAPE = { width: 812, height: 375 };
const ONLY_TESTS = new Set((process.env.DIRTYPLAY_TEST_ONLY || "").split(",").map((name) => name.trim()).filter(Boolean));

let passCount = 0;
let failCount = 0;
const results = [];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pathToFileUrl(filePath) {
  const abs = path.resolve(filePath);
  return `file://${abs}`;
}

function record(name, passed, detail = "") {
  if (passed) {
    passCount += 1;
  } else {
    failCount += 1;
  }
  results.push({ name, passed, detail });
  const mark = passed ? "✓" : "✗";
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function shouldRun(testName) {
  return ONLY_TESTS.size === 0 || ONLY_TESTS.has(testName);
}

async function loadChromium() {
  try {
    const pkg = await import("playwright");
    return pkg.chromium;
  } catch (_err) {
    const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
    const fallback = path.join(codexHome, "skills/develop-web-game/node_modules/playwright/index.mjs");
    const pkg = await import(pathToFileUrl(fallback));
    return pkg.chromium;
  }
}

async function launchBrowser(chromium) {
  const launchArgs = { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] };
  try {
    return await chromium.launch(launchArgs);
  } catch (err) {
    if (!fs.existsSync(CHROME_PATH)) {
      throw err;
    }
    return chromium.launch({
      ...launchArgs,
      executablePath: CHROME_PATH,
    });
  }
}

async function screenshot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage: true, timeout: 5000 });
  } catch (err) {
    console.warn(`screenshot skipped: ${name}: ${err.message || err}`);
  }
}

async function gotoLobby(page) {
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("#createRoomBtn", { timeout: 5000 });
}

async function waitForState(page, predicate, timeoutMs = 15000) {
  await page.waitForFunction((predicateSource) => {
    try {
      const state = JSON.parse(window.render_game_to_text());
      const fn = new Function("state", `return (${predicateSource})(state);`);
      return Boolean(fn(state));
    } catch (_err) {
      return false;
    }
  }, String(predicate), { timeout: timeoutMs });
}

async function waitForGameStart(page, timeoutMs = 15000) {
  await waitForState(page, (state) => state.phase && state.phase !== "waiting", timeoutMs);
}

async function getSnapshot(page) {
  return page.evaluate(() => {
    const rawState = typeof window.render_game_to_text === "function" ? window.render_game_to_text() : "{}";
    let state;
    try {
      state = JSON.parse(rawState);
    } catch (_err) {
      state = {};
    }

    const text = (selector) => document.querySelector(selector)?.textContent?.trim() || "";
    const disabled = (selector) => {
      const node = document.querySelector(selector);
      return node ? Boolean(node.disabled) : true;
    };
    const visible = (selector) => {
      const node = document.querySelector(selector);
      if (!node) {
        return false;
      }
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      return node.offsetParent !== null || style.position === "fixed";
    };
    const actionLog = Array.from(document.querySelectorAll("#actionLogList li")).map((node) => node.textContent?.trim() || "");
    const skillButtons = Array.from(document.querySelectorAll("#skillButtons button")).map((node) => ({
      text: node.textContent?.trim() || "",
      disabled: Boolean(node.disabled),
      unavailable: node.classList.contains("is-unavailable"),
      selected: node.classList.contains("is-selected"),
    }));
    const opponentHiddenCards = document.querySelectorAll(".seat .poker-card.is-back").length;

    return {
      state,
      title: document.title,
      lobbyVisible: visible("#lobbyScreen"),
      gameVisible: visible("#gameScreen"),
      waitingVisible: visible("#waitingRoom"),
      createVisible: visible("#createRoomBtn"),
      joinVisible: visible("#joinRoomBtn"),
      addBotVisible: visible("#addBotBtn"),
      addBotEnabled: !disabled("#addBotBtn"),
      startGameVisible: visible("#startGameBtn"),
      startGameEnabled: !disabled("#startGameBtn"),
      foldEnabled: !disabled("#foldButton"),
      checkEnabled: !disabled("#checkButton"),
      callEnabled: !disabled("#callButton"),
      raiseEnabled: !disabled("#raiseButton"),
      allInEnabled: !disabled("#allInButton"),
      useSkillEnabled: !disabled("#useSkillButton"),
      targetVisible: visible("#targetSelect"),
      cardIdxVisible: visible("#cardIdxSelect"),
      lobbyError: text("#lobbyError"),
      statusText: text("#statusText"),
      phaseText: text("#phaseText"),
      turnText: text("#turnText"),
      potText: text("#potText"),
      mainPotText: text("#mainPotText"),
      sidePotsText: text("#sidePotsText"),
      heatText: text("#heatText"),
      communityText: text("#communityText"),
      handText: text("#handText"),
      waitingCode: text("#waitingCode"),
      roomCodeBadge: text("#roomCodeBadge"),
      waitingPlayerCount: text("#waitingPlayerCount"),
      skillsText: text("#skillsText"),
      skillHintText: text("#skillHintText"),
      minRaiseText: text("#minRaiseText"),
      maxRaiseText: text("#maxRaiseText"),
      raiseToText: text("#raiseToText"),
      raiseInputValue: document.querySelector("#raiseInput")?.value || "",
      lobbyNameValue: document.querySelector("#lobbyNameInput")?.value || "",
      roomCodeValue: document.querySelector("#roomCodeInput")?.value || "",
      handCardCount: document.querySelectorAll("#handCards .poker-card").length,
      communityCardCount: document.querySelectorAll("#communityCards .poker-card").length,
      seatCount: document.querySelectorAll(".seat").length,
      actionLog,
      skillButtons,
      opponentHiddenCards,
      orientationTipVisible: (() => {
        const node = document.querySelector(".orientation-tip");
        return Boolean(node) && getComputedStyle(node).display !== "none";
      })(),
      statusKind: document.querySelector("#statusText")?.dataset.kind || "",
    };
  });
}

async function createRoom(page, name = "") {
  await gotoLobby(page);
  await page.fill("#lobbyNameInput", name);
  await page.evaluate(() => {
    document.getElementById("createRoomBtn")?.click();
  });
  await page.waitForFunction(() => {
    const code = document.querySelector("#waitingCode")?.textContent?.trim() || "";
    return /^[A-Z0-9]{6}$/.test(code);
  }, null, { timeout: 15000 });
  return (await page.locator("#waitingCode").textContent()).trim();
}

async function joinRoomByCode(page, code, name = "") {
  await gotoLobby(page);
  await page.fill("#lobbyNameInput", name);
  await page.fill("#roomCodeInput", code);
  await page.evaluate(() => {
    document.getElementById("joinRoomBtn")?.click();
  });
  await page.waitForFunction(() => {
    const screen = document.getElementById("gameScreen");
    return Boolean(screen && screen.style.display !== "none");
  }, null, { timeout: 15000 });
}

async function addBots(page, count) {
  for (let index = 0; index < count; index += 1) {
    await page.evaluate(() => {
      document.getElementById("addBotBtn")?.click();
    });
    await page.waitForTimeout(150);
  }
}

async function startManualGame(page) {
  await page.waitForFunction(() => {
    const startButton = document.getElementById("startGameBtn");
    return Boolean(startButton && !startButton.disabled);
  }, null, { timeout: 15000 });
  await page.evaluate(() => {
    document.getElementById("startGameBtn")?.click();
  });
  await waitForGameStart(page, 15000);
}

async function waitForWaitingRoomReady(page, timeoutMs = 15000) {
  await page.waitForFunction(() => {
    const waitingRoom = document.getElementById("waitingRoom");
    const addBotBtn = document.getElementById("addBotBtn");
    if (!waitingRoom || !addBotBtn) {
      return false;
    }
    const waitingVisible = getComputedStyle(waitingRoom).display !== "none";
    return waitingVisible && !addBotBtn.disabled;
  }, null, { timeout: timeoutMs });
}

function currentPlayerSelf(snapshot) {
  const self = snapshot.state?.seats?.find((seat) => seat.layout_slot === "bottom") || null;
  if (!self) {
    return { self: null, isMyTurn: false };
  }
  return {
    self,
    isMyTurn: snapshot.state.current_player === self.id,
  };
}

async function waitForMyTurn(page, timeoutMs = 30000) {
  const start = Date.now();
  let lastSnapshot = await getSnapshot(page);
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await getSnapshot(page);
    const { isMyTurn } = currentPlayerSelf(lastSnapshot);
    if (isMyTurn) {
      return { gotTurn: true, snapshot: lastSnapshot };
    }
    await page.waitForTimeout(250);
  }
  return { gotTurn: false, snapshot: lastSnapshot };
}

async function installActionSendSpy(page) {
  await page.evaluate(() => {
    if (!window.__dirtyplaySendSpyInstalled) {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function patchedSend(data) {
        try {
          const message = JSON.parse(data);
          if (message.type === "action") {
            window.__dirtyplayActionSendCount = (window.__dirtyplayActionSendCount || 0) + 1;
          }
        } catch (_err) {
          // Ignore non-JSON frames.
        }
        return originalSend.call(this, data);
      };
      window.__dirtyplaySendSpyInstalled = true;
    }
    window.__dirtyplayActionSendCount = 0;
  });
}

async function getActionSendCount(page) {
  return page.evaluate(() => window.__dirtyplayActionSendCount || 0);
}

async function performProgressAction(page, snapshot) {
  if (snapshot.checkEnabled) {
    await page.click("#checkButton");
    return "check";
  }
  if (snapshot.callEnabled) {
    await page.click("#callButton");
    return "call";
  }
  if (snapshot.allInEnabled && !snapshot.foldEnabled) {
    await page.click("#allInButton");
    return "all_in";
  }
  if (snapshot.foldEnabled) {
    await page.click("#foldButton");
    return "fold";
  }
  return "";
}

async function playUntilHandAdvances(page, timeoutMs = 90000) {
  const start = Date.now();
  const seenPhases = new Set();
  let lastSnapshot = await getSnapshot(page);
  const firstHandSeq = Number(lastSnapshot.state.hand_seq || 0);
  const firstDealerSeat = Number(lastSnapshot.state.dealer_seat ?? -1);
  let sawShowdownVisibleCards = false;
  const phaseCardCounts = {};

  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await getSnapshot(page);
    const phase = String(lastSnapshot.state.phase || "");
    if (phase) {
      seenPhases.add(phase);
      if (phase === "flop" || phase === "turn" || phase === "river") {
        phaseCardCounts[phase] = lastSnapshot.communityCardCount;
      }
      if (phase === "showdown") {
        const visibleHands = (lastSnapshot.state.seats || []).filter((seat) => Array.isArray(seat.visible_hand) && seat.visible_hand.length > 0);
        if (visibleHands.length > 1) {
          sawShowdownVisibleCards = true;
        }
      }
    }

    if (Number(lastSnapshot.state.hand_seq || 0) > firstHandSeq && seenPhases.has("showdown")) {
      return {
        success: true,
        snapshot: lastSnapshot,
        seenPhases,
        phaseCardCounts,
        firstHandSeq,
        firstDealerSeat,
        sawShowdownVisibleCards,
      };
    }

    const { isMyTurn } = currentPlayerSelf(lastSnapshot);
    if (isMyTurn) {
      await performProgressAction(page, lastSnapshot);
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }

  return {
    success: false,
    snapshot: lastSnapshot,
    seenPhases,
    phaseCardCounts,
    firstHandSeq,
    firstDealerSeat,
    sawShowdownVisibleCards,
  };
}

async function testLobbyAndManualStart(browser) {
  console.log("\n=== 1. 大厅与手动开局 ===");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const pageErrors = [];
  const websockets = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("websocket", (ws) => websockets.push(ws.url()));

  try {
    await gotoLobby(page);
    let snap = await getSnapshot(page);

    record("TC01 页面正常加载", snap.createVisible && snap.joinVisible && snap.title.includes("DirtyPlay"), snap.title);
    record("TC02 初始连接状态为未连接", snap.statusText.includes("未连接"), snap.statusText);
    record("TC74 大厅调试导出开放 create/join", snap.state.controls?.can_connect && snap.state.controls?.can_join,
      JSON.stringify(snap.state.controls));

    const websocketCountBeforeShortJoin = websockets.length;
    await page.fill("#lobbyNameInput", "ShortCodeUser");
    await page.fill("#roomCodeInput", "abc");
    await page.evaluate(() => {
      document.getElementById("joinRoomBtn")?.click();
    });
    await page.waitForFunction(() => {
      const node = document.querySelector("#lobbyError");
      return Boolean(node && node.textContent && node.textContent.trim().length > 0);
    }, null, { timeout: 5000 });
    snap = await getSnapshot(page);
    record("TC03 短邀请码被前端拦截", /6\s*位.*邀请码/.test(snap.lobbyError) && snap.lobbyVisible && !snap.gameVisible && websockets.length === websocketCountBeforeShortJoin,
      `${snap.lobbyError}; ws=${websockets.length - websocketCountBeforeShortJoin}`);

    await page.fill("#lobbyNameInput", "InvalidCodeUser");
    await page.fill("#roomCodeInput", "ZZZZZZ");
    await page.evaluate(() => {
      document.getElementById("joinRoomBtn")?.click();
    });
    await page.waitForFunction(() => {
      const node = document.querySelector("#lobbyError");
      return Boolean(node && node.textContent && node.textContent.includes("邀请码无效"));
    }, null, { timeout: 5000 });
    snap = await getSnapshot(page);
    record("TC04 不存在的邀请码返回中文错误", snap.lobbyError.includes("邀请码无效"), snap.lobbyError);

    const code = await createRoom(page, "");
    snap = await getSnapshot(page);
    record("TC05 空昵称建房回退到服务端默认名称", Boolean((snap.state.seats || []).find((seat) => seat.layout_slot === "bottom")?.name), JSON.stringify(snap.state.seats));
    record("TC07 建房后等待室显示邀请码", snap.gameVisible && snap.waitingVisible && code.length === 6 && snap.waitingCode === code && snap.roomCodeBadge.endsWith(code),
      `badge=${snap.roomCodeBadge}, waiting=${snap.waitingCode}`);
    record("TC08 等待室人数提示正确", snap.waitingPlayerCount.includes("1") && snap.waitingPlayerCount.includes("6"), snap.waitingPlayerCount);
    record("TC09 等待室关键控件存在", snap.addBotVisible && snap.startGameVisible && snap.addBotEnabled && !snap.startGameEnabled,
      `addBot=${snap.addBotEnabled}, start=${snap.startGameEnabled}`);

    const errorCountBeforeCopy = pageErrors.length;
    await page.click("#copyCodeBtn");
    await page.waitForTimeout(150);
    record("TC10 复制邀请码按钮不产生 JS 错误", pageErrors.length === errorCountBeforeCopy, pageErrors.at(-1) || "");

    await addBots(page, 1);
    await page.waitForTimeout(1500);
    snap = await getSnapshot(page);
    record("TC12 添加 1 个 AI 后仍停留在等待室", snap.state.phase === "waiting" && snap.waitingVisible && snap.startGameEnabled && snap.addBotEnabled,
      `phase=${snap.state.phase}, start=${snap.startGameEnabled}`);

    await startManualGame(page);
    snap = await getSnapshot(page);
    record("TC11/TC12 手动开始后等待室隐藏", !snap.waitingVisible && !snap.addBotVisible, `waiting=${snap.waitingVisible}`);
    record("TC14 开局阶段与底池正确", snap.state.phase === "preflop" && snap.phaseText.includes("翻牌前") && snap.potText.includes("15"),
      `${snap.phaseText}; ${snap.potText}`);
    record("TC15/TC16 开局后发 2 张手牌并渲染 2 个座位", snap.handCardCount === 2 && Array.isArray(snap.state.my_hand) && snap.state.my_hand.length === 2 && snap.seatCount === 2,
      `hand=${JSON.stringify(snap.state.my_hand)} seats=${snap.seatCount}`);

    await page.click("#backToLobbyBtn");
    await page.waitForFunction(() => {
      const lobby = document.getElementById("lobbyScreen");
      const game = document.getElementById("gameScreen");
      return Boolean(lobby && game && lobby.style.display !== "none" && game.style.display === "none");
    }, null, { timeout: 5000 });
    snap = await getSnapshot(page);
    record("TC06 可从游戏返回大厅", snap.lobbyVisible && !snap.gameVisible && !snap.lobbyError, `lobby=${snap.lobbyVisible}`);

    await screenshot(page, "01-lobby-manual-start.png");
  } catch (err) {
    record("大厅与手动开局测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testHumanAutoStartAndJoining(browser) {
  console.log("\n=== 2. 双人自动开局与加入错误 ===");
  const hostContext = await browser.newContext({ viewport: DESKTOP });
  const guestContext = await browser.newContext({ viewport: DESKTOP });
  const lateContext = await browser.newContext({ viewport: DESKTOP });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const late = await lateContext.newPage();

  try {
    const code = await createRoom(host, "HostPlayer");
    await joinRoomByCode(guest, code, "GuestPlayer");
    await waitForGameStart(host, 15000);
    await waitForGameStart(guest, 15000);

    let hostSnap = await getSnapshot(host);
    let guestSnap = await getSnapshot(guest);
    record("TC13 两名真实玩家加入后自动开局", hostSnap.state.phase !== "waiting" && guestSnap.state.phase !== "waiting" && hostSnap.seatCount === 2 && guestSnap.seatCount === 2,
      `host=${hostSnap.state.phase}, guest=${guestSnap.state.phase}`);

    const hostSelf = (hostSnap.state.seats || []).find((seat) => seat.layout_slot === "bottom");
    const guestSelf = (guestSnap.state.seats || []).find((seat) => seat.layout_slot === "bottom");
    const nonTurnPage = hostSnap.state.current_player === hostSelf?.id ? guest : host;
    await nonTurnPage.evaluate(() => {
      if (typeof sendAction === "function") {
        sendAction("fold");
      }
    });
    await nonTurnPage.waitForFunction(() => {
      const node = document.querySelector("#statusText");
      return Boolean(node && node.textContent && node.textContent.includes("还没轮到你行动"));
    }, null, { timeout: 5000 });
    const errorSnap = await getSnapshot(nonTurnPage);
    record("TC68 非自己回合的错误消息已中文化", errorSnap.statusText.includes("还没轮到你行动"), errorSnap.statusText);

    const beforeLateJoin = await getSnapshot(host);
    const beforeHand = JSON.stringify(beforeLateJoin.state.my_hand || []);
    await joinRoomByCode(late, code, "LateJoin");
    await late.waitForTimeout(800);
    hostSnap = await getSnapshot(host);
    record("TC64 牌局中晚加入不影响现有玩家状态", hostSnap.state.phase === beforeLateJoin.state.phase
      && JSON.stringify(hostSnap.state.my_hand || []) === beforeHand
      && Number(hostSnap.state.player_count || 0) === 3,
    `phase=${hostSnap.state.phase}, players=${hostSnap.state.player_count}`);

    await screenshot(host, "02-human-auto-start.png");
  } catch (err) {
    record("双人自动开局与加入错误测试异常", false, String(err));
  } finally {
    await lateContext.close();
    await guestContext.close();
    await hostContext.close();
  }
}

async function testRoomFull(browser) {
  console.log("\n=== 3. 房满与等待室上限 ===");
  const hostContext = await browser.newContext({ viewport: DESKTOP });
  const guestContext = await browser.newContext({ viewport: DESKTOP });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    const code = await createRoom(host, "FullHost");
    await waitForWaitingRoomReady(host);
    await addBots(host, 5);
    await host.waitForFunction(() => {
      try {
        const state = JSON.parse(window.render_game_to_text());
        return Number(state.player_count || 0) === 6;
      } catch (_err) {
        return false;
      }
    }, null, { timeout: 5000 });

    const hostSnap = await getSnapshot(host);
    record("TC17 等待室最多允许 6 人且第 7 个 AI 按钮禁用", hostSnap.state.phase === "waiting" && Number(hostSnap.state.player_count || 0) === 6 && !hostSnap.addBotEnabled && hostSnap.startGameEnabled,
      `players=${hostSnap.state.player_count}, addBot=${hostSnap.addBotEnabled}`);

    await gotoLobby(guest);
    await guest.fill("#lobbyNameInput", "OverflowGuest");
    await guest.fill("#roomCodeInput", code.toLowerCase());
    const roomCodeValue = await guest.inputValue("#roomCodeInput");
    await guest.evaluate(() => {
      document.getElementById("joinRoomBtn")?.click();
    });
    await guest.waitForFunction(() => {
      const node = document.querySelector("#lobbyError");
      return Boolean(node && node.textContent && node.textContent.trim().length > 0);
    }, null, { timeout: 5000 });
    const guestSnap = await getSnapshot(guest);
    record("TC66/TC69 房满错误中文化且邀请码自动大写", roomCodeValue === code && guestSnap.lobbyError.includes("房间已满"),
      `${roomCodeValue}; ${guestSnap.lobbyError}`);

    await screenshot(host, "03-room-full.png");
  } catch (err) {
    record("房满与等待室上限测试异常", false, String(err));
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
}

async function testActionFlow(browser) {
  console.log("\n=== 4. 行动控制与防重复点击 ===");

  {
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    try {
      await createRoom(page, "ActionHost");
      await waitForWaitingRoomReady(page);
      await addBots(page, 1);
      await page.waitForTimeout(500);
      await startManualGame(page);

      const turn = await waitForMyTurn(page, 20000);
      record("TC18 等到玩家回合后按钮启用", turn.gotTurn, `phase=${turn.snapshot.state.phase}`);
      if (turn.gotTurn) {
        const before = turn.snapshot;
        const expectedRaiseTo = Number(before.state.action_request.to_call || 0)
          + Number(before.state.action_request.min_raise || 0)
          + Number((before.state.seats || []).find((seat) => seat.layout_slot === "bottom")?.bet || 0);
        record("TC19/TC29 行动按钮与 valid_actions、最小加注预填一致",
          before.foldEnabled && before.callEnabled && !before.checkEnabled && Number(before.raiseInputValue || 0) === expectedRaiseTo,
          JSON.stringify(before.state.action_request));

        await installActionSendSpy(page);
        await page.evaluate(() => {
          const button = document.getElementById("foldButton");
          if (button) {
            button.click();
            button.click();
            button.click();
          }
        });

        await page.waitForTimeout(1200);
        const after = await getSnapshot(page);
        const sendCount = await getActionSendCount(page);
        const selfSeat = (after.state.seats || []).find((seat) => seat.layout_slot === "bottom");
        const noLongerMyTurn = !selfSeat || after.state.current_player !== selfSeat.id;
        record("TC20/TC27/TC28 Fold 后状态推进并写入日志", (selfSeat?.status === "folded" || noLongerMyTurn) && after.actionLog.length > before.actionLog.length,
          `status=${selfSeat?.status || "-"} log=${after.actionLog.length}`);
        record("TC30/TC70 发送行动后立即禁用并只发出 1 次 action", sendCount === 1 && !after.foldEnabled && !after.callEnabled,
          `sendCount=${sendCount}`);
      }
      await screenshot(page, "04-action-fold.png");
    } catch (err) {
      record("Fold 行动与防重复测试异常", false, String(err));
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    try {
      await createRoom(page, "CallHost");
      await waitForWaitingRoomReady(page);
      await addBots(page, 1);
      await page.waitForTimeout(500);
      await startManualGame(page);

      const turn = await waitForMyTurn(page, 20000);
      if (!turn.gotTurn) {
        record("TC21/TC22/TC76 前置拿到自己回合", false, "did not get turn");
      } else {
        const before = turn.snapshot;
        const beforePot = Number(before.state.total_pot || 0);
        const toCall = Number(before.state.action_request.to_call || 0);
        const beforeLog = before.actionLog.length;
        await page.click("#callButton");
        await page.waitForTimeout(1500);
        const after = await getSnapshot(page);
        const controlsMatch = after.state.controls?.fold_enabled === after.foldEnabled
          && after.state.controls?.check_enabled === after.checkEnabled
          && after.state.controls?.call_enabled === after.callEnabled;
        record("TC21/TC22 Call 后底池增加且牌局推进", Number(after.state.total_pot || 0) >= beforePot + toCall
          && (after.state.phase === "flop" || after.actionLog.length > beforeLog),
        `before=${beforePot}, after=${after.state.total_pot}, phase=${after.state.phase}`);
        record("TC76 调试导出按钮状态与 DOM 一致", controlsMatch, JSON.stringify(after.state.controls));
      }
      await screenshot(page, "05-action-call.png");
    } catch (err) {
      record("Call 行动与调试导出一致性测试异常", false, String(err));
    } finally {
      await context.close();
    }
  }
}

async function testSkillAndDebugExport(browser) {
  console.log("\n=== 5. 技能面板与调试导出 ===");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();

  try {
    await gotoLobby(page);
    let snap = await getSnapshot(page);
    record("TC71/TC74 桌面大厅可见且 lobby 导出可用", snap.createVisible && snap.joinVisible && snap.state.controls?.create_room_enabled && snap.state.phase === "",
      JSON.stringify(snap.state.controls));

    const code = await createRoom(page, "SkillHost");
    await waitForWaitingRoomReady(page);
    await addBots(page, 1);
    await page.waitForTimeout(500);
    await startManualGame(page);
    await page.waitForFunction(() => {
      const mainPot = document.querySelector("#mainPotText");
      return Boolean(mainPot && mainPot.textContent && mainPot.textContent.includes("15"));
    }, null, { timeout: 5000 });
    snap = await getSnapshot(page);

    const recentActions = snap.state.recent_actions || [];
    const blindActions = recentActions.filter((entry) => entry.action === "blind_sb" || entry.action === "blind_bb");
    const selfSeat = (snap.state.seats || []).find((seat) => seat.layout_slot === "bottom");
    const otherSeats = (snap.state.seats || []).filter((seat) => seat.id !== selfSeat?.id);
    const hiddenCardsOkay = otherSeats.length > 0 && snap.opponentHiddenCards >= 2;
    const recentActionShape = recentActions.length >= 2
      && recentActions.every((entry) => typeof entry.player_name === "string" && typeof entry.phase === "string" && typeof entry.action === "string" && typeof entry.amount === "number");
    const seatLayoutOkay = Boolean(selfSeat && selfSeat.x >= 0 && selfSeat.x <= 1 && selfSeat.y >= 0 && selfSeat.y <= 1);

    record("TC35 技能面板显示至少 1 个技能", snap.skillButtons.length >= 1 && snap.skillsText.includes("技能:"), snap.skillsText);
    record("TC48/TC53 初始底池与盲注日志正确", snap.potText.includes("15") && snap.mainPotText.includes("15") && blindActions.length >= 2,
      `${snap.potText}; blindLogs=${blindActions.length}`);
    record("TC50 对手手牌以背面渲染", hiddenCardsOkay, `hidden=${snap.opponentHiddenCards}`);
    record("TC75/TC77/TC78 游戏态导出含房间控制关闭、庄位与最近行动结构", snap.state.controls?.create_room_enabled === false
      && typeof snap.state.dealer_seat === "number"
      && seatLayoutOkay
      && recentActionShape
      && snap.waitingCode === code && snap.roomCodeBadge.endsWith(code),
    `dealer=${snap.state.dealer_seat}, code=${snap.roomCodeBadge}`);

    await screenshot(page, "06-skill-debug.png");
  } catch (err) {
    record("技能面板与调试导出测试异常", false, err?.stack || String(err));
  } finally {
    await context.close();
  }
}

async function testReconnect(browser) {
  console.log("\n=== 6. 刷新重连 ===");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();

  try {
    const code = await createRoom(page, "ReconnectHost");
    await waitForWaitingRoomReady(page);
    await addBots(page, 1);
    await page.waitForTimeout(500);
    await startManualGame(page);

    const turn = await waitForMyTurn(page, 20000);
    if (!turn.gotTurn) {
      record("TC60-TC63 重连前需要拿到自己回合", false, "did not get turn");
      return;
    }

    const before = turn.snapshot;
    const playerIdBefore = await page.evaluate(() => localStorage.getItem("dirtyplay_player_id") || "");
    const handBefore = JSON.stringify(before.state.my_hand || []);
    const phaseBefore = before.state.phase;

    await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    await page.fill("#roomCodeInput", code);
    await page.evaluate(() => {
      document.getElementById("joinRoomBtn")?.click();
    });
    await page.waitForFunction(() => {
      try {
        const state = JSON.parse(window.render_game_to_text());
        return state.phase && state.phase !== "waiting" && Array.isArray(state.my_hand) && state.my_hand.length === 2;
      } catch (_err) {
        return false;
      }
    }, null, { timeout: 15000 });

    const after = await getSnapshot(page);
    const playerIdAfter = await page.evaluate(() => localStorage.getItem("dirtyplay_player_id") || "");
    let enabledAfterReconnect = after;
    const { self, isMyTurn } = currentPlayerSelf(after);
    if (isMyTurn) {
      await page.waitForFunction(() => {
        const fold = document.getElementById("foldButton");
        const call = document.getElementById("callButton");
        const check = document.getElementById("checkButton");
        return Boolean((fold && !fold.disabled) || (call && !call.disabled) || (check && !check.disabled));
      }, null, { timeout: 15000 });
      enabledAfterReconnect = await getSnapshot(page);
    }
    record("TC60/TC63 刷新后 localStorage 与 player_id 保持一致", playerIdBefore !== "" && playerIdBefore === playerIdAfter,
      `${playerIdBefore} -> ${playerIdAfter}`);
    record("TC61 重连后恢复原牌局阶段与手牌", enabledAfterReconnect.state.phase === phaseBefore
      && JSON.stringify(enabledAfterReconnect.state.my_hand || []) === handBefore,
    `${phaseBefore} -> ${enabledAfterReconnect.state.phase}`);
    record("TC62 重连后若仍轮到自己则行动按钮恢复启用", isMyTurn
      && (enabledAfterReconnect.foldEnabled || enabledAfterReconnect.callEnabled || enabledAfterReconnect.checkEnabled),
    `turn=${enabledAfterReconnect.state.current_player}, self=${self?.id || "-"}`);

    await screenshot(page, "07-reconnect.png");
  } catch (err) {
    record("刷新重连测试异常", false, err?.stack || String(err));
  } finally {
    await context.close();
  }
}

async function testDisconnectTimeout(browser) {
  console.log("\n=== 7. 断线代行 ===");
  const hostContext = await browser.newContext({ viewport: DESKTOP });
  const guestContext = await browser.newContext({ viewport: DESKTOP });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    const code = await createRoom(host, "TimeoutHost");
    await joinRoomByCode(guest, code, "TimeoutGuest");
    await waitForGameStart(host, 15000);
    await waitForGameStart(guest, 15000);

    const hostSnap = await getSnapshot(host);
    const guestSnap = await getSnapshot(guest);
    const hostSelf = (hostSnap.state.seats || []).find((seat) => seat.layout_slot === "bottom");
    const guestSelf = (guestSnap.state.seats || []).find((seat) => seat.layout_slot === "bottom");
    const actorPage = hostSnap.state.current_player === hostSelf?.id ? host : guest;
    const observerPage = actorPage === host ? guest : host;
    const before = await getSnapshot(observerPage);
    const startedAt = Date.now();

    await actorPage.evaluate(() => {
      if (typeof disconnectSocket === "function") {
        void disconnectSocket();
      }
    });

    await observerPage.waitForFunction((beforeRaw) => {
      try {
        const beforeState = JSON.parse(beforeRaw);
        const current = JSON.parse(window.render_game_to_text());
        return current.phase !== beforeState.phase
          || current.current_player !== beforeState.current_player
          || (current.recent_actions || []).length > (beforeState.recent_actions || []).length;
      } catch (_err) {
        return false;
      }
    }, JSON.stringify(before.state), { timeout: 12000 });

    const after = await getSnapshot(observerPage);
    const elapsedMs = Date.now() - startedAt;
    record("TC65 当前行动玩家断线后约 8 秒内由服务端代行并推进牌局", elapsedMs < 12000
      && (after.state.phase !== before.state.phase
        || after.state.current_player !== before.state.current_player
        || after.actionLog.length > before.actionLog.length),
    `elapsed=${elapsedMs}ms phase=${before.state.phase}->${after.state.phase}`);
  } catch (err) {
    record("断线代行测试异常", false, String(err));
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
}

async function testHandProgression(browser) {
  console.log("\n=== 8. 手牌完整流程 ===");
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();

  try {
    await createRoom(page, "FlowHost");
    await waitForWaitingRoomReady(page);
    await addBots(page, 5);
    await page.waitForTimeout(500);
    await startManualGame(page);

    const run = await playUntilHandAdvances(page, 90000);
    const dealerChanged = Number(run.snapshot.state.hand_seq || 0) > run.firstHandSeq
      && Number(run.snapshot.state.dealer_seat ?? -1) !== run.firstDealerSeat;
    const phases = Array.from(run.seenPhases);
    const phaseCoverage = ["preflop", "flop", "turn", "river", "showdown"].every((phase) => run.seenPhases.has(phase));
    const boardProgression = run.phaseCardCounts.flop === 3 && run.phaseCardCounts.turn === 4 && run.phaseCardCounts.river === 5;

    record("TC46/TC47/TC51/TC55 一个或多手牌内完整经过 preflop→showdown 且阶段牌数递增", run.success && phaseCoverage && boardProgression && run.sawShowdownVisibleCards,
      `phases=${phases.join(",")} cards=${JSON.stringify(run.phaseCardCounts)}`);
    record("TC56/TC57/TC59 摊牌后自动开新手且 hand_seq、dealer_seat 轮换", run.success && Number(run.snapshot.state.hand_seq || 0) > run.firstHandSeq && dealerChanged,
      `hand=${run.firstHandSeq}->${run.snapshot.state.hand_seq}, dealer=${run.firstDealerSeat}->${run.snapshot.state.dealer_seat}`);

    await screenshot(page, "08-hand-progression.png");
  } catch (err) {
    record("手牌完整流程测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testResponsive(browser) {
  console.log("\n=== 9. 响应式布局 ===");

  {
    const context = await browser.newContext({ viewport: DESKTOP });
    const page = await context.newPage();
    try {
      await gotoLobby(page);
      const snap = await getSnapshot(page);
      record("TC71 桌面端大厅按钮可见且无横屏提示", snap.createVisible && snap.joinVisible && !snap.orientationTipVisible,
        `orientation=${snap.orientationTipVisible}`);
      await screenshot(page, "09-desktop.png");
    } catch (err) {
      record("桌面布局测试异常", false, String(err));
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: MOBILE_PORTRAIT });
    const page = await context.newPage();
    try {
      await gotoLobby(page);
      const snap = await getSnapshot(page);
      const lobbyFitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      record("TC72 移动端竖屏自动适配且大厅可操作", snap.createVisible && snap.joinVisible && !snap.orientationTipVisible && lobbyFitsViewport,
        `orientation=${snap.orientationTipVisible}, fits=${lobbyFitsViewport}`);
      await screenshot(page, "10-mobile-portrait.png");

      await page.fill("#lobbyNameInput", "MobileTester");
      await page.click("#quickPlayBtn");
      await waitForGameStart(page, 15000);
      const tableLayout = await page.evaluate(() => {
        const table = document.querySelector(".table-surface")?.getBoundingClientRect();
        const seats = Array.from(document.querySelectorAll(".seat")).map((node) => node.getBoundingClientRect());
        if (!table || seats.length === 0) {
          return { fits: false, seatCount: seats.length };
        }
        const tolerance = 1;
        return {
          fits: document.documentElement.scrollWidth <= window.innerWidth + tolerance
            && table.left >= -tolerance
            && table.right <= window.innerWidth + tolerance
            && seats.every((seat) => seat.left >= table.left - tolerance && seat.right <= table.right + tolerance),
          seatCount: seats.length,
        };
      });
      record("TC72A 移动端竖屏牌桌与席位不横向溢出", tableLayout.fits && tableLayout.seatCount >= 2,
        `fits=${tableLayout.fits}, seats=${tableLayout.seatCount}`);
    } catch (err) {
      record("移动端竖屏测试异常", false, String(err));
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: MOBILE_LANDSCAPE });
    const page = await context.newPage();
    try {
      await gotoLobby(page);
      const snap = await getSnapshot(page);
      record("TC73 移动端横屏隐藏横屏提示", snap.createVisible && snap.joinVisible && !snap.orientationTipVisible,
        `orientation=${snap.orientationTipVisible}`);
      await screenshot(page, "11-mobile-landscape.png");
    } catch (err) {
      record("移动端横屏测试异常", false, String(err));
    } finally {
      await context.close();
    }
  }
}

async function main() {
  const validTests = new Set(["lobby", "auto_start", "room_full", "actions", "skills", "reconnect", "disconnect", "hand_flow", "responsive"]);
  const unknownTests = [...ONLY_TESTS].filter((name) => !validTests.has(name));
  if (unknownTests.length > 0) {
    throw new Error(`未知的 DIRTYPLAY_TEST_ONLY 场景: ${unknownTests.join(", ")}; 可用场景: ${[...validTests].join(", ")}`);
  }

  ensureDir(OUTPUT_DIR);
  console.log("\nDirtyPlay Playwright 回归测试");
  console.log(`URL: ${PAGE_URL}`);
  console.log(`输出目录: ${OUTPUT_DIR}\n`);

  const chromium = await loadChromium();
  const browser = await launchBrowser(chromium);

  try {
    if (shouldRun("lobby")) {
      await testLobbyAndManualStart(browser);
    }
    if (shouldRun("auto_start")) {
      await testHumanAutoStartAndJoining(browser);
    }
    if (shouldRun("room_full")) {
      await testRoomFull(browser);
    }
    if (shouldRun("actions")) {
      await testActionFlow(browser);
    }
    if (shouldRun("skills")) {
      await testSkillAndDebugExport(browser);
    }
    if (shouldRun("reconnect")) {
      await testReconnect(browser);
    }
    if (shouldRun("disconnect")) {
      await testDisconnectTimeout(browser);
    }
    if (shouldRun("hand_flow")) {
      await testHandProgression(browser);
    }
    if (shouldRun("responsive")) {
      await testResponsive(browser);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`测试完成: ${passCount} 通过, ${failCount} 失败, 共 ${passCount + failCount} 项`);
  console.log(`${"=".repeat(50)}`);

  if (failCount > 0) {
    console.log("\n失败项目:");
    for (const result of results) {
      if (!result.passed) {
        console.log(`  ✗ ${result.name}: ${result.detail}`);
      }
    }
  }

  const summary = {
    url: PAGE_URL,
    passCount,
    failCount,
    total: passCount + failCount,
    results,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "test-summary.json"), JSON.stringify(summary, null, 2));

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
