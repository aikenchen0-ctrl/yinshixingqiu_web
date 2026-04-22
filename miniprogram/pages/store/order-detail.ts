import { clearSession, getStoredSession, savePendingLoginRedirect, shouldClearSessionByError } from '../../utils/auth'
import { normalizeMallUserFacingErrorMessage } from '../../utils/mall-error'
import {
  isMallPaymentCancelled,
  pollMallOrderPaymentResult,
  requestMallWechatPayment,
} from '../../utils/mall-payment'
import { buildMallOrderPricingSummary } from '../../utils/mall-pricing'
import { normalizeAssetUrl, pickNextAssetUrl } from '../../utils/request'
import {
  confirmMallOrderReceipt,
  fetchMallOrderDetail,
  payMallOrder,
  requestMallOrderRefund,
  type MallOrderApiItem,
} from '../../utils/store-api'

const REFUND_REASON_OPTIONS = ['买错了', '暂时不想要了', '收货信息填错了', '其他原因']
const mallOrderDetailImageRetryHistory: Record<string, string[]> = {}

function resetMallOrderDetailImageRetryHistory() {
  Object.keys(mallOrderDetailImageRetryHistory).forEach((key) => {
    delete mallOrderDetailImageRetryHistory[key]
  })
}

function rememberMallOrderDetailImageUrl(assetKey: string, url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!assetKey || !normalizedUrl) {
    return
  }

  const previousUrls = mallOrderDetailImageRetryHistory[assetKey] || []
  if (previousUrls.indexOf(normalizedUrl) >= 0) {
    return
  }

  mallOrderDetailImageRetryHistory[assetKey] = previousUrls.concat(normalizedUrl)
}

function resolveNextMallOrderDetailImageUrl(assetKey: string, currentUrl: string) {
  rememberMallOrderDetailImageUrl(assetKey, currentUrl)

  const nextUrl = pickNextAssetUrl(currentUrl, mallOrderDetailImageRetryHistory[assetKey] || [])
  if (!nextUrl) {
    return ''
  }

  rememberMallOrderDetailImageUrl(assetKey, nextUrl)
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

function buildStoreOrderDetailPath(orderId: string) {
  return `/pages/store/order-detail?id=${encodeURIComponent(orderId)}`
}

function buildStoreOrderDetailLoginUrl(orderId: string) {
  return `/pages/auth/login?redirect=${encodeURIComponent(buildStoreOrderDetailPath(orderId))}`
}

function resolvePricingInspectionToneClass(level: string) {
  if (level === 'OK') {
    return 'is-ok'
  }

  if (level === 'LEGACY') {
    return 'is-legacy'
  }

  return 'is-risk'
}

function buildOrderStatusNotice(order: MallOrderApiItem) {
  if (order.refundStatus === 'PENDING') {
    return '退款申请已提交，等待商家审核。审核通过后会原路退回。'
  }

  if (order.refundStatus === 'PROCESSING') {
    return '商家已同意退款，微信退款结果正在处理中，请稍后刷新查看。'
  }

  if (order.refundStatus === 'SUCCESS') {
    return '退款已完成，款项会原路退回到你的支付账户。'
  }

  if (order.refundStatus === 'REJECTED') {
    return order.refundReviewRemark
      ? `退款申请未通过：${order.refundReviewRemark}`
      : '退款申请未通过，如需协商请联系商家。'
  }

  if (order.refundStatus === 'FAILED') {
    return '退款处理失败，请联系商家处理。'
  }

  if (order.status === 'CLOSED') {
    return '订单已关闭，如需购买请重新下单。'
  }

  if (order.shippingStatus === 'RECEIVED') {
    return '订单已收货完成；如关联分享佣金，会在收货完成后同步结算到账。'
  }

  if (order.shippingStatus === 'SHIPPED') {
    return '订单已发货，确认收货后订单才算完成；如关联分享佣金，会在收货或系统自动收货后结算。'
  }

  if (order.status === 'PAID') {
    return '订单已支付完成，商家发货后会在这里同步物流信息。'
  }

  return '订单还在等待支付确认，支付完成后商家才会开始发货。'
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

function buildOrderView(order: MallOrderApiItem) {
  const pricingSummary = buildMallOrderPricingSummary({
    publicAmount: order.publicAmount || order.totalAmount,
    orderAmount: order.totalAmount,
    couponDiscountAmount: order.couponDiscountAmount || order.discountAmount || 0,
    couponStackingRuleText: order.couponStackingRuleText || '',
  })
  const pricingInspection = order.pricingInspection || null
  const pricingInspectionIssues =
    pricingInspection && Array.isArray(pricingInspection.issues) ? pricingInspection.issues : []
  const pricingInspectionLevel =
    pricingInspection && pricingInspection.level ? pricingInspection.level : 'OK'
  const pricingInspectionLabel =
    pricingInspection && pricingInspection.levelLabel ? pricingInspection.levelLabel : '优惠结构已校验'
  const pricingInspectionSummary =
    pricingInspection && pricingInspection.summaryText ? pricingInspection.summaryText : ''

  return {
    id: order.id,
    status: String(order.status || ''),
    orderNo: String(order.orderNo || ''),
    statusLabel: String(order.statusLabel || '待支付'),
    shippingStatusLabel: String(order.shippingStatusLabel || '待发货'),
    statusNotice: buildOrderStatusNotice(order),
    canPay: Boolean(order.canPay),
    payButtonText: order.canPay ? '继续支付' : '',
    createdAtText: formatDateTime(String(order.createdAt || '')),
    publicAmountText: pricingSummary.publicAmountText,
    orderAmountText: pricingSummary.orderAmountText,
    totalAmountText: formatPrice(order.totalAmount),
    memberDiscountApplied: pricingSummary.memberDiscountApplied,
    memberDiscountAmountText: pricingSummary.memberDiscountAmountText,
    discountAmount: pricingSummary.couponDiscountAmount,
    discountAmountText: pricingSummary.couponDiscountAmountText,
    totalDiscountAmount: pricingSummary.totalDiscountAmount,
    totalDiscountAmountText: pricingSummary.totalDiscountAmountText,
    payableAmountText: formatPrice(order.payableAmount),
    couponStackingRuleText: pricingSummary.couponStackingRuleText,
    pricingInspectionVisible: Boolean(pricingInspection && pricingInspection.shouldShowPrompt),
    pricingInspectionToneClass: resolvePricingInspectionToneClass(String(pricingInspectionLevel)),
    pricingInspectionLabel: String(pricingInspectionLabel),
    pricingInspectionSummary: String(pricingInspectionSummary),
    pricingInspectionIssues: pricingInspectionIssues.map((item) => ({
      code: String(item.code || ''),
      title: String(item.title || ''),
      detail: String(item.detail || ''),
    })),
    couponName: order.coupon ? String(order.coupon.name || '') : '',
    couponStageLabel: order.coupon ? String(order.coupon.stageLabel || '') : '',
    remark: String(order.remark || ''),
    shippingCompany: String(order.shippingCompany || ''),
    shippingTrackingNo: String(order.shippingTrackingNo || ''),
    shippingRemark: String(order.shippingRemark || ''),
    shippedAtText: formatDateTime(String(order.shippedAt || '')),
    refundStatus: String(order.refundStatus || 'NONE'),
    refundStatusLabel: String(order.refundStatusLabel || ''),
    refundReason: String(order.refundReason || ''),
    refundReviewRemark: String(order.refundReviewRemark || ''),
    refundRequestedAtText: formatDateTime(String(order.refundRequestedAt || '')),
    refundReviewedAtText: formatDateTime(String(order.refundReviewedAt || '')),
    refundedAtText: formatDateTime(String(order.refundedAt || '')),
    refundAmountText: formatPrice(order.refundAmount),
    refundUserReceivedAccount: String(order.refundUserReceivedAccount || ''),
    canRequestRefund: Boolean(order.canRequestRefund),
    canConfirmReceipt: Boolean(order.canConfirmReceipt),
    shareApplied: Boolean(order.shareApplied),
    shareCommissionAmountText: String(order.shareCommissionAmountText || ''),
    shareCommissionStatusLabel: String(order.shareCommissionStatusLabel || ''),
    shareCommissionRecipientText: formatMallCommissionRecipient(order.shareCommissionRecipient),
    shippingAddress: {
      recipientName: String(order.shippingAddress.recipientName || ''),
      phone: String(order.shippingAddress.phone || ''),
      fullAddress: String(order.shippingAddress.fullAddress || ''),
    },
    items: (order.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle || '',
      coverImageUrl: normalizeAssetUrl(String(item.coverImageUrl || '')),
      coverFallbackText: item.coverFallbackText || '商品',
      quantityText: `x${item.quantity}`,
      unitPriceText: formatPrice(item.unitPrice),
      totalAmountText: formatPrice(item.totalAmount),
    })),
  }
}

Page({
  data: {
    loading: true,
    paying: false,
    refunding: false,
    confirmingReceipt: false,
    loginRequired: false,
    orderId: '',
    order: null as ReturnType<typeof buildOrderView> | null,
    emptyText: '订单详情加载中...',
  },

  onLoad(options: Record<string, string>) {
    resetMallOrderDetailImageRetryHistory()
    this.setData({
      orderId: String(options.id || ''),
    })
  },

  onShow() {
    this.loadOrderDetail()
  },

  onUnload() {
    resetMallOrderDetailImageRetryHistory()
  },

  promptLogin() {
    const orderId = this.data.orderId

    wx.showModal({
      title: '请先登录',
      content: '登录后才能查看这笔订单的完整详情。',
      confirmText: '去登录',
      success: ({ confirm }) => {
        if (confirm) {
          savePendingLoginRedirect(buildStoreOrderDetailPath(orderId))
          wx.redirectTo({
            url: buildStoreOrderDetailLoginUrl(orderId),
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
        order: null,
        emptyText: '登录已失效，请重新登录后查看订单。',
      })
      return
    }

    this.setData({
      loading: false,
      order: null,
      emptyText: normalizeMallUserFacingErrorMessage(error, fallbackMessage),
    })
  },

  handleTransientActionError(error: unknown, fallbackMessage: string) {
    if (shouldClearSessionByError(error)) {
      clearSession()
      this.setData({
        paying: false,
        refunding: false,
        confirmingReceipt: false,
        loading: false,
        loginRequired: true,
        order: null,
        emptyText: '登录已失效，请重新登录后查看订单。',
      })
      return
    }

    this.setData({
      paying: false,
      refunding: false,
      confirmingReceipt: false,
    })

    wx.showToast({
      title: error instanceof Error ? error.message : fallbackMessage,
      icon: 'none',
    })
  },

  onOrderItemImageError(event: WechatMiniprogram.BaseEvent) {
    const itemIndex = Number(event.currentTarget.dataset.itemIndex)
    const itemId = String(event.currentTarget.dataset.itemId || itemIndex)
    const order = this.data.order
    const orderItem = order && order.items ? order.items[itemIndex] : null

    if (!order || !orderItem) {
      return
    }

    const nextUrl = resolveNextMallOrderDetailImageUrl(`order_${order.id}_${itemId}`, orderItem.coverImageUrl)
    if (!nextUrl) {
      return
    }

    this.setData({
      [`order.items[${itemIndex}].coverImageUrl`]: nextUrl,
    })
  },

  async loadOrderDetail() {
    const orderId = String(this.data.orderId || '')
    if (!orderId) {
      this.setData({
        loading: false,
        emptyText: '缺少订单ID',
      })
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.setData({
        loading: false,
        loginRequired: true,
        order: null,
        emptyText: '请先登录后查看订单详情。',
      })
      return
    }

    this.setData({
      loading: true,
      loginRequired: false,
      emptyText: '订单详情加载中...',
    })

    try {
      const response = await fetchMallOrderDetail({
        sessionToken: session.sessionToken,
        orderId,
      })

      this.setData({
        loading: false,
        paying: false,
        refunding: false,
        confirmingReceipt: false,
        order: buildOrderView(response.data),
        emptyText: '',
      })
    } catch (error) {
      this.handleActionError(error, '订单详情加载失败')
    }
  },

  onRetry() {
    this.loadOrderDetail()
  },

  onOpenLogin() {
    this.promptLogin()
  },

  onGoStore() {
    wx.switchTab({
      url: '/pages/store/index',
    })
  },

  onRequestRefund() {
    const currentOrder = this.data.order
    if (!currentOrder || !currentOrder.canRequestRefund) {
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    wx.showActionSheet({
      itemList: REFUND_REASON_OPTIONS,
      success: async ({ tapIndex }) => {
        const reason = REFUND_REASON_OPTIONS[tapIndex] || REFUND_REASON_OPTIONS[0]

        this.setData({
          refunding: true,
        })

        try {
          const response = await requestMallOrderRefund({
            sessionToken: session.sessionToken,
            orderId: currentOrder.id,
            reason,
          })

          this.setData({
            refunding: false,
            order: buildOrderView(response.data.item),
          })

          wx.showToast({
            title: '退款申请已提交',
            icon: 'none',
          })
        } catch (error) {
          this.handleTransientActionError(error, '申请退款失败')
        }
      },
    })
  },

  onConfirmReceipt() {
    const currentOrder = this.data.order
    if (!currentOrder || !currentOrder.canConfirmReceipt) {
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    wx.showModal({
      title: '确认收货',
      content: '确认收货后，这笔订单会完成收货；如关联分享佣金，也会在此时进入结算。',
      confirmText: '确认收货',
      success: async ({ confirm }) => {
        if (!confirm) {
          return
        }

        this.setData({
          confirmingReceipt: true,
        })

        try {
          const response = await confirmMallOrderReceipt({
            sessionToken: session.sessionToken,
            orderId: currentOrder.id,
          })

          this.setData({
            confirmingReceipt: false,
            order: buildOrderView(response.data.item),
          })

          wx.showToast({
            title: response.data.idempotent ? '订单已收货' : '确认收货成功',
            icon: 'success',
          })
        } catch (error) {
          this.handleTransientActionError(error, '确认收货失败')
        }
      },
    })
  },

  async onPayOrder() {
    const currentOrder = this.data.order
    if (!currentOrder || !currentOrder.canPay) {
      return
    }

    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return
    }

    this.setData({
      paying: true,
    })

    try {
      const response = await payMallOrder({
        sessionToken: session.sessionToken,
        orderId: currentOrder.id,
      })
      const preparedOrder = response.data.order
      const payment = response.data.payment

      if (!payment.required) {
        this.setData({
          paying: false,
          order: buildOrderView(preparedOrder),
        })
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
            paying: false,
            order: buildOrderView(preparedOrder),
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

      let latestOrder: MallOrderApiItem | null = null

      try {
        latestOrder = await pollMallOrderPaymentResult({
          sessionToken: session.sessionToken,
          orderId: currentOrder.id,
        })
      } finally {
        wx.hideLoading()
      }

      const nextOrder = latestOrder || preparedOrder

      this.setData({
        paying: false,
        order: buildOrderView(nextOrder),
      })

      wx.showToast({
        title:
          nextOrder.status === 'PAID'
            ? '支付成功'
            : nextOrder.status === 'CLOSED'
              ? '订单已关闭'
              : '支付结果确认中',
        icon: nextOrder.status === 'PAID' ? 'success' : 'none',
      })
    } catch (error) {
      this.handleTransientActionError(error, '继续支付失败')
    }
  },
})
