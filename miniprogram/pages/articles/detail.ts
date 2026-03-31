interface ArticlePlanetCard {
  id: string
  name: string
  creator?: string
  avatar: string
  intro: string
  meta: string
}

interface ArticleDetail {
  id: string
  title: string
  author: string
  authorTag?: string
  authorAvatar: string
  time: string
  summary: string
  coverImage: string
  likeCount: number
  commentCount: number
  hiddenHint: string
  actionText: string
  recommendTitle: string
  planetCard: ArticlePlanetCard
}

const articleMap: Record<string, ArticleDetail> = {
  a1: {
    id: 'a1',
    title: '【2026年全球网络安全展望报告】',
    author: '丁利',
    authorTag: '星主',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/25 09:12',
    summary:
      '94%的受访者认为人工智能是未来一年最关键的变革驱动力，较之2025年显著提升。同时，组织对AI安全的评估能力正在提升，相关流程覆盖率由37...',
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    likeCount: 0,
    commentCount: 0,
    hiddenHint: '部分内容已隐藏',
    actionText: '查看更多内容',
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'planet_199it',
      name: '199IT数据交流群',
      creator: '丁利',
      avatar: 'https://images.unsplash.com/photo-1611095973763-414019e72400?auto=format&fit=crop&w=240&q=80',
      intro:
        '“数据驱动未来”是199IT的核心理念，作为投资、研究、产业、传播价值兼具的综合性平台，199IT已成为新经济生态圈投资者、经营者及数据...',
      meta: '丁利创建，已有18664名成员',
    },
  },
  a2: {
    id: 'a2',
    title: '《AI Agent 场景应用 - ai draw.io》第4-0节：ai + draw.io 产品设计',
    author: '小馒哥',
    authorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/24 21:18',
    summary:
      '从画图到需求梳理，拆解 AI Agent 在产品设计链路中的真实落地方式，本文节选了产品框架与几个关键设计片段。',
    coverImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
    likeCount: 3,
    commentCount: 1,
    hiddenHint: '部分内容已隐藏',
    actionText: '查看更多内容',
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'planet_2',
      name: '码农会馆',
      creator: '小馒哥',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
      intro: '专注 AI 编程、独立开发与工具链实践，持续更新落地案例和实战方法。',
      meta: '小馒哥创建，已有2680名成员',
    },
  },
  a3: {
    id: 'a3',
    title: '把私域内容做成可持续复利系统',
    author: '顾城',
    authorAvatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/22 11:20',
    summary:
      '如何设计一套能长期更新的主题栏目、社群分层和转化节奏。这里展示的是公开预览内容，完整版本在星球中继续展开。',
    coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
    likeCount: 6,
    commentCount: 2,
    hiddenHint: '部分内容已隐藏',
    actionText: '查看更多内容',
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'planet_growth',
      name: '增长笔记',
      creator: '顾城',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
      intro: '围绕增长、转化、私域设计和可持续内容系统，沉淀可复用的方法和模板。',
      meta: '顾城创建，已有6241名成员',
    },
  },
  a4: {
    id: 'a4',
    title: '一人公司如何搭建自己的知识产品矩阵',
    author: '启明',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80',
    time: '2026/03/20 18:08',
    summary:
      '从选题、交付到会员体系，拆最小可行的内容产品组合方式。文章提供了公开摘要和图示预览。',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    likeCount: 2,
    commentCount: 0,
    hiddenHint: '部分内容已隐藏',
    actionText: '查看更多内容',
    recommendTitle: '喜欢TA就加入TA的星球',
    planetCard: {
      id: 'planet_long',
      name: '长期主义实验室',
      creator: '启明',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80',
      intro: '聚焦长期主义、知识产品设计与个体品牌建设，适合想慢慢做成体系的人。',
      meta: '启明创建，已有3190名成员',
    },
  },
}

Page({
  data: {
    article: articleMap.a1 as ArticleDetail,
  },

  onLoad(options: Record<string, string>) {
    const id = options.id || 'a1'
    const article = articleMap[id] || articleMap.a1

    this.setData({
      article,
    })
  },

  onOpenMoreContent() {
    wx.showToast({
      title: '跳转星球详情查看',
      icon: 'none',
    })
  },

  onPlanetCardTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'planet_1'
    const name = e.currentTarget.dataset.name || 'CEO管理笔记'
    const creator = e.currentTarget.dataset.creator || ''

    wx.navigateTo({
      url: `/pages/planet/home?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}`,
    })
  },
})
