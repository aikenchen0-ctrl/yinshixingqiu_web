import { clearSession, getStoredSession, savePendingLoginRedirect, shouldClearSessionByError } from '../../utils/auth'
import { normalizeMallUserFacingErrorMessage } from '../../utils/mall-error'
import { normalizeAssetUrl, pickNextAssetUrl } from '../../utils/request'
import { fetchMallCommissionOrders, type MallCommissionOrderApiItem } from '../../utils/store-api'

const STORE_COMMISSION_PATH = '/pages/store/commission'
const COMMISSION_FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待结算' },
  { key: 'confirmed', label: '已结算' },
  { key: 'cancelled', label: '已取消' },
] as const
const mallCommissionImageRetryHistory: Record<string, string[]> = {}

type CommissionFilterKey = (typeof COMMISSION_FILTER_OPTIONS)[number]['key']

interface MallCommissionCardView {
  id: string
  orderId: string
  orderNo: string
  productTitle: string
  coverImageUrl: string
  coverFallbackText: string
  commissionAmount: number
  commissionAmountText: string
  commissionBaseAmountText: string
  commissionRateText: string
  commissionStatus: string
  commissionStatusLabel: string
  statusClassName: string
  orderStatusLabel: string
  createdAtText: string
  settledAtText: string
  statusHint: string
}

interface MallCommissionSummaryView {
  orderCount: number
  totalAmountText: string
  pendingAmountText: string
  confirmedAmountText: string
}

function resetMallCommissionImageRetryHistory() {
  Object.keys(mallCommissionImageRetryHistory).forEach((key) => {
    delete mallCommissionImageRetryHistory[key]
  })
}

function rememberMallCommissionImageUrl(assetKey: string, url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!assetKey || !normalizedUrl) {
    return
  }

  const previousUrls = mallCommissionImageRetryHistory[assetKey] || []
  if (previousUrls.indexOf(normalizedUrl) >= 0) {
    return
  }

  mallCommissionImageRetryHistory[assetKey] = previousUrls.concat(normalizedUrl)
}

function resolveNextMallCommissionImageUrl(assetKey: string, currentUrl: string) {
  rememberMallCommissionImageUrl(assetKey, currentUrl)

  const nextUrl = pickNextAssetUrl(currentUrl, mallCommissionImageRetryHistory[assetKey] || [])
  if (!nextUrl) {
    return ''
  }

  rememberMallCommissionImageUrl(assetKey, nextUrl)
  return nextUrl
}

function formatPrice(value: number | string) {
  const amount = Number(value || 0)
  return `¥${amount.toFixed(2)}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildCommissionStatusClassName(status: string) {
  if (status === 'CONFIRMED') {
    return 'confirmed'
  }

  if (status === 'CANCELLED') {
    return 'cancelled'
  }

  return 'pending'
}

function buildCommissionStatusHint(order: MallCommissionOrderApiItem) {
  const status = String(order.shareCommissionStatus || 'NONE').toUpperCase()

  if (status === 'CONFIRMED') {
    return order.shareCommissionSettledAt ? '这笔佣金已经结算到账，由商家承担。' : '这笔佣金已经确认结算，由商家承担。'
  }

  if (status === 'CANCELLED') {
    return order.refundStatus !== 'NONE' ? '买家订单退款后，这笔佣金已经取消。' : '这笔佣金已取消，不再参与结算。'
  }

  if (order.shippingStatus === 'SHIPPED') {
    return '佣金由商家承担，买家确认收货或系统自动收货后才会到账。'
  }

  if (order.shippingStatus === 'RECEIVED') {
    return '买家已完成收货，佣金正在同步结算。'
  }

  if (order.status === 'PAID') {
    return '订单已支付，商家发货并完成收货后佣金才会到账。'
  }

  return '订单完成收货后会进入佣金结算，若发生退款则佣金会取消。'
}

function buildCommissionCardView(order: MallCommissionOrderApiItem): MallCommissionCardView | null {
  if (Number(order.shareCommissionAmount || 0) <= 0) {
    return null
  }

  const sharedItem =
    (order.items || []).find((item) => String(item.productId || '') === String(order.shareProductId || '')) ||
    (order.items || [])[0] ||
    null
  const productTitle = String(order.shareProductTitle || (sharedItem ? sharedItem.title : '') || '分享商品')

  return {
    id: order.id,
    orderId: order.id,
    orderNo: String(order.orderNo || ''),
    productTitle,
    coverImageUrl: normalizeAssetUrl(String((sharedItem && sharedItem.coverImageUrl) || '')),
    coverFallbackText: String((sharedItem && sharedItem.coverFallbackText) || productTitle.slice(0, 2) || '佣金'),
    commissionAmount: Number(order.shareCommissionAmount || 0),
    commissionAmountText: String(order.shareCommissionAmountText || formatPrice(order.shareCommissionAmount || 0)),
    commissionBaseAmountText: String(order.shareCommissionBaseAmountText || formatPrice(order.shareCommissionBaseAmount || 0)),
    commissionRateText: String(order.shareCommissionRateText || '0%'),
    commissionStatus: String(order.shareCommissionStatus || 'NONE').toUpperCase(),
    commissionStatusLabel: String(order.shareCommissionStatusLabel || '待结算'),
    statusClassName: buildCommissionStatusClassName(String(order.shareCommissionStatus || 'NONE').toUpperCase()),
    orderStatusLabel: String(order.statusLabel || ''),
    createdAtText: formatDateTime(String(order.createdAt || '')),
    settledAtText: formatDateTime(String(order.shareCommissionSettledAt || '')),
    statusHint: buildCommissionStatusHint(order),
  }
}

function matchesCommissionFilter(item: MallCommissionCardView, filterKey: CommissionFilterKey) {
  if (filterKey === 'all') {
    return true
  }

  if (filterKey === 'pending') {
    return item.commissionStatus === 'PENDING'
  }

  if (filterKey === 'confirmed') {
    return item.commissionStatus === 'CONFIRMED'
  }

  if (filterKey === 'cancelled') {
    return item.commissionStatus === 'CANCELLED'
  }

  return true
}

function buildCommissionSummary(items: MallCommissionCardView[]): MallCommissionSummaryView {
  const totalAmount = items.reduce((sum, item) => sum + item.commissionAmount, 0)
  const pendingAmount = items
    .filter((item) => item.commissionStatus === 'PENDING')
    .reduce((sum, item) => sum + item.commissionAmount, 0)
  const confirmedAmount = items
    .filter((item) => item.commissionStatus === 'CONFIRMED')
    .reduce((sum, item) => sum + item.commissionAmount, 0)

  return {
    orderCount: items.length,
    totalAmountText: formatPrice(totalAmount),
    pendingAmountText: formatPrice(pendingAmount),
    confirmedAmountText: formatPrice(confirmedAmount),
  }
}

function buildStoreCommissionPath(filterKey: CommissionFilterKey) {
  if (filterKey === 'all') {
    return STORE_COMMISSION_PATH
  }

  return `${STORE_COMMISSION_PATH}?filter=${encodeURIComponent(filterKey)}`
}

function buildStoreCommissionLoginUrl(filterKey: CommissionFilterKey) {
  return `/pages/auth/login?redirect=${encodeURIComponent(buildStoreCommissionPath(filterKey))}`
}

Page({
  data: {
    loading: true,
    loginRequired: false,
    filterKey: 'all' as CommissionFilterKey,
    emptyText: '分享佣金加载中...',
    allCommissions: [] as MallCommissionCardView[],
    commissions: [] as MallCommissionCardView[],
    filterOptions: COMMISSION_FILTER_OPTIONS,
    summary: buildCommissionSummary([]),
  },

  onLoad(options: Record<string, string>) {
    resetMallCommissionImageRetryHistory()
    const filter = String(options.filter || '') as CommissionFilterKey
    if (COMMISSION_FILTER_OPTIONS.some((item) => item.key === filter)) {
      this.setData({
        filterKey: filter,
      })
    }
  },

  onShow() {
    this.loadCommissions()
  },

  onUnload() {
    resetMallCommissionImageRetryHistory()
  },

  promptLogin() {
    const currentPath = buildStoreCommissionPath(this.data.filterKey)

    wx.showModal({
      title: '请先登录',
      content: '登录后才能查看你的分享佣金。',
      confirmText: '去登录',
      success: ({ confirm }) => {
        if (confirm) {
          savePendingLoginRedirect(currentPath)
          wx.redirectTo({
            url: buildStoreCommissionLoginUrl(this.data.filterKey),
          })
        }
      },
    })
  },

  handleActionError(error: unknown, fallbackMessage: string) {
    if (shouldClearSessionByError(error)) {
      clearSession()
      this.setData({
        loading: false,
        loginRequired: true,
        allCommissions: [],
        commissions: [],
        summary: buildCommissionSummary([]),
        emptyText: '登录已失效，请重新登录后查看分享佣金。',
      })
      return
    }

    this.setData({
      loading: false,
      allCommissions: [],
      commissions: [],
      summary: buildCommissionSummary([]),
      emptyText: normalizeMallUserFacingErrorMessage(error, fallbackMessage),
    })
  },

  async loadCommissions() {
    const session = getStoredSession()
    if (!session) {
      this.setData({
        loading: false,
        loginRequired: true,
        allCommissions: [],
        commissions: [],
        summary: buildCommissionSummary([]),
        emptyText: '请先登录后查看分享佣金。',
      })
      return
    }

    this.setData({
      loading: true,
      loginRequired: false,
      emptyText: '分享佣金加载中...',
    })

    try {
      const response = await fetchMallCommissionOrders(session.sessionToken)
      const allCommissions = (response.data.items || [])
        .map((item) => buildCommissionCardView(item))
        .filter((item): item is MallCommissionCardView => Boolean(item))
      const commissions = allCommissions.filter((item) => matchesCommissionFilter(item, this.data.filterKey))

      this.setData({
        loading: false,
        loginRequired: false,
        allCommissions,
        commissions,
        summary: buildCommissionSummary(allCommissions),
        emptyText: commissions.length
          ? ''
          : allCommissions.length
            ? '当前筛选条件下没有佣金订单。'
            : '你还没有分享成交的佣金订单。',
      })
    } catch (error) {
      this.handleActionError(error, '分享佣金加载失败')
    }
  },

  onChangeFilter(event: WechatMiniprogram.TouchEvent) {
    const filterKey = String(event.currentTarget.dataset.key || 'all') as CommissionFilterKey
    const allCommissions = this.data.allCommissions || []
    const commissions = allCommissions.filter((item) => matchesCommissionFilter(item, filterKey))

    this.setData({
      filterKey,
      commissions,
      emptyText: commissions.length
        ? ''
        : allCommissions.length
          ? '当前筛选条件下没有佣金订单。'
          : '你还没有分享成交的佣金订单。',
    })
  },

  onCommissionImageError(event: WechatMiniprogram.BaseEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const commissionId = String(event.currentTarget.dataset.commissionId || index)
    const commission = this.data.commissions[index]

    if (!commission) {
      return
    }

    const nextUrl = resolveNextMallCommissionImageUrl(`commission_${commissionId}`, commission.coverImageUrl)
    if (!nextUrl) {
      return
    }

    const nextData: Record<string, string> = {
      [`commissions[${index}].coverImageUrl`]: nextUrl,
    }

    const allCommissionIndex = this.data.allCommissions.findIndex((item) => item.id === commission.id)
    if (allCommissionIndex >= 0) {
      nextData[`allCommissions[${allCommissionIndex}].coverImageUrl`] = nextUrl
    }

    this.setData(nextData)
  },

  onOpenLogin() {
    this.promptLogin()
  },

  onGoStore() {
    wx.switchTab({
      url: '/pages/store/index',
    })
  },
})
