# 小程序首页核心入口整块删除设计

## 目标

删除小程序主首页 `miniprogram/pages/index/index.wxml` 中“核心入口”整块区域：

- 删除标题“核心入口”
- 删除副标题“一键进入关键功能与资产安全服务”
- 删除 4 个入口卡片：
  - 课程中心
  - 付费文章
  - 会员制
  - 商城

## 范围

只处理小程序主首页：

- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/index/index.scss`

## 方案

采用整块删除：

1. 从 `index.wxml` 删除整个入口 section
2. 从 `index.ts` 删除对应的 `onQuickAction`
3. 从 `index.scss` 删除未使用的 `.quick-*` 样式
4. 保持后续模块整体上移，不添加占位

## 非目标

- 不改首页 hero 区
- 不改“饮视星球动态”
- 不改文章列表和安全脉冲
- 不改任何路由页面本身
