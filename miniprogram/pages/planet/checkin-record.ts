import { getStoredSession } from '../../utils/auth'
import { getLocalCheckinRecord } from '../../utils/checkin'
import { fetchCheckinRecord } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

// 获取当前年月
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const currentDay = now.getDate()
const currentPickerValue = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

Page({
  data: {
    challengeId: '',
    groupId: '',
    challengeTitle: '打卡记录',
    year: currentYear,
    month: currentMonth,
    selectedDay: currentDay,
    weekdayLabels: ['一', '二', '三', '四', '五', '六', '日'],
    calendarDays: [] as Record<string, any>[],
    progressPercent: 0,
    streakDays: 0,
    totalDays: 0,
    todayChecked: false,
    selectedDayChecked: false,
    myPosts: [] as Record<string, any>[],
    allPosts: [] as Record<string, any>[],
    showAllPosts: false,
    loading: false,
    pickerValue: currentPickerValue,
  },

  onLoad(options: Record<string, string>) {
    const year = Number(options.year || currentYear)
    const month = Number(options.month || currentMonth)
    const day = Number(options.day || currentDay)
    const challengeId = options.id || ''
    if (!challengeId) {
      navigateToPlanetIndex('挑战参数缺失')
      return
    }

    this.setData({
      challengeId,
      groupId: resolvePlanetIdFromOptions(options, ['groupId', 'planetId']),
      year: Number.isFinite(year) && year > 0 ? year : currentYear,
      month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : currentMonth,
      selectedDay: Number.isFinite(day) && day >= 1 && day <= 31 ? day : currentDay,
      pickerValue: `${Number.isFinite(year) && year > 0 ? year : currentYear}-${String(
        Number.isFinite(month) && month >= 1 && month <= 12 ? month : currentMonth
      ).padStart(2, '0')}`,
    }, () => {
      void this.refreshData()
    })
  },

  async refreshData() {
    const session = getStoredSession()
    if (!this.data.challengeId) {
      wx.showToast({
        title: '缺少挑战ID',
        icon: 'none',
      })
      return
    }

    this.setData({
      loading: true,
    })

    try {
      const response = await fetchCheckinRecord({
        challengeId: this.data.challengeId,
        year: this.data.year,
        month: this.data.month,
        day: this.data.selectedDay,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response || !response.ok || !response.data) {
        throw new Error('读取打卡记录失败')
      }

      const data = response.data
      this.setData({
        challengeTitle: data.challengeTitle || '打卡记录',
        year: data.year || this.data.year,
        month: data.month || this.data.month,
        selectedDay: data.selectedDay || this.data.selectedDay,
        weekdayLabels: Array.isArray(data.weekdayLabels) ? data.weekdayLabels : [],
        calendarDays: Array.isArray(data.calendarDays) ? data.calendarDays : [],
        progressPercent: typeof data.progressPercent === 'number' ? data.progressPercent : 0,
        streakDays: typeof data.streakDays === 'number' ? data.streakDays : 0,
        totalDays: typeof data.totalDays === 'number' ? data.totalDays : 0,
        todayChecked: Boolean(data.todayChecked),
        selectedDayChecked: Boolean(data.selectedDayChecked),
        myPosts: Array.isArray(data.myPosts) ? data.myPosts : [],
        allPosts: Array.isArray(data.allPosts) ? data.allPosts : [],
        loading: false,
      })
    } catch {
      const localRecord = getLocalCheckinRecord(this.data.challengeId, {
        year: this.data.year,
        month: this.data.month,
        day: this.data.selectedDay,
        viewerId: session && session.id ? session.id : '',
      })

      if (localRecord) {
        this.setData({
          challengeTitle: localRecord.challengeTitle,
          year: localRecord.year,
          month: localRecord.month,
          selectedDay: localRecord.selectedDay,
          weekdayLabels: localRecord.weekdayLabels,
          calendarDays: localRecord.calendarDays,
          progressPercent: localRecord.progressPercent,
          streakDays: localRecord.streakDays,
          totalDays: localRecord.totalDays,
          todayChecked: localRecord.todayChecked,
          selectedDayChecked: localRecord.selectedDayChecked,
          myPosts: localRecord.myPosts,
          allPosts: localRecord.allPosts,
          loading: false,
        })
        return
      }

      this.setData({
        loading: false,
      })
    }
  },

  onPickerChange(e: WechatMiniprogram.BaseEvent & { detail: { value: string } }) {
    const val = e.detail.value as string // YYYY-MM
    const [y, m] = val.split('-').map(Number)
    this.setMonth(y, m)
  },

  setMonth(year: number, month: number) {
    const pickerValue = `${year}-${String(month).padStart(2, '0')}`
    this.setData({
      year,
      month,
      pickerValue,
    }, () => {
      void this.refreshData()
    })
  },

  onSelectDay(e: WechatMiniprogram.TouchEvent) {
    const day = Number(e.currentTarget.dataset.day || 0)
    if (!day) {
      return
    }

    this.setData({
      selectedDay: day,
    }, () => {
      void this.refreshData()
    })
  },

  onToggleAllPosts() {
    this.setData({
      showAllPosts: !this.data.showAllPosts,
    })
  },
})
