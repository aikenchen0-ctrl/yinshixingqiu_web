# WeChat Article Sync Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that activates on WeChat Official Account article editor pages, extracts the current article, and creates a new `contentSource = wechat` article in the existing xueyin backend.

**Architecture:** Keep the backend article API unchanged and build the feature entirely inside `browser-extension/`. Use a three-part extension architecture: content script for page extraction, popup for operator actions and config, and a background service worker for orchestration and API submission to `/api/articles`.

**Tech Stack:** Chrome Extension Manifest V3, React + TypeScript popup, Vite + `@crxjs/vite-plugin`, Vitest for unit tests, existing backend `/api/articles` endpoint.

---

## File Map

- Create: `browser-extension/package.json`
- Create: `browser-extension/tsconfig.json`
- Create: `browser-extension/vite.config.ts`
- Create: `browser-extension/manifest.config.ts`
- Create: `browser-extension/README.md`
- Create: `browser-extension/src/background/index.ts`
- Create: `browser-extension/src/background/message-router.ts`
- Create: `browser-extension/src/background/sync-service.ts`
- Create: `browser-extension/src/content/index.ts`
- Create: `browser-extension/src/content/page-detector.ts`
- Create: `browser-extension/src/content/wechat-article-extractor.ts`
- Create: `browser-extension/src/content/wechat-article-normalizer.ts`
- Create: `browser-extension/src/popup/index.html`
- Create: `browser-extension/src/popup/main.tsx`
- Create: `browser-extension/src/popup/App.tsx`
- Create: `browser-extension/src/popup/components/SyncButton.tsx`
- Create: `browser-extension/src/popup/components/SyncResultPanel.tsx`
- Create: `browser-extension/src/popup/components/ArticleMetaPreview.tsx`
- Create: `browser-extension/src/popup/components/SettingsForm.tsx`
- Create: `browser-extension/src/shared/api-client.ts`
- Create: `browser-extension/src/shared/article-mapper.ts`
- Create: `browser-extension/src/shared/constants.ts`
- Create: `browser-extension/src/shared/storage.ts`
- Create: `browser-extension/src/shared/types.ts`
- Create: `browser-extension/src/styles/popup.css`
- Create: `browser-extension/tests/page-detector.test.ts`
- Create: `browser-extension/tests/article-extractor.test.ts`
- Create: `browser-extension/tests/article-mapper.test.ts`
- Create: `browser-extension/tests/storage.test.ts`
- Create: `browser-extension/tests/sync-service.test.ts`
- Modify: `package.json`

### Task 1: Scaffold the extension workspace and activation rules

**Files:**
- Create: `browser-extension/package.json`
- Create: `browser-extension/tsconfig.json`
- Create: `browser-extension/vite.config.ts`
- Create: `browser-extension/manifest.config.ts`
- Create: `browser-extension/src/shared/constants.ts`
- Create: `browser-extension/src/content/page-detector.ts`
- Create: `browser-extension/tests/page-detector.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing detector test**

Create `browser-extension/tests/page-detector.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isWechatAppmsgEditorUrl } from '../src/content/page-detector'

describe('isWechatAppmsgEditorUrl', () => {
  it('matches the wechat article editor page', () => {
    expect(
      isWechatAppmsgEditorUrl(
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
      ),
    ).toBe(true)
  })

  it('rejects unrelated wechat pages', () => {
    expect(isWechatAppmsgEditorUrl('https://mp.weixin.qq.com/cgi-bin/home?t=home/index')).toBe(false)
  })

  it('rejects non-wechat pages', () => {
    expect(isWechatAppmsgEditorUrl('https://example.com/article/edit')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test -- page-detector
```

Expected: FAIL because the extension workspace and `page-detector.ts` do not exist yet.

- [ ] **Step 3: Create the minimal extension workspace**

Create `browser-extension/package.json`:

```json
{
  "name": "xueyin-wechat-article-sync-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@types/chrome": "^0.1.24",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.1.0",
    "jsdom": "^26.1.0",
    "typescript": "^5.9.3",
    "vite": "^8.0.3",
    "vitest": "^3.2.4"
  }
}
```

Create `browser-extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts"]
}
```

Create `browser-extension/src/shared/constants.ts`:

```ts
export const WECHAT_EDITOR_HOST = 'mp.weixin.qq.com'
export const WECHAT_EDITOR_PATH = '/cgi-bin/appmsg'
export const SYNC_MESSAGE_TYPE = 'wechat-article-sync/extract-current-article'
```

Create `browser-extension/src/content/page-detector.ts`:

```ts
import { WECHAT_EDITOR_HOST, WECHAT_EDITOR_PATH } from '../shared/constants'

export function isWechatAppmsgEditorUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return (
      url.hostname === WECHAT_EDITOR_HOST &&
      url.pathname === WECHAT_EDITOR_PATH &&
      url.searchParams.get('t') === 'media/appmsg_edit'
    )
  } catch {
    return false
  }
}
```

Create `browser-extension/manifest.config.ts`:

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '饮视微信文章同步',
  version: '0.1.0',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: '提交到小程序的文章',
  },
  permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
  host_permissions: ['https://mp.weixin.qq.com/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://mp.weixin.qq.com/cgi-bin/appmsg*'],
      js: ['src/content/index.ts'],
    },
  ],
})
```

Create `browser-extension/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
})
```

Modify the root `package.json` scripts to include:

```json
"build:extension": "npm --prefix browser-extension run build",
"test:extension": "npm --prefix browser-extension run test"
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm install
npm test -- page-detector
```

Expected: PASS with 3 passing assertions.

- [ ] **Step 5: Commit the extension scaffold**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add package.json browser-extension
git commit -m "feat(extension): scaffold wechat article sync workspace"
```

Expected: commit contains the new extension workspace and detector test.

### Task 2: Implement article extraction and normalization

**Files:**
- Create: `browser-extension/src/shared/types.ts`
- Create: `browser-extension/src/content/wechat-article-extractor.ts`
- Create: `browser-extension/src/content/wechat-article-normalizer.ts`
- Create: `browser-extension/src/content/index.ts`
- Create: `browser-extension/tests/article-extractor.test.ts`

- [ ] **Step 1: Write the failing extractor test**

Create `browser-extension/tests/article-extractor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extractWechatArticleFromDocument } from '../src/content/wechat-article-extractor'

describe('extractWechatArticleFromDocument', () => {
  it('extracts article title, summary, source url, and normalized content blocks', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <h1 id="activity-name">测试标题</h1>
        <div id="js_author_name">测试作者</div>
        <div id="js_digest">测试摘要</div>
        <div class="rich_media_content" id="js_content">
          <p>第一段正文</p>
          <p><strong>第二段加粗</strong></p>
          <img data-src="https://mmbiz.qpic.cn/test-cover.png" />
          <blockquote>引用内容</blockquote>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl:
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    })

    expect(result.title).toBe('测试标题')
    expect(result.summary).toBe('测试摘要')
    expect(result.author).toBe('测试作者')
    expect(result.sourceUrl).toContain('mp.weixin.qq.com/cgi-bin/appmsg')
    expect(result.blocks.map((item) => item.type)).toEqual(['paragraph', 'paragraph', 'image', 'blockquote'])
    expect(result.images).toEqual(['https://mmbiz.qpic.cn/test-cover.png'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test -- article-extractor
```

Expected: FAIL because the extractor and shared types do not exist yet.

- [ ] **Step 3: Implement the extractor and normalizer**

Create `browser-extension/src/shared/types.ts`:

```ts
export type WechatArticleBlock =
  | { type: 'paragraph'; text: string; bold?: boolean }
  | { type: 'blockquote'; text: string }
  | { type: 'image'; url: string }
  | { type: 'divider' }

export interface ExtractedWechatArticle {
  title: string
  summary: string
  author: string
  sourceUrl: string
  coverUrl: string
  images: string[]
  blocks: WechatArticleBlock[]
}
```

Create `browser-extension/src/content/wechat-article-normalizer.ts`:

```ts
import type { WechatArticleBlock } from '../shared/types'

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeWechatArticleContent(root: ParentNode): WechatArticleBlock[] {
  const blocks: WechatArticleBlock[] = []

  root.querySelectorAll('p, blockquote, img, hr').forEach((node) => {
    if (node instanceof HTMLParagraphElement) {
      const text = normalizeText(node.textContent || '')
      if (text) {
        blocks.push({
          type: 'paragraph',
          text,
          bold: Boolean(node.querySelector('strong, b')),
        })
      }
      return
    }

    if (node instanceof HTMLQuoteElement) {
      const text = normalizeText(node.textContent || '')
      if (text) {
        blocks.push({ type: 'blockquote', text })
      }
      return
    }

    if (node instanceof HTMLImageElement) {
      const url = normalizeText(node.getAttribute('data-src') || node.getAttribute('src') || '')
      if (url) {
        blocks.push({ type: 'image', url })
      }
      return
    }

    if (node instanceof HTMLHRElement) {
      blocks.push({ type: 'divider' })
    }
  })

  return blocks
}
```

Create `browser-extension/src/content/wechat-article-extractor.ts`:

```ts
import type { ExtractedWechatArticle } from '../shared/types'
import { normalizeWechatArticleContent } from './wechat-article-normalizer'

function readText(selector: string, root: ParentNode = document) {
  return String(root.querySelector(selector)?.textContent || '').trim()
}

export function extractWechatArticleFromDocument(documentRef: Document, input: { pageUrl: string }): ExtractedWechatArticle {
  const contentRoot =
    documentRef.querySelector('#js_content') ||
    documentRef.querySelector('.rich_media_content') ||
    documentRef.body

  const blocks = normalizeWechatArticleContent(contentRoot)
  const images = blocks.filter((item) => item.type === 'image').map((item) => item.url)

  return {
    title: readText('#activity-name', documentRef),
    summary: readText('#js_digest', documentRef),
    author: readText('#js_author_name', documentRef),
    sourceUrl: input.pageUrl,
    coverUrl: images[0] || '',
    images,
    blocks,
  }
}
```

Create `browser-extension/src/content/index.ts`:

```ts
import { SYNC_MESSAGE_TYPE } from '../shared/constants'
import { extractWechatArticleFromDocument } from './wechat-article-extractor'
import { isWechatAppmsgEditorUrl } from './page-detector'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== SYNC_MESSAGE_TYPE) {
    return
  }

  if (!isWechatAppmsgEditorUrl(window.location.href)) {
    sendResponse({ ok: false, message: '当前页面不是微信公众号图文编辑页' })
    return
  }

  sendResponse({
    ok: true,
    data: extractWechatArticleFromDocument(document, { pageUrl: window.location.href }),
  })
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test -- article-extractor
```

Expected: PASS with the extractor test succeeding.

- [ ] **Step 5: Commit the extraction layer**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add browser-extension/src/content browser-extension/src/shared/types.ts browser-extension/tests/article-extractor.test.ts
git commit -m "feat(extension): extract wechat article editor content"
```

Expected: commit contains content extraction and normalization only.

### Task 3: Implement article mapping, settings storage, and backend API submission

**Files:**
- Create: `browser-extension/src/shared/storage.ts`
- Create: `browser-extension/src/shared/article-mapper.ts`
- Create: `browser-extension/src/shared/api-client.ts`
- Create: `browser-extension/tests/article-mapper.test.ts`
- Create: `browser-extension/tests/storage.test.ts`

- [ ] **Step 1: Write the failing mapper test**

Create `browser-extension/tests/article-mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapWechatArticleToSaveArticleInput } from '../src/shared/article-mapper'

describe('mapWechatArticleToSaveArticleInput', () => {
  it('maps extracted wechat content into the existing /api/articles payload', () => {
    const payload = mapWechatArticleToSaveArticleInput(
      {
        title: '测试标题',
        summary: '测试摘要',
        author: '测试作者',
        sourceUrl: 'https://mp.weixin.qq.com/s/test',
        coverUrl: 'https://mmbiz.qpic.cn/cover.png',
        images: ['https://mmbiz.qpic.cn/cover.png'],
        blocks: [
          { type: 'paragraph', text: '第一段' },
          { type: 'blockquote', text: '引用段落' },
          { type: 'image', url: 'https://mmbiz.qpic.cn/cover.png' },
        ],
      },
      {
        groupId: 'group_123',
      },
    )

    expect(payload.groupId).toBe('group_123')
    expect(payload.contentSource).toBe('wechat')
    expect(payload.title).toBe('测试标题')
    expect(payload.coverUrl).toBe('https://mmbiz.qpic.cn/cover.png')
    expect(payload.metadata?.sourceUrl).toBe('https://mp.weixin.qq.com/s/test')
    expect(String(payload.richContent)).toContain('<p>第一段</p>')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test -- article-mapper
```

Expected: FAIL because the mapper does not exist yet.

- [ ] **Step 3: Add the failing storage test**

Create `browser-extension/tests/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadExtensionSettings, saveExtensionSettings } from '../src/shared/storage'

const getMock = vi.fn()
const setMock = vi.fn()

beforeEach(() => {
  getMock.mockReset()
  setMock.mockReset()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: getMock,
        set: setMock,
      },
    },
  })
})

describe('extension settings storage', () => {
  it('loads empty defaults when nothing is stored', async () => {
    getMock.mockResolvedValue({})
    await expect(loadExtensionSettings()).resolves.toEqual({
      apiBaseUrl: '',
      sessionToken: '',
      groupId: '',
    })
  })

  it('writes settings back to chrome local storage', async () => {
    await saveExtensionSettings({
      apiBaseUrl: 'https://api.example.com',
      sessionToken: 'session_123',
      groupId: 'group_123',
    })

    expect(setMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 4: Implement storage, mapper, and API client**

Create `browser-extension/src/shared/storage.ts`:

```ts
export interface ExtensionSettings {
  apiBaseUrl: string
  sessionToken: string
  groupId: string
}

const SETTINGS_KEY = 'wechatArticleSync.settings'

export async function loadExtensionSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return {
    apiBaseUrl: String(result[SETTINGS_KEY]?.apiBaseUrl || ''),
    sessionToken: String(result[SETTINGS_KEY]?.sessionToken || ''),
    groupId: String(result[SETTINGS_KEY]?.groupId || ''),
  }
}

export async function saveExtensionSettings(settings: ExtensionSettings) {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
  })
}
```

Create `browser-extension/src/shared/article-mapper.ts`:

```ts
import type { ExtractedWechatArticle } from './types'

export interface SaveArticlePayload {
  groupId: string
  title: string
  summary: string
  contentText: string
  contentSource: 'wechat'
  coverUrl: string
  richContent: string
  attachments: string[]
  metadata: Record<string, unknown>
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function mapWechatArticleToSaveArticleInput(article: ExtractedWechatArticle, input: { groupId: string }): SaveArticlePayload {
  const richContent = article.blocks
    .map((block) => {
      if (block.type === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`
      if (block.type === 'blockquote') return `<blockquote>${escapeHtml(block.text)}</blockquote>`
      if (block.type === 'image') return `<p><img src="${block.url}" alt="" /></p>`
      return '<hr />'
    })
    .join('')

  const contentText = article.blocks
    .filter((block) => block.type === 'paragraph' || block.type === 'blockquote')
    .map((block) => block.text)
    .join('\n\n')

  return {
    groupId: input.groupId,
    title: article.title,
    summary: article.summary,
    contentText,
    contentSource: 'wechat',
    coverUrl: article.coverUrl,
    richContent,
    attachments: article.images,
    metadata: {
      sourceUrl: article.sourceUrl,
      author: article.author,
      images: article.images,
    },
  }
}
```

Create `browser-extension/src/shared/api-client.ts`:

```ts
import type { SaveArticlePayload } from './article-mapper'

export async function createWechatArticle(apiBaseUrl: string, sessionToken: string, payload: SaveArticlePayload) {
  const response = await fetch(new URL('/api/articles', apiBaseUrl).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': sessionToken,
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.message || '创建微信文章失败')
  }

  return result.data
}
```

- [ ] **Step 5: Run the mapper and storage tests to verify they pass**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test -- article-mapper storage
```

Expected: PASS

- [ ] **Step 6: Commit the mapping layer**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add browser-extension/src/shared browser-extension/tests/article-mapper.test.ts browser-extension/tests/storage.test.ts
git commit -m "feat(extension): map wechat articles to backend payloads"
```

Expected: commit contains mapping, API client, and local settings storage.

### Task 4: Implement popup and background sync flow

**Files:**
- Create: `browser-extension/src/background/index.ts`
- Create: `browser-extension/src/background/message-router.ts`
- Create: `browser-extension/src/background/sync-service.ts`
- Create: `browser-extension/src/popup/index.html`
- Create: `browser-extension/src/popup/main.tsx`
- Create: `browser-extension/src/popup/App.tsx`
- Create: `browser-extension/src/popup/components/SyncButton.tsx`
- Create: `browser-extension/src/popup/components/SyncResultPanel.tsx`
- Create: `browser-extension/src/popup/components/ArticleMetaPreview.tsx`
- Create: `browser-extension/src/popup/components/SettingsForm.tsx`
- Create: `browser-extension/src/styles/popup.css`
- Create: `browser-extension/tests/sync-service.test.ts`

- [ ] **Step 1: Write the failing popup flow test**

Create `browser-extension/tests/sync-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { runWechatArticleSync } from '../src/background/sync-service'

describe('runWechatArticleSync', () => {
  it('rejects when required settings are missing', async () => {
    await expect(
      runWechatArticleSync({
        tabId: 1,
        settings: {
          apiBaseUrl: '',
          sessionToken: '',
          groupId: '',
        },
        sendTabMessage: vi.fn(),
        createArticle: vi.fn(),
      }),
    ).rejects.toThrow('请先填写接口地址、Session Token 和 Group ID')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test -- sync-service
```

Expected: FAIL because the sync service does not exist yet.

- [ ] **Step 3: Implement the background flow and popup**

Create `browser-extension/src/background/sync-service.ts`:

```ts
import { createWechatArticle } from '../shared/api-client'
import { mapWechatArticleToSaveArticleInput } from '../shared/article-mapper'
import { SYNC_MESSAGE_TYPE } from '../shared/constants'
import type { ExtensionSettings } from '../shared/storage'
import type { ExtractedWechatArticle } from '../shared/types'

export async function runWechatArticleSync(input: {
  tabId: number
  settings: ExtensionSettings
  sendTabMessage: (tabId: number, message: unknown) => Promise<{ ok: boolean; data?: ExtractedWechatArticle; message?: string }>
  createArticle: typeof createWechatArticle
}) {
  const { apiBaseUrl, sessionToken, groupId } = input.settings
  if (!apiBaseUrl || !sessionToken || !groupId) {
    throw new Error('请先填写接口地址、Session Token 和 Group ID')
  }

  const extracted = await input.sendTabMessage(input.tabId, { type: SYNC_MESSAGE_TYPE })
  if (!extracted.ok || !extracted.data) {
    throw new Error(extracted.message || '当前页面文章抓取失败')
  }

  const payload = mapWechatArticleToSaveArticleInput(extracted.data, { groupId })
  return input.createArticle(apiBaseUrl, sessionToken, payload)
}
```

Create `browser-extension/src/background/index.ts`:

```ts
import { createWechatArticle } from '../shared/api-client'
import { loadExtensionSettings } from '../shared/storage'
import { runWechatArticleSync } from './sync-service'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'popup/run-sync' || typeof message.tabId !== 'number') {
    return
  }

  void (async () => {
    try {
      const settings = await loadExtensionSettings()
      const result = await runWechatArticleSync({
        tabId: message.tabId,
        settings,
        sendTabMessage: (tabId, payload) => chrome.tabs.sendMessage(tabId, payload),
        createArticle: createWechatArticle,
      })

      sendResponse({ ok: true, data: result })
    } catch (error) {
      sendResponse({ ok: false, message: error instanceof Error ? error.message : '同步失败' })
    }
  })()

  return true
})
```

Create `browser-extension/src/background/message-router.ts`:

```ts
export async function sendMessageToActiveWechatTab<T>(tabId: number, message: unknown) {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>
}
```

Create `browser-extension/src/popup/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>饮视微信文章同步</title>
    <script type="module" src="./main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

Create `browser-extension/src/popup/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../styles/popup.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Create `browser-extension/src/popup/App.tsx` with state for:

```tsx
const [tabId, setTabId] = useState<number | null>(null)
const [busy, setBusy] = useState(false)
const [error, setError] = useState('')
const [notice, setNotice] = useState('')
```

and a submit handler:

```tsx
async function handleSync() {
  if (tabId === null) {
    setError('当前没有可用的微信文章编辑页')
    return
  }

  setBusy(true)
  setError('')
  setNotice('')

  const result = await chrome.runtime.sendMessage({
    type: 'popup/run-sync',
    tabId,
  })

  if (!result?.ok) {
    setError(result?.message || '同步失败')
    setBusy(false)
    return
  }

  setNotice('已提交到小程序文章')
  setBusy(false)
}
```

Render the required primary button text exactly:

```tsx
<button disabled={busy} onClick={handleSync} type="button">
  {busy ? '提交中...' : '提交到小程序的文章'}
</button>
```

- [ ] **Step 4: Run the sync-service test and full extension test suite**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension
npm test
```

Expected: PASS with detector, extractor, mapper, storage, and sync-service tests all green.

- [ ] **Step 5: Commit the interactive extension flow**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add browser-extension/src/background browser-extension/src/popup browser-extension/src/styles
git commit -m "feat(extension): add popup and sync workflow"
```

Expected: commit contains popup UI and background orchestration only.

### Task 5: Build and verify the complete extension against the existing article API

**Files:**
- Create: `browser-extension/README.md`
- Modify: `browser-extension/manifest.config.ts`
- Modify: `browser-extension/src/shared/api-client.ts`

- [ ] **Step 1: Write the final operator documentation**

Create `browser-extension/README.md`:

```md
# 饮视微信文章同步插件

## 使用前配置

1. 打开插件 popup
2. 填写接口地址
3. 填写 Session Token
4. 填写 Group ID

## 使用步骤

1. 打开微信公众号图文编辑页
2. 点击插件图标
3. 点击“提交到小程序的文章”
4. 等待返回创建结果
```

- [ ] **Step 2: Build the extension bundle**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run build:extension
```

Expected: PASS and Vite emits a production extension bundle under the extension dist output.

- [ ] **Step 3: Verify the existing article API still compiles**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
npm run check:backend
```

Expected: PASS because this feature reuses the existing backend article API without server changes.

- [ ] **Step 4: Manual browser verification**

Load the built extension in Chrome and check:

```text
1. Open a URL like https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit...
2. Confirm the popup opens and shows the button “提交到小程序的文章”.
3. Confirm the popup blocks submission if API Base URL, Session Token, or Group ID is empty.
4. Fill settings with valid values.
5. Click the sync button.
6. Confirm the backend creates a new article under the configured group.
7. Confirm the created article uses contentSource = wechat.
8. Confirm title, summary, cover, attachments, and richContent are populated from the WeChat page when available.
```

Expected: a new article is created through `POST /api/articles` with `contentSource = wechat`.

- [ ] **Step 5: Commit the final verified extension**

Run:

```bash
cd /home/youshaocong/.mnt_hgfs_all/xueyinMiniapp
git add browser-extension package.json
git commit -m "feat(extension): sync wechat editor articles into miniapp"
```

Expected: final commit contains the full extension implementation and usage documentation.
