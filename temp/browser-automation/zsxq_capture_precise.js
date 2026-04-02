const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://wx.zsxq.com/dashboard/28882128518851/income';
const PROFILE_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/interactive-profile';
const OUTPUT_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/zsxq-screenshots-clean';

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function clearDir(dir) {
  await fs.promises.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
}

async function waitForLogin(page) {
  const timeoutMs = 10 * 60 * 1000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!page.url().includes('/login')) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function readSidebar(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    const sidebarItems = nodes.map((el) => {
      const text = (el.innerText || '').trim();
      if (!text || text.length > 20) return null;
      const rect = el.getBoundingClientRect();
      if (rect.left > 320 || rect.width < 40 || rect.height < 20) return null;
      const className = String(el.className || '');
      if (!className.includes('title') && !className.includes('subtitle')) return null;
      if (className.includes('header-container') || className.includes('title-bar')) return null;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      let type = null;
      if (className.includes('subtitle')) type = 'sub';
      else if (className.includes('title')) type = 'top';
      return type ? { text, type, top: rect.top } : null;
    }).filter(Boolean).sort((a, b) => a.top - b.top);

    const result = [];
    let currentTop = null;
    for (const item of sidebarItems) {
      if (item.type === 'top') {
        currentTop = { top: item.text, subs: [] };
        result.push(currentTop);
      } else if (currentTop) {
        currentTop.subs.push(item.text.replace(/\nnew$/, '').trim());
      }
    }
    return result;
  });
}

async function getSidebarClickable(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    const sidebarItems = nodes.map((el) => {
      const rawText = (el.innerText || '').trim();
      if (!rawText || rawText.length > 20) return null;
      const rect = el.getBoundingClientRect();
      if (rect.left > 320 || rect.width < 40 || rect.height < 20) return null;
      const className = String(el.className || '');
      if (!className.includes('title') && !className.includes('subtitle')) return null;
      if (className.includes('header-container') || className.includes('title-bar')) return null;
      const normalizedText = rawText.replace(/\nnew$/, '').trim();
      let itemType = null;
      if (className.includes('subtitle')) itemType = 'sub';
      else if (className.includes('title')) itemType = 'top';
      return itemType ? {
        text: normalizedText,
        type: itemType,
        top: rect.top,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      } : null;
    }).filter(Boolean).sort((a, b) => a.top - b.top);

    const result = [];
    let currentTop = null;
    for (const item of sidebarItems) {
      if (item.type === 'top') {
        currentTop = item.text;
        result.push({ ...item, parentTop: null });
      } else if (currentTop) {
        result.push({ ...item, parentTop: currentTop });
      }
    }
    return result;
  });
}

async function clickSidebarItem(page, text, type, parentTop = null) {
  const items = await getSidebarClickable(page);
  const target = items.find((item) => (
    item.type === type &&
    item.text === text &&
    (type === 'top' || item.parentTop === parentTop)
  ));

  if (!target) {
    throw new Error(`Cannot click ${type}: ${parentTop ? `${parentTop} / ` : ''}${text}`);
  }

  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(2000);
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let previous = -1;
      const timer = setInterval(() => {
        window.scrollBy(0, 900);
        const current = window.scrollY;
        if (current === previous || current + window.innerHeight >= document.documentElement.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
        previous = current;
      }, 250);
    });
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
}

async function capture(page, folderName, fileName) {
  const folder = path.join(OUTPUT_DIR, sanitizeName(folderName));
  await ensureDir(folder);
  await autoScroll(page);
  const filePath = path.join(folder, `${sanitizeName(fileName)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`CAPTURED ${filePath}`);
}

async function main() {
  await clearDir(OUTPUT_DIR);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
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

  const sidebar = await readSidebar(page);
  console.log(JSON.stringify(sidebar, null, 2));

  for (const group of sidebar) {
    await clickSidebarItem(page, group.top, 'top');
    await capture(page, group.top, group.top);
    for (const sub of group.subs) {
      await clickSidebarItem(page, sub, 'sub', group.top);
      await capture(page, group.top, sub);
    }
  }

  await context.close();
  console.log('DONE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
