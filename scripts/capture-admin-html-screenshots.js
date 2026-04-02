const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const rootDir = path.resolve(process.argv[2] || path.join(process.cwd(), '前端页面-管理端'));
const outputDir = path.join(rootDir, 'screenshots');
const manifestPath = path.join(outputDir, 'manifest.json');
const viewport = { width: 1600, height: 2200 };

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
}

function getHtmlFiles(dirPath) {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

async function capturePage(browser, htmlFilePath) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1.25,
  });

  const fileUrl = `file:///${htmlFilePath.replace(/\\/g, '/')}`;
  const baseName = path.basename(htmlFilePath, '.html');
  const screenshotName = `${sanitizeFileName(baseName)}.png`;
  const screenshotPath = path.join(outputDir, screenshotName);

  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
  });

  await page.goto(fileUrl, {
    waitUntil: 'load',
    timeout: 30000,
  });

  await page.waitForTimeout(2200);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  const title = await page.title();
  await page.close();

  return {
    source: path.basename(htmlFilePath),
    screenshot: screenshotName,
    title,
  };
}

async function main() {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`目录不存在: ${rootDir}`);
  }

  ensureDir(outputDir);

  const htmlFiles = getHtmlFiles(rootDir);
  if (!htmlFiles.length) {
    throw new Error(`未在目录中找到 html 文件: ${rootDir}`);
  }

  const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await chromium.launch({
    headless: true,
    executablePath,
  });

  const manifest = [];

  for (const htmlFile of htmlFiles) {
    process.stdout.write(`Capturing ${path.basename(htmlFile)} ...\n`);
    try {
      const item = await capturePage(browser, htmlFile);
      manifest.push(item);
    } catch (error) {
      manifest.push({
        source: path.basename(htmlFile),
        error: error.message,
      });
      process.stdout.write(`Failed ${path.basename(htmlFile)}: ${error.message}\n`);
    }
  }

  await browser.close();

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  process.stdout.write(`Done. Manifest written to ${manifestPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
