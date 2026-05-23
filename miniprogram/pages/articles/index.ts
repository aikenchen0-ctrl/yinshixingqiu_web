import { clearSession, getStoredSession, shouldClearSessionByError } from '../../utils/auth'
import { fetchArticles } from '../../utils/planet-api'
import { mapRemoteArticleToCard, sortArticleCards, type ArticleCardItem } from '../../utils/article-view'
import { buildArticleListRequest, buildArticleSourceTabs, mapWechatArticleCardsFromResponse } from './shared'

type ContentSource = 'wechat' | 'planet'
type FetchArticlesPayload = Parameters<typeof fetchArticles>[0]
type SourceArticlesResult = {
  articles: ArticleCardItem[]
  error: string
}

const getDisplayArticles = (
  activeContentSource: ContentSource,
  wechatArticles: ArticleCardItem[],
  planetArticles: ArticleCardItem[],
) => (activeContentSource === 'planet' ? planetArticles : wechatArticles)

const getSourceError = (activeContentSource: ContentSource, wechatError: string, planetError: string) =>
  activeContentSource === 'planet' ? planetError : wechatError

Page({
  data: {
    activeContentSource: 'wechat' as ContentSource,
    articleSourceTabs: buildArticleSourceTabs('wechat', 0, 0),
    wechatArticles: [] as ArticleCardItem[],
    planetArticles: [] as ArticleCardItem[],
    displayArticles: [] as ArticleCardItem[],
    loadingArticles: false,
    wechatError: '',
    planetError: '',
    articlesError: '',
  },

  onLoad() {
    void this.loadArticles()
  },

  onShow() {
    void this.loadArticles()
  },

  async loadArticlesBySource(contentSource: ContentSource, sessionToken?: string): Promise<SourceArticlesResult> {
    const buildPayload = (token?: string) => buildArticleListRequest(contentSource, token) as FetchArticlesPayload
    const fallbackErrorMessage = contentSource === 'wechat' ? '加载微信文章失败' : '加载知识星球文章失败'

    try {
      const response = await fetchArticles(buildPayload(sessionToken))
      return {
        articles: mapWechatArticleCardsFromResponse(response && response.data ? response.data : null, {
          mapRemoteArticleToCard,
          sortArticleCards,
        }),
        error: '',
      }
    } catch (error) {
      if (!sessionToken) {
        return {
          articles: [],
          error: error instanceof Error ? error.message : fallbackErrorMessage,
        }
      }

      if (shouldClearSessionByError(error)) {
        clearSession()
      }

      try {
        const fallbackResponse = await fetchArticles(buildPayload())
        return {
          articles: mapWechatArticleCardsFromResponse(fallbackResponse && fallbackResponse.data ? fallbackResponse.data : null, {
            mapRemoteArticleToCard,
            sortArticleCards,
          }),
          error: '',
        }
      } catch (fallbackError) {
        return {
          articles: [],
          error: fallbackError instanceof Error ? fallbackError.message : fallbackErrorMessage,
        }
      }
    }
  },

  async loadArticles() {
    this.setData({
      loadingArticles: true,
      wechatError: '',
      planetError: '',
      articlesError: '',
    })

    const storedSession = getStoredSession()
    const sessionToken = storedSession && storedSession.sessionToken ? storedSession.sessionToken : ''

    try {
      const [wechatResult, planetResult] = await Promise.all([
        this.loadArticlesBySource('wechat', sessionToken || undefined),
        this.loadArticlesBySource('planet', sessionToken || undefined),
      ])
      const activeContentSource = this.data.activeContentSource
      const displayArticles = getDisplayArticles(activeContentSource, wechatResult.articles, planetResult.articles)
      const articlesError = getSourceError(activeContentSource, wechatResult.error, planetResult.error)

      this.setData({
        articleSourceTabs: buildArticleSourceTabs(
          activeContentSource,
          wechatResult.articles.length,
          planetResult.articles.length,
        ),
        wechatArticles: wechatResult.articles,
        planetArticles: planetResult.articles,
        displayArticles,
        wechatError: wechatResult.error,
        planetError: planetResult.error,
        loadingArticles: false,
        articlesError,
      })
    } catch (error) {
      this.setData({
        articleSourceTabs: buildArticleSourceTabs(this.data.activeContentSource, 0, 0),
        wechatArticles: [],
        planetArticles: [],
        displayArticles: [],
        loadingArticles: false,
        wechatError: '',
        planetError: '',
        articlesError: error instanceof Error ? error.message : '加载文章失败',
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
      articleSourceTabs: buildArticleSourceTabs(source, this.data.wechatArticles.length, this.data.planetArticles.length),
      displayArticles: getDisplayArticles(source, this.data.wechatArticles, this.data.planetArticles),
      articlesError: getSourceError(source, this.data.wechatError, this.data.planetError),
    })
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    const source = String(e.currentTarget.dataset.source || '')
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/pages/articles/detail?id=${encodeURIComponent(id)}&source=${encodeURIComponent(
        source || this.data.activeContentSource,
      )}`,
    })
  },
})
