# Home Quick Entry Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the entire 4-card quick-entry module from the miniapp home page.

**Architecture:** This is a direct UI removal. Delete the WXML section, remove the now-unused click handler from the page logic, and remove the now-unused `.quick-*` styles so the next section moves up naturally.

**Tech Stack:** WeChat miniapp WXML/TypeScript/SCSS.

---

### Task 1: Remove the quick-entry section

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.ts`
- Modify: `miniprogram/pages/index/index.scss`

- [ ] **Step 1: Delete the quick-entry section from WXML**
- [ ] **Step 2: Delete the unused `onQuickAction` method from TS**
- [ ] **Step 3: Delete the unused `.quick-*` styles from SCSS**
- [ ] **Step 4: Run `npm run check:miniprogram`**
