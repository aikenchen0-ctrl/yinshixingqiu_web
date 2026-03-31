interface CheckinItem {
  id: string
  title: string
  days: string
  status: string
  members: string
  showAvatars: boolean
}

Page({
  data: {
    items: [
      { id: 'c1', title: 'SDK测试训练营', days: '打卡天数: 7天', status: '打卡已结束', members: '暂无人报名', showAvatars: false },
      { id: 'c2', title: '里程碑档案', days: '打卡天数: 21天', status: '长期有效', members: '6 人已报名', showAvatars: true },
      { id: 'c3', title: '周复盘', days: '打卡天数: 21天', status: '长期有效', members: '1 人已报名', showAvatars: true },
      { id: 'c4', title: '知乎圆环任务挑战', days: '打卡天数: 21天', status: '打卡已关闭', members: '13 人已报名', showAvatars: true },
      { id: 'c5', title: '基本功 | 刻意练习·短文写作', days: '打卡天数: 14天', status: '长期有效', members: '9 人已报名', showAvatars: true },
    ] as CheckinItem[],
  },
})
