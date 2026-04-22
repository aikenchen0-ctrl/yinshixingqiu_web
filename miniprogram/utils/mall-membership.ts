const DEFAULT_MALL_MEMBERSHIP_REDIRECT_URL = '/pages/store/index'
const MALL_MEMBERSHIP_REVIEW_NOTICE_STORAGE_KEY = 'xueyin_mall_membership_review_notice_v1'
const MALL_MEMBERSHIP_REVIEW_NOTICE_MAX_AGE_MS = 10 * 60 * 1000

export interface MallMembershipReviewNotice {
  title: string
  content: string
  redirectUrl: string
  mallSource: string
  productId: string
  productTitle: string
  createdAt: number
}

function normalizeMallMembershipRedirectUrl(redirectUrl?: string) {
  const normalizedRedirectUrl = String(redirectUrl || '').trim()
  return normalizedRedirectUrl || DEFAULT_MALL_MEMBERSHIP_REDIRECT_URL
}

function isMallStoreTabUrl(url: string) {
  return String(url || '').trim().startsWith('/pages/store/index')
}

function normalizeMallMembershipReviewNotice(value: unknown): MallMembershipReviewNotice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const notice = value as Partial<MallMembershipReviewNotice>
  const createdAt = Number(notice.createdAt || 0)
  if (!createdAt || Date.now() - createdAt > MALL_MEMBERSHIP_REVIEW_NOTICE_MAX_AGE_MS) {
    return null
  }

  const title = String(notice.title || '').trim()
  const content = String(notice.content || '').trim()
  const redirectUrl = String(notice.redirectUrl || '').trim()
  if (!title || !content || !redirectUrl) {
    return null
  }

  return {
    title,
    content,
    redirectUrl,
    mallSource: String(notice.mallSource || '').trim(),
    productId: String(notice.productId || '').trim(),
    productTitle: String(notice.productTitle || '').trim(),
    createdAt,
  }
}

export function buildMallMembershipPageUrl(input: {
  storeId?: string
  storeName?: string
  redirectUrl?: string
  source?: string
  productId?: string
  productTitle?: string
} = {}) {
  const storeId = String(input.storeId || '').trim()
  const storeName = String(input.storeName || '').trim()
  const queryParts: string[] = []
  const redirectUrl = normalizeMallMembershipRedirectUrl(input.redirectUrl)
  const source = String(input.source || '').trim()
  const productId = String(input.productId || '').trim()
  const productTitle = String(input.productTitle || '').trim()

  if (storeId) {
    queryParts.push(`id=${encodeURIComponent(storeId)}`)
    queryParts.push('source=discover')

    if (storeName) {
      queryParts.push(`name=${encodeURIComponent(storeName)}`)
    }
    if (redirectUrl) {
      queryParts.push(`mallRedirect=${encodeURIComponent(redirectUrl)}`)
    }
    if (source) {
      queryParts.push(`mallSource=${encodeURIComponent(source)}`)
    }
    if (productId) {
      queryParts.push(`mallProductId=${encodeURIComponent(productId)}`)
    }
    if (productTitle) {
      queryParts.push(`mallProductTitle=${encodeURIComponent(productTitle)}`)
    }

    return `/pages/planet/home?${queryParts.join('&')}`
  }

  if (redirectUrl) {
    queryParts.push(`redirect=${encodeURIComponent(redirectUrl)}`)
  }
  if (source) {
    queryParts.push(`source=${encodeURIComponent(source)}`)
  }
  if (productId) {
    queryParts.push(`productId=${encodeURIComponent(productId)}`)
  }
  if (productTitle) {
    queryParts.push(`productTitle=${encodeURIComponent(productTitle)}`)
  }

  return `/pages/membership/index${queryParts.length ? `?${queryParts.join('&')}` : ''}`
}

export function navigateAfterMallMembershipOpen(redirectUrl?: string) {
  const normalizedRedirectUrl = normalizeMallMembershipRedirectUrl(redirectUrl)

  if (isMallStoreTabUrl(normalizedRedirectUrl)) {
    wx.switchTab({
      url: normalizedRedirectUrl,
      fail: () => {
        wx.reLaunch({
          url: normalizedRedirectUrl,
          fail: () => {},
        })
      },
    })
    return
  }

  wx.redirectTo({
    url: normalizedRedirectUrl,
    fail: () => {
      wx.reLaunch({
        url: normalizedRedirectUrl,
        fail: () => {},
      })
    },
  })
}

export function saveMallMembershipReviewNotice(input: {
  redirectUrl?: string
  mallSource?: string
  productId?: string
  productTitle?: string
} = {}) {
  const redirectUrl = normalizeMallMembershipRedirectUrl(input.redirectUrl)
  const productTitle = String(input.productTitle || '').trim()
  const notice: MallMembershipReviewNotice = {
    title: '会员申请已提交',
    content: productTitle
      ? `你已提交“${productTitle}”相关会员开通申请，当前正在等待审核。审核通过前，会员价和会员专享商品不会立即解锁。`
      : '你已提交会员开通申请，当前正在等待审核。审核通过前，会员价和会员专享商品不会立即解锁。',
    redirectUrl,
    mallSource: String(input.mallSource || '').trim(),
    productId: String(input.productId || '').trim(),
    productTitle,
    createdAt: Date.now(),
  }

  try {
    wx.setStorageSync(MALL_MEMBERSHIP_REVIEW_NOTICE_STORAGE_KEY, notice)
  } catch {}

  return notice
}

export function consumeMallMembershipReviewNotice() {
  try {
    const notice = normalizeMallMembershipReviewNotice(wx.getStorageSync(MALL_MEMBERSHIP_REVIEW_NOTICE_STORAGE_KEY))
    wx.removeStorageSync(MALL_MEMBERSHIP_REVIEW_NOTICE_STORAGE_KEY)
    return notice
  } catch {
    return null
  }
}

export function showMallMembershipReviewNoticeIfNeeded() {
  const notice = consumeMallMembershipReviewNotice()
  if (!notice) {
    return false
  }

  wx.showModal({
    title: notice.title,
    content: `${notice.content}\n\n审核通过后，再回到商城即可按会员权益继续购买。`,
    showCancel: false,
    confirmText: '知道了',
  })

  return true
}
