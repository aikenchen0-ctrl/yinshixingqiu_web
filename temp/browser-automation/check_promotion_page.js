const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1365, height: 1800 } });
  await page.goto('http://127.0.0.1:5174/promotion/data', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  const out = path.join('D:/CodeDevelopment/xueyinMiniapp/temp', 'promotion-page-check.png');
  await page.screenshot({ path: out, fullPage: true });
  const text = await page.locator('body').innerText();
  console.log(JSON.stringify({
    screenshot: out,
    hasPromotionTitle: text.includes('流量转化率: 0.00%'),
    hasRenewalFunnel: text.includes('进入续期页面的人数'),
  }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
