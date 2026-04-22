import { getStoredSession } from '../../utils/auth'
import { trackMallAnalyticsEvent } from '../../utils/mall-analytics'
import {
  buildMallMembershipPageUrl,
  showMallMembershipReviewNoticeIfNeeded,
} from '../../utils/mall-membership'
import { buildStoreDetailPath, getMallShareTokenForProduct } from '../../utils/mall-share'
import { getStoredMallStoreId, saveMallStoreId } from '../../utils/mall-store'
import { normalizeAssetUrl, pickNextAssetUrl } from '../../utils/request'
import {
  fetchMallConfig,
  fetchMallProducts,
  type MallMemberBenefitType,
  type MallMemberZoneConfigApiItem,
  type MallMemberZoneSortMode,
  type MallProductApiItem,
} from '../../utils/store-api'

type SearchPageMode = 'search' | 'member_zone'

interface MallSearchProductView {
  id: string
  title: string
  subtitle: string
  categoryName: string
  coverImageUrl: string
  coverFallbackText: string
  priceText: string
  originalPriceText: string
  publicPriceText: string
  memberPriceText: string
  memberBenefitType: MallMemberBenefitType
  memberBenefitLabel: string
  memberPromptText: string
  membershipActive: boolean
  canPurchase: boolean
  stockText: string
}

interface MallMemberZoneSummaryView {
  totalCount: number
  memberPriceCount: number
  memberExclusiveCount: number
  membershipActive: boolean
}

const SEARCH_HISTORY_STORAGE_KEY = 'xueyin_mall_search_history_v1'
const PRODUCT_PREVIEW_STORAGE_KEY = 'xueyin_mall_product_preview'
const MAX_SEARCH_HISTORY_COUNT = 8
const mallSearchImageRetryHistory: Record<string, string[]> = {}

function normalizeKeyword(value: unknown) {
  return String(value || '').trim().slice(0, 30)
}

function normalizeMallSource(value: unknown, fallback = '') {
  const normalizedValue = String(value || '').trim().slice(0, 60)
  return normalizedValue || fallback
}

function normalizeSearchMode(value: unknown): SearchPageMode {
  return String(value || '').trim() === 'member_zone' ? 'member_zone' : 'search'
}

function resetMallSearchImageRetryHistory() {
  Object.keys(mallSearchImageRetryHistory).forEach((key) => {
    delete mallSearchImageRetryHistory[key]
  })
}

function rememberMallSearchImageUrl(assetKey: string, url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!assetKey || !normalizedUrl) {
    return
  }

  const previousUrls = mallSearchImageRetryHistory[assetKey] || []
  if (previousUrls.indexOf(normalizedUrl) >= 0) {
    return
  }

  mallSearchImageRetryHistory[assetKey] = previousUrls.concat(normalizedUrl)
}

function resolveNextMallSearchImageUrl(assetKey: string, currentUrl: string) {
  rememberMallSearchImageUrl(assetKey, currentUrl)

  const nextUrl = pickNextAssetUrl(currentUrl, mallSearchImageRetryHistory[assetKey] || [])
  if (!nextUrl) {
    return ''
  }

  rememberMallSearchImageUrl(assetKey, nextUrl)
  return nextUrl
}

function formatPrice(value: number | string) {
  const amount = Number(value || 0)
  return `¥${amount.toFixed(2)}`
}

function readSearchHistory() {
  try {
    const storedValue = wx.getStorageSync(SEARCH_HISTORY_STORAGE_KEY)
    if (!Array.isArray(storedValue)) {
      return []
    }

    return storedValue.map((item) => normalizeKeyword(item)).filter(Boolean).slice(0, MAX_SEARCH_HISTORY_COUNT)
  } catch {
    return []
  }
}

function persistSearchHistory(keywords: string[]) {
  try {
    wx.setStorageSync(SEARCH_HISTORY_STORAGE_KEY, keywords.slice(0, MAX_SEARCH_HISTORY_COUNT))
  } catch {}
}

function saveSearchKeyword(keyword: string) {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) {
    return readSearchHistory()
  }

  const nextHistory = [normalizedKeyword]
    .concat(readSearchHistory().filter((item) => item !== normalizedKeyword))
    .slice(0, MAX_SEARCH_HISTORY_COUNT)
  persistSearchHistory(nextHistory)
  return nextHistory
}

function clearSearchHistory() {
  try {
    wx.removeStorageSync(SEARCH_HISTORY_STORAGE_KEY)
  } catch {}
}

function buildSearchProductView(product: MallProductApiItem): MallSearchProductView {
  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle || '商品简介暂未填写',
    categoryName: product.categoryName || '未分类',
    coverImageUrl: normalizeAssetUrl(product.coverImageUrl || ''),
    coverFallbackText: product.coverFallbackText || '商品',
    priceText: product.priceText || formatPrice(product.price),
    originalPriceText:
      Number(product.originalPrice || 0) > 0 ? product.originalPriceText || formatPrice(product.originalPrice) : '',
    publicPriceText: product.publicPriceText || formatPrice(product.publicPrice),
    memberPriceText: product.memberPriceText || '',
    memberBenefitType: product.memberBenefitType || 'NONE',
    memberBenefitLabel: product.memberBenefitLabel || '',
    memberPromptText: product.memberPromptText || '',
    membershipActive: Boolean(product.membershipActive),
    canPurchase: product.canPurchase !== false,
    stockText: `库存 ${Number(product.stock || 0)}`,
  }
}

function buildDefaultMemberZoneConfig(storeName = '商城'): MallMemberZoneConfigApiItem {
  return {
    title: `${storeName}会员商品专区`,
    subtitle: '集中展示会员价与会员专享商品，优先承接更适合会员转化的成交清单。',
    badgeText: '会员权益商品',
    highlightText: '默认先展示会员专享商品，再展示会员价商品；如需指定集合，可配置 productIds。',
    emptyTitle: '会员商品专区暂未上架',
    emptySubtitle: '请先给商品配置会员价或会员专享权益，再回到这里统一承接。',
    productIds: [],
    sortMode: 'MEMBER_EXCLUSIVE_FIRST',
  }
}

function normalizeMemberZoneSortMode(value: unknown): MallMemberZoneSortMode {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'CONFIG_ORDER') {
    return 'CONFIG_ORDER'
  }
  if (normalizedValue === 'PRICE_ASC') {
    return 'PRICE_ASC'
  }
  return 'MEMBER_EXCLUSIVE_FIRST'
}

function normalizeMemberZoneConfig(
  config?: Partial<MallMemberZoneConfigApiItem> | null,
  storeName = '商城',
): MallMemberZoneConfigApiItem {
  const defaultConfig = buildDefaultMemberZoneConfig(storeName)
  const sourceProductIds = config && Array.isArray(config.productIds) ? config.productIds : defaultConfig.productIds
  const productIds = sourceProductIds.map((item) => String(item || '').trim()).filter(Boolean)

  return {
    title: String((config && config.title) || defaultConfig.title).trim() || defaultConfig.title,
    subtitle: String((config && config.subtitle) || defaultConfig.subtitle).trim() || defaultConfig.subtitle,
    badgeText: String((config && config.badgeText) || defaultConfig.badgeText).trim() || defaultConfig.badgeText,
    highlightText:
      String((config && config.highlightText) || defaultConfig.highlightText).trim() || defaultConfig.highlightText,
    emptyTitle: String((config && config.emptyTitle) || defaultConfig.emptyTitle).trim() || defaultConfig.emptyTitle,
    emptySubtitle:
      String((config && config.emptySubtitle) || defaultConfig.emptySubtitle).trim() || defaultConfig.emptySubtitle,
    productIds,
    sortMode: normalizeMemberZoneSortMode(config && config.sortMode),
  }
}

function buildMemberProductAnalyticsSummary(
  products: Array<{
    productId: string
    memberBenefitType: MallMemberBenefitType
    membershipActive?: boolean
  }>,
) {
  const memberProducts = products.filter((product) => product.memberBenefitType !== 'NONE')

  return {
    hasMemberProducts: memberProducts.length > 0,
    memberProductCount: memberProducts.length,
    memberPriceCount: memberProducts.filter((product) => product.memberBenefitType === 'MEMBER_PRICE').length,
    memberExclusiveCount: memberProducts.filter((product) => product.memberBenefitType === 'MEMBER_EXCLUSIVE').length,
    membershipActive: memberProducts.some((product) => Boolean(product.membershipActive)),
    memberProductIds: memberProducts.map((product) => product.productId),
  }
}

function buildMemberZoneSummary(products: MallSearchProductView[]): MallMemberZoneSummaryView {
  const memberAnalytics = buildMemberProductAnalyticsSummary(
    products.map((product) => ({
      productId: product.id,
      memberBenefitType: product.memberBenefitType,
      membershipActive: product.membershipActive,
    })),
  )

  return {
    totalCount: memberAnalytics.memberProductCount,
    memberPriceCount: memberAnalytics.memberPriceCount,
    memberExclusiveCount: memberAnalytics.memberExclusiveCount,
    membershipActive: memberAnalytics.membershipActive,
  }
}

function resolveMemberBenefitSortOrder(memberBenefitType: MallMemberBenefitType) {
  if (memberBenefitType === 'MEMBER_EXCLUSIVE') {
    return 0
  }
  if (memberBenefitType === 'MEMBER_PRICE') {
    return 1
  }
  return 2
}

function sortMallMemberZoneProducts(products: MallProductApiItem[], config: MallMemberZoneConfigApiItem) {
  const memberProducts = products.filter((product) => product.memberBenefitType !== 'NONE')
  const configuredProductIds = Array.from(new Set(config.productIds.map((item) => String(item || '').trim()).filter(Boolean)))
  const productOrderMap = configuredProductIds.reduce<Record<string, number>>((result, productId, index) => {
    result[productId] = index
    return result
  }, {})

  const configuredProducts = configuredProductIds.length
    ? memberProducts.filter((product) => Object.prototype.hasOwnProperty.call(productOrderMap, product.id))
    : []
  const sourceProducts = configuredProducts.length ? configuredProducts : memberProducts

  const sortedProducts = sourceProducts.slice().sort((left, right) => {
    if (config.sortMode === 'CONFIG_ORDER' && configuredProducts.length) {
      return productOrderMap[left.id] - productOrderMap[right.id]
    }

    if (config.sortMode === 'PRICE_ASC') {
      return (
        Number(left.price || 0) - Number(right.price || 0) ||
        Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
        String(left.title || '').localeCompare(String(right.title || ''))
      )
    }

    return (
      resolveMemberBenefitSortOrder(left.memberBenefitType || 'NONE') -
        resolveMemberBenefitSortOrder(right.memberBenefitType || 'NONE') ||
      Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
      Number(left.price || 0) - Number(right.price || 0) ||
      String(left.title || '').localeCompare(String(right.title || ''))
    )
  })

  return sortedProducts
}

function buildMallMemberZonePath(storeId = '', source = 'member_zone_return') {
  const queryParts = ['mode=member_zone']
  const normalizedStoreId = String(storeId || '').trim()
  const normalizedSource = normalizeMallSource(source)

  if (normalizedStoreId) {
    queryParts.push(`storeId=${encodeURIComponent(normalizedStoreId)}`)
  }
  if (normalizedSource) {
    queryParts.push(`source=${encodeURIComponent(normalizedSource)}`)
  }

  return `/pages/store/search?${queryParts.join('&')}`
}

Page({
  data: {
    pageMode: 'search' as SearchPageMode,
    pageTitle: '商城搜索',
    searchPlaceholder: '搜索商品标题 / 分类词',
    storeName: '商城',
    mallStoreId: '',
    searchValue: '',
    appliedKeyword: '',
    loading: true,
    searching: false,
    hotKeywords: [] as string[],
    historyKeywords: readSearchHistory(),
    products: [] as MallSearchProductView[],
    emptyTitle: '搜索你想找的商品',
    emptySubtitle: '可按商品标题、分类词或热搜词快速筛选。',
    memberZoneConfig: buildDefaultMemberZoneConfig('商城') as MallMemberZoneConfigApiItem,
    memberZoneSummary: null as MallMemberZoneSummaryView | null,
  },

  async onLoad(options: Record<string, string>) {
    resetMallSearchImageRetryHistory()
    const initialMode = normalizeSearchMode(options.mode)
    const initialKeyword = initialMode === 'member_zone' ? '' : normalizeKeyword(options.keyword)
    const initialStoreId = saveMallStoreId(options.storeId || getStoredMallStoreId())
    const initialSource = normalizeMallSource(options.source)

    this.setData({
      pageMode: initialMode,
      pageTitle: initialMode === 'member_zone' ? '会员商品专区' : '商城搜索',
      searchPlaceholder: initialMode === 'member_zone' ? '搜索会员商品标题' : '搜索商品标题 / 分类词',
      mallStoreId: initialStoreId,
      searchValue: initialKeyword,
      historyKeywords: readSearchHistory(),
      memberZoneSummary: null,
    })

    await this.initializePage(initialKeyword, initialStoreId, initialSource, initialMode)
  },

  onUnload() {
    resetMallSearchImageRetryHistory()
  },

  onShow() {
    showMallMembershipReviewNoticeIfNeeded()
  },

  async initializePage(initialKeyword = '', initialStoreId = '', initialSource = '', initialMode: SearchPageMode = 'search') {
    const fallbackStoreId = String(initialStoreId || '').trim() || getStoredMallStoreId()

    this.setData({
      loading: true,
    })

    try {
      const configResponse = await fetchMallConfig(fallbackStoreId || undefined)
      const mallStoreId = saveMallStoreId(configResponse.data.storeId || fallbackStoreId)
      const storeName = configResponse.data.storeName || '商城'
      const memberZoneConfig = normalizeMemberZoneConfig(configResponse.data.memberZoneConfig, storeName)

      this.setData({
        pageTitle: initialMode === 'member_zone' ? memberZoneConfig.title : '商城搜索',
        searchPlaceholder: initialMode === 'member_zone' ? '搜索会员商品标题' : '搜索商品标题 / 分类词',
        storeName,
        mallStoreId,
        hotKeywords: Array.isArray(configResponse.data.searchHotKeywords) ? configResponse.data.searchHotKeywords : [],
        memberZoneConfig,
        loading: false,
        emptyTitle: initialMode === 'member_zone' ? memberZoneConfig.emptyTitle : '搜索你想找的商品',
        emptySubtitle:
          initialMode === 'member_zone'
            ? memberZoneConfig.emptySubtitle
            : '可按商品标题、分类词或热搜词快速筛选。',
      })

      if (initialMode === 'member_zone') {
        await this.loadMemberZone(mallStoreId, memberZoneConfig, initialSource || 'member_zone_landing')
        return
      }

      if (initialKeyword) {
        await this.runSearch(initialKeyword, mallStoreId, initialSource || 'landing_keyword')
      }
    } catch (error) {
      this.setData({
        loading: false,
        emptyTitle: this.data.pageMode === 'member_zone' ? '会员专区暂不可用' : '商城搜索暂不可用',
        emptySubtitle: error instanceof Error ? error.message : '请稍后重试',
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '商城搜索加载失败',
        icon: 'none',
      })
    }
  },

  async loadMemberZone(storeId = '', memberZoneConfig?: MallMemberZoneConfigApiItem, mallSource = 'member_zone_landing') {
    const session = getStoredSession()
    const effectiveStoreId = storeId || this.data.mallStoreId || getStoredMallStoreId()
    const effectiveConfig = normalizeMemberZoneConfig(memberZoneConfig || this.data.memberZoneConfig, this.data.storeName)

    this.setData({
      searching: true,
      searchValue: '',
      appliedKeyword: '',
      products: [],
      memberZoneSummary: null,
      emptyTitle: '会员专区加载中...',
      emptySubtitle: '正在从真实商城商品里整理会员权益商品。',
    })

    try {
      const response = await fetchMallProducts({
        storeId: effectiveStoreId,
        sessionToken: session ? session.sessionToken : '',
      })
      const sortedProducts = sortMallMemberZoneProducts(
        Array.isArray(response.data.items) ? response.data.items : [],
        effectiveConfig,
      )
      const products = sortedProducts.map(buildSearchProductView)
      const memberZoneSummary = buildMemberZoneSummary(products)
      const memberSummaryAnalytics = buildMemberProductAnalyticsSummary(
        products.map((product) => ({
          productId: product.id,
          memberBenefitType: product.memberBenefitType,
          membershipActive: product.membershipActive,
        })),
      )

      saveMallStoreId(response.data.storeId || effectiveStoreId)
      this.setData({
        mallStoreId: response.data.storeId || effectiveStoreId || this.data.mallStoreId,
        searching: false,
        products,
        memberZoneSummary,
        emptyTitle: products.length ? '' : effectiveConfig.emptyTitle,
        emptySubtitle: products.length ? '' : effectiveConfig.emptySubtitle,
      })

      if (products.length) {
        void trackMallAnalyticsEvent({
          storeId: response.data.storeId || effectiveStoreId || this.data.mallStoreId,
          mallEventType: 'MEMBER_PRODUCT_IMPRESSION',
          mallPage: 'store_search',
          mallSource,
          targetType: 'GROUP',
          targetId: response.data.storeId || effectiveStoreId || this.data.mallStoreId,
          properties: {
            entryTitle: effectiveConfig.title,
            badgeText: effectiveConfig.badgeText,
            sortMode: effectiveConfig.sortMode,
            ...memberSummaryAnalytics,
          },
        })
      }
    } catch (error) {
      this.setData({
        searching: false,
        products: [],
        memberZoneSummary: null,
        emptyTitle: '会员专区加载失败',
        emptySubtitle: error instanceof Error ? error.message : '请稍后重试',
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '会员专区加载失败',
        icon: 'none',
      })
    }
  },

  async runSearch(keyword: string, storeId = '', mallSource = 'manual_search') {
    if (this.data.pageMode === 'member_zone') {
      return
    }

    const normalizedKeyword = normalizeKeyword(keyword)
    if (!normalizedKeyword) {
      this.setData({
        appliedKeyword: '',
        searchValue: '',
        products: [],
        searching: false,
        emptyTitle: '搜索你想找的商品',
        emptySubtitle: '可按商品标题、分类词或热搜词快速筛选。',
        historyKeywords: readSearchHistory(),
      })
      return
    }

    const session = getStoredSession()

    void trackMallAnalyticsEvent({
      storeId: storeId || this.data.mallStoreId || getStoredMallStoreId(),
      mallEventType: 'SEARCH_SUBMIT',
      mallPage: 'store_search',
      mallSource,
      targetType: 'GROUP',
      targetId: storeId || this.data.mallStoreId || getStoredMallStoreId(),
      keyword: normalizedKeyword,
      properties: {
        keyword: normalizedKeyword,
        storeName: this.data.storeName,
      },
    })

    this.setData({
      searchValue: normalizedKeyword,
      appliedKeyword: normalizedKeyword,
      searching: true,
      emptyTitle: '搜索中...',
      emptySubtitle: '正在按关键词筛选商品。',
    })

    try {
      const response = await fetchMallProducts({
        storeId: storeId || this.data.mallStoreId || getStoredMallStoreId(),
        keyword: normalizedKeyword,
        sessionToken: session ? session.sessionToken : '',
      })
      const products = Array.isArray(response.data.items) ? response.data.items.map(buildSearchProductView) : []
      const historyKeywords = saveSearchKeyword(response.data.keyword || normalizedKeyword)
      const emptyTitle = products.length ? '' : `没有找到“${normalizedKeyword}”`
      const emptySubtitle = products.length ? '' : '换个关键词试试，或直接点热搜词进入。'

      saveMallStoreId(response.data.storeId || storeId)
      this.setData({
        mallStoreId: response.data.storeId || storeId || this.data.mallStoreId,
        appliedKeyword: response.data.keyword || normalizedKeyword,
        searching: false,
        products,
        historyKeywords,
        emptyTitle,
        emptySubtitle,
      })
    } catch (error) {
      this.setData({
        searching: false,
        products: [],
        emptyTitle: '搜索失败',
        emptySubtitle: error instanceof Error ? error.message : '请稍后重试',
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '搜索失败',
        icon: 'none',
      })
    }
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({
      searchValue: normalizeKeyword(event.detail.value),
    })
  },

  onSearchTap() {
    if (this.data.pageMode === 'member_zone') {
      return
    }

    void this.runSearch(this.data.searchValue, this.data.mallStoreId, 'manual_search')
  },

  onSearchConfirm(event: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    if (this.data.pageMode === 'member_zone') {
      return
    }

    void this.runSearch(normalizeKeyword(event.detail.value || this.data.searchValue), this.data.mallStoreId, 'manual_confirm')
  },

  onKeywordTap(event: WechatMiniprogram.BaseEvent) {
    if (this.data.pageMode === 'member_zone') {
      return
    }

    const keyword = normalizeKeyword(event.currentTarget.dataset.keyword)
    if (!keyword) {
      return
    }

    const mallSource = this.data.hotKeywords.indexOf(keyword) >= 0 ? 'hot_keyword' : 'history_keyword'
    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'SEARCH_KEYWORD_CLICK',
      mallPage: 'store_search',
      mallSource,
      targetType: 'GROUP',
      targetId: this.data.mallStoreId,
      keyword,
      properties: {
        keyword,
      },
    })

    void this.runSearch(keyword, this.data.mallStoreId, mallSource)
  },

  onClearSearch() {
    if (this.data.pageMode === 'member_zone') {
      return
    }

    this.setData({
      searchValue: '',
      appliedKeyword: '',
      products: [],
      emptyTitle: '搜索你想找的商品',
      emptySubtitle: '可按商品标题、分类词或热搜词快速筛选。',
    })
  },

  onClearHistory() {
    clearSearchHistory()
    this.setData({
      historyKeywords: [],
    })
  },

  onProductImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const productId = String(event.currentTarget.dataset.productId || index)
    const product = this.data.products[index]

    if (!product) {
      return
    }

    const nextUrl = resolveNextMallSearchImageUrl(`product_${productId}`, product.coverImageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`products[${index}].coverImageUrl`]: nextUrl,
    })
  },

  onOpenMembershipFromMemberZone() {
    if (this.data.pageMode !== 'member_zone' || !this.data.products.length) {
      return
    }

    const firstProduct = this.data.products[0]
    const memberSummary = buildMemberProductAnalyticsSummary(
      this.data.products.map((product) => ({
        productId: product.id,
        memberBenefitType: product.memberBenefitType,
        membershipActive: product.membershipActive,
      })),
    )

    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'MEMBER_OPEN_MEMBERSHIP_CLICK',
      mallPage: 'store_search',
      mallSource: 'member_zone_open_membership',
      targetType: 'GROUP',
      targetId: this.data.mallStoreId,
      properties: {
        productId: firstProduct.id,
        productTitle: firstProduct.title,
        entryTitle: this.data.memberZoneConfig.title,
        ...memberSummary,
      },
    })

    wx.navigateTo({
      url: buildMallMembershipPageUrl({
        storeId: this.data.mallStoreId,
        storeName: this.data.storeName,
        redirectUrl: buildMallMemberZonePath(this.data.mallStoreId, 'member_zone_return'),
        source: 'member_zone_open_membership',
        productId: firstProduct.id,
        productTitle: firstProduct.title,
      }),
    })
  },

  onOpenProduct(event: WechatMiniprogram.BaseEvent) {
    const productId = String(event.currentTarget.dataset.id || '')
    if (!productId) {
      return
    }

    try {
      const selectedProduct = this.data.products.find((item) => item.id === productId) || null
      const mallSource = this.data.pageMode === 'member_zone' ? 'member_zone_result' : 'search_result'
      const mallEventType = this.data.pageMode === 'member_zone' ? 'PRODUCT_CLICK' : 'SEARCH_RESULT_CLICK'
      if (selectedProduct) {
        wx.setStorageSync(PRODUCT_PREVIEW_STORAGE_KEY, selectedProduct)
        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType,
          mallPage: 'store_search',
          mallSource,
          targetType: 'POST',
          targetId: productId,
          keyword: this.data.appliedKeyword,
          properties: {
            productId,
            keyword: this.data.appliedKeyword,
            title: selectedProduct.title,
            categoryName: selectedProduct.categoryName,
            memberBenefitType: selectedProduct.memberBenefitType,
            memberBenefitLabel: selectedProduct.memberBenefitLabel,
            membershipActive: selectedProduct.membershipActive,
          },
        })
      } else {
        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType,
          mallPage: 'store_search',
          mallSource,
          targetType: 'POST',
          targetId: productId,
          keyword: this.data.appliedKeyword,
          properties: {
            productId,
            keyword: this.data.appliedKeyword,
          },
        })
      }
    } catch {}

    wx.navigateTo({
      url: buildStoreDetailPath(productId, getMallShareTokenForProduct(productId)),
    })
  },
})
