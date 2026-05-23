import type { CourseRecord } from '../../utils/course-types'
import { fetchCourseCatalog } from '../../utils/course-api'
const { shiftMonthKey, resolveMonthSelection, buildPickerValue } = require('./calendar-state.js') as typeof import('./calendar-state')

interface CalendarCell {
  id: string
  dateKey: string
  dayLabel: string
  isEmpty: boolean
  isToday: boolean
  isSelected: boolean
  hasCourses: boolean
}

interface CalendarCourse extends CourseRecord {
  calendarDate: string
  calendarDateLabel: string
}

const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const toTwoDigits = (value: number) => (value < 10 ? `0${value}` : String(value))
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${toTwoDigits(date.getMonth() + 1)}-${toTwoDigits(date.getDate())}`
const todayKey = formatDateKey(new Date())

const parseDateKey = (dateKey: string) => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim())
  if (!matched) {
    return null
  }

  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  }
}

const parseMonthKey = (monthKey: string) => {
  const matched = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim())
  if (!matched) {
    return null
  }

  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
  }
}

const normalizeCourseDate = (value: string) => {
  const matched = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return matched ? matched[1] : ''
}

const buildMonthLabel = (monthKey: string) => {
  const parsed = parseMonthKey(monthKey)
  return parsed ? `${parsed.year} 年 ${parsed.month} 月` : ''
}

const buildDateLabel = (dateKey: string) => {
  const parsed = parseDateKey(dateKey)
  return parsed ? `${parsed.month} 月 ${parsed.day} 日` : ''
}

const buildWeekdayLabel = (dateKey: string) => {
  const parsed = parseDateKey(dateKey)
  if (!parsed) {
    return ''
  }

  const weekdayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdayMap[new Date(parsed.year, parsed.month - 1, parsed.day).getDay()] || ''
}

const buildCourseDateMap = (courses: CalendarCourse[]) =>
  courses.reduce<Record<string, CalendarCourse[]>>((result, course) => {
    if (!result[course.calendarDate]) {
      result[course.calendarDate] = []
    }

    result[course.calendarDate].push(course)
    return result
  }, {})

const buildMonthKeys = (dates: string[]) =>
  dates
    .map((dateKey) => dateKey.slice(0, 7))
    .filter((monthKey, index, array) => array.indexOf(monthKey) === index)

const resolveInitialDate = (dates: string[]) => {
  if (!dates.length) {
    return todayKey
  }

  return dates.find((dateKey) => dateKey >= todayKey) || dates[0]
}

const buildCalendarDays = (monthKey: string, selectedDateKey: string, dateMap: Record<string, CalendarCourse[]>) => {
  const parsed = parseMonthKey(monthKey)
  if (!parsed) {
    return [] as CalendarCell[]
  }

  const firstDay = new Date(parsed.year, parsed.month - 1, 1)
  const totalDays = new Date(parsed.year, parsed.month, 0).getDate()
  const leadingEmptyCount = (firstDay.getDay() + 6) % 7
  const items: CalendarCell[] = []

  for (let index = 0; index < leadingEmptyCount; index += 1) {
    items.push({
      id: `empty-${index}`,
      dateKey: '',
      dayLabel: '',
      isEmpty: true,
      isToday: false,
      isSelected: false,
      hasCourses: false,
    })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = `${monthKey}-${toTwoDigits(day)}`
    items.push({
      id: dateKey,
      dateKey,
      dayLabel: String(day),
      isEmpty: false,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
      hasCourses: Boolean(dateMap[dateKey] && dateMap[dateKey].length),
    })
  }

  const remainder = items.length % 7
  if (remainder) {
    const trailingCount = 7 - remainder
    for (let index = 0; index < trailingCount; index += 1) {
      items.push({
        id: `tail-${index}`,
        dateKey: '',
        dayLabel: '',
        isEmpty: true,
        isToday: false,
        isSelected: false,
        hasCourses: false,
      })
    }
  }

  return items
}

Page({
  data: {
    weekDays,
    loading: false,
    errorText: '',
    courses: [] as CalendarCourse[],
    courseDateMap: {} as Record<string, CalendarCourse[]>,
    monthKeys: [] as string[],
    currentMonthKey: todayKey.slice(0, 7),
    monthLabel: buildMonthLabel(todayKey.slice(0, 7)),
    pickerValue: buildPickerValue(todayKey.slice(0, 7)),
    selectedDateKey: todayKey,
    selectedDateLabel: buildDateLabel(todayKey),
    selectedWeekdayLabel: buildWeekdayLabel(todayKey),
    selectedCourseCountLabel: '0 门课程',
    calendarDays: [] as CalendarCell[],
    selectedCourses: [] as CalendarCourse[],
    currentMonthHasCourses: false,
  },

  onLoad() {
    void this.loadCalendar()
  },

  async loadAllCourses() {
    const firstPage = await fetchCourseCatalog({
      page: 1,
      pageSize: 50,
    })
    const totalPages = Math.max(1, Number(firstPage.totalPages || 1))
    const items = firstPage.items.slice()

    for (let page = 2; page <= totalPages; page += 1) {
      const nextPage = await fetchCourseCatalog({
        page,
        pageSize: 50,
      })
      items.push(...nextPage.items)
    }

    return items
  },

  async loadCalendar() {
    this.setData({
      loading: true,
      errorText: '',
    })

    try {
      const rawCourses = await this.loadAllCourses()
      const courses = rawCourses
        .map((course) => {
          const calendarDate = normalizeCourseDate(course.updatedAt)
          return calendarDate
            ? {
                ...course,
                calendarDate,
                calendarDateLabel: buildDateLabel(calendarDate),
              }
            : null
        })
        .filter((course): course is CalendarCourse => Boolean(course))
      const dateMap = buildCourseDateMap(courses)
      const dates = Object.keys(dateMap).sort()
      const monthKeys = buildMonthKeys(dates)
      const resolvedInitialDate = resolveInitialDate(dates)
      const currentMonthKey = resolvedInitialDate.slice(0, 7)
      const monthSelection = resolveMonthSelection(currentMonthKey, dateMap)
      const selectedDateKey =
        dates.length && resolvedInitialDate.slice(0, 7) === currentMonthKey
          ? resolvedInitialDate
          : monthSelection.selectedDateKey

      this.applyCalendarState({
        courses,
        courseDateMap: dateMap,
        monthKeys,
        monthKey: currentMonthKey,
        selectedDateKey,
        loading: false,
        errorText: '',
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorText: error instanceof Error ? error.message : '课程日历读取失败，请检查本地后端。',
        courses: [],
        courseDateMap: {},
        monthKeys: [],
        calendarDays: [],
        selectedCourses: [],
        pickerValue: buildPickerValue(todayKey.slice(0, 7)),
        selectedCourseCountLabel: '0 门课程',
        currentMonthHasCourses: false,
      })
    }
  },

  applyCalendarState(payload: {
    courses: CalendarCourse[]
    courseDateMap: Record<string, CalendarCourse[]>
    monthKeys: string[]
    monthKey: string
    selectedDateKey: string
    loading?: boolean
    errorText?: string
  }) {
    const selectedCourses = payload.courseDateMap[payload.selectedDateKey] || []
    const currentMonthHasCourses = payload.monthKeys.includes(payload.monthKey)

    this.setData({
      loading: payload.loading === true,
      errorText: payload.errorText || '',
      courses: payload.courses,
      courseDateMap: payload.courseDateMap,
      monthKeys: payload.monthKeys,
      currentMonthKey: payload.monthKey,
      monthLabel: buildMonthLabel(payload.monthKey),
      pickerValue: buildPickerValue(payload.monthKey),
      selectedDateKey: payload.selectedDateKey,
      selectedDateLabel: buildDateLabel(payload.selectedDateKey),
      selectedWeekdayLabel: buildWeekdayLabel(payload.selectedDateKey),
      selectedCourseCountLabel: `${selectedCourses.length} 门课程`,
      calendarDays: buildCalendarDays(payload.monthKey, payload.selectedDateKey, payload.courseDateMap),
      selectedCourses,
      currentMonthHasCourses,
    })
  },

  onPrevMonth() {
    const previousMonthKey = shiftMonthKey(this.data.currentMonthKey, -1)
    const monthSelection = resolveMonthSelection(previousMonthKey, this.data.courseDateMap)
    this.applyCalendarState({
      courses: this.data.courses,
      courseDateMap: this.data.courseDateMap,
      monthKeys: this.data.monthKeys,
      monthKey: monthSelection.monthKey,
      selectedDateKey: monthSelection.selectedDateKey,
    })
  },

  onNextMonth() {
    const nextMonthKey = shiftMonthKey(this.data.currentMonthKey, 1)
    const monthSelection = resolveMonthSelection(nextMonthKey, this.data.courseDateMap)
    this.applyCalendarState({
      courses: this.data.courses,
      courseDateMap: this.data.courseDateMap,
      monthKeys: this.data.monthKeys,
      monthKey: monthSelection.monthKey,
      selectedDateKey: monthSelection.selectedDateKey,
    })
  },

  onPickerChange(e: WechatMiniprogram.BaseEvent & { detail: { value: string } }) {
    const nextMonthKey = String(e.detail.value || '').slice(0, 7)
    if (!parseMonthKey(nextMonthKey)) {
      return
    }

    const monthSelection = resolveMonthSelection(nextMonthKey, this.data.courseDateMap)
    this.applyCalendarState({
      courses: this.data.courses,
      courseDateMap: this.data.courseDateMap,
      monthKeys: this.data.monthKeys,
      monthKey: monthSelection.monthKey,
      selectedDateKey: monthSelection.selectedDateKey,
    })
  },

  onDayTap(e: WechatMiniprogram.TouchEvent) {
    const dateKey = String(e.currentTarget.dataset.date || '')
    if (!dateKey) {
      return
    }

    this.applyCalendarState({
      courses: this.data.courses,
      courseDateMap: this.data.courseDateMap,
      monthKeys: this.data.monthKeys,
      monthKey: this.data.currentMonthKey,
      selectedDateKey: dateKey,
    })
  },

  goCourse(e: WechatMiniprogram.TouchEvent) {
    const courseId = String(e.currentTarget.dataset.courseId || '')
    if (!courseId) {
      return
    }

    wx.navigateTo({
      url: `/pages/course/detail?courseId=${courseId}`,
    })
  },
})
