const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext(
    'D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/interactive-profile',
    {
      headless: false,
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args: ['--profile-directory=Default'],
      viewport: { width: 1440, height: 1200 },
    }
  );

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://wx.zsxq.com/dashboard/28882128518851/income', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });

  const startedAt = Date.now();
  const timeoutMs = 10 * 60 * 1000;

  while (Date.now() - startedAt < timeoutMs) {
    if (!page.url().includes('/login')) {
      console.log('LOGIN_OK');
      console.log(page.url());
      await page.waitForTimeout(3000);
      return;
    }
    await page.waitForTimeout(1000);
  }

  console.log('LOGIN_TIMEOUT');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
