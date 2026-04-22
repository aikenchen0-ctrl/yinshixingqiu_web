# Dashboard 统计层设计

## 目标

这份文档只聚焦管理端 Dashboard 相关的数据结构与接口设计。

原因很简单：

- 你当前管理端最先要跑起来的是数据页
- 真实后台的核心页面本质上都是统计页
- 如果没有一层清晰的统计快照表，后台会越来越难做

所以这里不再讨论“页面长什么样”，而是只讨论：

- 统计什么
- 从哪里来
- 用哪些表存
- 接口怎么返回

## 当前最重要的四类 Dashboard 页面

根据你已经采集到的后台页面，第一阶段最值得优先支持的页面是：

1. 收入数据
2. 推广数据
3. 成员活跃
4. 续期数据

这四类页面基本覆盖了后台最核心的统计需求。

## 统计层设计原则

### 1. 明细和统计分开

不要让后台页面每次都直接扫：

- `orders`
- `payment_records`
- `planet_members`
- `channel_visit_logs`
- `posts`
- `comments`

这些明细表只适合做业务真相源，不适合直接承担所有后台图表查询。

正确方式是：

- 明细表负责存原始事件
- 快照表负责存统计结果

### 2. 按天聚合，按需再汇总

后台真实页面里大量出现：

- 今日
- 昨日
- 本周
- 上周
- 本月
- 上月
- 近 7 天
- 近 30 天

所以最合理的粒度是：

- 先按 `日` 聚合
- 周、月、区间查询都从日表上汇总

### 3. 快照表要围绕页面组织，而不是围绕数据库表组织

例如“收入数据页”真正关心的不是单张订单，而是：

- 累计收入
- 本月收入
- 续期收入
- 赞赏收入
- 付费提问收入
- 成员数变化

所以快照表字段要贴近页面展示，而不是只贴近底层订单结构。

## 统计真相源

Dashboard 的底层统计真相建议来自这些业务表：

- `orders`
- `payment_records`
- `memberships`
- `planet_members`
- `channel_visit_logs`
- `posts`
- `comments`
- `post_likes`
- `point_transactions`
- `notifications`

## 推荐的统计快照表

## 1. income_daily_stats

用于支撑“收入数据”页的核心卡片、趋势图和分收入类型统计。

### 字段建议

- `id`
- `planet_id`
- `stat_date`
- `total_income_amount`
- `membership_income_amount`
- `renewal_income_amount`
- `reward_income_amount`
- `question_income_amount`
- `refund_amount`
- `paid_order_count`
- `paid_user_count`
- `new_paid_member_count`
- `renewal_member_count`
- `created_at`
- `updated_at`

### 字段说明

- `total_income_amount`：当天总净收入
- `membership_income_amount`：新加入付费收入
- `renewal_income_amount`：续期收入
- `reward_income_amount`：赞赏收入
- `question_income_amount`：付费提问收入
- `new_paid_member_count`：当天新增付费成员数
- `renewal_member_count`：当天续期成功成员数

### 索引建议

- `(planet_id, stat_date)` 唯一索引
- `(stat_date)` 普通索引

## 2. member_daily_stats

用于支撑成员总量、付费成员、免费成员、退出成员、留存、活跃等统计。

### 字段建议

- `id`
- `planet_id`
- `stat_date`
- `total_member_count`
- `paid_member_count`
- `free_member_count`
- `quitted_member_count`
- `new_member_count`
- `new_paid_member_count`
- `new_free_member_count`
- `expired_member_count`
- `active_member_7d_count`
- `active_member_30d_count`
- `app_download_member_count`
- `created_at`
- `updated_at`

### 字段说明

- `total_member_count`：当天结束时星球内总成员数
- `new_member_count`：当天新增成员
- `active_member_7d_count`：统计日回溯 7 天内活跃成员数
- `app_download_member_count`：已下载 App 的成员数

## 3. promotion_daily_stats

用于支撑推广漏斗、渠道效果和转化率。

### 字段建议

- `id`
- `planet_id`
- `channel_id`
- `stat_date`
- `preview_view_count`
- `join_click_count`
- `pay_success_count`
- `preview_to_click_rate`
- `click_to_pay_rate`
- `preview_to_pay_rate`
- `paid_amount`
- `created_at`
- `updated_at`

### 字段说明

- `channel_id` 可为空
  - 为空表示全站总计
  - 不为空表示某个渠道的明细

### 索引建议

- `(planet_id, stat_date, channel_id)` 唯一索引

## 4. renewal_daily_stats

用于支撑续期转化页。

### 字段建议

- `id`
- `planet_id`
- `stat_date`
- `renewal_page_view_count`
- `renewal_click_count`
- `renewal_success_count`
- `renewal_conversion_rate`
- `renewal_income_amount`
- `coupon_sent_count`
- `coupon_used_count`
- `discount_order_count`
- `created_at`
- `updated_at`

### 字段说明

- `renewal_page_view_count`：进入续期页人数
- `renewal_success_count`：成功续期人数
- `coupon_sent_count`：当天发出的续期券数量
- `coupon_used_count`：当天续期券核销量

## 5. content_daily_stats

用于支撑内容活跃页。

### 字段建议

- `id`
- `planet_id`
- `stat_date`
- `post_count`
- `article_count`
- `notice_count`
- `comment_count`
- `like_count`
- `active_author_count`
- `active_comment_user_count`
- `created_at`
- `updated_at`

### 字段说明

- `post_count`：普通帖子数
- `article_count`：长文数
- `notice_count`：公告数
- `active_author_count`：当天发过内容的作者数

## 6. point_rank_snapshots

用于支撑“成员积分榜”。

### 字段建议

- `id`
- `planet_id`
- `stat_date`
- `rank_type`
- `user_id`
- `score`
- `rank_no`
- `created_at`

### 字段说明

- `rank_type` 建议支持：
  - `DAILY`
  - `WEEKLY`
  - `MONTHLY`
  - `TOTAL`

## 推荐的统计口径

## 收入口径

### 总收入

统计规则建议：

- 已支付成功订单
- 减去退款金额
- 只计算属于当前星球的收入

### 付费加入收入

统计规则建议：

- `orders.biz_type = PLANET_JOIN`
- `pay_status = PAID`

### 续期收入

统计规则建议：

- `orders.biz_type = MEMBERSHIP_RENEWAL`
- `pay_status = PAID`

### 赞赏收入

统计规则建议：

- `orders.biz_type = REWARD`

### 付费提问收入

统计规则建议：

- `orders.biz_type = QUESTION`

## 推广漏斗口径

### 访问预览页人数

统计规则建议：

- 去重 visitor_key
- 事件类型 `preview_view`

### 点击加入按钮人数

统计规则建议：

- 去重 visitor_key
- 事件类型 `join_click`

### 成功支付人数

统计规则建议：

- 去重 user_id
- 当日从该渠道归因成功的加入订单

## 成员活跃口径

### 活跃成员

建议先采用简单口径：

- 在统计周期内访问过星球页面，或发帖、评论、点赞任一行为发生过

### App 下载率

建议需要补一个成员设备或 App 使用标记字段，例如：

- `users.has_downloaded_app`
- 或单独一张 `user_device_stats`

## 续期口径

### 进入续期页人数

- 去重 user_id
- 记录到 `renewal_page_view` 事件

### 续期成功人数

- `memberships` 续期订单支付成功的用户数

### 续期转化率

- `renewal_success_count / renewal_page_view_count`

## admin-api 接口草案

统一前缀建议：

- `/admin-api/v1/dashboard`

## 一. 收入数据页接口

### 1. 收入概览

`GET /admin-api/v1/dashboard/income-overview?planetId=xxx`

返回建议：

```json
{
  "totalIncome": 0,
  "yesterdayIncome": 0,
  "thisWeekIncome": 0,
  "lastWeekIncome": 0,
  "thisMonthIncome": 0,
  "lastMonthIncome": 0,
  "membershipIncome": 0,
  "renewalIncome": 0,
  "rewardIncome": 0,
  "questionIncome": 0,
  "totalMembers": 1,
  "newMembersYesterday": 0,
  "paidMembers": 0,
  "renewedMembersThisMonth": 0
}
```

### 2. 收入趋势

`GET /admin-api/v1/dashboard/income-trend?planetId=xxx&granularity=day&startDate=2026-03-01&endDate=2026-03-31`

返回建议：

```json
{
  "items": [
    {
      "date": "2026-03-31",
      "totalIncome": 0,
      "membershipIncome": 0,
      "renewalIncome": 0
    }
  ]
}
```

### 3. 收入报表

`GET /admin-api/v1/dashboard/income-report?planetId=xxx&startDate=2026-03-01&endDate=2026-03-31&page=1&pageSize=20`

返回建议：

```json
{
  "list": [
    {
      "time": "2026-03-31 11:23:00",
      "type": "免费加入",
      "nickname": "首位成员",
      "payAmount": 0,
      "ownerIncome": 0,
      "status": "PAID"
    }
  ],
  "total": 1
}
```

## 二. 推广数据页接口

### 1. 推广漏斗

`GET /admin-api/v1/dashboard/promotion-funnel?planetId=xxx&channelId=optional`

返回建议：

```json
{
  "previewViewCount": 0,
  "joinClickCount": 0,
  "paySuccessCount": 0,
  "previewToClickRate": 0,
  "clickToPayRate": 0,
  "previewToPayRate": 0
}
```

### 2. 渠道效果列表

`GET /admin-api/v1/dashboard/promotion-channels?planetId=xxx&startDate=2026-03-01&endDate=2026-03-31`

返回建议：

```json
{
  "list": [
    {
      "channelId": "ch_1",
      "channelName": "朋友圈海报",
      "previewViewCount": 12,
      "joinClickCount": 2,
      "paySuccessCount": 0,
      "conversionRate": 0
    }
  ]
}
```

## 三. 成员活跃页接口

### 1. 成员概览

`GET /admin-api/v1/dashboard/member-overview?planetId=xxx`

返回建议：

```json
{
  "totalMembers": 1,
  "paidMembers": 0,
  "freeMembers": 1,
  "quittedMembers": 0,
  "weeklyActiveMembers": 0,
  "weeklyActiveRate": 0,
  "appDownloadMembers": 0,
  "appDownloadRate": 0
}
```

### 2. 成员分层

`GET /admin-api/v1/dashboard/member-segments?planetId=xxx`

返回建议：

```json
{
  "highActiveCount": 0,
  "midActiveCount": 0,
  "silentCount": 1
}
```

## 四. 续期数据页接口

### 1. 续期概览

`GET /admin-api/v1/dashboard/renewal-overview?planetId=xxx`

返回建议：

```json
{
  "renewalPageViewCount": 0,
  "renewalSuccessCount": 0,
  "renewalConversionRate": 0,
  "renewalIncome": 0,
  "couponSentCount": 0,
  "couponUsedCount": 0
}
```

### 2. 续期趋势

`GET /admin-api/v1/dashboard/renewal-trend?planetId=xxx&startDate=2026-03-01&endDate=2026-03-31`

返回建议：

```json
{
  "items": [
    {
      "date": "2026-03-31",
      "renewalPageViewCount": 0,
      "renewalSuccessCount": 0,
      "renewalIncome": 0
    }
  ]
}
```

## 统计任务建议

这些统计表不建议靠页面访问时临时算。

建议用定时任务每天跑一次日汇总。

### 推荐任务

1. `aggregateIncomeDailyStats`
2. `aggregateMemberDailyStats`
3. `aggregatePromotionDailyStats`
4. `aggregateRenewalDailyStats`
5. `aggregateContentDailyStats`
6. `aggregatePointRankSnapshots`

### 执行时间建议

- 每天凌晨或清晨执行
- 与真实后台“每日 8 点前更新昨日数据”一致

## 第一阶段最值得先做的表

如果你现在就开始落库，我建议先做这几张：

1. `income_daily_stats`
2. `member_daily_stats`
3. `promotion_daily_stats`
4. `renewal_daily_stats`
5. `orders`
6. `memberships`
7. `planet_members`
8. `channel_qrcodes`

这样第一批后台核心页就能支撑起来。

## 第二阶段再补

- `content_daily_stats`
- `point_rank_snapshots`
- `coupon_batches`
- `coupon_records`
- `notifications`

## 和当前管理端页面的映射关系

### 收入数据页

依赖：

- `income_daily_stats`
- `member_daily_stats`
- `orders`

### 推广数据页

依赖：

- `promotion_daily_stats`
- `channel_qrcodes`
- `orders`

### 成员活跃页

依赖：

- `member_daily_stats`
- `planet_members`

### 续期数据页

依赖：

- `renewal_daily_stats`
- `memberships`
- `orders`

## 最终建议

你这个管理端现在最应该先做的，不是把所有工具页一次性做完，而是先把统计层设计稳住。

只要下面这件事做好，后面页面就都好接：

- “明细表 + 日统计快照表 + dashboard 接口” 三层拆开

一句话总结：

后台页面可以照着采集页面模仿，但统计层必须自己设计，而且一定要有快照表，不然越做越重。
