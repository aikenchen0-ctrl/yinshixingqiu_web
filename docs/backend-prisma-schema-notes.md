# 后端 Prisma Schema 说明

这份说明对应 `backend/prisma/schema.prisma`，是基于刚刚实际点击和抓包后的管理端页面整理出来的第一版后端数据模型。

## 覆盖范围

- 收入数据
- 推广拉新
- 优惠券
- 渠道二维码
- 成员活跃
- 内容活跃
- 成员积分榜
- 续期数据
- 分组通知
- 成员身份验证
- 权限设置
- 创作灵感
- 导出任务

## 表的分层

- 业务主表：`groups`、`group_members`、`posts`、`comments`、`orders`、`payment_records`
- 配置表：`group_permission_policies`、`coupons`、`promotion_channels`、`group_notifications`、`renewal_settings`、`renewal_notification_templates`、`scoreboard_settings`、`score_rules`
- 汇总表：`group_income_daily_stats`、`group_promotion_daily_stats`、`group_member_daily_stats`、`group_content_daily_stats`、`group_renewal_daily_stats`

## 页面到数据的映射

- `收入数据` 主要读 `orders`、`payment_records`、`group_income_daily_stats`
- `推广数据` 主要读 `promotion_channels`、`orders`、`group_promotion_daily_stats`
- `新人优惠券` / `续期优惠券` 主要读 `coupons`、`coupon_claims`
- `渠道二维码` 主要读 `promotion_channels`
- `成员活跃` 主要读 `group_members`、`group_member_daily_stats`
- `内容活跃` 主要读 `posts`、`comments`、`group_content_daily_stats`
- `成员积分榜` 主要读 `scoreboard_settings`、`score_rules`、`member_score_ledgers`
- `续期数据` 主要读 `renewal_settings`、`group_renewal_daily_stats`
- `分组通知` 主要读 `group_notifications`
- `成员身份验证` 主要读 `identity_member_contracts`
- `权限设置` 主要读 `group_permission_policies`、`group_staffs`
- `创作灵感` 主要读 `hot_board_snapshots`、`hot_board_items`
- `视频号直播导出` 主要读 `export_tasks`

## 使用建议

- 先用这份 schema 起 Prisma migration，再接 NestJS 模块。
- 第一批建议先做 `groups`、`group_members`、`orders`、`coupons`、`promotion_channels`、`renewal_settings`。
- 日统计表建议用定时任务每日回填，不建议全部在线聚合。
