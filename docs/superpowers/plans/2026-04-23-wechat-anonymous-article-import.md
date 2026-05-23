# WeChat Anonymous Article Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the browser extension import WeChat articles into the miniapp public article feed without requiring plugin-side config, session identity, or group selection.

**Architecture:** Keep WeChat extraction in `browser-extension/`, but route submission to a new backend endpoint dedicated to anonymous WeChat imports. The backend will create a public `ARTICLE` with `contentSource = wechat` and a fixed anonymous display author, while preserving original source metadata.

**Tech Stack:** Chrome Extension MV3, React + TypeScript, Vitest, Node.js backend services, existing Prisma-backed content model.

---

## File Map

- Modify: `browser-extension/manifest.config.ts`
- Modify: `browser-extension/src/background/sync-service.ts`
- Modify: `browser-extension/src/shared/api-client.ts`
- Modify: `browser-extension/src/shared/storage.ts`
- Modify: `browser-extension/tests/sync-service.test.ts`
- Modify: `browser-extension/tests/storage.test.ts`
- Modify: `backend/src/server.js`
- Modify: `backend/src/services/articleService.js`
- Create: `backend/tests/wechat-anonymous-import.test.js`

### Task 1: Lock the new extension behavior with failing tests

**Files:**
- Modify: `browser-extension/tests/sync-service.test.ts`
- Modify: `browser-extension/tests/storage.test.ts`

- [ ] **Step 1: Update the sync-service test to require anonymous submission without settings**

- [ ] **Step 2: Run the focused extension tests and verify they fail for the expected reason**

- [ ] **Step 3: Update storage tests to remove `apiBaseUrl` persistence expectations**

- [ ] **Step 4: Re-run the focused extension tests and keep them failing only because production code still depends on settings**

### Task 2: Switch the extension to a fixed anonymous import endpoint

**Files:**
- Modify: `browser-extension/manifest.config.ts`
- Modify: `browser-extension/src/background/sync-service.ts`
- Modify: `browser-extension/src/shared/api-client.ts`
- Modify: `browser-extension/src/shared/storage.ts`

- [ ] **Step 1: Add host permission for `https://xueyinx.cn/*`**

- [ ] **Step 2: Remove runtime settings dependency from the background sync path**

- [ ] **Step 3: Point the API client to the anonymous WeChat import endpoint on `https://xueyinx.cn`**

- [ ] **Step 4: Simplify storage helpers so they no longer expose stale sync config behavior**

- [ ] **Step 5: Run extension tests and verify they pass**

### Task 3: Add backend anonymous import support with a failing test first

**Files:**
- Create: `backend/tests/wechat-anonymous-import.test.js`
- Modify: `backend/src/services/articleService.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Add a backend test that imports a WeChat article anonymously and asserts anonymous author display plus `contentSource = wechat`**

- [ ] **Step 2: Run the backend test file directly and verify it fails before implementation**

- [ ] **Step 3: Implement an anonymous WeChat import service entry in `articleService.js`**

- [ ] **Step 4: Expose the new route from `server.js`**

- [ ] **Step 5: Re-run the backend test file and verify it passes**

### Task 4: Verify the integrated flow

**Files:**
- Modify: `browser-extension/README.md`

- [ ] **Step 1: Update plugin README usage notes to remove config instructions**

- [ ] **Step 2: Run `npm test` in `browser-extension`**

- [ ] **Step 3: Run `npm run build` in `browser-extension`**

- [ ] **Step 4: Run `node backend/tests/wechat-anonymous-import.test.js`**

- [ ] **Step 5: Review the final changed files and confirm there is no remaining plugin-side sync config dependency**
