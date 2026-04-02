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
  await page.waitForTimeout(5000);
  const data = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    return nodes.map((el) => {
      const text = (el.innerText || '').trim();
      if (!text || text.length > 30) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      if (rect.width < 20 || rect.height < 14) return null;
      if (rect.left > window.innerWidth * 0.5) return null;
      return {
        tag: el.tagName,
        text,
        className: el.className,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }).filter(Boolean);
  });
  console.log(JSON.stringify({ url: page.url(), title: await page.title(), data }, null, 2));
  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
