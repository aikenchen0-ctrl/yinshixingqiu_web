import type { CourseCategoryTab, CourseRecord } from '../../utils/course-types'
import { fetchCourseCatalog } from '../../utils/course-api'

const buildEmptyState = (keyword: string, categoryKey: string, categories: CourseCategoryTab[]) => {
  if (keyword) {
    return {
      emptyTitle: `没有找到“${keyword}”`,
      emptySubtitle: '换个关键词，或切换上面的分类继续筛选。',
    }
  }

  if (categoryKey !== 'all') {
    const activeCategory = categories.find((item) => item.key === categoryKey)
    return {
      emptyTitle: `${(activeCategory && activeCategory.label) || '当前分类'} 暂无课程`,
      emptySubtitle: '当前分类还在整理中，先看看其他课程。',
    }
  }

  return {
    emptyTitle: '课程正在整理中',
    emptySubtitle: '稍后再来，这里会展示可直接学习的课程内容。',
  }
}

const buildCategoryTabs = (courses: CourseRecord[]) => {
  const counts = courses.reduce<Record<string, number>>((result, course) => {
    const key = String(course.category || '').trim() || '全部课程'
    result[key] = (result[key] || 0) + 1
    return result
  }, {})

  const tabs: CourseCategoryTab[] = [
    {
      key: 'all',
      label: '全部课程',
      count: courses.length,
    },
  ]

  Object.keys(counts).forEach((key) => {
    tabs.push({
      key,
      label: key,
      count: counts[key],
    })
  })

  return tabs
}

Page({
  data: {
    keyword: '',
    activeCategory: 'all',
    categories: [] as CourseCategoryTab[],
    courses: [] as CourseRecord[],
    emptyTitle: '课程正在整理中',
    emptySubtitle: '稍后再来，这里会展示可直接学习的课程内容。',
    loading: false,
    errorText: '',
  },

  onLoad() {
    void this.applyFilters('', 'all')
  },

  onShow() {
    void this.applyFilters(this.data.keyword, this.data.activeCategory)
  },

  async applyFilters(keyword: string, categoryKey: string) {
    this.setData({
      loading: true,
      errorText: '',
    })

    try {
      const payload = await fetchCourseCatalog({
        keyword,
        category: categoryKey,
      })
      const categories = payload.categories.length ? payload.categories : buildCategoryTabs(payload.items)
      const courses = payload.items
      const emptyState = buildEmptyState(keyword, categoryKey, categories)

      this.setData({
        keyword,
        activeCategory: categoryKey,
        categories,
        courses,
        emptyTitle: emptyState.emptyTitle,
        emptySubtitle: emptyState.emptySubtitle,
        loading: false,
        errorText: '',
      })
      return
    } catch (error) {
      const categories = buildCategoryTabs([])
      const emptyState = buildEmptyState(keyword, categoryKey, categories)

      this.setData({
        keyword,
        activeCategory: categoryKey,
        categories,
        courses: [],
        emptyTitle: emptyState.emptyTitle,
        emptySubtitle: emptyState.emptySubtitle,
        loading: false,
        errorText: error instanceof Error ? error.message : '课程接口暂不可用，请检查本地后端。',
      })
    }
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const keyword = String(e.detail.value || '').slice(0, 30)
    void this.applyFilters(keyword, this.data.activeCategory)
  },

  onClearSearch() {
    if (!this.data.keyword) {
      return
    }

    void this.applyFilters('', this.data.activeCategory)
  },

  onCategoryChange(e: WechatMiniprogram.TouchEvent) {
    const categoryKey = String(e.currentTarget.dataset.category || 'all')
    if (!categoryKey || categoryKey === this.data.activeCategory) {
      return
    }

    void this.applyFilters(this.data.keyword, categoryKey)
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const courseId = String(e.currentTarget.dataset.id || '')
    if (!courseId) {
      return
    }

    wx.navigateTo({
      url: `/pages/course/detail?courseId=${courseId}`,
    })
  },

  goCalendar() {
    wx.navigateTo({
      url: '/pages/course/calendar',
    })
  },
})
