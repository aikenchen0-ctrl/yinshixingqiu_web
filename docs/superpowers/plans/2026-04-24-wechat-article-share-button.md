# Wechat Article Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-right share button to the miniprogram wechat article detail page so users can forward the current article to friends.

**Architecture:** Keep the change local to the wechat article detail page. Generate share payloads through a small pure helper in the existing article shared module, cover it with `node:test`, then wire the page UI and `onShareAppMessage()` to the same helper so the in-page button and menu share stay consistent.

**Tech Stack:** WeChat miniprogram WXML/TS/SCSS, Node `node:test`

---

### Task 1: Add Share Payload Test Coverage

**Files:**
- Modify: `scripts/articles-page.test.js`
- Modify: `miniprogram/pages/articles/shared.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the article page test file and verify the new test fails**
- [ ] **Step 3: Add the minimal helper that builds article detail share payloads**
- [ ] **Step 4: Re-run the article page test file and verify it passes**

### Task 2: Wire The Detail Page Share Button

**Files:**
- Modify: `miniprogram/pages/articles/detail.wxml`
- Modify: `miniprogram/pages/articles/detail.ts`
- Modify: `miniprogram/pages/articles/detail.scss`

- [ ] **Step 1: Add a right-slot share button to the custom navigation bar in the wechat article detail page**
- [ ] **Step 2: Implement `onShareAppMessage()` with the tested helper**
- [ ] **Step 3: Add button styles that fit the reference layout without disturbing the title**
- [ ] **Step 4: Run miniprogram type-check and the article page tests**
