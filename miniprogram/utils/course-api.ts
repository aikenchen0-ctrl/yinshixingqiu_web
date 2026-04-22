import { getStoredSession } from './auth'
import type { CourseCategoryTab, CourseLessonLookup, CourseRecord } from './course-types'
import { request } from './request'

interface CourseListResponse {
  ok: boolean
  data: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    categories: CourseCategoryTab[]
    filters: {
      groupId: string
      search: string
      category: string
      includeRestricted: boolean
    }
    items: CourseRecord[]
  }
}

interface CourseDetailResponse {
  ok: boolean
  data: CourseRecord
}

interface CourseLessonDetailResponse {
  ok: boolean
  data: CourseLessonLookup
}

interface CourseProgressResponse {
  ok: boolean
  data: {
    id: string
    courseId: string
    lessonId: string
    userId: string
    isCompleted: boolean
    lastPositionSec: number
    completedAt: string
    updatedAt: string
  }
}

function getCourseSessionToken() {
  const session = getStoredSession()
  return session && session.sessionToken ? session.sessionToken : ''
}

export async function fetchCourseCatalog(payload: {
  keyword?: string
  category?: string
  page?: number
  pageSize?: number
}) {
  const query = [`page=${encodeURIComponent(String(payload.page || 1))}`, `pageSize=${encodeURIComponent(String(payload.pageSize || 50))}`]

  if (payload.keyword) {
    query.push(`search=${encodeURIComponent(payload.keyword)}`)
  }

  if (payload.category && payload.category !== 'all') {
    query.push(`category=${encodeURIComponent(payload.category)}`)
  }

  const response = await request<CourseListResponse>({
    url: `/api/courses?${query.join('&')}`,
    sessionToken: getCourseSessionToken(),
    retryOnRouteNotFound: true,
    routeNotFoundMessage: '当前后端还没有课程接口，请先启动或更新本地后端。',
  })

  return response.data
}

export async function fetchCourseDetail(courseId: string) {
  const response = await request<CourseDetailResponse>({
    url: `/api/courses/detail?courseId=${encodeURIComponent(courseId)}`,
    sessionToken: getCourseSessionToken(),
    retryOnRouteNotFound: true,
    routeNotFoundMessage: '当前后端还没有课程详情接口，请先启动或更新本地后端。',
  })

  return response.data
}

export async function fetchCourseLessonDetail(lessonId: string) {
  const response = await request<CourseLessonDetailResponse>({
    url: `/api/courses/lessons/detail?lessonId=${encodeURIComponent(lessonId)}`,
    sessionToken: getCourseSessionToken(),
    retryOnRouteNotFound: true,
    routeNotFoundMessage: '当前后端还没有课程内容接口，请先启动或更新本地后端。',
  })

  return response.data
}

export async function saveCourseLessonProgress(payload: {
  lessonId: string
  lastPositionSec?: number
  isCompleted?: boolean
}) {
  const sessionToken = getCourseSessionToken()
  if (!sessionToken) {
    return null
  }

  const response = await request<CourseProgressResponse>({
    url: '/api/courses/progress',
    method: 'POST',
    sessionToken,
    data: {
      lessonId: payload.lessonId,
      lastPositionSec: payload.lastPositionSec || 0,
      isCompleted: payload.isCompleted === true,
    },
  })

  return response.data
}
