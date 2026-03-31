interface PlanItem {
  id: string
  title: string
  price: string
  desc: string
}

Page({
  data: {
    selectedPlan: 'annual',
    plans: [
      { id: 'monthly', title: '月度会员', price: '¥99', desc: '适合短期情报跟踪' },
      { id: 'annual', title: '年度会员', price: '¥899', desc: '全功能 + 专属答疑' },
      { id: 'lifetime', title: '终身会员', price: '¥2999', desc: '永久访问与优先服务' },
    ] as PlanItem[],
    benefits: [
      '全量付费文章与富文本报告',
      'AI智能体咨询与听读模式',
      '知识星球深度案例库',
      '课程直播与回放权限',
      '专属风险情报周报',
    ],
  },
  onSelectPlan(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selectedPlan: id,
    })
  },
  onPay() {
    // 支付需接入后端，这里仅模拟会员开通
    const app = getApp<IAppOption>()
    app.globalData.isMember = true
    wx.showToast({
      title: '已模拟开通',
      icon: 'success',
    })
  },
})
