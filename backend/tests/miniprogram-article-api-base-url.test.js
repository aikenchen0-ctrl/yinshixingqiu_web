const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const tempOutDir = path.join(repoRoot, 'temp', 'miniprogram-article-api-test');

function compileMiniprogramModules() {
  fs.rmSync(tempOutDir, { recursive: true, force: true });
  fs.mkdirSync(tempOutDir, { recursive: true });

  const compileResult = spawnSync(
    'npx',
    [
      '-y',
      '-p',
      'typescript@5.6.3',
      'tsc',
      '--module',
      'CommonJS',
      '--target',
      'ES2020',
      '--esModuleInterop',
      '--allowSyntheticDefaultImports',
      '--skipLibCheck',
      '--noEmitOnError',
      'false',
      '--outDir',
      tempOutDir,
      path.join(repoRoot, 'miniprogram', 'utils', 'request.ts'),
      path.join(repoRoot, 'miniprogram', 'utils', 'planet-api.ts'),
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  const requestOutputPath = path.join(tempOutDir, 'request.js');
  const planetApiOutputPath = path.join(tempOutDir, 'planet-api.js');
  const hasOutputs = fs.existsSync(requestOutputPath) && fs.existsSync(planetApiOutputPath);

  if (compileResult.status !== 0 && !hasOutputs) {
    throw new Error((compileResult.stderr || compileResult.stdout || 'miniprogram compile failed').trim());
  }
}

function loadCompiledModules(envVersion) {
  compileMiniprogramModules();

  for (const cacheKey of Object.keys(require.cache)) {
    if (cacheKey.startsWith(tempOutDir)) {
      delete require.cache[cacheKey];
    }
  }

  global.wx = {
    getStorageSync() {
      return false;
    },
    getAccountInfoSync() {
      return { miniProgram: { envVersion } };
    },
  };

  const requestModule = require(path.join(tempOutDir, 'request.js'));
  const planetApiModule = require(path.join(tempOutDir, 'planet-api.js'));
  return { requestModule, planetApiModule };
}

async function captureArticleDetailBaseUrl(envVersion) {
  const { requestModule, planetApiModule } = loadCompiledModules(envVersion);
  let capturedOptions = null;

  requestModule.request = async (options) => {
    capturedOptions = options;
    return { ok: true, data: {} };
  };

  await planetApiModule.fetchArticleDetail('article-123');
  assert.ok(capturedOptions, 'expected article detail request to be captured');
  return {
    activeBaseUrl: requestModule.getApiBaseUrl(),
    requestBaseUrl: capturedOptions.baseUrl,
  };
}

test('develop 环境下文章接口应跟随当前本地后端地址', async () => {
  const result = await captureArticleDetailBaseUrl('develop');
  assert.equal(result.activeBaseUrl, 'http://192.168.31.127:3000');
  assert.equal(result.requestBaseUrl, result.activeBaseUrl);
});

test('trial 环境下文章接口仍应走线上地址', async () => {
  const result = await captureArticleDetailBaseUrl('trial');
  assert.equal(result.activeBaseUrl, 'https://xueyinx.cn');
  assert.equal(result.requestBaseUrl, 'https://xueyinx.cn');
});
