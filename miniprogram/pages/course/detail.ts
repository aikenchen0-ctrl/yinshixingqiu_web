import type { CourseLesson } from '../../utils/course-types'
import { fetchCourseDetail } from '../../utils/course-api'

Page({
  data: {
    hasCourse: false,
    courseId: '',
    title: '',
    subtitle: '',
    summary: '',
    category: '',
    difficulty: '',
    updatedAt: '',
    lessonCountLabel: '',
    completedLessonCountLabel: '',
    coverImage: '',
    lessons: [] as CourseLesson[],
    errorText: '',
  },

  onLoad(options: Record<string, string>) {
    const courseId = String(options.courseId || options.id || '')
    void this.loadCourse(courseId)
  },

  async loadCourse(courseId: string) {
    if (!courseId) {
      this.setData({
        hasCourse: false,
        errorText: '缺少课程ID，请返回课程列表重新选择。',
      })
      return
    }

    try {
      const course = await fetchCourseDetail(courseId)

      this.setData({
        hasCourse: true,
        courseId: course.id,
        title: course.title,
        subtitle: course.subtitle,
        summary: course.summary,
        category: course.category,
        difficulty: course.difficulty,
        updatedAt: course.updatedAt,
        lessonCountLabel: course.lessonCountLabel,
        completedLessonCountLabel: course.completedLessonCountLabel || '',
        coverImage: course.coverImage,
        lessons: course.lessons,
        errorText: '',
      })
      return
    } catch (error) {
      const errorText = error instanceof Error ? error.message : '课程不存在或已下架，请返回课程列表重新选择。'

      this.setData({
        hasCourse: false,
        courseId: '',
        title: '',
        subtitle: '',
        summary: '',
        category: '',
        difficulty: '',
        updatedAt: '',
        lessonCountLabel: '',
        completedLessonCountLabel: '',
        coverImage: '',
        lessons: [],
        errorText,
      })
    }
  },

  goContent(e: WechatMiniprogram.TouchEvent) {
    const lessonId = String(e.currentTarget.dataset.lessonId || '')
    if (!lessonId) {
      return
    }

    wx.navigateTo({
      url: `/pages/course/content?lessonId=${lessonId}`,
    })
  },

  goList() {
    wx.switchTab({
      url: '/pages/course/list',
    })
  },
})
