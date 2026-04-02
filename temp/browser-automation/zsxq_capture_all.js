const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://wx.zsxq.com/dashboard/28882128518851/income';
const PROFILE_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/interactive-profile';
const OUTPUT_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/zsxq-screenshots';

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function waitForLogin(page) {
  const timeoutMs = 10 * 60 * 1000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!page.url().includes('/login')) {
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function getSidebarState(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    const items = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.innerText || '').trim();
      if (!text || text.length > 30) continue;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 20) continue;
      if (rect.left > window.innerWidth * 0.35) continue;
      if (['收入数据', '推广拉新', '用户活跃', '成员续期', '运营工具', '权限设置'].includes(text)) {
        items.push({
          text,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
    }
    return items;
  });
}

async function clickSidebarText(page, text) {
  const clicked = await page.evaluate((targetText) => {
    const all = Array.from(document.querySelectorAll('body *'));
    const match = all.find((el) => (el.innerText || '').trim() === targetText);
    if (!match) return false;
    match.scrollIntoView({ block: 'center' });
    match.click();
    return true;
  }, text);
  if (!clicked) {
    throw new Error(`Cannot find sidebar item: ${text}`);
  }
  await page.waitForTimeout(1500);
}

async function getSecondLevelTabs(page, topLevelText) {
  return page.evaluate((currentText) => {
    const all = Array.from(document.querySelectorAll('body *'));
    const current = all.find((el) => (el.innerText || '').trim() === currentText);
    if (!current) return [];
    const container = current.closest('li, div, section')?.parentElement || current.parentElement;
    const texts = new Set();
    const candidates = Array.from((container || document.body).querySelectorAll('*'));
    for (const el of candidates) {
      const text = (el.innerText || '').trim();
      if (!text || text === currentText || text.length > 20) continue;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.width < 20 || rect.height < 16) continue;
      if (rect.left < current.getBoundingClientRect().left + 10) continue;
      if (rect.left > window.innerWidth * 0.45) continue;
      texts.add(text);
    }
    return Array.from(texts);
  }, topLevelText);
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 800;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
}

async function capturePage(page, folderName, fileName) {
  const dir = path.join(OUTPUT_DIR, sanitizeName(folderName));
  await ensureDir(dir);
  await autoScroll(page);
  const filePath = path.join(dir, `${sanitizeName(fileName)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`CAPTURED ${filePath}`);
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--profile-directory=Default'],
    viewport: { width: 1440, height: 1200 },
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);

  if (page.url().includes('/login')) {
    console.log('WAITING_FOR_LOGIN');
    const ok = await waitForLogin(page);
    if (!ok) throw new Error('Login timeout');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4000);
  }

  const topLevelItems = ['收入数据', '推广拉新', '用户活跃', '成员续期', '运营工具', '权限设置'];
  for (const topLevel of topLevelItems) {
    await clickSidebarText(page, topLevel);
    await capturePage(page, topLevel, topLevel);

    const secondLevel = await getSecondLevelTabs(page, topLevel);
    const validSecondLevel = secondLevel.filter((item) => item && item !== topLevel);
    for (const sub of validSecondLevel) {
      try {
        await clickSidebarText(page, sub);
        await capturePage(page, topLevel, sub);
        await clickSidebarText(page, topLevel);
      } catch (error) {
        console.log(`SKIP_SUBTAB ${topLevel} / ${sub}: ${error.message}`);
      }
    }
  }

  console.log('DONE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
