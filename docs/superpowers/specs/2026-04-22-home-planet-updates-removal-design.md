# 小程序首页饮视星球动态整块删除设计

## 目标

删除小程序主首页 `miniprogram/pages/index/index.wxml` 中“饮视星球动态”整块区域：

- 删除标题“饮视星球动态”
- 删除副标题“血饮智库社区最新洞察”
- 删除动态列表
- 删除“查看星球”按钮

## 范围

只处理小程序主首页：

- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/index/index.scss`

## 方案

采用整块删除：

1. 从 `index.wxml` 删除整个“饮视星球动态” section
2. 从 `index.ts` 删除仅供该 section 使用的 `PlanetUpdate` 类型与 `planetUpdates` 假数据
3. 保留 `goPlanet` 方法，因为首页 hero 区按钮仍然需要它
4. 删除未使用的 `.planet-*` 样式

## 非目标

- 不改首页 hero 区
- 不改“精选付费文章”
- 不改“安全脉冲”
- 不改饮视星球页面本身
