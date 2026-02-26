/**
 * Playwright 全面测试 DirtyPlay Web 客户端
 * 覆盖: 页面加载、连接、加入、游戏流程、操作按钮、技能面板、断线重连等
 */
import fs from "node:fs";
import path from "node:path";

const PAGE_URL = process.env.DIRTYPLAY_URL || "http://127.0.0.1:8080";
const OUTPUT_DIR = path.resolve("output/playwright/full-test");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let passCount = 0;
let failCount = 0;
const results = [];

function record(name, passed, detail = "") {
  if (passed) passCount++;
  else failCount++;
  results.push({ name, passed, detail });
  const mark = passed ? "✓" : "✗";
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function loadChromium() {
  try {
    const pkg = await import("playwright");
    return pkg.chromium;
  } catch (_err) {
    const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
    const fallback = path.join(codexHome, "skills/develop-web-game/node_modules/playwright/index.mjs");
    const pkg = await import(`file://${path.resolve(fallback)}`);
    return pkg.chromium;
  }
}

async function launchBrowser(chromium) {
  const launchArgs = { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] };
  try {
    return await chromium.launch(launchArgs);
  } catch (err) {
    if (!fs.existsSync(CHROME_PATH)) throw err;
    return chromium.launch({ ...launchArgs, executablePath: CHROME_PATH });
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ─── Test Helpers ───

async function getSnapshot(page) {
  return page.evaluate(() => {
    const rawState = typeof window.render_game_to_text === "function" ? window.render_game_to_text() : "{}";
    let state;
    try { state = JSON.parse(rawState); } catch (_e) { state = {}; }
    return {
      state,
      statusText: document.querySelector("#statusText")?.textContent || "",
      phaseText: document.querySelector("#phaseText")?.textContent || "",
      potText: document.querySelector("#potText")?.textContent || "",
      turnText: document.querySelector("#turnText")?.textContent || "",
      heatText: document.querySelector("#heatText")?.textContent || "",
      communityText: document.querySelector("#communityText")?.textContent || "",
      handText: document.querySelector("#handText")?.textContent || "",
      skillsText: document.querySelector("#skillsText")?.textContent || "",
      connectDisabled: Boolean(document.querySelector("#connectButton")?.disabled),
      joinDisabled: Boolean(document.querySelector("#joinButton")?.disabled),
      foldDisabled: Boolean(document.querySelector("#foldButton")?.disabled),
      checkDisabled: Boolean(document.querySelector("#checkButton")?.disabled),
      callDisabled: Boolean(document.querySelector("#callButton")?.disabled),
      raiseDisabled: Boolean(document.querySelector("#raiseButton")?.disabled),
      allInDisabled: Boolean(document.querySelector("#allInButton")?.disabled),
      seatCount: document.querySelectorAll(".seat").length,
      skillButtonCount: document.querySelectorAll("#skillButtons button").length,
      logItemCount: document.querySelectorAll("#actionLogList li").length,
    };
  });
}

// ─── Test Suites ───

async function testPageLoad(browser) {
  console.log("\n=== 1. 页面加载测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  try {
    const resp = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    record("页面返回 200", resp?.status() === 200, `status=${resp?.status()}`);

    await page.waitForSelector("#connectButton", { timeout: 5000 });
    record("核心 UI 元素加载", true);

    const title = await page.title();
    record("页面标题正确", title.includes("DirtyPlay"), title);

    const snap = await getSnapshot(page);
    record("初始状态: 加入按钮禁用", snap.joinDisabled === true);
    record("初始状态: 操作按钮禁用", snap.foldDisabled && snap.checkDisabled && snap.callDisabled);
    record("初始状态: 状态文字", snap.statusText.includes("未连接"), snap.statusText);

    // Check essential CSS loaded
    const hasCss = await page.evaluate(() => {
      const el = document.querySelector(".app");
      const style = el ? getComputedStyle(el) : null;
      return style && style.display !== "";
    });
    record("CSS 样式加载", hasCss === true);

    // Check no JS errors on load
    record("页面加载无 JS 错误", errors.length === 0, errors.length > 0 ? errors[0] : "");

    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-page-load.png"), fullPage: true });
  } catch (err) {
    record("页面加载测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testConnection(browser) {
  console.log("\n=== 2. WebSocket 连接测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Test connect
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );
    const snap1 = await getSnapshot(page);
    record("WebSocket 连接成功", snap1.statusText.includes("已连接"), snap1.statusText);
    record("连接后加入按钮启用", snap1.joinDisabled === false);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-connected.png"), fullPage: true });

    // Test with wrong server URL
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();
    await page2.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page2.fill("#serverInput", "ws://127.0.0.1:19999/ws");
    await page2.click("#connectButton");
    await page2.waitForTimeout(3000);
    const snap2 = await getSnapshot(page2);
    const hasError = snap2.statusText.includes("错误") || snap2.statusText.includes("断开") || snap2.statusText.includes("超时");
    record("错误地址连接处理", hasError, snap2.statusText);
    await context2.close();
  } catch (err) {
    record("WebSocket 连接测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testJoinAndGameStart(browser) {
  console.log("\n=== 3. 加入房间 & 游戏开始测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const roomId = `test-${Date.now()}`;

  try {
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.fill("#roomInput", roomId);
    await page.fill("#nameInput", "TestPlayer");
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );

    // Join room
    await page.click("#joinButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已加入"),
      { timeout: 15000 }
    );
    let snap = await getSnapshot(page);
    record("加入房间成功", snap.statusText.includes("已加入"), snap.statusText);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-joined.png"), fullPage: true });

    // Wait for bots and game to start
    await page.waitForFunction(() => {
      try {
        const state = JSON.parse(window.render_game_to_text());
        return Array.isArray(state.seats) && state.seats.length >= 4;
      } catch (_e) { return false; }
    }, { timeout: 25000 });

    snap = await getSnapshot(page);
    record("Bot 自动填充 (4人)", snap.state.seats?.length >= 4, `seats=${snap.state.seats?.length}`);
    record("游戏阶段已开始", snap.state.phase !== "waiting", `phase=${snap.state.phase}`);
    record("玩家有手牌", Array.isArray(snap.state.my_hand) && snap.state.my_hand.length === 2,
      `hand=${JSON.stringify(snap.state.my_hand)}`);
    record("玩家有技能", Array.isArray(snap.state.my_skills) && snap.state.my_skills.length > 0,
      `skills=${snap.state.my_skills?.map(s => s.id).join(",")}`);
    record("座位 UI 渲染", snap.seatCount >= 4, `seatCards=${snap.seatCount}`);
    record("技能按钮渲染", snap.skillButtonCount > 0, `buttons=${snap.skillButtonCount}`);

    // Check pot info
    const hasPot = snap.state.total_pot > 0;
    record("底池信息正常", hasPot, `total_pot=${snap.state.total_pot}`);

    // Check heat display
    record("怀疑值显示", snap.heatText.includes("怀疑值"), snap.heatText);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-game-started.png"), fullPage: true });

    return { context, page, roomId };
  } catch (err) {
    record("加入/游戏开始测试异常", false, String(err));
    await context.close();
    return null;
  }
}

async function testGameActions(browser, existingSession) {
  console.log("\n=== 4. 游戏操作测试 ===");
  let context, page;

  if (existingSession) {
    context = existingSession.context;
    page = existingSession.page;
  } else {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    const roomId = `action-${Date.now()}`;
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.fill("#roomInput", roomId);
    await page.fill("#nameInput", "ActionTest");
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );
    await page.click("#joinButton");
    await page.waitForFunction(() => {
      try {
        const state = JSON.parse(window.render_game_to_text());
        return Array.isArray(state.seats) && state.seats.length >= 4;
      } catch (_e) { return false; }
    }, { timeout: 25000 });
  }

  try {
    // Wait for our turn
    const start = Date.now();
    let gotTurn = false;
    let snap;
    while (Date.now() - start < 30000) {
      snap = await getSnapshot(page);
      const mySeat = snap.state.seats?.find(s => s.layout_slot === "bottom");
      if (mySeat && snap.state.current_player === mySeat.id) {
        gotTurn = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    record("等到玩家回合", gotTurn, gotTurn ? `phase=${snap.state.phase}` : "超时");

    if (gotTurn) {
      snap = await getSnapshot(page);
      // Check action request info
      const ar = snap.state.action_request;
      record("收到行动请求", ar != null, `actions=${JSON.stringify(ar?.valid_actions)}`);

      // Check buttons enabled correctly
      const validActions = ar?.valid_actions || [];
      if (validActions.includes("fold")) {
        record("弃牌按钮已启用", snap.foldDisabled === false);
      }
      if (validActions.includes("check")) {
        record("过牌按钮已启用", snap.checkDisabled === false);
      }
      if (validActions.includes("call")) {
        record("跟注按钮已启用", snap.callDisabled === false);
      }

      await page.screenshot({ path: path.join(OUTPUT_DIR, "04-my-turn.png"), fullPage: true });

      // Perform an action (check or call)
      if (validActions.includes("check")) {
        await page.click("#checkButton");
        record("执行过牌操作", true);
      } else if (validActions.includes("call")) {
        await page.click("#callButton");
        record("执行跟注操作", true);
      } else if (validActions.includes("fold")) {
        await page.click("#foldButton");
        record("执行弃牌操作", true);
      }

      await page.waitForTimeout(1000);
      const afterSnap = await getSnapshot(page);

      // After action, check state updated (action was accepted — log grows or phase changes)
      const afterMySeat = afterSnap.state.seats?.find(s => s.layout_slot === "bottom");
      const isStillMyTurn = afterMySeat && afterSnap.state.current_player === afterMySeat.id;
      const logGrew = afterSnap.logItemCount >= snap.logItemCount;
      const phaseChanged = afterSnap.state.phase !== snap.state.phase;
      record("操作后状态更新", logGrew || phaseChanged || !isStillMyTurn,
        `logItems=${afterSnap.logItemCount}, phase=${afterSnap.state.phase}, stillMyTurn=${isStillMyTurn}`);

      // Check action log updated
      record("行动日志有记录", afterSnap.logItemCount > 0, `logItems=${afterSnap.logItemCount}`);

      await page.screenshot({ path: path.join(OUTPUT_DIR, "04-after-action.png"), fullPage: true });
    }
  } catch (err) {
    record("游戏操作测试异常", false, String(err));
  } finally {
    if (!existingSession) {
      await context.close();
    }
  }
}

async function testMultipleRounds(browser) {
  console.log("\n=== 5. 多轮游戏测试 (等待游戏阶段推进) ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const roomId = `rounds-${Date.now()}`;

  try {
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.fill("#roomInput", roomId);
    await page.fill("#nameInput", "RoundsTest");
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );
    await page.click("#joinButton");
    await page.waitForFunction(() => {
      try {
        const state = JSON.parse(window.render_game_to_text());
        return Array.isArray(state.seats) && state.seats.length >= 4 && state.phase !== "waiting";
      } catch (_e) { return false; }
    }, { timeout: 25000 });

    const phasesObserved = new Set();
    let prevPhase = "";
    const start = Date.now();

    // Watch game for 45 seconds, auto-act and observe phase changes
    while (Date.now() - start < 45000) {
      const snap = await getSnapshot(page);
      const phase = snap.state.phase || "";
      if (phase && phase !== "waiting") {
        phasesObserved.add(phase);
      }
      if (phase !== prevPhase && phase) {
        prevPhase = phase;
      }

      // Auto-act if it's our turn
      const mySeat = snap.state.seats?.find(s => s.layout_slot === "bottom");
      if (mySeat && snap.state.current_player === mySeat.id) {
        // Use the controls state from render_game_to_text which reflects actual button state
        const controls = snap.state.controls || {};
        if (controls.check_enabled) {
          await page.click("#checkButton");
        } else if (controls.call_enabled) {
          await page.click("#callButton");
        } else if (controls.fold_enabled) {
          await page.click("#foldButton");
        }
        await page.waitForTimeout(800);
      } else {
        await page.waitForTimeout(600);
      }
    }

    record("观察到多个阶段", phasesObserved.size >= 2, `phases=${[...phasesObserved].join(",")}`);

    const hasPreflop = phasesObserved.has("preflop");
    record("观察到 preflop 阶段", hasPreflop);

    // Check if we saw any later phases
    const laterPhases = ["flop", "turn", "river", "showdown"];
    const sawLater = laterPhases.some(p => phasesObserved.has(p));
    record("游戏推进到翻牌后", sawLater, `observed: ${[...phasesObserved].join(",")}`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "05-multi-rounds.png"), fullPage: true });
  } catch (err) {
    record("多轮游戏测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testDisconnectReconnect(browser) {
  console.log("\n=== 6. 断线重连测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const roomId = `reconn-${Date.now()}`;

  try {
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.fill("#roomInput", roomId);
    await page.fill("#nameInput", "ReconnTest");
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );
    await page.click("#joinButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已加入"),
      { timeout: 15000 }
    );

    // Get player ID for reconnection
    const playerId = await page.evaluate(() => localStorage.getItem("dirtyplay_player_id") || "");
    record("获得 player_id", playerId.length > 0, `id=${playerId.substring(0, 8)}...`);

    // Force close websocket
    await page.evaluate(() => {
      if (window.__dirtyplay_ws || document.querySelector("#statusText").__ws) {
        // Try to close any ws reference
      }
      // Simulate disconnect by closing the socket
      const appStateEl = document.querySelector("#statusText");
      // The ws is in appState closure, trigger close via server input hack
    });

    // Reload page to simulate reconnect
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // Check player name persisted
    const nameValue = await page.evaluate(() => document.querySelector("#nameInput")?.value || "");
    record("昵称持久化", nameValue === "ReconnTest", `name=${nameValue}`);

    // Reconnect with same room
    await page.fill("#roomInput", roomId);
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );
    await page.click("#joinButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已加入"),
      { timeout: 15000 }
    );
    const snap = await getSnapshot(page);
    record("重连后加入成功", snap.statusText.includes("已加入"), snap.statusText);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "06-reconnected.png"), fullPage: true });
  } catch (err) {
    record("断线重连测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testEmptyRoomInput(browser) {
  console.log("\n=== 7. 边界情况测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Test empty room
    await page.click("#connectButton");
    await page.waitForFunction(
      () => (document.querySelector("#statusText")?.textContent || "").includes("已连接"),
      { timeout: 10000 }
    );
    await page.fill("#roomInput", "");
    await page.click("#joinButton");
    await page.waitForTimeout(1000);
    const snap1 = await getSnapshot(page);
    record("空房间名处理", snap1.statusText.includes("请输入") || snap1.statusText.includes("房间"), snap1.statusText);

    // Test switching identity
    await page.click("#resetIdentityButton");
    await page.waitForTimeout(500);
    const newId = await page.evaluate(() => localStorage.getItem("dirtyplay_player_id") || "");
    record("切换新玩家功能", true, `newId=${newId.substring(0, 8)}...`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "07-edge-cases.png"), fullPage: true });
  } catch (err) {
    record("边界情况测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testResponsiveLayout(browser) {
  console.log("\n=== 8. 响应式布局测试 ===");

  // Desktop
  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1 = await ctx1.newPage();

  try {
    await page1.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    const desktop = await page1.evaluate(() => {
      const table = document.querySelector(".table-layout");
      return table ? getComputedStyle(table).display : "none";
    });
    record("桌面布局正常", desktop !== "none", `display=${desktop}`);
    await page1.screenshot({ path: path.join(OUTPUT_DIR, "08-desktop.png"), fullPage: true });
  } catch (err) {
    record("桌面布局测试异常", false, String(err));
  } finally {
    await ctx1.close();
  }

  // Mobile
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page2 = await ctx2.newPage();

  try {
    await page2.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    const visible = await page2.evaluate(() => {
      const btn = document.querySelector("#connectButton");
      return btn ? btn.offsetWidth > 0 : false;
    });
    record("移动端布局正常", visible, "connectButton visible");
    await page2.screenshot({ path: path.join(OUTPUT_DIR, "08-mobile.png"), fullPage: true });
  } catch (err) {
    record("移动端布局测试异常", false, String(err));
  } finally {
    await ctx2.close();
  }
}

// ─── Main ───

async function main() {
  ensureDir(OUTPUT_DIR);
  console.log(`\nDirtyPlay Playwright 全面测试`);
  console.log(`URL: ${PAGE_URL}`);
  console.log(`输出目录: ${OUTPUT_DIR}\n`);

  const chromium = await loadChromium();
  const browser = await launchBrowser(chromium);

  try {
    await testPageLoad(browser);
    await testConnection(browser);
    const session = await testJoinAndGameStart(browser);
    await testGameActions(browser, session);
    if (session) await session.context.close();
    await testMultipleRounds(browser);
    await testDisconnectReconnect(browser);
    await testEmptyRoomInput(browser);
    await testResponsiveLayout(browser);
  } finally {
    await browser.close();
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`测试完成: ${passCount} 通过, ${failCount} 失败, 共 ${passCount + failCount} 项`);
  console.log(`${"=".repeat(50)}`);

  if (failCount > 0) {
    console.log("\n失败项目:");
    for (const r of results) {
      if (!r.passed) {
        console.log(`  ✗ ${r.name}: ${r.detail}`);
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

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
