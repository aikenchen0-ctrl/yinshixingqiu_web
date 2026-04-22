# Codex Headless Run Context

Current step: 01-项目盘点与范围冻结
Current pass: 2
Project root: D:\CodeDevelopment\xueyinMiniapp

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

None

## Current Prompt Previous Pass Outputs

## pass-1

报告已落盘到 [01-项目盘点与范围冻结-报告.md](D:/CodeDevelopment/xueyinMiniapp/docs/serial-prompts/01-项目盘点与范围冻结-报告.md)。

核心结论是：`backend` 已有认证、星球、内容、加入订单的真实主干，但“身份统一、内容访问控制、真实支付、后台真实统计”还没收口；`admin-web` 目前是“已联调的用户侧页面 + 大量后台占位页/参考页”的混合态；`miniprogram` 的知识星球子模块已经基本跑通登录、发现、主页、发帖、评论、点赞、我的星球，但加入仍依赖 mock 支付，项目其他非主线页面大多还是静态壳。

第一轮范围我已经在报告里冻结为“后端优先打通知识星球最小闭环，再补 admin-web 最小真实数据页，最后保持小程序知识星球子模块联调可跑”；续期、运营工具矩阵、真实微信支付正式接入、非知识星球主线页面真实化都归入暂缓或超范围。未运行额外测试，本轮只做代码取证和报告落盘，没有改业务实现。

FINAL_STATUS: COMPLETE
QUALITY_SCORE: 5
NEXT_ACTIONS:
- 用这份报告直接进入 02 号提示词，重点审计 backend 的身份统一、内容读权限、mock 支付替代点和最小后台统计接口
- 02 号结束后，03 号按“backend > admin-web > miniprogram”拆一期开发计划
CHANGED_FILES:
- D:/CodeDevelopment/xueyinMiniapp/docs/serial-prompts/01-项目盘点与范围冻结-报告.md

## pass-2

# 项目盘点与范围冻结

## 1. 项目三端现状总览

- 本次盘点覆盖 `backend`、`admin-web`、`miniprogram`、`docs` 四个目录，共扫描 `241` 个文件，约 `60031` 行；仓库当前没有自动化测试套件，也没有 CI 配置。`minitest` 目录下仅存在录制配置与回放 JSON，不构成可持续回归测试。
- 当前真实实现不是“从零开始”，而是“后端已跑出一条可演示的知识星球核心闭环，admin-web 处于联调页与参考页混合态，小程序知识星球主链路已接后端，但外围低频页仍大量是静态壳”。
- 文档规划明显领先于代码现状。`docs/backend-architecture-plan.md`、`docs/backend-data-model.md` 规划的是 `TypeScript + NestJS + Redis + /api/v1`；真实 backend 则是 `CommonJS + 原生 http + Prisma + PostgreSQL + /api/*`。
- `docs/planet-dev-record.md` 仍写着“还没接真实后端接口”，但当前小程序已经接了登录、发现、星球主页、发帖、评论、点赞、创建星球等真实接口。

| 端 | 当前真实形态 | 当前判断 | 关键证据 |
| --- | --- | --- | --- |
| `backend` | Node.js CommonJS 单体服务，`server.js` 挂全部路由，Prisma 管 PostgreSQL | 核心闭环已开发；后台业务接口群未完成 | `backend/src/server.js`；`backend/prisma/schema.prisma` |
| `admin-web` | React + Vite；一部分页面接真实接口，一部分页面吃静态数据，一部分直接 iframe 参考页 | 半开发/占位 | `admin-web/src/App.tsx`；`admin-web/src/pages/user/GroupHomePage.tsx`；`admin-web/src/data/referencePages.ts` |
| `miniprogram` | 原生微信小程序；`wx.request`/`wx.uploadFile`/`wx.login` 已接通知识星球主链路 | 核心闭环基础具备；外围页面半成品多 | `miniprogram/utils/request.ts`；`miniprogram/pages/planet/home.ts`；`miniprogram/pages/planet-publish/index.ts` |
| `docs` | SOP、串行提示词、架构规划、开发记录并存 | 可作为后续输入，但不能替代代码真相 | `docs/rebuild-workflow.md`；`docs/backend-architecture-plan.md`；`docs/planet-dev-record.md` |

补充判断：

- backend 有 `docker-compose.yml` 和部署 nginx 配置，但没有 Redis 依赖，也没有迁移文件目录，说明当前是“可跑 demo + 可联调”的后端，不是完整生产架构。
- admin-web 的“后台”并不等于“后台业务已完成”。当前真正有后端支撑的，主要是登录、星球列表、星球首页、加入预览、推广数据页这几块。
- miniprogram 侧遵守了原生微信小程序约束：核心网络层使用 `wx.request`，图片上传使用 `wx.uploadFile`，登录使用 `wx.login`，页面数据更新以 `this.setData()` 为主，未发现 DOM API、`axios` 或 `fetch` 混入小程序代码。

## 2. backend 模块盘点

| 模块名 | 所在路径 | 当前状态 | 证据文件 | 备注 |
| --- | --- | --- | --- | --- |
| 应用入口与总路由 | `backend/src/server.js` | 已开发 | `backend/src/server.js` | 统一挂载了健康检查、schema、认证、星球、内容、订单、上传、调试、admin promotion 等接口。 |
| Prisma 数据模型 | `backend/prisma/schema.prisma` | 已开发 | `backend/prisma/schema.prisma` | 已定义用户、会话、星球、成员、帖子、评论、点赞、订单、支付、优惠券、推广、通知、统计等完整模型。 |
| Prisma 连接层 | `backend/src/db/prisma.js` | 已开发 | `backend/src/db/prisma.js` | PrismaClient 初始化和开发态复用已接好。 |
| 认证与会话 | `backend/src/services/authService.js` | 已开发 | `backend/src/services/authService.js` | 支持微信登录、手机号一键登录、web 手机号登录、会话查询、退出登录。 |
| 微信能力接入 | `backend/src/services/wechatService.js` | 已开发 | `backend/src/services/wechatService.js` | 已接 `code2session`、手机号解密、access_token 刷新；缺少支付能力。 |
| 星球发现/加入前列表 | `backend/src/services/planetService.js` | 已开发 | `backend/src/services/planetService.js` | 已有 `discover`、`mine`、`joined`、`create`。 |
| 星球主页与内容流 | `backend/src/services/contentService.js` | 已开发 | `backend/src/services/contentService.js` | 已有 `groupHome`、tab 列表、置顶帖、发现页精华、我的发帖。 |
| 发帖/编辑/删除 | `backend/src/services/contentService.js` | 已开发 | `backend/src/services/contentService.js` | 已支持创建、编辑、删除帖子，并维护 `group.contentCount`。 |
| 评论与点赞 | `backend/src/services/contentService.js` | 已开发 | `backend/src/services/contentService.js` | 已支持评论列表、发表评论、帖子点赞、评论点赞。 |
| 加入链路与订单 | `backend/src/services/joinFlowService.js` | 半开发/占位 | `backend/src/services/joinFlowService.js`；`backend/scripts/verifyJoinFlow.js` | 已支持预览、创建加入订单、mock 支付回调、成员资格开通；仍是 mock 支付，不是真实微信支付/续费。 |
| 图片上传与静态文件 | `backend/src/server.js` | 已开发 | `backend/src/server.js` | 已支持 `/api/uploads/image` 和 `/uploads/*` 本地文件访问。 |
| demo 种子数据与验收脚本 | `backend/src/db/seedDemoData.js`；`backend/scripts/verifyJoinFlow.js` | 已开发 | `backend/src/db/seedDemoData.js`；`backend/scripts/verifyJoinFlow.js` | 已有固定 demo 用户、星球、帖子、优惠券、渠道和 join flow 验证脚本。 |
| 基础后台数据接口 | `backend/src/server.js` | 半开发/占位 | `backend/src/server.js` | 目前只有 `/api/admin/promotion/data` 一个静态 payload，尚未从数据库聚合真实后台数据。 |
| 后台 CRUD / 权限 / 运营工具接口群 | `backend/src` | 未开发 | `backend/src/server.js`；`docs/admin-rebuild-plan.md` | 未见优惠券管理、渠道管理、权限设置、通知任务、成员管理、内容审核等独立接口群。 |

backend 结论：

- 已有真实可用基础：登录、星球列表、星球主页、发帖、评论、点赞、创建星球、图片上传、加入 mock 流程。
- 半成品集中区：支付、续费、后台数据聚合、后台 CRUD、权限、运营工具。
- 第一轮不宜做的事：把当前 backend 直接重写成 NestJS。正确动作是先在现有 Node.js + Prisma 代码上补齐闭环和缺口。

## 3. admin-web 模块盘点

| 模块名 | 所在路径 | 当前状态 | 证据文件 | 备注 |
| --- | --- | --- | --- | --- |
| 应用骨架与路由 | `admin-web/src/App.tsx` | 已开发 | `admin-web/src/App.tsx` | 已有登录页、受保护路由、星球页、预览页、后台页和兜底参考页。 |
| 后台布局与菜单 | `admin-web/src/components/AdminLayout.tsx`；`admin-web/src/data/menu.ts` | 已开发 | `admin-web/src/components/AdminLayout.tsx`；`admin-web/src/data/menu.ts` | 后台侧栏、菜单分组、标题区已搭好。 |
| 登录与会话守卫 | `admin-web/src/pages/user/LoginPage.tsx`；`admin-web/src/components/RequireSession.tsx`；`admin-web/src/services/authWebService.ts` | 已开发 | 上述文件 | 通过 backend 的 `web-mobile-login`、`session`、`logout` 完成登录和守卫。 |
| 星球列表页 | `admin-web/src/pages/user/GroupDataPage.tsx` | 已开发 | `admin-web/src/pages/user/GroupDataPage.tsx`；`admin-web/src/services/planetWebService.ts` | 已从 backend 读取“我创建的星球/我加入的星球”。 |
| 星球首页内容流 | `admin-web/src/pages/user/GroupHomePage.tsx` | 已开发 | `admin-web/src/pages/user/GroupHomePage.tsx`；`admin-web/src/services/planetWebService.ts` | 已接星球主页、帖子列表、发帖、编辑、删除、评论、点赞、图片上传。 |
| 加入预览与 mock 支付页 | `admin-web/src/pages/user/PlanetPreviewPage.tsx` | 已开发 | `admin-web/src/pages/user/PlanetPreviewPage.tsx`；`admin-web/src/services/planetPreviewService.ts` | 已能验证预览页、创建订单、模拟支付、刷新会员状态。 |
| 推广数据页 | `admin-web/src/pages/admin/PromotionDataPage.tsx` | 半开发/占位 | `admin-web/src/pages/admin/PromotionDataPage.tsx`；`admin-web/src/services/promotionService.ts` | 页面结构完成，但数据依赖 backend 的静态 promotion payload 或前端 fallback。 |
| 通用后台数据页骨架 | `admin-web/src/pages/admin/DashboardPage.tsx`；`admin-web/src/services/adminService.ts` | 半开发/占位 | `admin-web/src/pages/admin/DashboardPage.tsx`；`admin-web/src/services/adminService.ts` | 主要从 `pageDataMap` 读静态样例，不是真后台实现。 |
| 参考页 iframe 与采集 HTML | `admin-web/src/pages/admin/ReferenceFramePage.tsx`；`admin-web/public/reference-admin/*` | 半开发/占位 | `admin-web/src/pages/admin/ReferenceFramePage.tsx`；`admin-web/src/data/referencePages.ts` | 用于复刻参考，不应被误判为“页面已完成”。 |
| API 客户端与服务层 | `admin-web/src/services/apiClient.ts`；`authWebService.ts`；`planetWebService.ts`；`planetPreviewService.ts` | 已开发 | 上述文件 | `apiClient` 已统一会话头；星球业务 service 比后台 service 更完整。 |
| 后台真实 CRUD 页面群 | `admin-web/src/pages/admin` | 未开发 | `admin-web/src/App.tsx`；`admin-web/src/data/referencePages.ts` | 大部分后台菜单仍落到参考页或静态 data map，没有独立可编辑业务页。 |

admin-web 结论：

- 这不是“纯后台未开始”，而是“用户侧联调页已挺完整，后台侧仅有一页半真实实现”。
- 真正能纳入第一轮交付的 admin-web 页面，应只冻结为：登录、星球列表、星球首页、加入预览、基础后台数据页。
- 其余推广/续期/工具/权限菜单，目前本质上还是占位层和视觉参考层。

## 4. miniprogram 模块盘点

| 模块名 | 所在路径 | 当前状态 | 证据文件 | 备注 |
| --- | --- | --- | --- | --- |
| 小程序壳与页面注册 | `miniprogram/app.ts`；`miniprogram/app.json` | 已开发 | `miniprogram/app.ts`；`miniprogram/app.json` | 已注册 25 个页面，保留全局 tabBar，并为知识星球模块单独扩展页面。 |
| 原生请求层 | `miniprogram/utils/request.ts` | 已开发 | `miniprogram/utils/request.ts` | 使用 `wx.request`，支持多 base URL 兜底、会话头、重试。 |
| 登录态与微信登录 | `miniprogram/utils/auth.ts`；`auth-api.ts`；`wechat-login.ts` | 已开发 | 上述文件 | 已封装 session 存储、`wx.login`、微信登录、手机号一键登录、退出登录。 |
| 登录页 | `miniprogram/pages/auth/login.ts` | 已开发 | `miniprogram/pages/auth/login.ts` | 支持微信登录和手机号授权后跳转。 |
| 我的星球列表页 | `miniprogram/pages/planet/index.ts` | 已开发 | `miniprogram/pages/planet/index.ts`；`miniprogram/utils/planet-api.ts` | 会同步 backend 的 joined/mine 列表，并保留本地缓存。 |
| 发现页 | `miniprogram/pages/planet/lobby.ts` | 已开发 | `miniprogram/pages/planet/lobby.ts`；`miniprogram/utils/planet-api.ts` | 已请求 backend 的 discover planets 和 discover featured posts。 |
| 星球主页/加入入口 | `miniprogram/pages/planet/home.ts` | 半开发/占位 | `miniprogram/pages/planet/home.ts`；`miniprogram/utils/planet-api.ts` | 帖子流、置顶帖、加入链路已接后端；指标、描述、部分 tab 和支付仍是静态或 mock。 |
| 帖子详情/评论/点赞 | `miniprogram/pages/planet/post.ts` | 已开发 | `miniprogram/pages/planet/post.ts` | 已接帖子详情、评论列表、发评论、帖子点赞、评论点赞。 |
| 发帖/编辑/图片上传 | `miniprogram/pages/planet-publish/index.ts` | 已开发 | `miniprogram/pages/planet-publish/index.ts` | 已接帖子详情回填、图片上传、发帖、编辑。 |
| 创建星球 | `miniprogram/pages/planet/create.ts` | 已开发 | `miniprogram/pages/planet/create.ts` | 已调用 backend 创建星球，并回写本地缓存。 |
| 星球内“我的”页 | `miniprogram/pages/planet/mine.ts` | 已开发 | `miniprogram/pages/planet/mine.ts` | 已做静默登录、手机号授权、退出登录。 |
| 全局 profile 页 | `miniprogram/pages/profile/index.ts` | 已开发 | `miniprogram/pages/profile/index.ts` | 与星球模块 mine 页功能重叠，但实现更轻。 |
| 调试页 | `miniprogram/pages/planet/debug.ts` | 已开发 | `miniprogram/pages/planet/debug.ts` | 可直接查看 health、session、mine、joined、discover、my-posts、debug state 回包。 |
| 低频展示页 | `miniprogram/pages/planet/share-card.ts`；`poster.ts`；`profile.ts` | 半开发/占位 | 上述文件 | 以本地数据和 canvas 绘制为主，没有真实业务读写。 |
| 互动扩展页 | `miniprogram/pages/planet/checkin.ts`；`columns.ts`；`beans.ts`；`embed.ts` | 半开发/占位 | 上述文件 | 打卡、专栏、星球豆、嵌入页仍是静态页或空页。 |
| 非星球主业务页 | `miniprogram/pages/index/index.ts`；`articles/*`；`calendar/index.ts`；`store/index.ts`；`membership/index.ts`；`ai/index.ts` | 半开发/占位 | 上述文件 | 首页、文章、课程、商城、会员、AI 主要是静态展示，未接后端主流程。 |
| Legacy 详情页 | `miniprogram/pages/planet/detail.ts` | 半开发/占位 | `miniprogram/pages/planet/detail.ts` | 现在只是重定向到新的星球页。 |

miniprogram 结论：

- 知识星球主路径已经不是“视觉稿”，而是“可联调版本”。
- 真正接通 backend 的核心页面已经覆盖：登录、星球列表、发现、星球主页、帖子详情、发帖、评论、点赞、创建星球、我的星球。
- 还不能判定为完整成品的原因，是星球主页的介绍区、统计区、部分 tab、支付、低频页面仍大量依赖本地种子数据或 mock 行为。

## 5. 知识星球核心闭环对照表

| 能力 | backend | admin-web | miniprogram | 当前判断 | 关键证据 |
| --- | --- | --- | --- | --- | --- |
| 登录 | 已开发 | 已开发 | 已开发 | 基础实现已具备 | `backend/src/services/authService.js`；`admin-web/src/pages/user/LoginPage.tsx`；`miniprogram/pages/auth/login.ts` |
| 星球发现/加入 | 半开发/占位 | 已开发 | 半开发/占位 | 闭环可演示，但加入仍依赖 mock 支付 | `backend/src/services/joinFlowService.js`；`admin-web/src/pages/user/PlanetPreviewPage.tsx`；`miniprogram/pages/planet/lobby.ts`；`miniprogram/pages/planet/home.ts` |
| 星球主页 | 已开发 | 已开发 | 半开发/占位 | 后端和 web 已可读真实数据；小程序主页仍是“真实内容流 + 静态壳”混合态 | `backend/src/services/contentService.js`；`admin-web/src/pages/user/GroupHomePage.tsx`；`miniprogram/pages/planet/home.ts` |
| 发帖 | 已开发 | 已开发 | 已开发 | 基础实现已具备 | `backend/src/services/contentService.js`；`admin-web/src/services/planetWebService.ts`；`miniprogram/pages/planet-publish/index.ts` |
| 评论 | 已开发 | 已开发 | 已开发 | 基础实现已具备 | `backend/src/services/contentService.js`；`admin-web/src/pages/user/GroupHomePage.tsx`；`miniprogram/pages/planet/post.ts` |
| 点赞 | 已开发 | 已开发 | 已开发 | 基础实现已具备 | `backend/src/services/contentService.js`；`admin-web/src/pages/user/GroupHomePage.tsx`；`miniprogram/pages/planet/post.ts` |
| 我的星球 | 已开发 | 已开发 | 已开发 | 基础实现已具备 | `backend/src/services/planetService.js`；`admin-web/src/pages/user/GroupDataPage.tsx`；`miniprogram/pages/planet/index.ts` |
| 基础后台数据页 | 半开发/占位 | 半开发/占位 | 不适用 | 只有一张“推广数据”基础页能跑，且数据是静态 payload | `backend/src/server.js`；`admin-web/src/pages/admin/PromotionDataPage.tsx`；`admin-web/src/services/promotionService.ts` |

核心判断汇总：

- “登录、我的星球、发帖、评论、点赞”已经不是空白项，可以直接进入缺口审计。
- “发现/加入、星球主页、基础后台数据页”仍然是第一轮最值得补齐的短板。
- 当前三端最不应该做的，是把已经跑通的闭环推翻重做。

## 6. 第一轮范围冻结

### 本轮必须做

- 以当前 `backend` 为基线继续做一期，不做 NestJS/TypeScript 重写，优先补当前 Node.js + Prisma 实现上的真实缺口。
- 后端必须补齐知识星球第一轮最小闭环的真实数据读写：登录态、星球发现、我的星球、星球主页、帖子、评论、点赞、创建星球、图片上传。
- 后端必须把 `admin-web` 需要的“基础后台数据页”从静态 payload 过渡到真实聚合读模型，至少能支撑一张可用的数据页。
- `admin-web` 第一轮只冻结五个页面：登录、星球列表、星球首页、加入预览页、基础后台数据页；不要继续向 20 多个后台菜单同时扩张。
- `miniprogram` 第一轮只冻结知识星球主链路：登录、发现、加入、星球主页、帖子详情、发帖、评论、点赞、我的星球。
- 小程序继续严格保持原生实现：`WXML / WXSS / JS`、`wx.request`、`wx.uploadFile`、绝对路径导航、`this.setData()`。

### 本轮建议暂缓

- 真实微信支付、真实续费、退款、订单售后。
- Redis、消息队列、定时任务、复杂缓存层。
- 优惠券后台、渠道二维码后台、分组通知、权限设置、续期工具等完整后台菜单。
- 星球豆、打卡、专栏、分享卡、长图海报、成员身份验证、视频号直播、创作灵感。
- 首页、文章、课程、商城、AI 等非知识星球主闭环业务。

### 明显超出第一轮范围的能力

- 一次性完成知识星球用户端和管理端的全量像素级复刻。
- 一次性落完整 RBAC、管理员体系、操作日志审计和全部后台工具页。
- 一次性把 backend 从当前结构整体迁移到 NestJS + Redis + 新路由体系。
- 一次性接入正式支付、完整会员订阅体系、续费营销、通知触达、增长体系。

冻结结论：

- 第一轮的正解是“先把现有三端已经露头的闭环补实”，不是“重新设计一套更漂亮的系统”。
- 这个冻结顺序与 `docs/rebuild-workflow.md` 的执行 SOP 一致：先跑通页面结构和核心交互，再补真实数据与接口联调，最后再做细节优化。
- 后续 02 号提示词必须把 backend 当成“已有实现，需要审计和补缺”，不能把 docs 里的理想架构当作当前落地事实。

## 7. 给 02 号提示词的输入摘要

- backend 真实技术基线是 `Node.js CommonJS + Prisma + PostgreSQL`，不是 `NestJS + TypeScript + Redis`。
- backend 已有真实接口：认证、星球发现/我的/已加入、星球主页、帖子列表、置顶帖、精华帖子、帖子详情、发帖/改帖/删帖、评论、点赞、创建星球、上传图片、创建加入订单、mock 支付回调、会员状态、调试快照。
- backend 当前最大缺口：真实后台数据聚合接口不足；后台 CRUD 缺失；支付仍是 mock；无测试、无 CI。
- admin-web 当前不要按“全后台已完成”处理，应按“联调页较完整，后台页大量占位”处理。
- miniprogram 当前不要按“纯视觉稿”处理，应按“主链路已联后端，但仍有静态壳混杂”处理。
- 02 号提示词应优先输出 backend 缺口清单，并明确哪些可以沿用现有代码补齐，哪些必须新增。

## 给下一轮的输入
- backend 已完成: 认证登录、session、星球发现/我的/已加入、星球主页、帖子列表、置顶帖、精华帖子、帖子详情、发帖/编辑/删除、评论、点赞、创建星球、图片上传、加入订单、mock 支付回调、会员状态、demo seed 与 join flow 校验脚本。
- backend 半完成: 加入链路依赖 mock 支付；后台基础数据页只有静态 promotion payload；后台业务接口没有形成完整 CRUD。
- backend 未完成: 真实微信支付/续费、后台内容/成员/优惠券/渠道/权限/通知接口、Redis/队列/定时任务、测试与 CI。
- admin-web 已完成: 登录与 session 守卫、星球列表页、星球首页内容流、加入预览页、基础后台布局与菜单骨架。
- admin-web 半完成: 推广数据页、通用 DashboardPage、参考 iframe 页面、后台菜单大部分仍是静态或参考页。
- admin-web 未完成: 真正的后台 CRUD 页面群、筛选表格操作、权限页真实交互、优惠券/渠道/通知等管理能力。
- miniprogram 已完成: 原生请求层、微信登录/手机号授权、知识星球列表、发现页、帖子详情、发帖/编辑、评论、点赞、创建星球、我的星球、调试页。
- miniprogram 半完成: 星球主页是“真实内容流 + 静态介绍/指标/mock 加入”混合态；分享卡/海报/专栏/打卡/星球豆等为低频半成品。
- miniprogram 未完成: 真实支付与正式会员、非知识星球业务模块联调、外围低频页后端化。
- 第一轮必须做: 先补 backend 缺口，再让 admin-web 的五个关键页吃上真实数据，最后把 miniprogram 知识星球主链路补稳。
- 第一轮暂缓: 全量后台菜单、支付/续费、增长工具、商城/课程/AI 等非主闭环模块，以及 backend 技术栈重写。

FINAL_STATUS: COMPLETE
QUALITY_SCORE: 5
NEXT_ACTIONS:
- 进入 02 号提示词，基于当前 `backend` 的真实 `Node.js CommonJS + Prisma` 实现做缺口审计
- 优先审计三类 backend 缺口：`/api/admin/promotion/data` 静态化、join flow mock 支付、后台 CRUD 缺失
- backend 审计完成后，再对齐 `admin-web` 五个冻结页面与 `miniprogram` 知识星球主链路的真实接口
CHANGED_FILES:
- .project-surgeon/analysis-report.md
- .project-surgeon/state.json

## pass-3

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None


## pass-4

DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None

## Current Prompt Body

# Prompt 01: 项目盘点与范围冻结

你现在是这个项目的总分析师。项目根目录是 `D:\CodeDevelopment\xueyinMiniapp`。

本轮目标不是写代码，而是先把当前项目的真实现状盘清楚，并冻结第一轮实施范围，为后续 02-10 号提示词提供基础输入。

## 项目背景

- 这是一个包含三端的项目：
  - `miniprogram`：原生微信小程序
  - `admin-web`：管理后台 Web
  - `backend`：Node.js + Prisma + PostgreSQL 后端
- 对标方向参考“知识星球”
- 当前优先级顺序已经确定：
  1. 先后端
  2. 再 admin-web
  3. 再小程序

## 强约束

- 不要凭感觉脑补，优先以仓库真实代码为准
- 输出里必须区分“已开发”“半开发/占位”“未开发”
- 不要在这一步直接开始大改代码
- 小程序相关判断必须遵守原生微信小程序约束

## 执行步骤

1. 读取以下目录并做模块盘点：
   - `backend`
   - `admin-web`
   - `miniprogram`
   - `docs`
2. 梳理三端当前已经存在的页面、接口、服务、数据模型、工具函数。
3. 对每个端输出一份“模块清单表”，至少包含：
   - 模块名
   - 所在路径
   - 当前状态
   - 证据文件
   - 备注
4. 对照“知识星球核心闭环”整理第一轮必须覆盖的能力：
   - 登录
   - 星球发现/加入
   - 星球主页
   - 发帖
   - 评论
   - 点赞
   - 我的星球
   - 基础后台数据页
5. 判断哪些能力已经具备基础实现，哪些只是页面壳、静态数据或半成品。
6. 输出“第一轮范围冻结结论”：
   - 本轮必须做
   - 本轮建议暂缓
   - 明显超出第一轮范围的能力

## 输出要求

请输出一份 Markdown 报告，标题为“项目盘点与范围冻结”。

报告必须包含以下章节：

1. 项目三端现状总览
2. backend 模块盘点
3. admin-web 模块盘点
4. miniprogram 模块盘点
5. 知识星球核心闭环对照表
6. 第一轮范围冻结
7. 给 02 号提示词的输入摘要

## 交付物格式

最后单独给出一个可供下一轮复用的结构化摘要，格式如下：

```md
## 给下一轮的输入
- backend 已完成:
- backend 半完成:
- backend 未完成:
- admin-web 已完成:
- admin-web 半完成:
- admin-web 未完成:
- miniprogram 已完成:
- miniprogram 半完成:
- miniprogram 未完成:
- 第一轮必须做:
- 第一轮暂缓:
```


## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
