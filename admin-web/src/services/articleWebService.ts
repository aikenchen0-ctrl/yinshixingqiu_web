import { apiRequest } from './apiClient'

export type ArticleContentSource = 'wechat' | 'planet' | ''
export type ArticleAccessType = 'free' | 'paid'
export type ArticlePreviewMode = 'paragraph' | 'ratio'
export type ArticleReadState = 'free_full' | 'paid_locked' | 'paid_unlocked'
export type ArticleStatus = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'

export interface ArticleAuthorDisplay {
  type: string
  name: string
  avatarUrl: string
  sourceGroupId: string
  sourceUserId: string
}

export interface ArticleAccess {
  accessType: ArticleAccessType
  priceAmount: number
  priceLabel: string
  isUnlocked: boolean
  previewMode: ArticlePreviewMode
  previewValue: number
  contentParagraphCount?: number
  previewParagraphCount?: number
}

export interface ArticlePreview {
  previewText: string
  previewRichContent: string
  contentParagraphCount?: number
  previewParagraphCount?: number
  previewMode?: ArticlePreviewMode
  previewValue?: number
}

export interface ArticleItem {
  id: string
  groupId: string
  type: 'ARTICLE'
  status: string
  title: string
  summary: string
  contentText: string
  contentSource: ArticleContentSource
  coverUrl: string
  richContent: string
  tags: string[]
  authorDisplay: ArticleAuthorDisplay | null
  access: ArticleAccess | null
  preview: ArticlePreview | null
  attachments: string[]
  isPinned: boolean
  isEssence: boolean
  readingCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
  readState?: ArticleReadState
  canReadFull?: boolean
  fullParagraphCount?: number
  visibleParagraphCount?: number
  hiddenParagraphCount?: number
  previewContentText?: string
  previewRichContent?: string
  contentParagraphs?: string[]
  previewParagraphs?: string[]
}

export interface ArticleListQuery {
  groupId?: string
  status?: ArticleStatus
  contentSource?: ArticleContentSource
  accessType?: ArticleAccessType | ''
  search?: string
  page?: number
  pageSize?: number
}

export interface ArticleListPayload {
  page: number
  pageSize: number
  total: number
  totalPages: number
  items: ArticleItem[]
  filters: {
    groupId: string
    search: string
    status: string
    contentSource: string
    accessType: string
    includeRestricted: boolean
  }
}

export interface SaveArticleInput {
  articleId?: string
  groupId?: string
  title: string
  summary: string
  contentText: string
  contentSource: Exclude<ArticleContentSource, ''>
  coverUrl?: string
  richContent?: string
  tags?: string[]
  attachments?: string[]
  metadata?: Record<string, unknown>
  access?: Partial<ArticleAccess>
  preview?: Partial<ArticlePreview>
  isPinned?: boolean
  isEssence?: boolean
}

export interface UpdateArticleStatusInput {
  articleId: string
  status?: Exclude<ArticleStatus, 'ALL'>
  isPinned?: boolean
  isEssence?: boolean
}

export async function listArticles(query: ArticleListQuery = {}) {
  const response = await apiRequest<{ ok: true; data: ArticleListPayload }>('/api/articles', {
    query: {
      groupId: query.groupId || '',
      status: query.status || 'ALL',
      contentSource: query.contentSource || '',
      accessType: query.accessType || '',
      search: query.search || '',
      includeRestricted: 1,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })

  return response.data
}

export async function getArticleDetail(articleId: string, incrementRead = false) {
  const response = await apiRequest<{ ok: true; data: ArticleItem }>('/api/articles/detail', {
    query: {
      articleId,
      incrementRead: incrementRead ? 1 : 0,
    },
  })

  return response.data
}

export async function saveArticle(input: SaveArticleInput) {
  const response = await apiRequest<{ ok: true; data: ArticleItem }>('/api/articles', {
    method: input.articleId ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateArticleStatus(input: UpdateArticleStatusInput) {
  const response = await apiRequest<{ ok: true; data: ArticleItem }>('/api/articles/status', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return response.data
}
