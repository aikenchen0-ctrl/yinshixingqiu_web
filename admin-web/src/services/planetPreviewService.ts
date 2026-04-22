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

export interface ReapplyJoinReviewResponse {
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
    membership: null | {
      status: string
      expireAt?: string | null
      isActive?: boolean
      orderNo?: string
      appliedAt?: string | null
      reviewReason?: string
      reviewedAt?: string | null
    }
    idempotent: boolean
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
      expireAt?: string | null
      isActive?: boolean
      orderNo?: string
      appliedAt?: string | null
      reviewReason?: string
      reviewedAt?: string | null
    }
    idempotent?: boolean
  }
}

export interface MembershipStatusResponse {
  ok: boolean
  data: null | {
    status: string
    expireAt?: string | null
    isActive: boolean
    orderNo?: string
    appliedAt?: string | null
    reviewReason?: string
    reviewedAt?: string | null
  }
}

export interface JoinCouponListResponse {
  ok: boolean
  data: {
    group: {
      id: string
      name: string
      joinType: string
      priceAmount: number
    }
    items: Array<{
      id: string
      code: string
      name: string
      amount: number
      amountText: string
      totalQuantity: number | null
      usedQuantity: number
      remainingQuantity: number | null
      validFrom?: string | null
      validTo?: string | null
      status: string
      isRecommended?: boolean
    }>
  }
}

export interface JoinChannelListResponse {
  ok: boolean
  data: {
    group: {
      id: string
      name: string
    }
    items: Array<{
      id: string
      code: string
      name: string
      qrCodeUrl: string
    }>
  }
}

export async function getPlanetPreview(groupId: string, userId: string, options?: { couponCode?: string; channelCode?: string }) {
  return apiRequest<PreviewResponse>('/api/planets/preview', {
    query: {
      groupId,
      userId,
      couponCode: options?.couponCode || '',
      channelCode: options?.channelCode || '',
    },
  })
}

export async function fetchJoinCoupons(groupId: string) {
  return apiRequest<JoinCouponListResponse>('/api/planets/join-coupons', {
    query: {
      groupId,
    },
  })
}

export async function fetchJoinChannels(groupId: string) {
  return apiRequest<JoinChannelListResponse>('/api/planets/join-channels', {
    query: {
      groupId,
    },
  })
}

export async function createJoinOrder(groupId: string, userId: string, options?: { couponCode?: string; channelCode?: string }) {
  return apiRequest<JoinOrderResponse>('/api/orders/join', {
    method: 'POST',
    body: JSON.stringify({
      groupId,
      userId,
      couponCode: options?.couponCode || '',
      channelCode: options?.channelCode || '',
      paymentChannel: 'WECHAT',
    }),
  })
}

export async function reapplyJoinReview(groupId: string, userId: string) {
  return apiRequest<ReapplyJoinReviewResponse>('/api/orders/join/reapply', {
    method: 'POST',
    body: JSON.stringify({
      groupId,
      userId,
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
