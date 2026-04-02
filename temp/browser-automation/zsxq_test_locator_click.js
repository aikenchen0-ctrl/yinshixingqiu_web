const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext('D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/interactive-profile', {
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--profile-directory=Default'],
    viewport: { width: 1440, height: 1200 },
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://wx.zsxq.com/dashboard/28882128518851/income', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(4000);
  await page.locator('div.title').filter({ hasText: '推广拉新' }).first().click();
  await page.waitForTimeout(3000);
  const active = await page.evaluate(() => {
    const activeNode = Array.from(document.querySelectorAll('div.title.active')).find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left < 320;
    });
    return activeNode ? activeNode.innerText.trim() : null;
  });
  console.log(JSON.stringify({ url: page.url(), active }, null, 2));
  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
