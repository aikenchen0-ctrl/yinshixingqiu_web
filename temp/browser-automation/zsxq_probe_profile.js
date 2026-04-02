const { chromium } = require('playwright');

(async () => {
  const context = await chromium.launchPersistentContext('D:/CodeDevelopment/xueyinMiniapp/temp/browser-automation/chrome-profile-copy', {
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
  await page.waitForTimeout(5000);
  const body = await page.locator('body').innerText().catch(() => '');
  console.log(JSON.stringify({
    url: page.url(),
    title: await page.title(),
    body: body.slice(0, 2000),
  }, null, 2));
  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
