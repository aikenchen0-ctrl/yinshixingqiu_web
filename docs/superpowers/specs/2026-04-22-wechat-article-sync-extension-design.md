# 微信公众号文章同步到小程序的 Chrome 插件设计

## 背景

当前项目里已经存在文章体系，并且前端文章详情页已识别 `contentSource = wechat` 这一类内容来源，但项目内还没有一个浏览器插件，能把微信公众号后台编辑页里的图文文章直接同步成小程序内的新文章记录。

项目内的 [browser-extension](/home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension) 目录当前为空，因此本次需要先定义一套可落地的 Chrome 插件文件架构与同步链路。

目标激活页为微信公众号图文编辑页，例如：

- `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit...`

本期只处理“新建一篇小程序里的微信文章”，不处理更新已存在文章。

## 目标

开发一个运行在 Chrome 浏览器里的插件，实现以下能力：

- 仅在微信公众号图文编辑页可用
- 用户点击插件后，看到一个主按钮：`提交到小程序的文章`
- 插件抓取当前微信文章页面可获取的标题、封面、摘要、作者、原文链接、正文图片、基础正文结构
- 插件将抓取结果映射为项目现有文章体系可接受的数据结构
- 插件通过项目后端接口新建一篇 `contentSource = wechat` 的小程序文章
- 对无法稳定抓取的字段允许降级为空，但不阻塞基本提交

## 非目标

- 不做“更新已存在文章”
- 不做批量同步多篇公众号文章
- 不做微信复杂组件的完整还原，例如投票、小程序卡片、评论区、打赏模块
- 不做微信公众号排版的像素级复刻
- 不做本地桥接程序
- 不做插件之外的独立桌面程序

## 方案选择

采用三层插件结构：

1. `content script`
   负责在微信编辑页读取 DOM、提取文章结构和元数据。
2. `popup`
   负责展示“提交到小程序的文章”按钮、同步状态和结果。
3. `background service worker`
   负责消息路由、同步流程编排、向项目后端发起创建文章请求。

不采用“纯 content script 直传”的原因：

- 登录态和 API 调用逻辑会和页面抓取耦合在一起
- 扩展重试、错误处理、后续预览功能不易维护
- 不利于后续加“映射预览”“同步历史”“重试”等能力

## 文件架构

建议在项目内 [browser-extension](/home/youshaocong/.mnt_hgfs_all/xueyinMiniapp/browser-extension) 下采用如下结构：

```text
browser-extension/
  manifest.json
  package.json
  tsconfig.json
  README.md

  public/
    icons/
      icon16.png
      icon48.png
      icon128.png

  src/
    background/
      index.ts
      message-router.ts
      sync-service.ts

    content/
      index.ts
      page-detector.ts
      wechat-article-extractor.ts
      wechat-article-normalizer.ts

    popup/
      index.html
      main.tsx
      App.tsx
      components/
        SyncButton.tsx
        SyncResultPanel.tsx
        ArticleMetaPreview.tsx

    shared/
      api-client.ts
      article-mapper.ts
      constants.ts
      storage.ts
      types.ts

    styles/
      popup.css
```

## 模块职责

### `manifest.json`

负责声明：

- Manifest V3
- `action.popup`
- `background.service_worker`
- `content_scripts`
- `permissions`
- `host_permissions`

核心权限：

- `storage`
- `tabs`
- `activeTab`
- `scripting`

核心域名权限：

- `https://mp.weixin.qq.com/*`
- 项目后端域名

### `src/content/`

#### `index.ts`

- 在目标微信图文编辑页注入
- 监听来自 background 的抓取请求
- 返回结构化文章数据

#### `page-detector.ts`

- 判断当前页面是否为微信公众号图文编辑页
- 判断页面是否具备可抓取的文章结构

#### `wechat-article-extractor.ts`

- 提取标题
- 提取封面图
- 提取摘要
- 提取作者
- 提取原文链接
- 提取正文 DOM
- 提取图片 URL

#### `wechat-article-normalizer.ts`

- 把微信页面 DOM 转成中间结构
- 过滤广告块、脚本、无关控件、编辑器辅助标记
- 只保留基础语义样式

### `src/popup/`

#### `App.tsx`

- 展示主按钮：`提交到小程序的文章`
- 展示当前识别到的文章标题和基础状态
- 展示成功/失败提示

#### `SyncButton.tsx`

- 封装主触发按钮
- 处理加载态、禁用态、成功态

#### `SyncResultPanel.tsx`

- 展示接口返回的结果
- 包含新建文章 ID、标题、同步时间、失败原因

#### `ArticleMetaPreview.tsx`

- 展示将要同步的部分核心字段预览
- 仅展示高价值字段，不展示完整正文

### `src/background/`

#### `index.ts`

- 插件后台入口
- 注册消息监听

#### `message-router.ts`

- 统一处理 popup 与 content script 的消息分发

#### `sync-service.ts`

- 驱动同步主流程
- 向当前 tab 请求抓取结果
- 调用后端新建微信文章接口
- 返回同步结果给 popup

### `src/shared/`

#### `types.ts`

- 定义微信文章抓取结果
- 定义正文块结构
- 定义后端创建文章 payload
- 定义同步结果模型

#### `article-mapper.ts`

- 把抓取结果映射成项目后端需要的文章创建结构
- 固定写入 `contentSource = wechat`

#### `api-client.ts`

- 统一处理后端请求
- 统一鉴权、超时、错误包装

#### `storage.ts`

- 缓存最近一次同步结果
- 缓存插件本地配置，例如接口地址或 token

#### `constants.ts`

- 统一维护匹配 URL、消息类型、超时时间、默认文案

## 数据流

同步链路如下：

1. 用户打开微信公众号图文编辑页
2. 用户点击 Chrome 插件图标
3. popup 检测当前 tab 是否在允许激活的微信编辑页
4. 用户点击 `提交到小程序的文章`
5. popup 向 background 发送同步请求
6. background 通知 content script 抓取当前页面
7. content script 返回结构化文章结果
8. background 对抓取结果做字段清洗和映射
9. background 调用项目后端新建文章接口
10. popup 展示成功或失败结果

## 字段同步策略

采用“能同步多少就同步多少”的高覆盖策略。

### 高优先级字段

这些字段应尽量同步成功：

- 标题
- 摘要
- 封面图
- 正文段落
- 正文图片
- 原文链接
- 内容来源：`wechat`

### 中优先级字段

能抓到就同步，抓不到允许为空：

- 作者
- 公众号名称
- 当前页面 URL
- 微信文章 ID 或 appmsgid
- 发布时间

### 低优先级字段

本期不要求实现完整支持：

- 视频
- 投票
- 小程序卡片
- 外链卡片
- 评论区
- 打赏区
- 阅读原文复杂跳转配置

## 样式同步策略

本期目标是“基础样式同步”，不是“微信公众号完全还原”。

保留的正文能力：

- 标题
- 段落
- 加粗
- 引用
- 图片
- 分割线

不直接全量保留微信原始 HTML 的原因：

- 微信页面 DOM 带有大量私有 class 和编辑器结构
- 直接写入项目文章系统会让前端展示不稳定
- 页面结构变化后很难维护

因此采用两段式转换：

1. 微信编辑页 DOM -> 中间结构
2. 中间结构 -> 项目文章 payload / `richContent`

## 后端对接假设

本设计默认插件最终调用的是项目现有后端文章创建接口，或者一个为 `wechat` 内容来源补充的新建接口。

接口层要求：

- 能新建文章
- 能显式标记 `contentSource = wechat`
- 能接收标题、摘要、正文、图片、封面、原文链接等字段

若当前后端没有对应入口，需要在实现阶段补一个明确的“新建微信文章”接口，但插件分层架构不需要改变。

## 错误处理

主要错误场景：

- 当前页面不是微信公众号图文编辑页
- 微信编辑页 DOM 结构变化，导致关键字段抓取失败
- 用户未登录插件所需的后端身份
- 后端新建文章接口失败

对应策略：

- popup 直接提示“当前页面不支持同步”
- 缺失关键字段时允许降级，但若标题和正文都不可用则禁止提交
- 后端报错时展示明确失败信息
- 同步失败后保留最近一次抓取结果，便于用户重试

## 验证策略

实现完成后至少验证：

- 在微信图文编辑页中插件可以正常激活
- popup 中存在按钮 `提交到小程序的文章`
- 能抓取标题、摘要、正文、图片等常见字段
- 成功创建一篇 `contentSource = wechat` 的小程序文章
- 页面结构缺字段时不会直接崩溃
- 同步失败时 popup 能给出错误信息

## 风险与约束

- 微信公众号后台页面 DOM 不是稳定公开 API，后续可能变动
- 图片资源可能带微信鉴权或防盗链限制
- 样式同步只保证基础可用，不保证与公众号排版完全一致
- 如果后端接口当前没有明确支持 `wechat` 来源新建文章，需要在实现阶段同时补后端入口
