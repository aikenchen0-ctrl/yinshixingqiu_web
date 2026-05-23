# Wechat Card Cover Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser extension prefer a WeChat article card cover image over the first ordinary body image when importing official WeChat articles.

**Architecture:** Keep the change inside the extension content extractor. Add one failing extractor test that models a body image plus a linked WeChat card image, implement a minimal DOM helper that finds a card cover candidate inside the raw article root, and preserve the current `images`/`richContentHtml` behavior while only changing `coverUrl` selection priority.

**Tech Stack:** TypeScript, Vitest, jsdom, Chrome extension content extraction

---

### Task 1: Lock The Card-Cover Requirement With Tests

**Files:**
- Modify: `browser-extension/tests/article-extractor.test.ts`
- Modify: `browser-extension/src/content/wechat-article-extractor.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `npm test -- article-extractor.test.ts` and verify the new test fails**
- [ ] **Step 3: Add the minimal card-cover extraction helper and update `coverUrl` priority**
- [ ] **Step 4: Re-run `npm test -- article-extractor.test.ts` and verify it passes**

### Task 2: Verify No Regression In Extension Tests

**Files:**
- Verify: `browser-extension/tests/article-extractor.test.ts`
- Verify: `browser-extension/tests/article-mapper.test.ts`
- Verify: `browser-extension/tests/sync-service.test.ts`

- [ ] **Step 1: Run the focused extension test suite**
- [ ] **Step 2: Confirm the new card-cover behavior and existing import mapping still pass**
