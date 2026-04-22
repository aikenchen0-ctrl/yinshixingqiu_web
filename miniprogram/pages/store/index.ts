import { clearSession, getStoredSession, savePendingLoginRedirect, shouldClearSessionByError } from '../../utils/auth'
import {
  buildStoreDetailPath,
  clearMallShareContext,
  getMallShareTokenForProduct,
  getMallShareTokenForProductIds,
  isMallShareInvalidError,
} from '../../utils/mall-share'
import {
  isMallPaymentCancelled,
  pollMallOrderPaymentResult,
  requestMallWechatPayment,
} from '../../utils/mall-payment'
import {
  loadGuestMallCartQuantities,
  saveGuestMallCartQuantities,
  syncGuestMallCartToSession,
} from '../../utils/mall-guest-cart'
import { trackMallAnalyticsEvent } from '../../utils/mall-analytics'
import {
  buildMallMembershipPageUrl,
  showMallMembershipReviewNoticeIfNeeded,
} from '../../utils/mall-membership'
import {
  buildMallCheckoutPricingSummary,
  buildMallPricingAnalyticsSummary,
  type MallPricingSummaryView,
} from '../../utils/mall-pricing'
import { normalizeAssetUrl, pickNextAssetUrl } from '../../utils/request'
import {
  buildMallCouponAnalyticsDedupKey,
  buildMallCouponAnalyticsSummary,
  buildMallCouponSelectorOptions,
  buildMallCouponSummary,
  hasAutoAppliedMallCoupon,
  type MallCouponSelectionMode,
  type MallCouponSelectorOptionView,
  type MallCouponSummaryView,
} from '../../utils/mall-coupon'
import {
  buildMallAddressManagerUrl,
  buildMallShippingAddressView,
  buildMallShippingAddressViews,
  type MallShippingAddressView,
} from '../../utils/mall-address'
import { normalizeMallUserFacingErrorMessage } from '../../utils/mall-error'
import {
  addMallCartItem,
  clearMallCart,
  createMallOrder,
  deleteMallCartItem,
  fetchMallConfig,
  fetchMallCart,
  fetchMallCategories,
  fetchMallCoupons,
  fetchMallShippingAddress,
  fetchMallProducts,
  updateMallCartItem,
  type MallCartApiItem,
  type MallCartPayload,
  type MallCategoryApiItem,
  type MallCouponApiItem,
  type MallMemberBenefitType,
  type MallOrderApiItem,
  type MallOrderPaymentApiItem,
  type MallProductApiItem,
  type MallShippingAddressApiItem,
} from '../../utils/store-api'
import { getStoredMallStoreId, resolveMallStoreIdFromConfig, saveMallStoreId } from '../../utils/mall-store'

interface MallCategory {
  id: string
  label: string
  count: number
}

interface MallProductView {
  id: string
  categoryId: string
  categoryName: string
  title: string
  subtitle: string
  coverImageUrl: string
  coverFallbackText: string
  price: number
  priceText: string
  originalPriceText: string
  publicPrice: number
  publicPriceText: string
  memberPrice: number
  memberPriceText: string
  memberBenefitType: MallMemberBenefitType
  memberBenefitLabel: string
  memberPromptText: string
  membershipActive: boolean
  canPurchase: boolean
  stock: number
  cartCount: number
}

type MallHeroSlideTone = 'teal' | 'orange' | 'blue'
type MallHeroSlideAction = 'product'

interface MallHeroSlide {
  id: string
  tag: string
  title: string
  subtitle: string
  footerText: string
  buttonText: string
  imageUrl: string
  fallbackText: string
  tone: MallHeroSlideTone
  action: MallHeroSlideAction
  productId: string
}

interface MallCartItemView {
  id: string
  productId: string
  title: string
  subtitle: string
  coverImageUrl: string
  coverFallbackText: string
  price: number
  publicPrice: number
  quantity: number
  stock: number
  priceText: string
  totalPriceText: string
  memberBenefitType: MallMemberBenefitType
  memberBenefitLabel: string
  memberPromptText: string
  membershipActive: boolean
  canPurchase: boolean
  totalAmount: number
}

interface MallMineMenuItem {
  id: 'address' | 'refund' | 'orders' | 'commission'
  title: string
  subtitle: string
  delay: number
}

interface MallEmptyState {
  title: string
  subtitle: string
}

interface MallMemberSpotlightView {
  membershipActive: boolean
  totalCount: number
  memberPriceCount: number
  memberExclusiveCount: number
  previewTitles: string[]
  title: string
  subtitle: string
  caption: string
}

let nativeTabBarVisible = true
let lastMallScrollTop = 0
let mallCatalog: MallProductView[] = []
let mineMenuCloseTimer: ReturnType<typeof setTimeout> | null = null
let mallHomeViewPending = false
let lastCartCouponImpressionKey = ''
let lastCartCouponAutoApplyKey = ''
const mallImageRetryHistory: Record<string, string[]> = {}

const PRODUCT_PREVIEW_STORAGE_KEY = 'xueyin_mall_product_preview'
const TAB_BAR_HIDE_TRIGGER_SCROLL_TOP = 180
const TAB_BAR_SHOW_TRIGGER_SCROLL_TOP = 72
const TAB_BAR_SCROLL_DELTA_THRESHOLD = 12

const MALL_MINE_MENU_ITEMS: MallMineMenuItem[] = [
  {
    id: 'address',
    title: '地址管理',
    subtitle: '管理商城收货地址',
    delay: 0,
  },
  {
    id: 'refund',
    title: '退款信息',
    subtitle: '查看退款相关订单',
    delay: 40,
  },
  {
    id: 'orders',
    title: '订单管理',
    subtitle: '查看全部商城订单',
    delay: 80,
  },
  {
    id: 'commission',
    title: '分享佣金',
    subtitle: '查看分享带来的佣金订单',
    delay: 120,
  },
]

function resetMallImageRetryHistory() {
  Object.keys(mallImageRetryHistory).forEach((key) => {
    delete mallImageRetryHistory[key]
  })
}

function rememberMallImageUrl(assetKey: string, url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!assetKey || !normalizedUrl) {
    return
  }

  const previousUrls = mallImageRetryHistory[assetKey] || []
  if (previousUrls.indexOf(normalizedUrl) >= 0) {
    return
  }

  mallImageRetryHistory[assetKey] = previousUrls.concat(normalizedUrl)
}

function resolveNextMallImageUrl(assetKey: string, currentUrl: string) {
  rememberMallImageUrl(assetKey, currentUrl)

  const nextUrl = pickNextAssetUrl(currentUrl, mallImageRetryHistory[assetKey] || [])
  if (!nextUrl) {
    return ''
  }

  rememberMallImageUrl(assetKey, nextUrl)
  return nextUrl
}

function formatPrice(value: number | string) {
  const amount = Number(value || 0)
  return `¥${amount.toFixed(2)}`
}

function buildCartPricingSummary(cartItems: MallCartItemView[], couponSummary: MallCouponSummaryView | null | undefined) {
  const items = Array.isArray(cartItems) ? cartItems : []
  if (!items.length) {
    return null
  }

  return buildMallCheckoutPricingSummary({
    items: items.map((item) => ({
      price: item.price,
      publicPrice: item.publicPrice,
      quantity: item.quantity,
    })),
    couponDiscountAmount: couponSummary ? couponSummary.discountAmount : 0,
  })
}

function formatOptionalPrice(value: number | string, fallbackText = '') {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackText
  }

  return formatPrice(amount)
}

function buildCategoryViews(items: MallCategoryApiItem[]): MallCategory[] {
  if (!items.length) {
    return []
  }

  const totalCount = items.reduce((sum, item) => sum + item.productCount, 0)

  return [
    {
      id: 'all',
      label: '全部',
      count: totalCount,
    },
  ].concat(
    items.map((item) => ({
      id: item.id,
      label: item.name,
      count: item.productCount,
    })),
  )
}

function buildCartCountMap(cartItems: MallCartApiItem[]) {
  return cartItems.reduce<Record<string, number>>((result, item) => {
    result[item.productId] = item.quantity
    return result
  }, {})
}

function buildProductView(product: MallProductApiItem, cartCountMap: Record<string, number>): MallProductView {
  return {
    id: product.id,
    categoryId: product.categoryId,
    categoryName: product.categoryName || '',
    title: product.title,
    subtitle: product.subtitle || '商品简介暂未填写',
    coverImageUrl: normalizeAssetUrl(product.coverImageUrl || ''),
    coverFallbackText: product.coverFallbackText || '商品',
    price: product.price,
    priceText: product.priceText || formatPrice(product.price),
    originalPriceText: formatOptionalPrice(product.originalPrice, product.originalPriceText || ''),
    publicPrice: product.publicPrice,
    publicPriceText: product.publicPriceText || formatPrice(product.publicPrice),
    memberPrice: product.memberPrice,
    memberPriceText: product.memberPriceText || formatOptionalPrice(product.memberPrice, ''),
    memberBenefitType: product.memberBenefitType || 'NONE',
    memberBenefitLabel: product.memberBenefitLabel || '',
    memberPromptText: product.memberPromptText || '',
    membershipActive: Boolean(product.membershipActive),
    canPurchase: product.canPurchase !== false,
    stock: product.stock,
    cartCount: Number(cartCountMap[product.id] || 0),
  }
}

function buildMallHeroSlides(storeName: string, products: MallProductApiItem[]): MallHeroSlide[] {
  const sourceProducts = Array.isArray(products) ? products : []
  const tones: MallHeroSlideTone[] = ['teal', 'orange', 'blue']

  return sourceProducts.slice(0, 3).map((product, index) => ({
    id: `product_${product.id}`,
    tag: product.categoryName || (index === 0 ? '精选推荐' : '商品推荐'),
    title: product.title,
    subtitle: product.subtitle || `${storeName}好物推荐`,
    footerText: `到手价 ${formatPrice(product.price)}`,
    buttonText: '查看商品',
    imageUrl: normalizeAssetUrl(product.coverImageUrl || ''),
    fallbackText: product.coverFallbackText || '好物',
    tone: tones[index % tones.length],
    action: 'product',
    productId: product.id,
  }))
}

function buildMallEmptyState(storeName = '商城', hasCatalog = false): MallEmptyState {
  if (hasCatalog) {
    return {
      title: '还没有商品',
      subtitle: '去后台先添加商品，小程序商城页会自动展示。',
    }
  }

  return {
    title: `${storeName}还没有上架商品`,
    subtitle: '先在管理端配置分类和商品后，这里会显示真实商品。',
  }
}

function buildMallLoadFailureState(error: unknown): MallEmptyState {
  const message = normalizeMallUserFacingErrorMessage(error, '')

  if (
    message.includes('没有明确数据源') ||
    message.includes('多个可用数据源') ||
    message.includes('数据源未确定')
  ) {
    return {
      title: '商城数据源还未确定',
      subtitle: '请确认当前后端只连接一套真实商城数据，或在后端明确指定商城数据源。',
    }
  }

  if (message.includes('没有可用数据源') || message.includes('还没有可用数据')) {
    return {
      title: '商城还没有可用数据',
      subtitle: '请先在管理端确认分类和商品都已经配置完成。',
    }
  }

  if (
    message.includes('request:fail') ||
    message.includes('timeout') ||
    message.includes('Failed to connect') ||
    message.includes('请求失败')
  ) {
    return {
      title: '商城接口暂时不可用',
      subtitle: '请确认小程序当前连接的后端环境，和管理端正在使用的是同一套服务。',
    }
  }

  return {
    title: message || '商城加载失败',
    subtitle: '请检查商城接口、当前环境和数据源配置后重试。',
  }
}

function buildCartItemView(item: MallCartApiItem): MallCartItemView {
  return {
    id: item.id,
    productId: item.productId,
    title: item.title,
    subtitle: item.subtitle || '商品简介暂未填写',
    coverImageUrl: normalizeAssetUrl(item.coverImageUrl || ''),
    coverFallbackText: item.coverFallbackText || '商品',
    quantity: item.quantity,
    stock: item.stock,
    price: Number(item.price || 0),
    publicPrice: Number(item.publicPrice || item.price || 0),
    priceText: item.priceText || formatPrice(item.price),
    totalPriceText: formatPrice(item.totalAmount),
    memberBenefitType: item.memberBenefitType || 'NONE',
    memberBenefitLabel: item.memberBenefitLabel || '',
    memberPromptText: item.memberPromptText || '',
    membershipActive: Boolean(item.membershipActive),
    canPurchase: item.canPurchase !== false,
    totalAmount: Number(item.totalAmount || 0),
  }
}

function buildMallMemberSpotlightView(products: MallProductView[]) {
  const memberProducts = products.filter((product) => product.memberBenefitType !== 'NONE')
  if (!memberProducts.length) {
    return null
  }

  const memberPriceCount = memberProducts.filter((product) => product.memberBenefitType === 'MEMBER_PRICE').length
  const memberExclusiveCount = memberProducts.filter((product) => product.memberBenefitType === 'MEMBER_EXCLUSIVE').length
  const membershipActive = memberProducts.some((product) => product.membershipActive)

  return {
    membershipActive,
    totalCount: memberProducts.length,
    memberPriceCount,
    memberExclusiveCount,
    previewTitles: memberProducts.slice(0, 3).map((product) => product.title),
    title: membershipActive ? '会员权益商品已解锁' : '会员专享入口',
    subtitle: membershipActive
      ? `当前有 ${memberProducts.length} 个会员权益商品，优先看会员价和会员专享。`
      : `当前有 ${memberProducts.length} 个会员权益商品，先开会员再回来拿权益价。`,
    caption:
      memberExclusiveCount > 0
        ? `${memberExclusiveCount} 个会员专享，${memberPriceCount} 个会员价商品`
        : `${memberPriceCount} 个会员价商品，适合先解锁后再买`,
  } satisfies MallMemberSpotlightView
}

function buildMemberProductAnalyticsSummary(products: Array<{
  productId: string
  memberBenefitType: MallMemberBenefitType
  membershipActive?: boolean
}>) {
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

function filterProductViewsByCategory(products: MallProductView[], categoryId: string) {
  if (!categoryId || categoryId === 'all') {
    return products
  }

  return products.filter((item) => item.categoryId === categoryId)
}

function buildGuestCartPayload(products: MallProductView[]) {
  const sourceProducts = products.length ? products : mallCatalog
  const quantities = loadGuestMallCartQuantities()
  const items: MallCartApiItem[] = sourceProducts
    .filter((product) => Number(quantities[product.id] || 0) > 0)
    .map((product) => {
      const quantity = Number(quantities[product.id] || 0)
      const totalAmount = product.price * quantity

      return {
        id: `guest_${product.id}`,
        productId: product.id,
        storeId: 'guest_mall',
        categoryId: product.categoryId,
        categoryName: '',
        title: product.title,
        subtitle: product.subtitle,
        coverImageUrl: product.coverImageUrl,
        coverFallbackText: product.coverFallbackText,
        price: product.price,
        priceText: product.priceText,
        publicPrice: product.publicPrice,
        publicPriceText: product.publicPriceText,
        memberPrice: product.memberPrice,
        memberPriceText: product.memberPriceText,
        memberBenefitType: product.memberBenefitType,
        memberBenefitLabel: product.memberBenefitLabel,
        membershipActive: product.membershipActive,
        canPurchase: product.canPurchase,
        memberPromptText: product.memberPromptText,
        originalPrice: Number(product.originalPriceText.replace(/[^\d.]/g, '') || 0),
        originalPriceText: product.originalPriceText,
        quantity,
        stock: product.stock,
        isOnSale: true,
        totalAmount,
        totalAmountText: totalAmount.toFixed(2),
        createdAt: '',
        updatedAt: '',
      }
    })

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0)

  return {
    cartCount,
    totalAmount,
    totalAmountText: totalAmount.toFixed(2),
    items,
  }
}

function getCartTotalAmountFromViewItems(items: MallCartItemView[]) {
  return items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
}

function buildMallLoginUrl() {
  return `/pages/auth/login?redirect=${encodeURIComponent('/pages/store/index')}`
}

function buildMallOrdersUrl() {
  return '/pages/store/orders'
}

function buildMallSearchPath(keyword = '', storeId = '', source = '') {
  const queryParts: string[] = []
  if (keyword) {
    queryParts.push(`keyword=${encodeURIComponent(keyword)}`)
  }
  if (storeId) {
    queryParts.push(`storeId=${encodeURIComponent(storeId)}`)
  }
  if (source) {
    queryParts.push(`source=${encodeURIComponent(source)}`)
  }

  return `/pages/store/search${queryParts.length ? `?${queryParts.join('&')}` : ''}`
}

function buildMallMemberZonePath(storeId = '', source = 'member_entry') {
  const queryParts = ['mode=member_zone']
  const normalizedStoreId = String(storeId || '').trim()
  const normalizedSource = String(source || '').trim()

  if (normalizedStoreId) {
    queryParts.push(`storeId=${encodeURIComponent(normalizedStoreId)}`)
  }
  if (normalizedSource) {
    queryParts.push(`source=${encodeURIComponent(normalizedSource)}`)
  }

  return `/pages/store/search?${queryParts.join('&')}`
}

function buildMallOrderDetailUrl(orderId: string) {
  return `/pages/store/order-detail?id=${encodeURIComponent(orderId)}`
}

function buildMallMembershipEntryUrl(input: {
  storeId?: string
  storeName?: string
  redirectUrl?: string
  source?: string
  productId?: string
  productTitle?: string
} = {}) {
  const storeId = String(input.storeId || '').trim()
  const storeName = String(input.storeName || '').trim()
  const redirectUrl = String(input.redirectUrl || '/pages/store/index').trim() || '/pages/store/index'
  const source = String(input.source || 'store_home').trim()
  const productId = String(input.productId || '').trim()
  const productTitle = String(input.productTitle || '').trim() || (storeName ? `${storeName}会员权益商品` : '')

  return buildMallMembershipPageUrl({
    storeId,
    storeName,
    redirectUrl,
    source,
    productId,
    productTitle,
  })
}

async function resolveMallRequestStoreId(currentMallStoreId?: string) {
  const normalizedCurrentStoreId = String(currentMallStoreId || '').trim()
  const storedMallStoreId = getStoredMallStoreId()

  try {
    return await resolveMallStoreIdFromConfig()
  } catch (error) {
    if (normalizedCurrentStoreId) {
      return normalizedCurrentStoreId
    }

    if (storedMallStoreId) {
      return storedMallStoreId
    }

    throw error
  }
}

Page({
  data: {
    storeName: '商城',
    heroSlides: buildMallHeroSlides('商城', []),
    mallStoreId: '',
    categories: [] as MallCategory[],
    activeCategoryId: 'all',
    products: [] as MallProductView[],
    tabsPinned: false,
    hideNativeTabBar: false,
    loading: true,
    loadingText: '商城加载中...',
    cartCount: 0,
    cartAmountText: formatPrice(0),
    cartItems: [] as MallCartItemView[],
    memberSpotlight: null as MallMemberSpotlightView | null,
    mallCoupons: [] as MallCouponApiItem[],
    couponLoading: false,
    cartSelectedCouponCode: '',
    cartCouponSelectionMode: 'AUTO' as MallCouponSelectionMode,
    cartCouponSummary: null as MallCouponSummaryView | null,
    cartCouponPopupVisible: false,
    cartCouponPopupOptions: [] as MallCouponSelectorOptionView[],
    cartPricingSummary: null as MallPricingSummaryView | null,
    cartVisible: false,
    submittingOrder: false,
    shippingAddressItems: [] as MallShippingAddressApiItem[],
    shippingAddresses: [] as MallShippingAddressView[],
    shippingAddress: null as MallShippingAddressView | null,
    selectedAddressId: '',
    addressLoading: false,
    addressLoginRequired: true,
    addressPickerVisible: false,
    emptyStateTitle: buildMallEmptyState().title,
    emptyStateSubtitle: buildMallEmptyState().subtitle,
    mineMenuVisible: false,
    mineMenuOpen: false,
    mineMenuItems: MALL_MINE_MENU_ITEMS,
  },

  onLoad() {
    resetMallImageRetryHistory()
    lastCartCouponImpressionKey = ''
    lastCartCouponAutoApplyKey = ''
    nativeTabBarVisible = true
    lastMallScrollTop = 0
    this.setData({
      hideNativeTabBar: false,
    })
    this.loadMallHome('all')
    this.ensureNativeTabBarVisible(false)
  },

  onShow() {
    lastMallScrollTop = 0
    mallHomeViewPending = true
    this.setData({
      hideNativeTabBar: false,
    })
    this.ensureNativeTabBarVisible(false)
    this.loadMallHome(this.data.activeCategoryId, true)
    void this.loadShippingAddress()
    showMallMembershipReviewNoticeIfNeeded()
  },

  onHide() {
    mallHomeViewPending = false
    this.hideMineMenu(true)
    this.ensureNativeTabBarVisible(false)
  },

  onUnload() {
    resetMallImageRetryHistory()
    lastCartCouponImpressionKey = ''
    lastCartCouponAutoApplyKey = ''
    mallHomeViewPending = false
    this.hideMineMenu(true)
    this.ensureNativeTabBarVisible(false)
  },

  onHeroSlideImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const slideId = String(event.currentTarget.dataset.slideId || index)
    const slide = this.data.heroSlides[index]

    if (!slide) {
      return
    }

    const nextUrl = resolveNextMallImageUrl(`hero_${slideId}`, slide.imageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`heroSlides[${index}].imageUrl`]: nextUrl,
    })
  },

  onProductImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const productId = String(event.currentTarget.dataset.productId || index)
    const product = this.data.products[index]

    if (!product) {
      return
    }

    const nextUrl = resolveNextMallImageUrl(`product_${productId}`, product.coverImageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`products[${index}].coverImageUrl`]: nextUrl,
    })
  },

  onCartItemImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const cartItemId = String(event.currentTarget.dataset.cartItemId || index)
    const cartItem = this.data.cartItems[index]

    if (!cartItem) {
      return
    }

    const nextUrl = resolveNextMallImageUrl(`cart_${cartItemId}`, cartItem.coverImageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`cartItems[${index}].coverImageUrl`]: nextUrl,
    })
  },

  onPageScroll(event: WechatMiniprogram.Page.IPageScrollOption) {
    const scrollTop = Number(event.scrollTop || 0)

    const tabsPinned = scrollTop > 120
    if (tabsPinned !== this.data.tabsPinned) {
      this.setData({
        tabsPinned,
      })
    }

    const scrollDelta = scrollTop - lastMallScrollTop
    if (scrollTop <= TAB_BAR_SHOW_TRIGGER_SCROLL_TOP) {
      this.ensureNativeTabBarVisible()
    } else if (scrollDelta >= TAB_BAR_SCROLL_DELTA_THRESHOLD && scrollTop >= TAB_BAR_HIDE_TRIGGER_SCROLL_TOP) {
      this.ensureNativeTabBarHidden()
    } else if (scrollDelta <= -TAB_BAR_SCROLL_DELTA_THRESHOLD) {
      this.ensureNativeTabBarVisible()
    }

    lastMallScrollTop = scrollTop

    if (this.data.mineMenuVisible) {
      this.hideMineMenu(true)
    }
  },

  clearMineMenuCloseTimer() {
    if (mineMenuCloseTimer) {
      clearTimeout(mineMenuCloseTimer)
      mineMenuCloseTimer = null
    }
  },

  showMineMenu() {
    this.clearMineMenuCloseTimer()

    if (!this.data.mineMenuVisible) {
      this.setData({
        mineMenuVisible: true,
        mineMenuOpen: false,
      })

      setTimeout(() => {
        this.setData({
          mineMenuOpen: true,
        })
      }, 16)
      return
    }

    this.setData({
      mineMenuOpen: true,
    })
  },

  hideMineMenu(immediate = false) {
    this.clearMineMenuCloseTimer()

    if (!this.data.mineMenuVisible) {
      return
    }

    if (immediate) {
      this.setData({
        mineMenuOpen: false,
        mineMenuVisible: false,
      })
      return
    }

    this.setData({
      mineMenuOpen: false,
    })

    mineMenuCloseTimer = setTimeout(() => {
      this.setData({
        mineMenuVisible: false,
      })
      mineMenuCloseTimer = null
    }, 180)
  },

  ensureNativeTabBarVisible(animated = true) {
    if (nativeTabBarVisible && !this.data.hideNativeTabBar) {
      return
    }

    wx.showTabBar({
      animation: animated,
      fail: () => {},
    })
    nativeTabBarVisible = true

    if (this.data.hideNativeTabBar) {
      this.setData({
        hideNativeTabBar: false,
      })
    }
  },

  ensureNativeTabBarHidden(animated = true) {
    if (!nativeTabBarVisible && this.data.hideNativeTabBar) {
      return
    }

    wx.hideTabBar({
      animation: animated,
      fail: () => {},
    })
    nativeTabBarVisible = false

    if (!this.data.hideNativeTabBar) {
      this.setData({
        hideNativeTabBar: true,
      })
    }
  },

  async loadMallHome(activeCategoryId?: string, silent = false) {
    const requestedCategoryId = activeCategoryId || this.data.activeCategoryId || 'all'
    const session = getStoredSession()
    const fallbackStoreId = String(this.data.mallStoreId || getStoredMallStoreId() || '').trim()

    if (!silent) {
      this.setData({
        loading: true,
        loadingText: '商城加载中...',
      })
    }

    try {
      const requestStoreId = await resolveMallRequestStoreId(fallbackStoreId)
      const [configResponse, categoriesResponse, productsResponse] = await Promise.all([
        fetchMallConfig(requestStoreId),
        fetchMallCategories(requestStoreId),
        fetchMallProducts({
          storeId: requestStoreId,
          sessionToken: session ? session.sessionToken : '',
        }),
      ])
      const config = configResponse.data
      const rawCategories = Array.isArray(categoriesResponse.data.items) ? categoriesResponse.data.items : []
      const rawProducts = Array.isArray(productsResponse.data.items) ? productsResponse.data.items : []
      const categoryIds = rawCategories.map((item) => item.id)
      const nextActiveCategoryId =
        requestedCategoryId === 'all' || categoryIds.indexOf(requestedCategoryId) < 0 ? 'all' : requestedCategoryId
      const cartPayload = await this.loadCartPayload(
        session ? session.sessionToken : '',
        rawProducts.map((item) => buildProductView(item, {})),
      )
      const cartCountMap = buildCartCountMap(cartPayload.items)
      const allProductViews = rawProducts.map((item) => buildProductView(item, cartCountMap))
      const visibleProductViews = filterProductViewsByCategory(allProductViews, nextActiveCategoryId)
      const memberSpotlight = buildMallMemberSpotlightView(allProductViews)
      const storeName = config.storeName || categoriesResponse.data.storeName || productsResponse.data.storeName || '商城'
      const mallStoreId = config.storeId || categoriesResponse.data.storeId || productsResponse.data.storeId || requestStoreId || ''
      const emptyState = buildMallEmptyState(storeName, rawCategories.length > 0 || rawProducts.length > 0)
      const nextMallCoupons =
        session && mallStoreId && mallStoreId === this.data.mallStoreId ? this.data.mallCoupons : ([] as MallCouponApiItem[])
      const nextCartCouponSelectionMode =
        session && mallStoreId && mallStoreId === this.data.mallStoreId ? this.data.cartCouponSelectionMode : 'AUTO'
      const nextCartSelectedCouponCode =
        nextCartCouponSelectionMode === 'MANUAL' ? this.data.cartSelectedCouponCode : ''
      const cartCouponSummary = buildMallCouponSummary({
        coupons: nextMallCoupons,
        orderAmount: cartPayload.totalAmount,
        loggedIn: Boolean(session),
        loginHintText: '登录后下单可自动匹配或手动切换优惠券',
        emptyHintText: '当前订单暂无可用优惠券',
        selectionMode: nextCartCouponSelectionMode,
        preferredCouponCode: nextCartSelectedCouponCode,
      })
      const cartItemViews = cartPayload.items.map(buildCartItemView)
      const cartPricingSummary = buildCartPricingSummary(cartItemViews, cartCouponSummary)
      mallCatalog = allProductViews
      saveMallStoreId(mallStoreId)

      const nextCartVisible = cartPayload.cartCount > 0 ? this.data.cartVisible : false

      this.setData(
        {
          storeName,
          heroSlides: buildMallHeroSlides(storeName, rawProducts),
          mallStoreId,
          categories: buildCategoryViews(rawCategories),
          activeCategoryId: nextActiveCategoryId,
          products: visibleProductViews,
          loading: false,
          cartCount: cartPayload.cartCount,
          cartAmountText: formatPrice(cartPayload.totalAmount),
          cartItems: cartItemViews,
          memberSpotlight,
          mallCoupons: nextMallCoupons,
          couponLoading: Boolean(session && mallStoreId),
          cartSelectedCouponCode:
            cartCouponSummary && cartCouponSummary.selectionMode === 'MANUAL' ? cartCouponSummary.couponCode : '',
          cartCouponSelectionMode: cartCouponSummary ? cartCouponSummary.selectionMode : 'AUTO',
          cartCouponSummary,
          cartPricingSummary,
          cartVisible: nextCartVisible,
          emptyStateTitle: emptyState.title,
          emptyStateSubtitle: emptyState.subtitle,
        },
        () => {
          if (nextCartVisible && (!session || nextMallCoupons.length > 0)) {
            this.trackCartCouponAnalytics(cartCouponSummary, 'cart_coupon_resume', cartItemViews, cartPayload.cartCount)
          }
        },
      )

      if (session && mallStoreId) {
        void this.loadMallCoupons(mallStoreId)
      }

      visibleProductViews.forEach((product, index) => {
        if (product.memberBenefitType === 'NONE') {
          return
        }

        void trackMallAnalyticsEvent({
          storeId: mallStoreId,
          mallEventType: 'MEMBER_PRODUCT_IMPRESSION',
          mallPage: 'store_home',
          mallSource: 'product_list',
          targetType: 'POST',
          targetId: product.id,
          properties: {
            productId: product.id,
            title: product.title,
            categoryId: product.categoryId,
            categoryName: product.categoryName,
            position: index + 1,
            memberBenefitType: product.memberBenefitType,
            memberBenefitLabel: product.memberBenefitLabel,
            membershipActive: product.membershipActive,
            canPurchase: product.canPurchase,
          },
        })
      })

      if (mallHomeViewPending) {
        mallHomeViewPending = false
        void trackMallAnalyticsEvent({
          storeId: mallStoreId,
          mallEventType: 'HOME_VIEW',
          mallPage: 'store_home',
          mallSource: silent ? 'on_show' : 'initial_load',
          targetType: 'GROUP',
          targetId: mallStoreId,
          properties: {
            storeName,
            activeCategoryId: nextActiveCategoryId,
            categoryCount: rawCategories.length,
            productCount: rawProducts.length,
            cartCount: cartPayload.cartCount,
          },
        })
      }
    } catch (error) {
      if (silent && (this.data.products.length > 0 || this.data.categories.length > 0 || !!this.data.mallStoreId)) {
        return
      }

      const failureState = buildMallLoadFailureState(error)
      mallCatalog = []

      this.setData({
        storeName: '商城',
        heroSlides: buildMallHeroSlides('商城', []),
        mallStoreId: fallbackStoreId,
        categories: [],
        activeCategoryId: 'all',
        products: [],
        loading: false,
        cartCount: 0,
        cartAmountText: formatPrice(0),
        cartItems: [],
        memberSpotlight: null,
        mallCoupons: [],
        couponLoading: false,
        cartSelectedCouponCode: '',
        cartCouponSelectionMode: 'AUTO',
        cartCouponSummary: null,
        cartPricingSummary: null,
        cartVisible: false,
        emptyStateTitle: failureState.title,
        emptyStateSubtitle: failureState.subtitle,
      })

      if (!silent) {
        this.handleActionError(error, failureState.title)
      }
    }
  },

  async loadCartPayload(sessionToken: string, catalogProducts: MallProductView[] = []) {
    if (!sessionToken) {
      return buildGuestCartPayload(catalogProducts)
    }

    try {
      try {
        await syncGuestMallCartToSession(sessionToken)
      } catch (error) {
        if (shouldClearSessionByError(error)) {
          clearSession()
          return buildGuestCartPayload(catalogProducts)
        }

        wx.showToast({
          title: error instanceof Error ? error.message : '登录前购物车同步失败',
          icon: 'none',
        })
      }

      const cartResponse = await fetchMallCart(sessionToken)
      return cartResponse.data
    } catch (error) {
      if (shouldClearSessionByError(error)) {
        clearSession()
      }
      return buildGuestCartPayload(catalogProducts)
    }
  },

  applyCartPayload(cartPayload: MallCartPayload) {
    const cartCountMap = buildCartCountMap(cartPayload.items)
    const cartItemViews = cartPayload.items.map(buildCartItemView)
    const orderAmount = cartPayload.totalAmount
    const cartCouponSummary = buildMallCouponSummary({
      coupons: this.data.mallCoupons,
      orderAmount,
      loggedIn: Boolean(getStoredSession()),
      loginHintText: '登录后下单可自动匹配或手动切换优惠券',
      emptyHintText: '当前订单暂无可用优惠券',
      selectionMode: this.data.cartCouponSelectionMode,
      preferredCouponCode: this.data.cartSelectedCouponCode,
    })
    const cartPricingSummary = buildCartPricingSummary(cartItemViews, cartCouponSummary)
    const nextCartVisible = cartPayload.cartCount > 0 ? this.data.cartVisible : false
    const keepCartCouponPopupVisible = Boolean(
      nextCartVisible &&
        this.data.cartCouponPopupVisible &&
        cartCouponSummary &&
        !cartCouponSummary.loginRequired &&
        Number(cartCouponSummary.availableCount || 0) > 0,
    )
    const nextCartCouponSelectionMode = cartCouponSummary ? cartCouponSummary.selectionMode : 'AUTO'
    const nextCartSelectedCouponCode =
      cartCouponSummary && cartCouponSummary.selectionMode === 'MANUAL' ? cartCouponSummary.couponCode : ''

    this.setData(
      {
        cartCount: cartPayload.cartCount,
        cartAmountText: formatPrice(cartPayload.totalAmount),
        cartItems: cartItemViews,
        cartSelectedCouponCode: nextCartSelectedCouponCode,
        cartCouponSelectionMode: nextCartCouponSelectionMode,
        cartCouponSummary,
        cartCouponPopupVisible: keepCartCouponPopupVisible,
        cartCouponPopupOptions: keepCartCouponPopupVisible
          ? buildMallCouponSelectorOptions({
              coupons: this.data.mallCoupons,
              orderAmount,
              currentCouponCode: nextCartSelectedCouponCode,
              selectionMode: nextCartCouponSelectionMode,
            })
          : [],
        cartPricingSummary,
        cartVisible: nextCartVisible,
        products: this.data.products.map((item) => ({
          ...item,
          cartCount: Number(cartCountMap[item.id] || 0),
        })),
      },
      () => {
        if (nextCartVisible) {
          this.trackCartCouponAnalytics(cartCouponSummary, 'cart_coupon_cart_change', cartItemViews, cartPayload.cartCount)
        }
      },
    )
  },

  refreshCartCouponSummary(coupons?: MallCouponApiItem[], mallSource = 'cart_coupon_refresh') {
    const nextCoupons = Array.isArray(coupons) ? coupons : this.data.mallCoupons
    const orderAmount = getCartTotalAmountFromViewItems(this.data.cartItems)
    const cartCouponSummary = buildMallCouponSummary({
      coupons: nextCoupons,
      orderAmount,
      loggedIn: Boolean(getStoredSession()),
      loginHintText: '登录后下单可自动匹配或手动切换优惠券',
      emptyHintText: '当前订单暂无可用优惠券',
      selectionMode: this.data.cartCouponSelectionMode,
      preferredCouponCode: this.data.cartSelectedCouponCode,
    })
    const cartPricingSummary = buildCartPricingSummary(this.data.cartItems, cartCouponSummary)
    const keepCartCouponPopupVisible = Boolean(
      this.data.cartCouponPopupVisible &&
        cartCouponSummary &&
        !cartCouponSummary.loginRequired &&
        Number(cartCouponSummary.availableCount || 0) > 0,
    )
    const nextCartCouponSelectionMode = cartCouponSummary ? cartCouponSummary.selectionMode : 'AUTO'
    const nextCartSelectedCouponCode =
      cartCouponSummary && cartCouponSummary.selectionMode === 'MANUAL' ? cartCouponSummary.couponCode : ''

    this.setData(
      {
        cartSelectedCouponCode: nextCartSelectedCouponCode,
        cartCouponSelectionMode: nextCartCouponSelectionMode,
        cartCouponSummary,
        cartCouponPopupVisible: keepCartCouponPopupVisible,
        cartCouponPopupOptions: keepCartCouponPopupVisible
          ? buildMallCouponSelectorOptions({
              coupons: nextCoupons,
              orderAmount,
              currentCouponCode: nextCartSelectedCouponCode,
              selectionMode: nextCartCouponSelectionMode,
            })
          : [],
        cartPricingSummary,
      },
      () => {
        if (this.data.cartVisible) {
          this.trackCartCouponAnalytics(cartCouponSummary, mallSource)
        }
      },
    )
  },

  async loadMallCoupons(storeId: string, showErrorToast = false) {
    const session = getStoredSession()
    const normalizedStoreId = String(storeId || '').trim()
    if (!session || !normalizedStoreId) {
      this.setData({
        mallCoupons: [],
        couponLoading: false,
      })
      this.refreshCartCouponSummary([])
      return []
    }

    this.setData({
      couponLoading: true,
    })

    try {
      const response = await fetchMallCoupons({
        storeId: normalizedStoreId,
        sessionToken: session.sessionToken,
      })
      const couponItems = Array.isArray(response.data.items) ? response.data.items : []

      this.setData({
        mallCoupons: couponItems,
        couponLoading: false,
      })
      this.refreshCartCouponSummary(couponItems)
      return couponItems
    } catch (error) {
      if (shouldClearSessionByError(error)) {
        clearSession()
      } else if (showErrorToast) {
        wx.showToast({
          title: normalizeMallUserFacingErrorMessage(error, '优惠券加载失败'),
          icon: 'none',
        })
      }

      this.setData({
        mallCoupons: [],
        couponLoading: false,
      })
      this.refreshCartCouponSummary([])
      return []
    }
  },

  onSelectCartCoupon() {
    const session = getStoredSession()
    const summary = this.data.cartCouponSummary
    const coupons = Array.isArray(this.data.mallCoupons) ? this.data.mallCoupons : []

    if (!session || !summary || summary.loginRequired) {
      this.promptLogin()
      return
    }

    if (this.data.couponLoading) {
      wx.showToast({
        title: '优惠券加载中',
        icon: 'none',
      })
      return
    }

    if (!coupons.length) {
      wx.showToast({
        title: '当前暂无可选优惠券',
        icon: 'none',
      })
      return
    }

    const orderAmount = Number(summary.orderAmount || getCartTotalAmountFromViewItems(this.data.cartItems))
    this.setData({
      cartCouponPopupVisible: true,
      cartCouponPopupOptions: buildMallCouponSelectorOptions({
        coupons,
        orderAmount,
        currentCouponCode: summary.selectionMode === 'MANUAL' ? summary.couponCode : '',
        selectionMode: summary.selectionMode,
      }),
    })
  },

  onCloseCartCouponPopup() {
    if (!this.data.cartCouponPopupVisible) {
      return
    }

    this.setData({
      cartCouponPopupVisible: false,
      cartCouponPopupOptions: [],
    })
  },

  onSelectCartCouponOption(
    event: WechatMiniprogram.CustomEvent<{
      selectionMode?: string
      couponCode?: string
    }>,
  ) {
    const detail = event.detail || {}
    const selectionMode =
      detail.selectionMode === 'MANUAL' || detail.selectionMode === 'NONE' ? detail.selectionMode : 'AUTO'
    const couponCode = selectionMode === 'MANUAL' ? String(detail.couponCode || '') : ''

    this.setData(
      {
        cartCouponPopupVisible: false,
        cartCouponPopupOptions: [],
        cartCouponSelectionMode: selectionMode,
        cartSelectedCouponCode: couponCode,
      },
      () => {
        this.refreshCartCouponSummary(undefined, 'cart_coupon_manual_select')
      },
    )
  },

  promptLogin() {
    wx.showModal({
      title: '请先登录',
      content: '下单需要登录后才能继续，登录成功后会回到商城继续购买。',
      confirmText: '去登录',
      success: ({ confirm }) => {
        if (confirm) {
          savePendingLoginRedirect('/pages/store/index')
          wx.navigateTo({
            url: buildMallLoginUrl(),
          })
        }
      },
    })
  },

  onOpenOrders() {
    const session = getStoredSession()
    if (!session) {
      wx.showModal({
        title: '请先登录',
        content: '登录后才能查看你在商城里提交过的订单。',
        confirmText: '去登录',
        success: ({ confirm }) => {
          if (confirm) {
            savePendingLoginRedirect(buildMallOrdersUrl())
            wx.navigateTo({
              url: `/pages/auth/login?redirect=${encodeURIComponent(buildMallOrdersUrl())}`,
            })
          }
        },
      })
      return
    }

    wx.navigateTo({
      url: buildMallOrdersUrl(),
    })
  },

  requireSession() {
    const session = getStoredSession()
    if (session) {
      return session
    }

    this.promptLogin()

    return null
  },

  getMemberCatalogProducts() {
    const sourceProducts = mallCatalog.length ? mallCatalog : this.data.products
    return sourceProducts.filter((product) => product.memberBenefitType !== 'NONE')
  },

  openMemberZone(mallSource = 'member_entry', entryTitle = '会员专享', keyword = '会员') {
    const memberProducts = this.getMemberCatalogProducts()
    const memberSummary = buildMemberProductAnalyticsSummary(
      memberProducts.map((product) => ({
        productId: product.id,
        memberBenefitType: product.memberBenefitType,
        membershipActive: product.membershipActive,
      })),
    )

    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'MEMBER_ENTRANCE_CLICK',
      mallPage: 'store_home',
      mallSource,
      targetType: 'GROUP',
      targetId: this.data.mallStoreId,
      keyword: keyword || '会员',
      properties: {
        entryTitle,
        keyword: keyword || '会员',
        activeCategoryId: this.data.activeCategoryId,
        ...memberSummary,
      },
    })

    wx.navigateTo({
      url: buildMallMemberZonePath(this.data.mallStoreId, mallSource),
    })
  },

  openMallMembershipPage(
    mallSource = 'member_open_membership',
    product?: {
      id?: string
      productId?: string
      title?: string
      memberBenefitType?: MallMemberBenefitType
      memberBenefitLabel?: string
      membershipActive?: boolean
      canPurchase?: boolean
    } | null,
  ) {
    const memberProducts = this.getMemberCatalogProducts()
    const memberSummary = buildMemberProductAnalyticsSummary(
      memberProducts.map((item) => ({
        productId: item.id,
        memberBenefitType: item.memberBenefitType,
        membershipActive: item.membershipActive,
      })),
    )
    const productId = String((product && (product.id || product.productId)) || '').trim()
    const productTitle =
      String((product && product.title) || '').trim() ||
      (this.data.storeName ? `${this.data.storeName}会员权益商品` : '会员权益商品')

    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'MEMBER_OPEN_MEMBERSHIP_CLICK',
      mallPage: 'store_home',
      mallSource,
      targetType: productId ? 'POST' : 'GROUP',
      targetId: productId || this.data.mallStoreId,
      properties: {
        productId,
        productTitle,
        activeCategoryId: this.data.activeCategoryId,
        memberBenefitType: product ? product.memberBenefitType || 'NONE' : 'NONE',
        memberBenefitLabel: product ? product.memberBenefitLabel || '' : '',
        canPurchase: product ? product.canPurchase !== false : true,
        ...memberSummary,
      },
    })

    wx.navigateTo({
      url: buildMallMembershipEntryUrl({
        storeId: this.data.mallStoreId,
        storeName: this.data.storeName,
        source: mallSource,
        productId,
        productTitle,
      }),
    })
  },

  showMemberExclusiveInterceptModal(
    product?: {
      id?: string
      productId?: string
      title?: string
      memberBenefitType?: MallMemberBenefitType
      memberBenefitLabel?: string
      membershipActive?: boolean
      canPurchase?: boolean
    } | null,
    mallSource = 'member_exclusive_intercept',
    content = '',
  ) {
    const productId = String((product && (product.id || product.productId)) || '').trim()
    const productTitle = String((product && product.title) || '').trim() || '会员专享商品'

    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'MEMBER_EXCLUSIVE_INTERCEPT',
      mallPage: 'store_home',
      mallSource,
      targetType: productId ? 'POST' : 'GROUP',
      targetId: productId || this.data.mallStoreId,
      properties: {
        productId,
        title: productTitle,
        memberBenefitType: product ? product.memberBenefitType || 'MEMBER_EXCLUSIVE' : 'MEMBER_EXCLUSIVE',
        memberBenefitLabel: product ? product.memberBenefitLabel || '' : '',
        membershipActive: product ? Boolean(product.membershipActive) : false,
        canPurchase: product ? product.canPurchase !== false : false,
      },
    })

    wx.showModal({
      title: '会员专享商品',
      content: content || `商品“${productTitle}”仅会员可购买，先开会员后再回来下单。`,
      confirmText: '去开会员',
      cancelText: '看权益',
      success: ({ confirm, cancel }) => {
        if (confirm) {
          this.openMallMembershipPage(`${mallSource}_membership`, product)
          return
        }

        if (cancel) {
          this.openMemberZone(`${mallSource}_browse`, '会员专享', '会员')
        }
      },
    })
  },

  trackCartCouponAnalytics(
    summary: MallCouponSummaryView | null,
    mallSource = 'cart_coupon_card',
    cartItems?: MallCartItemView[],
    cartCount?: number,
  ) {
    if (!summary || Number(summary.orderAmount || 0) <= 0) {
      return
    }

    const safeCartItems = Array.isArray(cartItems) ? cartItems : this.data.cartItems
    const safeCartCount = typeof cartCount === 'number' ? cartCount : this.data.cartCount
    const productIds = safeCartItems.map((item) => item.productId).filter(Boolean)
    const couponSummary = buildMallCouponAnalyticsSummary(summary)
    const couponProperties = {
      ...buildMallPricingAnalyticsSummary(this.data.cartPricingSummary),
      ...couponSummary,
      cartCount: safeCartCount,
      productIds,
    }
    const dedupExtraKey = `${safeCartCount}:${productIds.slice().sort().join(',')}`
    const impressionKey = buildMallCouponAnalyticsDedupKey({
      mallPage: 'store_home',
      mallSource,
      targetId: this.data.mallStoreId,
      summary,
      extraKey: dedupExtraKey,
    })

    if (impressionKey !== lastCartCouponImpressionKey) {
      lastCartCouponImpressionKey = impressionKey
      void trackMallAnalyticsEvent({
        storeId: this.data.mallStoreId,
        mallEventType: 'COUPON_IMPRESSION',
        mallPage: 'store_home',
        mallSource,
        targetType: 'GROUP',
        targetId: this.data.mallStoreId,
        eventDedupKey: impressionKey,
        properties: couponProperties,
      })
    }

    if (!hasAutoAppliedMallCoupon(summary)) {
      return
    }

    const autoApplyKey = `${impressionKey}:auto_apply`
    if (autoApplyKey === lastCartCouponAutoApplyKey) {
      return
    }

    lastCartCouponAutoApplyKey = autoApplyKey
    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'COUPON_AUTO_APPLY',
      mallPage: 'store_home',
      mallSource,
      targetType: 'GROUP',
      targetId: this.data.mallStoreId,
      eventDedupKey: autoApplyKey,
      properties: couponProperties,
    })
  },

  handleActionError(error: unknown, fallbackMessage: string) {
    if (shouldClearSessionByError(error)) {
      clearSession()
      wx.showModal({
        title: '登录已失效',
        content: '请重新登录后再继续操作商城。',
        confirmText: '去登录',
        success: ({ confirm }) => {
          if (confirm) {
            savePendingLoginRedirect('/pages/store/index')
            wx.navigateTo({
              url: buildMallLoginUrl(),
            })
          }
        },
      })
      return
    }

    wx.showToast({
      title: normalizeMallUserFacingErrorMessage(error, fallbackMessage),
      icon: 'none',
    })
  },

  openOrderResultModal(orderId: string, title: string, content: string) {
    wx.showModal({
      title,
      content,
      confirmText: '查看订单',
      cancelText: '继续逛逛',
      success: ({ confirm }) => {
        if (confirm) {
          wx.navigateTo({
            url: buildMallOrderDetailUrl(orderId),
          })
        }
      },
    })
  },

  async handleCreatedOrderPayment(
    order: MallOrderApiItem,
    payment: MallOrderPaymentApiItem,
    analyticsProperties: Record<string, unknown> = {},
  ) {
    const session = getStoredSession()
    const orderAmountText = formatPrice(order.payableAmount || order.totalAmount)

    if (payment.required && payment.request && session) {
      void trackMallAnalyticsEvent({
        storeId: this.data.mallStoreId,
        mallEventType: 'PAYMENT_START',
        mallPage: 'store_home',
        mallSource: 'cart_checkout',
        targetType: 'ORDER',
        targetId: order.id,
        eventDedupKey: `${order.id}:payment_start`,
        properties: {
          ...analyticsProperties,
          orderId: order.id,
          orderNo: order.orderNo,
          payableAmount: order.payableAmount || order.totalAmount,
        },
      })

      try {
        await requestMallWechatPayment(payment.request)
      } catch (error) {
        if (isMallPaymentCancelled(error)) {
          void trackMallAnalyticsEvent({
            storeId: this.data.mallStoreId,
            mallEventType: 'PAYMENT_CANCEL',
            mallPage: 'store_home',
            mallSource: 'cart_checkout',
            targetType: 'ORDER',
            targetId: order.id,
            eventDedupKey: `${order.id}:payment_cancel`,
            properties: {
              ...analyticsProperties,
              orderId: order.id,
              orderNo: order.orderNo,
            },
          })
          this.openOrderResultModal(
            order.id,
            '订单待支付',
            `订单号 ${order.orderNo} 已创建，合计 ${orderAmountText}。你刚刚取消了支付，可以稍后在订单详情继续支付。`,
          )
          return
        }

        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType: 'PAYMENT_FAILURE',
          mallPage: 'store_home',
          mallSource: 'cart_checkout',
          targetType: 'ORDER',
          targetId: order.id,
          eventDedupKey: `${order.id}:payment_failure`,
          properties: {
            ...analyticsProperties,
            orderId: order.id,
            orderNo: order.orderNo,
            errorMessage: error instanceof Error ? error.message : '支付请求失败',
          },
        })
        this.openOrderResultModal(
          order.id,
          '支付未完成',
          `订单号 ${order.orderNo} 已创建，但微信支付没有完成。你可以稍后在订单详情继续支付。`,
        )
        return
      }

      wx.showLoading({
        title: '确认支付结果',
        mask: true,
      })

      let latestOrder: MallOrderApiItem | null = null

      try {
        latestOrder = await pollMallOrderPaymentResult({
          sessionToken: session.sessionToken,
          orderId: order.id,
        })
      } finally {
        wx.hideLoading()
      }

      if (latestOrder && latestOrder.status === 'PAID') {
        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType: 'PAYMENT_SUCCESS',
          mallPage: 'store_home',
          mallSource: 'cart_checkout',
          targetType: 'ORDER',
          targetId: latestOrder.id,
          eventDedupKey: `${latestOrder.id}:payment_success`,
          properties: {
            ...analyticsProperties,
            orderId: latestOrder.id,
            orderNo: latestOrder.orderNo,
            payableAmount: latestOrder.payableAmount || latestOrder.totalAmount,
          },
        })
        this.openOrderResultModal(
          latestOrder.id,
          '支付成功',
          `订单号 ${latestOrder.orderNo} 已支付成功，商家发货后会在订单详情同步物流信息。`,
        )
        return
      }

      if (latestOrder && latestOrder.status === 'CLOSED') {
        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType: 'PAYMENT_FAILURE',
          mallPage: 'store_home',
          mallSource: 'cart_checkout',
          targetType: 'ORDER',
          targetId: latestOrder.id,
          eventDedupKey: `${latestOrder.id}:payment_failure`,
          properties: {
            ...analyticsProperties,
            orderId: latestOrder.id,
            orderNo: latestOrder.orderNo,
            finalStatus: latestOrder.status,
          },
        })
        this.openOrderResultModal(
          latestOrder.id,
          '订单已关闭',
          `订单号 ${latestOrder.orderNo} 当前已关闭，请联系商家确认后再重新下单。`,
        )
        return
      }

      this.openOrderResultModal(
        order.id,
        '订单待支付',
        `订单号 ${order.orderNo} 已创建，支付结果还在确认中。你可以到订单详情继续查看或再次支付。`,
      )
      return
    }

    if (payment.required) {
      const errorMessage = payment.errorMessage || '暂时未获取到支付参数'
      void trackMallAnalyticsEvent({
        storeId: this.data.mallStoreId,
        mallEventType: 'PAYMENT_FAILURE',
        mallPage: 'store_home',
        mallSource: 'cart_checkout',
        targetType: 'ORDER',
        targetId: order.id,
        eventDedupKey: `${order.id}:payment_failure`,
        properties: {
          ...analyticsProperties,
          orderId: order.id,
          orderNo: order.orderNo,
          errorMessage,
        },
      })
      this.openOrderResultModal(
        order.id,
        '订单待支付',
        `订单号 ${order.orderNo} 已创建，合计 ${orderAmountText}。${errorMessage}，你可以稍后在订单详情继续支付。`,
      )
      return
    }

    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'PAYMENT_SUCCESS',
      mallPage: 'store_home',
      mallSource: 'cart_checkout',
      targetType: 'ORDER',
      targetId: order.id,
      eventDedupKey: `${order.id}:payment_success`,
      properties: {
        ...analyticsProperties,
        orderId: order.id,
        orderNo: order.orderNo,
        payableAmount: order.payableAmount || order.totalAmount,
        paymentRequired: false,
      },
    })

    this.openOrderResultModal(
      order.id,
      '订单已提交',
      `订单号 ${order.orderNo} 已创建，合计 ${orderAmountText}。接下来可以直接查看这笔订单。`,
    )
  },

  async loadShippingAddress(showErrorToast = false) {
    const session = getStoredSession()
    if (!session) {
      this.setData({
        shippingAddressItems: [],
        shippingAddresses: [],
        shippingAddress: null,
        selectedAddressId: '',
        addressLoading: false,
        addressLoginRequired: true,
        addressPickerVisible: false,
      })
      return null
    }

    this.setData({
      addressLoading: true,
      addressLoginRequired: false,
    })

    try {
      const response = await fetchMallShippingAddress(session.sessionToken)

      this.applyAddressCollection(response.data)
      this.setData({
        addressLoading: false,
      })

      return response.data
    } catch (error) {
      this.setData({
        shippingAddressItems: [],
        shippingAddresses: [],
        shippingAddress: null,
        selectedAddressId: '',
        addressLoading: false,
        addressLoginRequired: !getStoredSession(),
        addressPickerVisible: false,
      })

      if (showErrorToast) {
        this.handleActionError(error, '收货地址加载失败')
      } else if (shouldClearSessionByError(error)) {
        clearSession()
        this.setData({
          addressLoginRequired: true,
        })
      }

      return null
    }
  },

  applyAddressCollection(
    payload: {
      item: MallShippingAddressApiItem | null
      defaultItem: MallShippingAddressApiItem | null
      selectedItem?: MallShippingAddressApiItem | null
      savedItem?: MallShippingAddressApiItem | null
      items: MallShippingAddressApiItem[]
    },
    preferredAddressId = '',
  ) {
    const items = Array.isArray(payload.items) ? payload.items : []
    const shippingAddresses = buildMallShippingAddressViews(items)
    const nextSelectedId =
      preferredAddressId ||
      String((payload.selectedItem && payload.selectedItem.id) || '') ||
      String((payload.savedItem && payload.savedItem.id) || '') ||
      String(this.data.selectedAddressId || '') ||
      String((payload.defaultItem && payload.defaultItem.id) || '') ||
      String((items[0] && items[0].id) || '')

    const selectedAddress =
      items.find((item) => item.id === nextSelectedId) ||
      payload.selectedItem ||
      payload.savedItem ||
      payload.defaultItem ||
      null

    this.setData({
      shippingAddressItems: items,
      shippingAddresses,
      shippingAddress: buildMallShippingAddressView(selectedAddress),
      selectedAddressId: selectedAddress ? String(selectedAddress.id || '') : '',
      addressLoginRequired: false,
    })
  },

  buildGuestCartPayloadFromCatalog() {
    return buildGuestCartPayload(mallCatalog)
  },

  updateGuestCart(productId: string, nextQuantity: number) {
    const product = mallCatalog.find((item) => item.id === productId)
    if (!product) {
      wx.showToast({
        title: '商品数据还没准备好',
        icon: 'none',
      })
      return null
    }

    if (nextQuantity > product.stock) {
      wx.showToast({
        title: `库存不足，当前仅剩 ${product.stock} 件`,
        icon: 'none',
      })
      return null
    }

    const quantities = loadGuestMallCartQuantities()
    if (nextQuantity > 0) {
      quantities[productId] = nextQuantity
    } else {
      delete quantities[productId]
    }

    saveGuestMallCartQuantities(quantities)
    return this.buildGuestCartPayloadFromCatalog()
  },

  onOpenMemberZone() {
    this.hideMineMenu(true)
    this.openMemberZone('member_spotlight', '会员专享入口', '会员')
  },

  onOpenMembershipFromHome() {
    this.hideMineMenu(true)
    const memberProduct = this.getMemberCatalogProducts()[0] || null
    this.openMallMembershipPage('member_spotlight_open_membership', memberProduct)
  },

  onSearchTap() {
    this.hideMineMenu(true)
    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'SEARCH_ENTRY_CLICK',
      mallPage: 'store_home',
      mallSource: 'search_bar',
      targetType: 'GROUP',
      targetId: this.data.mallStoreId,
      properties: {
        activeCategoryId: this.data.activeCategoryId,
      },
    })
    wx.navigateTo({
      url: buildMallSearchPath('', this.data.mallStoreId, 'search_bar'),
    })
  },

  onHeroSlideTap(event: WechatMiniprogram.BaseEvent) {
    this.hideMineMenu(true)
    const action = String(event.currentTarget.dataset.action || '') as MallHeroSlideAction
    const productId = String(event.currentTarget.dataset.productId || '')
    const matchedSlide = this.data.heroSlides.find((item) => item.action === action && item.productId === productId) || null

    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'HERO_CLICK',
      mallPage: 'store_home',
      mallSource: action,
      targetType: productId ? 'POST' : 'GROUP',
      targetId: productId || this.data.mallStoreId,
      properties: {
        action,
        productId,
        title: matchedSlide ? matchedSlide.title : '',
      },
    })

    if (action === 'product' && productId) {
      this.openProductDetail(productId, 'hero')
    }
  },

  onSelectCategory(event: WechatMiniprogram.BaseEvent) {
    this.hideMineMenu(true)
    const categoryId = String(event.currentTarget.dataset.id || '')
    if (!categoryId || categoryId === this.data.activeCategoryId) {
      return
    }

    this.loadMallHome(categoryId)
  },

  openProductDetail(productId: string, mallSource = 'product_list') {
    if (!productId) {
      return
    }

    try {
      const selectedProduct =
        mallCatalog.find((item) => item.id === productId) || this.data.products.find((item) => item.id === productId) || null
      if (selectedProduct) {
        const memberSummary = buildMemberProductAnalyticsSummary([
          {
            productId,
            memberBenefitType: selectedProduct.memberBenefitType,
            membershipActive: selectedProduct.membershipActive,
          },
        ])

        wx.setStorageSync(PRODUCT_PREVIEW_STORAGE_KEY, selectedProduct)
        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType: 'PRODUCT_CLICK',
          mallPage: 'store_home',
          mallSource,
          targetType: 'POST',
          targetId: productId,
          properties: {
            productId,
            title: selectedProduct.title,
            categoryId: selectedProduct.categoryId,
            categoryName: selectedProduct.categoryName,
            price: selectedProduct.price,
            memberBenefitType: selectedProduct.memberBenefitType,
            memberBenefitLabel: selectedProduct.memberBenefitLabel,
            memberPromptText: selectedProduct.memberPromptText,
            canPurchase: selectedProduct.canPurchase,
            ...memberSummary,
          },
        })
      } else {
        void trackMallAnalyticsEvent({
          storeId: this.data.mallStoreId,
          mallEventType: 'PRODUCT_CLICK',
          mallPage: 'store_home',
          mallSource,
          targetType: 'POST',
          targetId: productId,
          properties: {
            productId,
          },
        })
      }
    } catch {}

    wx.navigateTo({
      url: buildStoreDetailPath(productId, getMallShareTokenForProduct(productId)),
    })
  },

  onOpenProduct(event: WechatMiniprogram.BaseEvent) {
    this.hideMineMenu(true)
    const productId = String(event.currentTarget.dataset.id || '')
    if (!productId) {
      return
    }
    this.openProductDetail(productId, 'product_list')
  },

  async addToCart(productId: string, quantity: number) {
    const product = mallCatalog.find((item) => item.id === productId) || this.data.products.find((item) => item.id === productId) || null
    if (product && !product.canPurchase) {
      this.showMemberExclusiveInterceptModal(product, 'product_add_to_cart', product.memberPromptText || '当前商品仅会员可购买')
      return false
    }

    const session = getStoredSession()
    if (!session) {
      const currentQuantity = Number(loadGuestMallCartQuantities()[productId] || 0)
      const guestCartPayload = this.updateGuestCart(productId, currentQuantity + quantity)
      if (!guestCartPayload) {
        return false
      }
      this.applyCartPayload(guestCartPayload)
      return true
    }

    try {
      const cartResponse = await addMallCartItem({
        sessionToken: session.sessionToken,
        productId,
        quantity,
      })
      this.applyCartPayload(cartResponse.data)
      return true
    } catch (error) {
      this.handleActionError(error, '加入购物车失败')
      return false
    }
  },

  async onAddToCart(event: WechatMiniprogram.BaseEvent) {
    const productId = String(event.currentTarget.dataset.id || '')
    if (!productId) {
      return
    }

    const success = await this.addToCart(productId, 1)
    if (!success) {
      return
    }

    const product = mallCatalog.find((item) => item.id === productId) || this.data.products.find((item) => item.id === productId) || null
    const memberSummary = buildMemberProductAnalyticsSummary(
      product
        ? [
            {
              productId,
              memberBenefitType: product.memberBenefitType,
              membershipActive: product.membershipActive,
            },
          ]
        : [],
    )
    void trackMallAnalyticsEvent({
      storeId: this.data.mallStoreId,
      mallEventType: 'ADD_TO_CART',
      mallPage: 'store_home',
      mallSource: 'product_list',
      targetType: 'POST',
      targetId: productId,
      properties: {
        productId,
        quantity: 1,
        title: product ? product.title : '',
        categoryId: product ? product.categoryId : '',
        categoryName: product ? product.categoryName : '',
        memberBenefitType: product ? product.memberBenefitType : 'NONE',
        memberBenefitLabel: product ? product.memberBenefitLabel : '',
        canPurchase: product ? product.canPurchase : true,
        ...memberSummary,
      },
    })

    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
    })
  },

  onToggleCartPanel() {
    this.hideMineMenu(true)
    const nextCartVisible = !this.data.cartVisible
    this.setData(
      {
        cartVisible: nextCartVisible,
        cartCouponPopupVisible: nextCartVisible ? this.data.cartCouponPopupVisible : false,
        cartCouponPopupOptions: nextCartVisible ? this.data.cartCouponPopupOptions : [],
      },
      () => {
        if (nextCartVisible) {
          this.trackCartCouponAnalytics(this.data.cartCouponSummary, 'cart_coupon_panel_open')
        }
      },
    )
  },

  onCloseCartPanel() {
    this.setData({
      cartVisible: false,
      addressPickerVisible: false,
      cartCouponPopupVisible: false,
      cartCouponPopupOptions: [],
    })
  },

  async onIncreaseCartItem(event: WechatMiniprogram.BaseEvent) {
    const productId = String(event.currentTarget.dataset.id || '')
    const currentItem = this.data.cartItems.find((item) => item.productId === productId)
    const session = getStoredSession()

    if (!productId || !currentItem) {
      return
    }

    if (!currentItem.canPurchase) {
      this.showMemberExclusiveInterceptModal(
        {
          productId: currentItem.productId,
          title: currentItem.title,
          memberBenefitType: currentItem.memberBenefitType,
          memberBenefitLabel: currentItem.memberBenefitLabel,
          membershipActive: currentItem.membershipActive,
          canPurchase: currentItem.canPurchase,
        },
        'cart_quantity_increase',
        currentItem.memberPromptText || '当前商品仅会员可购买',
      )
      return
    }

    if (!session) {
      const guestCartPayload = this.updateGuestCart(productId, currentItem.quantity + 1)
      if (guestCartPayload) {
        this.applyCartPayload(guestCartPayload)
      }
      return
    }

    try {
      const response = await updateMallCartItem({
        sessionToken: session.sessionToken,
        productId,
        quantity: currentItem.quantity + 1,
      })
      this.applyCartPayload(response.data)
    } catch (error) {
      this.handleActionError(error, '更新购物车失败')
    }
  },

  async onDecreaseCartItem(event: WechatMiniprogram.BaseEvent) {
    const productId = String(event.currentTarget.dataset.id || '')
    const currentItem = this.data.cartItems.find((item) => item.productId === productId)
    const session = getStoredSession()

    if (!productId || !currentItem) {
      return
    }

    if (!session) {
      const guestCartPayload = this.updateGuestCart(productId, currentItem.quantity - 1)
      if (guestCartPayload) {
        this.applyCartPayload(guestCartPayload)
      }
      return
    }

    try {
      const response =
        currentItem.quantity <= 1
          ? await deleteMallCartItem({
              sessionToken: session.sessionToken,
              productId,
            })
          : await updateMallCartItem({
              sessionToken: session.sessionToken,
              productId,
              quantity: currentItem.quantity - 1,
            })

      this.applyCartPayload(response.data)
    } catch (error) {
      this.handleActionError(error, '更新购物车失败')
    }
  },

  async onClearCart() {
    const session = getStoredSession()
    if (!session) {
      saveGuestMallCartQuantities({})
      const guestCartPayload = this.buildGuestCartPayloadFromCatalog()
      this.applyCartPayload(guestCartPayload)
      this.setData({
        cartVisible: false,
        cartCouponPopupVisible: false,
        cartCouponPopupOptions: [],
      })
      wx.showToast({
        title: '购物车已清空',
        icon: 'none',
      })
      return
    }

    try {
      const response = await clearMallCart(session.sessionToken)
      this.applyCartPayload(response.data)
      this.setData({
        cartVisible: false,
        cartCouponPopupVisible: false,
        cartCouponPopupOptions: [],
      })

      wx.showToast({
        title: '购物车已清空',
        icon: 'none',
      })
    } catch (error) {
      this.handleActionError(error, '清空购物车失败')
    }
  },

  async submitOrder() {
    if (!this.data.cartCount) {
      wx.showToast({
        title: '请先选择商品',
        icon: 'none',
      })
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    const blockedCartItem = this.data.cartItems.find((item) => !item.canPurchase)
    if (blockedCartItem) {
      this.showMemberExclusiveInterceptModal(
        {
          productId: blockedCartItem.productId,
          title: blockedCartItem.title,
          memberBenefitType: blockedCartItem.memberBenefitType,
          memberBenefitLabel: blockedCartItem.memberBenefitLabel,
          membershipActive: blockedCartItem.membershipActive,
          canPurchase: blockedCartItem.canPurchase,
        },
        'cart_checkout',
        `商品“${blockedCartItem.title}”仅会员可购买，请先开通会员，或先把它移出购物车后再下单。`,
      )
      return
    }

    const selectedAddressId = String(this.data.selectedAddressId || '')
    if (!selectedAddressId) {
      wx.showModal({
        title: '请先选择收货地址',
        content: '下单页只负责选择已有地址。请去“我的 - 商城服务 - 收货地址管理”新增地址，或回到这里选择已有地址。',
        confirmText: '去管理',
        success: ({ confirm }) => {
          if (confirm) {
            this.onOpenAddressManager()
          }
        },
      })
      return
    }

    this.setData({
      cartVisible: false,
      addressPickerVisible: false,
      cartCouponPopupVisible: false,
      cartCouponPopupOptions: [],
      submittingOrder: true,
    })

    try {
      const cartMemberSummary = buildMemberProductAnalyticsSummary(
        this.data.cartItems.map((item) => ({
          productId: item.productId,
          memberBenefitType: item.memberBenefitType,
          membershipActive: item.membershipActive,
        })),
      )
      const couponAnalyticsSummary = buildMallCouponAnalyticsSummary(this.data.cartCouponSummary)
      const checkoutAnalyticsProperties = {
        ...buildMallPricingAnalyticsSummary(this.data.cartPricingSummary),
        ...couponAnalyticsSummary,
        couponScenario: 'cart_checkout',
        addressId: selectedAddressId,
        cartCount: this.data.cartCount,
        productIds: this.data.cartItems.map((item) => item.productId),
        ...cartMemberSummary,
      }
      const shareToken = getMallShareTokenForProductIds(this.data.cartItems.map((item) => item.productId))
      const orderResponse = await createMallOrder({
        sessionToken: session.sessionToken,
        couponCode: this.data.cartCouponSummary ? this.data.cartCouponSummary.couponCode : '',
        shareToken,
        addressId: selectedAddressId,
      })

      void trackMallAnalyticsEvent({
        storeId: this.data.mallStoreId,
        mallEventType: 'CHECKOUT_SUBMIT',
        mallPage: 'store_home',
        mallSource: 'cart_checkout',
        targetType: 'ORDER',
        targetId: orderResponse.data.order.id,
        properties: {
          ...checkoutAnalyticsProperties,
          orderId: orderResponse.data.order.id,
          orderNo: orderResponse.data.order.orderNo,
        },
      })

      await this.loadMallHome(this.data.activeCategoryId, true)
      this.setData({
        submittingOrder: false,
      })
      await this.handleCreatedOrderPayment(orderResponse.data.order, orderResponse.data.payment, checkoutAnalyticsProperties)
    } catch (error) {
      this.setData({
        submittingOrder: false,
      })

      if (isMallShareInvalidError(error)) {
        clearMallShareContext()
      }

      this.handleActionError(error, '提交订单失败')
    }
  },

  onOpenAddressManager() {
    this.setData({
      addressPickerVisible: false,
    })

    wx.navigateTo({
      url: buildMallAddressManagerUrl({
        redirectUrl: '/pages/store/index',
        autoBack: true,
      }),
    })
  },

  onOpenAddressPicker() {
    if (this.data.addressLoading) {
      return
    }

    if (this.data.addressLoginRequired) {
      this.promptLogin()
      return
    }

    if (!this.data.shippingAddressItems.length) {
      this.onOpenAddressManager()
      return
    }

    this.setData({
      addressPickerVisible: true,
    })
  },

  onCloseAddressPicker() {
    if (!this.data.addressPickerVisible) {
      return
    }

    this.setData({
      addressPickerVisible: false,
    })
  },

  onSelectAddress(event: WechatMiniprogram.BaseEvent) {
    const addressId = String(event.currentTarget.dataset.id || '')
    const address = this.data.shippingAddressItems.find((item) => item.id === addressId) || null

    if (!address) {
      return
    }

    this.setData({
      selectedAddressId: addressId,
      shippingAddress: buildMallShippingAddressView(address),
      addressPickerVisible: false,
    })
  },

  onCheckout() {
    this.hideMineMenu(true)
    if (!this.data.cartVisible) {
      this.setData(
        {
          cartVisible: true,
          addressPickerVisible: false,
        },
        () => {
          this.trackCartCouponAnalytics(this.data.cartCouponSummary, 'cart_checkout_open')
        },
      )
      return
    }

    void this.submitOrder()
  },

  onOpenMine() {
    if (this.data.mineMenuVisible && this.data.mineMenuOpen) {
      this.hideMineMenu()
      return
    }

    this.showMineMenu()
  },

  onCloseMineMenu() {
    this.hideMineMenu()
  },

  onMineMenuItemTap(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id || '') as MallMineMenuItem['id']

    this.hideMineMenu()

    if (id === 'address') {
      wx.navigateTo({
        url: buildMallAddressManagerUrl({
          redirectUrl: '/pages/store/index',
        }),
      })
      return
    }

    if (id === 'refund') {
      wx.navigateTo({
        url: '/pages/store/orders?filter=refund',
      })
      return
    }

    if (id === 'commission') {
      wx.navigateTo({
        url: '/pages/store/commission',
      })
      return
    }

    wx.navigateTo({
      url: '/pages/store/orders',
    })
  },
  noop() {},
})
