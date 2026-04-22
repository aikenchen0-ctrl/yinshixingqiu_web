import type { CourseLessonLookup } from '../../utils/course-types'
import { fetchCourseLessonDetail, saveCourseLessonProgress } from '../../utils/course-api'

const courseProgressRuntime = {
  lessonId: '',
  lastKnownPositionSec: 0,
  lastSyncedPositionSec: 0,
  completed: false,
  pending: false,
}

function resetCourseProgressRuntime() {
  courseProgressRuntime.lessonId = ''
  courseProgressRuntime.lastKnownPositionSec = 0
  courseProgressRuntime.lastSyncedPositionSec = 0
  courseProgressRuntime.completed = false
  courseProgressRuntime.pending = false
}

Page({
  data: {
    hasLesson: false,
    errorText: '',
    courseId: '',
    courseTitle: '',
    lessonId: '',
    lessonTitle: '',
    lessonSummary: '',
    lessonDuration: '',
    lessonTypeLabel: '',
    lessonIndexText: '',
    isVideo: false,
    isArticle: false,
    videoUrl: '',
    posterImage: '',
    articleCoverImage: '',
    articleParagraphs: [] as string[],
    articleImages: [] as string[],
    previousLessonId: '',
    previousLessonTitle: '',
    nextLessonId: '',
    nextLessonTitle: '',
    playError: false,
    canAccess: true,
    lockedReason: '',
    paywallTitle: '',
    paywallButtonText: '',
    resumePositionSec: 0,
  },

  onLoad(options: Record<string, string>) {
    const lessonId = String(options.lessonId || options.id || '')
    void this.loadLesson(lessonId)
  },

  async loadLesson(lessonId: string) {
    resetCourseProgressRuntime()

    if (!lessonId) {
      this.setData({
        hasLesson: false,
        errorText: '缺少课节ID，请返回上一页重新选择。',
      })
      return
    }

    try {
      const lookup = await fetchCourseLessonDetail(lessonId)
      this.applyLessonLookup(lookup)
      return
    } catch (error) {
      this.setData({
        hasLesson: false,
        errorText: error instanceof Error ? error.message : '课程内容不存在或已下架，请返回上一页重新选择。',
        courseId: '',
        courseTitle: '',
        lessonId: '',
        lessonTitle: '',
        lessonSummary: '',
        lessonDuration: '',
        lessonTypeLabel: '',
        lessonIndexText: '',
        isVideo: false,
        isArticle: false,
        videoUrl: '',
        posterImage: '',
        articleCoverImage: '',
        articleParagraphs: [],
        articleImages: [],
        previousLessonId: '',
        previousLessonTitle: '',
        nextLessonId: '',
        nextLessonTitle: '',
        playError: false,
        canAccess: true,
        lockedReason: '',
        paywallTitle: '',
        paywallButtonText: '',
        resumePositionSec: 0,
      })
    }
  },

  applyLessonLookup(lookup: CourseLessonLookup) {
    const { course, lesson, previousLesson, nextLesson, lessonIndex, lessonTotal } = lookup
    const canAccess = lesson.canAccess !== false
    const paywallTitle = lookup.paywall && lookup.paywall.show ? lookup.paywall.title : ''
    const paywallButtonText = lookup.paywall && lookup.paywall.show ? lookup.paywall.buttonText : ''
    const resumePositionSec = lesson.progress ? Math.max(0, Math.floor(lesson.progress.lastPositionSec || 0)) : 0

    courseProgressRuntime.lessonId = lesson.id
    courseProgressRuntime.lastKnownPositionSec = resumePositionSec
    courseProgressRuntime.lastSyncedPositionSec = resumePositionSec
    courseProgressRuntime.completed = Boolean(lesson.progress && lesson.progress.isCompleted)
    courseProgressRuntime.pending = false

    this.setData({
      hasLesson: true,
      errorText: '',
      courseId: course.id,
      courseTitle: course.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonSummary: lesson.summary,
      lessonDuration: lesson.duration,
      lessonTypeLabel: lesson.typeLabel,
      lessonIndexText: `第 ${lessonIndex} / ${lessonTotal} 节`,
      isVideo: lesson.type === 'video' && canAccess,
      isArticle: lesson.type === 'article' && canAccess,
      videoUrl: lesson.videoUrl,
      posterImage: lesson.posterImage,
      articleCoverImage: lesson.article.coverImage,
      articleParagraphs: lesson.article.paragraphs,
      articleImages: lesson.article.images,
      previousLessonId: previousLesson ? previousLesson.id : '',
      previousLessonTitle: previousLesson ? previousLesson.title : '已经是第一节',
      nextLessonId: nextLesson ? nextLesson.id : '',
      nextLessonTitle: nextLesson ? nextLesson.title : '已经是最后一节',
      playError: false,
      canAccess,
      lockedReason: lesson.lockedReason || '',
      paywallTitle,
      paywallButtonText,
      resumePositionSec,
    })

    if (canAccess && lesson.type === 'article') {
      void this.syncLessonProgress({
        lessonId: lesson.id,
        lastPositionSec: resumePositionSec,
        isCompleted: true,
        force: !courseProgressRuntime.completed,
      })
    }
  },

  async syncLessonProgress(payload: {
    lessonId?: string
    lastPositionSec?: number
    isCompleted?: boolean
    force?: boolean
  }) {
    const lessonId = String(payload.lessonId || this.data.lessonId || '')
    if (!lessonId || !this.data.canAccess || lessonId !== courseProgressRuntime.lessonId) {
      return
    }

    const lastPositionSec = Math.max(
      courseProgressRuntime.lastKnownPositionSec,
      Math.floor(Number(payload.lastPositionSec || 0)),
    )
    const isCompleted = payload.isCompleted === true
    courseProgressRuntime.lastKnownPositionSec = lastPositionSec

    if (!payload.force && !isCompleted && lastPositionSec - courseProgressRuntime.lastSyncedPositionSec < 15) {
      return
    }

    if (!payload.force && isCompleted && courseProgressRuntime.completed && lastPositionSec <= courseProgressRuntime.lastSyncedPositionSec) {
      return
    }

    if (courseProgressRuntime.pending) {
      return
    }

    courseProgressRuntime.pending = true

    try {
      const progress = await saveCourseLessonProgress({
        lessonId,
        lastPositionSec,
        isCompleted,
      })

      if (!progress || courseProgressRuntime.lessonId !== lessonId) {
        return
      }

      courseProgressRuntime.lastSyncedPositionSec = Math.max(
        courseProgressRuntime.lastSyncedPositionSec,
        progress.lastPositionSec || lastPositionSec,
      )
      courseProgressRuntime.lastKnownPositionSec = Math.max(
        courseProgressRuntime.lastKnownPositionSec,
        progress.lastPositionSec || lastPositionSec,
      )
      courseProgressRuntime.completed = courseProgressRuntime.completed || Boolean(progress.isCompleted || isCompleted)

      if (this.data.lessonId === lessonId) {
        this.setData({
          resumePositionSec: courseProgressRuntime.lastKnownPositionSec,
        })
      }
    } catch (error) {
      console.warn('[course] sync progress failed', error)
    } finally {
      if (courseProgressRuntime.lessonId === lessonId) {
        courseProgressRuntime.pending = false
      }
    }
  },

  onVideoError() {
    this.setData({
      playError: true,
    })

    wx.showToast({
      title: '视频加载失败，请稍后重试',
      icon: 'none',
    })
  },

  onVideoTimeUpdate(event: WechatMiniprogram.CustomEvent<{ currentTime?: number }>) {
    if (!this.data.isVideo || !this.data.canAccess) {
      return
    }

    const currentTime = Math.max(0, Math.floor(Number(event.detail.currentTime || 0)))
    if (!currentTime) {
      return
    }

    courseProgressRuntime.lastKnownPositionSec = Math.max(courseProgressRuntime.lastKnownPositionSec, currentTime)
    void this.syncLessonProgress({
      lastPositionSec: currentTime,
    })
  },

  onVideoPause() {
    if (!this.data.isVideo || !this.data.canAccess) {
      return
    }

    void this.syncLessonProgress({
      lastPositionSec: courseProgressRuntime.lastKnownPositionSec,
      force: true,
    })
  },

  onVideoEnded() {
    if (!this.data.isVideo || !this.data.canAccess) {
      return
    }

    void this.syncLessonProgress({
      lastPositionSec: courseProgressRuntime.lastKnownPositionSec,
      isCompleted: true,
      force: true,
    })
  },

  navigateLesson(lessonId: string) {
    if (!lessonId) {
      return
    }

    if (this.data.isVideo && this.data.canAccess) {
      void this.syncLessonProgress({
        lastPositionSec: courseProgressRuntime.lastKnownPositionSec,
        force: true,
      })
    }

    wx.redirectTo({
      url: `/pages/course/content?lessonId=${lessonId}`,
    })
  },

  onPrevLesson() {
    this.navigateLesson(this.data.previousLessonId)
  },

  onNextLesson() {
    this.navigateLesson(this.data.nextLessonId)
  },

  goCourseDetail() {
    const courseId = this.data.courseId

    if (!courseId) {
      this.goList()
      return
    }

    wx.redirectTo({
      url: `/pages/course/detail?courseId=${courseId}`,
    })
  },

  goList() {
    wx.switchTab({
      url: '/pages/course/list',
    })
  },

  onHide() {
    if (!this.data.isVideo || !this.data.canAccess) {
      return
    }

    void this.syncLessonProgress({
      lastPositionSec: courseProgressRuntime.lastKnownPositionSec,
      force: true,
    })
  },

  onUnload() {
    if (!this.data.isVideo || !this.data.canAccess) {
      return
    }

    void this.syncLessonProgress({
      lastPositionSec: courseProgressRuntime.lastKnownPositionSec,
      force: true,
    })
  },
})
