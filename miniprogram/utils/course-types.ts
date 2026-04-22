export type CourseLessonType = 'video' | 'article'

export interface CourseArticleContent {
  coverImage: string
  paragraphs: string[]
  images: string[]
}

export interface CourseLesson {
  id: string
  courseId: string
  courseTitle: string
  title: string
  summary: string
  type: CourseLessonType
  typeLabel: string
  duration: string
  sortOrder?: number
  order: number
  orderLabel: string
  videoUrl: string
  posterImage: string
  article: CourseArticleContent
  contentText?: string
  richContent?: string
  coverImage?: string
  images?: string[]
  isTrial?: boolean
  status?: string
  statusLabel?: string
  canAccess?: boolean
  lockedReason?: string
  progress?: {
    isCompleted: boolean
    lastPositionSec: number
    completedAt: string
    updatedAt: string
  } | null
}

export interface CourseRecord {
  id: string
  title: string
  subtitle: string
  summary: string
  category: string
  difficulty: string
  updatedAt: string
  coverImage: string
  tags: string[]
  lessons: CourseLesson[]
  lessonCount: number
  lessonCountLabel: string
  firstLessonId: string
  hasVideoLesson: boolean
  hasArticleLesson: boolean
  status?: string
  statusLabel?: string
  accessType?: string
  priceAmount?: number
  priceLabel?: string
  completedLessonCount?: number
  completedLessonCountLabel?: string
}

export interface CourseCategoryTab {
  key: string
  label: string
  count: number
}

export interface CourseLessonLookup {
  course: CourseRecord
  lesson: CourseLesson
  previousLesson: CourseLesson | null
  nextLesson: CourseLesson | null
  lessonIndex: number
  lessonTotal: number
  paywall?: {
    show: boolean
    title: string
    buttonText: string
  } | null
}
