# 知识星球核心页后端开发说明

## 本轮目标

围绕 `miniprogram/pages/planet/home` 这个“已加入星球首页 / 核心页”，补齐最小可联调后端能力。

本轮重点覆盖：

- 星球首页详情
- 帖子列表（最新 / 精华 / 文件 / 等我回答）
- 置顶帖子
- 发帖
- 帖子详情
- 评论列表 / 发表评论
- 帖子点赞
- demo 数据灌入

---

## 本轮改动文件

### 后端

- `backend/src/services/contentService.js` 新增
- `backend/src/server.js` 增加内容相关路由
- `backend/src/db/seedDemoData.js` 增加帖子/评论 demo 数据
- `backend/prisma/schema.prisma` 为 `Post` 增加 `attachments` / `metadata` 字段

### 前端 API 封装

- `miniprogram/utils/planet-api.ts` 增加核心页相关 API

---

## 新增接口

### 1. 星球首页详情

`GET /api/planets/home?groupId=<groupId>&sessionToken=<token>`

也支持：

`GET /api/planets/home?groupId=<groupId>&userId=<userId>`

返回：

- group 基础信息
- owner 信息
- viewer 信息
- membership 信息
- role 权限信息
- policy 信息
- stats（latest / featured / files / answer）

---

### 2. 帖子列表

`GET /api/planets/posts?groupId=<groupId>&tab=latest&limit=20`

支持 tab：

- `latest`
- `featured`
- `files`
- `answer`

返回：

- `items`
- `nextCursor`
- `tab`

---

### 3. 置顶帖子

`GET /api/planets/pinned-posts?groupId=<groupId>`

---

### 4. 发帖

`POST /api/planets/posts`

请求体示例：

```json
{
  "groupId": "grp_datawhale_001",
  "userId": "usr_owner_001",
  "title": "今天的更新",
  "summary": "简短摘要",
  "contentText": "正文内容",
  "attachments": [],
  "metadata": {
    "coverImages": []
  }
}
```

---

### 5. 帖子详情

`GET /api/posts/detail?postId=<postId>`

默认会做一次阅读数 +1。

如果只想读取不计数：

`GET /api/posts/detail?postId=<postId>&incrementRead=0`

---

### 6. 评论列表

`GET /api/posts/comments?postId=<postId>`

---

### 7. 发表评论

`POST /api/posts/comments`

请求体示例：

```json
{
  "postId": "pst_welcome_001",
  "userId": "usr_buyer_001",
  "content": "这条内容很有帮助"
}
```

---

### 8. 点赞 / 取消点赞

`POST /api/posts/like`

请求体示例：

```json
{
  "postId": "pst_welcome_001",
  "increment": true
}
```

如果要撤销，可以传：

```json
{
  "postId": "pst_welcome_001",
  "increment": false
}
```

---

## demo 数据

服务启动时会尝试自动执行 `ensureDemoData()`。

当前会灌入：

- 一个星球：`grp_datawhale_001`
- 星主用户：`usr_owner_001`
- 普通用户：`usr_buyer_001`
- 1 条置顶欢迎帖：`pst_welcome_001`
- 1 条精华帖：`pst_featured_001`
- 1 条文件帖：`pst_file_001`
- 1 条待回答帖：`pst_answer_001`
- 2 条演示评论

---

## 重要说明：需要 Prisma 迁移

因为这轮对 `Post` 模型新增了：

- `attachments Json?`
- `metadata Json?`

所以数据库需要同步 schema。

如果当前数据库还没更新，这些接口在运行时可能报字段不存在。

建议执行：

```bash
npx prisma migrate dev --schema backend/prisma/schema.prisma --name add_post_attachments_metadata
```

如果你当前只是本地临时开发，也可以考虑：

```bash
npx prisma db push --schema backend/prisma/schema.prisma
```

然后再：

```bash
npx prisma generate --schema backend/prisma/schema.prisma
```

---

## 当前完成度

### 已完成

- 核心页首页详情接口
- 最新/精华/文件/等我回答列表接口
- 置顶帖子接口
- 发帖接口
- 帖子详情接口
- 评论列表接口
- 评论发布接口
- 点赞接口
- demo seed 数据

### 仍然是最小实现 / 后续可增强

- 点赞是“直接增减计数”，还没有真正的用户点赞关系表
- 文件能力当前基于 `attachments` JSON，尚未接真实上传/对象存储
- 等我回答当前基于 `metadata.answerStatus = PENDING` 简化实现
- 没有做内容审核、删除、编辑、置顶管理后台
- 前端核心页本身还没彻底改成全部走新接口，目前只是 API 封装已补

---

## 下一步建议

### 第一优先级

把 `miniprogram/pages/planet/home.ts` 改成读取：

- `fetchPlanetHome`
- `fetchPlanetPosts`
- `fetchPinnedPosts`

并让发布页改成调用：

- `createPlanetPost`

### 第二优先级

补帖详情页联调：

- `fetchPlanetPostDetail`
- `fetchPlanetComments`
- `createPlanetComment`
- `togglePlanetPostLike`

### 第三优先级

继续做：

- 打卡
- 订阅
- 邀请
- 设置页真实接口
- 更完整的文件上传

---

## 一句话总结

本轮已经把“核心页后端”从 mock 依赖推进到了 **可跑、可查、可发、可评、可点赞、可联调** 的状态。
