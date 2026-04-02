const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1548, height: 1074 } });
  await page.goto('http://127.0.0.1:5174/income', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  const metrics = await page.evaluate(() => {
    const shell = document.querySelector('.reference-shell');
    const frame = document.querySelector('.reference-frame');
    return {
      shellHeight: shell ? getComputedStyle(shell).height : null,
      shellMinHeight: shell ? getComputedStyle(shell).minHeight : null,
      frameHeight: frame ? getComputedStyle(frame).height : null,
      bodyHeight: getComputedStyle(document.body).height,
      viewportHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
  const out = path.join('D:/CodeDevelopment/xueyinMiniapp/temp', 'admin-income-check.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log(JSON.stringify({ metrics, screenshot: out }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
