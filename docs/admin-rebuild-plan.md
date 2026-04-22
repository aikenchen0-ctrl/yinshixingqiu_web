# 管理端复刻计划

## 目标

这份文档用于定义当前项目的网页管理端复刻范围、菜单结构、页面职责、接口方向和分阶段落地计划。

当前管理端的定位非常明确：

- 这是给管理员、星主、运营人员使用的后台系统
- 不是普通用户访问的前台网页
- 第一版目标是先做出可运行、结构清晰、方便继续扩展的后台

结合当前仓库里的采集结果：

- 已有真实后台页面采集目录：[前端页面-管理端](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端)
- 已抓到知识星球后台真实菜单结构
- 已抓到部分真实接口与响应字段

因此现在已经具备进入正式复刻阶段的条件。

## 当前已确认的后台菜单

根据真实后台页面结构，当前管理端主菜单如下：

### 1. 收入数据

- 收入数据

### 2. 推广拉新

- 推广数据
- 新人优惠券
- 渠道二维码
- 付费页优化

### 3. 用户活跃

- 成员活跃
- 内容活跃
- 成员积分榜
- 活跃工具

### 4. 成员续期

- 续期数据
- 续期优惠券
- 分组通知
- 续期页优化
- 续期折扣

### 5. 运营工具

- 优惠券
- 分组通知
- 渠道二维码
- 付费页优化
- 成员积分榜
- 创作灵感
- 视频号直播
- 成员身份验证

### 6. 权限设置

- 权限设置

## 建议的后台路由结构

为了后续自己实现管理端，建议使用更可控的路由命名，而不是完全跟着知识星球原始地址走。

建议采用：

```text
/admin
/admin/income
/admin/promotion/data
/admin/promotion/new-user-coupons
/admin/promotion/channel-qrcodes
/admin/promotion/paywall-optimization
/admin/activity/members
/admin/activity/content
/admin/activity/scoreboard
/admin/activity/tools
/admin/renewal/data
/admin/renewal/coupons
/admin/renewal/group-notices
/admin/renewal/page-optimization
/admin/renewal/discounts
/admin/tools/coupons
/admin/tools/group-notices
/admin/tools/channel-qrcodes
/admin/tools/paywall-optimization
/admin/tools/scoreboard
/admin/tools/idea-lab
/admin/tools/channel-live
/admin/tools/member-verification
/admin/permissions
```

这样做的好处：

- 路由语义更清楚
- 后端接口和前端菜单更容易映射
- 不会被原站命名细节绑定

## 页面分组与职责

## 一. 数据分析类页面

### 1. 收入数据

页面职责：

- 展示收入概览卡片
- 展示成员概览卡片
- 展示付费转化漏斗
- 展示续期转化漏斗
- 展示活跃建议模块
- 展示趋势图
- 展示收入明细报表

当前已确认接口：

- `GET /v2/dashboard/groups/{groupId}/incomes/overview`
- `GET /v2/dashboard/groups/{groupId}/conversion_rates/group_preview_view/funnel`
- `GET /v2/dashboard/groups/{groupId}/members/overview`
- `GET /v2/dashboard/groups/{groupId}/conversion_rates/renewal_view/funnel`
- `GET /v2/dashboard/groups/{groupId}/conversion_rates/download_app/funnel`
- `GET /v2/dashboard/groups/{groupId}/incomes/trend_data`
- `GET /v2/dashboard/groups/{groupId}/incomes/report_data`

建议对应的数据域：

- 订单
- 支付记录
- 会员关系
- 成员统计快照
- 收入统计快照

### 2. 推广数据

页面职责：

- 查看推广链路转化
- 查看预览页访问人数、点击人数、支付人数
- 查看渠道投放效果
- 对不同推广方式做效果评估

建议对应的数据域：

- 渠道
- 渠道二维码
- 访问事件
- 点击事件
- 订单归因

### 3. 成员活跃

页面职责：

- 查看周期内活跃成员数
- 查看成员访问、发言、互动情况
- 判断星球活跃度健康状况

建议对应的数据域：

- 成员行为日志
- 活跃统计
- 登录与访问记录

### 4. 内容活跃

页面职责：

- 查看主题发布数
- 查看评论、互动、点赞表现
- 统计内容更新频率和内容贡献

建议对应的数据域：

- 帖子
- 评论
- 点赞
- 内容统计快照

### 5. 续期数据

页面职责：

- 查看进入续期页人数
- 查看续期成功人数
- 查看续期转化率
- 配合续期优惠券、续期折扣做策略调整

建议对应的数据域：

- memberships
- renewal events
- renewal orders

## 二. 运营配置类页面

### 6. 新人优惠券

页面职责：

- 给新用户配置加入优惠券
- 控制金额、有效期、适用范围

建议对应的数据域：

- coupons
- coupon_rules
- coupon_claim_records
- coupon_use_records

### 7. 续期优惠券

页面职责：

- 针对续期用户发放优惠券
- 配合续期活动和召回策略

建议对应的数据域：

- coupons
- renewal_campaigns
- user_coupon_records

### 8. 优惠券

页面职责：

- 全局查看和管理优惠券
- 新建、停用、删除、统计使用情况

建议对应的数据域：

- coupons
- coupon_templates
- coupon_batches
- coupon_records

### 9. 渠道二维码

页面职责：

- 创建渠道二维码
- 区分不同来源投放
- 跟踪各渠道引流转化

建议对应的数据域：

- channels
- channel_qrcodes
- channel_visit_logs
- channel_conversion_stats

### 10. 付费页优化

页面职责：

- 配置付费页展示内容
- 优化星球简介、亮点、展示区块
- 实验不同文案和展示结构

建议对应的数据域：

- paywall_configs
- paywall_blocks
- paywall_experiments

### 11. 分组通知

页面职责：

- 面向不同成员分组发送通知
- 做召回、提醒、运营触达

建议对应的数据域：

- member_groups
- notifications
- notification_tasks
- notification_receipts

### 12. 续期折扣

页面职责：

- 给续期用户配置折扣策略
- 支持时间范围和生效规则

建议对应的数据域：

- renewal_discount_rules
- discount_apply_logs

### 13. 活跃工具

页面职责：

- 配置活跃度提升工具
- 例如任务、活动、引导内容、激励入口

建议对应的数据域：

- activity_campaigns
- checkin_rules
- score_rules

### 14. 成员积分榜

页面职责：

- 展示成员积分排行
- 支持周期统计、积分来源分析

建议对应的数据域：

- point_accounts
- point_transactions
- point_rank_snapshots

### 15. 创作灵感

页面职责：

- 展示热点话题和创作建议
- 辅助星主找到内容灵感

建议对应的数据域：

- hot_topics
- inspiration_items
- external_trend_sources

### 16. 视频号直播

页面职责：

- 配置直播活动
- 展示直播工具或直播数据接入

建议对应的数据域：

- live_sessions
- live_configs
- live_conversion_stats

### 17. 成员身份验证

页面职责：

- 校验成员身份
- 配置验证规则和接口能力
- 给外部系统开放校验能力

建议对应的数据域：

- member_verification_rules
- member_verification_records
- api_clients
- api_access_logs

## 三. 权限类页面

### 18. 权限设置

页面职责：

- 控制星主、合伙人、管理员的后台权限
- 配置不同角色能否访问哪些功能

建议对应的数据域：

- admin_users
- roles
- permissions
- admin_user_roles
- role_permissions

## 真实页面采集与页面映射

当前目录中已经存在的采集文件可以直接作为复刻参考：

- [01-收入数据.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/01-收入数据.html)
- [01-推广数据.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/01-推广数据.html)
- [02-新人优惠券.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/02-新人优惠券.html)
- [03-渠道二维码.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/03-渠道二维码.html)
- [05-成员活跃.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/05-成员活跃.html)
- [09-续期数据.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/09-续期数据.html)
- [14-优惠券.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/14-优惠券.html)
- [19-创作灵感.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/19-创作灵感.html)
- [21-成员身份验证.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/21-成员身份验证.html)
- [06-权限设置.html](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/06-权限设置.html)

对应的页面级 JSON 也可以辅助还原路由：

- [01-收入数据.json](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/01-收入数据.json)
- [21-成员身份验证.json](/D:/CodeDevelopment/xueyinMiniapp/前端页面-管理端/21-成员身份验证.json)

## 推荐的数据库落地方向

如果按我们已经确认的后端方向，管理端建议依托这些核心表：

- `users`
- `user_profiles`
- `planets`
- `planet_members`
- `posts`
- `comments`
- `orders`
- `payment_records`
- `memberships`
- `coupons`
- `coupon_records`
- `channels`
- `channel_qrcodes`
- `notifications`
- `point_accounts`
- `point_transactions`
- `admin_users`
- `roles`
- `permissions`
- `operation_logs`

另外建议加入统计快照表，不要所有后台统计都现场扫明细表：

- `income_daily_stats`
- `member_daily_stats`
- `content_daily_stats`
- `channel_daily_stats`
- `renewal_daily_stats`

这样后台图表和卡片查询会更稳定。

## 推荐的前端实现方式

管理端前端建议不要按原站 Angular DOM 硬复刻，而是按自己的工程结构重建。

推荐方式：

- 管理端单独一个 Web 项目
- 使用 React 或 Vue3 都可以
- 第一版优先抽标准后台骨架：
  - Layout
  - Sidebar
  - Header
  - StatCard
  - FunnelCard
  - DataTable
  - FilterBar
  - DrawerForm

页面复刻顺序要遵守：

- 先骨架
- 再数据卡片
- 再图表
- 再表格
- 最后补配置操作和表单

## 推荐的后端接口分组

建议管理端接口统一走：

`/admin-api/v1`

推荐模块：

- `/admin-api/v1/dashboard`
- `/admin-api/v1/planets`
- `/admin-api/v1/members`
- `/admin-api/v1/posts`
- `/admin-api/v1/orders`
- `/admin-api/v1/coupons`
- `/admin-api/v1/channels`
- `/admin-api/v1/notifications`
- `/admin-api/v1/points`
- `/admin-api/v1/admin-users`
- `/admin-api/v1/roles`

### 示例接口

- `GET /admin-api/v1/dashboard/income-overview`
- `GET /admin-api/v1/dashboard/income-trend`
- `GET /admin-api/v1/dashboard/promotion-funnel`
- `GET /admin-api/v1/dashboard/member-overview`
- `GET /admin-api/v1/coupons`
- `POST /admin-api/v1/coupons`
- `GET /admin-api/v1/channels/qrcodes`
- `POST /admin-api/v1/channels/qrcodes`
- `GET /admin-api/v1/notifications/groups`
- `POST /admin-api/v1/notifications/send`
- `GET /admin-api/v1/permissions`
- `PATCH /admin-api/v1/permissions`

## 分阶段复刻计划

## 第一阶段：先做能跑的后台骨架

目标：

- 菜单正确
- 路由正确
- 页面结构正确
- 能接假数据

建议优先页面：

1. 收入数据
2. 推广数据
3. 成员活跃
4. 续期数据
5. 权限设置

原因：

- 这几页最能代表后台骨架
- 同时覆盖数据卡片、图表、表格、表单、权限

## 第二阶段：补运营工具页

建议页面：

- 新人优惠券
- 优惠券
- 渠道二维码
- 分组通知
- 续期优惠券
- 续期折扣

## 第三阶段：补增强页和低频页

建议页面：

- 活跃工具
- 成员积分榜
- 创作灵感
- 视频号直播
- 成员身份验证

## 我对当前项目的建议

现在不要同时发散去做太多事。

最合理的推进顺序是：

1. 先把管理端项目单独搭起来
2. 先复刻后台通用布局
3. 先做 5 个核心页面
4. 同步把后端数据结构按后台需要落下来
5. 再逐步补工具页和细节页

一句话总结：

当前这批页面采集文件已经足够支撑第一轮复刻，不需要继续停留在“怎么抓页面”阶段，应该直接进入“怎么实现后台”的阶段。

## 下一步最推荐

我建议下一步直接做下面两件事之一：

1. 我继续帮你输出“管理端项目结构设计”
2. 我直接开始帮你搭第一版管理端骨架页面

如果以推进速度为优先，我更推荐第二个：直接开始搭管理端骨架。
