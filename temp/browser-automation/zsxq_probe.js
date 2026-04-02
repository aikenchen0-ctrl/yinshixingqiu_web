const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
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
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
