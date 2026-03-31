interface ArticleItem {
  id: string
  category: string
  title: string
  summary: string
  author: string
  time: string
  price: string
  locked: boolean
}

interface CategoryItem {
  id: string
  label: string
}

Page({
  data: {
    categories: [
      { id: 'all', label: '全部' },
      { id: 'risk', label: '风控' },
      { id: 'case', label: '案例' },
      { id: 'defense', label: '防护' },
      { id: 'ai', label: 'AI安全' },
    ] as CategoryItem[],
    activeCategory: 'all',
    articles: [
      {
        id: 'a1',
        category: 'defense',
        title: '高净值资产防护的六层结构',
        summary: '以攻防视角梳理资产边界与关键漏洞。',
        author: '血饮',
        time: '今天',
        price: '¥49',
        locked: true,
      },
      {
        id: 'a2',
        category: 'case',
        title: '链上洗钱路径的识别与阻断',
        summary: '结合真实案例拆解资金流轨迹。',
        author: '血饮',
        time: '昨天',
        price: '¥79',
        locked: true,
      },
      {
        id: 'a3',
        category: 'risk',
        title: '多维风控指标体系设计',
        summary: '构建可执行的风险评分与响应策略。',
        author: '血饮',
        time: '03/08',
        price: '¥39',
        locked: false,
      },
      {
        id: 'a4',
        category: 'ai',
        title: 'AI风控模型的对抗评测',
        summary: '通过红队思维强化模型防线。',
        author: '血饮',
        time: '03/06',
        price: '¥59',
        locked: true,
      },
    ] as ArticleItem[],
    filteredArticles: [] as ArticleItem[],
  },
  onLoad() {
    // 初始化分类筛选
    this.updateFiltered()
  },
  onCategoryChange(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id })
    this.updateFiltered()
  },
  updateFiltered() {
    const { activeCategory, articles } = this.data
    const nextList = activeCategory === 'all'
      ? articles
      : articles.filter((item) => item.category === activeCategory)
    this.setData({
      filteredArticles: nextList,
    })
  },
  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/articles/detail?id=${id}`,
    })
  },
})
