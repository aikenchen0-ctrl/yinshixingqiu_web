import { getStoredSession } from '../../utils/auth'
import {
  fetchRefundApprovalDashboard,
  requestPlanetRefundReview,
  reviewPlanetRefundRequest,
} from '../../utils/planet-api'
import { normalizeAssetUrl } from '../../utils/request'
import { ensureWechatSession } from '../../utils/wechat-login'

interface CreatedRefundApprovalItem {
  groupId: string
  groupName: string
  orderNo: string
  memberUserId: string
  nickname: string
  avatarUrl: string
  avatarText: string
  mobile: string
  refundAmountText: string
  requestedAt: string
  refundHint: string
  canReview: boolean
}

interface JoinedRefundStatusItem {
  groupId: string
  groupName: string
  ownerName: string
  orderNo: string
  refundAmountText: string
  status: string
  statusLabel: string
  statusClass: string
  actionLabel: string
  actionable: boolean
  hint: string
  submittedAt: string
  reviewedAt: string
  reviewReason: string
  updatedAt: string
}

type RefundTabKey = 'created' | 'joined'

const resolveJoinedStatusClass = (status: string) => {
  if (status === 'PENDING') {
    return 'refunds-status-pending'
  }

  if (status === 'PROCESSING') {
    return 'refunds-status-pending'
  }

  if (status === 'APPROVED') {
    return 'refunds-status-approved'
  }

  if (status === 'REJECTED') {
    return 'refunds-status-rejected'
  }

  if (status === 'AVAILABLE') {
    return 'refunds-status-available'
  }

  return 'refunds-status-muted'
}

const formatDateTime = (value: string) => {
  if (!value) {
    return ''
  }

  return value.replace('T', ' ').slice(0, 16)
}

const formatFenCurrency = (value: number) => `¥ ${(Number(value || 0) / 100).toFixed(2)}`

Page({
  data: {
    activeTab: 'created' as RefundTabKey,
    loading: true,
    createdPendingCount: 0,
    joinedPendingCount: 0,
    joinedActionableCount: 0,
    createdItems: [] as CreatedRefundApprovalItem[],
    joinedItems: [] as JoinedRefundStatusItem[],
    submittingKey: '',
  },

  onLoad(options: Record<string, string>) {
    const tab = String(options.tab || '').trim()
    if (tab === 'joined' || tab === 'created') {
      this.setData({
        activeTab: tab,
      })
    }
  },

  onShow() {
    void this.loadDashboard()
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

  async loadDashboard() {
    const session = await this.ensureSession()
    if (!session || !session.sessionToken) {
      this.setData({
        loading: false,
        createdPendingCount: 0,
        joinedPendingCount: 0,
        joinedActionableCount: 0,
        createdItems: [],
        joinedItems: [],
      })
      return
    }

    this.setData({
      loading: true,
    })

    try {
      const response = await fetchRefundApprovalDashboard(session.sessionToken)
      if (!response.ok || !response.data) {
        throw new Error(response.message || '加载退款审批失败')
      }

      const createdItems = Array.isArray(response.data.created.items)
        ? response.data.created.items.map((item) => ({
            groupId: String(item.groupId || ''),
            groupName: String(item.groupName || '饮视星球'),
            orderNo: String(item.orderNo || ''),
            memberUserId: String(item.memberUserId || ''),
            nickname: String(item.nickname || '微信用户'),
            avatarUrl: normalizeAssetUrl(String(item.avatarUrl || '')),
            avatarText: String(item.nickname || '星').slice(0, 1) || '星',
            mobile: String(item.mobile || ''),
            refundAmountText: formatFenCurrency(Number(item.refundAmount || 0)),
            requestedAt: formatDateTime(String(item.requestedAt || '')),
            refundHint: String(item.refundHint || ''),
            canReview: Boolean(item.canReview),
          }))
        : []

      const joinedItems = Array.isArray(response.data.joined.items)
        ? response.data.joined.items.map((item) => ({
            groupId: String(item.groupId || ''),
            groupName: String(item.groupName || '饮视星球'),
            ownerName: String(item.ownerName || '星主'),
            orderNo: String(item.orderNo || ''),
            refundAmountText: formatFenCurrency(Number(item.refundAmount || 0)),
            status: String(item.status || ''),
            statusLabel: String(item.statusLabel || ''),
            statusClass: resolveJoinedStatusClass(String(item.status || '')),
            actionLabel: String(item.actionLabel || ''),
            actionable: Boolean(item.actionable),
            hint: String(item.hint || ''),
            submittedAt: formatDateTime(String(item.submittedAt || '')),
            reviewedAt: formatDateTime(String(item.reviewedAt || '')),
            reviewReason: String(item.reviewReason || ''),
            updatedAt: formatDateTime(String(item.updatedAt || '')),
          }))
        : []

      this.setData({
        loading: false,
        createdPendingCount: Number(response.data.created.pendingCount || 0),
        joinedPendingCount: Number(response.data.joined.pendingCount || 0),
        joinedActionableCount: Number(response.data.joined.actionableCount || 0),
        createdItems,
        joinedItems,
      })
    } catch (error) {
      this.setData({
        loading: false,
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '加载退款审批失败',
        icon: 'none',
      })
    }
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const key = String(e.currentTarget.dataset.key || '') as RefundTabKey
    if (key !== 'created' && key !== 'joined') {
      return
    }

    this.setData({
      activeTab: key,
    })
  },

  onJoinedRequestTap(e: WechatMiniprogram.TouchEvent) {
    const groupId = String(e.currentTarget.dataset.groupId || '')
    const groupName = String(e.currentTarget.dataset.groupName || '该星球')
    const actionLabel = String(e.currentTarget.dataset.actionLabel || '申请退款')

    if (!groupId || this.data.submittingKey) {
      return
    }

    wx.showModal({
      title: actionLabel,
      content: `确认对“${groupName}”提交退款审批吗？提交后需要等待星主处理。`,
      confirmText: '确认提交',
      confirmColor: '#a93039',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        void this.submitJoinedRequest(groupId)
      },
    })
  },

  async submitJoinedRequest(groupId: string) {
    const session = await this.ensureSession()
    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录后再试',
        icon: 'none',
      })
      return
    }

    const submittingKey = `request:${groupId}`
    this.setData({
      submittingKey,
    })
    wx.showLoading({
      title: '提交中',
      mask: true,
    })

    try {
      const response = await requestPlanetRefundReview({
        groupId,
        sessionToken: session.sessionToken,
      })
      if (!response.ok) {
        throw new Error(response.message || '提交退款审批失败')
      }

      wx.hideLoading()
      this.setData({
        submittingKey: '',
        activeTab: 'joined',
      })
      wx.showToast({
        title: '已提交审批',
        icon: 'success',
      })
      void this.loadDashboard()
    } catch (error) {
      wx.hideLoading()
      this.setData({
        submittingKey: '',
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '提交退款审批失败',
        icon: 'none',
      })
    }
  },

  onApproveTap(e: WechatMiniprogram.TouchEvent) {
    const groupId = String(e.currentTarget.dataset.groupId || '')
    const orderNo = String(e.currentTarget.dataset.orderNo || '')
    const nickname = String(e.currentTarget.dataset.nickname || '该成员')

    if (!groupId || !orderNo || this.data.submittingKey) {
      return
    }

    wx.showModal({
      title: '通过退款审批',
      content: `确认通过 ${nickname} 的退款申请吗？通过后会自动退款并移出该成员。`,
      confirmText: '确认通过',
      confirmColor: '#a93039',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        void this.submitReview(groupId, orderNo, 'APPROVE')
      },
    })
  },

  onRejectTap(e: WechatMiniprogram.TouchEvent) {
    const groupId = String(e.currentTarget.dataset.groupId || '')
    const orderNo = String(e.currentTarget.dataset.orderNo || '')
    const nickname = String(e.currentTarget.dataset.nickname || '该成员')

    if (!groupId || !orderNo || this.data.submittingKey) {
      return
    }

    wx.showModal({
      title: '驳回退款审批',
      content: `确认驳回 ${nickname} 的退款申请吗？成员会继续保留在星球中。`,
      confirmText: '确认驳回',
      confirmColor: '#6a7680',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        void this.submitReview(groupId, orderNo, 'REJECT')
      },
    })
  },

  async submitReview(groupId: string, orderNo: string, action: 'APPROVE' | 'REJECT') {
    const session = await this.ensureSession()
    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录后再试',
        icon: 'none',
      })
      return
    }

    const submittingKey = `${action}:${orderNo}`
    this.setData({
      submittingKey,
    })
    wx.showLoading({
      title: action === 'APPROVE' ? '审批通过中' : '驳回中',
      mask: true,
    })

    try {
      const response = await reviewPlanetRefundRequest({
        groupId,
        orderNo,
        action,
        reviewReason: action === 'REJECT' ? '星主已驳回退款申请' : '',
        sessionToken: session.sessionToken,
      })

      if (!response.ok) {
        throw new Error(response.message || '退款审批失败')
      }

      wx.hideLoading()
      this.setData({
        submittingKey: '',
        activeTab: 'created',
      })
      wx.showToast({
        title: action === 'APPROVE' ? '已通过退款' : '已驳回申请',
        icon: 'success',
      })
      void this.loadDashboard()
    } catch (error) {
      wx.hideLoading()
      this.setData({
        submittingKey: '',
      })
      wx.showToast({
        title: error instanceof Error ? error.message : '退款审批失败',
        icon: 'none',
      })
    }
  },
})
