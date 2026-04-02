# 后端技术方案与设计思路

## 目标

这份文档用于沉淀当前项目后端的技术选型思路，方便后续自己回看、和别人沟通、或者交给 AI 继续往下实现。

当前目标不是做一套“理论最强”的架构，而是做一套：

- 开发快
- 方便维护
- 对微信小程序友好
- 对 AI 协作友好
- 能支持 1 万到 5 万用户的稳定业务架构

---

## 一句话结论

后端推荐直接采用：

- 语言：`TypeScript`
- 框架：`NestJS`
- ORM：`Prisma`
- 数据库：`PostgreSQL`
- 缓存：`Redis`
- 文件存储：`腾讯云 COS / 阿里云 OSS / MinIO`

---

## 为什么选 TypeScript

### 1. 对当前项目最顺

当前项目前端侧已经是小程序工程，后面如果还要做管理端，前后端都走 JS/TS 体系会更统一。

统一后的收益：

- 前端、后端、管理端都能共享一套字段命名习惯
- DTO、返回结构、枚举定义更容易统一
- AI 生成代码时上下文切换更少

### 2. 对 AI 协作最好

TypeScript 的类型信息对 AI 非常友好。

好处是：

- 更容易生成可运行代码
- 更容易补全 service、controller、dto、schema
- 更容易做重构和字段联动修改
- 比动态语言更不容易把字段名写乱

### 3. 开发效率高

对于管理后台、内容系统、订单系统、权限系统这类业务，TypeScript + NestJS 的整体开发效率很高，尤其适合现在这个阶段。

---

## 为什么选 NestJS

NestJS 是 Node.js 体系里最适合做中后台和业务后端的框架之一。

### 适合这个项目的原因

- 天然适合模块化拆分
- 控制器、服务、DTO、守卫、拦截器这些概念清晰
- 很适合做后台权限、登录、内容管理、订单管理
- 社区成熟，资料多，AI 也更容易按最佳实践生成代码

### 如果类比 Spring Boot

可以把它大致理解为：

- `NestJS ~= Spring Boot`

对应关系大概是：

- `Controller` 对应 Spring MVC 的 `Controller`
- `Service` 对应 Spring 的 `Service`
- `Module` 有点像 Spring 里的模块化配置边界
- `Guard` 类似鉴权拦截器
- `Interceptor` 类似 Spring AOP / 拦截处理

所以如果你熟悉 Spring Boot，会很容易理解 NestJS。

---

## ORM 是什么

ORM 是“对象关系映射”。

它的作用是把：

- 数据库表
- 代码里的模型对象
- 查询逻辑

连接起来，让开发时不用所有场景都手写 SQL。

### 在 Spring Boot 里怎么理解

如果放到 Java 世界里：

- `MyBatis` 更像 SQL 映射工具
- `JPA / Hibernate` 更像传统 ORM
- `Prisma` 更接近现代化、类型安全、开发体验更好的 ORM

### 和 MyBatis 的关系

如果一定要类比：

- 它承担的是“数据库访问层”的角色
- 但它的写法不像 MyBatis 那样主要靠手写 mapper SQL
- 它更像“先定义模型，再通过代码 API 查询数据库”

一句话理解：

- `Prisma` 更像 TypeScript 世界里更好用的 `JPA/Hibernate`
- 它不太像 MyBatis 的使用方式

---

## 为什么选 Prisma

Prisma 是这套方案里一个很关键的点。

### 1. 对 AI 特别友好

Prisma 的 `schema.prisma` 非常清楚，AI 很容易理解：

- 有哪些表
- 表之间什么关系
- 哪些字段是枚举
- 哪些字段是一对多、多对多

这比很多 ORM 的隐式约定更适合协作。

### 2. 数据迁移体验好

项目在快速迭代阶段，字段和表结构会频繁变动。

Prisma 的好处是：

- 改 schema 明确
- 迁移文件清晰
- 不容易把数据库演进过程搞乱

### 3. CRUD 非常快

对于你这个项目最常见的场景：

- 查星球列表
- 查帖子列表
- 查详情
- 发评论
- 点赞
- 管理端筛选列表

Prisma 都很好写。

---

## 为什么选 PostgreSQL

### 1. 比 MySQL 更适合内容和后台系统

PostgreSQL 对下面这些能力支持更好：

- JSON 字段
- 复杂索引
- 全文检索扩展
- 枚举与约束
- 后续统计和分析扩展

### 2. 对这个项目足够稳

你现在预估用户规模是 1 万到 5 万，这种量级 PostgreSQL 完全够用，而且会比“为了兼容性先选 MySQL”更舒服。

### 3. 结构化能力更强

这个项目不是纯商城，也不是纯博客，而是：

- 内容
- 社群
- 订单
- 会员
- 后台管理

这种场景 PostgreSQL 很合适。

---

## 为什么还要 Redis

Redis 不是主数据库，它只是辅助加速层。

建议用途：

- 登录 token/session
- 验证码
- 限流
- 热点内容缓存
- 点赞/阅读量短时缓冲

不建议一开始把关键业务真相只放 Redis。

原则是：

- 真相在 PostgreSQL
- 加速在 Redis

---

## 为什么文章和帖子统一

当前项目里，“文章”和“帖子”本质上都属于内容。

它们共同拥有：

- 作者
- 正文
- 图片/附件
- 评论
- 点赞
- 发布时间
- 可见范围

所以不建议拆成两套表。

推荐方式：

- 统一使用 `posts` 表
- 用 `type` 区分内容形态

例如：

- `POST`：普通帖子
- `ARTICLE`：长文
- `NOTICE`：公告
- `CHECKIN`：打卡内容

这样做的好处：

- 小程序详情页逻辑统一
- 管理端内容管理统一
- 评论/点赞/媒体关联统一
- AI 改代码时不用跨两套系统改

---

## 推荐的后端模块

### 1. auth

负责：

- 微信登录
- 后台登录
- token
- 权限校验

### 2. users

负责：

- 用户资料
- 手机号
- 用户状态
- 黑名单

### 3. planets

负责：

- 星球管理
- 星球成员
- 星球栏目
- 星球设置

### 4. posts

负责：

- 帖子/文章/公告/打卡
- 列表
- 详情
- 发布与编辑
- 置顶与推荐

### 5. comments

负责：

- 评论
- 回复
- 删除/隐藏

### 6. orders

负责：

- 订单创建
- 支付结果回调
- 订单状态流转

### 7. memberships

负责：

- 星球会员周期
- 到期判断
- 续费逻辑

### 8. admin

负责：

- 后台账号
- 角色
- 权限
- 操作日志

---

## 数据库设计原则

### 1. 内容主表统一

不要把：

- 帖子
- 文章
- 公告
- 打卡

拆成很多表。

第一版统一放进 `posts`。

### 2. 计数做冗余，关系做明细

比如点赞：

- `post_likes` 保存谁点过赞
- `posts.like_count` 保存聚合后的计数

评论同理：

- `comments` 保存明细
- `posts.comment_count` 保存冗余统计

这样查询快，关系也不丢。

### 3. 会员关系和订单分开

不要只靠订单推导用户是不是星球成员。

应该分开：

- `orders` 负责交易事实
- `memberships` 负责会员周期
- `planet_members` 负责星球关系和角色

### 4. 文件不入库

图片、视频、附件不要直接进数据库。

数据库里只存：

- URL
- 宽高
- 时长
- 封面
- 排序

---

## 第一版最值得先做的能力

我建议后端第一阶段只做下面这些：

1. 微信登录
2. 星球列表
3. 星球详情
4. 内容列表
5. 内容详情
6. 评论
7. 点赞
8. 简单后台内容管理
9. 简单后台星球管理

先把最核心的“内容和社群”跑通。

支付、会员、签到、星球豆这些可以第二阶段再补。

---

## 第一版最推荐的项目结构

如果正式开后端仓库，我建议目录按这个思路拆：

```text
apps/
  api/
src/
  common/
  config/
  prisma/
  modules/
    auth/
    users/
    planets/
    posts/
    comments/
    orders/
    memberships/
    admin/
```

说明：

- `common` 放通用异常、响应封装、守卫、装饰器
- `config` 放环境配置
- `prisma` 放 PrismaService 和数据库初始化
- `modules` 按业务模块拆分

---

## 接口风格建议

建议统一分两套路由：

- 小程序接口：`/api/v1`
- 管理端接口：`/admin-api/v1`

这样好处是：

- 权限边界清楚
- 小程序和后台互不干扰
- 文档更好维护

示例：

- `POST /api/v1/auth/wechat-login`
- `GET /api/v1/planets`
- `GET /api/v1/posts/:id`
- `POST /api/v1/posts/:id/comments`
- `GET /admin-api/v1/posts`
- `PATCH /admin-api/v1/posts/:id/status`

---

## 对当前阶段的最终建议

如果现在就正式开始后端，我建议不要继续犹豫选型，直接定：

- `TypeScript + NestJS + Prisma + PostgreSQL + Redis`

原因不是它“理论最强”，而是它最符合当前项目的实际需要：

- 开发快
- 结构清晰
- 好维护
- 好扩展
- 好联调
- 对 AI 最友好

---

## 和 Spring Boot 的类比总结

如果用 Java 体系帮助理解，可以粗略这样看：

- `NestJS ~= Spring Boot`
- `Prisma ~= 更现代、更偏类型安全的 JPA/Hibernate`
- `PostgreSQL ~= MySQL/PostgreSQL 中更适合当前内容系统的一边`
- `Redis ~= 和 Spring 项目里用 Redis 的定位一致`

如果用更直接的话说：

- 框架层：NestJS 对标 Spring Boot
- 数据访问层：Prisma 不像 MyBatis，更像 ORM
- 数据库：就是主存储
- Redis：就是缓存和辅助能力

---

## 后续执行顺序

建议后续按这个顺序推进：

1. 定下 Prisma schema
2. 初始化 NestJS 项目
3. 搭 PostgreSQL 和 Redis
4. 完成微信登录
5. 完成星球和内容模块
6. 完成评论和点赞
7. 完成管理端基础内容管理
8. 再补订单、会员、签到、星球豆

这个节奏最适合当前项目阶段。
