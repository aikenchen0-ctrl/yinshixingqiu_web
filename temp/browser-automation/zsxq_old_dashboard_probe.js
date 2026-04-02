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

  await page.locator('text=切换到旧数据后台').first().click();
  await page.waitForTimeout(5000);

  const body = await page.locator('body').innerText().catch(() => '');
  const sidebar = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, .menu-item, .ant-menu-item, .ant-menu-submenu-title, li, .title, .subtitle'))
      .map((el) => {
        const text = (el.innerText || '').trim();
        if (!text || text.length > 40) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        if (rect.width < 30 || rect.height < 16) return null;
        if (rect.left > window.innerWidth * 0.4) return null;
        return {
          text,
          tag: el.tagName,
          className: String(el.className || ''),
          href: el.getAttribute('href'),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top)
      .slice(0, 300);
  });

  console.log(JSON.stringify({
    url: page.url(),
    title: await page.title(),
    body: body.slice(0, 2000),
    sidebar,
  }, null, 2));

  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
