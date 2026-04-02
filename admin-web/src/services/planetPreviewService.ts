import { apiRequest } from './apiClient'

export interface PreviewResponse {
  ok: boolean
  data: {
    user: {
      id: string
      nickname: string
    }
    group: {
      id: string
      name: string
      intro: string
      joinType: string
      status: string
    }
    policy: {
      allowJoin: boolean
      needExamine: boolean
      allowPreview: boolean
      allowSearch: boolean
    }
    pricing: {
      planId: string
      billingPeriod: string
      durationDays: number
      originalAmount: number
      payableAmount: number
    }
    coupon: null | {
      id: string
      code: string
      name: string
      discountAmount: number
    }
    channel: null | {
      id: string
      code: string
      name: string
    }
    membership: null | {
      id: string
      status: string
      expireAt: string
      isActive: boolean
    }
  }
}

export interface JoinOrderResponse {
  ok: boolean
  data: {
    order: {
      id: string
      orderNo: string
      status: string
      amount: number
      discountAmount: number
      createdAt: string
    }
    payment: {
      id: string
      channel: string
      status: string
    }
  }
}

export interface PaymentCallbackResponse {
  ok: boolean
  data: {
    order: {
      orderNo: string
      status: string
      paidAt: string | null
    }
    payment: {
      status: string
      transactionNo: string | null
    }
    membership: null | {
      status: string
      expireAt: string
    }
    idempotent?: boolean
  }
}

export interface MembershipStatusResponse {
  ok: boolean
  data: null | {
    status: string
    expireAt: string
    isActive: boolean
  }
}

export async function getPlanetPreview(groupId: string, userId: string) {
  return apiRequest<PreviewResponse>('/api/planets/preview', {
    query: {
      groupId,
      userId,
      couponCode: 'NEW1000',
      channelCode: 'CH_WECHAT_MENU_001',
    },
  })
}

export async function createJoinOrder(groupId: string, userId: string) {
  return apiRequest<JoinOrderResponse>('/api/orders/join', {
    method: 'POST',
    body: JSON.stringify({
      groupId,
      userId,
      couponCode: 'NEW1000',
      channelCode: 'CH_WECHAT_MENU_001',
      paymentChannel: 'WECHAT',
    }),
  })
}

export async function mockPayJoinOrder(orderNo: string) {
  return apiRequest<PaymentCallbackResponse>('/api/payments/mock-callback', {
    method: 'POST',
    body: JSON.stringify({
      orderNo,
      transactionNo: `WX_WEB_${Date.now()}`,
      success: true,
    }),
  })
}

export async function getMembershipStatus(groupId: string, userId: string) {
  return apiRequest<MembershipStatusResponse>('/api/memberships/status', {
    query: {
      groupId,
      userId,
    },
  })
}
