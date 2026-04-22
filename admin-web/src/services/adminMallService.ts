import { env } from '../env'
import { apiRequest } from './apiClient'
import { getStoredSessionToken } from './authStorage'

export interface AdminMallCategoryItem {
  id: string
  storeId: string
  name: string
  slug: string
  sortOrder: number
  isEnabled: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminMallProductCategoryOption {
  id: string
  name: string
  isEnabled: boolean
}

export interface AdminMallProductItem {
  id: string
  storeId: string
  categoryId: string
  categoryName: string
  title: string
  subtitle: string
  coverImageUrl: string
  coverFallbackText: string
  price: number
  priceText: string
  originalPrice: number
  originalPriceText: string
  stock: number
  isOnSale: boolean
  sortOrder: number
  cartQuantity: number
  createdAt: string
  updatedAt: string
}

export type AdminMallProductDetailImageMediaType = 'CAROUSEL' | 'PROMOTION'

export interface AdminMallProductDetailImageItem {
  id: string
  storeId: string
  productId: string
  mediaType: AdminMallProductDetailImageMediaType
  imageUrl: string
  title: string
  description: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminMallOrderLineItem {
  id: string
  productId: string
  title: string
  subtitle: string
  coverImageUrl: string
  coverFallbackText: string
  unitPrice: number
  unitPriceText: string
  quantity: number
  totalAmount: number
  totalAmountText: string
  createdAt: string
}

export interface AdminMallOrderPricingInspectionIssue {
  code: string
  title: string
  detail: string
}

export interface AdminMallOrderPricingInspection {
  level: string
  levelLabel: string
  shouldShowPrompt: boolean
  hasCouponMeta: boolean
  hasPricingMeta: boolean
  isLegacyCompatible: boolean
  issueCount: number
  summaryText: string
  issues: AdminMallOrderPricingInspectionIssue[]
}

export interface AdminMallOrderItem {
  id: string
  storeId: string
  userId: string
  orderNo: string
  status: string
  statusLabel: string
  shippingStatus: string
  shippingStatusLabel: string
  shippingCompany: string
  shippingTrackingNo: string
  shippingRemark: string
  shippedAt: string
  refundStatus: string
  refundStatusLabel: string
  refundReason: string
  refundReviewRemark: string
  refundRequestedAt: string
  refundReviewedAt: string
  refundAmount: number
  refundAmountText: string
  refundUserReceivedAccount: string
  refundedAt: string
  totalAmount: number
  totalAmountText: string
  publicAmount: number
  publicAmountText: string
  memberDiscountAmount: number
  memberDiscountAmountText: string
  discountAmount: number
  discountAmountText: string
  couponDiscountAmount: number
  couponDiscountAmountText: string
  totalDiscountAmount: number
  totalDiscountAmountText: string
  payableAmount: number
  payableAmountText: string
  pricingInspection: AdminMallOrderPricingInspection
  couponStackingApplied: boolean
  couponStackingRule: string
  couponStackingRuleText: string
  memberPriceItemCount: number
  memberExclusiveItemCount: number
  remark: string
  itemCount: number
  createdAt: string
  updatedAt: string
  shareApplied: boolean
  shareSharerUserId: string
  shareProductId: string
  shareProductTitle: string
  shareCommissionRate: number
  shareCommissionRateText: string
  shareCommissionBaseAmount: number
  shareCommissionBaseAmountText: string
  shareCommissionAmount: number
  shareCommissionAmountText: string
  shareCommissionStatus: string
  shareCommissionStatusLabel: string
  shareCommissionSettledAt: string
  shareSharer?: {
    id: string
    nickname: string
    mobile: string
  }
  shareCommissionRecipient?: {
    id: string
    nickname: string
    mobile: string
  }
  coupon?: {
    code: string
    name: string
    stage: string
    stageLabel: string
  }
  shippingAddress: {
    recipientName: string
    phone: string
    province: string
    city: string
    district: string
    detailAddress: string
    fullAddress: string
  }
  items: AdminMallOrderLineItem[]
  user?: {
    id: string
    nickname: string
    mobile: string
  }
}

export interface AdminMallOrdersSummary {
  orderCount: number
  pendingCount: number
  readyToShipCount: number
  shippedCount: number
  refundPendingCount: number
  refundProcessingCount: number
  refundedCount: number
  grossAmount: number
  grossAmountText: string
}

export interface AdminMallCouponAnalyticsSummary {
  rangeDays: number
  startAt: string
  endAt: string
  eventSampleSize: number
  activeCouponCount: number
  impressionCount: number
  availableImpressionCount: number
  noCouponImpressionCount: number
  autoApplyCount: number
  checkoutSubmitCount: number
  paymentSuccessCount: number
  stackedPaymentSuccessCount: number
  discountAmount: number
  discountAmountText: string
  memberDiscountAmount: number
  memberDiscountAmountText: string
  totalDiscountAmount: number
  totalDiscountAmountText: string
  autoApplyRate: number
  autoApplyRateText: string
  paymentConversionRate: number
  paymentConversionRateText: string
  stackedPaymentRate: number
  stackedPaymentRateText: string
  lastEventAt: string
}

export interface AdminMallCouponAnalyticsBreakdownItem {
  key: string
  label: string
  impressionCount: number
  availableImpressionCount: number
  noCouponImpressionCount: number
  autoApplyCount: number
  checkoutSubmitCount: number
  paymentSuccessCount: number
  stackedPaymentSuccessCount: number
  discountAmount: number
  discountAmountText: string
  memberDiscountAmount: number
  memberDiscountAmountText: string
  totalDiscountAmount: number
  totalDiscountAmountText: string
  autoApplyRate: number
  autoApplyRateText: string
  paymentConversionRate: number
  paymentConversionRateText: string
  stackedPaymentRate: number
  stackedPaymentRateText: string
  lastEventAt: string
}

export interface AdminMallCouponAnalyticsRow extends AdminMallCouponAnalyticsBreakdownItem {
  couponCode: string
  couponName: string
  couponStage: string
  couponStageLabel: string
}

export interface AdminMallCouponAnalyticsTrendItem extends AdminMallCouponAnalyticsBreakdownItem {
  date: string
}

export interface AdminMallCouponAnalyticsCompatibilitySummary {
  totalEventCount: number
  explicitSelectionModeCount: number
  explicitSelectionCoverageRate: number
  explicitSelectionCoverageRateText: string
  legacyCompatibleEventCount: number
  legacyCompatibleRate: number
  legacyCompatibleRateText: string
  inferredSelectionModeCount: number
  unknownSelectionModeCount: number
  unknownSelectionRate: number
  unknownSelectionRateText: string
  invalidSelectionModeCount: number
  inferredManualSelectionCount: number
  inferredAutoSelectionCount: number
  inferredAppliedFallbackCount: number
  explicitNoneSelectionCount: number
}

export interface AdminMallCouponAnalyticsQualitySummary {
  rangeDays: number
  rawEventSampleSize: number
  sampleLimit: number
  sampleTruncated: boolean
  activeDayCount: number
  emptyDayCount: number
  activeDayCoverageRate: number
  activeDayCoverageRateText: string
  unknownScenarioCount: number
  couponAppliedWithoutCouponCodeCount: number
  paymentWithoutDiscountAmountCount: number
  stackedPaymentWithoutMemberDiscountCount: number
  paymentWithoutStageCount: number
  warningCount: number
  readinessLevel: string
  readinessLevelLabel: string
}

export interface AdminMallCouponAnalyticsData {
  summary: AdminMallCouponAnalyticsSummary
  scenarioBreakdown: AdminMallCouponAnalyticsBreakdownItem[]
  stageBreakdown: AdminMallCouponAnalyticsBreakdownItem[]
  selectionBreakdown: AdminMallCouponAnalyticsBreakdownItem[]
  compatibilitySummary: AdminMallCouponAnalyticsCompatibilitySummary
  qualitySummary: AdminMallCouponAnalyticsQualitySummary
  dailyTrend: AdminMallCouponAnalyticsTrendItem[]
  couponRows: AdminMallCouponAnalyticsRow[]
}

export type AdminMallMemberZoneSortMode = 'CONFIG_ORDER' | 'MEMBER_EXCLUSIVE_FIRST' | 'PRICE_ASC'

export interface AdminMallMemberZoneConfig {
  title: string
  subtitle: string
  badgeText: string
  highlightText: string
  emptyTitle: string
  emptySubtitle: string
  productIds: string[]
  sortMode: AdminMallMemberZoneSortMode
}

export interface AdminMallMemberZoneConfigPayload {
  storeId: string
  storeName: string
  config: AdminMallMemberZoneConfig
  ignoredProductIds: string[]
}

export interface MallPublicConfigItem {
  storeId: string
  storeName: string
  source: string
}

interface MallPublicConfigResponse {
  ok: boolean
  data: MallPublicConfigItem
}

interface AdminMallCategoriesResponse {
  ok: boolean
  data: {
    items: AdminMallCategoryItem[]
  }
}

interface AdminMallProductsResponse {
  ok: boolean
  data: {
    categories: AdminMallProductCategoryOption[]
    items: AdminMallProductItem[]
  }
}

interface AdminMallProductDetailImagesResponse {
  ok: boolean
  data: {
    productId: string
    productTitle: string
    items: AdminMallProductDetailImageItem[]
  }
}

interface AdminMallOrdersResponse {
  ok: boolean
  data: {
    summary: AdminMallOrdersSummary
    items: AdminMallOrderItem[]
  }
}

interface AdminMallCouponAnalyticsResponse {
  ok: boolean
  data: AdminMallCouponAnalyticsData
}

interface AdminMallMemberZoneConfigResponse {
  ok: boolean
  data: AdminMallMemberZoneConfigPayload
  message?: string
}

interface AdminMallMutationResponse {
  ok: boolean
  message?: string
  data?: {
    id?: string
  }
}

interface AdminMallOrderMutationResponse {
  ok: boolean
  data: {
    item: AdminMallOrderItem
  }
}

export function resolveAdminMallAssetUrl(url: string | null | undefined) {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedUrl) || /^data:/i.test(normalizedUrl) || /^blob:/i.test(normalizedUrl)) {
    return normalizedUrl
  }

  if (/^\//.test(normalizedUrl)) {
    const origin = new URL(env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl : `${env.apiBaseUrl}/`).origin
    return `${origin}${normalizedUrl}`
  }

  return normalizedUrl
}

export async function getMallPublicConfig() {
  const response = await apiRequest<MallPublicConfigResponse>('/api/mall/config')
  return response.data
}

export async function getAdminMallCategories(input: { storeId: string }) {
  const response = await apiRequest<AdminMallCategoriesResponse>('/api/admin/mall/categories', {
    query: input,
  })

  return response.data
}

export async function createAdminMallCategory(input: {
  storeId: string
  name: string
  sortOrder: number
}) {
  const response = await apiRequest<AdminMallMutationResponse>('/api/admin/mall/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateAdminMallCategory(input: {
  storeId: string
  categoryId: string
  name: string
  sortOrder: number
  isEnabled: boolean
}) {
  const response = await apiRequest<AdminMallMutationResponse>('/api/admin/mall/categories', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response
}

export async function getAdminMallProducts(input: { storeId: string }) {
  const response = await apiRequest<AdminMallProductsResponse>('/api/admin/mall/products', {
    query: input,
  })

  return response.data
}

export async function createAdminMallProduct(input: {
  storeId: string
  categoryId: string
  title: string
  subtitle: string
  coverImageUrl: string
  price: number
  originalPrice: number
  stock: number
  isOnSale: boolean
  sortOrder: number
}) {
  const response = await apiRequest<AdminMallMutationResponse>('/api/admin/mall/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateAdminMallProduct(input: {
  storeId: string
  productId: string
  categoryId: string
  title: string
  subtitle: string
  coverImageUrl: string
  price: number
  originalPrice: number
  stock: number
  isOnSale: boolean
  sortOrder: number
}) {
  const response = await apiRequest<AdminMallMutationResponse>('/api/admin/mall/products', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response
}

export async function getAdminMallProductDetailImages(input: {
  storeId: string
  productId: string
}) {
  const response = await apiRequest<AdminMallProductDetailImagesResponse>('/api/admin/mall/products/detail-images', {
    query: input,
  })

  return response.data
}

export async function updateAdminMallProductDetailImages(input: {
  storeId: string
  productId: string
  items: Array<{
    mediaType: AdminMallProductDetailImageMediaType
    imageUrl: string
    title: string
    description: string
    sortOrder: number
    isEnabled: boolean
  }>
}) {
  const response = await apiRequest<AdminMallProductDetailImagesResponse>('/api/admin/mall/products/detail-images', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function getAdminMallOrders(input: { storeId: string; limit?: number }) {
  const response = await apiRequest<AdminMallOrdersResponse>('/api/admin/mall/orders', {
    query: input,
  })

  return response.data
}

export async function getAdminMallCouponAnalytics(input: { storeId: string; days?: number }) {
  const response = await apiRequest<AdminMallCouponAnalyticsResponse>('/api/admin/mall/coupon-analytics', {
    query: input,
  })

  return response.data
}

export async function getAdminMallMemberZoneConfig(input: { storeId: string }) {
  const response = await apiRequest<AdminMallMemberZoneConfigResponse>('/api/admin/mall/member-zone-config', {
    query: input,
  })

  return response.data
}

export async function updateAdminMallMemberZoneConfig(input: {
  storeId: string
  config: AdminMallMemberZoneConfig
}) {
  const response = await apiRequest<AdminMallMemberZoneConfigResponse>('/api/admin/mall/member-zone-config', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateAdminMallOrderStatus(input: {
  storeId: string
  orderId: string
  status: 'PAID' | 'CLOSED'
}) {
  const response = await apiRequest<AdminMallOrderMutationResponse>('/api/admin/mall/orders/status', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function shipAdminMallOrder(input: {
  storeId: string
  orderId: string
  shippingCompany: string
  shippingTrackingNo: string
  shippingRemark?: string
}) {
  const response = await apiRequest<AdminMallOrderMutationResponse>('/api/admin/mall/orders/ship', {
    method: 'POST',
    body: JSON.stringify({
      storeId: input.storeId,
      orderId: input.orderId,
      shippingCompany: input.shippingCompany,
      shippingTrackingNo: input.shippingTrackingNo,
      shippingRemark: input.shippingRemark || '',
    }),
  })

  return response.data
}

export async function reviewAdminMallOrderRefund(input: {
  storeId: string
  orderId: string
  action: 'APPROVE' | 'REJECT'
  reviewRemark?: string
}) {
  const response = await apiRequest<AdminMallOrderMutationResponse>('/api/admin/mall/orders/refund/review', {
    method: 'POST',
    body: JSON.stringify({
      storeId: input.storeId,
      orderId: input.orderId,
      action: input.action,
      reviewRemark: input.reviewRemark || '',
    }),
  })

  return response.data
}

export async function uploadAdminMallImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const headers = new Headers()
  headers.set('Accept', 'application/json')
  const sessionToken = getStoredSessionToken()
  if (sessionToken) {
    headers.set('x-session-token', sessionToken)
  }

  const url = new URL('/api/uploads/image', env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl : `${env.apiBaseUrl}/`)
  const response = await fetch(url.toString(), {
    method: 'POST',
    body: formData,
    headers,
  })

  const payload = (await response.json()) as { ok: boolean; data?: { url: string }; message?: string }
  if (!response.ok || !payload.ok || !payload.data?.url) {
    throw new Error(payload.message || '图片上传失败')
  }

  return payload.data.url
}
