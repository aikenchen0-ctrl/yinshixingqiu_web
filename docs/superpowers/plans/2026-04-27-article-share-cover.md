# Article Share Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the WeChat article detail share button open a cover-selection flow, then share the chosen article image with a mini program entrance back to the same article.

**Architecture:** Keep the change local to the existing article detail flow. Derive share-image candidates from article detail view data in `article-view.ts`, expose a small pure helper for test coverage, and switch the detail-page share button from native card sharing to a tap-driven `wx.showShareImageMenu` flow. Preserve a minimal fallback path when articles have no body images or image download fails.

**Tech Stack:** WeChat Mini Program, TypeScript, CommonJS shared helpers, `node:test`, `npm run check:miniprogram`

---

### Task 1: Add failing tests for share-image candidate extraction

**Files:**
- Modify: `scripts/articles-page.test.js`
- Modify: `miniprogram/pages/articles/shared.js`

- [ ] **Step 1: Write the failing tests**

```js
test('collectArticleShareImageCandidates prefers rich-content images before inline cards and cover', () => {
  assert.deepEqual(
    collectArticleShareImageCandidates({
      richContent: '<p>段落</p><img src="https://example.com/body-1.jpg" /><img src="https://example.com/body-2.jpg" />',
      bodyBlocks: [
        { type: 'wechat-card', coverImage: 'https://example.com/card.jpg' },
      ],
      coverImage: 'https://example.com/cover.jpg',
    }),
    [
      'https://example.com/body-1.jpg',
      'https://example.com/body-2.jpg',
      'https://example.com/card.jpg',
      'https://example.com/cover.jpg',
    ]
  )
})

test('collectArticleShareImageCandidates de-duplicates empty and repeated urls', () => {
  assert.deepEqual(
    collectArticleShareImageCandidates({
      richContent: '<img src="https://example.com/body.jpg" /><img src="https://example.com/body.jpg" />',
      bodyBlocks: [
        { type: 'wechat-card', coverImage: 'https://example.com/body.jpg' },
        { type: 'wechat-card', coverImage: '' },
      ],
      coverImage: 'https://example.com/body.jpg',
    }),
    ['https://example.com/body.jpg']
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/articles-page.test.js`
Expected: FAIL because `collectArticleShareImageCandidates` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```js
function collectArticleShareImageCandidates(input) {
  // extract src values from rich html, append inline-card covers and final cover, then de-duplicate
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/articles-page.test.js`
Expected: PASS for the new share-image tests.

### Task 2: Expose share-image candidates from article detail view data

**Files:**
- Modify: `miniprogram/utils/article-view.ts`

- [ ] **Step 1: Write the failing TypeScript usage**

Add `shareImageCandidates: string[]` to `ArticleDetailViewModel`, initialize it in `createEmptyArticleDetailViewModel`, and set it in `buildRemoteArticleDetail` by calling the shared helper with current rich content, body blocks, and cover image.

- [ ] **Step 2: Run type-check to verify it fails if wiring is incomplete**

Run: `npm run check:miniprogram`
Expected: FAIL until every `ArticleDetailViewModel` construction path includes `shareImageCandidates`.

- [ ] **Step 3: Write minimal implementation**

```ts
const shareImageCandidates = collectArticleShareImageCandidates({
  richContent: visibleRichContent,
  bodyBlocks,
  coverImage: normalizeAssetUrl(String(article.coverUrl || '')),
})
```

- [ ] **Step 4: Run type-check to verify it passes**

Run: `npm run check:miniprogram`
Expected: PASS for the new data shape.

### Task 3: Replace native share with tap-driven image share flow

**Files:**
- Modify: `miniprogram/pages/articles/detail.ts`
- Modify: `miniprogram/pages/articles/detail.wxml`

- [ ] **Step 1: Write the failing behavior wiring**

Switch the WeChat-article nav share button from `open-type="share"` to `bindtap="onTapShare"`, then implement:

```ts
async onTapShare() {
  // choose candidate, download file, call wx.showShareImageMenu
}
```

- [ ] **Step 2: Run type-check to verify it fails if handlers/helpers are missing**

Run: `npm run check:miniprogram`
Expected: FAIL until `onTapShare` and helper methods are defined.

- [ ] **Step 3: Write minimal implementation**

Implementation requirements:

```ts
if (!articleId || loading) return
if (!wx.showShareImageMenu) { toast('当前微信版本不支持图片分享'); return }
if (candidates.length === 0) { toast('文章里没有可分享的图片'); return }
if (candidates.length === 1) { shareCandidate(candidates[0]); return }
const picked = await wx.showActionSheet(...)
const tempFilePath = await wx.downloadFile(...)
await wx.showShareImageMenu({
  path: tempFilePath,
  needShowEntrance: true,
  entrancePath: `/pages/articles/detail?id=${encodeURIComponent(articleId)}&source=wechat`,
})
```

- [ ] **Step 4: Run type-check to verify it passes**

Run: `npm run check:miniprogram`
Expected: PASS with the new share flow compiled.

### Task 4: Preserve card-share fallback for menu sharing

**Files:**
- Modify: `miniprogram/pages/articles/detail.ts`

- [ ] **Step 1: Keep `onShareAppMessage` intact**

Retain `onShareAppMessage` so right-top system menu sharing still produces a normal card payload, but make its `imageUrl` prefer the first derived `shareImageCandidates[0]` before falling back to `coverImage`.

- [ ] **Step 2: Run tests and type-check**

Run: `node --test scripts/articles-page.test.js && npm run check:miniprogram`
Expected: PASS for both commands.

- [ ] **Step 3: Review runtime edge cases**

Confirm these branches exist in code:

```ts
// no candidates
// user cancels action sheet
// downloadFile non-200
// showShareImageMenu fail callback
```

### Task 5: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run unit-style tests**

Run: `node --test scripts/articles-page.test.js`
Expected: PASS

- [ ] **Step 2: Run full mini program type-check**

Run: `npm run check:miniprogram`
Expected: PASS

- [ ] **Step 3: Inspect diff for touched files**

Run: `git diff -- miniprogram/pages/articles/detail.ts miniprogram/pages/articles/detail.wxml miniprogram/utils/article-view.ts miniprogram/pages/articles/shared.js scripts/articles-page.test.js`
Expected: Only the article share-cover changes plus any already-existing unrelated local edits in those files.
