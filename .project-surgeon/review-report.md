# Code Review Report — 代码审查报告

## Summary — 摘要
- Review target: `backend` only, for Prompt 02 backend audit and gap ordering.
- Total findings: 9
- By severity: CRITICAL(2) HIGH(4) MEDIUM(3) LOW(0) INFO(0)
- Dimensions covered: 7/7
- Files reviewed: 11 deep reads / 13 tier-1 scans
- Runtime note: `npm run verify:join-flow` was re-run on April 3, 2026 and still failed because PostgreSQL at `localhost:5432` was unreachable.

## Critical Findings — 关键发现
- `PSR-D1-001` CRITICAL
  File: `backend/src/server.js`, `backend/src/services/joinFlowService.js`, `backend/src/services/contentService.js`
  Request identity is still trusted from query/body parameters such as `userId` and `sessionToken`, so preview, group-home, join-order, and membership-state reads can be impersonated if the caller knows another user's ID.
  Evidence: `backend/src/server.js:248-297`, `backend/src/server.js:448-469`, `backend/src/services/contentService.js:99-139`, `backend/src/services/joinFlowService.js:24-64`, `backend/src/services/joinFlowService.js:144-147`, `backend/src/services/joinFlowService.js:558-566`.

- `PSR-D2-001` CRITICAL
  File: `backend/src/services/contentService.js`
  Paid-content read paths do not enforce membership or preview policy. `getGroupHome`, `listPostsByTab`, `getPostDetail`, and `listComments` can all return real data without confirming the viewer is an active member or that preview is allowed.
  Evidence: `backend/src/services/contentService.js:202-361`, `backend/src/services/contentService.js:363-446`, `backend/src/services/contentService.js:579-629`, `backend/src/services/contentService.js:915-945`.

## High Findings — 高级发现
- `PSR-D2-002` HIGH
  File: `backend/src/server.js`, `backend/src/services/joinFlowService.js`
  The payment chain stops at `/api/payments/mock-callback`. There is no real WeChat unified order, callback verification, or signed result handling, so production payment closure is not implemented.
  Evidence: `backend/src/server.js:448-460`, `backend/src/services/joinFlowService.js:277-556`.

- `PSR-D1-002` HIGH
  File: `backend/src/services/authService.js`
  `loginWebByMobile` grants a fresh active session based only on a mobile-number lookup. There is no OTP, admin credential, or secondary proof, so web login is effectively a one-factor account takeover path.
  Evidence: `backend/src/services/authService.js:597-666`.

- `PSR-D1-003` HIGH
  File: `backend/src/server.js`, `backend/src/services/joinFlowService.js`
  `/api/orders/detail` and `/api/debug/state` expose raw order, member, payment, coupon, and analytics rows without any auth gate or payload masking.
  Evidence: `backend/src/server.js:532-542`, `backend/src/services/joinFlowService.js:583-659`.

- `PSR-D5-001` HIGH
  File: `backend/src/services/joinFlowService.js`
  Coupon and channel validation only checks existence and `groupId`. It does not enforce `status`, validity window, quota exhaustion, or channel enable flags, so business rules can be bypassed even before real payment is connected.
  Evidence: `backend/src/services/joinFlowService.js:24-59`, `backend/src/services/joinFlowService.js:165-170`, `backend/prisma/schema.prisma:505-561`.

## Medium Findings — 中级发现
- `PSR-D2-003` MEDIUM
  File: `backend/src/services/contentService.js`
  `deletePost` only soft-deletes the post and decrements `group.contentCount`. It does not clean comments or likes, and it does not rebuild related counters, so data consistency will drift after repeated moderation operations.
  Evidence: `backend/src/services/contentService.js:848-913`.

- `PSR-D2-004` MEDIUM
  File: `backend/src/services/planetService.js`
  `createPlanet` accepts `joinType`, but `billingPeriod` is hard-coded to `"YEAR"` regardless of the input branch. This leaves a visible product option as a logic placeholder rather than a real behavior.
  Evidence: `backend/src/services/planetService.js:90-112`.

- `PSR-D7-001` MEDIUM
  File: `backend/src/server.js`
  Auth transport is inconsistent across the route layer: some endpoints read `sessionToken` from query params, some from `x-session-token`, and some still accept direct `userId`. This blocks clean middleware-based auth hardening and increases integration mistakes.
  Evidence: `backend/src/server.js:248-305`, `backend/src/server.js:357-469`, `backend/src/server.js:519-539`.

## Systemic Issues — 系统性问题
- Fragmented identity source
  Affected files: `backend/src/server.js`, `backend/src/services/contentService.js`, `backend/src/services/joinFlowService.js`, `backend/src/services/authService.js`
  Related findings: `PSR-D1-001`, `PSR-D1-002`, `PSR-D7-001`

- Schema ahead of delivery
  The schema already models notifications, renewal stats, score ledgers, exports, and hot-board data, but those capabilities are absent from routes and services. This creates false confidence if progress is judged by tables instead of runnable endpoints.
  Related findings: `PSR-D2-002`, `PSR-D5-001`

- Admin/ops placeholders mixed into production surface
  Static stats, unauthenticated debug dumps, and DB-dependent verification scripts currently sit close to real API paths, which makes audit boundaries blurry and rollout riskier.
  Related findings: `PSR-D1-003`, `PSR-D7-001`

## Architecture Cross-Reference — 架构交叉引用

| Layer | Findings | Highest Severity | Observation |
| --- | ---: | --- | --- |
| Presentation (`server.js`) | 3 | CRITICAL | Route layer still decides auth shape ad hoc instead of enforcing a single identity source. |
| Business Logic (`authService`, `joinFlowService`, `contentService`, `planetService`) | 6 | CRITICAL | Core closure gaps all live here: payment realism, read gating, and state consistency. |
| Data Access (`schema.prisma`, seed/delete scripts) | 0 direct findings / 1 structural gap | HIGH | The schema is wider than the delivered API surface, so model count is misleading as a progress signal. |
| Infrastructure (`docker-compose.yml`, verification script) | 0 direct findings | INFO | Local verification still depends on manually starting PostgreSQL. |

### Hot Spot Ranking
| Rank | File | Findings |
| --- | --- | ---: |
| 1 | `backend/src/services/joinFlowService.js` | 3 |
| 2 | `backend/src/services/contentService.js` | 3 |
| 3 | `backend/src/server.js` | 3 |
| 4 | `backend/src/services/authService.js` | 1 |
| 5 | `backend/src/services/planetService.js` | 1 |

## Appendix: Full Finding List — 附录：完整发现列表

| ID | Dimension | Severity | File | Summary |
| --- | --- | --- | --- | --- |
| `PSR-D1-001` | D1 Security | CRITICAL | `backend/src/server.js` + services | Caller-supplied `userId` still participates in identity resolution. |
| `PSR-D2-001` | D2 Logic | CRITICAL | `backend/src/services/contentService.js` | Paid-content read paths have no member gate. |
| `PSR-D2-002` | D2 Logic | HIGH | `backend/src/server.js`, `backend/src/services/joinFlowService.js` | Payment remains mock-only. |
| `PSR-D1-002` | D1 Security | HIGH | `backend/src/services/authService.js` | Web login trusts bare mobile existence. |
| `PSR-D1-003` | D1 Security | HIGH | `backend/src/server.js`, `backend/src/services/joinFlowService.js` | Order/debug endpoints expose raw operational data. |
| `PSR-D5-001` | D5 Error Handling | HIGH | `backend/src/services/joinFlowService.js` | Coupon/channel lifecycle checks are incomplete. |
| `PSR-D2-003` | D2 Logic | MEDIUM | `backend/src/services/contentService.js` | Post deletion leaves dependent graphs inconsistent. |
| `PSR-D2-004` | D2 Logic | MEDIUM | `backend/src/services/planetService.js` | `joinType` is accepted but not actually implemented. |
| `PSR-D7-001` | D7 Consistency | MEDIUM | `backend/src/server.js` | Auth transport is inconsistent across query/header/body. |
