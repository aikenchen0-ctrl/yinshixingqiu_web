import { API_BASE_URLS, getApiBaseUrl, request, setApiBaseUrl } from './request'
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

interface PlanetHomeResponse {
  ok: boolean
  data: {
    group: Record<string, any>
    owner: Record<string, any>
    viewer: Record<string, any> | null
    membership: Record<string, any> | null
    role: Record<string, any>
    policy: Record<string, any> | null
    stats: Record<string, any>
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

interface PlanetPostDetailResponse {
  ok: boolean
  data: Record<string, any>
}

interface PlanetCommentsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface PlanetMyPostsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface DiscoverFeaturedPostsResponse {
  ok: boolean
  data: Array<Record<string, any>>
}

interface UploadImageResponse {
  ok: boolean
  data: {
    url: string
    filename: string
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

export function fetchDiscoverFeaturedPosts(limit = 12, sessionToken?: string) {
  const query = [`limit=${encodeURIComponent(String(limit))}`]

  return request<DiscoverFeaturedPostsResponse>({
    url: `/api/planets/discover-featured-posts?${query.join('&')}`,
    sessionToken,
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

export function fetchPlanetHome(payload: {
  groupId: string
  sessionToken?: string
  userId?: string
}) {
  const query = [`groupId=${encodeURIComponent(payload.groupId)}`]
  if (payload.sessionToken) {
    query.push(`sessionToken=${encodeURIComponent(payload.sessionToken)}`)
  }
  if (payload.userId) {
    query.push(`userId=${encodeURIComponent(payload.userId)}`)
  }

  return request<PlanetHomeResponse>({
    url: `/api/planets/home?${query.join('&')}`,
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

export function fetchMyPlanetPosts(sessionToken: string) {
  return request<PlanetMyPostsResponse>({
    url: `/api/planets/my-posts?sessionToken=${encodeURIComponent(sessionToken)}`,
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

    const tryUpload = (index: number) => {
      const baseUrl = candidateBaseUrls[index]
      wx.uploadFile({
        url: `${baseUrl}/api/uploads/image`,
        filePath,
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
}
