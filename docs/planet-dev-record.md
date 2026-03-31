# 知识星球模块开发记录

## 记录目的

本文档用于记录当前仓库中“知识星球”小程序模块的开发状态、页面链路、设计思路和文件分布。
目标不是做完整产品说明，而是帮助后续继续迭代时快速接上上下文。

## 当前阶段定位

当前实现属于第一阶段快速复刻版本，重点是：

- 先把页面链路跑通
- 先把主要视觉层级搭出来
- 先把模仿知识星球的页面骨架做出来
- 先保留静态数据，暂不接真实接口

当前还没有进入这些阶段：

- 没有接后端接口
- 没有做真实登录态和权限
- 没有做完整交互闭环
- 没有做像素级精修
- 没有做数据持久化与服务端同步

## 当前页面链路

目前知识星球相关页面链路如下：

1. 首页入口页
2. 知识星球列表页
3. 星球内部首页
4. 打卡页
5. 专栏页
6. 帖子详情页
7. 发布页

实际跳转路径如下：

- 首页 `进入知识星球`
  - 进入 `pages/planet/detail`
  - 该页目前承担“知识星球列表页”的角色

- 列表页点击某个星球，例如 `Datawhale`
  - 进入 `pages/planet/home`
  - 该页承担“星球内部首页”的角色

- 星球内部页点击 `打卡`
  - 进入 `pages/planet/checkin`

- 星球内部页点击 `专栏`
  - 进入 `pages/planet/columns`

- 星球内部页点击帖子流卡片
  - 进入 `pages/planet/post`

- 星球内部页点击右下角发布按钮
  - 进入 `pages/planet/create`

## 为什么这样设计

这次不是按“业务语义最完美”的方式命名页面，而是按“先不打断当前项目已有结构、尽快复刻页面链路”的方式落地。

比如：

- `pages/planet/detail`
  - 现在其实已经不再是传统意义上的“帖子详情页”
  - 它现在承担“知识星球列表页”的职责
  - 这么做是因为前面用户明确要求：首页里的入口点进去先看到这个白色列表页

- `pages/planet/home`
  - 这是新增的“星球内部页”
  - 专门对应你后续发来的几张截图

- `pages/planet/post`
  - 才是现在真正承载“帖子详情页”的页面

后续如果你要做整理，可以把这些页面再重命名得更业务化，但当前阶段优先保证页面链路稳定和开发速度。

## 已完成页面说明

### 1. 首页入口页

文件：

- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.scss`

作用：

- 首页深色主界面
- 有“进入知识星球”按钮
- 当前点击后直接进入知识星球列表页

当前实现说明：

- 首页仍然保留项目主视觉
- 这里只承担知识星球模块入口，不承担知识星球内部内容

### 2. 知识星球列表页

文件：

- `miniprogram/pages/planet/detail.ts`
- `miniprogram/pages/planet/detail.wxml`
- `miniprogram/pages/planet/detail.scss`

作用：

- 模仿知识星球白色主界面
- 顶部标题、搜索框、星球列表、底部导航、创建卡片

当前实现说明：

- 使用静态星球列表数据
- 点击列表项后进入星球内部页
- 底部导航中的“星球”高亮
- “发现”当前跳回深色总览页
- “我的”跳转现有个人页

### 3. 星球内部首页

文件：

- `miniprogram/pages/planet/home.ts`
- `miniprogram/pages/planet/home.wxml`
- `miniprogram/pages/planet/home.scss`

作用：

- 模仿进入某个星球后的内部首页
- 对应你发的 `Datawhale` 那组截图

页面结构：

- 顶部渐变头图
- 星球头像、标题、创建者
- 五个入口：打卡、专栏、订阅、设置、邀请
- 四个 tab：最新、精华、文件、等我回答
- 右下角绿色发布按钮

当前实现说明：

- `最新` tab：展示普通帖子流
- `精华` tab：展示带文件附件的精选内容
- `文件` tab：展示文件类内容
- `等我回答` tab：展示空状态
- `打卡` 和 `专栏` 已接到真实子页面
- 帖子卡片已接到帖子详情页

### 4. 打卡页

文件：

- `miniprogram/pages/planet/checkin.ts`
- `miniprogram/pages/planet/checkin.wxml`
- `miniprogram/pages/planet/checkin.scss`

作用：

- 模仿“全部打卡挑战”页面

页面结构：

- 顶部标题
- 提示条：只有知识星球 App 才能打卡
- 打卡挑战列表卡片

当前实现说明：

- 卡片数据为静态模拟数据
- 当前只做展示，不进入下一级详情

### 5. 专栏页

文件：

- `miniprogram/pages/planet/columns.ts`
- `miniprogram/pages/planet/columns.wxml`
- `miniprogram/pages/planet/columns.scss`

作用：

- 模仿“专栏列表”页面

页面结构：

- 顶部专栏头卡
- 专栏目录列表
- 每一项右侧有折叠箭头

当前实现说明：

- 当前只做列表展示
- 尚未接入专栏展开、专栏详情、文章列表

### 6. 帖子详情页

文件：

- `miniprogram/pages/planet/post.ts`
- `miniprogram/pages/planet/post.wxml`
- `miniprogram/pages/planet/post.scss`

作用：

- 模仿知识星球帖子详情页

页面结构：

- 作者信息
- 发布时间
- 标题
- 两张内容图占位
- 分享好友按钮
- 生成长图按钮
- 底部评论输入区和点赞按钮

当前实现说明：

- 目前是静态结构
- 未接评论发送
- 未接真实图片

### 7. 发布页

文件：

- `miniprogram/pages/planet/create.ts`
- `miniprogram/pages/planet/create.wxml`
- `miniprogram/pages/planet/create.scss`

作用：

- 承担当前知识星球内容发布入口

当前实现说明：

- 是现有可复用页面
- 仍然保留之前的发布内容逻辑

## 页面命名与职责现状

当前页面职责和文件名存在“历史残留与快速复刻并存”的情况：

- `detail` 实际上是“星球列表页”
- `home` 实际上是“星球内部首页”
- `post` 才是“帖子详情页”

这是本阶段为了快速交付所做的折中。

后续如果准备长期维护，建议重构命名如下：

- `detail` -> `list`
- `home` -> `space`
- `post` 保持不变

但在当前阶段，不建议为了改名而打断开发节奏。

## 当前使用的数据方式

目前知识星球模块大部分页面使用静态模拟数据，来源分两类：

- 页面内直接定义的静态数组
- 少量使用 `utils/planet.ts` 中已有的本地存储逻辑

这样设计的原因：

- 当前重点是先把页面模仿出来
- 先验证结构、导航和视觉方向
- 等后端接口确定后再统一接真数据

## 这次设计的取舍

### 1. 先做页面骨架，不先做接口

原因：

- 当前参考物主要是截图
- 先把结构做出来更方便后续讨论和修改

### 2. 先做静态 tab，不先做复杂状态联动

原因：

- 截图重点在于页面结构和视觉
- 当前无需过早引入复杂数据模型

### 3. 优先复刻“感觉像”，而不是“完全一模一样”

原因：

- 当前阶段目标是第一版快速成型
- 先把主要结构、布局、色块、模块关系做出来
- 后续再精修间距、字号、图标和细节

### 4. 保留现有小程序工程规则

已遵守的项目约束包括：

- 仅使用原生小程序技术栈
- 使用 WXML / WXSS / JS 风格
- 路由使用绝对路径
- `tabBar` 页面走 `wx.switchTab`
- 普通页面走 `wx.navigateTo`
- 页面状态变更使用 `this.setData()`

## 当前仍待完善的地方

下面这些还没有做完：

- 星球内部页顶部背景还可以继续细抠
- 图标仍是简化版，不是高保真复刻
- 头像当前是色块占位，不是真实资源
- 帖子详情页图片是占位图，不是真实素材
- 列表页和内部页的字号、边距、留白还可以继续压细节
- 专栏页还没有展开/折叠逻辑
- 打卡页还没有详情页
- “订阅 / 设置 / 邀请”入口还没有真正实现
- 真实接口还没接

## 下一步建议

如果继续做，建议优先顺序如下：

1. 继续细抠 `planet/home`
   - 顶部头图
   - tab 外观
   - 帖子流间距
   - 图标样式

2. 细抠 `planet/detail`
   - 白色列表页更接近知识星球原图
   - 底部导航更接近原生效果

3. 细抠 `planet/checkin`、`planet/columns`、`planet/post`
   - 字体尺寸
   - 卡片高度
   - 图标细节
   - 空状态细节

4. 再决定是否开始接后端和真实数据结构

## 相关文件汇总

知识星球模块当前核心文件如下：

- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.scss`
- `miniprogram/pages/planet/detail.ts`
- `miniprogram/pages/planet/detail.wxml`
- `miniprogram/pages/planet/detail.scss`
- `miniprogram/pages/planet/home.ts`
- `miniprogram/pages/planet/home.wxml`
- `miniprogram/pages/planet/home.scss`
- `miniprogram/pages/planet/checkin.ts`
- `miniprogram/pages/planet/checkin.wxml`
- `miniprogram/pages/planet/checkin.scss`
- `miniprogram/pages/planet/columns.ts`
- `miniprogram/pages/planet/columns.wxml`
- `miniprogram/pages/planet/columns.scss`
- `miniprogram/pages/planet/post.ts`
- `miniprogram/pages/planet/post.wxml`
- `miniprogram/pages/planet/post.scss`
- `miniprogram/pages/planet/create.ts`
- `miniprogram/app.json`

## 结论

截至当前，这个知识星球模块已经具备：

- 首页入口
- 白色星球列表页
- 星球内部首页
- 打卡页
- 专栏页
- 帖子详情页
- 发布页入口

也就是说，“从首页进入知识星球，再进入星球内部继续浏览”的基本路径已经搭起来了。
后续工作重点就是继续细抠视觉和逐步接入真实数据。
