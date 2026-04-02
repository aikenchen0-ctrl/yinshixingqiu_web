const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  await page.goto('http://127.0.0.1:5174/income', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  const frame = page.frameLocator('iframe.reference-frame');
  await frame.locator('.navigation .subtitle').filter({ hasText: '推广数据' }).click();
  await page.waitForTimeout(1500);
  const text = await page.locator('body').innerText();
  console.log(JSON.stringify({
    url: page.url(),
    hasPromotionPage: text.includes('流量转化率: 0.00%'),
  }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
