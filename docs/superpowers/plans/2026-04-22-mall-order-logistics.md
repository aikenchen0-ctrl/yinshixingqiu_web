# Mall Order Logistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reliable logistics card to the miniapp mall order-detail page, with backend-controlled timeline-or-fallback behavior.

**Architecture:** Add a small backend logistics-query service that normalizes carrier names, auto-detects carrier codes, fetches and sanitizes third-party responses, and decides whether timeline data is safe to show. Expose that through a new mall order logistics API, then wire the miniapp order-detail page to load and render the result with graceful fallback.

**Tech Stack:** Node.js backend, plain JS service modules, WeChat miniapp TypeScript pages, `node:test` for targeted backend tests.

---

### Task 1: Document the approved design

**Files:**
- Create: `docs/superpowers/specs/2026-04-22-mall-order-logistics-design.md`
- Create: `docs/superpowers/plans/2026-04-22-mall-order-logistics.md`

- [ ] **Step 1: Save the approved logistics design**

Write the approved scope, backend query flow, fallback rules, and miniapp UI behavior into:

```md
docs/superpowers/specs/2026-04-22-mall-order-logistics-design.md
```

- [ ] **Step 2: Save this implementation plan**

Write this plan into:

```md
docs/superpowers/plans/2026-04-22-mall-order-logistics.md
```

- [ ] **Step 3: Review both docs for ambiguity**

Check that the spec explicitly says:

- order-detail page only
- backend decides `timeline_available` vs `fallback_only`
- fallback never blocks basic logistics display

- [ ] **Step 4: Commit the docs**

Run:

```bash
git add docs/superpowers/specs/2026-04-22-mall-order-logistics-design.md docs/superpowers/plans/2026-04-22-mall-order-logistics.md
git commit -m "docs: add mall order logistics design and plan"
```

Expected: a commit containing only the two docs files.

### Task 2: Add failing backend tests for logistics decision logic

**Files:**
- Create: `backend/tests/mall-logistics-service.test.js`
- Test: `backend/tests/mall-logistics-service.test.js`

- [ ] **Step 1: Write the failing test**

Create:

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeMallLogisticsCompanyCode,
  parseKuaidiCompanyCandidates,
  normalizeMallLogisticsTimeline,
  shouldUseMallLogisticsTimeline,
} = require("../src/services/mallLogisticsService");

test("normalizeMallLogisticsCompanyCode maps common chinese carrier names", () => {
  assert.equal(normalizeMallLogisticsCompanyCode("申通"), "shentong");
  assert.equal(normalizeMallLogisticsCompanyCode("申通快递"), "shentong");
  assert.equal(normalizeMallLogisticsCompanyCode("圆通"), "yuantong");
  assert.equal(normalizeMallLogisticsCompanyCode("未知物流"), "");
});

test("parseKuaidiCompanyCandidates extracts first recognized company candidate", () => {
  const payload = JSON.stringify([
    { name: "申通快递", exname: "shentong" },
    { name: "圆通速递", exname: "yuantong" },
  ]);

  assert.deepEqual(parseKuaidiCompanyCandidates(payload), [
    { name: "申通快递", code: "shentong" },
    { name: "圆通速递", code: "yuantong" },
  ]);
});

test("normalizeMallLogisticsTimeline removes invalid timeline rows", () => {
  const result = normalizeMallLogisticsTimeline([
    { time: "2026-04-22 10:00:00", context: "已揽收" },
    { time: "", context: "空时间" },
    { time: "2026-04-22 11:00:00", context: "" },
  ]);

  assert.deepEqual(result, [
    { time: "2026-04-22 10:00:00", status: "已揽收" },
  ]);
});

test("shouldUseMallLogisticsTimeline rejects obvious invalid timeline payloads", () => {
  assert.equal(
    shouldUseMallLogisticsTimeline([{ time: "2026-04-10 15:21:04", status: "查无结果" }]),
    false,
  );

  assert.equal(
    shouldUseMallLogisticsTimeline([{ time: "2026-04-22 13:45:10", status: "您的订单已被收件员揽收" }]),
    true,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test backend/tests/mall-logistics-service.test.js
```

Expected: FAIL because `../src/services/mallLogisticsService` does not exist yet.

- [ ] **Step 3: Commit the failing test only if your workflow requires it**

Optional local checkpoint:

```bash
git add backend/tests/mall-logistics-service.test.js
git commit -m "test: add failing mall logistics service tests"
```

### Task 3: Implement backend logistics query service

**Files:**
- Create: `backend/src/services/mallLogisticsService.js`
- Test: `backend/tests/mall-logistics-service.test.js`

- [ ] **Step 1: Write minimal implementation to satisfy the test API**

Create:

```js
const COMPANY_CODE_ALIASES = {
  shentong: ["shentong", "申通", "申通快递"],
  yuantong: ["yuantong", "圆通", "圆通速递"],
  yunda: ["yunda", "韵达", "韵达快递"],
  zhongtong: ["zhongtong", "中通", "中通快递"],
  shunfeng: ["shunfeng", "顺丰", "顺丰速运", "sf"],
  jd: ["jd", "京东", "京东快递", "京东物流"],
  ems: ["ems", "邮政", "中国邮政", "ems快递"],
  jtexpress: ["jtexpress", "极兔", "极兔速递"],
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMallLogisticsCompanyCode(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (!normalizedValue) return "";

  for (const [code, aliases] of Object.entries(COMPANY_CODE_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalizedValue)) {
      return code;
    }
  }

  return "";
}

function parseKuaidiCompanyCandidates(payloadText) {
  let parsed = [];
  try {
    parsed = JSON.parse(String(payloadText || "[]"));
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => ({
      name: normalizeString(item && item.name),
      code: normalizeMallLogisticsCompanyCode(item && (item.exname || item.name)),
    }))
    .filter((item) => item.name && item.code);
}

function normalizeMallLogisticsTimeline(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .map((item) => ({
      time: normalizeString(item && item.time),
      status: normalizeString(item && (item.context || item.status)),
    }))
    .filter((item) => item.time && item.status);
}

function shouldUseMallLogisticsTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return false;
  }

  return timeline.every((item) => !/查无结果/i.test(String(item.status || "")));
}

module.exports = {
  normalizeMallLogisticsCompanyCode,
  parseKuaidiCompanyCandidates,
  normalizeMallLogisticsTimeline,
  shouldUseMallLogisticsTimeline,
};
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run:

```bash
node --test backend/tests/mall-logistics-service.test.js
```

Expected: PASS

- [ ] **Step 3: Expand the service with real fetch helpers**

Add these functions into `backend/src/services/mallLogisticsService.js`:

```js
async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 mall logistics bot",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`物流接口请求失败: ${response.status}`);
  }

  return response.text();
}

async function detectMallLogisticsCompany(trackingNo) {
  const normalizedTrackingNo = normalizeString(trackingNo);
  if (!normalizedTrackingNo) {
    return { company: "", companyCode: "" };
  }

  const responseText = await fetchText(
    `http://www.kuaidi.com/index-ajaxselectinfo-${encodeURIComponent(normalizedTrackingNo)}.html`,
  );
  const candidates = parseKuaidiCompanyCandidates(responseText);
  const firstCandidate = candidates[0] || null;

  return firstCandidate
    ? { company: firstCandidate.name, companyCode: firstCandidate.code }
    : { company: "", companyCode: "" };
}

function parseKuaidiTimelinePayload(payloadText) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(payloadText || "{}"));
  } catch {
    parsed = null;
  }

  const data = parsed && parsed.success && Array.isArray(parsed.data) ? parsed.data : [];
  return normalizeMallLogisticsTimeline(data);
}

async function queryMallLogisticsTimeline(input = {}) {
  const trackingNo = normalizeString(input.trackingNo);
  const companyCode =
    normalizeMallLogisticsCompanyCode(input.companyCode) ||
    normalizeMallLogisticsCompanyCode(input.company);

  if (!trackingNo) {
    return {
      queryMode: "fallback_only",
      company: normalizeString(input.company),
      companyCode,
      trackingNo: "",
      latestStatus: "",
      latestTime: "",
      timeline: [],
      fallbackReason: "missing_tracking_no",
    };
  }

  let resolvedCompany = normalizeString(input.company);
  let resolvedCompanyCode = companyCode;

  if (!resolvedCompanyCode) {
    const detected = await detectMallLogisticsCompany(trackingNo);
    resolvedCompany = resolvedCompany || detected.company;
    resolvedCompanyCode = detected.companyCode;
  }

  if (!resolvedCompanyCode) {
    return {
      queryMode: "fallback_only",
      company: resolvedCompany,
      companyCode: "",
      trackingNo,
      latestStatus: "",
      latestTime: "",
      timeline: [],
      fallbackReason: "carrier_not_resolved",
    };
  }

  try {
    const responseText = await fetchText(
      `http://www.kuaidi.com/index-ajaxselectcourierinfo-${encodeURIComponent(trackingNo)}-${encodeURIComponent(resolvedCompanyCode)}.html`,
    );
    const timeline = parseKuaidiTimelinePayload(responseText);

    if (!shouldUseMallLogisticsTimeline(timeline)) {
      return {
        queryMode: "fallback_only",
        company: resolvedCompany,
        companyCode: resolvedCompanyCode,
        trackingNo,
        latestStatus: "",
        latestTime: "",
        timeline: [],
        fallbackReason: "timeline_not_reliable",
      };
    }

    const latestItem = timeline[0] || { time: "", status: "" };
    return {
      queryMode: "timeline_available",
      company: resolvedCompany,
      companyCode: resolvedCompanyCode,
      trackingNo,
      latestStatus: latestItem.status,
      latestTime: latestItem.time,
      timeline,
      fallbackReason: "",
    };
  } catch {
    return {
      queryMode: "fallback_only",
      company: resolvedCompany,
      companyCode: resolvedCompanyCode,
      trackingNo,
      latestStatus: "",
      latestTime: "",
      timeline: [],
      fallbackReason: "provider_request_failed",
    };
  }
}
```

- [ ] **Step 4: Export the full service API**

Ensure `module.exports` includes:

```js
module.exports = {
  normalizeMallLogisticsCompanyCode,
  parseKuaidiCompanyCandidates,
  normalizeMallLogisticsTimeline,
  shouldUseMallLogisticsTimeline,
  detectMallLogisticsCompany,
  queryMallLogisticsTimeline,
};
```

- [ ] **Step 5: Re-run the focused test and syntax check**

Run:

```bash
node --test backend/tests/mall-logistics-service.test.js
node --check backend/src/services/mallLogisticsService.js
```

Expected: both PASS

- [ ] **Step 6: Commit the backend service foundation**

```bash
git add backend/tests/mall-logistics-service.test.js backend/src/services/mallLogisticsService.js
git commit -m "feat: add mall logistics query service"
```

### Task 4: Add mall order logistics API endpoint

**Files:**
- Modify: `backend/src/services/mallService.js`
- Modify: `backend/src/server.js`
- Modify: `package.json`

- [ ] **Step 1: Wire the logistics service into mallService**

At the top of `backend/src/services/mallService.js`, add:

```js
const { queryMallLogisticsTimeline } = require("./mallLogisticsService");
```

- [ ] **Step 2: Add a mall order logistics reader**

Add a new function near the mall order detail functions in `backend/src/services/mallService.js`:

```js
async function getMallOrderLogistics(input = {}) {
  const sessionToken = normalizeString(input.sessionToken);
  const orderId = normalizeString(input.orderId);

  if (!sessionToken) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "请先登录后查看物流",
      },
    };
  }

  if (!orderId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少订单ID",
      },
    };
  }

  const sessionUser = await getSessionUser(sessionToken);
  if (!sessionUser) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "登录已失效，请重新登录",
      },
    };
  }

  const order = await prisma.mallOrder.findFirst({
    where: {
      id: orderId,
      userId: sessionUser.id,
    },
  });

  if (!order) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "订单不存在",
      },
    };
  }

  const trackingNo = normalizeString(order.shippingTrackingNo);
  const company = normalizeString(order.shippingCompany);

  if (!trackingNo) {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: {
          item: {
            queryMode: "fallback_only",
            company,
            companyCode: "",
            trackingNo: "",
            shippedAt: order.shippedAt,
            latestStatus: "",
            latestTime: "",
            timeline: [],
            fallbackReason: "missing_tracking_no",
            officialQueryHint: "请等待商家录入物流单号",
          },
        },
      },
    };
  }

  const logistics = await queryMallLogisticsTimeline({
    company,
    trackingNo,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        item: {
          ...logistics,
          shippedAt: order.shippedAt,
          officialQueryHint: "如轨迹未展示，请复制单号到物流官网查询",
        },
      },
    },
  };
}
```

- [ ] **Step 3: Export the new mallService function**

Append `getMallOrderLogistics` to the `module.exports` object in `backend/src/services/mallService.js`.

- [ ] **Step 4: Register the API route in server.js**

In `backend/src/server.js`, add:

```js
    if (req.method === "GET" && requestUrl.pathname === "/api/mall/orders/logistics") {
      const result = await getMallOrderLogistics({
        sessionToken: req.headers["x-session-token"] || requestUrl.searchParams.get("sessionToken"),
        orderId: requestUrl.searchParams.get("orderId"),
      });
      sendJson(res, result.statusCode, result.payload);
      return;
    }
```

Also ensure the service import list includes `getMallOrderLogistics`.

- [ ] **Step 5: Add a runnable test command**

In `package.json`, add:

```json
"test:backend": "node --test backend/tests/*.test.js"
```

- [ ] **Step 6: Run backend verification**

Run:

```bash
node --test backend/tests/mall-logistics-service.test.js
node --check backend/src/services/mallLogisticsService.js
node --check backend/src/services/mallService.js
node --check backend/src/server.js
```

Expected: all PASS

- [ ] **Step 7: Commit the API wiring**

```bash
git add backend/src/services/mallService.js backend/src/server.js package.json
git commit -m "feat: add mall order logistics api"
```

### Task 5: Add miniapp API types and request function

**Files:**
- Modify: `miniprogram/utils/store-api.ts`

- [ ] **Step 1: Add logistics response types**

Add after `MallOrderApiItem`:

```ts
export interface MallOrderLogisticsTimelineItem {
  time: string
  status: string
}

export interface MallOrderLogisticsApiItem {
  queryMode: 'timeline_available' | 'fallback_only'
  company: string
  companyCode: string
  trackingNo: string
  shippedAt: string
  latestStatus: string
  latestTime: string
  timeline: MallOrderLogisticsTimelineItem[]
  fallbackReason: string
  officialQueryHint: string
}
```

- [ ] **Step 2: Add the fetch function**

Add:

```ts
export function fetchMallOrderLogistics(input: { orderId: string }) {
  return request<{ item: MallOrderLogisticsApiItem }>({
    url: `/api/mall/orders/logistics?orderId=${encodeURIComponent(input.orderId)}`,
    method: 'GET',
  })
}
```

- [ ] **Step 3: Run miniapp type check expectation locally after all frontend work**

Deferred verification command:

```bash
npm run check:miniprogram
```

- [ ] **Step 4: Commit the API client change**

```bash
git add miniprogram/utils/store-api.ts
git commit -m "feat: add miniapp mall logistics api client"
```

### Task 6: Render the logistics card in order detail

**Files:**
- Modify: `miniprogram/pages/store/order-detail.ts`
- Modify: `miniprogram/pages/store/order-detail.wxml`
- Modify: `miniprogram/pages/store/order-detail.scss`

- [ ] **Step 1: Extend the page imports**

In `miniprogram/pages/store/order-detail.ts`, update the store-api import to include:

```ts
  fetchMallOrderLogistics,
  type MallOrderLogisticsApiItem,
```

- [ ] **Step 2: Add a view-model mapper**

Add:

```ts
function buildLogisticsView(logistics?: MallOrderLogisticsApiItem | null) {
  if (!logistics) {
    return null
  }

  return {
    queryMode: logistics.queryMode || 'fallback_only',
    company: String(logistics.company || ''),
    trackingNo: String(logistics.trackingNo || ''),
    shippedAtText: formatDateTime(String(logistics.shippedAt || '')),
    latestStatus: String(logistics.latestStatus || ''),
    latestTime: String(logistics.latestTime || ''),
    fallbackReason: String(logistics.fallbackReason || ''),
    officialQueryHint: String(logistics.officialQueryHint || ''),
    timeline: Array.isArray(logistics.timeline)
      ? logistics.timeline.map((item) => ({
          time: String(item.time || ''),
          status: String(item.status || ''),
        }))
      : [],
    hasTimeline: logistics.queryMode === 'timeline_available' && Array.isArray(logistics.timeline) && logistics.timeline.length > 0,
  }
}
```

- [ ] **Step 3: Extend page state**

In `data`, add:

```ts
    logisticsLoading: false,
    logisticsExpanded: false,
    logistics: null as ReturnType<typeof buildLogisticsView> | null,
```

- [ ] **Step 4: Load logistics after order detail**

Inside the successful order-detail load path, after `this.setData({ order: buildOrderView(...) ... })`, call:

```ts
      void this.loadOrderLogistics(order.id, order.shippingTrackingNo)
```

Add the method:

```ts
  async loadOrderLogistics(orderId: string, trackingNo?: string) {
    if (!orderId || !String(trackingNo || '').trim()) {
      this.setData({
        logisticsLoading: false,
        logisticsExpanded: false,
        logistics: null,
      })
      return
    }

    this.setData({
      logisticsLoading: true,
      logisticsExpanded: false,
    })

    try {
      const response = await fetchMallOrderLogistics({ orderId })
      const logistics = response.ok && response.data ? buildLogisticsView(response.data.item) : null

      this.setData({
        logisticsLoading: false,
        logistics,
      })
    } catch {
      this.setData({
        logisticsLoading: false,
        logistics: buildLogisticsView({
          queryMode: 'fallback_only',
          company: this.data.order?.shippingCompany || '',
          companyCode: '',
          trackingNo: this.data.order?.shippingTrackingNo || '',
          shippedAt: '',
          latestStatus: '',
          latestTime: '',
          timeline: [],
          fallbackReason: 'request_failed',
          officialQueryHint: '暂时无法拉取轨迹，请复制单号到物流官网查询',
        }),
      })
    }
  },
```

- [ ] **Step 5: Add logistics interactions**

Add:

```ts
  onToggleLogisticsTimeline() {
    if (!this.data.logistics || !this.data.logistics.hasTimeline) {
      return
    }

    this.setData({
      logisticsExpanded: !this.data.logisticsExpanded,
    })
  },

  onCopyTrackingNo() {
    const trackingNo = String((this.data.logistics && this.data.logistics.trackingNo) || '')
    if (!trackingNo) {
      return
    }

    wx.setClipboardData({
      data: trackingNo,
    })
  },
```

- [ ] **Step 6: Replace the simple logistics rows with a card**

In `miniprogram/pages/store/order-detail.wxml`, replace the old logistics meta rows with:

```xml
        <view wx:if="{{order.shippingCompany || order.shippingTrackingNo}}" class="mall-order-detail-logistics-card">
          <view class="mall-order-detail-logistics-head">
            <view class="mall-order-detail-logistics-copy">
              <text class="mall-order-detail-logistics-title">物流信息</text>
              <text class="mall-order-detail-logistics-summary">
                {{logistics && logistics.latestStatus ? logistics.latestStatus : '商家已录入物流信息'}}
              </text>
            </view>
            <button class="mall-order-detail-logistics-copy-btn" bindtap="onCopyTrackingNo">复制单号</button>
          </view>

          <view class="mall-order-detail-logistics-meta">
            <text class="mall-order-detail-logistics-meta-label">物流公司</text>
            <text class="mall-order-detail-logistics-meta-value">{{(logistics && logistics.company) || order.shippingCompany || '待识别'}}</text>
          </view>
          <view class="mall-order-detail-logistics-meta">
            <text class="mall-order-detail-logistics-meta-label">物流单号</text>
            <text class="mall-order-detail-logistics-meta-value">{{(logistics && logistics.trackingNo) || order.shippingTrackingNo}}</text>
          </view>
          <view wx:if="{{(logistics && logistics.shippedAtText) || order.shippedAtText}}" class="mall-order-detail-logistics-meta">
            <text class="mall-order-detail-logistics-meta-label">发货时间</text>
            <text class="mall-order-detail-logistics-meta-value">{{(logistics && logistics.shippedAtText) || order.shippedAtText}}</text>
          </view>
          <view wx:if="{{logistics && logistics.latestTime}}" class="mall-order-detail-logistics-meta">
            <text class="mall-order-detail-logistics-meta-label">最近更新</text>
            <text class="mall-order-detail-logistics-meta-value">{{logistics.latestTime}}</text>
          </view>

          <text wx:if="{{logisticsLoading}}" class="mall-order-detail-logistics-note">物流轨迹加载中...</text>
          <text wx:elif="{{logistics && !logistics.hasTimeline}}" class="mall-order-detail-logistics-note">
            {{logistics.officialQueryHint || '暂时无法拉取轨迹，请复制单号到物流官网查询'}}
          </text>

          <view wx:if="{{logistics && logistics.hasTimeline}}" class="mall-order-detail-logistics-actions">
            <text class="mall-order-detail-logistics-toggle" bindtap="onToggleLogisticsTimeline">
              {{logisticsExpanded ? '收起物流轨迹' : '查看物流轨迹'}}
            </text>
          </view>

          <view wx:if="{{logistics && logistics.hasTimeline && logisticsExpanded}}" class="mall-order-detail-logistics-timeline">
            <view wx:for="{{logistics.timeline}}" wx:key="time" class="mall-order-detail-logistics-timeline-item">
              <text class="mall-order-detail-logistics-timeline-time">{{item.time}}</text>
              <text class="mall-order-detail-logistics-timeline-status">{{item.status}}</text>
            </view>
          </view>
        </view>
```

- [ ] **Step 7: Add matching styles**

In `miniprogram/pages/store/order-detail.scss`, add:

```scss
.mall-order-detail-logistics-card {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.mall-order-detail-logistics-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.mall-order-detail-logistics-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.mall-order-detail-logistics-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}

.mall-order-detail-logistics-summary {
  font-size: 24rpx;
  color: #ff5c68;
}

.mall-order-detail-logistics-copy-btn {
  margin: 0;
  padding: 0 20rpx;
  min-width: 0;
  line-height: 56rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #ff5c68;
  background: rgba(255, 92, 104, 0.1);
}

.mall-order-detail-logistics-copy-btn::after {
  border: none;
}

.mall-order-detail-logistics-meta {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
}

.mall-order-detail-logistics-meta-label {
  font-size: 24rpx;
  color: #6b7280;
}

.mall-order-detail-logistics-meta-value {
  flex: 1;
  text-align: right;
  font-size: 24rpx;
  color: #111827;
}

.mall-order-detail-logistics-note {
  font-size: 22rpx;
  color: #6b7280;
}

.mall-order-detail-logistics-actions {
  display: flex;
  justify-content: flex-end;
}

.mall-order-detail-logistics-toggle {
  font-size: 24rpx;
  color: #ff5c68;
}

.mall-order-detail-logistics-timeline {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-top: 8rpx;
}

.mall-order-detail-logistics-timeline-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding-left: 20rpx;
  border-left: 4rpx solid rgba(255, 92, 104, 0.18);
}

.mall-order-detail-logistics-timeline-time {
  font-size: 22rpx;
  color: #9ca3af;
}

.mall-order-detail-logistics-timeline-status {
  font-size: 24rpx;
  color: #111827;
  line-height: 1.5;
}
```

- [ ] **Step 8: Run frontend verification**

Run:

```bash
npm run check:miniprogram
```

Expected: PASS

- [ ] **Step 9: Commit the miniapp logistics UI**

```bash
git add miniprogram/pages/store/order-detail.ts miniprogram/pages/store/order-detail.wxml miniprogram/pages/store/order-detail.scss
git commit -m "feat: show mall order logistics in order detail"
```

### Task 7: Final verification and cleanup

**Files:**
- Modify: any files touched above if verification reveals issues

- [ ] **Step 1: Run the full targeted verification set**

Run:

```bash
node --test backend/tests/mall-logistics-service.test.js
node --check backend/src/services/mallLogisticsService.js
node --check backend/src/services/mallService.js
node --check backend/src/server.js
npm run check:miniprogram
```

Expected: all PASS

- [ ] **Step 2: Smoke-review the affected user flow**

Manually inspect that:

- order with no tracking number shows no logistics card
- order with tracking number shows logistics card
- fallback mode still shows copyable tracking number
- timeline mode can expand and collapse

- [ ] **Step 3: Create the final implementation commit**

```bash
git add backend/src/services/mallLogisticsService.js backend/src/services/mallService.js backend/src/server.js backend/tests/mall-logistics-service.test.js miniprogram/utils/store-api.ts miniprogram/pages/store/order-detail.ts miniprogram/pages/store/order-detail.wxml miniprogram/pages/store/order-detail.scss package.json
git commit -m "feat: add mall order logistics query flow"
```
