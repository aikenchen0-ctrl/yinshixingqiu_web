import { getStoredSession } from '../../utils/auth'
import { fetchDiscoverPlanets } from '../../utils/planet-api'
import { PlanetRemoteProfile, upsertRemotePlanets } from '../../utils/planet'
import { ensureWechatSession } from '../../utils/wechat-login'

interface InterestPlanetItem {
  id: string
  name: string
  meta: string
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

const INTEREST_BATCH_SIZE = 3

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

const normalizeSummary = (summary: string, planetName: string) =>
  summary || `欢迎加入「${planetName}」，这里会持续分享精选内容、答疑和社群互动。`

const mapPlanetToInterestItem = (planet: PlanetRemoteProfile): InterestPlanetItem => ({
  id: planet.id,
  name: planet.name,
  meta: `主理人 ${planet.ownerName}`,
  summary: normalizeSummary(planet.intro || '', planet.name),
  image: planet.avatarImageUrl || planet.coverImageUrl,
  creator: planet.ownerName,
})

Page({
  data: {
    loadingInterest: false,
    interestStatusText: '',
    interestSource: [] as InterestPlanetItem[],
    interestList: [] as InterestPlanetItem[],
    featuredList: [] as FeaturedTopicItem[],
    interestBatchIndex: 0,
    featuredBatchIndex: 0,
  },

  onLoad() {
    void this.refreshContent(0, 0)
  },

  onShow() {
    void this.refreshContent(this.data.interestBatchIndex, this.data.featuredBatchIndex)
  },

  async ensurePlanetSession() {
    const session = getStoredSession()
    if (session && session.sessionToken) {
      return session
    }

    try {
      return await ensureWechatSession()
    } catch {
      return null
    }
  },

  async resolveInterestSource() {
    const session = await this.ensurePlanetSession()
    const response = await fetchDiscoverPlanets(session ? session.sessionToken : '', 12)

    if (!response.ok || !Array.isArray(response.data)) {
      return [] as InterestPlanetItem[]
    }

    const remotePlanets = response.data
      .filter((planet) => planet && planet.id && !planet.joined)
      .map((planet) => ({
        ...planet,
        joined: false,
      }))

    upsertRemotePlanets(remotePlanets, {
      defaultJoined: false,
    })

    return remotePlanets.map(mapPlanetToInterestItem)
  },

  async refreshContent(nextInterestBatchIndex: number, nextFeaturedBatchIndex: number) {
    this.setData({
      loadingInterest: true,
      interestStatusText: '',
    })

    try {
      const interestSource = await this.resolveInterestSource()
      const interestList = rotateBatch(interestSource, nextInterestBatchIndex, INTEREST_BATCH_SIZE)
      const featuredList = rotateBatch(featuredTopicPool, nextFeaturedBatchIndex, 2)

      this.setData({
        loadingInterest: false,
        interestStatusText: interestSource.length ? '' : '还没有其他用户创建可推荐的真实星球',
        interestSource,
        interestList,
        featuredList,
        interestBatchIndex: nextInterestBatchIndex,
        featuredBatchIndex: nextFeaturedBatchIndex,
      })
    } catch {
      const featuredList = rotateBatch(featuredTopicPool, nextFeaturedBatchIndex, 2)

      this.setData({
        loadingInterest: false,
        interestStatusText: '真实星球数据拉取失败，请稍后重试',
        interestSource: [],
        interestList: [],
        featuredList,
        interestBatchIndex: nextInterestBatchIndex,
        featuredBatchIndex: nextFeaturedBatchIndex,
      })
    }
  },

  onRefreshInterest() {
    if (!this.data.interestSource.length) {
      void this.refreshContent(0, this.data.featuredBatchIndex)
      return
    }

    const nextInterestBatchIndex = this.data.interestBatchIndex + 1
    const interestList = rotateBatch(
      this.data.interestSource,
      nextInterestBatchIndex,
      INTEREST_BATCH_SIZE
    )

    this.setData({
      interestList,
      interestBatchIndex: nextInterestBatchIndex,
    })
  },

  onRefreshFeatured() {
    const nextFeaturedBatchIndex = this.data.featuredBatchIndex + 1
    const featuredList = rotateBatch(featuredTopicPool, nextFeaturedBatchIndex, 2)

    this.setData({
      featuredList,
      featuredBatchIndex: nextFeaturedBatchIndex,
    })
  },

  onPlanetTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'planet_1'
    const name = e.currentTarget.dataset.name || 'Datawhale'
    const creator = e.currentTarget.dataset.creator || 'Datawhale 团队'

    wx.navigateTo({
      url: `/pages/planet/home?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}&source=discover`,
    })
  },

  onTopicTap(e: WechatMiniprogram.TouchEvent) {
    const articleId = e.currentTarget.dataset.articleId || 'a1'
    wx.navigateTo({
      url: `/pages/articles/detail?id=${articleId}`,
    })
  },

  onPlanetTabChange(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const key = String((e.detail && e.detail.key) || '')

    if (!key || key === 'discover') {
      return
    }

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
      return
    }

    if (key === 'debug') {
      wx.redirectTo({
        url: '/pages/planet/debug',
      })
    }
  },
})
