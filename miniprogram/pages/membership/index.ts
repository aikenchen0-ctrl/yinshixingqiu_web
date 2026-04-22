import { getStoredSession } from '../../utils/auth'
import { navigateAfterMallMembershipOpen } from '../../utils/mall-membership'

interface PlanItem {
  id: string
  title: string
  price: string
  desc: string
}

Page({
  data: {
    selectedPlan: 'annual',
    redirectUrl: '',
    source: '',
    productId: '',
    productTitle: '',
    fromMall: false,
    headerTitle: '血饮智库会员',
    headerSubtitle: '解锁全量文章、AI听读与情报周报',
    payButtonText: '立即开通',
    contextTitle: '',
    contextDesc: '',
    plans: [
      { id: 'monthly', title: '月度会员', price: '¥99', desc: '适合短期情报跟踪' },
      { id: 'annual', title: '年度会员', price: '¥899', desc: '全功能 + 专属答疑' },
      { id: 'lifetime', title: '终身会员', price: '¥2999', desc: '永久访问与优先服务' },
    ] as PlanItem[],
    benefits: [
      '全量付费文章与富文本报告',
      'AI智能体咨询与听读模式',
      '饮视星球深度案例库',
      '课程直播与回放权限',
      '专属风险情报周报',
    ],
  },
  onLoad(options: Record<string, string>) {
    const redirectUrl = String(options.redirect || '').trim()
    const source = String(options.source || '').trim()
    const productId = String(options.productId || '').trim()
    const productTitle = String(options.productTitle || '').trim()
    const fromMall = source.indexOf('store_') === 0 || source.indexOf('mall') === 0 || Boolean(redirectUrl)

    this.setData({
      redirectUrl,
      source,
      productId,
      productTitle,
      fromMall,
      headerTitle: fromMall ? '先开会员，再回商城拿权益价' : '血饮智库会员',
      headerSubtitle: fromMall ? '会员价商品、会员专享商品和商城权益会在这里统一承接。' : '解锁全量文章、AI听读与情报周报',
      payButtonText: fromMall ? '立即开通并返回' : '立即开通',
      contextTitle: productTitle ? `当前目标商品：${productTitle}` : '当前来自商城会员承接入口',
      contextDesc: productTitle
        ? '开通后回到商品页，可继续查看会员价或会员专享购买资格。'
        : '开通后可回到商城继续浏览会员价商品和会员专享商品。',
    })
  },
  onSelectPlan(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selectedPlan: id,
    })
  },
  onContinueStore() {
    navigateAfterMallMembershipOpen(String(this.data.redirectUrl || '/pages/store/index'))
  },
  onPay() {
    const session = getStoredSession()
    if (!session) {
      wx.navigateTo({
        url: '/pages/auth/login',
      })
      return
    }

    // 支付需接入后端，这里仅模拟会员开通
    const app = getApp<IAppOption>()
    app.globalData.isMember = true
    wx.showToast({
      title: '已模拟开通',
      icon: 'success',
    })

    if (this.data.fromMall) {
      setTimeout(() => {
        navigateAfterMallMembershipOpen(String(this.data.redirectUrl || '/pages/store/index'))
      }, 700)
    }
  },
})
