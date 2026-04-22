import { clearSession, getStoredSession, savePendingLoginRedirect, shouldClearSessionByError } from '../../utils/auth'
import {
  isMallPaymentCancelled,
  pollMallOrderPaymentResult,
  requestMallWechatPayment,
} from '../../utils/mall-payment'
import {
  buildStoreDetailPath,
  clearMallShareContext,
  getMallShareTokenForProduct,
  isMallShareInvalidError,
  saveMallShareContext,
} from '../../utils/mall-share'
import {
  countGuestMallCartItems,
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
import { normalizeMallUserFacingErrorMessage } from '../../utils/mall-error'
import {
  buildMallAddressManagerUrl,
  buildMallShippingAddressView,
  buildMallShippingAddressViews,
  type MallShippingAddressView,
} from '../../utils/mall-address'
import { getStoredMallStoreId, saveMallStoreId } from '../../utils/mall-store'
import {
  addMallCartItem,
  createMallOrder,
  createMallProductShareToken,
  fetchMallCart,
  fetchMallConfig,
  fetchMallCoupons,
  fetchMallProductDetail,
  fetchMallShippingAddress,
  fetchMallProductReviews,
  type MallCartPayload,
  type MallCouponApiItem,
  type MallMemberBenefitType,
  type MallOrderApiItem,
  type MallOrderPaymentApiItem,
  type MallProductApiItem,
  type MallProductDetailImageApiItem,
  type MallProductReviewApiItem,
  type MallProductReviewSummaryApiItem,
  type MallServiceFaqApiItem,
  type MallShippingAddressApiItem,
} from '../../utils/store-api'

interface MallProductDetailView {
  id: string
  storeId: string
  categoryId: string
  categoryName: string
  title: string
  subtitle: string
  coverImageUrl: string
  coverFallbackText: string
  price: number
  priceText: string
  publicPrice: number
  originalPriceText: string
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
  selfSaveText: string
  shareRewardText: string
}

interface MallCartSummary {
  cartCount: number
  productCartCount: number
}

interface MallReviewSummaryView {
  reviewCount: number
  averageRating: number
  averageRatingText: string
  positiveCount: number
  positiveRate: number
  positiveRateText: string
}

interface MallProductReviewView {
  id: string
  rating: number
  content: string
  nickname: string
  avatarUrl: string
  avatarFallbackText: string
  createdAtText: string
  isAnonymous: boolean
  mine: boolean
  stars: number[]
}

interface MallPromoPlaceholderView {
  id: string
  orderLabel: string
  title: string
  caption: string
  imageClassName: string
}

interface MallPromoImageView {
  id: string
  orderLabel: string
  imageUrl: string
  title: string
  caption: string
}

interface MallHeroImageView {
  id: string
  imageUrl: string
  title: string
}

interface MallServiceFaqView {
  id: string
  title: string
  content: string
}

const PRODUCT_PREVIEW_STORAGE_KEY = 'xueyin_mall_product_preview'
const RATING_OPTIONS = [1, 2, 3, 4, 5]
const mallDetailImageRetryHistory: Record<string, string[]> = {}
let trackedMallDetailProductId = ''
let lastDetailCouponImpressionKey = ''
let lastDetailCouponAutoApplyKey = ''
const PROMO_PLACEHOLDER_ITEMS: MallPromoPlaceholderView[] = [
  {
    id: 'promo_hero',
    orderLabel: '01',
    title: '主视觉海报',
    caption: '适合把核心卖点、主标题和品牌氛围放在第一张大图里。',
    imageClassName: 'mall-detail-promo-image-hero',
  },
  {
    id: 'promo_detail',
    orderLabel: '02',
    title: '细节特写',
    caption: '适合展示材质、做工、局部结构和商品细节。',
    imageClassName: 'mall-detail-promo-image-detail',
  },
  {
    id: 'promo_scene',
    orderLabel: '03',
    title: '场景展示',
    caption: '适合用使用场景、前后对比和搭配效果补充说服力。',
    imageClassName: 'mall-detail-promo-image-scene',
  },
]

function resetMallDetailImageRetryHistory() {
  Object.keys(mallDetailImageRetryHistory).forEach((key) => {
    delete mallDetailImageRetryHistory[key]
  })
}

function rememberMallDetailImageUrl(assetKey: string, url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!assetKey || !normalizedUrl) {
    return
  }

  const previousUrls = mallDetailImageRetryHistory[assetKey] || []
  if (previousUrls.indexOf(normalizedUrl) >= 0) {
    return
  }

  mallDetailImageRetryHistory[assetKey] = previousUrls.concat(normalizedUrl)
}

function resolveNextMallDetailImageUrl(assetKey: string, currentUrl: string) {
  rememberMallDetailImageUrl(assetKey, currentUrl)

  const nextUrl = pickNextAssetUrl(currentUrl, mallDetailImageRetryHistory[assetKey] || [])
  if (!nextUrl) {
    return ''
  }

  rememberMallDetailImageUrl(assetKey, nextUrl)
  return nextUrl
}

function formatPrice(value: number | string) {
  const amount = Number(value || 0)
  return `¥${amount.toFixed(2)}`
}

function toMoneyNumber(value: number | string) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

function clampQuantity(quantity: number, stock: number) {
  const safeStock = Math.max(1, Number(stock || 0))
  const safeQuantity = Math.max(1, Number(quantity || 1))
  return Math.min(safeStock, safeQuantity)
}

function buildStoreOrdersUrl(filter = '') {
  if (!filter) {
    return '/pages/store/orders'
  }

  return `/pages/store/orders?filter=${encodeURIComponent(filter)}`
}

function buildStoreOrdersLoginUrl(filter = '') {
  return `/pages/auth/login?redirect=${encodeURIComponent(buildStoreOrdersUrl(filter))}`
}

function buildBenefitTexts(price: number, originalPrice: number) {
  const selfSave = Math.max(originalPrice - price, 0)
  const shareReward = Math.min(Math.max(price * 0.03, 0.5), 99)

  return {
    selfSaveText: formatPrice(selfSave),
    shareRewardText: formatPrice(Math.round(shareReward * 100) / 100),
  }
}

function buildCheckoutOrderAmount(product: MallProductDetailView | null, quantity: number) {
  if (!product || Number(product.stock || 0) <= 0) {
    return 0
  }

  return toMoneyNumber(product.price) * clampQuantity(quantity, product.stock)
}

function buildDetailCheckoutPricingSummary(
  product: MallProductDetailView | null,
  quantity: number,
  couponSummary: MallCouponSummaryView | null | undefined,
) {
  if (!product || Number(product.stock || 0) <= 0) {
    return null
  }

  return buildMallCheckoutPricingSummary({
    items: [
      {
        price: product.price,
        publicPrice: product.publicPrice,
        quantity: clampQuantity(quantity, product.stock),
      },
    ],
    couponDiscountAmount: couponSummary ? couponSummary.discountAmount : 0,
  })
}

function buildProductView(product: MallProductApiItem): MallProductDetailView {
  const price = toMoneyNumber(product.price)
  const originalPrice = toMoneyNumber(product.originalPrice)
  const benefitTexts = buildBenefitTexts(price, originalPrice)

  return {
    id: product.id,
    storeId: product.storeId,
    categoryId: product.categoryId,
    categoryName: product.categoryName || '',
    title: product.title,
    subtitle: product.subtitle || '商品简介暂未填写',
    coverImageUrl: normalizeAssetUrl(product.coverImageUrl || ''),
    coverFallbackText: product.coverFallbackText || '商品',
    price,
    priceText: product.priceText || formatPrice(price),
    publicPrice: toMoneyNumber(product.publicPrice),
    originalPriceText: originalPrice > 0 ? product.originalPriceText || formatPrice(originalPrice) : '',
    publicPriceText: product.publicPriceText || formatPrice(product.publicPrice),
    memberPrice: toMoneyNumber(product.memberPrice),
    memberPriceText: product.memberPriceText || '',
    memberBenefitType: product.memberBenefitType || 'NONE',
    memberBenefitLabel: product.memberBenefitLabel || '',
    memberPromptText: product.memberPromptText || '',
    membershipActive: Boolean(product.membershipActive),
    canPurchase: product.canPurchase !== false,
    stock: Number(product.stock || 0),
    cartCount: Number(product.cartQuantity || 0),
    selfSaveText: benefitTexts.selfSaveText,
    shareRewardText: benefitTexts.shareRewardText,
  }
}

function normalizeMallProductMediaType(mediaType?: string | null) {
  return String(mediaType || '').toUpperCase() === 'CAROUSEL' ? 'CAROUSEL' : 'PROMOTION'
}

function buildHeroImageViews(
  detailImages?: MallProductDetailImageApiItem[] | null,
  coverImageUrl?: string | null,
): MallHeroImageView[] {
  const carouselItems = Array.isArray(detailImages)
    ? detailImages.filter(
        (item) =>
          normalizeMallProductMediaType(item && item.mediaType) === 'CAROUSEL' &&
          Boolean(String((item && item.imageUrl) || '').trim()),
      )
    : []

  if (carouselItems.length) {
    return carouselItems.map((item, index) => ({
      id: String(item.id || `carousel_${index + 1}`),
      imageUrl: normalizeAssetUrl(String(item.imageUrl || '')),
      title: String(item.title || `商品轮播图 ${index + 1}`),
    }))
  }

  const normalizedCoverImageUrl = normalizeAssetUrl(String(coverImageUrl || ''))
  if (!normalizedCoverImageUrl) {
    return []
  }

  return [
    {
      id: 'product_cover_fallback',
      imageUrl: normalizedCoverImageUrl,
      title: '商品头图',
    },
  ]
}

function buildPromoImageViews(detailImages?: MallProductDetailImageApiItem[] | null): MallPromoImageView[] {
  if (!Array.isArray(detailImages) || !detailImages.length) {
    return []
  }

  return detailImages
    .filter(
      (item) =>
        normalizeMallProductMediaType(item && item.mediaType) === 'PROMOTION' &&
        Boolean(String((item && item.imageUrl) || '').trim()),
    )
    .map((item, index) => ({
      id: String(item.id || `promo_${index + 1}`),
      orderLabel: String(index + 1).padStart(2, '0'),
      imageUrl: normalizeAssetUrl(String(item.imageUrl || '')),
      title: String(item.title || `商品宣传图 ${index + 1}`),
      caption: String(item.description || '商家可以用多张图片集中介绍商品卖点、细节和使用场景。'),
    }))
}

function buildServiceFaqViews(items: MallServiceFaqApiItem[] = []): MallServiceFaqView[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
  }))
}

function hydratePreviewProduct(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const product = value as Partial<MallProductDetailView>
  const productId = String(product.id || '')
  if (!productId) {
    return null
  }

  const price = toMoneyNumber(product.price || String(product.priceText || '').replace(/[^\d.]/g, ''))
  const originalPrice = toMoneyNumber(String(product.originalPriceText || '').replace(/[^\d.]/g, '')) || price
  const benefitTexts = buildBenefitTexts(price, originalPrice)

  return {
    id: productId,
    storeId: String(product.storeId || ''),
    categoryId: String(product.categoryId || ''),
    categoryName: String(product.categoryName || ''),
    title: String(product.title || ''),
    subtitle: String(product.subtitle || '商品简介暂未填写'),
    coverImageUrl: normalizeAssetUrl(String(product.coverImageUrl || '')),
    coverFallbackText: String(product.coverFallbackText || '商品'),
    price,
    priceText: product.priceText || formatPrice(price),
    originalPriceText:
      originalPrice > 0 ? product.originalPriceText || formatPrice(originalPrice) : '',
    publicPriceText: String(product.publicPriceText || product.priceText || formatPrice(price)),
    memberPriceText: String(product.memberPriceText || ''),
    memberBenefitType: (product.memberBenefitType as MallMemberBenefitType) || 'NONE',
    memberBenefitLabel: String(product.memberBenefitLabel || ''),
    memberPromptText: String(product.memberPromptText || ''),
    membershipActive: Boolean(product.membershipActive),
    canPurchase: product.canPurchase !== false,
    stock: Number(product.stock || 0),
    cartCount: Number(product.cartCount || 0),
    selfSaveText: benefitTexts.selfSaveText,
    shareRewardText: benefitTexts.shareRewardText,
  } as MallProductDetailView
}

function readStoredPreview(productId: string) {
  try {
    const preview = hydratePreviewProduct(wx.getStorageSync(PRODUCT_PREVIEW_STORAGE_KEY))
    if (!preview || preview.id !== productId) {
      return null
    }

    return preview
  } catch {
    return null
  }
}

function persistProductPreview(product: MallProductDetailView) {
  try {
    wx.setStorageSync(PRODUCT_PREVIEW_STORAGE_KEY, product)
  } catch {}
}

function getProductCartCount(cartPayload: MallCartPayload, productId: string) {
  const matchedItem = cartPayload.items.find((item) => item.productId === productId)
  return matchedItem ? matchedItem.quantity : 0
}

function createEmptyReviewSummary(): MallReviewSummaryView {
  return {
    reviewCount: 0,
    averageRating: 0,
    averageRatingText: '0.0',
    positiveCount: 0,
    positiveRate: 0,
    positiveRateText: '0%',
  }
}

function buildReviewSummaryView(summary?: MallProductReviewSummaryApiItem | null): MallReviewSummaryView {
  if (!summary) {
    return createEmptyReviewSummary()
  }

  return {
    reviewCount: Number(summary.reviewCount || 0),
    averageRating: Number(summary.averageRating || 0),
    averageRatingText: String(summary.averageRatingText || '0.0'),
    positiveCount: Number(summary.positiveCount || 0),
    positiveRate: Number(summary.positiveRate || 0),
    positiveRateText: String(summary.positiveRateText || '0%'),
  }
}

function formatReviewDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

function buildReviewView(review: MallProductReviewApiItem, mine = false): MallProductReviewView {
  const nickname = String(review.nickname || '匿名用户')

  return {
    id: review.id,
    rating: Number(review.rating || 5),
    content: String(review.content || ''),
    nickname,
    avatarUrl: normalizeAssetUrl(String(review.avatarUrl || '')),
    avatarFallbackText: nickname.slice(0, 1) || '评',
    createdAtText: formatReviewDateLabel(String(review.createdAt || review.updatedAt || '')),
    isAnonymous: Boolean(review.isAnonymous),
    mine,
    stars: RATING_OPTIONS.slice(),
  }
}

function buildMallDetailLoginUrl(productId: string) {
  const redirectUrl = productId ? buildStoreDetailPath(productId, getMallShareTokenForProduct(productId)) : '/pages/store/index'
  return `/pages/auth/login?redirect=${encodeURIComponent(redirectUrl)}`
}

function buildMallDetailRedirectUrl(productId: string) {
  return productId ? buildStoreDetailPath(productId, getMallShareTokenForProduct(productId)) : '/pages/store/index'
}

function buildMallOrderDetailUrl(orderId: string) {
  return `/pages/store/order-detail?id=${encodeURIComponent(orderId)}`
}

function buildDetailMemberAnalyticsSummary(product: MallProductDetailView | null) {
  if (!product) {
    return {
      productId: '',
      title: '',
      categoryId: '',
      categoryName: '',
      price: 0,
      memberBenefitType: 'NONE' as MallMemberBenefitType,
      memberBenefitLabel: '',
      memberPromptText: '',
      membershipActive: false,
      canPurchase: true,
      hasMemberProducts: false,
      memberProductCount: 0,
      memberPriceCount: 0,
      memberExclusiveCount: 0,
      memberProductIds: [] as string[],
    }
  }

  const isMemberPrice = product.memberBenefitType === 'MEMBER_PRICE'
  const isMemberExclusive = product.memberBenefitType === 'MEMBER_EXCLUSIVE'
  const hasMemberBenefit = product.memberBenefitType !== 'NONE'

  return {
    productId: product.id,
    title: product.title,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    price: product.price,
    memberBenefitType: product.memberBenefitType,
    memberBenefitLabel: product.memberBenefitLabel,
    memberPromptText: product.memberPromptText,
    membershipActive: product.membershipActive,
    canPurchase: product.canPurchase,
    hasMemberProducts: hasMemberBenefit,
    memberProductCount: hasMemberBenefit ? 1 : 0,
    memberPriceCount: isMemberPrice ? 1 : 0,
    memberExclusiveCount: isMemberExclusive ? 1 : 0,
    memberProductIds: hasMemberBenefit ? [product.id] : [],
  }
}

Page({
  data: {
    statusBarHeight: 28,
    productId: '',
    shareToken: '',
    shareTokenOwnerId: '',
    shareTokenLoading: false,
    product: null as MallProductDetailView | null,
    quantity: 1,
    cartCount: 0,
    checkoutVisible: false,
    mallCoupons: [] as MallCouponApiItem[],
    couponLoading: false,
    checkoutSelectedCouponCode: '',
    checkoutCouponSelectionMode: 'AUTO' as MallCouponSelectionMode,
    checkoutCouponSummary: null as MallCouponSummaryView | null,
    checkoutCouponPopupVisible: false,
    checkoutCouponPopupOptions: [] as MallCouponSelectorOptionView[],
    checkoutPricingSummary: null as MallPricingSummaryView | null,
    loading: true,
    loadingText: '商品加载中...',
    loadFailed: false,
    submitting: false,
    reviewsLoading: false,
    reviewSummary: createEmptyReviewSummary(),
    reviews: [] as MallProductReviewView[],
    heroImages: [] as MallHeroImageView[],
    promoImages: [] as MallPromoImageView[],
    promoPlaceholders: PROMO_PLACEHOLDER_ITEMS,
    shippingAddressItems: [] as MallShippingAddressApiItem[],
    shippingAddresses: [] as MallShippingAddressView[],
    shippingAddress: null as MallShippingAddressView | null,
    selectedAddressId: '',
    addressLoading: false,
    addressLoginRequired: true,
    addressPickerVisible: false,
    showCustomerServiceEntry: false,
    customerServiceVisible: false,
    serviceTitle: '商城客服',
    serviceHours: '',
    serviceContactHint: '',
    serviceFaqItems: [] as MallServiceFaqView[],
  },

  onLoad(options: Record<string, string>) {
    resetMallDetailImageRetryHistory()
    trackedMallDetailProductId = ''
    lastDetailCouponImpressionKey = ''
    lastDetailCouponAutoApplyKey = ''
    const productId = String(options.id || '')
    const incomingShareToken = String(options.shareToken || '')
    const statusBarHeight = (() => {
      try {
        return wx.getSystemInfoSync().statusBarHeight || 28
      } catch {
        return 28
      }
    })()

    if (!productId) {
      this.setData({
        statusBarHeight,
        loading: false,
        loadFailed: true,
        loadingText: '缺少商品ID',
      })
      return
    }

    const preview = readStoredPreview(productId)
    const guestCartQuantities = loadGuestMallCartQuantities()
    const guestProductCartCount = Number(guestCartQuantities[productId] || 0)

    if (incomingShareToken) {
      saveMallShareContext({
        productId,
        shareToken: incomingShareToken,
      })
    }

    this.setData({
      statusBarHeight,
      productId,
      cartCount: countGuestMallCartItems(guestCartQuantities),
      product: preview ? { ...preview, cartCount: guestProductCartCount || preview.cartCount } : null,
      heroImages: preview ? buildHeroImageViews([], preview.coverImageUrl) : [],
      quantity: preview ? clampQuantity(guestProductCartCount || preview.cartCount || 1, preview.stock) : 1,
    })

    this.loadProductDetail(productId)
    this.loadReviews(productId)
    this.ensureShareToken(productId)
  },

  onShow() {
    this.ensureShareToken(this.data.productId)
    this.loadShippingAddress()
    showMallMembershipReviewNoticeIfNeeded()

    if (getStoredSession() && getStoredMallStoreId()) {
      void this.loadMallCoupons(getStoredMallStoreId())
    }

    if (!this.data.productId || this.data.loading) {
      return
    }

    this.syncCartSummary()
    this.loadReviews(this.data.productId)
  },

  onUnload() {
    resetMallDetailImageRetryHistory()
    trackedMallDetailProductId = ''
    lastDetailCouponImpressionKey = ''
    lastDetailCouponAutoApplyKey = ''
  },

  onHeroImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const heroId = String(event.currentTarget.dataset.heroId || index)
    const heroImage = this.data.heroImages[index]

    if (!heroImage) {
      return
    }

    const nextUrl = resolveNextMallDetailImageUrl(`hero_${heroId}`, heroImage.imageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`heroImages[${index}].imageUrl`]: nextUrl,
    })
  },

  onPromoImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const promoId = String(event.currentTarget.dataset.promoId || index)
    const promoImage = this.data.promoImages[index]

    if (!promoImage) {
      return
    }

    const nextUrl = resolveNextMallDetailImageUrl(`promo_${promoId}`, promoImage.imageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`promoImages[${index}].imageUrl`]: nextUrl,
    })
  },

  onProductCoverImageError() {
    const product = this.data.product
    if (!product) {
      return
    }

    const nextUrl = resolveNextMallDetailImageUrl(`product_${product.id}`, product.coverImageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      'product.coverImageUrl': nextUrl,
    })
  },

  onReviewAvatarError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const reviewId = String(event.currentTarget.dataset.reviewId || index)
    const review = this.data.reviews[index]

    if (!review) {
      return
    }

    const nextUrl = resolveNextMallDetailImageUrl(`review_${reviewId}`, review.avatarUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`reviews[${index}].avatarUrl`]: nextUrl,
    })
  },

  async loadCartSummary(productId: string, sessionToken: string): Promise<MallCartSummary> {
    if (!sessionToken) {
      const quantities = loadGuestMallCartQuantities()
      return {
        cartCount: countGuestMallCartItems(quantities),
        productCartCount: Number(quantities[productId] || 0),
      }
    }

    try {
      try {
        await syncGuestMallCartToSession(sessionToken)
      } catch (error) {
        if (shouldClearSessionByError(error)) {
          clearSession()
          const quantities = loadGuestMallCartQuantities()
          return {
            cartCount: countGuestMallCartItems(quantities),
            productCartCount: Number(quantities[productId] || 0),
          }
        }

        wx.showToast({
          title: error instanceof Error ? error.message : '登录前购物车同步失败',
          icon: 'none',
        })
      }

      const cartResponse = await fetchMallCart(sessionToken)
      return {
        cartCount: cartResponse.data.cartCount,
        productCartCount: getProductCartCount(cartResponse.data, productId),
      }
    } catch (error) {
      if (shouldClearSessionByError(error)) {
        clearSession()
      }

      const quantities = loadGuestMallCartQuantities()
      return {
        cartCount: countGuestMallCartItems(quantities),
        productCartCount: Number(quantities[productId] || 0),
      }
    }
  },

  async loadProductDetail(productId: string) {
    const session = getStoredSession()

    this.setData({
      loading: true,
      loadingText: '商品加载中...',
    })

    try {
      const [detailResponse, cartSummary] = await Promise.all([
        fetchMallProductDetail({
          productId,
          sessionToken: session ? session.sessionToken : '',
        }),
        this.loadCartSummary(productId, session ? session.sessionToken : ''),
      ])
      const nextProduct = {
        ...buildProductView(detailResponse.data.item),
        cartCount: cartSummary.productCartCount,
      }
      const nextQuantity = clampQuantity(Number(this.data.quantity || nextProduct.cartCount || 1), nextProduct.stock)
      const nextMallCoupons = session ? this.data.mallCoupons : ([] as MallCouponApiItem[])
      const checkoutCouponSummary = buildMallCouponSummary({
        coupons: nextMallCoupons,
        orderAmount: buildCheckoutOrderAmount(nextProduct, nextQuantity),
        loggedIn: Boolean(session),
        loginHintText: '登录后下单可自动匹配或手动切换优惠券',
        emptyHintText: '当前商品暂无可用优惠券',
        selectionMode: this.data.checkoutCouponSelectionMode,
        preferredCouponCode: this.data.checkoutSelectedCouponCode,
      })
      const checkoutPricingSummary = buildDetailCheckoutPricingSummary(nextProduct, nextQuantity, checkoutCouponSummary)

      saveMallStoreId(detailResponse.data.item.storeId)
      persistProductPreview(nextProduct)
      this.setData({
        product: nextProduct,
        heroImages: buildHeroImageViews(detailResponse.data.item.detailImages, nextProduct.coverImageUrl),
        promoImages: buildPromoImageViews(detailResponse.data.item.detailImages),
        quantity: nextQuantity,
        cartCount: cartSummary.cartCount,
        mallCoupons: nextMallCoupons,
        couponLoading: Boolean(session),
        checkoutSelectedCouponCode:
          checkoutCouponSummary && checkoutCouponSummary.selectionMode === 'MANUAL' ? checkoutCouponSummary.couponCode : '',
        checkoutCouponSelectionMode: checkoutCouponSummary ? checkoutCouponSummary.selectionMode : 'AUTO',
        checkoutCouponSummary,
        checkoutPricingSummary,
        loading: false,
        loadFailed: false,
      })
      if (session && detailResponse.data.item.storeId) {
        void this.loadMallCoupons(detailResponse.data.item.storeId)
      }
      if (trackedMallDetailProductId !== detailResponse.data.item.id) {
        trackedMallDetailProductId = detailResponse.data.item.id
        const memberSummary = buildDetailMemberAnalyticsSummary(nextProduct)
        void trackMallAnalyticsEvent({
          storeId: detailResponse.data.item.storeId,
          mallEventType: 'PRODUCT_DETAIL_VIEW',
          mallPage: 'store_detail',
          mallSource: this.data.shareToken ? 'share_link' : 'direct',
          targetType: 'POST',
          targetId: detailResponse.data.item.id,
          properties: {
            ...memberSummary,
          },
        })
      }
      void this.loadCustomerServiceConfig(detailResponse.data.item.storeId)
    } catch (error) {
      const preview = readStoredPreview(productId)
      if (preview) {
        const quantities = loadGuestMallCartQuantities()
        const nextProduct = {
          ...preview,
          cartCount: Number(quantities[productId] || preview.cartCount || 0),
        }

        persistProductPreview(nextProduct)
        const nextQuantity = clampQuantity(Number(this.data.quantity || nextProduct.cartCount || 1), nextProduct.stock)
        this.setData({
          product: nextProduct,
          heroImages: buildHeroImageViews([], nextProduct.coverImageUrl),
          promoImages: [],
          quantity: nextQuantity,
          cartCount: countGuestMallCartItems(quantities),
          mallCoupons: [],
          couponLoading: false,
          checkoutSelectedCouponCode: '',
          checkoutCouponSelectionMode: 'AUTO',
          checkoutCouponSummary: buildMallCouponSummary({
            coupons: [],
            orderAmount: buildCheckoutOrderAmount(nextProduct, nextQuantity),
            loggedIn: false,
            loginHintText: '登录后下单可自动匹配或手动切换优惠券',
            emptyHintText: '当前商品暂无可用优惠券',
          }),
          checkoutPricingSummary: buildDetailCheckoutPricingSummary(nextProduct, nextQuantity, null),
          loading: false,
          loadFailed: false,
        })
        void this.loadCustomerServiceConfig(getStoredMallStoreId())
        this.handleActionError(error, '商品详情加载失败，先展示列表数据')
        return
      }

      this.setData({
        heroImages: [],
        promoImages: [],
        loading: false,
        loadFailed: true,
        loadingText: error instanceof Error ? error.message : '商品详情加载失败',
      })
      this.handleActionError(error, '商品详情加载失败')
    }
  },

  refreshCheckoutCouponSummary(coupons?: MallCouponApiItem[], mallSource = 'detail_checkout_coupon_refresh') {
    const nextCoupons = Array.isArray(coupons) ? coupons : this.data.mallCoupons
    const orderAmount = buildCheckoutOrderAmount(this.data.product, Number(this.data.quantity || 1))
    const checkoutCouponSummary = buildMallCouponSummary({
      coupons: nextCoupons,
      orderAmount,
      loggedIn: Boolean(getStoredSession()),
      loginHintText: '登录后下单可自动匹配或手动切换优惠券',
      emptyHintText: '当前商品暂无可用优惠券',
      selectionMode: this.data.checkoutCouponSelectionMode,
      preferredCouponCode: this.data.checkoutSelectedCouponCode,
    })
    const checkoutPricingSummary = buildDetailCheckoutPricingSummary(this.data.product, Number(this.data.quantity || 1), checkoutCouponSummary)
    const keepCheckoutCouponPopupVisible = Boolean(
      this.data.checkoutCouponPopupVisible &&
        checkoutCouponSummary &&
        !checkoutCouponSummary.loginRequired &&
        Number(checkoutCouponSummary.availableCount || 0) > 0,
    )
    const nextCheckoutCouponSelectionMode = checkoutCouponSummary ? checkoutCouponSummary.selectionMode : 'AUTO'
    const nextCheckoutSelectedCouponCode =
      checkoutCouponSummary && checkoutCouponSummary.selectionMode === 'MANUAL' ? checkoutCouponSummary.couponCode : ''

    this.setData(
      {
        checkoutSelectedCouponCode: nextCheckoutSelectedCouponCode,
        checkoutCouponSelectionMode: nextCheckoutCouponSelectionMode,
        checkoutCouponSummary,
        checkoutCouponPopupVisible: keepCheckoutCouponPopupVisible,
        checkoutCouponPopupOptions: keepCheckoutCouponPopupVisible
          ? buildMallCouponSelectorOptions({
              coupons: nextCoupons,
              orderAmount,
              currentCouponCode: nextCheckoutSelectedCouponCode,
              selectionMode: nextCheckoutCouponSelectionMode,
            })
          : [],
        checkoutPricingSummary,
      },
      () => {
        if (this.data.checkoutVisible) {
          this.trackCheckoutCouponAnalytics(checkoutCouponSummary, mallSource)
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
      this.refreshCheckoutCouponSummary([])
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
      this.refreshCheckoutCouponSummary(couponItems)
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
      this.refreshCheckoutCouponSummary([])
      return []
    }
  },

  onSelectCheckoutCoupon() {
    const session = getStoredSession()
    const summary = this.data.checkoutCouponSummary
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

    const orderAmount = Number(summary.orderAmount || buildCheckoutOrderAmount(this.data.product, Number(this.data.quantity || 1)))
    this.setData({
      checkoutCouponPopupVisible: true,
      checkoutCouponPopupOptions: buildMallCouponSelectorOptions({
        coupons,
        orderAmount,
        currentCouponCode: summary.selectionMode === 'MANUAL' ? summary.couponCode : '',
        selectionMode: summary.selectionMode,
      }),
    })
  },

  onCloseCheckoutCouponPopup() {
    if (!this.data.checkoutCouponPopupVisible) {
      return
    }

    this.setData({
      checkoutCouponPopupVisible: false,
      checkoutCouponPopupOptions: [],
    })
  },

  onSelectCheckoutCouponOption(
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
        checkoutCouponPopupVisible: false,
        checkoutCouponPopupOptions: [],
        checkoutCouponSelectionMode: selectionMode,
        checkoutSelectedCouponCode: couponCode,
      },
      () => {
        this.refreshCheckoutCouponSummary(undefined, 'detail_checkout_coupon_manual_select')
      },
    )
  },

  async loadCustomerServiceConfig(storeId?: string) {
    const fallbackStoreId = String(storeId || getStoredMallStoreId() || '').trim()

    try {
      const response = await fetchMallConfig(fallbackStoreId || undefined)
      saveMallStoreId(response.data.storeId || fallbackStoreId)

      const serviceFaqItems = buildServiceFaqViews(Array.isArray(response.data.serviceFaqItems) ? response.data.serviceFaqItems : [])
      const serviceTitle = response.data.serviceTitle || `${response.data.storeName || '商城'}客服`
      const serviceHours = String(response.data.serviceHours || '').trim()
      const serviceContactHint = String(response.data.serviceContactHint || '').trim()

      this.setData({
        showCustomerServiceEntry: Boolean(serviceFaqItems.length || serviceHours || serviceContactHint),
        serviceTitle,
        serviceHours,
        serviceContactHint,
        serviceFaqItems,
      })
    } catch {
      this.setData({
        showCustomerServiceEntry: false,
        customerServiceVisible: false,
        serviceTitle: '商城客服',
        serviceHours: '',
        serviceContactHint: '',
        serviceFaqItems: [],
      })
    }
  },

  async loadReviews(productId: string) {
    if (!productId) {
      return
    }

    const session = getStoredSession()

    this.setData({
      reviewsLoading: true,
    })

    try {
      const response = await fetchMallProductReviews({
        productId,
        limit: 20,
        sessionToken: session ? session.sessionToken : '',
      })
      const currentUserReview = response.data.currentUserReview ? buildReviewView(response.data.currentUserReview, true) : null
      const reviews = (response.data.items || []).map((item) => buildReviewView(item, Boolean(currentUserReview && item.id === currentUserReview.id)))

      this.setData({
        reviewsLoading: false,
        reviewSummary: buildReviewSummaryView(response.data.summary),
        reviews,
      })
    } catch (error) {
      if (shouldClearSessionByError(error)) {
        clearSession()
      }

      this.setData({
        reviewsLoading: false,
      })
    }
  },

  async syncCartSummary() {
    const product = this.data.product
    const productId = this.data.productId
    const session = getStoredSession()

    if (!product || !productId) {
      return
    }

    const cartSummary = await this.loadCartSummary(productId, session ? session.sessionToken : '')
    const nextProduct = {
      ...product,
      cartCount: cartSummary.productCartCount,
    }

    persistProductPreview(nextProduct)
    this.setData({
      product: nextProduct,
      cartCount: cartSummary.cartCount,
      quantity: clampQuantity(Number(this.data.quantity || 1), nextProduct.stock),
    })
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

  async ensureShareToken(productId?: string) {
    const normalizedProductId = String(productId || this.data.productId || '')
    const session = getStoredSession()

    if (!normalizedProductId || !session) {
      if (this.data.shareToken || this.data.shareTokenOwnerId || this.data.shareTokenLoading) {
        this.setData({
          shareToken: '',
          shareTokenOwnerId: '',
          shareTokenLoading: false,
        })
      }
      return
    }

    if (
      this.data.shareToken &&
      this.data.shareTokenOwnerId === session.id &&
      !this.data.shareTokenLoading &&
      normalizedProductId === this.data.productId
    ) {
      return
    }

    if (this.data.shareTokenLoading) {
      return
    }

    this.setData({
      shareTokenLoading: true,
    })

    try {
      const response = await createMallProductShareToken({
        sessionToken: session.sessionToken,
        productId: normalizedProductId,
      })

      if (normalizedProductId !== this.data.productId) {
        return
      }

      this.setData({
        shareToken: response.data.shareToken,
        shareTokenOwnerId: session.id,
        shareTokenLoading: false,
      })
    } catch (error) {
      if (normalizedProductId !== this.data.productId) {
        return
      }

      if (shouldClearSessionByError(error)) {
        clearSession()
      }

      this.setData({
        shareToken: '',
        shareTokenOwnerId: '',
        shareTokenLoading: false,
      })
    }
  },

  promptLogin() {
    wx.showModal({
      title: '请先登录',
      content: '下单和评价都需要登录后才能继续，登录成功后会回到当前商品页。',
      confirmText: '去登录',
      success: ({ confirm }) => {
        if (confirm) {
          savePendingLoginRedirect(buildMallDetailRedirectUrl(this.data.productId))
          wx.navigateTo({
            url: buildMallDetailLoginUrl(this.data.productId),
          })
        }
      },
    })
  },

  async ensureShippingAddressForCheckout() {
    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return false
    }

    if (!this.data.selectedAddressId) {
      wx.showModal({
        title: '请先选择收货地址',
        content: '请先在下单层里选择已有地址。没有地址的话，请去“我的 - 收货地址”新增后再回来提交订单。',
        confirmText: '去管理',
        success: ({ confirm }) => {
          if (confirm) {
            this.onOpenAddressManager()
          }
        },
      })
      return false
    }

    return true
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
            savePendingLoginRedirect(buildMallDetailRedirectUrl(this.data.productId))
            wx.navigateTo({
              url: buildMallDetailLoginUrl(this.data.productId),
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
        storeId: getStoredMallStoreId(),
        mallEventType: 'PAYMENT_START',
        mallPage: 'store_detail',
        mallSource: 'buy_now',
        targetType: 'ORDER',
        targetId: order.id,
        eventDedupKey: `${order.id}:payment_start`,
        properties: {
          ...analyticsProperties,
          orderId: order.id,
          orderNo: order.orderNo,
          productId: this.data.productId,
          payableAmount: order.payableAmount || order.totalAmount,
        },
      })

      try {
        await requestMallWechatPayment(payment.request)
      } catch (error) {
        if (isMallPaymentCancelled(error)) {
          void trackMallAnalyticsEvent({
            storeId: getStoredMallStoreId(),
            mallEventType: 'PAYMENT_CANCEL',
            mallPage: 'store_detail',
            mallSource: 'buy_now',
            targetType: 'ORDER',
            targetId: order.id,
            eventDedupKey: `${order.id}:payment_cancel`,
            properties: {
              ...analyticsProperties,
              orderId: order.id,
              orderNo: order.orderNo,
              productId: this.data.productId,
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
          storeId: getStoredMallStoreId(),
          mallEventType: 'PAYMENT_FAILURE',
          mallPage: 'store_detail',
          mallSource: 'buy_now',
          targetType: 'ORDER',
          targetId: order.id,
          eventDedupKey: `${order.id}:payment_failure`,
          properties: {
            ...analyticsProperties,
            orderId: order.id,
            orderNo: order.orderNo,
            productId: this.data.productId,
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
          storeId: getStoredMallStoreId(),
          mallEventType: 'PAYMENT_SUCCESS',
          mallPage: 'store_detail',
          mallSource: 'buy_now',
          targetType: 'ORDER',
          targetId: latestOrder.id,
          eventDedupKey: `${latestOrder.id}:payment_success`,
          properties: {
            ...analyticsProperties,
            orderId: latestOrder.id,
            orderNo: latestOrder.orderNo,
            productId: this.data.productId,
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
          storeId: getStoredMallStoreId(),
          mallEventType: 'PAYMENT_FAILURE',
          mallPage: 'store_detail',
          mallSource: 'buy_now',
          targetType: 'ORDER',
          targetId: latestOrder.id,
          eventDedupKey: `${latestOrder.id}:payment_failure`,
          properties: {
            ...analyticsProperties,
            orderId: latestOrder.id,
            orderNo: latestOrder.orderNo,
            productId: this.data.productId,
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
        storeId: getStoredMallStoreId(),
        mallEventType: 'PAYMENT_FAILURE',
        mallPage: 'store_detail',
        mallSource: 'buy_now',
        targetType: 'ORDER',
        targetId: order.id,
        eventDedupKey: `${order.id}:payment_failure`,
        properties: {
          ...analyticsProperties,
          orderId: order.id,
          orderNo: order.orderNo,
          productId: this.data.productId,
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
      storeId: getStoredMallStoreId(),
      mallEventType: 'PAYMENT_SUCCESS',
      mallPage: 'store_detail',
      mallSource: 'buy_now',
      targetType: 'ORDER',
      targetId: order.id,
      eventDedupKey: `${order.id}:payment_success`,
      properties: {
        ...analyticsProperties,
        orderId: order.id,
        orderNo: order.orderNo,
        productId: this.data.productId,
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

  openMembershipPage(mallSource = 'store_detail_member_card') {
    const product = this.data.product
    const memberSummary = buildDetailMemberAnalyticsSummary(product)

    void trackMallAnalyticsEvent({
      storeId: getStoredMallStoreId(),
      mallEventType: 'MEMBER_OPEN_MEMBERSHIP_CLICK',
      mallPage: 'store_detail',
      mallSource,
      targetType: product ? 'POST' : 'GROUP',
      targetId: product ? product.id : this.data.productId,
      properties: memberSummary,
    })

    wx.navigateTo({
      url: buildMallMembershipPageUrl({
        storeId: product ? product.storeId : getStoredMallStoreId(),
        redirectUrl: buildMallDetailRedirectUrl(this.data.productId),
        source: mallSource,
        productId: product ? product.id : this.data.productId,
        productTitle: product ? product.title : '',
      }),
    })
  },

  trackCheckoutCouponAnalytics(summary: MallCouponSummaryView | null, mallSource = 'detail_checkout_coupon_card') {
    const product = this.data.product
    if (!summary || Number(summary.orderAmount || 0) <= 0 || !product) {
      return
    }

    const couponSummary = buildMallCouponAnalyticsSummary(summary)
    const quantity = clampQuantity(Number(this.data.quantity || 1), product.stock)
    const couponProperties = {
      ...buildDetailMemberAnalyticsSummary(product),
      ...buildMallPricingAnalyticsSummary(this.data.checkoutPricingSummary),
      ...couponSummary,
      couponScenario: 'buy_now',
      quantity,
    }
    const impressionKey = buildMallCouponAnalyticsDedupKey({
      mallPage: 'store_detail',
      mallSource,
      targetId: product.id,
      summary,
      extraKey: `${product.id}:${quantity}`,
    })

    if (impressionKey !== lastDetailCouponImpressionKey) {
      lastDetailCouponImpressionKey = impressionKey
      void trackMallAnalyticsEvent({
        storeId: getStoredMallStoreId(),
        mallEventType: 'COUPON_IMPRESSION',
        mallPage: 'store_detail',
        mallSource,
        targetType: 'POST',
        targetId: product.id,
        eventDedupKey: impressionKey,
        properties: couponProperties,
      })
    }

    if (!hasAutoAppliedMallCoupon(summary)) {
      return
    }

    const autoApplyKey = `${impressionKey}:auto_apply`
    if (autoApplyKey === lastDetailCouponAutoApplyKey) {
      return
    }

    lastDetailCouponAutoApplyKey = autoApplyKey
    void trackMallAnalyticsEvent({
      storeId: getStoredMallStoreId(),
      mallEventType: 'COUPON_AUTO_APPLY',
      mallPage: 'store_detail',
      mallSource,
      targetType: 'POST',
      targetId: product.id,
      eventDedupKey: autoApplyKey,
      properties: couponProperties,
    })
  },

  onBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({
            url: '/pages/store/index',
          })
        },
      })
      return
    }

    wx.switchTab({
      url: '/pages/store/index',
    })
  },

  onGoStore() {
    wx.switchTab({
      url: '/pages/store/index',
    })
  },

  onOpenCustomerService() {
    if (!this.data.showCustomerServiceEntry) {
      wx.showToast({
        title: '客服信息准备中',
        icon: 'none',
      })
      return
    }

    this.setData({
      customerServiceVisible: true,
    })
  },

  onCloseCustomerService() {
    if (!this.data.customerServiceVisible) {
      return
    }

    this.setData({
      customerServiceVisible: false,
    })
  },

  onOpenCustomerServiceOrders() {
    const session = getStoredSession()
    const redirectUrl = buildStoreOrdersUrl('refund')

    if (!session) {
      wx.showModal({
        title: '请先登录',
        content: '登录后才能查看订单、退款进度和售后处理状态。',
        confirmText: '去登录',
        success: ({ confirm }) => {
          if (confirm) {
            savePendingLoginRedirect(redirectUrl)
            wx.navigateTo({
              url: buildStoreOrdersLoginUrl('refund'),
            })
          }
        },
      })
      return
    }

    this.setData({
      customerServiceVisible: false,
    })

    wx.navigateTo({
      url: redirectUrl,
    })
  },

  onRetryLoad() {
    if (!this.data.productId) {
      return
    }

    this.loadProductDetail(this.data.productId)
    this.loadReviews(this.data.productId)
  },

  onDecreaseQuantity() {
    this.setData(
      {
        quantity: Math.max(1, Number(this.data.quantity || 1) - 1),
      },
      () => {
        this.refreshCheckoutCouponSummary()
      },
    )
  },

  onIncreaseQuantity() {
    const product = this.data.product
    if (!product) {
      return
    }

    this.setData(
      {
        quantity: clampQuantity(Number(this.data.quantity || 1) + 1, product.stock),
      },
      () => {
        this.refreshCheckoutCouponSummary()
      },
    )
  },

  onOpenMembershipFromMemberCard() {
    this.openMembershipPage('store_detail_member_card')
  },

  showMemberPurchaseRestriction(mallSource = 'store_detail_member_intercept') {
    const product = this.data.product
    const content = product && product.memberPromptText ? product.memberPromptText : '当前商品仅会员可购买，请先开通会员后再下单。'
    const memberSummary = buildDetailMemberAnalyticsSummary(product)

    void trackMallAnalyticsEvent({
      storeId: getStoredMallStoreId(),
      mallEventType: 'MEMBER_EXCLUSIVE_INTERCEPT',
      mallPage: 'store_detail',
      mallSource,
      targetType: product ? 'POST' : 'GROUP',
      targetId: product ? product.id : this.data.productId,
      properties: memberSummary,
    })

    wx.showModal({
      title: '会员专享商品',
      content,
      showCancel: true,
      cancelText: this.data.showCustomerServiceEntry ? '问客服' : '稍后再说',
      confirmText: '去开会员',
      success: ({ confirm, cancel }) => {
        if (confirm) {
          this.openMembershipPage(`${mallSource}_membership`)
          return
        }

        if (cancel && this.data.showCustomerServiceEntry) {
          this.setData({
            customerServiceVisible: true,
          })
        }
      },
    })
  },

  async addToCart(quantity: number) {
    const product = this.data.product
    if (!product) {
      return false
    }

    if (!product.canPurchase) {
      this.showMemberPurchaseRestriction('store_detail_add_to_cart_intercept')
      return false
    }

    if (product.stock <= 0) {
      wx.showToast({
        title: '商品已售罄',
        icon: 'none',
      })
      return false
    }

    const session = getStoredSession()
    if (!session) {
      const quantities = loadGuestMallCartQuantities()
      const nextQuantity = Number(quantities[product.id] || 0) + quantity
      if (nextQuantity > product.stock) {
        wx.showToast({
          title: `库存不足，当前仅剩 ${product.stock} 件`,
          icon: 'none',
        })
        return false
      }

      quantities[product.id] = nextQuantity
      saveGuestMallCartQuantities(quantities)

      const nextProduct = {
        ...product,
        cartCount: nextQuantity,
      }

      persistProductPreview(nextProduct)
      this.setData({
        product: nextProduct,
        cartCount: countGuestMallCartItems(quantities),
      })
      return true
    }

    try {
      const cartResponse = await addMallCartItem({
        sessionToken: session.sessionToken,
        productId: product.id,
        quantity,
      })
      const nextProduct = {
        ...product,
        cartCount: getProductCartCount(cartResponse.data, product.id),
      }

      persistProductPreview(nextProduct)
      this.setData({
        product: nextProduct,
        cartCount: cartResponse.data.cartCount,
      })
      return true
    } catch (error) {
      this.handleActionError(error, '加入购物车失败')
      return false
    }
  },

  async onAddToCart() {
    const success = await this.addToCart(Number(this.data.quantity || 1))
    if (!success) {
      return
    }

    const product = this.data.product
    const memberSummary = buildDetailMemberAnalyticsSummary(product)
    void trackMallAnalyticsEvent({
      storeId: getStoredMallStoreId(),
      mallEventType: 'ADD_TO_CART',
      mallPage: 'store_detail',
      mallSource: 'product_detail',
      targetType: 'POST',
      targetId: this.data.productId,
      properties: {
        ...memberSummary,
        quantity: Number(this.data.quantity || 1),
      },
    })

    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
    })
  },

  async submitOrder() {
    const product = this.data.product
    if (!product) {
      wx.showToast({
        title: '商品信息还没准备好',
        icon: 'none',
      })
      return
    }

    if (!product.canPurchase) {
      this.showMemberPurchaseRestriction('store_detail_checkout_intercept')
      return
    }

    const purchaseQuantity = clampQuantity(Number(this.data.quantity || 1), product.stock)
    if (!product.stock || purchaseQuantity <= 0) {
      wx.showToast({
        title: '商品暂时售罄',
        icon: 'none',
      })
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    const hasShippingAddress = await this.ensureShippingAddressForCheckout()
    if (!hasShippingAddress) {
      return
    }

    const selectedAddressId = String(this.data.selectedAddressId || '')
    if (!selectedAddressId) {
      wx.showToast({
        title: '请先选择收货地址',
        icon: 'none',
      })
      return
    }

    this.setData({
      submitting: true,
    })

    try {
      const couponAnalyticsSummary = buildMallCouponAnalyticsSummary(this.data.checkoutCouponSummary)
      const checkoutAnalyticsProperties = {
        ...buildDetailMemberAnalyticsSummary(product),
        ...buildMallPricingAnalyticsSummary(this.data.checkoutPricingSummary),
        ...couponAnalyticsSummary,
        couponScenario: 'buy_now',
        quantity: purchaseQuantity,
        addressId: selectedAddressId,
      }
      const currentShareToken = getMallShareTokenForProduct(this.data.productId)
      const orderResponse = await createMallOrder({
        sessionToken: session.sessionToken,
        couponCode: this.data.checkoutCouponSummary ? this.data.checkoutCouponSummary.couponCode : '',
        shareToken: currentShareToken,
        addressId: selectedAddressId,
        productId: this.data.productId,
        quantity: purchaseQuantity,
      })
      void trackMallAnalyticsEvent({
        storeId: getStoredMallStoreId(),
        mallEventType: 'CHECKOUT_SUBMIT',
        mallPage: 'store_detail',
        mallSource: 'buy_now',
        targetType: 'ORDER',
        targetId: orderResponse.data.order.id,
        properties: {
          ...checkoutAnalyticsProperties,
          orderId: orderResponse.data.order.id,
          orderNo: orderResponse.data.order.orderNo,
        },
      })
      await this.loadProductDetail(this.data.productId)
      this.setData({
        submitting: false,
        checkoutVisible: false,
        addressPickerVisible: false,
        checkoutCouponPopupVisible: false,
        checkoutCouponPopupOptions: [],
      })
      await this.handleCreatedOrderPayment(orderResponse.data.order, orderResponse.data.payment, checkoutAnalyticsProperties)
    } catch (error) {
      this.setData({
        submitting: false,
      })

      if (isMallShareInvalidError(error)) {
        clearMallShareContext(this.data.productId)
      }

      this.handleActionError(error, '提交订单失败')
    }
  },

  async onBuyNow() {
    const product = this.data.product
    if (!product || product.stock <= 0) {
      wx.showToast({
        title: '商品暂时售罄',
        icon: 'none',
      })
      return
    }

    if (!product.canPurchase) {
      this.showMemberPurchaseRestriction('store_detail_buy_now_intercept')
      return
    }

    const memberSummary = buildDetailMemberAnalyticsSummary(product)
    void trackMallAnalyticsEvent({
      storeId: getStoredMallStoreId(),
      mallEventType: 'BUY_NOW_CLICK',
      mallPage: 'store_detail',
      mallSource: 'product_detail',
      targetType: 'POST',
      targetId: product.id,
      properties: {
        ...memberSummary,
        quantity: clampQuantity(Number(this.data.quantity || 1), product.stock),
      },
    })

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    this.setData({
      checkoutVisible: true,
      addressPickerVisible: false,
      checkoutCouponPopupVisible: false,
      checkoutCouponPopupOptions: [],
    }, () => {
      this.trackCheckoutCouponAnalytics(this.data.checkoutCouponSummary, 'detail_checkout_open')
    })

    if (!this.data.shippingAddresses.length && !this.data.addressLoading) {
      await this.loadShippingAddress(true)
    }
  },

  onOpenAddressManager() {
    this.setData({
      addressPickerVisible: false,
    })

    wx.navigateTo({
      url: buildMallAddressManagerUrl({
        redirectUrl: buildMallDetailRedirectUrl(this.data.productId),
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

  onCloseCheckoutSheet() {
    this.setData({
      checkoutVisible: false,
      addressPickerVisible: false,
      checkoutCouponPopupVisible: false,
      checkoutCouponPopupOptions: [],
    })
  },

  async onConfirmCheckout() {
    await this.submitOrder()
  },

  onShareAppMessage() {
    const product = this.data.product
    if (!product) {
      return {
        title: '饮视商城',
        path: '/pages/store/index',
      }
    }

    return {
      title: product.title,
      path: buildStoreDetailPath(product.id, this.data.shareToken),
      imageUrl: product.coverImageUrl || undefined,
    }
  },

  onShareTimeline() {
    const product = this.data.product
    if (!product) {
      return {
        title: '饮视商城',
        query: '',
      }
    }

    const queryParts = [`id=${encodeURIComponent(product.id)}`]
    if (this.data.shareToken) {
      queryParts.push(`shareToken=${encodeURIComponent(this.data.shareToken)}`)
    }

    return {
      title: product.title,
      query: queryParts.join('&'),
      imageUrl: product.coverImageUrl || undefined,
    }
  },

  noop() {},
})
