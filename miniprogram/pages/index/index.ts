interface ArticlePreview {
  id: string
  title: string
  summary: string
  author: string
  time: string
  price: string
}

Page({
  data: {
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
