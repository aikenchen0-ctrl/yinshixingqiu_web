# 知识星球模块开发记录

## 记录目的

本文档记录当前仓库中“知识星球”模块的页面分工、导航关系、实现方式和本轮开发中的设计取舍。
目标是方便后续继续迭代时，能快速理解现在为什么这样做、文件分别在哪里、下一步应该从哪里接着改。

## 当前阶段定位

当前实现仍然属于第一阶段快速复刻，核心目标是：

- 先把知识星球模块的主路径跑通
- 先把白色主题的视觉骨架搭出来
- 先把模块内三页导航关系稳定下来
- 先使用静态数据和本地存储模拟数据

当前还没有做的内容：

- 还没接真实后端接口
- 还没接真实微信登录、用户资料、会员状态
- 还没做像素级精修
- 还没统一抽成完整组件体系
- 还没做服务端数据同步

## 本轮重构后的页面分工

这轮调整的重点，是把知识星球模块内的“星球 / 发现 / 我的”三页重新分工，避免再和项目全局黑色 tabBar 混在一起。

当前知识星球模块内的三页职责如下：

### 1. 星球页

文件：

- `miniprogram/pages/planet/index.ts`
- `miniprogram/pages/planet/index.wxml`
- `miniprogram/pages/planet/index.scss`

职责：

- 对应知识星球底部导航中的“星球”
- 展示白色列表页
- 包含搜索框、星球列表、创建星球卡片、自定义底部栏

实现说明：

- 星球数据来自 `utils/planet.ts` 的 `loadPlanets()`
- 点击星球进入 `pages/planet/home`
- 底部“星球”高亮

### 2. 发现页

文件：

- `miniprogram/pages/planet/lobby.ts`
- `miniprogram/pages/planet/lobby.wxml`
- `miniprogram/pages/planet/lobby.scss`

职责：

- 对应知识星球底部导航中的“发现”
- 展示“你可能感兴趣”和“精华主题”两段内容
- 提供“换一批”能力

实现说明：

- 推荐星球和精华主题目前使用页面内静态池数据
- 推荐星球点击进入 `pages/planet/detail`
- 精华主题点击进入 `pages/articles/detail`
- 底部“发现”高亮

### 3. 我的页

文件：

- `miniprogram/pages/planet/mine.ts`
- `miniprogram/pages/planet/mine.wxml`
- `miniprogram/pages/planet/mine.scss`
- `miniprogram/pages/planet/mine.json`

职责：

- 对应知识星球底部导航中的“我的”
- 展示头像、昵称、星球豆余额、关于知识星球

实现说明：

- 这是新加的知识星球模块内独立页面
- 不再复用全局 `pages/profile/index`
- 这样可以避免带出项目原有黑色 tabBar

## 为什么要新增 `pages/planet/mine`

本轮开发中出现过一个核心问题：

- 从知识星球模块底部点“我的”时，会跳到全局 `pages/profile/index`
- 该页面是项目主业务 tabBar 页面
- 因为它属于全局 tabBar，所以底部会出现项目原来的黑色导航栏
- 这和知识星球原始白色主题不一致

因此这里做了一个明确的设计取舍：

- 全局 `pages/profile/index` 保留给项目主业务使用
- 知识星球模块单独新增 `pages/planet/mine`
- 让知识星球内部三页都保持白色底部导航风格

这个取舍的好处是：

- 模块视觉不会被全局 tabBar 污染
- 知识星球可以独立迭代
- 后续继续细抠只需要关注 `pages/planet` 目录

## 底部导航为什么从 `navigateTo` 改成 `redirectTo`

本轮还修了一个实际交互问题：

- 之前底部导航一直使用 `wx.navigateTo`
- 每点一次都会继续压一层页面栈
- 结果看起来像“第一次点没切对，第二次才切过去”

现在知识星球模块内三页切换统一改成了 `wx.redirectTo`：

- `planet/index` -> `planet/lobby`
- `planet/index` -> `planet/mine`
- `planet/lobby` -> `planet/index`
- `planet/lobby` -> `planet/mine`
- `planet/mine` -> `planet/index`
- `planet/mine` -> `planet/lobby`

这样做的原因是：

- 这三页在知识星球模块里更接近“内部页签”
- 它们之间切换应当替换当前页，而不是不断叠栈

保留下来的导航规则如下：

- 模块内三页互切：`wx.redirectTo`
- 进入业务详情页：`wx.navigateTo`
- 项目全局 tabBar 页：仍然使用 `wx.switchTab`

## 当前知识星球模块主链路

当前主路径如下：

1. 进入知识星球“星球”页：`/pages/planet/index`
2. 从底部切到“发现”页：`/pages/planet/lobby`
3. 从底部切到“我的”页：`/pages/planet/mine`
4. 从星球列表进入某个星球：首页：`/pages/planet/home`
5. 从发现页推荐星球进入加入页：`/pages/planet/detail`
6. 从发现页主题内容进入文章详情：`/pages/articles/detail`

知识星球内部页继续可以进入：

- `pages/planet/checkin`
- `pages/planet/columns`
- `pages/planet/post`
- `pages/planet/create`

## 这轮具体修改了哪些文件

### 1. 页面注册

- `miniprogram/app.json`

变更内容：

- 新增 `pages/planet/mine`

### 2. 星球页

- `miniprogram/pages/planet/index.ts`
- `miniprogram/pages/planet/index.wxml`
- `miniprogram/pages/planet/index.scss`

变更内容：

- 把旧的黑色总览页替换成白色星球列表页
- 统一为知识星球“星球”页职责
- 底部导航切换改成模块内跳转

### 3. 发现页

- `miniprogram/pages/planet/lobby.ts`
- `miniprogram/pages/planet/lobby.wxml`
- `miniprogram/pages/planet/lobby.scss`

变更内容：

- 改造成白色“发现”页
- 增加推荐星球和精华主题两段
- 增加“换一批”
- 修正底部导航切换行为

### 4. 我的页

- `miniprogram/pages/planet/mine.ts`
- `miniprogram/pages/planet/mine.wxml`
- `miniprogram/pages/planet/mine.scss`
- `miniprogram/pages/planet/mine.json`

变更内容：

- 新增知识星球模块内独立“我的”页
- 实现白色底部导航和知识星球风格个人页

## 数据设计说明

当前模块里数据主要分为两类：

### 1. 可复用的本地模拟数据

文件：

- `miniprogram/utils/planet.ts`

用途：

- 维护星球资料 `PlanetProfile`
- 维护帖子数据 `PlanetPost`
- 提供 `loadPlanets()`、`getPlanetById()` 等方法
- 作为星球页和部分详情页的数据来源

### 2. 页面级静态展示数据

例如：

- `pages/planet/lobby.ts` 内的推荐星球池
- `pages/planet/lobby.ts` 内的精华主题池
- `pages/planet/mine.ts` 内的个人页菜单项

这样分的原因是：

- 与模块真实业务强相关、后续可能复用的结构，放 `utils/planet.ts`
- 只是当前视觉展示用、后续可能会被接口替换的内容，先放页面内

## 这轮设计取舍

### 1. 优先把“页职责”理顺，再继续抠视觉

原因：

- 如果页面职责不清楚，后面样式越做越难维护
- 先把“星球 / 发现 / 我的”分干净，后续才方便继续精修

### 2. 不复用全局个人页

原因：

- 全局个人页属于主业务 tabBar
- 强行复用会持续带出黑色底栏
- 对知识星球模块是结构性干扰

### 3. 模块底部导航不使用 `switchTab`

原因：

- 这三页不是 `app.json` 里的全局 tabBar 页
- 不能使用 `wx.switchTab`
- 用 `redirectTo` 更符合当前模块化需求

### 4. 先保留简化图标与网络图

原因：

- 第一版目标是可运行、结构清晰
- 先把链路和层级做稳
- 后续再替换更接近知识星球的图标和资源

## 当前仍待优化的点

下面这些还可以继续做：

- 星球页顶部标题、搜索框高度还可以继续贴近原图
- 发现页卡片的字重、间距、封面比例还可以继续细抠
- 我的页头像环、留白和卡片阴影还可以继续精修
- 底部图标目前是 CSS 几何图，后续可以换更接近原版的资源或组件
- 推荐内容目前是静态模拟，后续可以改成接口返回
- `planet/detail` 的加入页还可以继续往原版交互靠

## 后续建议

如果下一步继续推进，建议按这个顺序：

1. 先继续精修 `planet/index`
   - 字号
   - 留白
   - 列表项高度
   - 创建卡片

2. 再精修 `planet/lobby`
   - 推荐卡片尺寸
   - 主题列表排版
   - 顶部标题与右侧“换一批”

3. 再精修 `planet/mine`
   - 头像环层级
   - 卡片阴影
   - 图标细节

4. 最后再统一抽知识星球底部导航为可复用组件

## 相关文件汇总

本轮知识星球模块关键文件如下：

- `miniprogram/app.json`
- `miniprogram/utils/planet.ts`
- `miniprogram/pages/planet/index.ts`
- `miniprogram/pages/planet/index.wxml`
- `miniprogram/pages/planet/index.scss`
- `miniprogram/pages/planet/lobby.ts`
- `miniprogram/pages/planet/lobby.wxml`
- `miniprogram/pages/planet/lobby.scss`
- `miniprogram/pages/planet/mine.ts`
- `miniprogram/pages/planet/mine.wxml`
- `miniprogram/pages/planet/mine.scss`
- `miniprogram/pages/planet/mine.json`
- `miniprogram/pages/planet/detail.ts`
- `miniprogram/pages/planet/home.ts`

## 小结

截至当前，知识星球模块已经形成了一个独立的白色主题小闭环：

- 星球页
- 发现页
- 我的页

并且底部导航已经不再串到项目全局黑色 tabBar 页面。
这意味着后续可以直接在 `pages/planet` 目录里继续精修，不需要再被项目主业务页面结构牵着走。
