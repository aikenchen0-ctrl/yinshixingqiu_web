import { clearSession, getStoredSession, savePendingLoginRedirect, shouldClearSessionByError } from '../../utils/auth'
import { normalizeMallUserFacingErrorMessage } from '../../utils/mall-error'
import {
  isMallPaymentCancelled,
  pollMallOrderPaymentResult,
  requestMallWechatPayment,
} from '../../utils/mall-payment'
import { normalizeAssetUrl, pickNextAssetUrl } from '../../utils/request'
import { fetchMallOrders, payMallOrder, type MallOrderApiItem } from '../../utils/store-api'

const STORE_ORDERS_PATH = '/pages/store/orders'
const ORDER_FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'pay', label: '待支付' },
  { key: 'ship', label: '待收货' },
  { key: 'refund', label: '退款相关' },
] as const
const mallOrdersImageRetryHistory: Record<string, string[]> = {}

type OrderFilterKey = (typeof ORDER_FILTER_OPTIONS)[number]['key']

interface MallOrderPreviewItemView {
  id: string
  title: string
  coverImageUrl: string
  coverFallbackText: string
  quantityText: string
}

interface MallOrderCardView {
  id: string
  orderNo: string
  status: string
  shippingStatus: string
  refundStatus: string
  statusLabel: string
  shippingStatusLabel: string
  refundStatusLabel: string
  createdAtText: string
  totalAmountText: string
  itemCountText: string
  shippingNote: string
  commissionRecipientText: string
  items: MallOrderPreviewItemView[]
  hasMoreItems: boolean
  canPay: boolean
}

function formatMallCommissionRecipient(
  recipient?: {
    id: string
    nickname: string
    mobile: string
  } | null,
) {
  if (!recipient) {
    return ''
  }

  const nickname = String(recipient.nickname || '').trim()
  const mobile = String(recipient.mobile || '').trim()
  const userId = String(recipient.id || '').trim()
  const displayName = nickname || (userId ? `用户${userId.slice(-4)}` : '')

  return [displayName, mobile].filter(Boolean).join(' · ')
}

function resetMallOrdersImageRetryHistory() {
  Object.keys(mallOrdersImageRetryHistory).forEach((key) => {
    delete mallOrdersImageRetryHistory[key]
  })
}

function rememberMallOrdersImageUrl(assetKey: string, url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!assetKey || !normalizedUrl) {
    return
  }

  const previousUrls = mallOrdersImageRetryHistory[assetKey] || []
  if (previousUrls.indexOf(normalizedUrl) >= 0) {
    return
  }

  mallOrdersImageRetryHistory[assetKey] = previousUrls.concat(normalizedUrl)
}

function resolveNextMallOrdersImageUrl(assetKey: string, currentUrl: string) {
  rememberMallOrdersImageUrl(assetKey, currentUrl)

  const nextUrl = pickNextAssetUrl(currentUrl, mallOrdersImageRetryHistory[assetKey] || [])
  if (!nextUrl) {
    return ''
  }

  rememberMallOrdersImageUrl(assetKey, nextUrl)
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

function buildOrderPreviewItems(order: MallOrderApiItem) {
  return (order.items || []).slice(0, 2).map((item) => ({
    id: item.id,
    title: item.title,
    coverImageUrl: normalizeAssetUrl(String(item.coverImageUrl || '')),
    coverFallbackText: item.coverFallbackText || '商品',
    quantityText: `x${item.quantity}`,
  }))
}

function buildOrderShippingNote(order: MallOrderApiItem) {
  if (order.refundStatus === 'PENDING') {
    return '退款申请待商家审核'
  }

  if (order.refundStatus === 'PROCESSING') {
    return '退款处理中，款项会原路退回'
  }

  if (order.refundStatus === 'SUCCESS') {
    return '订单已退款'
  }

  if (order.refundStatus === 'FAILED') {
    return '退款处理失败，请联系商家'
  }

  if (order.refundStatus === 'REJECTED') {
    return '退款申请未通过，订单仍待处理'
  }

  if (order.status === 'CLOSED') {
    return '订单已关闭，如需购买请重新下单'
  }

  if (order.shippingStatus === 'RECEIVED') {
    return '订单已收货完成'
  }

  if (order.shippingStatus === 'SHIPPED') {
    const company = String(order.shippingCompany || '').trim()
    const trackingNo = String(order.shippingTrackingNo || '').trim()
    const detailText = [company, trackingNo].filter(Boolean).join(' ')
    return detailText || '订单已发货'
  }

  return `收货人 ${order.shippingAddress.recipientName} ${order.shippingAddress.phone}`
}

function buildOrderCardView(order: MallOrderApiItem): MallOrderCardView {
  return {
    id: order.id,
    orderNo: String(order.orderNo || ''),
    status: String(order.status || ''),
    shippingStatus: String(order.shippingStatus || ''),
    refundStatus: String(order.refundStatus || 'NONE'),
    statusLabel: String(order.statusLabel || '待支付'),
    shippingStatusLabel: String(order.shippingStatusLabel || '待发货'),
    refundStatusLabel: String(order.refundStatusLabel || ''),
    createdAtText: formatDateTime(String(order.createdAt || '')),
    totalAmountText: formatPrice(order.totalAmount),
    itemCountText: `${Number(order.itemCount || 0)} 件商品`,
    shippingNote: buildOrderShippingNote(order),
    commissionRecipientText:
      order.shareApplied && order.shareCommissionRecipient
        ? `佣金获得者 ${formatMallCommissionRecipient(order.shareCommissionRecipient)}`
        : '',
    items: buildOrderPreviewItems(order),
    hasMoreItems: Array.isArray(order.items) && order.items.length > 2,
    canPay: Boolean(order.canPay),
  }
}

function matchesOrderFilter(order: MallOrderCardView, filterKey: OrderFilterKey) {
  if (filterKey === 'all') {
    return true
  }

  if (filterKey === 'pay') {
    return order.status === 'PENDING'
  }

  if (filterKey === 'ship') {
    return (
      order.status === 'PAID' &&
      order.shippingStatus === 'SHIPPED' &&
      order.refundStatus !== 'PENDING' &&
      order.refundStatus !== 'PROCESSING' &&
      order.refundStatus !== 'SUCCESS'
    )
  }

  if (filterKey === 'refund') {
    return order.refundStatus !== 'NONE'
  }

  return true
}

function buildStoreOrdersPath(filterKey: OrderFilterKey) {
  if (filterKey === 'all') {
    return STORE_ORDERS_PATH
  }

  return `${STORE_ORDERS_PATH}?filter=${encodeURIComponent(filterKey)}`
}

function buildStoreOrdersLoginUrl(filterKey: OrderFilterKey) {
  return `/pages/auth/login?redirect=${encodeURIComponent(buildStoreOrdersPath(filterKey))}`
}

function buildStoreOrderDetailUrl(orderId: string) {
  return `/pages/store/order-detail?id=${encodeURIComponent(orderId)}`
}

Page({
  data: {
    loading: true,
    payingOrderId: '',
    loginRequired: false,
    filterKey: 'all' as OrderFilterKey,
    emptyText: '订单加载中...',
    allOrders: [] as MallOrderCardView[],
    orders: [] as MallOrderCardView[],
    filterOptions: ORDER_FILTER_OPTIONS,
  },

  onLoad(options: Record<string, string>) {
    resetMallOrdersImageRetryHistory()
    const filter = String(options.filter || '') as OrderFilterKey
    if (ORDER_FILTER_OPTIONS.some((item) => item.key === filter)) {
      this.setData({
        filterKey: filter,
      })
    }
  },

  onShow() {
    this.loadOrders()
  },

  onUnload() {
    resetMallOrdersImageRetryHistory()
  },

  promptLogin() {
    const currentPath = buildStoreOrdersPath(this.data.filterKey)

    wx.showModal({
      title: '请先登录',
      content: '登录后才能查看你在商城里提交过的订单。',
      confirmText: '去登录',
      success: ({ confirm }) => {
        if (confirm) {
          savePendingLoginRedirect(currentPath)
          wx.redirectTo({
            url: buildStoreOrdersLoginUrl(this.data.filterKey),
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
        allOrders: [],
        orders: [],
        emptyText: '登录已失效，请重新登录后查看订单。',
      })
      return
    }

    this.setData({
      loading: false,
      allOrders: [],
      orders: [],
      emptyText: normalizeMallUserFacingErrorMessage(error, fallbackMessage),
    })
  },

  handleTransientActionError(error: unknown, fallbackMessage: string) {
    if (shouldClearSessionByError(error)) {
      clearSession()
      this.setData({
        payingOrderId: '',
        loading: false,
        loginRequired: true,
        allOrders: [],
        orders: [],
        emptyText: '登录已失效，请重新登录后查看订单。',
      })
      return
    }

    this.setData({
      payingOrderId: '',
    })

    wx.showToast({
      title: error instanceof Error ? error.message : fallbackMessage,
      icon: 'none',
    })
  },

  async loadOrders() {
    const session = getStoredSession()
    if (!session) {
      this.setData({
        loading: false,
        loginRequired: true,
        allOrders: [],
        orders: [],
        emptyText: '请先登录后查看订单。',
      })
      return
    }

    this.setData({
      loading: true,
      loginRequired: false,
      emptyText: '订单加载中...',
    })

    try {
      const response = await fetchMallOrders(session.sessionToken)
      const allOrders = (response.data.items || []).map((item) => buildOrderCardView(item))
      const orders = allOrders.filter((item) => matchesOrderFilter(item, this.data.filterKey))

      this.setData({
        loading: false,
        payingOrderId: '',
        loginRequired: false,
        allOrders,
        orders,
        emptyText: orders.length ? '' : allOrders.length ? '当前筛选条件下没有订单。' : '你还没有提交过商城订单。',
      })
    } catch (error) {
      this.handleActionError(error, '订单加载失败')
    }
  },

  onRetry() {
    this.loadOrders()
  },

  onOpenLogin() {
    this.promptLogin()
  },

  onChangeFilter(event: WechatMiniprogram.TouchEvent) {
    const filterKey = String(event.currentTarget.dataset.key || 'all') as OrderFilterKey
    const allOrders = this.data.allOrders || []
    const orders = allOrders.filter((item) => matchesOrderFilter(item, filterKey))

    this.setData({
      filterKey,
      orders,
      emptyText: orders.length ? '' : allOrders.length ? '当前筛选条件下没有订单。' : '你还没有提交过商城订单。',
    })
  },

  onOpenOrderDetail(event: WechatMiniprogram.TouchEvent) {
    const orderId = String(event.currentTarget.dataset.id || '')
    if (!orderId) {
      return
    }

    wx.navigateTo({
      url: buildStoreOrderDetailUrl(orderId),
    })
  },

  onOrderItemImageError(event: WechatMiniprogram.BaseEvent) {
    const orderIndex = Number(event.currentTarget.dataset.orderIndex)
    const itemIndex = Number(event.currentTarget.dataset.itemIndex)
    const orderId = String(event.currentTarget.dataset.orderId || '')
    const itemId = String(event.currentTarget.dataset.itemId || '')
    const order = this.data.orders[orderIndex]
    const orderItem = order && order.items ? order.items[itemIndex] : null

    if (!order || !orderItem) {
      return
    }

    const nextUrl = resolveNextMallOrdersImageUrl(`order_${orderId}_${itemId}`, orderItem.coverImageUrl)
    if (!nextUrl) {
      return
    }

    const nextData: Record<string, string> = {
      [`orders[${orderIndex}].items[${itemIndex}].coverImageUrl`]: nextUrl,
    }

    const allOrderIndex = this.data.allOrders.findIndex((item) => item.id === orderId)
    const allItemIndex =
      allOrderIndex >= 0 ? this.data.allOrders[allOrderIndex].items.findIndex((item) => item.id === itemId) : -1

    if (allOrderIndex >= 0 && allItemIndex >= 0) {
      nextData[`allOrders[${allOrderIndex}].items[${allItemIndex}].coverImageUrl`] = nextUrl
    }

    this.setData(nextData)
  },

  async onPayOrder(event: WechatMiniprogram.TouchEvent) {
    const orderId = String(event.currentTarget.dataset.id || '')
    if (!orderId) {
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    this.setData({
      payingOrderId: orderId,
    })

    try {
      const response = await payMallOrder({
        sessionToken: session.sessionToken,
        orderId,
      })
      const preparedOrder = response.data.order
      const payment = response.data.payment

      if (!payment.required) {
        await this.loadOrders()
        wx.showToast({
          title: preparedOrder.status === 'PAID' ? '订单已支付' : '订单状态已更新',
          icon: 'none',
        })
        return
      }

      if (!payment.request) {
        throw new Error(payment.errorMessage || '暂时未获取到支付参数，请稍后再试')
      }

      try {
        await requestMallWechatPayment(payment.request)
      } catch (error) {
        if (isMallPaymentCancelled(error)) {
          this.setData({
            payingOrderId: '',
          })
          wx.showToast({
            title: '已取消支付',
            icon: 'none',
          })
          return
        }

        throw new Error('微信支付未完成，请稍后重试')
      }

      wx.showLoading({
        title: '确认支付结果',
        mask: true,
      })

      try {
        await pollMallOrderPaymentResult({
          sessionToken: session.sessionToken,
          orderId,
        })
      } finally {
        wx.hideLoading()
      }

      await this.loadOrders()
      wx.showToast({
        title: '支付结果已刷新',
        icon: 'none',
      })
    } catch (error) {
      this.handleTransientActionError(error, '继续支付失败')
    }
  },
})
