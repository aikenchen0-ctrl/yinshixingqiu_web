# 微信文章匿名导入设计

## 目标

将浏览器插件改为任何人都可使用的微信文章导入工具。用户在微信公众号图文编辑页点击提交后，文章直接进入小程序公共文章列表，不再依赖插件侧填写接口地址、`sessionToken` 或 `groupId`。

## 现状

- 插件弹窗中的“同步配置”已被删除。
- 插件后台原先仍依赖 `apiBaseUrl`，导致请求在 `fetch` 前被拦截。
- 现有后端 `POST /api/articles` 创建链路会继续要求 `groupId` 与用户身份，不适合匿名导入。

## 方案选型

### 方案一：继续复用 `POST /api/articles`

- 优点：接口不新增。
- 缺点：必须恢复 `groupId` 和身份信息，不符合匿名发布要求。

### 方案二：插件继续传隐藏固定值

- 优点：插件改动小。
- 缺点：只是把旧依赖藏起来，仍然和匿名要求冲突，也不利于后续维护。

### 方案三：新增匿名微信文章导入接口

- 优点：将匿名导入能力与现有成员发帖链路解耦，风险最小，语义清晰。
- 缺点：需要同时修改插件与后端。

推荐方案三。

## 设计

### 插件

- 移除对 `chrome.storage` 中 `apiBaseUrl` 的依赖。
- 插件后台固定调用远程后端 `https://xueyinx.cn`。
- 插件 API 客户端改为请求匿名导入接口，而不是旧的 `/api/articles`。
- 扩展清单补上远程域名权限，保证后台 service worker 能实际发起网络请求。

### 后端

- 新增匿名微信文章导入入口，例如 `POST /api/articles/import/wechat`。
- 该接口不要求 `groupId`、`sessionToken`、`userId`。
- 接口接收插件已整理好的文章 payload，并在服务端补齐匿名导入所需字段。
- 新建文章时固定标记：
  - `type = ARTICLE`
  - `contentSource = wechat`
  - `status = PUBLISHED`
  - `authorDisplayType = custom`
  - `authorDisplayName = 微信公众号`
- 微信原始作者名、原文链接、图片等仍保存在 `metadata` 中。

### 小程序展示

- 小程序文章列表继续使用公共文章列表能力，不要求 `groupId`。
- 微信文章作者展示统一使用匿名来源文案；真实公众号作者名从 `metadata.author` 读取即可作为补充信息，不作为权限身份。

## 验证

- 插件侧测试应覆盖：无需配置也会进入 `createArticle` 请求路径。
- 后端侧测试应覆盖：匿名导入写入的元数据包含 `contentSource = wechat` 和匿名作者展示。
- 插件构建通过。
- 后端测试脚本通过。
