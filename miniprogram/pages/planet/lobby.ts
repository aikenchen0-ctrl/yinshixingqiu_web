import { getStoredSession } from '../../utils/auth'
import { fetchDiscoverFeaturedPosts, fetchDiscoverPlanets } from '../../utils/planet-api'
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
  postId: string
  planetId: string
  title: string
  summary: string
  author: string
  meta: string
  cover: string
}

const INTEREST_BATCH_SIZE = 3

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

const mapRemoteFeaturedPost = (post: Record<string, any>): FeaturedTopicItem => {
  const group = post.group && typeof post.group === 'object' ? post.group : {}
  const title = String(post.title || '').trim()
  const summary = String(post.summary || post.contentText || '').trim()

  return {
    id: String(post.id || ''),
    postId: String(post.id || ''),
    planetId: String(post.groupId || group.id || ''),
    title: title || summary || '未命名精华主题',
    summary: summary || '这篇精华主题暂时还没有摘要',
    author:
      post.author && typeof post.author === 'object' && typeof post.author.nickname === 'string'
        ? post.author.nickname
        : '当前成员',
    meta: typeof group.name === 'string' && group.name ? group.name : '其他星球',
    cover: typeof post.coverUrl === 'string' ? post.coverUrl : '',
  }
}

Page({
  data: {
    loadingInterest: false,
    loadingFeatured: false,
    interestStatusText: '',
    featuredStatusText: '',
    interestSource: [] as InterestPlanetItem[],
    featuredSource: [] as FeaturedTopicItem[],
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

  async resolveFeaturedSource() {
    const session = await this.ensurePlanetSession()
    const response = await fetchDiscoverFeaturedPosts(12, session ? session.sessionToken : '')

    if (!response.ok || !Array.isArray(response.data)) {
      return [] as FeaturedTopicItem[]
    }

    return response.data
      .filter((item) => item && item.id && item.groupId)
      .map(mapRemoteFeaturedPost)
  },

  async refreshContent(nextInterestBatchIndex: number, nextFeaturedBatchIndex: number) {
    this.setData({
      loadingInterest: true,
      loadingFeatured: true,
      interestStatusText: '',
      featuredStatusText: '',
    })

    const [interestResult, featuredResult] = await Promise.allSettled([
      this.resolveInterestSource(),
      this.resolveFeaturedSource(),
    ])

    const interestSource =
      interestResult.status === 'fulfilled' ? interestResult.value : []
    const featuredSource =
      featuredResult.status === 'fulfilled' ? featuredResult.value : []

    const interestList = rotateBatch(interestSource, nextInterestBatchIndex, INTEREST_BATCH_SIZE)
    const featuredList = rotateBatch(featuredSource, nextFeaturedBatchIndex, 2)

    this.setData({
      loadingInterest: false,
      loadingFeatured: false,
      interestStatusText:
        interestResult.status === 'rejected'
          ? '真实星球数据拉取失败，请稍后重试'
          : interestSource.length
            ? ''
            : '还没有其他用户创建可推荐的真实星球',
      featuredStatusText:
        featuredResult.status === 'rejected'
          ? '真实精华主题拉取失败，请稍后重试'
          : featuredSource.length
            ? ''
            : '还没有可推荐的其他星球精华主题',
      interestSource,
      featuredSource,
      interestList,
      featuredList,
      interestBatchIndex: nextInterestBatchIndex,
      featuredBatchIndex: nextFeaturedBatchIndex,
    })
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
    if (!this.data.featuredSource.length) {
      void this.refreshContent(this.data.interestBatchIndex, 0)
      return
    }

    const nextFeaturedBatchIndex = this.data.featuredBatchIndex + 1
    const featuredList = rotateBatch(this.data.featuredSource, nextFeaturedBatchIndex, 2)

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
    const postId = String(e.currentTarget.dataset.postId || '')
    const planetId = String(e.currentTarget.dataset.planetId || '')

    if (!postId) {
      return
    }

    wx.navigateTo({
      url: `/pages/planet/post?id=${postId}&planetId=${planetId}`,
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
