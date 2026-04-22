# 需求文档

## 简介

本功能允许知识星球的建立者（星主）将帖子归类到不同的专栏下，并允许所有成员按专栏浏览帖子。

当前项目已有专栏（Column）的基础数据结构和列表页，但帖子与专栏的关联关系目前通过 `metadata.columnId` 间接存储，且发帖流程中没有专栏选择入口。本功能将完善这一闭环：

- 星主在发帖或编辑帖子时可以选择归属专栏
- 星主可以在专栏管理页对已有帖子进行批量或单独归类
- 成员可以在专栏详情页按专栏浏览帖子列表

## 术语表

- **星球（Group）**：知识星球的核心实体，对应数据库 `groups` 表
- **星主（Owner）**：星球的创建者，`groups.owner_user_id` 对应的用户
- **专栏（Column）**：星球内的内容分类单元，对应数据库 `columns` 表
- **帖子（Post）**：星球内的内容实体，对应数据库 `posts` 表，类型包括 `TOPIC`、`ARTICLE`、`NOTICE`、`CHECKIN`
- **成员（Member）**：已加入星球的用户，`group_members` 表中 `status = ACTIVE` 的记录
- **Column_Service**：后端专栏服务模块（`columnService.js`）
- **Content_Service**：后端内容服务模块（`contentService.js`）
- **Publish_Page**：小程序发帖页面（`/pages/planet/publish`）
- **Columns_Page**：小程序专栏列表页（`/pages/planet/columns`）
- **Column_Detail_Page**：小程序专栏详情页（通过 `columns.ts` 中展开交互实现）

---

## 需求

### 需求 1：发帖时选择归属专栏

**用户故事：** 作为星主，我希望在发帖时能够选择将帖子归入某个专栏，以便内容从创建之初就有清晰的分类。

#### 验收标准

1. WHEN 星主打开发帖页面，THE Publish_Page SHALL 展示一个"选择专栏"入口，列出当前星球下所有已创建的专栏供选择。
2. WHEN 星主选择某个专栏后提交帖子，THE Content_Service SHALL 将该帖子的 `metadata.columnId` 设置为所选专栏的 ID。
3. WHEN 星主不选择专栏直接发帖，THE Content_Service SHALL 将帖子的 `metadata.columnId` 保持为空，帖子归入"全部"。
4. IF 当前星球下没有任何专栏，THEN THE Publish_Page SHALL 隐藏"选择专栏"入口，不影响正常发帖流程。
5. IF 星主选择的专栏 ID 在数据库中不存在或不属于当前星球，THEN THE Content_Service SHALL 返回错误码 400 并提示"专栏不存在"。
6. WHERE 当前登录用户不是星主，THE Publish_Page SHALL 不展示"选择专栏"入口（普通成员发帖不支持归类）。

---

### 需求 2：编辑帖子时修改归属专栏

**用户故事：** 作为星主，我希望能够修改已发布帖子的归属专栏，以便对历史内容进行重新整理。

#### 验收标准

1. WHEN 星主进入帖子编辑页面，THE Publish_Page SHALL 展示当前帖子已归属的专栏（若有），并允许重新选择或清除。
2. WHEN 星主修改专栏归属并保存，THE Content_Service SHALL 更新该帖子的 `metadata.columnId` 为新选择的专栏 ID。
3. WHEN 星主清除专栏归属并保存，THE Content_Service SHALL 将该帖子的 `metadata.columnId` 设置为空字符串或从 metadata 中移除该字段。
4. IF 修改专栏归属时所选专栏 ID 不属于当前星球，THEN THE Content_Service SHALL 返回错误码 400 并提示"专栏不存在"。
5. WHERE 当前登录用户不是星主，THE Content_Service SHALL 拒绝修改帖子的专栏归属，返回错误码 403。

---

### 需求 3：专栏详情页展示帖子列表

**用户故事：** 作为星球成员，我希望能够在专栏详情页看到该专栏下所有帖子的完整列表，以便按分类浏览内容。

#### 验收标准

1. WHEN 成员展开某个专栏，THE Column_Service SHALL 返回该专栏下所有 `status = PUBLISHED` 的帖子列表，按 `publishedAt` 降序排列。
2. THE Column_Service SHALL 在帖子列表中为每条帖子返回以下字段：`id`、`title`（或内容摘要）、`author.nickname`、`author.avatarUrl`、`likeCount`、`commentCount`、`publishedAt`。
3. WHEN 专栏下没有任何帖子，THE Columns_Page SHALL 展示空状态提示"该专栏暂无内容"。
4. WHEN 成员点击专栏帖子列表中的某条帖子，THE Columns_Page SHALL 跳转到对应帖子详情页（`/pages/planet/post`）。
5. IF 当前用户不是星球成员，THEN THE Column_Service SHALL 返回错误码 403 并提示"请先加入星球"。

---

### 需求 4：专栏列表展示帖子数量

**用户故事：** 作为星球成员，我希望在专栏列表页能看到每个专栏下的帖子数量，以便快速判断哪个专栏内容更丰富。

#### 验收标准

1. THE Column_Service SHALL 在专栏列表接口中为每个专栏返回 `count` 字段，值为该专栏下 `status = PUBLISHED` 的帖子数量。
2. WHEN 某个专栏下没有帖子，THE Column_Service SHALL 返回该专栏的 `count` 为 0。
3. WHEN 帖子被删除（`status` 变为 `DELETED`）或隐藏（`status` 变为 `HIDDEN`），THE Column_Service SHALL 在下次查询专栏列表时不将该帖子计入对应专栏的 `count`。

---

### 需求 5：专栏管理——重命名与删除

**用户故事：** 作为星主，我希望能够重命名或删除已有专栏，以便持续维护内容分类结构。

#### 验收标准

1. WHEN 星主对某个专栏执行重命名操作，THE Column_Service SHALL 将该专栏的 `title` 更新为新名称，新名称长度须在 1 到 24 个字符之间。
2. IF 重命名后的专栏标题与同一星球下已有专栏标题重复，THEN THE Column_Service SHALL 返回错误码 409 并提示"专栏标题已存在"。
3. WHEN 星主删除某个专栏，THE Column_Service SHALL 从数据库中删除该专栏记录，并将原属于该专栏的所有帖子的 `metadata.columnId` 清空。
4. IF 删除专栏时该专栏下有帖子，THEN THE Column_Service SHALL 在同一事务中完成专栏删除和帖子 `metadata.columnId` 清空，保证数据一致性。
5. WHERE 当前登录用户不是星主，THE Column_Service SHALL 拒绝重命名和删除操作，返回错误码 403。

---

### 需求 6：专栏排序

**用户故事：** 作为星主，我希望能够调整专栏的显示顺序，以便将重要专栏排在前面。

#### 验收标准

1. WHEN 星主调整专栏顺序，THE Column_Service SHALL 接受一个包含所有专栏 ID 的有序数组，并按该顺序更新各专栏的 `sort_order` 字段。
2. THE Column_Service SHALL 在专栏列表接口中按 `sort_order` 升序返回专栏列表。
3. IF 排序请求中的专栏 ID 列表与当前星球的专栏数量不一致，THEN THE Column_Service SHALL 返回错误码 400 并提示"排序数据不完整"。
4. WHERE 当前登录用户不是星主，THE Column_Service SHALL 拒绝排序操作，返回错误码 403。
