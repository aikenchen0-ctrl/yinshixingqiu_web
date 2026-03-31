interface CalendarDay {
  id: string
  day: string
  isToday: boolean
  hasCourse: boolean
}

interface SessionItem {
  id: string
  date: string
  time: string
  title: string
  type: string
}

Page({
  data: {
    monthLabel: '2026年3月',
    lastSync: '03/10 10:30',
    weekDays: ['一', '二', '三', '四', '五', '六', '日'],
    calendarDays: [
      { id: 'd1', day: '1', isToday: false, hasCourse: false },
      { id: 'd2', day: '2', isToday: false, hasCourse: true },
      { id: 'd3', day: '3', isToday: false, hasCourse: false },
      { id: 'd4', day: '4', isToday: false, hasCourse: true },
      { id: 'd5', day: '5', isToday: false, hasCourse: false },
      { id: 'd6', day: '6', isToday: false, hasCourse: false },
      { id: 'd7', day: '7', isToday: false, hasCourse: false },
      { id: 'd8', day: '8', isToday: false, hasCourse: true },
      { id: 'd9', day: '9', isToday: false, hasCourse: false },
      { id: 'd10', day: '10', isToday: true, hasCourse: true },
      { id: 'd11', day: '11', isToday: false, hasCourse: false },
      { id: 'd12', day: '12', isToday: false, hasCourse: false },
      { id: 'd13', day: '13', isToday: false, hasCourse: true },
      { id: 'd14', day: '14', isToday: false, hasCourse: false },
      { id: 'd15', day: '15', isToday: false, hasCourse: false },
      { id: 'd16', day: '16', isToday: false, hasCourse: false },
      { id: 'd17', day: '17', isToday: false, hasCourse: false },
      { id: 'd18', day: '18', isToday: false, hasCourse: false },
      { id: 'd19', day: '19', isToday: false, hasCourse: true },
      { id: 'd20', day: '20', isToday: false, hasCourse: false },
      { id: 'd21', day: '21', isToday: false, hasCourse: false },
      { id: 'd22', day: '22', isToday: false, hasCourse: false },
      { id: 'd23', day: '23', isToday: false, hasCourse: false },
      { id: 'd24', day: '24', isToday: false, hasCourse: false },
      { id: 'd25', day: '25', isToday: false, hasCourse: false },
      { id: 'd26', day: '26', isToday: false, hasCourse: false },
      { id: 'd27', day: '27', isToday: false, hasCourse: true },
      { id: 'd28', day: '28', isToday: false, hasCourse: false },
      { id: 'd29', day: '29', isToday: false, hasCourse: false },
      { id: 'd30', day: '30', isToday: false, hasCourse: false },
      { id: 'd31', day: '31', isToday: false, hasCourse: false },
    ] as CalendarDay[],
    sessions: [
      { id: 's1', date: '03/10', time: '20:00', title: '黑产链路追踪实战', type: '直播课' },
      { id: 's2', date: '03/12', time: '21:00', title: '资产安全框架拆解', type: '闭门课' },
      { id: 's3', date: '03/15', time: '20:30', title: 'AI风控模型评测', type: '公开课' },
    ] as SessionItem[],
  },
  onReminder() {
    wx.showToast({
      title: '已开启提醒',
      icon: 'success',
    })
  },
})
