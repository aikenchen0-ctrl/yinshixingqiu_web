import { getStoredSession } from './auth'
import {
  fetchAdminMallOrders,
  shipAdminMallOrder,
  type AdminMallOrderApiItem,
  type AdminMallOrdersSummaryApiItem,
} from './admin-mall-api'
import { getStoredMallStoreId, saveMallStoreId } from './mall-store'
import { fetchMallConfig, type MallConfigApiItem } from './store-api'
import { ensureWechatSession } from './wechat-login'

interface ShippingOrderLineView {
  id: string
  title: string
  quantityText: string
  totalAmountText: string
}

interface ShippingOrderView {
  id: string
  orderNo: string
  status: string
  statusLabel: string
  statusClass: string
  shippingStatus: string
  shippingStatusLabel: string
  shippingStatusClass: string
  totalAmountText: string
  buyerName: string
  buyerMobile: string
  createdAtText: string
  shippedAtText: string
  recipientName: string
  recipientPhone: string
  fullAddress: string
  remark: string
  shippingCompanyDraft: string
  shippingTrackingNoDraft: string
  shippingRemarkDraft: string
  canShip: boolean
  isShipped: boolean
  items: ShippingOrderLineView[]
}

interface ShippingSummaryView {
  orderCount: number
  pendingCount: number
  readyToShipCount: number
  shippedCount: number
  grossAmountText: string
}

type DraftField = 'shippingCompanyDraft' | 'shippingTrackingNoDraft' | 'shippingRemarkDraft'

const EMPTY_SUMMARY: ShippingSummaryView = {
  orderCount: 0,
  pendingCount: 0,
  readyToShipCount: 0,
  shippedCount: 0,
  grossAmountText: '0.00',
}

const formatDateTime = (value: string) => {
  if (!value) {
    return ''
  }

  return value.replace('T', ' ').slice(0, 16)
}

const resolveOrderStatusClass = (status: string) => {
  if (status === 'PENDING') {
    return 'shipping-status-warning'
  }

  if (status === 'PAID') {
    return 'shipping-status-success'
  }

  return 'shipping-status-muted'
}

const resolveShippingStatusClass = (item: AdminMallOrderApiItem) => {
  if (item.shippingStatus === 'SHIPPED') {
    return 'shipping-status-success'
  }

  if (item.status === 'PAID') {
    return 'shipping-status-warning'
  }

  return 'shipping-status-muted'
}

const buildMallSourceLabel = (source: string) => {
  if (source === 'REQUEST_STORE') {
    return '页面指定店铺'
  }

  if (source === 'ENV_CONFIG') {
    return '环境配置'
  }

  if (source === 'NON_DEMO_CATALOG_SINGLETON') {
    return '自动识别唯一正式店铺'
  }

  if (source === 'CATALOG_SINGLETON') {
    return '自动识别唯一店铺'
  }

  return source ? '商城数据源' : ''
}

const mapOrderItem = (item: AdminMallOrderApiItem): ShippingOrderView => ({
  id: String(item.id || ''),
  orderNo: String(item.orderNo || ''),
  status: String(item.status || ''),
  statusLabel: String(item.statusLabel || ''),
  statusClass: resolveOrderStatusClass(String(item.status || '')),
  shippingStatus: String(item.shippingStatus || ''),
  shippingStatusLabel: String(item.shippingStatusLabel || ''),
  shippingStatusClass: resolveShippingStatusClass(item),
  totalAmountText: String(item.totalAmountText || '0.00'),
  buyerName: String((item.user && item.user.nickname) || '匿名用户'),
  buyerMobile: String((item.user && item.user.mobile) || ''),
  createdAtText: formatDateTime(String(item.createdAt || '')),
  shippedAtText: formatDateTime(String(item.shippedAt || '')),
  recipientName: String((item.shippingAddress && item.shippingAddress.recipientName) || ''),
  recipientPhone: String((item.shippingAddress && item.shippingAddress.phone) || ''),
  fullAddress: String((item.shippingAddress && item.shippingAddress.fullAddress) || ''),
  remark: String(item.remark || ''),
  shippingCompanyDraft: String(item.shippingCompany || ''),
  shippingTrackingNoDraft: String(item.shippingTrackingNo || ''),
  shippingRemarkDraft: String(item.shippingRemark || ''),
  canShip: String(item.status || '') === 'PAID',
  isShipped: String(item.shippingStatus || '') === 'SHIPPED',
  items: Array.isArray(item.items)
    ? item.items.map((line) => ({
        id: String(line.id || ''),
        title: String(line.title || '商品'),
        quantityText: `x${Number(line.quantity || 0)}`,
        totalAmountText: `¥${String(line.totalAmountText || '0.00')}`,
      }))
    : [],
})

const mapSummary = (summary?: AdminMallOrdersSummaryApiItem | null): ShippingSummaryView => ({
  orderCount: Number((summary && summary.orderCount) || 0),
  pendingCount: Number((summary && summary.pendingCount) || 0),
  readyToShipCount: Number((summary && summary.readyToShipCount) || 0),
  shippedCount: Number((summary && summary.shippedCount) || 0),
  grossAmountText: String((summary && summary.grossAmountText) || '0.00'),
})

export function registerMallShippingPage() {
  Page({
    data: {
      loading: true,
      loginRequired: false,
      storeId: '',
      storeName: '',
      storeSource: '',
      storeSourceLabel: '',
      summary: EMPTY_SUMMARY as ShippingSummaryView,
      orders: [] as ShippingOrderView[],
      submittingOrderId: '',
    },

    onLoad(options: Record<string, string>) {
      const storeId = saveMallStoreId(String(options.storeId || options.groupId || '').trim())
      if (storeId) {
        this.setData({
          storeId,
        })
      }
    },

    onShow() {
      void this.loadPage()
    },

    async ensureSession() {
      const stored = getStoredSession()
      if (stored && stored.sessionToken) {
        return stored
      }

      try {
        return await ensureWechatSession()
      } catch {
        return null
      }
    },

    async loadPage() {
      const session = await this.ensureSession()
      if (!session || !session.sessionToken) {
        this.setData({
          loading: false,
          loginRequired: true,
          storeId: '',
          storeName: '',
          storeSource: '',
          storeSourceLabel: '',
          summary: EMPTY_SUMMARY,
          orders: [],
          submittingOrderId: '',
        })
        return
      }

      this.setData({
        loading: true,
        loginRequired: false,
      })

      try {
        const response = await fetchMallConfig(this.data.storeId || getStoredMallStoreId() || undefined)
        if (!response.ok || !response.data || !response.data.storeId) {
          throw new Error('加载商城配置失败')
        }

        const mallConfig = response.data
        const storeId = saveMallStoreId(mallConfig.storeId)
        if (!storeId) {
          this.setData({
            loading: false,
            storeId: '',
            storeName: '',
            storeSource: '',
            storeSourceLabel: '',
            summary: EMPTY_SUMMARY,
            orders: [],
            submittingOrderId: '',
          })
          return
        }

        void this.loadOrders(storeId, session.sessionToken, mallConfig)
      } catch (error) {
        this.setData({
          loading: false,
          storeId: '',
          storeName: '',
          storeSource: '',
          storeSourceLabel: '',
          summary: EMPTY_SUMMARY,
          orders: [],
          submittingOrderId: '',
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '加载发货页面失败',
          icon: 'none',
        })
      }
    },

    async loadOrders(storeId: string, sessionToken?: string, mallConfig?: MallConfigApiItem | null) {
      const session = sessionToken ? null : await this.ensureSession()
      const nextSessionToken = sessionToken || (session && session.sessionToken) || ''
      if (!nextSessionToken) {
        this.setData({
          loading: false,
          loginRequired: true,
        })
        return
      }

      const normalizedStoreId = saveMallStoreId(storeId)
      const storeName = String((mallConfig && mallConfig.storeName) || this.data.storeName || '')
      const storeSource = String((mallConfig && mallConfig.source) || this.data.storeSource || '')
      const storeSourceLabel = buildMallSourceLabel(storeSource)

      this.setData({
        loading: true,
        storeId: normalizedStoreId,
        storeName,
        storeSource,
        storeSourceLabel,
      })

      try {
        const response = await fetchAdminMallOrders({
          sessionToken: nextSessionToken,
          storeId: normalizedStoreId,
          limit: 50,
        })
        if (!response.ok || !response.data) {
          throw new Error(response.message || '加载发货订单失败')
        }

        this.setData({
          loading: false,
          storeId: normalizedStoreId,
          storeName,
          storeSource,
          storeSourceLabel,
          summary: mapSummary(response.data.summary),
          orders: Array.isArray(response.data.items) ? response.data.items.map(mapOrderItem) : [],
        })
      } catch (error) {
        this.setData({
          loading: false,
          storeId: normalizedStoreId,
          storeName,
          storeSource,
          storeSourceLabel,
          summary: EMPTY_SUMMARY,
          orders: [],
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '加载发货订单失败',
          icon: 'none',
        })
      }
    },

    onDraftInput(e: WechatMiniprogram.Input) {
      const index = Number(e.currentTarget.dataset.index)
      const field = String(e.currentTarget.dataset.field || '') as DraftField
      const value = e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''

      if (!Number.isFinite(index) || index < 0) {
        return
      }

      if (field !== 'shippingCompanyDraft' && field !== 'shippingTrackingNoDraft' && field !== 'shippingRemarkDraft') {
        return
      }

      this.setData({
        [`orders[${index}].${field}`]: value,
      })
    },

    onShipTap(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const targetOrder = Number.isFinite(index) && index >= 0 ? this.data.orders[index] : null

      if (!targetOrder) {
        return
      }

      if (!targetOrder.canShip) {
        wx.showToast({
          title: targetOrder.status === 'PENDING' ? '请先确认支付' : '当前订单不可发货',
          icon: 'none',
        })
        return
      }

      if (!targetOrder.shippingCompanyDraft.trim()) {
        wx.showToast({
          title: '请输入物流公司',
          icon: 'none',
        })
        return
      }

      if (!targetOrder.shippingTrackingNoDraft.trim()) {
        wx.showToast({
          title: '请输入物流单号',
          icon: 'none',
        })
        return
      }

      wx.showModal({
        title: targetOrder.isShipped ? '更新物流' : '确认发货',
        content: `${targetOrder.isShipped ? '确认更新' : '确认录入'}订单 ${targetOrder.orderNo} 的物流信息吗？`,
        confirmText: targetOrder.isShipped ? '确认更新' : '确认发货',
        confirmColor: '#a93039',
        success: (result) => {
          if (!result.confirm) {
            return
          }

          void this.submitShip(index)
        },
      })
    },

    async submitShip(index: number) {
      const order = Number.isFinite(index) && index >= 0 ? this.data.orders[index] : null
      const storeId = this.data.storeId

      if (!order || !storeId || this.data.submittingOrderId) {
        return
      }

      const session = await this.ensureSession()
      if (!session || !session.sessionToken) {
        wx.showToast({
          title: '请先登录后再试',
          icon: 'none',
        })
        return
      }

      this.setData({
        submittingOrderId: order.id,
      })

      wx.showLoading({
        title: order.isShipped ? '更新中' : '发货中',
        mask: true,
      })

      try {
        const response = await shipAdminMallOrder({
          sessionToken: session.sessionToken,
          storeId,
          orderId: order.id,
          shippingCompany: order.shippingCompanyDraft.trim(),
          shippingTrackingNo: order.shippingTrackingNoDraft.trim(),
          shippingRemark: order.shippingRemarkDraft.trim(),
        })
        if (!response.ok || !response.data || !response.data.item) {
          throw new Error(response.message || (order.isShipped ? '更新物流失败' : '发货失败'))
        }

        wx.hideLoading()
        this.setData({
          submittingOrderId: '',
        })
        wx.showToast({
          title: order.isShipped ? '物流已更新' : '已完成发货',
          icon: 'success',
        })
        void this.loadOrders(storeId, session.sessionToken)
      } catch (error) {
        wx.hideLoading()
        this.setData({
          submittingOrderId: '',
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '发货失败',
          icon: 'none',
        })
      }
    },
  })
}
