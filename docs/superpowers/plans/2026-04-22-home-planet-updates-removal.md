# Home Planet Updates Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the entire "饮视星球动态" module from the miniapp home page.

**Architecture:** This is a direct UI/data cleanup. Delete the WXML section, remove the now-unused mock data type and array from the page logic, and remove the now-unused `.planet-*` styles while keeping the existing hero button navigation intact.

**Tech Stack:** WeChat miniapp WXML/TypeScript/SCSS.

---

### Task 1: Remove the planet updates section

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.ts`
- Modify: `miniprogram/pages/index/index.scss`

- [ ] **Step 1: Delete the planet updates section from WXML**
- [ ] **Step 2: Delete the unused `PlanetUpdate` type and `planetUpdates` mock data from TS**
- [ ] **Step 3: Delete the unused `.planet-*` styles from SCSS**
- [ ] **Step 4: Run `npm run check:miniprogram`**
