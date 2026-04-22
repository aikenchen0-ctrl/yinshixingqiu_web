# 管理端与后端数据模型草稿

## 目标

这份文档用于给当前小程序项目配套一版可快速落地的后端数据结构。

设计原则：

- 文章和帖子统一为同一个内容实体，不拆两套内容系统。
- 第一版优先保证开发快、结构清晰、方便 AI 协作和后续迭代。
- 默认技术栈采用 `Node.js + PostgreSQL + Redis + Prisma`。
- 小程序端、管理端、后端都围绕同一套领域模型展开。

## 核心判断

### 文章和帖子是不是一个东西

在这个项目里，建议把“文章”视为“帖子的一种类型”，统一落在 `posts` 表中。

原因：

- 小程序里文章详情和星球帖子详情，本质上都是内容详情页。
- 两者都需要作者、正文、图片、评论、点赞、可见范围、发布时间。
- 管理端可以统一做“内容管理”，只通过类型筛选区分“帖子”和“文章”。
- 对 AI 辅助开发更友好，避免出现两套内容 CRUD、两套权限、两套评论关联。

结论：

- 使用一张 `posts` 主表。
- 使用 `type` 字段区分 `post`、`article`、`notice`、`checkin` 等内容形态。

## 推荐技术栈

- 后端框架：NestJS
- 数据库：PostgreSQL
- 缓存：Redis
- ORM：Prisma
- 文件存储：腾讯云 COS / 阿里云 OSS / MinIO

为什么是这套：

- NestJS 对后台管理、鉴权、模块拆分很顺手。
- PostgreSQL 对 JSON、索引、扩展支持更好，适合内容和后台系统。
- Prisma schema 可读性高，迁移清晰，非常适合 AI 协作。
- Redis 可以先只做缓存、登录态、限流和热点计数，不把业务真相放进缓存。

## 领域模型

### 用户域

- 用户
- 用户资料
- 小程序登录态
- 后台账号
- 角色权限

### 星球域

- 星球
- 星球分类
- 星球成员
- 星球栏目
- 星球邀请码

### 内容域

- 内容主表 `posts`
- 内容媒体 `post_media`
- 内容话题 `topics`
- 评论 `comments`
- 点赞 `post_likes`

### 交易域

- 订单
- 支付记录
- 会员关系

### 增长域

- 签到记录
- 星球豆账户
- 星球豆流水

### 后台域

- 管理员
- 角色
- 权限
- 操作日志

## 核心表设计

### 1. users

用户主表，保存身份和登录相关信息。

关键字段：

- `id`
- `openid`
- `unionid`
- `mobile`
- `status`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

说明：

- `openid` 用于小程序登录。
- `unionid` 后续做多端账号合并时会很有用。
- `status` 建议使用 `ACTIVE`、`DISABLED`、`BANNED`。

### 2. user_profiles

用户资料表，和登录信息拆开，便于后续扩展。

关键字段：

- `userId`
- `nickname`
- `avatarUrl`
- `gender`
- `city`
- `province`
- `bio`
- `remark`

### 3. planets

星球主表，对应小程序里的“星球首页”和管理端里的“星球管理”。

关键字段：

- `id`
- `name`
- `slug`
- `avatarUrl`
- `coverUrl`
- `intro`
- `description`
- `categoryId`
- `ownerUserId`
- `joinType`
- `priceAmount`
- `pricePeriod`
- `isFree`
- `requireInviteCode`
- `status`
- `memberCount`
- `postCount`
- `publishedAt`
- `createdAt`
- `updatedAt`

说明：

- `joinType` 建议区分 `ROLLING`、`CALENDAR`、`INVITE_ONLY`。
- `pricePeriod` 可用 `YEARLY`、`MONTHLY`、`ONCE`。
- `memberCount`、`postCount` 是冗余统计字段。

### 4. planet_categories

星球分类表。

关键字段：

- `id`
- `name`
- `sortOrder`
- `status`

### 5. planet_members

星球成员关系表，是权限、是否已加入、是否过期的核心来源。

关键字段：

- `id`
- `planetId`
- `userId`
- `role`
- `joinSource`
- `expireAt`
- `status`
- `joinedAt`

说明：

- `role` 建议支持 `OWNER`、`ADMIN`、`MEMBER`、`GUEST`。
- `status` 建议支持 `ACTIVE`、`EXPIRED`、`QUIT`、`BANNED`。

### 6. planet_columns

星球栏目表，对应你现在小程序中的栏目页。

关键字段：

- `id`
- `planetId`
- `name`
- `description`
- `sortOrder`
- `status`

### 7. posts

全项目内容主表，文章和帖子统一在这里。

关键字段：

- `id`
- `planetId`
- `columnId`
- `authorUserId`
- `type`
- `title`
- `summary`
- `contentText`
- `contentJson`
- `visibility`
- `isPinned`
- `isFeatured`
- `status`
- `commentCount`
- `likeCount`
- `viewCount`
- `publishedAt`
- `createdAt`
- `updatedAt`

建议枚举：

- `type`: `POST` / `ARTICLE` / `NOTICE` / `CHECKIN`
- `visibility`: `PUBLIC_PREVIEW` / `MEMBERS_ONLY` / `PRIVATE`
- `status`: `DRAFT` / `PUBLISHED` / `HIDDEN` / `DELETED`

说明：

- 普通短帖：`type = POST`
- 长文内容：`type = ARTICLE`
- 置顶公告：`type = NOTICE`
- 打卡内容：`type = CHECKIN`

### 8. post_media

内容媒体表，支持一篇内容挂多张图、多段视频或封面。

关键字段：

- `id`
- `postId`
- `mediaType`
- `fileUrl`
- `coverUrl`
- `width`
- `height`
- `duration`
- `sortOrder`

说明：

- 数据库存 URL 和元数据即可，文件本体不要入库。

### 9. topics

星球话题表。

关键字段：

- `id`
- `planetId`
- `name`
- `color`
- `status`

### 10. post_topic_relations

内容和话题的多对多关系表。

关键字段：

- `postId`
- `topicId`

### 11. comments

评论表，支持一级评论和楼中楼。

关键字段：

- `id`
- `postId`
- `userId`
- `parentId`
- `rootId`
- `content`
- `status`
- `likeCount`
- `replyCount`
- `createdAt`
- `updatedAt`

说明：

- 一级评论：`parentId = null`
- 回复评论：`parentId` 指向直接父评论
- `rootId` 指向该串楼的根评论，便于查询整条会话

### 12. post_likes

内容点赞关系表。

关键字段：

- `id`
- `postId`
- `userId`
- `createdAt`

约束：

- `(postId, userId)` 唯一

### 13. comment_likes

评论点赞关系表。

关键字段：

- `id`
- `commentId`
- `userId`
- `createdAt`

### 14. memberships

会员关系表，用于描述用户在某个星球的付费订阅周期。

关键字段：

- `id`
- `userId`
- `planetId`
- `planName`
- `priceAmount`
- `billingType`
- `startAt`
- `expireAt`
- `status`

说明：

- `planet_members` 表示“关系和角色”
- `memberships` 表示“付费订阅周期”
- 两张表分开更清楚

### 15. orders

订单表，后续可支持星球加入、课程、商品等。

关键字段：

- `id`
- `orderNo`
- `userId`
- `bizType`
- `bizId`
- `amount`
- `payAmount`
- `status`
- `payStatus`
- `paymentChannel`
- `paidAt`
- `closedAt`
- `createdAt`

### 16. payment_records

支付记录表，保存微信支付等回调流水。

关键字段：

- `id`
- `orderId`
- `channel`
- `transactionNo`
- `amount`
- `status`
- `callbackPayload`
- `paidAt`
- `createdAt`

### 17. checkin_records

签到表，对应你现在小程序里的打卡、签到能力。

关键字段：

- `id`
- `planetId`
- `userId`
- `checkinDate`
- `content`
- `days`
- `rewardBeans`
- `createdAt`

### 18. bean_accounts

星球豆账户表。

关键字段：

- `id`
- `userId`
- `balance`
- `updatedAt`

### 19. bean_transactions

星球豆流水表。

关键字段：

- `id`
- `userId`
- `planetId`
- `type`
- `amount`
- `balanceAfter`
- `bizType`
- `bizId`
- `remark`
- `createdAt`

### 20. admin_users

后台管理员表。

关键字段：

- `id`
- `username`
- `passwordHash`
- `name`
- `mobile`
- `status`
- `lastLoginAt`
- `createdAt`

### 21. roles

后台角色表。

关键字段：

- `id`
- `name`
- `code`
- `description`

### 22. admin_user_roles

管理员和角色的关系表。

关键字段：

- `adminUserId`
- `roleId`

### 23. operation_logs

后台操作日志表。

关键字段：

- `id`
- `adminUserId`
- `module`
- `action`
- `targetType`
- `targetId`
- `requestId`
- `payload`
- `ip`
- `createdAt`

## 第一版建议先做哪些表

第一版不要一口气把所有系统做满，建议先上线这几张核心表：

- `users`
- `user_profiles`
- `planets`
- `planet_members`
- `planet_columns`
- `posts`
- `post_media`
- `comments`
- `orders`
- `admin_users`

第二轮再补：

- `roles`
- `topics`
- `post_topic_relations`
- `memberships`
- `payment_records`
- `checkin_records`
- `bean_accounts`
- `bean_transactions`
- `operation_logs`

## 管理端页面建议

围绕这套数据结构，后台页面建议按下面的信息架构搭：

- 登录
- 仪表盘
- 用户管理
- 星球管理
- 星球成员管理
- 栏目管理
- 内容管理
- 评论管理
- 订单管理
- 会员管理
- 签到与星球豆管理
- 管理员与角色权限
- 操作日志

其中“内容管理”页不要拆成两套，可以统一为一张列表：

- 支持按 `type` 筛选文章/帖子/公告/打卡
- 支持按星球、作者、状态、发布时间过滤
- 支持置顶、隐藏、推荐、删除等操作

## Prisma Schema 草稿

下面是一版适合当前项目开工的 Prisma schema 草稿，重点覆盖核心内容、星球、评论、交易和后台账户。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus {
  ACTIVE
  DISABLED
  BANNED
}

enum PlanetJoinType {
  ROLLING
  CALENDAR
  INVITE_ONLY
}

enum BillingPeriod {
  YEARLY
  MONTHLY
  ONCE
}

enum PlanetStatus {
  DRAFT
  PUBLISHED
  HIDDEN
  CLOSED
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
  GUEST
}

enum MemberStatus {
  ACTIVE
  EXPIRED
  QUIT
  BANNED
}

enum PostType {
  POST
  ARTICLE
  NOTICE
  CHECKIN
}

enum PostVisibility {
  PUBLIC_PREVIEW
  MEMBERS_ONLY
  PRIVATE
}

enum PostStatus {
  DRAFT
  PUBLISHED
  HIDDEN
  DELETED
}

enum MediaType {
  IMAGE
  VIDEO
  AUDIO
  FILE
}

enum CommentStatus {
  PUBLISHED
  HIDDEN
  DELETED
}

enum MembershipStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  REFUNDED
}

enum OrderBizType {
  PLANET_JOIN
  MEMBERSHIP
  COURSE
  GOODS
}

enum OrderStatus {
  PENDING
  PAID
  CLOSED
  REFUNDED
}

enum PayStatus {
  UNPAID
  PAID
  REFUNDED
  FAILED
}

enum PaymentChannel {
  WECHAT
  ALIPAY
  MANUAL
}

enum AdminStatus {
  ACTIVE
  DISABLED
}

model User {
  id            String         @id @default(cuid())
  openid        String         @unique
  unionid       String?        @unique
  mobile        String?        @unique
  status        UserStatus     @default(ACTIVE)
  lastLoginAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  profile       UserProfile?
  ownedPlanets  Planet[]       @relation("PlanetOwner")
  memberships   PlanetMember[]
  posts         Post[]
  comments      Comment[]
  postLikes     PostLike[]
  commentLikes  CommentLike[]
  orders        Order[]

  @@map("users")
}

model UserProfile {
  userId        String   @id
  nickname      String
  avatarUrl     String?
  gender        Int?
  city          String?
  province      String?
  bio           String?
  remark        String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id])

  @@map("user_profiles")
}

model PlanetCategory {
  id            String   @id @default(cuid())
  name          String
  sortOrder     Int      @default(0)
  status        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  planets       Planet[]

  @@map("planet_categories")
}

model Planet {
  id               String          @id @default(cuid())
  name             String
  slug             String          @unique
  avatarUrl        String?
  coverUrl         String?
  intro            String?
  description      String?
  categoryId       String?
  ownerUserId      String
  joinType         PlanetJoinType  @default(ROLLING)
  priceAmount      Decimal         @default(0) @db.Decimal(10, 2)
  pricePeriod      BillingPeriod   @default(YEARLY)
  isFree           Boolean         @default(false)
  requireInviteCode Boolean        @default(false)
  status           PlanetStatus    @default(DRAFT)
  memberCount      Int             @default(0)
  postCount        Int             @default(0)
  publishedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  category         PlanetCategory? @relation(fields: [categoryId], references: [id])
  owner            User            @relation("PlanetOwner", fields: [ownerUserId], references: [id])
  members          PlanetMember[]
  columns          PlanetColumn[]
  posts            Post[]
  topics           Topic[]
  memberships      Membership[]
  orders           Order[]

  @@index([categoryId])
  @@index([ownerUserId])
  @@index([status])
  @@map("planets")
}

model PlanetMember {
  id            String        @id @default(cuid())
  planetId      String
  userId        String
  role          MemberRole    @default(MEMBER)
  joinSource    String?
  expireAt      DateTime?
  status        MemberStatus  @default(ACTIVE)
  joinedAt      DateTime      @default(now())
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  planet        Planet        @relation(fields: [planetId], references: [id])
  user          User          @relation(fields: [userId], references: [id])

  @@unique([planetId, userId])
  @@index([userId])
  @@index([status])
  @@map("planet_members")
}

model PlanetColumn {
  id            String   @id @default(cuid())
  planetId      String
  name          String
  description   String?
  sortOrder     Int      @default(0)
  status        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  planet        Planet   @relation(fields: [planetId], references: [id])
  posts         Post[]

  @@index([planetId])
  @@map("planet_columns")
}

model Post {
  id            String          @id @default(cuid())
  planetId       String
  columnId       String?
  authorUserId   String
  type           PostType       @default(POST)
  title          String?
  summary        String?
  contentText    String?
  contentJson    Json?
  visibility     PostVisibility @default(MEMBERS_ONLY)
  isPinned       Boolean        @default(false)
  isFeatured     Boolean        @default(false)
  status         PostStatus     @default(DRAFT)
  commentCount   Int            @default(0)
  likeCount      Int            @default(0)
  viewCount      Int            @default(0)
  publishedAt    DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  planet         Planet         @relation(fields: [planetId], references: [id])
  column         PlanetColumn?  @relation(fields: [columnId], references: [id])
  author         User           @relation(fields: [authorUserId], references: [id])
  media          PostMedia[]
  comments       Comment[]
  likes          PostLike[]
  topicRelations PostTopicRelation[]

  @@index([planetId, type, status])
  @@index([authorUserId])
  @@index([publishedAt])
  @@map("posts")
}

model PostMedia {
  id            String    @id @default(cuid())
  postId        String
  mediaType     MediaType
  fileUrl       String
  coverUrl      String?
  width         Int?
  height        Int?
  duration      Int?
  sortOrder     Int       @default(0)
  createdAt     DateTime  @default(now())

  post          Post      @relation(fields: [postId], references: [id])

  @@index([postId])
  @@map("post_media")
}

model Topic {
  id            String   @id @default(cuid())
  planetId      String
  name          String
  color         String?
  status        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  planet        Planet   @relation(fields: [planetId], references: [id])
  postRelations PostTopicRelation[]

  @@unique([planetId, name])
  @@map("topics")
}

model PostTopicRelation {
  postId        String
  topicId       String
  createdAt     DateTime @default(now())

  post          Post     @relation(fields: [postId], references: [id])
  topic         Topic    @relation(fields: [topicId], references: [id])

  @@id([postId, topicId])
  @@map("post_topic_relations")
}

model Comment {
  id            String         @id @default(cuid())
  postId        String
  userId        String
  parentId      String?
  rootId        String?
  content       String
  status        CommentStatus  @default(PUBLISHED)
  likeCount     Int            @default(0)
  replyCount    Int            @default(0)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  post          Post           @relation(fields: [postId], references: [id])
  user          User           @relation(fields: [userId], references: [id])
  parent        Comment?       @relation("CommentReplies", fields: [parentId], references: [id])
  replies       Comment[]      @relation("CommentReplies")
  likes         CommentLike[]

  @@index([postId, createdAt])
  @@index([userId])
  @@index([rootId])
  @@map("comments")
}

model PostLike {
  id            String   @id @default(cuid())
  postId        String
  userId        String
  createdAt     DateTime @default(now())

  post          Post     @relation(fields: [postId], references: [id])
  user          User     @relation(fields: [userId], references: [id])

  @@unique([postId, userId])
  @@map("post_likes")
}

model CommentLike {
  id            String   @id @default(cuid())
  commentId     String
  userId        String
  createdAt     DateTime @default(now())

  comment       Comment  @relation(fields: [commentId], references: [id])
  user          User     @relation(fields: [userId], references: [id])

  @@unique([commentId, userId])
  @@map("comment_likes")
}

model Membership {
  id            String           @id @default(cuid())
  userId        String
  planetId      String
  planName      String
  priceAmount   Decimal          @db.Decimal(10, 2)
  billingType   BillingPeriod
  startAt       DateTime
  expireAt      DateTime
  status        MembershipStatus @default(ACTIVE)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  user          User             @relation(fields: [userId], references: [id])
  planet        Planet           @relation(fields: [planetId], references: [id])

  @@index([userId, status])
  @@index([planetId, status])
  @@map("memberships")
}

model Order {
  id            String         @id @default(cuid())
  orderNo       String         @unique
  userId        String
  planetId      String?
  bizType       OrderBizType
  bizId         String?
  amount        Decimal        @db.Decimal(10, 2)
  payAmount     Decimal        @db.Decimal(10, 2)
  status        OrderStatus    @default(PENDING)
  payStatus     PayStatus      @default(UNPAID)
  paymentChannel PaymentChannel?
  paidAt        DateTime?
  closedAt      DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id])
  planet        Planet?        @relation(fields: [planetId], references: [id])
  payments      PaymentRecord[]

  @@index([userId, createdAt])
  @@index([planetId])
  @@map("orders")
}

model PaymentRecord {
  id            String         @id @default(cuid())
  orderId       String
  channel       PaymentChannel
  transactionNo String?        @unique
  amount        Decimal        @db.Decimal(10, 2)
  status        PayStatus
  callbackPayload Json?
  paidAt        DateTime?
  createdAt     DateTime       @default(now())

  order         Order          @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@map("payment_records")
}

model AdminUser {
  id            String       @id @default(cuid())
  username      String       @unique
  passwordHash  String
  name          String
  mobile        String?      @unique
  status        AdminStatus  @default(ACTIVE)
  lastLoginAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  roles         AdminUserRole[]
  logs          OperationLog[]

  @@map("admin_users")
}

model Role {
  id            String         @id @default(cuid())
  name          String
  code          String         @unique
  description   String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  adminUsers    AdminUserRole[]

  @@map("roles")
}

model AdminUserRole {
  adminUserId   String
  roleId        String
  createdAt     DateTime @default(now())

  adminUser     AdminUser @relation(fields: [adminUserId], references: [id])
  role          Role      @relation(fields: [roleId], references: [id])

  @@id([adminUserId, roleId])
  @@map("admin_user_roles")
}

model OperationLog {
  id            String    @id @default(cuid())
  adminUserId   String
  module        String
  action        String
  targetType    String?
  targetId      String?
  requestId     String?
  payload       Json?
  ip            String?
  createdAt     DateTime  @default(now())

  adminUser     AdminUser @relation(fields: [adminUserId], references: [id])

  @@index([adminUserId, createdAt])
  @@map("operation_logs")
}
```

## 接口设计建议

为了同时适配小程序端和管理端，建议接口分为两套路由前缀：

- 小程序业务接口：`/api/v1`
- 后台管理接口：`/admin-api/v1`

示例：

- `POST /api/v1/auth/wechat-login`
- `GET /api/v1/planets`
- `GET /api/v1/planets/:id`
- `GET /api/v1/planets/:id/posts`
- `POST /api/v1/posts`
- `GET /api/v1/posts/:id`
- `POST /api/v1/posts/:id/like`
- `POST /api/v1/posts/:id/comments`
- `GET /api/v1/me/planets`
- `GET /admin-api/v1/planets`
- `GET /admin-api/v1/posts`
- `PATCH /admin-api/v1/posts/:id`
- `GET /admin-api/v1/orders`

## 当前最推荐的下一步

如果接下来要开始真正搭后端，我建议顺序是：

1. 先把这份 schema 收敛成第一版真正使用的表。
2. 初始化一个 NestJS + Prisma 项目。
3. 先实现微信登录、星球列表、内容列表、内容详情、评论、点赞。
4. 再补管理端的内容管理和星球管理。
5. 最后接订单、会员、签到和星球豆。

这样推进最稳，也最符合你现在“先跑起来，再逐步补细节”的节奏。
