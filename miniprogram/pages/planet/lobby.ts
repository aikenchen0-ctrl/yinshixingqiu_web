import { PlanetProfile, loadPlanets } from '../../utils/planet'

interface InterestPlanetItem {
  id: string
  name: string
  members: string
  summary: string
  image: string
  creator: string
}

interface FeaturedTopicItem {
  id: string
  articleId: string
  title: string
  summary: string
  author: string
  meta: string
  cover: string
}

const interestPool: InterestPlanetItem[] = [
  {
    id: 'planet_2',
    name: 'CEO管理笔记',
    members: '成员1800+',
    summary: '这里聊你书上看不到、学校不会教、父母也没讲透的管理经验。',
    image: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=240&q=80',
    creator: '主理人 老王',
  },
  {
    id: 'planet_3',
    name: 'AI资料圈-付费版',
    members: '成员300+',
    summary: '聚合 AI 工具、提示词、案例拆解与产品灵感，持续更新实战资料。',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=240&q=80',
    creator: '主理人 阿沐',
  },
  {
    id: 'planet_4',
    name: '赛博回忆录',
    members: '成员1800+',
    summary: '本星球汇聚了安全行业各领域精英，分享有效方法与真实案例。',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=240&q=80',
    creator: '主理人 夏木',
  },
  {
    id: 'planet_1',
    name: '产品增长实验室',
    members: '成员2200+',
    summary: '围绕增长策略、转化路径和内容运营，输出可直接复用的方法模板。',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=240&q=80',
    creator: '主理人 林舟',
  },
  {
    id: 'planet_2',
    name: '独立开发情报局',
    members: '成员950+',
    summary: '关注 AI 出海、MVP 验证和变现路径，适合想快速落地副业的人。',
    image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=240&q=80',
    creator: '主理人 Echo',
  },
  {
    id: 'planet_3',
    name: '职业跃迁手册',
    members: '成员1600+',
    summary: '拆职业升级、岗位转型和简历作品集，偏长期成长与实战复盘。',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=240&q=80',
    creator: '主理人 Amber',
  },
]

const featuredTopicPool: FeaturedTopicItem[] = [
  {
    id: 'topic_1',
    articleId: 'a1',
    title: '【2026年全球网络安全展望报告】',
    summary: '94%的受访者认为人工智能是未来一年最关键的变革驱动力，较之2025年进一步提升。',
    author: '丁利',
    meta: '199T数据交流群',
    cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'topic_2',
    articleId: 'a2',
    title: '《AI Agent 场景应用 - ai draw.io》第4-0节：ai + draw.io 产品设计',
    summary: '从画图到需求梳理，拆解 AI Agent 在产品设计链路中的真实落地方式。',
    author: '小馒哥',
    meta: '码农会馆',
    cover: '',
  },
  {
    id: 'topic_3',
    articleId: 'a3',
    title: '把私域内容做成可持续复利系统',
    summary: '如何设计一套能长期更新的主题栏目、社群分层和转化节奏。',
    author: '顾城',
    meta: '增长笔记',
    cover: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'topic_4',
    articleId: 'a4',
    title: '一人公司如何搭建自己的知识产品矩阵',
    summary: '从选题、交付到会员体系，拆最小可行的内容产品组合方式。',
    author: '启明',
    meta: '长期主义实验室',
    cover: '',
  },
]

const rotateBatch = <T>(list: T[], batchIndex: number, batchSize: number) => {
  if (list.length <= batchSize) {
    return list
  }

  const start = (batchIndex * batchSize) % list.length
  const result: T[] = []

  for (let offset = 0; offset < batchSize; offset += 1) {
    result.push(list[(start + offset) % list.length])
  }

  return result
}

const matchPlanetCreator = (planetId: string, planets: PlanetProfile[], fallback: string) => {
  const matched = planets.find((planet) => planet.id === planetId)
  return matched ? matched.ownerName : fallback
}

Page({
  data: {
    interestList: [] as InterestPlanetItem[],
    featuredList: [] as FeaturedTopicItem[],
    interestBatchIndex: 0,
    featuredBatchIndex: 0,
  },

  onLoad() {
    this.refreshContent(0, 0)
  },

  refreshContent(nextInterestBatchIndex: number, nextFeaturedBatchIndex: number) {
    const planets = loadPlanets()
    const interestList = rotateBatch(interestPool, nextInterestBatchIndex, 3).map((item) => ({
      ...item,
      creator: matchPlanetCreator(item.id, planets, item.creator),
    }))
    const featuredList = rotateBatch(featuredTopicPool, nextFeaturedBatchIndex, 2)

    this.setData({
      interestList,
      featuredList,
      interestBatchIndex: nextInterestBatchIndex,
      featuredBatchIndex: nextFeaturedBatchIndex,
    })
  },

  onRefreshInterest() {
    this.refreshContent(this.data.interestBatchIndex + 1, this.data.featuredBatchIndex)
  },

  onRefreshFeatured() {
    this.refreshContent(this.data.interestBatchIndex, this.data.featuredBatchIndex + 1)
  },

  onPlanetTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'planet_1'
    const name = e.currentTarget.dataset.name || 'Datawhale'
    const creator = e.currentTarget.dataset.creator || 'Datawhale 团队'

    wx.navigateTo({
      url: `/pages/planet/detail?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}`,
    })
  },

  onTopicTap(e: WechatMiniprogram.TouchEvent) {
    const articleId = e.currentTarget.dataset.articleId || 'a1'
    wx.navigateTo({
      url: `/pages/articles/detail?id=${articleId}`,
    })
  },

  onBottomNavTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key

    if (key === 'planet') {
      wx.redirectTo({
        url: '/pages/planet/index',
      })
      return
    }

    if (key === 'mine') {
      wx.redirectTo({
        url: '/pages/planet/mine',
      })
    }
  },
})
