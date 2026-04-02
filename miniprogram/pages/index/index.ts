interface PlanetUpdate {
  id: string
  title: string
  time: string
}

interface ArticlePreview {
  id: string
  title: string
  summary: string
  author: string
  time: string
  price: string
}

interface PulseItem {
  id: string
  label: string
  value: string
}

Page({
  data: {
    // 首页展示数据
    planetUpdates: [
      { id: 'p1', title: '链上异常交易追踪框架更新', time: '1小时前' },
      { id: 'p2', title: '跨境支付风控策略复盘', time: '3小时前' },
      { id: 'p3', title: 'AI反欺诈模型评估清单', time: '昨天' },
    ] as PlanetUpdate[],
    articles: [
      {
        id: 'a1',
        title: '高净值资产防护的六层结构',
        summary: '以攻防视角梳理资产边界与关键漏洞。',
        author: '血饮',
        time: '今天',
        price: '¥49',
      },
      {
        id: 'a2',
        title: '链上洗钱路径的识别与阻断',
        summary: '结合真实案例拆解资金流轨迹。',
        author: '血饮',
        time: '昨天',
        price: '¥79',
      },
    ] as ArticlePreview[],
    pulseData: [
      { id: 's1', label: '风险警报', value: '中' },
      { id: 's2', label: '漏洞修复率', value: '92%' },
      { id: 's3', label: '资金安全指数', value: 'A+' },
    ] as PulseItem[],
  },
  onQuickAction(e: WechatMiniprogram.TouchEvent) {
    const action = e.currentTarget.dataset.action
    if (action === 'calendar') {
      wx.switchTab({ url: '/pages/calendar/index' })
      return
    }
    if (action === 'articles') {
      wx.switchTab({ url: '/pages/articles/index' })
      return
    }
    if (action === 'membership') {
      wx.navigateTo({ url: '/pages/membership/index' })
      return
    }
    if (action === 'store') {
      wx.switchTab({ url: '/pages/store/index' })
    }
  },
  goPlanet() {
    wx.navigateTo({
      url: '/pages/planet/index',
    })
  },
  goAI() {
    wx.navigateTo({
      url: '/pages/ai/index',
    })
  },
  goArticleDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/articles/detail?id=${id}`,
    })
  },
})
