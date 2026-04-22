import { apiRequest } from './apiClient'

export type AdminCourseStatus = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'
export type AdminCourseAccessType = 'FREE' | 'MEMBER' | 'PAID'
export type AdminCourseLessonType = 'VIDEO' | 'ARTICLE'

export interface AdminCourseLessonItem {
  id: string
  courseId: string
  courseTitle: string
  title: string
  summary: string
  type: 'video' | 'article'
  typeLabel: string
  duration: string
  sortOrder: number
  order: number
  orderLabel: string
  videoUrl: string
  posterImage: string
  article: {
    coverImage: string
    paragraphs: string[]
    images: string[]
  }
  contentText: string
  richContent: string
  coverImage: string
  images: string[]
  isTrial: boolean
  status: Exclude<AdminCourseStatus, 'ALL'>
  statusLabel: string
  canAccess: boolean
  lockedReason: string
}

export interface AdminCourseItem {
  id: string
  groupId: string
  title: string
  subtitle: string
  summary: string
  category: string
  difficulty: string
  updatedAt: string
  updatedAtIso: string
  coverImage: string
  tags: string[]
  lessons: AdminCourseLessonItem[]
  lessonCount: number
  lessonCountLabel: string
  firstLessonId: string
  hasVideoLesson: boolean
  hasArticleLesson: boolean
  completedLessonCount: number
  completedLessonCountLabel: string
  status: Exclude<AdminCourseStatus, 'ALL'>
  statusLabel: string
  accessType: AdminCourseAccessType
  priceAmount: number
  priceLabel: string
  sortOrder: number
  publishedAt: string
  createdAt: string
  lastLessonId: string
}

export interface AdminCourseListPayload {
  page: number
  pageSize: number
  total: number
  totalPages: number
  filters: {
    groupId: string
    status: AdminCourseStatus
    search: string
  }
  summary: {
    total: number
    draft: number
    published: number
    hidden: number
    deleted: number
  }
  items: AdminCourseItem[]
}

export interface AdminCourseListQuery {
  groupId?: string
  status?: AdminCourseStatus
  search?: string
  page?: number
  pageSize?: number
}

export interface SaveAdminCourseInput {
  groupId?: string
  courseId?: string
  title: string
  subtitle?: string
  summary?: string
  category?: string
  difficulty?: string
  coverImage?: string
  tags?: string[]
  accessType?: AdminCourseAccessType
  priceAmount?: number
  sortOrder?: number
}

export interface SaveAdminCourseLessonInput {
  groupId?: string
  courseId: string
  lessonId?: string
  title: string
  summary?: string
  lessonType: AdminCourseLessonType
  videoUrl?: string
  durationText?: string
  contentText?: string
  richContent?: string
  coverImage?: string
  posterImage?: string
  images?: string[]
  isTrial?: boolean
  sortOrder?: number
}

export async function listAdminCourses(query: AdminCourseListQuery) {
  const response = await apiRequest<{ ok: true; data: AdminCourseListPayload }>('/api/admin/courses', {
    query: {
      groupId: query.groupId || '',
      status: query.status || 'ALL',
      search: query.search || '',
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })

  return response.data
}

export async function saveAdminCourse(input: SaveAdminCourseInput) {
  const response = await apiRequest<{ ok: true; data: AdminCourseItem }>('/api/admin/courses', {
    method: input.courseId ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateAdminCourseStatus(input: {
  groupId?: string
  courseId: string
  status: Exclude<AdminCourseStatus, 'ALL'>
}) {
  const response = await apiRequest<{ ok: true; data: AdminCourseItem }>('/api/admin/courses/status', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function saveAdminCourseLesson(input: SaveAdminCourseLessonInput) {
  const response = await apiRequest<{ ok: true; data: AdminCourseLessonItem }>('/api/admin/course-lessons', {
    method: input.lessonId ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateAdminCourseLessonStatus(input: {
  groupId?: string
  courseId: string
  lessonId: string
  status: Exclude<AdminCourseStatus, 'ALL'>
}) {
  const response = await apiRequest<{ ok: true; data: AdminCourseLessonItem }>('/api/admin/course-lessons/status', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return response.data
}
