import { request } from './request'
import type { PlanetRemoteProfile } from './planet'

interface DiscoverPlanetsResponse {
  ok: boolean
  data: PlanetRemoteProfile[]
}

interface MyPlanetsResponse {
  ok: boolean
  data: PlanetRemoteProfile[]
}

interface JoinedPlanetsResponse {
  ok: boolean
  data: PlanetRemoteProfile[]
}

interface MembershipStatusResponse {
  ok: boolean
  data: {
    status: string
    expireAt?: string
    isActive: boolean
  } | null
}

interface JoinOrderResponse {
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

interface MockPaymentResponse {
  ok: boolean
  data: {
    order: {
      orderNo: string
      status: string
      paidAt?: string
    }
    payment: {
      status: string
      transactionNo?: string
    }
    membership: {
      status: string
      expireAt?: string
    } | null
    idempotent: boolean
  }
}

export function fetchDiscoverPlanets(sessionToken?: string, limit = 12) {
  const query = [`limit=${encodeURIComponent(String(limit))}`]

  if (sessionToken) {
    query.push(`sessionToken=${encodeURIComponent(sessionToken)}`)
  }

  return request<DiscoverPlanetsResponse>({
    url: `/api/planets/discover?${query.join('&')}`,
  })
}

export function fetchMyPlanets(sessionToken: string) {
  return request<MyPlanetsResponse>({
    url: `/api/planets/mine?sessionToken=${encodeURIComponent(sessionToken)}`,
  })
}

export function fetchJoinedPlanets(sessionToken: string) {
  return request<JoinedPlanetsResponse>({
    url: `/api/planets/joined?sessionToken=${encodeURIComponent(sessionToken)}`,
  })
}

export function fetchMembershipStatus(groupId: string, userId: string) {
  return request<MembershipStatusResponse>({
    url: `/api/memberships/status?groupId=${encodeURIComponent(groupId)}&userId=${encodeURIComponent(userId)}`,
  })
}

export function createJoinOrder(payload: {
  groupId: string
  userId: string
  paymentChannel?: string
  couponCode?: string
  channelCode?: string
}) {
  return request<JoinOrderResponse>({
    url: '/api/orders/join',
    method: 'POST',
    data: payload,
  })
}

export function mockJoinPayment(payload: {
  orderNo: string
  transactionNo: string
  success?: boolean
}) {
  return request<MockPaymentResponse>({
    url: '/api/payments/mock-callback',
    method: 'POST',
    data: payload,
  })
}
