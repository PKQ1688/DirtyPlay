/**
 * Playwright 回归测试 DirtyPlay Web 客户端
 * 覆盖: 大厅加载、邀请码校验、建房开局、行动、刷新重连、调试导出、响应式布局
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
  if (passed) {
    passCount++;
  } else {
    failCount++;
  }
  results.push({ name, passed, detail });
  const mark = passed ? "✓" : "✗";
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pathToFileUrl(filePath) {
  const abs = path.resolve(filePath);
  return `file://${abs}`;
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

async function getSnapshot(page) {
  return page.evaluate(() => {
    const rawState = typeof window.render_game_to_text === "function" ? window.render_game_to_text() : "{}";
    let state;
    try {
      state = JSON.parse(rawState);
    } catch (_err) {
      state = {};
    }
    return {
      state,
      lobbyName: document.querySelector("#lobbyNameInput")?.value || "",
      roomCodeValue: document.querySelector("#roomCodeInput")?.value || "",
      lobbyError: document.querySelector("#lobbyError")?.textContent || "",
      statusText: document.querySelector("#statusText")?.textContent || "",
      phaseText: document.querySelector("#phaseText")?.textContent || "",
      handText: document.querySelector("#handText")?.textContent || "",
      waitingCode: document.querySelector("#waitingCode")?.textContent || "",
      roomCodeBadge: document.querySelector("#roomCodeBadge")?.textContent || "",
      createVisible: Boolean(document.querySelector("#createRoomBtn")?.offsetParent),
      joinVisible: Boolean(document.querySelector("#joinRoomBtn")?.offsetParent),
      addBotVisible: Boolean(document.querySelector("#addBotBtn")?.offsetParent),
      seatCount: document.querySelectorAll(".seat").length,
      logItemCount: document.querySelectorAll("#actionLogList li").length,
      orientationTipVisible: (() => {
        const node = document.querySelector(".orientation-tip");
        return Boolean(node) && getComputedStyle(node).display !== "none";
      })(),
    };
  });
}

async function gotoLobby(page) {
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("#createRoomBtn", { timeout: 5000 });
}

async function waitForPhase(page, predicate, timeoutMs = 15000) {
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
  await waitForPhase(page, (state) => state.phase && state.phase !== "waiting", timeoutMs);
}

async function createRoom(page, name) {
  await gotoLobby(page);
  await page.fill("#lobbyNameInput", name);
  await page.click("#createRoomBtn");
  await page.waitForFunction(() => {
    const badge = document.querySelector("#roomCodeBadge");
    return Boolean(badge && badge.textContent && badge.textContent.trim().length === 6);
  }, { timeout: 15000 });
  return (await page.locator("#roomCodeBadge").textContent()).trim();
}

async function joinRoomByCode(page, code, name) {
  await gotoLobby(page);
  await page.fill("#lobbyNameInput", name);
  await page.fill("#roomCodeInput", code);
  await page.click("#joinRoomBtn");
  await page.waitForFunction(() => {
    const screen = document.getElementById("gameScreen");
    return Boolean(screen && screen.style.display !== "none");
  }, { timeout: 15000 });
}

async function addBots(page, count) {
  for (let index = 0; index < count; index += 1) {
    await page.click("#addBotBtn");
    await page.waitForTimeout(150);
  }
}

async function waitForMyTurn(page, timeoutMs = 30000) {
  const start = Date.now();
  let lastSnapshot = await getSnapshot(page);
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await getSnapshot(page);
    const self = lastSnapshot.state?.seats?.find((seat) => seat.layout_slot === "bottom");
    if (self && lastSnapshot.state.current_player === self.id) {
      return { gotTurn: true, snapshot: lastSnapshot };
    }
    await page.waitForTimeout(400);
  }
  return { gotTurn: false, snapshot: lastSnapshot };
}

async function performSafeAction(page, snapshot) {
  const controls = snapshot.state?.controls || {};
  if (controls.check_enabled) {
    await page.click("#checkButton");
    return "check";
  }
  if (controls.call_enabled) {
    await page.click("#callButton");
    return "call";
  }
  if (controls.fold_enabled) {
    await page.click("#foldButton");
    return "fold";
  }
  if (controls.all_in_enabled) {
    await page.click("#allInButton");
    return "all_in";
  }
  throw new Error("no safe action available");
}

async function testPageLoad(browser) {
  console.log("\n=== 1. 页面加载测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  try {
    const resp = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
    record("页面返回 200", resp?.status() === 200, `status=${resp?.status()}`);

    await page.waitForSelector("#createRoomBtn", { timeout: 5000 });
    const snap = await getSnapshot(page);
    record("大厅按钮已加载", snap.createVisible && snap.joinVisible);

    const title = await page.title();
    record("页面标题正确", title.includes("DirtyPlay"), title);
    record("初始状态文案", snap.statusText.includes("未连接"), snap.statusText);
    record("调试导出反映大厅按钮", snap.state.controls?.can_connect && snap.state.controls?.can_join,
      JSON.stringify(snap.state.controls));
    record("页面加载无 JS 错误", errors.length === 0, errors[0] || "");

    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-page-load.png"), fullPage: true });
  } catch (err) {
    record("页面加载测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testLobbyValidation(browser) {
  console.log("\n=== 2. 大厅校验测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await gotoLobby(page);
    await page.fill("#lobbyNameInput", "LobbyTest");
    await page.fill("#roomCodeInput", "123");
    await page.click("#joinRoomBtn");
    await page.waitForFunction(() => {
      const node = document.querySelector("#lobbyError");
      return Boolean(node && node.textContent && node.textContent.trim().length > 0);
    }, { timeout: 5000 });
    const snap = await getSnapshot(page);
    record("非法邀请码提示", snap.lobbyError.includes("6位邀请码"), snap.lobbyError);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-lobby-validation.png"), fullPage: true });
  } catch (err) {
    record("大厅校验测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testCreateRoomAndStart(browser) {
  console.log("\n=== 3. 建房开局测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    const code = await createRoom(page, "HostFlow");
    let snap = await getSnapshot(page);
    record("建房成功", snap.statusText.includes("已创建房间"), snap.statusText);
    record("邀请码显示", code.length === 6 && snap.waitingCode === code, `badge=${snap.roomCodeBadge}, waiting=${snap.waitingCode}`);

    await addBots(page, 1);
    await waitForGameStart(page, 15000);
    snap = await getSnapshot(page);

    record("添加 AI 后自动开局", snap.state.phase === "preflop" || snap.state.phase === "flop" || snap.state.phase === "turn" || snap.state.phase === "river",
      `phase=${snap.state.phase}`);
    record("开局后状态文案同步", snap.statusText.includes("牌局进行中"), snap.statusText);
    record("开局后手牌可见", Array.isArray(snap.state.my_hand) && snap.state.my_hand.length === 2, JSON.stringify(snap.state.my_hand));
    record("开局后座位数量正确", snap.seatCount >= 2, `seats=${snap.seatCount}`);
    record("进桌后大厅控件导出关闭", snap.state.controls?.can_connect === false && snap.state.controls?.can_join === false,
      JSON.stringify(snap.state.controls));

    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-game-started.png"), fullPage: true });
    return { context, page, code };
  } catch (err) {
    record("建房开局测试异常", false, String(err));
    await context.close();
    return null;
  }
}

async function testHumanJoinFlow(browser) {
  console.log("\n=== 4. 双人加入测试 ===");
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    const code = await createRoom(host, "HostJoin");
    await joinRoomByCode(guest, code, "GuestJoin");
    await waitForGameStart(host, 15000);
    await waitForGameStart(guest, 15000);

    const hostSnap = await getSnapshot(host);
    const guestSnap = await getSnapshot(guest);

    record("访客加入后房主进入牌局", hostSnap.state.phase !== "waiting", `hostPhase=${hostSnap.state.phase}`);
    record("访客加入后客人进入牌局", guestSnap.state.phase !== "waiting", `guestPhase=${guestSnap.state.phase}`);
    record("双方均看到 2 个座位", hostSnap.state.seats?.length === 2 && guestSnap.state.seats?.length === 2,
      `host=${hostSnap.state.seats?.length}, guest=${guestSnap.state.seats?.length}`);

    await host.screenshot({ path: path.join(OUTPUT_DIR, "04-human-join-host.png"), fullPage: true });
  } catch (err) {
    record("双人加入测试异常", false, String(err));
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
}

async function testGameActions(browser, session) {
  console.log("\n=== 5. 行动回合测试 ===");
  if (!session) {
    record("行动回合测试前置失败", false, "missing session");
    return;
  }

  const { page } = session;
  try {
    const turn = await waitForMyTurn(page, 30000);
    record("等到玩家回合", turn.gotTurn, `phase=${turn.snapshot.state?.phase || "-"}`);
    if (!turn.gotTurn) {
      return;
    }

    const before = turn.snapshot;
    const action = await performSafeAction(page, before);
    await page.waitForTimeout(1200);
    const after = await getSnapshot(page);
    const self = after.state?.seats?.find((seat) => seat.layout_slot === "bottom");
    const stillMyTurn = Boolean(self && after.state.current_player === self.id);
    const advanced = after.logItemCount > before.logItemCount
      || after.state.phase !== before.state.phase
      || !stillMyTurn;

    record("行动按钮与请求一致", Array.isArray(before.state.action_request?.valid_actions)
      && before.state.action_request.valid_actions.length > 0,
      JSON.stringify(before.state.action_request));
    record("成功执行安全行动", advanced, `action=${action}, phase=${after.state.phase}, log=${after.logItemCount}`);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "05-after-action.png"), fullPage: true });
  } catch (err) {
    record("行动回合测试异常", false, String(err));
  } finally {
    await session.context.close();
  }
}

async function testReconnect(browser) {
  console.log("\n=== 6. 刷新重连测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    const code = await createRoom(page, "ReconnectHost");
    await addBots(page, 1);
    await waitForGameStart(page, 15000);
    const before = await getSnapshot(page);
    const handBefore = JSON.stringify(before.state.my_hand || []);

    await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
    await page.fill("#roomCodeInput", code);
    await page.click("#joinRoomBtn");
    await page.waitForFunction(() => {
      try {
        const state = JSON.parse(window.render_game_to_text());
        return state.phase && state.phase !== "waiting" && Array.isArray(state.my_hand) && state.my_hand.length === 2;
      } catch (_err) {
        return false;
      }
    }, { timeout: 15000 });

    const after = await getSnapshot(page);
    record("刷新后仍在原牌局", after.state.phase === before.state.phase, `before=${before.state.phase}, after=${after.state.phase}`);
    record("刷新后手牌保持不变", JSON.stringify(after.state.my_hand || []) === handBefore,
      `before=${handBefore}, after=${JSON.stringify(after.state.my_hand || [])}`);
    record("刷新后状态文案正确", after.statusText.includes("牌局进行中"), after.statusText);

    await page.screenshot({ path: path.join(OUTPUT_DIR, "06-reconnected.png"), fullPage: true });
  } catch (err) {
    record("刷新重连测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testDebugExport(browser) {
  console.log("\n=== 7. 调试导出测试 ===");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    const code = await createRoom(page, "DebugHost");
    await addBots(page, 1);
    await waitForGameStart(page, 15000);
    const inGame = await getSnapshot(page);

    record("调试导出含 create/join 开关", typeof inGame.state.controls?.create_room_enabled === "boolean"
      && typeof inGame.state.controls?.join_room_enabled === "boolean",
      JSON.stringify(inGame.state.controls));
    record("进桌后调试导出 create/join 关闭", inGame.state.controls?.create_room_enabled === false
      && inGame.state.controls?.join_room_enabled === false,
      JSON.stringify(inGame.state.controls));
    record("调试导出含座位和行动请求", Array.isArray(inGame.state.seats)
      && inGame.state.seats.length >= 2
      && typeof inGame.state.action_request === "object",
      `seats=${inGame.state.seats?.length}`);
    record("邀请码仍保留在界面", inGame.roomCodeBadge === code, `badge=${inGame.roomCodeBadge}, code=${code}`);
  } catch (err) {
    record("调试导出测试异常", false, String(err));
  } finally {
    await context.close();
  }
}

async function testResponsiveLayout(browser) {
  console.log("\n=== 8. 响应式布局测试 ===");

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  try {
    await gotoLobby(desktopPage);
    const desktopSnap = await getSnapshot(desktopPage);
    record("桌面大厅按钮可见", desktopSnap.createVisible && desktopSnap.joinVisible);
    await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, "08-desktop.png"), fullPage: true });
  } catch (err) {
    record("桌面布局测试异常", false, String(err));
  } finally {
    await desktopContext.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileContext.newPage();
  try {
    await gotoLobby(mobilePage);
    const mobileSnap = await getSnapshot(mobilePage);
    record("移动端大厅按钮可见", mobileSnap.createVisible && mobileSnap.joinVisible);
    record("竖屏提示显示", mobileSnap.orientationTipVisible, `visible=${mobileSnap.orientationTipVisible}`);
    await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, "08-mobile.png"), fullPage: true });
  } catch (err) {
    record("移动端布局测试异常", false, String(err));
  } finally {
    await mobileContext.close();
  }
}

async function main() {
  ensureDir(OUTPUT_DIR);
  console.log("\nDirtyPlay Playwright 回归测试");
  console.log(`URL: ${PAGE_URL}`);
  console.log(`输出目录: ${OUTPUT_DIR}\n`);

  const chromium = await loadChromium();
  const browser = await launchBrowser(chromium);

  try {
    await testPageLoad(browser);
    await testLobbyValidation(browser);
    const session = await testCreateRoomAndStart(browser);
    await testHumanJoinFlow(browser);
    await testGameActions(browser, session);
    await testReconnect(browser);
    await testDebugExport(browser);
    await testResponsiveLayout(browser);
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
