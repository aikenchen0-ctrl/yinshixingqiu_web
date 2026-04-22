import { request } from './request'
import type { MallOrderApiItem } from './store-api'

export interface AdminMallOrderApiItem extends MallOrderApiItem {
  user?: {
    id: string
    nickname: string
    mobile: string
  }
}

export interface AdminMallOrdersSummaryApiItem {
  orderCount: number
  pendingCount: number
  readyToShipCount: number
  shippedCount: number
  refundPendingCount?: number
  refundProcessingCount?: number
  refundedCount?: number
  grossAmount: number
  grossAmountText: string
}

interface AdminMallOrdersResponse {
  ok: boolean
  message?: string
  data: {
    summary: AdminMallOrdersSummaryApiItem
    items: AdminMallOrderApiItem[]
  }
}

interface AdminMallOrderMutationResponse {
  ok: boolean
  message?: string
  data: {
    item: AdminMallOrderApiItem
  }
}

export function fetchAdminMallOrders(input: {
  sessionToken: string
  storeId: string
  limit?: number
}) {
  const queryParts = [`storeId=${encodeURIComponent(input.storeId)}`]
  if (input.limit) {
    queryParts.push(`limit=${encodeURIComponent(String(input.limit))}`)
  }

  return request<AdminMallOrdersResponse>({
    url: `/api/admin/mall/orders?${queryParts.join('&')}`,
    sessionToken: input.sessionToken,
  })
}

export function shipAdminMallOrder(input: {
  sessionToken: string
  storeId: string
  orderId: string
  shippingCompany: string
  shippingTrackingNo: string
  shippingRemark?: string
}) {
  return request<AdminMallOrderMutationResponse>({
    url: '/api/admin/mall/orders/ship',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      storeId: input.storeId,
      orderId: input.orderId,
      shippingCompany: input.shippingCompany,
      shippingTrackingNo: input.shippingTrackingNo,
      shippingRemark: input.shippingRemark || '',
    },
  })
}
