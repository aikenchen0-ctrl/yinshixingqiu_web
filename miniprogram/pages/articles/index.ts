import { loadArticleCatalog } from '../../utils/article-data'
import { decorateStaticArticleCard, mapRemoteArticleToCard, sortArticleCards, type ArticleCardItem } from '../../utils/article-view'
import { clearSession, getStoredSession, shouldClearSessionByError } from '../../utils/auth'
import { fetchArticles } from '../../utils/planet-api'

type ContentSource = 'wechat' | 'planet'

const buildWechatArticles = () =>
  sortArticleCards(loadArticleCatalog().filter((item) => item.contentSource === 'wechat').map((item) => decorateStaticArticleCard(item)))

Page({
  data: {
    activeContentSource: 'wechat' as ContentSource,
    wechatArticles: [] as ArticleCardItem[],
    planetArticles: [] as ArticleCardItem[],
    displayArticles: [] as ArticleCardItem[],
    loadingPlanetArticles: false,
    planetError: '',
  },

  onLoad() {
    this.refreshContent()
  },

  onShow() {
    this.refreshContent()
  },

  refreshContent() {
    const wechatArticles = buildWechatArticles()

    this.setData({
      wechatArticles,
      displayArticles: this.data.activeContentSource === 'wechat' ? wechatArticles : this.data.planetArticles,
    })

    void this.loadPlanetArticles()
  },

  async loadPlanetArticles() {
    this.setData({
      loadingPlanetArticles: true,
      planetError: '',
    })

    const storedSession = getStoredSession()
    const sessionToken = storedSession && storedSession.sessionToken ? storedSession.sessionToken : ''

    const requestWithFallback = async () => {
      try {
        return await fetchArticles({
          contentSource: 'planet',
          status: 'PUBLISHED',
          page: 1,
          pageSize: 50,
          sessionToken: sessionToken || undefined,
        })
      } catch (error) {
        if (sessionToken) {
          if (shouldClearSessionByError(error)) {
            clearSession()
          }

          return fetchArticles({
            contentSource: 'planet',
            status: 'PUBLISHED',
            page: 1,
            pageSize: 50,
          })
        }

        throw error
      }
    }

    try {
      const response = await requestWithFallback()
      const responseData = response && response.data ? response.data : null
      const responseItems = responseData && Array.isArray(responseData.items) ? responseData.items : []
      const planetArticles = responseItems.length
        ? responseItems.map((item) => mapRemoteArticleToCard(item))
        : []

      this.setData({
        planetArticles,
        displayArticles: this.data.activeContentSource === 'planet' ? planetArticles : this.data.wechatArticles,
        loadingPlanetArticles: false,
        planetError: '',
      })
    } catch (error) {
      const planetError = error instanceof Error ? error.message : '加载星球文章失败'

      this.setData({
        planetArticles: [],
        displayArticles: this.data.activeContentSource === 'planet' ? [] : this.data.wechatArticles,
        loadingPlanetArticles: false,
        planetError,
      })
    }
  },

  onContentSourceChange(e: WechatMiniprogram.TouchEvent) {
    const source = String(e.currentTarget.dataset.source || '') as ContentSource
    if (source !== 'wechat' && source !== 'planet') {
      return
    }

    if (source === this.data.activeContentSource) {
      return
    }

    this.setData({
      activeContentSource: source,
      displayArticles: source === 'planet' ? this.data.planetArticles : this.data.wechatArticles,
    })

    if (source === 'planet' && !this.data.planetArticles.length && !this.data.loadingPlanetArticles) {
      void this.loadPlanetArticles()
    }
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    const source = String(e.currentTarget.dataset.source || '')
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/pages/articles/detail?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source || this.data.activeContentSource)}`,
    })
  },
})
