import { API_BASE_URLS, getApiBaseUrl, prepareImageUploadPath, request, setApiBaseUrl } from './request'
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

interface CreatePlanetResponse {
  ok: boolean
  message?: string
  data: PlanetRemoteProfile
}

interface MembershipStatusResponse {
  ok: boolean
  data: {
    status: string
    expireAt?: string
    isActive: boolean
    orderNo?: string
    appliedAt?: string
    reviewReason?: string
    reviewedAt?: string
  } | null
}

interface JoinCouponItem {
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
}

interface JoinCouponListResponse {
  ok: boolean
  data: {
    group: {
      id: string
      name: string
      joinType: string
      priceAmount: number
    }
    items: JoinCouponItem[]
  }
}

interface PlanetJoinPreviewResponse {
  ok: boolean
  data: {
    pricing: {
      originalAmount: number
      payableAmount: number
    }
    paywallHighlights?: {
      images: Array<{
        name: string
        url: string
      }>
      updatedAt?: string
    }
    coupon: {
      id: string
      code: string
      name: string
      discountAmount: number
    } | null
  }
}

interface OrderMembershipPayload {
  status: string
  expireAt?: string
  isActive?: boolean
  orderNo?: string
  appliedAt?: string
  reviewReason?: string
  reviewedAt?: string
}

interface OrderArticleUnlockPayload {
  id: string
  articleId: string
  groupId: string
  userId: string
  unlockedAt?: string
  isUnlocked: boolean
}

interface WechatPaymentRequestPayload {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

interface JoinOrderResponse {
  ok: boolean
  message?: string
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
      required?: boolean
      request?: WechatPaymentRequestPayload | null
    }
    membership?: OrderMembershipPayload | null
    idempotent?: boolean
  }
}

interface ArticleUnlockOrderResponse {
  ok: boolean
  message?: string
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
      required?: boolean
      request?: WechatPaymentRequestPayload | null
    }
    unlock?: OrderArticleUnlockPayload | null
    idempotent?: boolean
  }
}

interface ReapplyJoinReviewResponse {
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
    membership: OrderMembershipPayload | null
    idempotent: boolean
  }
}

interface MockPaymentResponse {
  ok: boolean
  message?: string
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
    membership: OrderMembershipPayload | null
    unlock?: OrderArticleUnlockPayload | null
    idempotent: boolean
  }
}

interface OrderDetailResponse {
  ok: boolean
  message?: string
  data: {
    order: {
      id: string
      orderNo: string
      status: string
      paymentStatus: string
      amount: number
      paidAt?: string
    }
    payment: {
      id: string
      status: string
      transactionNo?: string
    } | null
    membership: OrderMembershipPayload | null
  }
}

interface PlanetHomeResponse {
  ok: boolean
  data: {
    group: Record<string, any>
    owner: Record<string, any>
    viewer: (Record<string, any> & {
      subscriptionEnabled?: boolean
    }) | null
    membership: Record<string, any> | null
    role: Record<string, any>
    policy: Record<string, any> | null
    paywallHighlights?: {
      images: Array<{
        name: string
        url: string
      }>
      updatedAt?: string
    }
    renewal?: {
      enabled: boolean
      canRenew: boolean
      stage: string
      isExpired: boolean
      isExpiringSoon: boolean
      daysUntilExpire?: number | null
      expireAt?: string | null
      amount: number
      payableAmount?: number
      originalAmount: number
      discountedPercentage: number
      guidance?: string
      renewalUrl?: string
      coupon?: {
        id: string
        code: string
        name: string
        discountAmount: number
      } | null
    } | null
    stats: Record<string, any>
  }
}

interface PromotionSceneResolveResponse {
  ok: boolean
  data: {
    groupId: string
    groupName: string
    ownerName: string
    channelId: string
    channelCode: string
  }
}

interface UpdatePlanetProfileResponse {
  ok: boolean
  data: Record<string, any>
}

interface LeavePlanetResponse {
  ok: boolean
  message?: string
  data: {
    groupId: string
    membershipStatus: string
    refunded: boolean
    refundAmount: number
    orderNo: string
    idempotent: boolean
  }
}

interface DeletePlanetResponse {
  ok: boolean
  message?: string
  data: {
    groupId: string
    status: string
    deleted: boolean
    idempotent: boolean
  }
}

interface PlanetPostListResponse {
  ok: boolean
  data: {
    items: Array<Record<string, any>>
    nextCursor?: string | null
    tab: string
  }
}

interface PlanetPinnedPostsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface PlanetMemberListResponse {
  ok: boolean
  data: {
    groupId: string
    items: Array<Record<string, any>>
  }
}

interface PlanetRefundManagementResponse {
  ok: boolean
  message?: string
  data: {
    group: {
      id: string
      name: string
      ownerName: string
      priceAmount: number
      priceLabel: string
      memberCount: number
      refundWindowHours: number
    }
    summary: {
      totalMembers: number
      refundableMembers: number
      expiredMembers: number
    }
    items: Array<{
      userId: string
      memberId: string
      nickname: string
      avatarUrl: string
      mobile: string
      roleLabel: string
      isOwner: boolean
      isPaid: boolean
      joinedAt: string
      expireAt: string
      orderNo: string
      refundAmount: number
      canRefund: boolean
      refundDeadline: string
      refundHint: string
    }>
  }
}

interface RefundPlanetMemberResponse {
  ok: boolean
  message?: string
  data: {
    groupId: string
    memberUserId: string
    membershipStatus: string
    refunded: boolean
    refundAmount: number
    orderNo: string
    idempotent: boolean
  }
}

interface RefundApprovalDashboardResponse {
  ok: boolean
  message?: string
  data: {
    created: {
      pendingCount: number
      items: Array<{
        groupId: string
        groupName: string
        orderNo: string
        memberUserId: string
        nickname: string
        avatarUrl: string
        mobile: string
        refundAmount: number
        requestedAt: string
        refundHint: string
        canReview: boolean
      }>
    }
    joined: {
      actionableCount: number
      pendingCount: number
      items: Array<{
        groupId: string
        groupName: string
        ownerName: string
        orderNo: string
        refundAmount: number
        status: string
        statusLabel: string
        actionLabel: string
        actionable: boolean
        hint: string
        submittedAt: string
        reviewedAt: string
        reviewReason: string
        updatedAt: string
      }>
    }
  }
}

interface RequestPlanetRefundReviewResponse {
  ok: boolean
  message?: string
  data: {
    groupId: string
    orderNo: string
    refundReviewStatus: string
    refundAmount: number
    submittedAt: string
    idempotent: boolean
  }
}

interface ReviewPlanetRefundRequestResponse {
  ok: boolean
  message?: string
  data: {
    action: string
    groupId: string
    orderNo: string
    refunded: boolean
    refundReviewStatus: string
    idempotent: boolean
  }
}

interface CheckinChallengeListItem {
  id: string
  title: string
  status: 'ongoing' | 'ended' | 'closed'
  dayText: string
  validityText: string
  joinedCount: number
  currentJoinedCount: number
  checkinCount: number
  completedCount: number
  heroColor: string
  avatarUrls: string[]
  isJoined: boolean
  primaryActionText: string
}

interface CheckinChallengeListResponse {
  ok: boolean
  data: {
    canCreateChallenge?: boolean
    items: CheckinChallengeListItem[]
  }
}

interface CreateCheckinChallengeResponse {
  ok: boolean
  data: {
    id: string
    groupId: string
    title: string
  }
}

interface CheckinPostItem {
  id: string
  author: {
    id: string
    name: string
    avatarUrl: string
    isOwner: boolean
    location: string
  }
  createdAt: string
  content: string
  images: string[]
  likeCount: number
  commentCount: number
}

interface CheckinChallengeDetailResponse {
  ok: boolean
  data: {
    id: string
    groupId: string
    title: string
    description: string
    status: 'ongoing' | 'ended' | 'closed'
    dayText: string
    validityText: string
    joinedCount: number
    currentJoinedCount: number
    checkinCount: number
    completedCount: number
    todayCount: number
    todayPercent: number
    heroColor: string
    isJoined: boolean
    joinedAvatarUrls: string[]
    posts: CheckinPostItem[]
  }
}

interface CheckinRankingItem {
  rank: number
  userId: string
  nickname: string
  avatarUrl: string
  value: number
  valueText: string
  isViewer: boolean
}

interface CheckinRankingsResponse {
  ok: boolean
  data: {
    challengeId: string
    challengeTitle: string
    streakRanking: CheckinRankingItem[]
    totalRanking: CheckinRankingItem[]
    viewerSummary: {
      streakRank: number
      streakDays: number
      totalRank: number
      totalDays: number
    }
  }
}

interface CheckinRecordResponse {
  ok: boolean
  data: {
    challengeId: string
    challengeTitle: string
    year: number
    month: number
    monthLabel: string
    selectedDay: number
    selectedDateKey: string
    weekdayLabels: string[]
    calendarDays: Array<Record<string, any>>
    progressPercent: number
    streakDays: number
    totalDays: number
    todayChecked: boolean
    selectedDayChecked: boolean
    myPosts: Array<Record<string, any>>
    allPosts: Array<Record<string, any>>
  }
}

interface PlanetPostDetailResponse {
  ok: boolean
  data: Record<string, any>
}

export interface PlanetArticleAuthorDisplay {
  type: string
  name: string
  avatarUrl: string
  sourceGroupId: string
  sourceUserId: string
}

export interface PlanetArticleAccess {
  accessType: 'free' | 'paid'
  priceAmount: number
  priceLabel: string
  isUnlocked: boolean
  previewMode: 'paragraph' | 'ratio'
  previewValue: number
  contentParagraphCount?: number
  previewParagraphCount?: number
}

export interface PlanetArticlePreview {
  previewText: string
  previewRichContent: string
  contentParagraphCount?: number
  previewParagraphCount?: number
  previewMode?: 'paragraph' | 'ratio'
  previewValue?: number
}

export interface PlanetArticleItem {
  id: string
  groupId: string
  type: 'ARTICLE'
  status: string
  title: string
  summary: string
  contentText: string
  contentSource: 'wechat' | 'planet' | ''
  coverUrl: string
  richContent: string
  tags: string[]
  authorDisplay: PlanetArticleAuthorDisplay | null
  access: PlanetArticleAccess | null
  preview: PlanetArticlePreview | null
  attachments: string[]
  isPinned: boolean
  isEssence: boolean
  readingCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, any>
  readState?: 'free_full' | 'paid_locked' | 'paid_unlocked'
  canReadFull?: boolean
  fullParagraphCount?: number
  visibleParagraphCount?: number
  hiddenParagraphCount?: number
  previewContentText?: string
  previewRichContent?: string
  contentParagraphs?: string[]
  previewParagraphs?: string[]
}

interface PlanetArticleListResponse {
  ok: boolean
  data: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    items: PlanetArticleItem[]
    filters: {
      groupId: string
      search: string
      status: string
      contentSource: string
      accessType: string
      includeRestricted: boolean
    }
  }
}

interface PlanetArticleDetailResponse {
  ok: boolean
  data: PlanetArticleItem
}

interface PlanetCommentsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface PlanetPostReportResponse {
  ok: boolean
  data: {
    postId: string
    reportStatus: string
    reportCount: number
    reportPendingCount: number
    idempotent: boolean
  }
}

interface PlanetMyPostsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface DiscoverFeaturedPostsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface ColumnListItem {
  id: string
  title: string
  count: number
}

interface ColumnListResponse {
  ok: boolean
  data: {
    groupId: string
    groupName: string
    canCreateColumn?: boolean
    totalColumns: number
    items: ColumnListItem[]
  }
}

interface CreateColumnResponse {
  ok: boolean
  data: {
    id: string
    groupId: string
    title: string
    sortOrder: number
  }
}

interface AssignPostColumnResponse {
  ok: boolean
  data: Record<string, any>
}

interface GroupSubscriptionResponse {
  ok: boolean
  data: {
    groupId: string
    groupName: string
    enabled: boolean
  }
}

interface ColumnPostItem {
  id: string
  title: string
  content: string
  author: {
    id: string
    nickname: string
    avatarUrl: string
  }
  readingCount: number
  likeCount: number
  commentCount: number
  publishedAt: string | null
  createdAt: string | null
}

interface ColumnDetailResponse {
  ok: boolean
  data: {
    columnId: string
    columnTitle: string
    groupId: string
    groupName: string
    totalPosts: number
    items: ColumnPostItem[]
  }
}

interface UploadImageResponse {
  ok: boolean
  data: {
    url: string
    filename: string
  }
}

interface UploadFileResponse {
  ok: boolean
  data: {
    url: string
    filename: string
    savedName: string
    mimeType: string
    size: number
  }
}

export function fetchDiscoverPlanets(sessionToken?: string, limit = 12) {
  return request<DiscoverPlanetsResponse>({
    url: `/api/planets/discover?limit=${encodeURIComponent(String(limit))}`,
    sessionToken,
  })
}

export function fetchMyPlanets(sessionToken: string) {
  return request<MyPlanetsResponse>({
    url: '/api/planets/mine',
    sessionToken,
  })
}

export function fetchJoinedPlanets(sessionToken: string) {
  return request<JoinedPlanetsResponse>({
    url: '/api/planets/joined',
    sessionToken,
  })
}

export function createPlanet(payload: {
  name: string
  price: number
  joinType: 'rolling' | 'calendar'
  sessionToken: string
}) {
  return request<CreatePlanetResponse>({
    url: '/api/planets/create',
    method: 'POST',
    data: {
      name: payload.name,
      price: payload.price,
      joinType: payload.joinType,
    },
    sessionToken: payload.sessionToken,
  })
}

export function leavePlanetMembership(payload: {
  groupId: string
  sessionToken?: string
}) {
  return request<LeavePlanetResponse>({
    url: '/api/planets/leave',
    method: 'POST',
    data: {
      groupId: payload.groupId,
    },
    sessionToken: payload.sessionToken,
  })
}

export function deletePlanet(payload: {
  groupId: string
  sessionToken?: string
}) {
  return request<DeletePlanetResponse>({
    url: '/api/planets/delete',
    method: 'POST',
    data: {
      groupId: payload.groupId,
    },
    sessionToken: payload.sessionToken,
  })
}

export function fetchDiscoverFeaturedPosts(limit = 12, sessionToken?: string) {
  const query = [`limit=${encodeURIComponent(String(limit))}`]

  return request<DiscoverFeaturedPostsResponse>({
    url: `/api/planets/discover-featured-posts?${query.join('&')}`,
    sessionToken,
  })
}

export function fetchPlanetColumns(payload: {
  groupId: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`groupId=${encodeURIComponent(payload.groupId)}`]
  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<ColumnListResponse>({
    url: `/api/planets/columns?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchColumnDetail(payload: {
  columnId: string
  groupId: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`columnId=${encodeURIComponent(payload.columnId)}`, `groupId=${encodeURIComponent(payload.groupId)}`]
  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<ColumnDetailResponse>({
    url: `/api/planets/columns/detail?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function createPlanetColumn(payload: {
  groupId: string
  title: string
  sessionToken?: string
  userId?: string
}) {
  return request<CreateColumnResponse>({
    url: '/api/planets/columns',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function assignPlanetPostColumn(payload: {
  postId: string
  columnId?: string
  sessionToken?: string
  userId?: string
}) {
  return request<AssignPostColumnResponse>({
    url: '/api/planets/posts/assign-column',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function updatePlanetSubscription(payload: {
  groupId: string
  enabled: boolean
  sessionToken?: string
  userId?: string
}) {
  return request<GroupSubscriptionResponse>({
    url: '/api/planets/subscription',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function fetchMembershipStatus(groupId: string, userId: string) {
  return request<MembershipStatusResponse>({
    url: `/api/memberships/status?groupId=${encodeURIComponent(groupId)}&userId=${encodeURIComponent(userId)}`,
  })
}

export function fetchJoinCoupons(payload: {
  groupId: string
  sessionToken?: string
}) {
  return request<JoinCouponListResponse>({
    url: `/api/planets/join-coupons?groupId=${encodeURIComponent(payload.groupId)}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchPlanetJoinPreview(payload: {
  groupId: string
  userId: string
  couponCode?: string
  channelCode?: string
  sessionToken?: string
}) {
  const query = [
    `groupId=${encodeURIComponent(payload.groupId)}`,
    `userId=${encodeURIComponent(payload.userId)}`,
  ]

  if (payload.couponCode) {
    query.push(`couponCode=${encodeURIComponent(payload.couponCode)}`)
  }

  if (payload.channelCode) {
    query.push(`channelCode=${encodeURIComponent(payload.channelCode)}`)
  }

  return request<PlanetJoinPreviewResponse>({
    url: `/api/planets/preview?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function createJoinOrder(payload: {
  groupId: string
  userId: string
  paymentChannel?: string
  couponCode?: string
  channelCode?: string
  sessionToken?: string
}) {
  return request<JoinOrderResponse>({
    url: '/api/orders/join',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function createRenewalOrder(payload: {
  groupId: string
  userId: string
  paymentChannel?: string
  couponCode?: string
  sessionToken?: string
}) {
  return request<JoinOrderResponse>({
    url: '/api/orders/renewal',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function createArticleUnlockOrder(payload: {
  articleId: string
  userId: string
  paymentChannel?: string
  sessionToken?: string
}) {
  return request<ArticleUnlockOrderResponse>({
    url: '/api/articles/unlock-orders',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
    retryOnRouteNotFound: true,
    routeNotFoundMessage: '当前后端未部署文章解锁接口，请更新正在运行的 backend 服务后重试',
  })
}

export function reapplyJoinReview(payload: {
  groupId: string
  userId: string
}) {
  return request<ReapplyJoinReviewResponse>({
    url: '/api/orders/join/reapply',
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

export function mockArticleUnlockPayment(payload: {
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

export function fetchOrderDetail(payload: {
  orderNo: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`orderNo=${encodeURIComponent(payload.orderNo)}`]

  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<OrderDetailResponse>({
    url: `/api/orders/detail?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchPlanetHome(payload: {
  groupId: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`groupId=${encodeURIComponent(payload.groupId)}`]
  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<PlanetHomeResponse>({
    url: `/api/planets/home?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function resolvePromotionScene(scene: string) {
  return request<PromotionSceneResolveResponse>({
    url: `/api/planets/promotion-scene/resolve?scene=${encodeURIComponent(scene)}`,
  })
}

export function updatePlanetProfile(payload: {
  groupId: string
  name: string
  category: string
  intro: string
  avatarImageUrl?: string
  sessionToken?: string
}) {
  return request<UpdatePlanetProfileResponse>({
    url: '/api/planets/profile',
    method: 'PUT',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function fetchPlanetPosts(payload: {
  groupId: string
  tab?: 'latest' | 'featured' | 'files' | 'answer'
  cursor?: string
  limit?: number
  sessionToken?: string
}) {
  const query = [`groupId=${encodeURIComponent(payload.groupId)}`]
  if (payload.tab) {
    query.push(`tab=${encodeURIComponent(payload.tab)}`)
  }
  if (payload.cursor) {
    query.push(`cursor=${encodeURIComponent(payload.cursor)}`)
  }
  if (payload.limit) {
    query.push(`limit=${encodeURIComponent(String(payload.limit))}`)
  }

  return request<PlanetPostListResponse>({
    url: `/api/planets/posts?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchPinnedPosts(groupId: string, sessionToken?: string) {
  return request<PlanetPinnedPostsResponse>({
    url: `/api/planets/pinned-posts?groupId=${encodeURIComponent(groupId)}`,
    sessionToken,
  })
}

export function fetchPlanetMembers(groupId: string, sessionToken: string) {
  return request<PlanetMemberListResponse>({
    url: `/api/planets/members?groupId=${encodeURIComponent(groupId)}`,
    sessionToken,
  })
}

export function fetchPlanetRefundManagement(payload: {
  groupId: string
  sessionToken: string
}) {
  return request<PlanetRefundManagementResponse>({
    url: `/api/planets/refund-management?groupId=${encodeURIComponent(payload.groupId)}`,
    sessionToken: payload.sessionToken,
  })
}

export function refundPlanetMember(payload: {
  groupId: string
  memberUserId: string
  sessionToken: string
}) {
  return request<RefundPlanetMemberResponse>({
    url: '/api/planets/refund-member',
    method: 'POST',
    data: {
      groupId: payload.groupId,
      memberUserId: payload.memberUserId,
    },
    sessionToken: payload.sessionToken,
  })
}

export function fetchRefundApprovalDashboard(sessionToken: string) {
  return request<RefundApprovalDashboardResponse>({
    url: '/api/refunds/dashboard',
    sessionToken,
  })
}

export function requestPlanetRefundReview(payload: {
  groupId: string
  sessionToken: string
}) {
  return request<RequestPlanetRefundReviewResponse>({
    url: '/api/refunds/request',
    method: 'POST',
    data: {
      groupId: payload.groupId,
    },
    sessionToken: payload.sessionToken,
  })
}

export function reviewPlanetRefundRequest(payload: {
  groupId: string
  orderNo: string
  action: 'APPROVE' | 'REJECT'
  reviewReason?: string
  sessionToken: string
}) {
  return request<ReviewPlanetRefundRequestResponse>({
    url: '/api/refunds/review',
    method: 'POST',
    data: {
      groupId: payload.groupId,
      orderNo: payload.orderNo,
      action: payload.action,
      reviewReason: payload.reviewReason || '',
    },
    sessionToken: payload.sessionToken,
  })
}

export function fetchCheckinChallenges(payload: {
  groupId: string
  status?: 'ongoing' | 'ended' | 'closed'
  sessionToken?: string
  userId?: string
}) {
  const query = [`groupId=${encodeURIComponent(payload.groupId)}`]

  if (payload.status) {
    query.push(`status=${encodeURIComponent(payload.status)}`)
  }

  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<CheckinChallengeListResponse>({
    url: `/api/checkin/challenges?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchCheckinChallengeDetail(payload: {
  challengeId: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`challengeId=${encodeURIComponent(payload.challengeId)}`]

  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<CheckinChallengeDetailResponse>({
    url: `/api/checkin/challenges/detail?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchCheckinRankings(payload: {
  challengeId: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`challengeId=${encodeURIComponent(payload.challengeId)}`]

  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<CheckinRankingsResponse>({
    url: `/api/checkin/rankings?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchCheckinRecord(payload: {
  challengeId: string
  year?: number
  month?: number
  day?: number
  sessionToken?: string
  userId?: string
}) {
  const query = [`challengeId=${encodeURIComponent(payload.challengeId)}`]

  if (payload.year) {
    query.push(`year=${encodeURIComponent(String(payload.year))}`)
  }

  if (payload.month) {
    query.push(`month=${encodeURIComponent(String(payload.month))}`)
  }

  if (payload.day) {
    query.push(`day=${encodeURIComponent(String(payload.day))}`)
  }

  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<CheckinRecordResponse>({
    url: `/api/checkin/records?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function joinPlanetCheckinChallenge(payload: {
  challengeId: string
  sessionToken?: string
  userId?: string
}) {
  return request<CheckinChallengeDetailResponse>({
    url: '/api/checkin/challenges/join',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function createPlanetCheckinChallenge(payload: {
  groupId: string
  title: string
  description: string
  dayCount: number
  heroColor?: 'teal' | 'mint'
  sessionToken?: string
  userId?: string
}) {
  return request<CreateCheckinChallengeResponse>({
    url: '/api/checkin/challenges/create',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function publishPlanetCheckinPost(payload: {
  challengeId: string
  content: string
  images?: string[]
  sessionToken?: string
  userId?: string
}) {
  return request<PlanetPostDetailResponse>({
    url: '/api/checkin/posts',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function createPlanetPost(payload: Record<string, any>) {
  return request<PlanetPostDetailResponse>({
    url: '/api/planets/posts',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function updatePlanetPost(payload: Record<string, any>) {
  return request<PlanetPostDetailResponse>({
    url: '/api/planets/posts',
    method: 'PUT',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function fetchPlanetPostDetail(postId: string, incrementRead = true, sessionToken?: string) {
  return request<PlanetPostDetailResponse>({
    url: `/api/posts/detail?postId=${encodeURIComponent(postId)}&incrementRead=${incrementRead ? '1' : '0'}`,
    sessionToken,
  })
}

export function fetchArticles(payload: {
  groupId?: string
  status?: 'ALL' | 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'
  contentSource?: 'wechat' | 'planet'
  accessType?: 'free' | 'paid'
  search?: string
  page?: number
  pageSize?: number
  sessionToken?: string
}) {
  const query = [`status=${encodeURIComponent(payload.status || 'PUBLISHED')}`]

  if (payload.groupId) {
    query.push(`groupId=${encodeURIComponent(payload.groupId)}`)
  }
  if (payload.contentSource) {
    query.push(`contentSource=${encodeURIComponent(payload.contentSource)}`)
  }
  if (payload.accessType) {
    query.push(`accessType=${encodeURIComponent(payload.accessType)}`)
  }
  if (payload.search) {
    query.push(`search=${encodeURIComponent(payload.search)}`)
  }
  if (payload.page) {
    query.push(`page=${encodeURIComponent(String(payload.page))}`)
  }
  if (payload.pageSize) {
    query.push(`pageSize=${encodeURIComponent(String(payload.pageSize))}`)
  }

  return request<PlanetArticleListResponse>({
    url: `/api/articles?${query.join('&')}`,
    sessionToken: payload.sessionToken,
  })
}

export function fetchArticleDetail(articleId: string, incrementRead = true, sessionToken?: string) {
  return request<PlanetArticleDetailResponse>({
    url: `/api/articles/detail?articleId=${encodeURIComponent(articleId)}&incrementRead=${incrementRead ? '1' : '0'}`,
    sessionToken,
  })
}

export function fetchPlanetComments(postId: string, sessionToken?: string) {
  return request<PlanetCommentsResponse>({
    url: `/api/posts/comments?postId=${encodeURIComponent(postId)}`,
    sessionToken,
  })
}

export function createPlanetComment(payload: {
  postId: string
  userId: string
  content: string
  parentId?: string
  sessionToken?: string
}) {
  return request<PlanetPostDetailResponse>({
    url: '/api/posts/comments',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function togglePlanetPostLike(payload: {
  postId: string
  increment?: boolean
  sessionToken?: string
}) {
  return request<PlanetPostDetailResponse>({
    url: '/api/posts/like',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function togglePlanetCommentLike(payload: {
  commentId: string
  increment?: boolean
  sessionToken?: string
}) {
  return request<PlanetPostDetailResponse>({
    url: '/api/comments/like',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function reportPlanetPost(payload: {
  postId: string
  reason: string
  sessionToken?: string
}) {
  return request<PlanetPostReportResponse>({
    url: '/api/posts/report',
    method: 'POST',
    data: payload,
    sessionToken: payload.sessionToken,
  })
}

export function fetchMyPlanetPosts(sessionToken: string) {
  return request<PlanetMyPostsResponse>({
    url: '/api/planets/my-posts',
    sessionToken,
  })
}

export function uploadPlanetImage(filePath: string, sessionToken?: string) {
  return new Promise<UploadImageResponse>((resolve, reject) => {
    const triedBaseUrls: string[] = []
    const candidateBaseUrls = [getApiBaseUrl()].concat(API_BASE_URLS).filter((baseUrl) => {
      if (triedBaseUrls.indexOf(baseUrl) >= 0) {
        return false
      }
      triedBaseUrls.push(baseUrl)
      return true
    })

    prepareImageUploadPath(filePath)
      .catch(() => filePath)
      .then((preparedFilePath) => {
        const effectiveFilePath = preparedFilePath || filePath

        const tryUpload = (index: number) => {
          const baseUrl = candidateBaseUrls[index]
          wx.uploadFile({
            url: `${baseUrl}/api/uploads/image`,
            filePath: effectiveFilePath,
            name: 'file',
            timeout: 12000,
            header: sessionToken ? { 'x-session-token': sessionToken } : {},
            success: (res) => {
              let data: UploadImageResponse | null = null

              try {
                data = JSON.parse(res.data || '{}') as UploadImageResponse
              } catch {
                data = null
              }

              if (res.statusCode >= 200 && res.statusCode < 300 && data && data.ok && data.data && data.data.url) {
                setApiBaseUrl(baseUrl)
                resolve(data)
                return
              }

              if (index < candidateBaseUrls.length - 1) {
                tryUpload(index + 1)
                return
              }

              reject(new Error((data && (data as { message?: string }).message) || '图片上传失败'))
            },
            fail: (error) => {
              if (index < candidateBaseUrls.length - 1) {
                tryUpload(index + 1)
                return
              }

              const errMsg =
                error && typeof error === 'object' && 'errMsg' in error
                  ? String((error as { errMsg?: string }).errMsg || '图片上传失败')
                  : '图片上传失败'
              reject(new Error(errMsg))
            },
          })
        }

        tryUpload(0)
      })
  })
}

export function uploadPlanetFile(filePath: string, sessionToken?: string) {
  return new Promise<UploadFileResponse>((resolve, reject) => {
    const triedBaseUrls: string[] = []
    const candidateBaseUrls = [getApiBaseUrl()].concat(API_BASE_URLS).filter((baseUrl) => {
      if (triedBaseUrls.indexOf(baseUrl) >= 0) {
        return false
      }
      triedBaseUrls.push(baseUrl)
      return true
    })

    const tryUpload = (index: number) => {
      const baseUrl = candidateBaseUrls[index]
      wx.uploadFile({
        url: `${baseUrl}/api/uploads/file`,
        filePath,
        name: 'file',
        timeout: 20000,
        header: sessionToken ? { 'x-session-token': sessionToken } : {},
        success: (res) => {
          let data: UploadFileResponse | null = null

          try {
            data = JSON.parse(res.data || '{}') as UploadFileResponse
          } catch {
            data = null
          }

          if (res.statusCode >= 200 && res.statusCode < 300 && data && data.ok && data.data && data.data.url) {
            setApiBaseUrl(baseUrl)
            resolve(data)
            return
          }

          if (index < candidateBaseUrls.length - 1) {
            tryUpload(index + 1)
            return
          }

          reject(new Error((data && (data as { message?: string }).message) || '文件上传失败'))
        },
        fail: (error) => {
          if (index < candidateBaseUrls.length - 1) {
            tryUpload(index + 1)
            return
          }

          const errMsg =
            error && typeof error === 'object' && 'errMsg' in error
              ? String((error as { errMsg?: string }).errMsg || '文件上传失败')
              : '文件上传失败'
          reject(new Error(errMsg))
        },
      })
    }

    tryUpload(0)
  })
}
