import { request } from './request'

export interface MallCategoryApiItem {
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

export type MallMemberBenefitType = 'NONE' | 'MEMBER_PRICE' | 'MEMBER_EXCLUSIVE'

export interface MallProductApiItem {
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
  publicPrice: number
  publicPriceText: string
  memberPrice: number
  memberPriceText: string
  memberBenefitType: MallMemberBenefitType
  memberBenefitLabel: string
  membershipActive: boolean
  canPurchase: boolean
  memberPromptText: string
  stock: number
  isOnSale: boolean
  sortOrder: number
  cartQuantity: number
  createdAt: string
  updatedAt: string
}

export interface MallProductDetailImageApiItem {
  id: string
  storeId: string
  productId: string
  mediaType: 'CAROUSEL' | 'PROMOTION'
  imageUrl: string
  title: string
  description: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface MallProductDetailApiItem extends MallProductApiItem {
  detailImages: MallProductDetailImageApiItem[]
}

export interface MallCartApiItem {
  id: string
  productId: string
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
  publicPrice: number
  publicPriceText: string
  memberPrice: number
  memberPriceText: string
  memberBenefitType: MallMemberBenefitType
  memberBenefitLabel: string
  membershipActive: boolean
  canPurchase: boolean
  memberPromptText: string
  quantity: number
  stock: number
  isOnSale: boolean
  totalAmount: number
  totalAmountText: string
  createdAt: string
  updatedAt: string
}

export interface MallCartPayload {
  cartCount: number
  totalAmount: number
  totalAmountText: string
  items: MallCartApiItem[]
}

export interface MallProductReviewApiItem {
  id: string
  productId: string
  userId: string
  rating: number
  content: string
  isAnonymous: boolean
  nickname: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

export interface MallProductReviewSummaryApiItem {
  reviewCount: number
  averageRating: number
  averageRatingText: string
  positiveCount: number
  positiveRate: number
  positiveRateText: string
}

export interface MallShippingAddressApiItem {
  id: string
  userId: string
  recipientName: string
  phone: string
  province: string
  city: string
  district: string
  detailAddress: string
  isDefault: boolean
  fullAddress: string
  createdAt: string
  updatedAt: string
}

export interface MallCouponApiItem {
  id: string
  code: string
  name: string
  amount: number
  amountText: string
  totalQuantity: number | null
  usedQuantity: number
  remainingQuantity: number | null
  validFrom: string
  validTo: string
  status: string
  stage: string
  stageLabel: string
  isRecommended?: boolean
}

export interface MallOrderApiItem {
  id: string
  storeId: string
  userId: string
  orderNo: string
  status: string
  statusLabel: string
  paymentStatus: string
  paymentStatusLabel: string
  paymentRequired: boolean
  canPay: boolean
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
  refundReviewerUserId: string
  refundAmount: number
  refundAmountText: string
  refundOutRefundNo: string
  refundWechatRefundId: string
  refundWechatStatus: string
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
  pricingInspection: {
    level: string
    levelLabel: string
    shouldShowPrompt: boolean
    hasCouponMeta: boolean
    hasPricingMeta: boolean
    isLegacyCompatible: boolean
    issueCount: number
    summaryText: string
    issues: Array<{
      code: string
      title: string
      detail: string
    }>
  }
  couponStackingApplied: boolean
  couponStackingRule: string
  couponStackingRuleText: string
  memberPriceItemCount: number
  memberExclusiveItemCount: number
  remark: string
  itemCount: number
  createdAt: string
  updatedAt: string
  canRequestRefund: boolean
  canConfirmReceipt: boolean
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
  coupon?: {
    code: string
    name: string
    stage: string
    stageLabel: string
  }
  shareCommissionRecipient?: {
    id: string
    nickname: string
    mobile: string
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
  items: Array<{
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
  }>
}

export interface MallCommissionOrderApiItem {
  id: string
  orderNo: string
  status: string
  statusLabel: string
  shippingStatus: string
  shippingStatusLabel: string
  refundStatus: string
  refundStatusLabel: string
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
  createdAt: string
  updatedAt: string
  items: Array<{
    id: string
    productId: string
    title: string
    coverImageUrl: string
    coverFallbackText: string
  }>
}

export interface MallOrderPaymentRequest {
  appId?: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

export interface MallOrderPaymentApiItem {
  channel: string
  status: string
  required: boolean
  request: MallOrderPaymentRequest | null
  errorMessage: string
}

export interface MallShareTokenApiItem {
  productId: string
  storeId: string
  shareToken: string
  sharerUserId: string
  estimatedCommission: number
  estimatedCommissionText: string
  commissionRate: number
  commissionRateText: string
}

export interface MallQuickEntryApiItem {
  id: string
  title: string
  subtitle: string
  action: string
  keyword: string
}

export interface MallServiceFaqApiItem {
  id: string
  title: string
  content: string
}

export type MallMemberZoneSortMode = 'CONFIG_ORDER' | 'MEMBER_EXCLUSIVE_FIRST' | 'PRICE_ASC'

export interface MallMemberZoneConfigApiItem {
  title: string
  subtitle: string
  badgeText: string
  highlightText: string
  emptyTitle: string
  emptySubtitle: string
  productIds: string[]
  sortMode: MallMemberZoneSortMode
}

export interface MallConfigApiItem {
  storeId: string
  storeName: string
  source: string
  searchHotKeywords: string[]
  quickEntryItems: MallQuickEntryApiItem[]
  memberZoneConfig?: MallMemberZoneConfigApiItem
  serviceTitle: string
  serviceHours: string
  serviceContactHint: string
  serviceFaqItems: MallServiceFaqApiItem[]
}

interface MallConfigResponse {
  ok: boolean
  data: MallConfigApiItem
}

interface MallCategoriesResponse {
  ok: boolean
  data: {
    storeId: string
    storeName: string
    items: MallCategoryApiItem[]
  }
}

interface MallCouponsResponse {
  ok: boolean
  data: {
    storeId: string
    mallPaidOrderCount: number
    items: MallCouponApiItem[]
  }
}

interface MallProductsResponse {
  ok: boolean
  data: {
    storeId: string
    storeName: string
    categoryId: string
    keyword: string
    items: MallProductApiItem[]
  }
}

interface MallProductDetailResponse {
  ok: boolean
  data: {
    item: MallProductDetailApiItem
  }
}

interface MallShareTokenResponse {
  ok: boolean
  data: MallShareTokenApiItem
}

interface MallCartResponse {
  ok: boolean
  data: MallCartPayload
}

interface MallShippingAddressResponse {
  ok: boolean
  data: {
    item: MallShippingAddressApiItem | null
    defaultItem: MallShippingAddressApiItem | null
    selectedItem?: MallShippingAddressApiItem | null
    savedItem?: MallShippingAddressApiItem | null
    removedAddressId?: string
    items: MallShippingAddressApiItem[]
  }
}

interface MallProductReviewsResponse {
  ok: boolean
  data: {
    summary: MallProductReviewSummaryApiItem
    items: MallProductReviewApiItem[]
    currentUserReview: MallProductReviewApiItem | null
  }
}

interface MallCreateProductReviewResponse {
  ok: boolean
  data: {
    item: MallProductReviewApiItem
    updated: boolean
  }
}

interface MallOrderMutationResponse {
  ok: boolean
  data: {
    order: MallOrderApiItem
    payment: MallOrderPaymentApiItem
  }
}

interface MallOrdersResponse {
  ok: boolean
  data: {
    items: MallOrderApiItem[]
  }
}

interface MallCommissionOrdersResponse {
  ok: boolean
  data: {
    items: MallCommissionOrderApiItem[]
  }
}

interface MallOrderDetailResponse {
  ok: boolean
  data: MallOrderApiItem
}

interface MallOrderItemMutationResponse {
  ok: boolean
  data: {
    item: MallOrderApiItem
    idempotent?: boolean
  }
}

export function fetchMallConfig(storeId?: string) {
  return request<MallConfigResponse>({
    url: storeId ? `/api/mall/config?storeId=${encodeURIComponent(storeId)}` : '/api/mall/config',
  })
}

export function fetchMallCategories(storeId?: string) {
  return request<MallCategoriesResponse>({
    url: storeId ? `/api/mall/categories?storeId=${encodeURIComponent(storeId)}` : '/api/mall/categories',
  })
}

export function fetchMallCoupons(input: {
  storeId?: string
  sessionToken: string
}) {
  const queryParts: string[] = []
  if (input.storeId) {
    queryParts.push(`storeId=${encodeURIComponent(input.storeId)}`)
  }

  return request<MallCouponsResponse>({
    url: `/api/mall/coupons${queryParts.length ? `?${queryParts.join('&')}` : ''}`,
    sessionToken: input.sessionToken,
  })
}

export function fetchMallProducts(input?: {
  storeId?: string
  categoryId?: string
  keyword?: string
  sessionToken?: string
}) {
  const queryParts: string[] = []
  if (input && input.storeId) {
    queryParts.push(`storeId=${encodeURIComponent(input.storeId)}`)
  }
  if (input && input.categoryId) {
    queryParts.push(`categoryId=${encodeURIComponent(input.categoryId)}`)
  }
  if (input && input.keyword) {
    queryParts.push(`keyword=${encodeURIComponent(input.keyword)}`)
  }

  return request<MallProductsResponse>({
    url: `/api/mall/products${queryParts.length ? `?${queryParts.join('&')}` : ''}`,
    sessionToken: input ? input.sessionToken : undefined,
  })
}

export function fetchMallProductDetail(input: {
  productId: string
  sessionToken?: string
}) {
  return request<MallProductDetailResponse>({
    url: `/api/mall/products/detail?productId=${encodeURIComponent(input.productId)}`,
    sessionToken: input.sessionToken,
  })
}

export function createMallProductShareToken(input: {
  sessionToken: string
  productId: string
}) {
  return request<MallShareTokenResponse>({
    url: '/api/mall/share-token',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      productId: input.productId,
    },
  })
}

export function fetchMallProductReviews(input: {
  productId: string
  limit?: number
  sessionToken?: string
}) {
  const queryParts = [`productId=${encodeURIComponent(input.productId)}`]
  if (input.limit) {
    queryParts.push(`limit=${encodeURIComponent(String(input.limit))}`)
  }

  return request<MallProductReviewsResponse>({
    url: `/api/mall/reviews?${queryParts.join('&')}`,
    sessionToken: input.sessionToken,
  })
}

export function createMallProductReview(input: {
  sessionToken: string
  productId: string
  rating: number
  content: string
  isAnonymous?: boolean
}) {
  return request<MallCreateProductReviewResponse>({
    url: '/api/mall/reviews',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      productId: input.productId,
      rating: input.rating,
      content: input.content,
      isAnonymous: Boolean(input.isAnonymous),
    },
  })
}

export function fetchMallShippingAddress(sessionToken: string) {
  return request<MallShippingAddressResponse>({
    url: '/api/mall/address',
    sessionToken,
  })
}

export function upsertMallShippingAddress(input: {
  sessionToken: string
  addressId?: string
  createNew?: boolean
  isDefault?: boolean
  recipientName: string
  phone: string
  province: string
  city: string
  district: string
  detailAddress: string
}) {
  return request<MallShippingAddressResponse>({
    url: '/api/mall/address',
    method: 'PUT',
    sessionToken: input.sessionToken,
    data: {
      addressId: input.addressId || '',
      createNew: Boolean(input.createNew),
      isDefault: typeof input.isDefault === 'boolean' ? input.isDefault : undefined,
      recipientName: input.recipientName,
      phone: input.phone,
      province: input.province,
      city: input.city,
      district: input.district,
      detailAddress: input.detailAddress,
    },
  })
}

export function setDefaultMallShippingAddress(input: {
  sessionToken: string
  addressId: string
}) {
  return request<MallShippingAddressResponse>({
    url: '/api/mall/address/default',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      addressId: input.addressId,
    },
  })
}

export function deleteMallShippingAddress(input: {
  sessionToken: string
  addressId: string
}) {
  return request<MallShippingAddressResponse>({
    url: `/api/mall/address?addressId=${encodeURIComponent(input.addressId)}`,
    method: 'DELETE',
    sessionToken: input.sessionToken,
  })
}

export function fetchMallCart(sessionToken: string) {
  return request<MallCartResponse>({
    url: '/api/mall/cart',
    sessionToken,
  })
}

export function addMallCartItem(input: {
  sessionToken: string
  productId: string
  quantity: number
}) {
  return request<MallCartResponse>({
    url: '/api/mall/cart/add',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      productId: input.productId,
      quantity: input.quantity,
    },
  })
}

export function updateMallCartItem(input: {
  sessionToken: string
  productId: string
  quantity: number
}) {
  return request<MallCartResponse>({
    url: '/api/mall/cart/update',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      productId: input.productId,
      quantity: input.quantity,
    },
  })
}

export function deleteMallCartItem(input: {
  sessionToken: string
  productId: string
}) {
  return request<MallCartResponse>({
    url: '/api/mall/cart/delete',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      productId: input.productId,
    },
  })
}

export function clearMallCart(sessionToken: string) {
  return request<MallCartResponse>({
    url: '/api/mall/cart/clear',
    method: 'POST',
    sessionToken,
    data: {},
  })
}

export function createMallOrder(input: {
  sessionToken: string
  remark?: string
  couponCode?: string
  shareToken?: string
  addressId?: string
  productId?: string
  quantity?: number
}) {
  return request<MallOrderMutationResponse>({
    url: '/api/mall/orders/create',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      remark: input.remark || '',
      couponCode: input.couponCode || '',
      shareToken: input.shareToken || '',
      addressId: input.addressId || '',
      productId: input.productId || '',
      quantity: Number(input.quantity || 0),
    },
  })
}

export function payMallOrder(input: {
  sessionToken: string
  orderId: string
}) {
  return request<MallOrderMutationResponse>({
    url: '/api/mall/orders/pay',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      orderId: input.orderId,
    },
  })
}

export function fetchMallOrders(sessionToken: string) {
  return request<MallOrdersResponse>({
    url: '/api/mall/orders',
    sessionToken,
  })
}

export function fetchMallCommissionOrders(sessionToken: string) {
  return request<MallCommissionOrdersResponse>({
    url: '/api/mall/commissions',
    sessionToken,
  })
}

export function fetchMallOrderDetail(input: {
  sessionToken: string
  orderId: string
}) {
  return request<MallOrderDetailResponse>({
    url: `/api/mall/orders/detail?orderId=${encodeURIComponent(input.orderId)}`,
    sessionToken: input.sessionToken,
  })
}

export function requestMallOrderRefund(input: {
  sessionToken: string
  orderId: string
  reason: string
}) {
  return request<MallOrderItemMutationResponse>({
    url: '/api/mall/orders/refund/request',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      orderId: input.orderId,
      reason: input.reason,
    },
  })
}

export function confirmMallOrderReceipt(input: {
  sessionToken: string
  orderId: string
}) {
  return request<MallOrderItemMutationResponse>({
    url: '/api/mall/orders/receipt/confirm',
    method: 'POST',
    sessionToken: input.sessionToken,
    data: {
      orderId: input.orderId,
    },
  })
}
