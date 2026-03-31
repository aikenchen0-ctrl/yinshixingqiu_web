interface ProductItem {
  id: string
  title: string
  desc: string
  price: string
  tag: string
}

Page({
  data: {
    products: [
      {
        id: 'p1',
        title: '资金安全审计包',
        desc: '链上监测 + 漏洞排查清单',
        price: '¥299',
        tag: '工具包',
      },
      {
        id: 'p2',
        title: 'AI风控课程合集',
        desc: '6节录播 + 2次直播答疑',
        price: '¥599',
        tag: '课程',
      },
      {
        id: 'p3',
        title: '资产防护实战手册',
        desc: '策略模板 + 风险评分模型',
        price: '¥199',
        tag: '资料',
      },
      {
        id: 'p4',
        title: '黑灰产情报周报',
        desc: '每周更新的风险趋势与案例',
        price: '¥99',
        tag: '情报',
      },
    ] as ProductItem[],
  },
  onBuy() {
    wx.showToast({
      title: '待接入支付',
      icon: 'none',
    })
  },
  goMembership() {
    wx.navigateTo({
      url: '/pages/membership/index',
    })
  },
})
