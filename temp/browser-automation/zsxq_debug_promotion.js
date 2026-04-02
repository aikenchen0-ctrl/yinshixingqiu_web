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
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    const target = nodes.find((el) => (el.innerText || '').trim() === '推广拉新' && String(el.className || '').includes('title'));
    if (target) target.click();
  });
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    return nodes.map((el) => {
      const text = (el.innerText || '').trim();
      if (!text || text.length > 20) return null;
      const rect = el.getBoundingClientRect();
      if (rect.left > 320 || rect.width < 40 || rect.height < 20) return null;
      const className = String(el.className || '');
      if (!className.includes('title') && !className.includes('subtitle')) return null;
      return { text, className, top: rect.top, left: rect.left };
    }).filter(Boolean).sort((a, b) => a.top - b.top);
  });
  console.log(JSON.stringify(data, null, 2));
  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
