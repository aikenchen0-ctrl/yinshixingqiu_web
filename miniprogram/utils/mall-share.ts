const MALL_SHARE_CONTEXT_STORAGE_KEY = 'xueyin_mall_share_context'
const MALL_SHARE_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface MallShareContext {
  productId: string
  shareToken: string
  sharedAt: number
}

function normalizeMallShareContext(value: unknown): MallShareContext | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const context = value as Partial<MallShareContext>
  const productId = String(context.productId || '').trim()
  const shareToken = String(context.shareToken || '').trim()
  const sharedAt = Number(context.sharedAt || 0)

  if (!productId || !shareToken || !Number.isFinite(sharedAt) || sharedAt <= 0) {
    return null
  }

  if (Date.now() - sharedAt > MALL_SHARE_CONTEXT_TTL_MS) {
    return null
  }

  return {
    productId,
    shareToken,
    sharedAt,
  }
}

export function getMallShareContext(productId?: string) {
  try {
    const context = normalizeMallShareContext(wx.getStorageSync(MALL_SHARE_CONTEXT_STORAGE_KEY))
    if (!context) {
      wx.removeStorageSync(MALL_SHARE_CONTEXT_STORAGE_KEY)
      return null
    }

    if (productId && context.productId !== productId) {
      return null
    }

    return context
  } catch {
    return null
  }
}

export function saveMallShareContext(input: {
  productId: string
  shareToken: string
}) {
  const productId = String(input.productId || '').trim()
  const shareToken = String(input.shareToken || '').trim()
  if (!productId || !shareToken) {
    return
  }

  try {
    wx.setStorageSync(MALL_SHARE_CONTEXT_STORAGE_KEY, {
      productId,
      shareToken,
      sharedAt: Date.now(),
    })
  } catch {}
}

export function clearMallShareContext(productId?: string) {
  try {
    const context = getMallShareContext()
    if (!context) {
      wx.removeStorageSync(MALL_SHARE_CONTEXT_STORAGE_KEY)
      return
    }

    if (productId && context.productId !== productId) {
      return
    }

    wx.removeStorageSync(MALL_SHARE_CONTEXT_STORAGE_KEY)
  } catch {}
}

export function getMallShareTokenForProduct(productId: string) {
  const context = getMallShareContext(productId)
  return context ? context.shareToken : ''
}

export function getMallShareTokenForProductIds(productIds: string[]) {
  const context = getMallShareContext()
  if (!context) {
    return ''
  }

  return productIds.indexOf(context.productId) >= 0 ? context.shareToken : ''
}

export function buildStoreDetailPath(productId: string, shareToken?: string) {
  const normalizedProductId = String(productId || '').trim()
  if (!normalizedProductId) {
    return '/pages/store/index'
  }

  const queryParts = [`id=${encodeURIComponent(normalizedProductId)}`]
  const normalizedShareToken = String(shareToken || '').trim()
  if (normalizedShareToken) {
    queryParts.push(`shareToken=${encodeURIComponent(normalizedShareToken)}`)
  }

  return `/pages/store/detail?${queryParts.join('&')}`
}

export function isMallShareInvalidError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.indexOf('分享信息无效') >= 0
}
