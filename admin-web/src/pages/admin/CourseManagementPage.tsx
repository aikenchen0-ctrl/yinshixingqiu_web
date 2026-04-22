import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout'
import { coursePlatformMenuGroups } from '../../data/menu'
import {
  listAdminCourses,
  saveAdminCourse,
  saveAdminCourseLesson,
  updateAdminCourseLessonStatus,
  updateAdminCourseStatus,
  type AdminCourseAccessType,
  type AdminCourseItem,
  type AdminCourseLessonItem,
  type AdminCourseLessonType,
  type AdminCourseStatus,
} from '../../services/adminCourseService'

type CourseFormState = {
  courseId: string
  title: string
  subtitle: string
  summary: string
  category: string
  difficulty: string
  coverImage: string
  tagsText: string
  accessType: AdminCourseAccessType
  priceAmount: string
  sortOrder: string
}

type LessonFormState = {
  lessonId: string
  courseId: string
  title: string
  summary: string
  lessonType: AdminCourseLessonType
  videoUrl: string
  durationText: string
  contentText: string
  coverImage: string
  posterImage: string
  imagesText: string
  isTrial: boolean
  sortOrder: string
}

type CourseWorkbenchMode = 'COURSE' | 'LESSON'

function createEmptyCourseForm(): CourseFormState {
  return {
    courseId: '',
    title: '',
    subtitle: '',
    summary: '',
    category: '',
    difficulty: '',
    coverImage: '',
    tagsText: '',
    accessType: 'FREE',
    priceAmount: '0',
    sortOrder: '0',
  }
}

function createEmptyLessonForm(courseId = ''): LessonFormState {
  return {
    lessonId: '',
    courseId,
    title: '',
    summary: '',
    lessonType: 'ARTICLE',
    videoUrl: '',
    durationText: '',
    contentText: '',
    coverImage: '',
    posterImage: '',
    imagesText: '',
    isTrial: false,
    sortOrder: '0',
  }
}

function buildCourseForm(course: AdminCourseItem): CourseFormState {
  return {
    courseId: course.id,
    title: course.title,
    subtitle: course.subtitle,
    summary: course.summary,
    category: course.category,
    difficulty: course.difficulty,
    coverImage: course.coverImage,
    tagsText: course.tags.join(', '),
    accessType: course.accessType,
    priceAmount: String(course.priceAmount || 0),
    sortOrder: String(course.sortOrder || 0),
  }
}

function buildLessonForm(courseId: string, lesson?: AdminCourseLessonItem | null): LessonFormState {
  if (!lesson) {
    return createEmptyLessonForm(courseId)
  }

  return {
    lessonId: lesson.id,
    courseId,
    title: lesson.title,
    summary: lesson.summary,
    lessonType: lesson.type === 'video' ? 'VIDEO' : 'ARTICLE',
    videoUrl: lesson.videoUrl,
    durationText: lesson.duration,
    contentText: lesson.contentText,
    coverImage: lesson.coverImage,
    posterImage: lesson.posterImage,
    imagesText: lesson.images.join('\n'),
    isTrial: lesson.isTrial,
    sortOrder: String(Math.max(0, lesson.sortOrder)),
  }
}

function parseTags(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function parseImages(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30)
}

function getCourseActionLabel(status: AdminCourseStatus) {
  if (status === 'PUBLISHED') {
    return '下架课程'
  }

  if (status === 'HIDDEN' || status === 'DRAFT') {
    return '发布课程'
  }

  return ''
}

function getCourseNextStatus(status: AdminCourseStatus): Exclude<AdminCourseStatus, 'ALL'> | '' {
  if (status === 'PUBLISHED') {
    return 'HIDDEN'
  }

  if (status === 'HIDDEN' || status === 'DRAFT') {
    return 'PUBLISHED'
  }

  return ''
}

function getLessonActionLabel(status: AdminCourseStatus) {
  if (status === 'PUBLISHED') {
    return '下架课节'
  }

  if (status === 'HIDDEN' || status === 'DRAFT') {
    return '发布课节'
  }

  return ''
}

function getLessonNextStatus(status: AdminCourseStatus): Exclude<AdminCourseStatus, 'ALL'> | '' {
  if (status === 'PUBLISHED') {
    return 'HIDDEN'
  }

  if (status === 'HIDDEN' || status === 'DRAFT') {
    return 'PUBLISHED'
  }

  return ''
}

function getStatusChipClass(status: AdminCourseStatus) {
  if (status === 'PUBLISHED') return 'resource-table-chip is-success'
  if (status === 'HIDDEN') return 'resource-table-chip is-warning'
  if (status === 'DELETED') return 'resource-table-chip is-danger'
  return 'resource-table-chip is-muted'
}

function CourseWorkbenchPage({ mode }: { mode: CourseWorkbenchMode }) {
  const [statusFilter, setStatusFilter] = useState<AdminCourseStatus>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [courses, setCourses] = useState<AdminCourseItem[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [isCreatingCourse, setIsCreatingCourse] = useState(false)
  const [courseForm, setCourseForm] = useState<CourseFormState>(createEmptyCourseForm())
  const [lessonForm, setLessonForm] = useState<LessonFormState>(createEmptyLessonForm())
  const [savingCourse, setSavingCourse] = useState(false)
  const [savingLesson, setSavingLesson] = useState(false)
  const [operatingCourseId, setOperatingCourseId] = useState('')
  const [operatingLessonId, setOperatingLessonId] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const isCourseMode = mode === 'COURSE'
  const isLessonMode = mode === 'LESSON'

  const selectedCourse = useMemo(
    () => courses.find((item) => item.id === selectedCourseId) || null,
    [courses, selectedCourseId],
  )

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    listAdminCourses({
      status: statusFilter,
      search: searchKeyword,
      page: 1,
      pageSize: 50,
    })
      .then((payload) => {
        if (!active) return
        setCourses(payload.items)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载课程工作台失败')
        setCourses([])
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [reloadToken, searchKeyword, statusFilter])

  useEffect(() => {
    if (!courses.length) {
      setSelectedCourseId('')
      return
    }

    if (isCreatingCourse) {
      return
    }

    if (selectedCourseId && courses.some((item) => item.id === selectedCourseId)) {
      return
    }

    setSelectedCourseId(courses[0].id)
  }, [courses, isCreatingCourse, selectedCourseId])

  useEffect(() => {
    if (!selectedCourse) {
      setLessonForm((previous) => createEmptyLessonForm(previous.courseId))
      return
    }

    if (isCreatingCourse) {
      return
    }

    if (courseForm.courseId !== selectedCourse.id) {
      setCourseForm(buildCourseForm(selectedCourse))
    }

    if (!lessonForm.lessonId || lessonForm.courseId !== selectedCourse.id) {
      setLessonForm(createEmptyLessonForm(selectedCourse.id))
    }
  }, [courseForm.courseId, isCreatingCourse, lessonForm.courseId, lessonForm.lessonId, selectedCourse])

  const summary = useMemo(
    () =>
      courses.reduce(
        (result, item) => {
          result.total += 1
          if (item.status === 'PUBLISHED') result.published += 1
          if (item.status === 'DRAFT') result.draft += 1
          if (item.status === 'HIDDEN') result.hidden += 1
          return result
        },
        { total: 0, published: 0, draft: 0, hidden: 0 },
      ),
    [courses],
  )

  const lessonSummary = useMemo(
    () =>
      courses.reduce(
        (result, course) => {
          result.courseTotal += 1
          course.lessons.forEach((lesson) => {
            result.total += 1
            if (lesson.status === 'PUBLISHED') result.published += 1
            if (lesson.status === 'DRAFT') result.draft += 1
            if (lesson.status === 'HIDDEN') result.hidden += 1
          })
          return result
        },
        { courseTotal: 0, total: 0, published: 0, draft: 0, hidden: 0 },
      ),
    [courses],
  )

  function triggerReload() {
    setReloadToken((value) => value + 1)
  }

  function openCreateCourseForm() {
    setIsCreatingCourse(true)
    setSelectedCourseId('')
    setCourseForm(createEmptyCourseForm())
    setLessonForm(createEmptyLessonForm())
  }

  function openCourseEditor(course: AdminCourseItem) {
    setIsCreatingCourse(false)
    setSelectedCourseId(course.id)
    setCourseForm(buildCourseForm(course))
    resetLessonForm(course.id)
  }

  function selectCourseForLessons(course: AdminCourseItem) {
    setIsCreatingCourse(false)
    setSelectedCourseId(course.id)
    resetLessonForm(course.id)
  }

  function resetCourseForm() {
    openCreateCourseForm()
  }

  function resetLessonForm(courseId: string) {
    setLessonForm(createEmptyLessonForm(courseId))
  }

  async function handleSaveCourse() {
    setSavingCourse(true)
    setError('')

    try {
      const savedCourse = await saveAdminCourse({
        courseId: courseForm.courseId || undefined,
        title: courseForm.title.trim(),
        subtitle: courseForm.subtitle.trim(),
        summary: courseForm.summary.trim(),
        category: courseForm.category.trim(),
        difficulty: courseForm.difficulty.trim(),
        coverImage: courseForm.coverImage.trim(),
        tags: parseTags(courseForm.tagsText),
        accessType: courseForm.accessType,
        priceAmount: Number(courseForm.priceAmount || 0),
        sortOrder: Number(courseForm.sortOrder || 0),
      })

      setIsCreatingCourse(false)
      setSelectedCourseId(savedCourse.id)
      setCourseForm(buildCourseForm(savedCourse))
      setLessonForm((previous) => createEmptyLessonForm(savedCourse.id || previous.courseId))
      setNotice(courseForm.courseId ? '课程已更新' : '课程已创建')
      triggerReload()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存课程失败')
    } finally {
      setSavingCourse(false)
    }
  }

  async function handleToggleCourseStatus(course: AdminCourseItem) {
    const nextStatus = getCourseNextStatus(course.status)
    if (!nextStatus) {
      return
    }

    setOperatingCourseId(course.id)
    setError('')

    try {
      await updateAdminCourseStatus({
        courseId: course.id,
        status: nextStatus,
      })
      setNotice(nextStatus === 'PUBLISHED' ? '课程已发布' : '课程已下架')
      triggerReload()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新课程状态失败')
    } finally {
      setOperatingCourseId('')
    }
  }

  async function handleSaveLesson() {
    if (!selectedCourse) {
      return
    }

    setSavingLesson(true)
    setError('')

    try {
      await saveAdminCourseLesson({
        courseId: selectedCourse.id,
        lessonId: lessonForm.lessonId || undefined,
        title: lessonForm.title.trim(),
        summary: lessonForm.summary.trim(),
        lessonType: lessonForm.lessonType,
        videoUrl: lessonForm.videoUrl.trim(),
        durationText: lessonForm.durationText.trim(),
        contentText: lessonForm.contentText.trim(),
        coverImage: lessonForm.coverImage.trim(),
        posterImage: lessonForm.posterImage.trim(),
        images: parseImages(lessonForm.imagesText),
        isTrial: lessonForm.isTrial,
        sortOrder: Number(lessonForm.sortOrder || 0),
      })
      setNotice(lessonForm.lessonId ? '课节已更新' : '课节已创建')
      resetLessonForm(selectedCourse.id)
      triggerReload()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存课节失败')
    } finally {
      setSavingLesson(false)
    }
  }

  async function handleToggleLessonStatus(lesson: AdminCourseLessonItem) {
    if (!selectedCourse) {
      return
    }

    const nextStatus = getLessonNextStatus(lesson.status)
    if (!nextStatus) {
      return
    }

    setOperatingLessonId(lesson.id)
    setError('')

    try {
      await updateAdminCourseLessonStatus({
        courseId: selectedCourse.id,
        lessonId: lesson.id,
        status: nextStatus,
      })
      setNotice(nextStatus === 'PUBLISHED' ? '课节已发布' : '课节已下架')
      triggerReload()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新课节状态失败')
    } finally {
      setOperatingLessonId('')
    }
  }

	  return (
	    <AdminLayout
	      title={isCourseMode ? '课程管理' : '课节管理'}
	      subtitle={isCourseMode ? '维护课程基础信息、访问类型、排序与发布状态。' : '先选择课程，再维护课程下面的视频课或图文课节。'}
	      tag={isCourseMode ? '课程基础资料' : '课节内容工作台'}
      breadcrumb="‹ 返回课程后台"
      menuGroups={coursePlatformMenuGroups}
      brandName="饮视课程"
      brandTag="课程后台"
      brandLogo="课"
      hideGroupPicker
      hideTopbarAction
      preserveGroupQuery={false}
    >
      <div className="course-admin-page">
        {error ? <div className="admin-inline-error">{error}</div> : null}
        {notice ? <div className="admin-inline-notice">{notice}</div> : null}

	        <section className="course-admin-summary-grid">
	              <article className="course-admin-summary-card">
	                <span>{isCourseMode ? '课程总数' : '可选课程'}</span>
	                <strong>{isCourseMode ? summary.total : lessonSummary.courseTotal}</strong>
	              </article>
	              <article className="course-admin-summary-card">
	                <span>{isCourseMode ? '已发布' : '课节总数'}</span>
	                <strong>{isCourseMode ? summary.published : lessonSummary.total}</strong>
	              </article>
	              <article className="course-admin-summary-card">
	                <span>{isCourseMode ? '草稿' : '已发布课节'}</span>
	                <strong>{isCourseMode ? summary.draft : lessonSummary.published}</strong>
	              </article>
	              <article className="course-admin-summary-card">
	                <span>{isCourseMode ? '已下架' : '草稿/下架课节'}</span>
	                <strong>{isCourseMode ? summary.hidden : lessonSummary.draft + lessonSummary.hidden}</strong>
	              </article>
	        </section>

	        <section className="admin-resource-panel">
	                <div className="resource-section-header">
	                  <div>
	                    <div className="resource-section-title">{isCourseMode ? '课程筛选' : '选择课程'}</div>
	                    <div className="resource-section-subtitle">
	                      {isCourseMode ? '按状态和关键词快速定位课程。' : '先筛选并选择课程，再维护它下面的课节。'}
	                    </div>
	                  </div>
	                {isCourseMode ? (
	                  <button className="admin-resource-submit" onClick={openCreateCourseForm} type="button">
	                    新建课程
	                  </button>
	                ) : null}
	              </div>

              <div className="activity-content-filter-grid">
                <label className="admin-resource-field">
                  <span>发布状态</span>
                  <select
                    onChange={(event) => {
                      setStatusFilter(event.target.value as AdminCourseStatus)
                    }}
                    value={statusFilter}
                  >
                    <option value="ALL">全部状态</option>
                    <option value="DRAFT">草稿</option>
                    <option value="PUBLISHED">已发布</option>
                    <option value="HIDDEN">已下架</option>
                    <option value="DELETED">已删除</option>
                  </select>
                </label>

                <label className="admin-resource-field">
                  <span>关键词</span>
                  <input
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setSearchKeyword(searchInput.trim())
                      }
                    }}
                    placeholder="搜索课程、分类或课节标题"
                    type="text"
                    value={searchInput}
                  />
                </label>

                <div className="course-admin-filter-actions">
                  <button className="admin-resource-secondary" onClick={() => setSearchKeyword(searchInput.trim())} type="button">
                    搜索
                  </button>
                  <button
                    className="admin-resource-secondary"
                    onClick={() => {
                      setStatusFilter('ALL')
                      setSearchInput('')
                      setSearchKeyword('')
                    }}
                    type="button"
                  >
                    重置
                  </button>
                </div>
              </div>
            </section>

	            <section className={isCourseMode ? 'course-admin-workbench' : 'course-admin-course-picker'}>
	              <article className="admin-resource-panel">
	                <div className="resource-section-header">
	                  <div>
	                    <div className="resource-section-title">课程列表</div>
	                    <div className="resource-section-subtitle">
	                      {loading
	                        ? '正在同步课程数据...'
	                        : isCourseMode
	                          ? `${courses.length} 门课程`
	                          : `${courses.length} 门课程，选择后管理课节`}
	                    </div>
	                  </div>
                </div>

                {loading ? <div className="admin-resource-empty">正在加载课程工作台...</div> : null}
                {!loading && !courses.length ? <div className="admin-resource-empty">当前没有课程，先创建一门课程。</div> : null}

                {!loading && courses.length ? (
                  <div className="course-admin-list">
                    {courses.map((course) => (
                      <article
                        className={`course-admin-list-card ${selectedCourseId === course.id ? 'is-active' : ''}`}
                        key={course.id}
                      >
	                        <button
	                          className="course-admin-list-main"
	                          onClick={() => {
	                            if (isCourseMode) {
	                              openCourseEditor(course)
	                            } else {
	                              selectCourseForLessons(course)
	                            }
	                          }}
	                          type="button"
                        >
                          <div className="course-admin-list-head">
                            <strong>{course.title}</strong>
                            <span className={getStatusChipClass(course.status)}>{course.statusLabel}</span>
                          </div>
                          <div className="course-admin-list-meta">
                            <span>{course.category || '未分类'}</span>
                            <span>{course.lessonCountLabel}</span>
                            <span>{course.priceLabel}</span>
                          </div>
                          <p>{course.summary || course.subtitle || '先补齐课程简介，方便前台展示。'}</p>
                        </button>

                        <div className="course-admin-list-actions">
	                          <button
	                            className="admin-resource-secondary"
	                            onClick={() => {
	                              if (isCourseMode) {
	                                openCourseEditor(course)
	                              } else {
	                                selectCourseForLessons(course)
	                              }
	                            }}
	                            type="button"
	                          >
	                            {isCourseMode ? '编辑' : '选择课程'}
	                          </button>
	                          {isCourseMode && getCourseActionLabel(course.status) ? (
	                            <button
	                              className="admin-resource-secondary"
                              disabled={operatingCourseId === course.id}
                              onClick={() => void handleToggleCourseStatus(course)}
                              type="button"
                            >
                              {operatingCourseId === course.id ? '处理中...' : getCourseActionLabel(course.status)}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </article>

	              {isCourseMode ? (
	                <article className="admin-resource-panel">
	                <div className="resource-section-header">
	                  <div>
	                    <div className="resource-section-title">{courseForm.courseId ? '编辑课程' : '新建课程'}</div>
                    <div className="resource-section-subtitle">先把课程基础信息、访问类型和排序维护完整。</div>
                  </div>
                </div>

                <div className="course-admin-form-grid">
                  <label className="admin-resource-field">
                    <span>课程标题</span>
                    <input
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, title: event.target.value }))}
                      placeholder="例如：门店起号基础课"
                      type="text"
                      value={courseForm.title}
                    />
                  </label>

                  <label className="admin-resource-field">
                    <span>课程副标题</span>
                    <input
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, subtitle: event.target.value }))}
                      placeholder="一句话说明课程目标"
                      type="text"
                      value={courseForm.subtitle}
                    />
                  </label>

                  <label className="admin-resource-field">
                    <span>课程分类</span>
                    <input
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, category: event.target.value }))}
                      placeholder="例如：起号入门"
                      type="text"
                      value={courseForm.category}
                    />
                  </label>

                  <label className="admin-resource-field">
                    <span>难度标签</span>
                    <input
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, difficulty: event.target.value }))}
                      placeholder="例如：基础 / 进阶 / 实战"
                      type="text"
                      value={courseForm.difficulty}
                    />
                  </label>

                  <label className="admin-resource-field">
                    <span>访问类型</span>
                    <select
                      onChange={(event) => {
                        const nextAccessType = event.target.value as AdminCourseAccessType
                        setCourseForm((previous) => ({
                          ...previous,
                          accessType: nextAccessType,
                          priceAmount: nextAccessType === 'PAID' ? previous.priceAmount : '0',
                        }))
                      }}
                      value={courseForm.accessType}
                    >
                      <option value="FREE">免费</option>
                      <option value="MEMBER">会员权限</option>
                      <option value="PAID">付费</option>
                    </select>
                  </label>

                  <label className="admin-resource-field">
                    <span>价格</span>
                    <input
                      disabled={courseForm.accessType !== 'PAID'}
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, priceAmount: event.target.value }))}
                      placeholder="0"
                      type="number"
                      value={courseForm.priceAmount}
                    />
                  </label>

                  <label className="admin-resource-field">
                    <span>排序</span>
                    <input
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, sortOrder: event.target.value }))}
                      placeholder="0"
                      type="number"
                      value={courseForm.sortOrder}
                    />
                  </label>

                  <label className="admin-resource-field">
                    <span>封面图地址</span>
                    <input
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, coverImage: event.target.value }))}
                      placeholder="https://..."
                      type="text"
                      value={courseForm.coverImage}
                    />
                  </label>

                  <label className="admin-resource-field admin-resource-field-span-2">
                    <span>课程标签</span>
                    <textarea
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, tagsText: event.target.value }))}
                      placeholder="用逗号或换行分隔标签"
                      rows={3}
                      value={courseForm.tagsText}
                    />
                  </label>

                  <label className="admin-resource-field admin-resource-field-span-2">
                    <span>课程简介</span>
                    <textarea
                      onChange={(event) => setCourseForm((previous) => ({ ...previous, summary: event.target.value }))}
                      placeholder="先把这门课帮助谁、解决什么问题写清楚。"
                      rows={5}
                      value={courseForm.summary}
                    />
                  </label>
                </div>

                <div className="course-admin-form-actions">
                  <button className="admin-resource-submit" disabled={savingCourse} onClick={() => void handleSaveCourse()} type="button">
                    {savingCourse ? '保存中...' : courseForm.courseId ? '更新课程' : '创建课程'}
                  </button>
                  <button className="admin-resource-secondary" onClick={resetCourseForm} type="button">
                    清空表单
	                  </button>
	                </div>
	                </article>
	              ) : null}
	            </section>

	            {isLessonMode ? (
	              <section className="course-admin-lessons">
              <article className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">课节列表</div>
                    <div className="resource-section-subtitle">
                      {selectedCourse ? `${selectedCourse.title} · ${selectedCourse.lessonCountLabel}` : '先选择或创建课程，再维护课节'}
                    </div>
                  </div>
                  {selectedCourse ? (
                    <button className="admin-resource-secondary" onClick={() => resetLessonForm(selectedCourse.id)} type="button">
                      新建课节
                    </button>
                  ) : null}
                </div>

                {!selectedCourse ? <div className="admin-resource-empty">还没有选中课程。</div> : null}
                {selectedCourse && !selectedCourse.lessons.length ? <div className="admin-resource-empty">当前课程还没有课节，先新增一节。</div> : null}

                {selectedCourse && selectedCourse.lessons.length ? (
                  <div className="course-admin-lesson-list">
                    {selectedCourse.lessons.map((lesson) => (
                      <article className="course-admin-lesson-card" key={lesson.id}>
                        <div className="course-admin-lesson-head">
                          <div>
                            <strong>{lesson.title}</strong>
                            <div className="course-admin-lesson-meta">
                              <span>{lesson.typeLabel}</span>
                              <span>{lesson.duration || '-'}</span>
                              <span>{lesson.isTrial ? '试听课节' : '完整课节'}</span>
                            </div>
                          </div>
                          <span className={getStatusChipClass(lesson.status)}>{lesson.statusLabel}</span>
                        </div>

                        <p>{lesson.summary || '这节课还没有简介。'}</p>

                        <div className="course-admin-lesson-actions">
                          <button
                            className="admin-resource-secondary"
                            onClick={() => setLessonForm(buildLessonForm(selectedCourse.id, lesson))}
                            type="button"
                          >
                            编辑
                          </button>
                          {getLessonActionLabel(lesson.status) ? (
                            <button
                              className="admin-resource-secondary"
                              disabled={operatingLessonId === lesson.id}
                              onClick={() => void handleToggleLessonStatus(lesson)}
                              type="button"
                            >
                              {operatingLessonId === lesson.id ? '处理中...' : getLessonActionLabel(lesson.status)}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="admin-resource-panel">
                <div className="resource-section-header">
                  <div>
                    <div className="resource-section-title">{lessonForm.lessonId ? '编辑课节' : '新建课节'}</div>
                    <div className="resource-section-subtitle">视频课和图文课共用同一入口维护。</div>
                  </div>
                </div>

                {!selectedCourse ? <div className="admin-resource-empty">先创建课程，再新增课节。</div> : null}

                {selectedCourse ? (
                  <>
                    <div className="course-admin-form-grid">
                      <label className="admin-resource-field">
                        <span>课节标题</span>
                        <input
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, title: event.target.value }))}
                          placeholder="例如：第 1 节：找到门店账号的唯一卖点"
                          type="text"
                          value={lessonForm.title}
                        />
                      </label>

                      <label className="admin-resource-field">
                        <span>课节类型</span>
                        <select
                          onChange={(event) => {
                            const nextLessonType = event.target.value as AdminCourseLessonType
                            setLessonForm((previous) => ({
                              ...previous,
                              lessonType: nextLessonType,
                              videoUrl: nextLessonType === 'VIDEO' ? previous.videoUrl : '',
                              contentText: nextLessonType === 'ARTICLE' ? previous.contentText : '',
                            }))
                          }}
                          value={lessonForm.lessonType}
                        >
                          <option value="ARTICLE">图文课</option>
                          <option value="VIDEO">视频课</option>
                        </select>
                      </label>

                      <label className="admin-resource-field">
                        <span>时长</span>
                        <input
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, durationText: event.target.value }))}
                          placeholder="例如：08:12"
                          type="text"
                          value={lessonForm.durationText}
                        />
                      </label>

                      <label className="admin-resource-field">
                        <span>排序</span>
                        <input
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, sortOrder: event.target.value }))}
                          placeholder="0"
                          type="number"
                          value={lessonForm.sortOrder}
                        />
                      </label>

                      <label className="admin-resource-field">
                        <span>封面图地址</span>
                        <input
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, coverImage: event.target.value }))}
                          placeholder="https://..."
                          type="text"
                          value={lessonForm.coverImage}
                        />
                      </label>

                      <label className="admin-resource-field">
                        <span>海报图地址</span>
                        <input
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, posterImage: event.target.value }))}
                          placeholder="视频课可单独设置 poster"
                          type="text"
                          value={lessonForm.posterImage}
                        />
                      </label>

                      <label className="admin-resource-field admin-resource-field-checkbox">
                        <span>试听课节</span>
                        <input
                          checked={lessonForm.isTrial}
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, isTrial: event.target.checked }))}
                          type="checkbox"
                        />
                      </label>

                      <label className="admin-resource-field admin-resource-field-span-2">
                        <span>课节简介</span>
                        <textarea
                          onChange={(event) => setLessonForm((previous) => ({ ...previous, summary: event.target.value }))}
                          placeholder="先讲清这节课的学习目标。"
                          rows={4}
                          value={lessonForm.summary}
                        />
                      </label>

                      {lessonForm.lessonType === 'VIDEO' ? (
                        <label className="admin-resource-field admin-resource-field-span-2">
                          <span>视频地址</span>
                          <input
                            onChange={(event) => setLessonForm((previous) => ({ ...previous, videoUrl: event.target.value }))}
                            placeholder="https://...mp4"
                            type="text"
                            value={lessonForm.videoUrl}
                          />
                        </label>
                      ) : null}

                      {lessonForm.lessonType === 'ARTICLE' ? (
                        <>
                          <label className="admin-resource-field admin-resource-field-span-2">
                            <span>图文正文</span>
                            <textarea
                              onChange={(event) => setLessonForm((previous) => ({ ...previous, contentText: event.target.value }))}
                              placeholder="每段之间空一行，小程序会按段落展示。"
                              rows={10}
                              value={lessonForm.contentText}
                            />
                          </label>

                          <label className="admin-resource-field admin-resource-field-span-2">
                            <span>正文配图</span>
                            <textarea
                              onChange={(event) => setLessonForm((previous) => ({ ...previous, imagesText: event.target.value }))}
                              placeholder="每行一个图片地址"
                              rows={4}
                              value={lessonForm.imagesText}
                            />
                          </label>
                        </>
                      ) : null}
                    </div>

                    <div className="course-admin-form-actions">
                      <button className="admin-resource-submit" disabled={savingLesson} onClick={() => void handleSaveLesson()} type="button">
                        {savingLesson ? '保存中...' : lessonForm.lessonId ? '更新课节' : '创建课节'}
                      </button>
                      <button className="admin-resource-secondary" onClick={() => resetLessonForm(selectedCourse.id)} type="button">
                        清空课节表单
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
	              </section>
	            ) : null}
      </div>
    </AdminLayout>
  )
}

export function CourseManagementPage() {
  return <CourseWorkbenchPage mode="COURSE" />
}

export function CourseLessonManagementPage() {
  return <CourseWorkbenchPage mode="LESSON" />
}
