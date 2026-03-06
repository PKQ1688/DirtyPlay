import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("output/playwright/skill-coverage");
const TARGET_SKILLS = ["counter", "mist", "peek", "bluff", "swap"];
const MAX_ATTEMPTS = 80;
const PAGE_URL = process.env.DIRTYPLAY_URL || "http://127.0.0.1:8080";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

function pathToFileUrl(filePath) {
  const abs = path.resolve(filePath);
  return `file://${abs}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toJsonPath(skillId, attempt) {
  return path.join(OUTPUT_DIR, `${skillId}-attempt-${attempt}.json`);
}

function toShotPath(skillId, attempt, phase) {
  return path.join(OUTPUT_DIR, `${skillId}-attempt-${attempt}-${phase}.png`);
}

function toRoomId(attempt) {
  return `skill-cov-${Date.now()}-${attempt}`;
}

function assertWithReason(condition, reason) {
  if (!condition) {
    throw new Error(reason);
  }
}

async function waitForJoined(page) {
  await page.waitForFunction(() => {
    const statusText = document.querySelector("#statusText")?.textContent || "";
    return statusText.includes("已加入") || statusText.includes("已创建");
  }, { timeout: 15000 });

  await page.waitForFunction(() => {
    try {
      const state = JSON.parse(window.render_game_to_text());
      return Array.isArray(state.seats) && state.seats.length >= 4;
    } catch (_err) {
      return false;
    }
  }, { timeout: 25000 });
}

async function waitMyTurn(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await getSnapshot(page);
    const mySeat = snapshot.state?.seats?.find((seat) => seat.layout_slot === "bottom");
    if (mySeat && snapshot.state.current_player === mySeat.id) {
      return snapshot;
    }
    await page.waitForTimeout(600);
  }
  return getSnapshot(page);
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
      selectedSkillText: document.querySelector("#selectedSkillText")?.textContent || "",
      skillDescriptionText: document.querySelector("#skillDescriptionText")?.textContent || "",
      skillHintText: document.querySelector("#skillHintText")?.textContent || "",
      statusText: document.querySelector("#statusText")?.textContent || "",
      useSkillDisabled: Boolean(document.querySelector("#useSkillButton")?.disabled),
      targetVisible: Boolean(document.querySelector("#targetSelect")?.offsetParent),
      cardVisible: Boolean(document.querySelector("#cardIdxSelect")?.offsetParent),
      targetValue: document.querySelector("#targetSelect")?.value || "",
      cardIdxValue: document.querySelector("#cardIdxSelect")?.value || "",
    };
  });
}

function pickSkillId(snapshot) {
  const skills = Array.isArray(snapshot.state?.my_skills) ? snapshot.state.my_skills : [];
  if (skills.length === 0) {
    return "";
  }
  return String(skills[0]?.id || "");
}

async function openAndJoin(page, attempt, _roomId) {
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.fill("#lobbyNameInput", `Cov${attempt}`);
  await page.click("#createRoomBtn");
  // Wait until we land on the game screen (room_created received)
  await page.waitForFunction(() => {
    const gs = document.getElementById("gameScreen");
    return gs && gs.style.display !== "none";
  }, { timeout: 15000 });
  // Add 3 bots so the game can start (need ≥2 players)
  for (let i = 0; i < 3; i++) {
    await page.click("#addBotBtn");
    await page.waitForTimeout(200);
  }
  await waitForJoined(page);
}

async function clickSkill(page, skillId) {
  const selector = `#skillButtons button[data-skill-id="${skillId}"]`;
  const count = await page.locator(selector).count();
  assertWithReason(count > 0, `未找到技能按钮: ${skillId}`);
  await page.click(selector);
  await page.waitForTimeout(180);
}

async function runActiveSkill(page, skillId, attempt) {
  let snapshot = await waitMyTurn(page, 28000);
  await clickSkill(page, skillId);
  snapshot = await getSnapshot(page);

  if (skillId === "peek" && snapshot.targetVisible && !snapshot.targetValue) {
    await page.selectOption("#targetSelect", { index: 1 });
    await page.waitForTimeout(100);
    snapshot = await getSnapshot(page);
  }
  if (skillId === "swap" && snapshot.cardVisible) {
    await page.selectOption("#cardIdxSelect", "0");
    await page.waitForTimeout(100);
    snapshot = await getSnapshot(page);
  }

  const beforeState = snapshot.state;
  await page.screenshot({ path: toShotPath(skillId, attempt, "before"), fullPage: true });
  assertWithReason(!snapshot.useSkillDisabled, `${skillId} 在可行动场景下仍被禁用。提示: ${snapshot.skillHintText}`);

  await page.click("#useSkillButton");
  await page.waitForTimeout(550);
  const after = await getSnapshot(page);
  await page.screenshot({ path: toShotPath(skillId, attempt, "after"), fullPage: true });

  assertWithReason(!after.statusText.includes("请求失败"), `${skillId} 使用后仍报错: ${after.statusText}`);
  if (skillId === "peek") {
    const isEffective = after.statusText.includes("技能生效: 窥视");
    const isBlocked = after.statusText.includes("技能被抵消: 窥视");
    assertWithReason(isEffective || isBlocked, `peek 使用后状态异常: ${after.statusText}`);
  } else {
    assertWithReason(after.statusText.includes("技能生效"), `${skillId} 使用后缺少生效提示: ${after.statusText}`);
  }
  assertWithReason(after.state?.action_request?.can_use_skill === false, `${skillId} 使用后 can_use_skill 未变为 false。`);

  if (skillId === "swap") {
    const beforeHand = JSON.stringify(beforeState?.my_hand || []);
    const afterHand = JSON.stringify(after.state?.my_hand || []);
    assertWithReason(beforeHand !== afterHand, "swap 使用后手牌未变化。");
  }

  fs.writeFileSync(toJsonPath(skillId, attempt), JSON.stringify({
    skill: skillId,
    attempt,
    before: snapshot,
    after,
  }, null, 2));
}

async function runCounterSkill(page, attempt) {
  await clickSkill(page, "counter");
  const snapshot = await getSnapshot(page);
  await page.screenshot({ path: toShotPath("counter", attempt, "state"), fullPage: true });
  assertWithReason(snapshot.useSkillDisabled, "counter 应为被动技能，按钮必须禁用。");
  assertWithReason(snapshot.skillHintText.includes("被动技能"), `counter 禁用原因不正确: ${snapshot.skillHintText}`);
  fs.writeFileSync(toJsonPath("counter", attempt), JSON.stringify({
    skill: "counter",
    attempt,
    snapshot,
  }, null, 2));
}

async function runMistSkill(page, attempt) {
  await clickSkill(page, "mist");
  const snapshot = await getSnapshot(page);
  await page.screenshot({ path: toShotPath("mist", attempt, "state"), fullPage: true });

  const noCommunity = Array.isArray(snapshot.state?.community_cards) && snapshot.state.community_cards.length === 0;
  if (noCommunity) {
    assertWithReason(snapshot.useSkillDisabled, "mist 在无公共牌时必须禁用。");
    assertWithReason(snapshot.skillHintText.includes("公共牌"), `mist 禁用原因缺少公共牌提示: ${snapshot.skillHintText}`);
  } else {
    assertWithReason(!snapshot.useSkillDisabled, `mist 在有公共牌时仍禁用: ${snapshot.skillHintText}`);
  }

  fs.writeFileSync(toJsonPath("mist", attempt), JSON.stringify({
    skill: "mist",
    attempt,
    snapshot,
  }, null, 2));
}

async function runAttempt(chromium, attempt, coverage, logs) {
  const roomId = toRoomId(attempt);
  const context = await chromium.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err));
  });

  try {
    await openAndJoin(page, attempt, roomId);
    let snapshot = await getSnapshot(page);
    const skillId = pickSkillId(snapshot);
    logs.push({ attempt, roomId, skillId, phase: snapshot.state?.phase || "", consoleErrors, pageErrors });

    if (!TARGET_SKILLS.includes(skillId) || coverage[skillId]) {
      return;
    }

    if (skillId === "counter") {
      await runCounterSkill(page, attempt);
    } else if (skillId === "mist") {
      await runMistSkill(page, attempt);
    } else {
      await runActiveSkill(page, skillId, attempt);
    }

    coverage[skillId] = {
      passed: true,
      attempt,
      roomId,
      consoleErrors: consoleErrors.slice(),
      pageErrors: pageErrors.slice(),
    };
  } catch (err) {
    logs.push({ attempt, roomId, error: String(err), consoleErrors, pageErrors });
  } finally {
    await context.close();
  }
}

function allCovered(coverage) {
  return TARGET_SKILLS.every((skillId) => Boolean(coverage[skillId]?.passed));
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const chromium = await loadChromium();
  const browser = await launchBrowser(chromium);

  const coverage = {};
  const logs = [];

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await runAttempt(browser, attempt, coverage, logs);
      if (allCovered(coverage)) {
        break;
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    url: PAGE_URL,
    maxAttempts: MAX_ATTEMPTS,
    targetSkills: TARGET_SKILLS,
    coverage,
    coveredCount: Object.values(coverage).filter((item) => item?.passed).length,
    missingSkills: TARGET_SKILLS.filter((skillId) => !coverage[skillId]?.passed),
    logs,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, "skill-coverage-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (summary.missingSkills.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
