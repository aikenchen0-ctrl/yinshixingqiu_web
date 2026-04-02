const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PROFILE_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/interactive-profile';
const START_URL = 'https://wx.zsxq.com/group_data/28882128518851/graph';
const OUTPUT_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/zsxq-old-screenshots-final';

const TASKS = [
  { folder: '星球数据', text: '收入数据' },
  { folder: '星球数据', text: '成员数据' },
  { folder: '星球数据', text: '内容数据' },
  { folder: '星球数据', text: '权限设置' },
  { folder: '推广工具', text: '分组通知' },
  { folder: '推广工具', text: '优惠券' },
  { folder: '推广工具', text: '二维码分析' },
  { folder: '推广工具', text: '星球亮点' },
];

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function resetDir(dir) {
  await fs.promises.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
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

async function capture(page, folder, file) {
  const folderPath = path.join(OUTPUT_DIR, sanitizeName(folder));
  await ensureDir(folderPath);
  await autoScroll(page);
  const filePath = path.join(folderPath, `${sanitizeName(file)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`CAPTURED ${filePath}`);
}

async function clickSubMenu(page, text) {
  const matchCount = await page.locator('div.subtitle').evaluateAll((els, targetText) => {
    return els.filter((el) => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || '').trim();
      return rect.left < 320 && text === targetText;
    }).length;
  }, text);

  if (!matchCount) {
    throw new Error(`Cannot find menu ${text}`);
  }

  await page.locator('div.subtitle').evaluateAll((els, targetText) => {
    const target = els.find((el) => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || '').trim();
      return rect.left < 320 && text === targetText;
    });
    target?.click();
  }, text);

  await page.waitForTimeout(2500);
}

async function main() {
  await resetDir(OUTPUT_DIR);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--profile-directory=Default'],
    viewport: { width: 1440, height: 1200 },
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);

  for (const task of TASKS) {
    await clickSubMenu(page, task.text);
    await capture(page, task.folder, task.text);
  }

  await context.close();
  console.log('DONE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
