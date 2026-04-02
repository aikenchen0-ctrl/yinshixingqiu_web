const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://wx.zsxq.com/dashboard/28882128518851/income';
const PROFILE_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/interactive-profile';
const OUTPUT_DIR = 'D:/CodeDevelopment/xueyinMiniapp/temp/zsxq-screenshots-final';

const TASKS = [
  { folder: '收入数据', type: 'title', text: '收入数据', index: 0, file: '收入数据' },
  { folder: '推广拉新', type: 'subtitle', text: '推广数据', index: 0, file: '推广数据' },
  { folder: '推广拉新', type: 'subtitle', text: '新人优惠券', index: 0, file: '新人优惠券' },
  { folder: '推广拉新', type: 'subtitle', text: '渠道二维码', index: 0, file: '渠道二维码' },
  { folder: '推广拉新', type: 'subtitle', text: '付费页优化', index: 0, file: '付费页优化' },
  { folder: '用户活跃', type: 'subtitle', text: '成员活跃', index: 0, file: '成员活跃' },
  { folder: '用户活跃', type: 'subtitle', text: '内容活跃', index: 0, file: '内容活跃' },
  { folder: '用户活跃', type: 'subtitle', text: '成员积分榜', index: 0, file: '成员积分榜' },
  { folder: '用户活跃', type: 'subtitle', text: '活跃工具', index: 0, file: '活跃工具' },
  { folder: '成员续期', type: 'subtitle', text: '续期数据', index: 0, file: '续期数据' },
  { folder: '成员续期', type: 'subtitle', text: '续期优惠券', index: 0, file: '续期优惠券' },
  { folder: '成员续期', type: 'subtitle', text: '分组通知', index: 0, file: '分组通知' },
  { folder: '成员续期', type: 'subtitle', text: '续期页优化', index: 0, file: '续期页优化' },
  { folder: '成员续期', type: 'subtitle', text: '续期折扣', index: 0, file: '续期折扣' },
  { folder: '运营工具', type: 'subtitle', text: '优惠券', index: 0, file: '优惠券' },
  { folder: '运营工具', type: 'subtitle', text: '分组通知', index: 1, file: '分组通知' },
  { folder: '运营工具', type: 'subtitle', text: '渠道二维码', index: 1, file: '渠道二维码' },
  { folder: '运营工具', type: 'subtitle', text: '付费页优化', index: 1, file: '付费页优化' },
  { folder: '运营工具', type: 'subtitle', text: '成员积分榜', index: 1, file: '成员积分榜' },
  { folder: '运营工具', type: 'subtitle', text: '创作灵感', index: 0, file: '创作灵感' },
  { folder: '运营工具', type: 'subtitle', text: '视频号直播', index: 0, file: '视频号直播' },
  { folder: '运营工具', type: 'subtitle', text: '成员身份验证', index: 0, file: '成员身份验证' },
  { folder: '权限设置', type: 'title', text: '权限设置', index: 0, file: '权限设置' },
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

async function clickMenu(page, task) {
  const selector = task.type === 'title' ? 'div.title' : 'div.subtitle';
  await page.locator(selector).evaluateAll((els) => {
    els.forEach((el) => {
      if (el.getBoundingClientRect().left < 320) el.scrollIntoView({ block: 'center' });
    });
  });
  const target = page.locator(selector).evaluateAll((els, taskInfo) => {
    const matches = els.filter((el) => {
      const text = (el.innerText || '').replace(/\nnew$/, '').trim();
      const rect = el.getBoundingClientRect();
      return rect.left < 320 && text === taskInfo.text;
    });
    return matches.length;
  }, task);
  const count = await target;
  if (count <= task.index) {
    throw new Error(`Cannot find menu ${task.text} at index ${task.index}`);
  }
  await page.locator(selector).evaluateAll((els, taskInfo) => {
    const matches = els.filter((el) => {
      const text = (el.innerText || '').replace(/\nnew$/, '').trim();
      const rect = el.getBoundingClientRect();
      return rect.left < 320 && text === taskInfo.text;
    });
    matches[taskInfo.index].click();
  }, task);
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
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);

  for (const task of TASKS) {
    await clickMenu(page, task);
    await capture(page, task.folder, task.file);
  }

  await context.close();
  console.log('DONE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
