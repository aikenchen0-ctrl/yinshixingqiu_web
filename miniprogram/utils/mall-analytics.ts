import { getStoredSession } from './auth'
import { request } from './request'

export type MallAnalyticsEventType =
  | 'HOME_VIEW'
  | 'SEARCH_ENTRY_CLICK'
  | 'QUICK_ENTRY_CLICK'
  | 'MEMBER_ENTRANCE_CLICK'
  | 'MEMBER_OPEN_MEMBERSHIP_CLICK'
  | 'HERO_CLICK'
  | 'PRODUCT_CLICK'
  | 'MEMBER_PRODUCT_IMPRESSION'
  | 'MEMBER_EXCLUSIVE_INTERCEPT'
  | 'COUPON_IMPRESSION'
  | 'COUPON_AUTO_APPLY'
  | 'SEARCH_SUBMIT'
  | 'SEARCH_KEYWORD_CLICK'
  | 'SEARCH_RESULT_CLICK'
  | 'PRODUCT_DETAIL_VIEW'
  | 'ADD_TO_CART'
  | 'BUY_NOW_CLICK'
  | 'CHECKOUT_SUBMIT'
  | 'PAYMENT_START'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILURE'
  | 'PAYMENT_CANCEL'

export type MallAnalyticsTargetType = 'GROUP' | 'ORDER' | 'POST'

interface TrackMallAnalyticsEventInput {
  storeId?: string
  mallEventType: MallAnalyticsEventType
  mallPage: string
  mallSource?: string
  targetType?: MallAnalyticsTargetType
  targetId?: string
  keyword?: string
  eventDedupKey?: string
  properties?: Record<string, unknown>
}

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function trackMallAnalyticsEvent(input: TrackMallAnalyticsEventInput) {
  const session = getStoredSession()

  return request<{
    ok: boolean
  }>({
    url: '/api/mall/analytics',
    method: 'POST',
    sessionToken: session ? session.sessionToken : '',
    data: {
      storeId: String(input.storeId || '').trim(),
      mallEventType: input.mallEventType,
      mallPage: String(input.mallPage || '').trim(),
      mallSource: String(input.mallSource || '').trim(),
      targetType: String(input.targetType || 'GROUP').trim(),
      targetId: String(input.targetId || '').trim(),
      keyword: String(input.keyword || '').trim(),
      eventDedupKey: String(input.eventDedupKey || '').trim(),
      properties: normalizeRecord(input.properties),
    },
  }).catch((error) => {
    console.warn('[mall-analytics] track failed', {
      mallEventType: input.mallEventType,
      mallPage: input.mallPage,
      error: error instanceof Error ? error.message : error,
    })
  })
}
