# Course Calendar Month Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the miniapp course calendar navigate by natural month and allow direct month picking, including months without course updates.

**Architecture:** Extract the month-navigation and selection rules into a small pure helper so the new behavior can be covered with a failing test first. Then wire the helper back into the existing course calendar page, keeping the current calendar grid and course-card rendering intact while changing month state from "months with data only" to "any calendar month".

**Tech Stack:** WeChat miniapp TypeScript/WXML/SCSS, Node.js built-in test runner, TypeScript compiler check.

---

### Task 1: Add failing tests for natural month navigation

**Files:**
- Create: `backend/tests/course-calendar-state.test.js`
- Test: `backend/tests/course-calendar-state.test.js`

- [ ] **Step 1: Write a failing test for empty-month selection**
- [ ] **Step 2: Run `node --test backend/tests/course-calendar-state.test.js` and confirm it fails because helper module does not exist**

### Task 2: Implement pure month-state helpers

**Files:**
- Create: `miniprogram/pages/course/calendar-state.js`
- Modify: `backend/tests/course-calendar-state.test.js`
- Test: `backend/tests/course-calendar-state.test.js`

- [ ] **Step 1: Implement helpers for `shiftMonthKey`, `resolveMonthSelection`, and `buildPickerValue`**
- [ ] **Step 2: Run `node --test backend/tests/course-calendar-state.test.js` and confirm it passes**

### Task 3: Wire the course calendar page to the new helpers

**Files:**
- Modify: `miniprogram/pages/course/calendar.ts`
- Modify: `miniprogram/pages/course/calendar.wxml`
- Modify: `miniprogram/pages/course/calendar.scss`

- [ ] **Step 1: Replace month navigation logic so prev/next move by natural month**
- [ ] **Step 2: Add month picker state and `onPickerChange` handler**
- [ ] **Step 3: Update the empty-state copy so empty months are understandable**

### Task 4: Verify and shared-folder readback

**Files:**
- Modify: `docs/superpowers/specs/2026-04-22-course-calendar-month-navigation-design.md`
- Modify: `docs/superpowers/plans/2026-04-22-course-calendar-month-navigation.md`

- [ ] **Step 1: Run `node --test backend/tests/course-calendar-state.test.js`**
- [ ] **Step 2: Run `npm run check:miniprogram`**
- [ ] **Step 3: Re-open the two markdown files from the shared folder to confirm they are readable**
