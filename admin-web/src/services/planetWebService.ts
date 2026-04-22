import { apiRequest } from './apiClient'
import { getStoredSessionToken } from './authStorage'
import { env } from '../env'

export const DEMO_OWNER_ID = 'usr_owner_001'

export function resolvePlanetAssetUrl(url: string | null | undefined) {
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

export interface PlanetCardItem {
  id: string
  name: string
  slug: string
  avatarImageUrl: string
  coverImageUrl: string
  intro: string
  price: number
  priceLabel: string
  joinType: string
  isFree: boolean
  requireInviteCode: boolean
  ownerName: string
  ownerTagline: string
  category: string
  memberCount: number
  postCount: number
  createdAt: string
  joined?: boolean
}

interface PlanetListResponse {
  ok: boolean
  data: PlanetCardItem[]
}

export interface GroupHomePayload {
  group: {
    id: string
    name: string
    intro: string
    description: string
    avatarUrl: string
    coverUrl: string
    status: string
    joinType: string
    billingPeriod: string
    priceAmount: number
    originalPriceAmount: number
    memberCount: number
    paidMemberCount: number
    contentCount: number
    publishedAt: string | null
    createdAt: string | null
  }
  owner: {
    id: string
    nickname: string
    avatarUrl: string
    bio: string
  }
  viewer: {
    id: string
    nickname: string
    avatarUrl: string
  } | null
  membership: {
    id: string
    status: string
    isActive: boolean
    isPaid: boolean
    expireAt: string | null
    joinedAt: string | null
  } | null
  role: {
    isOwner: boolean
    isStaff: boolean
    staffRole: string | null
    canPublish: boolean
    canManage: boolean
  }
  policy: {
    allowJoin: boolean
    needExamine: boolean
    allowPreview: boolean
    allowSearch: boolean
  } | null
  stats: {
    latestCount: number
    featuredCount: number
    fileCount: number
    answerCount: number
  }
}

interface GroupHomeResponse {
  ok: boolean
  data: GroupHomePayload
}

export interface PostSummaryItem {
  id: string
  groupId: string
  type: string
  status: string
  title: string
  summary: string
  contentText: string
  author: {
    id: string
    nickname: string
    avatarUrl: string
  }
  likeCount: number
  commentCount: number
  readingCount: number
  viewerLiked: boolean
  isPinned: boolean
  isEssence: boolean
  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  attachments: string[]
  metadata: Record<string, unknown>
}

export interface PostDetailItem extends PostSummaryItem {
  viewerModeration?: Record<string, unknown>
}

export interface CommentSummaryItem {
  id: string
  postId: string
  parentId: string | null
  content: string
  likeCount: number
  viewerLiked: boolean
  attachments: string[]
  createdAt: string | null
  updatedAt: string | null
  author: {
    id: string
    nickname: string
    avatarUrl: string
  }
}

interface PostListResponse {
  ok: boolean
  data: {
    items: PostSummaryItem[]
    nextCursor: string | null
    tab: string
  }
}

export async function getDiscoverPlanets() {
  const sessionToken = getStoredSessionToken()
  const response = await apiRequest<PlanetListResponse>('/api/planets/discover', {
    query: {
      limit: 6,
      sessionToken,
    },
  })

  return response.data
}

export async function getGroupDataSnapshot() {
  const sessionToken = getStoredSessionToken()
  const [createdGroupsResponse, joinedGroupsResponse] = await Promise.all([
    apiRequest<PlanetListResponse>('/api/planets/mine', {
      query: {
        sessionToken,
      },
    }),
    apiRequest<PlanetListResponse>('/api/planets/joined', {
      query: {
        sessionToken,
      },
    }),
  ])

  return {
    createdGroups: createdGroupsResponse.data || [],
    joinedGroups: joinedGroupsResponse.data || [],
  }
}

export async function getPlanetHome(groupId: string) {
  const sessionToken = getStoredSessionToken()
  const response = await apiRequest<GroupHomeResponse>('/api/planets/home', {
    query: {
      groupId,
      sessionToken,
    },
  })

  return response.data
}

export async function getPlanetPosts(groupId: string, tab: string) {
  const response = await apiRequest<PostListResponse>('/api/planets/posts', {
    query: {
      groupId,
      tab,
      limit: 20,
    },
  })

  return response.data
}

export async function getPlanetPostDetail(postId: string, incrementRead = true) {
  const response = await apiRequest<{ ok: boolean; data: PostDetailItem }>('/api/posts/detail', {
    query: {
      postId,
      incrementRead: incrementRead ? 1 : 0,
    },
  })

  return response.data
}

export async function getPinnedPlanetPosts(groupId: string) {
  const response = await apiRequest<{ ok: boolean; data: PostSummaryItem[] }>('/api/planets/pinned-posts', {
    query: {
      groupId,
    },
  })

  return response.data || []
}

export interface CreatePlanetPostInput {
  groupId: string
  title?: string
  summary?: string
  contentText?: string
  attachments?: string[]
  metadata?: Record<string, unknown>
  type?: string
  isEssence?: boolean
  isPinned?: boolean
}

export async function createPlanetPost(input: CreatePlanetPostInput) {
  const response = await apiRequest<{ ok: boolean; data: PostSummaryItem }>('/api/planets/posts', {
    method: 'POST',
    body: JSON.stringify({
      groupId: input.groupId,
      title: input.title || '',
      summary: input.summary || '',
      contentText: input.contentText || '',
      attachments: input.attachments || [],
      metadata: input.metadata || {},
      type: input.type || 'TOPIC',
      isEssence: Boolean(input.isEssence),
      isPinned: Boolean(input.isPinned),
    }),
  })

  return response.data
}

export async function createQuickPlanetPost(groupId: string) {
  const nowLabel = new Date().toLocaleString('zh-CN', { hour12: false })

  const response = await apiRequest<{ ok: boolean; data: PostSummaryItem }>('/api/planets/posts', {
    method: 'POST',
    body: JSON.stringify({
      groupId,
      title: `Web 快速发布主题 ${nowLabel}`,
      summary: '这是一条从 admin-web 直接发到 backend 的快速测试主题。',
      contentText: `这是一条从 admin-web 直接发到 backend 的快速测试主题。\n时间：${nowLabel}\n说明：用于验证当前 web 端发帖、内容流刷新和管理动作已经接通真实接口。`,
      type: 'TOPIC',
    }),
  })

  return response.data
}

export async function updatePlanetPost(
  postId: string,
  input: {
    title?: string
    summary?: string
    contentText?: string
    metadata?: Record<string, unknown>
    isPinned?: boolean
    isEssence?: boolean
  },
) {
  const response = await apiRequest<{ ok: boolean; data: PostSummaryItem }>('/api/planets/posts', {
    method: 'PUT',
    body: JSON.stringify({
      postId,
      ...input,
    }),
  })

  return response.data
}

export async function deletePlanetPost(postId: string) {
  return apiRequest<{ ok: boolean; message: string }>('/api/planets/posts/delete', {
    method: 'POST',
    body: JSON.stringify({
      postId,
    }),
  })
}

export async function togglePlanetPostLike(postId: string, increment: boolean) {
  const response = await apiRequest<{ ok: boolean; data: PostSummaryItem }>('/api/posts/like', {
    method: 'POST',
    body: JSON.stringify({
      postId,
      increment,
    }),
  })

  return response.data
}

export async function reportPlanetPost(postId: string, reason: string) {
  const response = await apiRequest<{
    ok: boolean
    data: {
      postId: string
      reportStatus: string
      reportCount: number
      reportPendingCount: number
      idempotent: boolean
    }
  }>('/api/posts/report', {
    method: 'POST',
    body: JSON.stringify({
      postId,
      reason,
    }),
  })

  return response.data
}

export async function createPlanetPostComment(postId: string, content: string, attachments: string[] = []) {
  return apiRequest<{ ok: boolean; data: { id: string } }>('/api/posts/comments', {
    method: 'POST',
    body: JSON.stringify({
      postId,
      content,
      attachments,
    }),
  })
}

export async function getPlanetPostComments(postId: string) {
  const response = await apiRequest<{ ok: boolean; data: CommentSummaryItem[] }>('/api/posts/comments', {
    query: {
      postId,
    },
  })

  return response.data || []
}

export async function uploadPlanetImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const sessionToken = getStoredSessionToken()
  const headers = new Headers()
  headers.set('Accept', 'application/json')
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

  return resolvePlanetAssetUrl(payload.data.url)
}

export interface PlanetVideoUploadResult {
  url: string
  filename: string
  mimeType: string
  size: number
}

export async function uploadPlanetVideo(file: File): Promise<PlanetVideoUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const sessionToken = getStoredSessionToken()
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  if (sessionToken) {
    headers.set('x-session-token', sessionToken)
  }

  const url = new URL('/api/uploads/video', env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl : `${env.apiBaseUrl}/`)
  const response = await fetch(url.toString(), {
    method: 'POST',
    body: formData,
    headers,
  })

  const payload = (await response.json()) as {
    ok: boolean
    data?: { url: string; filename: string; mimeType: string; size: number }
    message?: string
  }
  if (!response.ok || !payload.ok || !payload.data?.url) {
    throw new Error(payload.message || '视频上传失败')
  }

  return {
    ...payload.data,
    url: resolvePlanetAssetUrl(payload.data.url),
  }
}
