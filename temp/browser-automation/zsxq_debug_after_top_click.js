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
  await page.mouse.click(243, 189);
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    const sidebarItems = nodes.map((el) => {
      const rawText = (el.innerText || '').trim();
      if (!rawText || rawText.length > 20) return null;
      const rect = el.getBoundingClientRect();
      if (rect.left > 320 || rect.width < 40 || rect.height < 20) return null;
      const className = String(el.className || '');
      if (!className.includes('title') && !className.includes('subtitle')) return null;
      if (className.includes('header-container') || className.includes('title-bar')) return null;
      const normalizedText = rawText.replace(/\nnew$/, '').trim();
      let itemType = null;
      if (className.includes('subtitle')) itemType = 'sub';
      else if (className.includes('title')) itemType = 'top';
      return itemType ? {
        text: normalizedText,
        type: itemType,
        top: rect.top,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        className,
      } : null;
    }).filter(Boolean).sort((a, b) => a.top - b.top);
    return {
      url: location.href,
      items: sidebarItems,
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
