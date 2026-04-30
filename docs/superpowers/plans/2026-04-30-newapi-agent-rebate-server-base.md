# NewAPI Agent Rebate Server Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the server's current `newapi-plus-main-nav` deployment snapshot into a local working directory and integrate the agent rebate feature set from `newapi-plus-agent-rebate-220f1b1` without changing unrelated server behavior.

**Architecture:** Treat the copied server snapshot as the single source of truth, then port only the agent rebate data model, controller wiring, top-up settlement hook, routes, page route, sidebar entry, and user-management UI fields. Drive the backend work with test-first changes copied into the new local base repo, then port the minimum frontend files needed to surface the feature.

**Tech Stack:** Go, GORM, Gin, React, Semi UI, npm, git

---

### Task 1: Create the Local Server-Base Working Copy

**Files:**
- Create: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/`
- Verify source: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/`
- Reference server snapshot: `/home/ubuntu/newapi-plus-main-nav/`

- [ ] **Step 1: Remove any stale local target directory if it already exists**

Run:

```bash
test ! -e /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base
```

Expected: exit `0`

- [ ] **Step 2: Copy the server snapshot into the new local working directory**

Run:

```bash
scp -r ubuntu@43.164.191.110:/home/ubuntu/newapi-plus-main-nav /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base
```

Expected: local directory created with Go backend and `web/` frontend

- [ ] **Step 3: Verify the copy is complete and readable**

Run:

```bash
ls -la /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base | sed -n '1,80p'
```

Expected: shows `go.mod`, `main.go`, `controller/`, `model/`, `router/`, `web/`

- [ ] **Step 4: Commit the untouched local base snapshot**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base
git commit -m "chore: add local server base snapshot for newapi"
```

### Task 2: Add Failing Backend Tests for Agent Rebate

**Files:**
- Create: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/agent_rebate_test.go`
- Create: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/agent_rebate_topup_test.go`
- Create: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/controller/agent_rebate_test.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/agent_rebate_test.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/agent_rebate_topup_test.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/controller/agent_rebate_test.go`

- [ ] **Step 1: Copy the agent rebate tests into the local base**

Run:

```bash
cp /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/agent_rebate_test.go /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/agent_rebate_test.go
cp /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/agent_rebate_topup_test.go /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/agent_rebate_topup_test.go
cp /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/controller/agent_rebate_test.go /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/controller/agent_rebate_test.go
```

Expected: the three test files exist in the server-base copy

- [ ] **Step 2: Run the model tests and confirm they fail for missing production code**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base
go test ./model/... ./controller/...
```

Expected: FAIL because `AgentRebateRecord`, `ApplyAgentRebateForTopUp`, `GetAgentRebateSelf`, or related symbols are missing

- [ ] **Step 3: Commit the failing tests**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base/model/agent_rebate_test.go newapi-plus-main-nav-server-base/model/agent_rebate_topup_test.go newapi-plus-main-nav-server-base/controller/agent_rebate_test.go
git commit -m "test: add failing agent rebate tests to server base"
```

### Task 3: Port the Backend Agent Rebate Model and Migration Wiring

**Files:**
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/user.go`
- Create: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/agent_rebate.go`
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/main.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/user.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/agent_rebate.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/main.go`

- [ ] **Step 1: Add the user-level agent rebate fields to the local server base**

Port these fields into `model.User`:

```go
IsAgent                  bool    `json:"is_agent" gorm:"default:false"`
AgentRebateRateBps       int     `json:"agent_rebate_rate_bps" gorm:"type:int;default:0" validate:"min=0,max=10000"`
AgentRebateBalance       float64 `json:"agent_rebate_balance" gorm:"type:decimal(12,6);not null;default:0"`
AgentRebateHistoryAmount float64 `json:"agent_rebate_history_amount" gorm:"type:decimal(12,6);not null;default:0"`
```

- [ ] **Step 2: Copy the full agent rebate model implementation**

Run:

```bash
cp /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/model/agent_rebate.go /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/model/agent_rebate.go
```

Expected: `model/agent_rebate.go` now exists in the local base

- [ ] **Step 3: Register `AgentRebateRecord` in model auto-migration**

Port the `AgentRebateRecord` registration entries from the source repo into `model/main.go`

- [ ] **Step 4: Run tests to verify the red-to-green transition for model symbols**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base
go test ./model/...
```

Expected: model tests pass or fail only on missing controller wiring, not missing model types

- [ ] **Step 5: Commit the backend model port**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base/model/user.go newapi-plus-main-nav-server-base/model/agent_rebate.go newapi-plus-main-nav-server-base/model/main.go
git commit -m "feat: port agent rebate models into server base"
```

### Task 4: Port Backend Controller and Route Wiring

**Files:**
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/controller/user.go`
- Create: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/controller/agent_rebate.go`
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/controller/topup.go`
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/router/api-router.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/controller/user.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/controller/agent_rebate.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/controller/topup.go`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/router/api-router.go`

- [ ] **Step 1: Copy the new agent rebate controller**

Run:

```bash
cp /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/controller/agent_rebate.go /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/controller/agent_rebate.go
```

- [ ] **Step 2: Port the agent fields returned by login, `GetSelf`, and `GetUser`**

Ensure these fields are returned from `controller/user.go`:

```go
"is_agent":                    user.IsAgent,
"agent_rebate_rate_bps":       user.AgentRebateRateBps,
"agent_rebate_balance":        user.AgentRebateBalance,
"agent_rebate_history_amount": user.AgentRebateHistoryAmount,
```

- [ ] **Step 3: Wire the top-up completion path to apply agent rebate**

Port the settlement hook:

```go
if err := model.ApplyAgentRebateForTopUp(topUp.Id); err != nil {
    logger.LogError(c.Request.Context(), fmt.Sprintf("代理返利处理失败 trade_no=%s user_id=%d client_ip=%s error=%q", topUp.TradeNo, topUp.UserId, c.ClientIP(), err.Error()))
}
```

- [ ] **Step 4: Port the route registrations**

Ensure `router/api-router.go` includes:

```go
selfRoute.GET("/agent_rebate", controller.GetAgentRebateSelf)
adminRoute.PATCH("/:id/agent", controller.AdminUpdateUserAgentProfile)
adminRoute.POST("/:id/agent_rebate/adjust", controller.AdminAdjustUserAgentRebate)
```

- [ ] **Step 5: Run controller and full backend tests**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base
go test ./controller/...
go test ./...
```

Expected: controller tests pass and backend no longer fails for missing route/controller wiring

- [ ] **Step 6: Commit the backend wiring**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base/controller/user.go newapi-plus-main-nav-server-base/controller/agent_rebate.go newapi-plus-main-nav-server-base/controller/topup.go newapi-plus-main-nav-server-base/router/api-router.go
git commit -m "feat: wire agent rebate backend flows into server base"
```

### Task 5: Port the Agent Rebate Frontend Page and Sidebar Entry

**Files:**
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/App.jsx`
- Modify: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/components/layout/SiderBar.jsx`
- Create or copy: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/pages/AgentRebate/`
- Create or copy minimal dependencies under: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/components/`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/web/src/App.jsx`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/web/src/components/layout/SiderBar.jsx`

- [ ] **Step 1: Copy the agent rebate page directory from the source repo**

Run:

```bash
cp -r /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/web/src/pages/AgentRebate /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/pages/
```

Expected: `web/src/pages/AgentRebate` exists in the local server base

- [ ] **Step 2: Port the route into `web/src/App.jsx`**

Ensure the app contains:

```jsx
import AgentRebatePage from './pages/AgentRebate';
```

and:

```jsx
<Route
  path='/console/agent-rebate'
  element={
    <PrivateRoute>
      <AgentRebatePage />
    </PrivateRoute>
  }
/>
```

- [ ] **Step 3: Port the sidebar menu item and visibility logic**

Ensure `web/src/components/layout/SiderBar.jsx` contains:

```jsx
agent_rebate: '/console/agent-rebate',
```

and:

```jsx
{
  text: t('代理返利'),
  itemKey: 'agent_rebate',
  to: '/agent-rebate',
}
```

plus the `isAgentUser` visibility guard.

- [ ] **Step 4: Run the frontend build and capture missing dependency errors**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web
npm run build
```

Expected: either PASS or a concrete missing-import list for the next task

- [ ] **Step 5: Commit the route and sidebar port**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base/web/src/App.jsx newapi-plus-main-nav-server-base/web/src/components/layout/SiderBar.jsx newapi-plus-main-nav-server-base/web/src/pages/AgentRebate
git commit -m "feat: add agent rebate page and sidebar entry"
```

### Task 6: Port User Management UI for Agent Fields

**Files:**
- Modify or copy: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/components/table/users/`
- Reference: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/web/src/components/table/users/`

- [ ] **Step 1: Compare the source and target user table files**

Run:

```bash
diff -ru /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web/src/components/table/users /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-agent-rebate-220f1b1/web/src/components/table/users
```

Expected: concrete file-level diff showing which user table files carry agent-field UI

- [ ] **Step 2: Port only the files needed to display and edit agent fields**

Target the minimum set that adds:

```jsx
is_agent
agent_rebate_rate_bps
agent_rebate_balance
agent_rebate_history_amount
```

Do not port unrelated user-management redesigns.

- [ ] **Step 3: Re-run the frontend build**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit the user-management UI port**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base/web/src/components/table/users
git commit -m "feat: expose agent rebate fields in user management"
```

### Task 7: Run Full Verification and Prepare Handoff Notes

**Files:**
- Review: `/home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/`
- Update if needed: `/home/youshaocong/hgfs/xueyinMiniapp/docs/superpowers/specs/2026-04-30-newapi-agent-rebate-server-base-design.md`

- [ ] **Step 1: Run the full backend verification**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base
go test ./model/...
go test ./controller/...
go test ./...
go build ./...
```

Expected: all commands exit `0`

- [ ] **Step 2: Run the frontend build verification**

Run:

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp/newapi-plus-main-nav-server-base/web
npm run build
```

Expected: build exits `0`

- [ ] **Step 3: Record the exact commands and results for push-back preparation**

Capture:

```text
- backend tests passed
- backend build passed
- frontend build passed
- files added or modified
- any remaining server deployment considerations
```

- [ ] **Step 4: Commit the finished local integration**

```bash
cd /home/youshaocong/hgfs/xueyinMiniapp
git add newapi-plus-main-nav-server-base
git commit -m "feat: integrate agent rebate into server base snapshot"
```

## Self-Review

- Spec coverage: this plan covers local base copy, model port, controller wiring, top-up settlement, routes, frontend route/menu/page, user-management UI, tests, and final verification.
- Placeholder scan: no `TODO`, `TBD`, or open-ended “handle later” steps remain.
- Type consistency: all field names use `is_agent`, `agent_rebate_rate_bps`, `agent_rebate_balance`, and `agent_rebate_history_amount` consistently across backend and frontend tasks.

