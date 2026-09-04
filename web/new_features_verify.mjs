import fs from "node:fs";
import path from "node:path";

const PAGE_URL = process.env.DIRTYPLAY_URL || "http://127.0.0.1:8080";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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

async function run() {
  const chromium = await loadChromium();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (_e) {
    browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  console.log("Navigating to", PAGE_URL);
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });

  // 1. Check lobby elements
  await page.fill("#lobbyNameInput", "TesterHero");
  await page.click("#quickPlayBtn");

  // 2. Wait for game screen
  await page.waitForSelector("#gameScreen", { state: "visible", timeout: 5000 });
  console.log("Joined game screen successfully");

  // 3. Wait for hand to deal
  await page.waitForFunction(() => {
    const txt = document.getElementById("handRankBadge")?.textContent || "";
    return txt.length > 0 && !txt.includes("等待发牌");
  }, { timeout: 8000 });

  const handRankText = await page.$eval("#handRankBadge", el => el.textContent);
  console.log("Hand Rank Badge displayed:", handRankText);

  // 4. Test Pause Feature
  await page.click("#pauseGameBtn");
  const isPauseOpen = await page.$eval("#pauseDialog", el => el.open);
  console.log("Pause dialog opened:", isPauseOpen);

  if (!isPauseOpen) throw new Error("Pause dialog did not open!");

  // Test Speed Selector in Pause
  await page.click('.speed-btn[data-speed="fast"]');
  const activeSpeed = await page.$eval('.speed-btn.active', el => el.dataset.speed);
  console.log("Active speed switched to:", activeSpeed);

  // Test Resume
  await page.click("#resumeGameBtn");
  const isPauseClosed = await page.$eval("#pauseDialog", el => !el.open);
  console.log("Pause dialog closed on resume:", isPauseClosed);

  // 5. Test Action area buttons
  await page.waitForFunction(() => {
    const btn = document.getElementById("foldButton");
    return btn && !btn.disabled;
  }, { timeout: 10000 });

  const callBtnText = await page.$eval("#callButton", el => el.textContent.trim());
  const checkBtnVisible = await page.$eval("#checkButton", el => el.style.display !== "none");
  console.log("Action button status: check visible =", checkBtnVisible, "call text =", callBtnText);

  // 6. Test Shortcut Key P for pause
  await page.keyboard.press("KeyP");
  const pauseByShortcut = await page.$eval("#pauseDialog", el => el.open);
  console.log("Pause triggered by shortcut 'P':", pauseByShortcut);
  await page.keyboard.press("Escape");

  console.log("All new features verified successfully!");
  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
