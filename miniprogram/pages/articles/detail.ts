import { normalizeWxArticleHtml } from '../../utils/richtext'

interface ArticleDetail {
  id: string
  title: string
  author: string
  time: string
  price: string
  locked: boolean
  previewHtml: string
  fullHtml: string
}

const articleMap: Record<string, ArticleDetail> = {
  a1: {
    id: 'a1',
    title: '高净值资产防护的六层结构',
    author: '血饮',
    time: '今天',
    price: '¥49',
    locked: true,
    previewHtml: `
      <p>本文以攻防视角拆解资产安全的六层结构，帮助你快速定位防护薄弱环节。</p>
      <p>我们从资产边界、身份控制、交易监测、资产隔离、合规审计、危机响应六个方面展开。</p>
      <p>本节为预览内容，完整章节需解锁。</p>
    `,
    fullHtml: `
      <p>本文以攻防视角拆解资产安全的六层结构，帮助你快速定位防护薄弱环节。</p>
      <p><strong>第一层：资产边界</strong>，明确资产形态、链上链下入口、业务流转路径。</p>
      <p><strong>第二层：身份控制</strong>，从KYC到多因子认证、密钥管理建立可信身份。</p>
      <p><strong>第三层：交易监测</strong>，引入行为画像、异常阈值、实时风控策略。</p>
      <p><strong>第四层：资产隔离</strong>，建立冷热分离、多签审批与分级权限。</p>
      <p><strong>第五层：合规审计</strong>，持续评估链上风险、资金流转合规性。</p>
      <p><strong>第六层：危机响应</strong>，建立预案、应急演练与舆情协同机制。</p>
      <p>完整内容包含实践清单、监测指标与攻防对照表。</p>
    `,
  },
  a2: {
    id: 'a2',
    title: '链上洗钱路径的识别与阻断',
    author: '血饮',
    time: '昨天',
    price: '¥79',
    locked: true,
    previewHtml: `
      <p>本文从链上路径分析切入，介绍洗钱行为的常见结构与识别信号。</p>
      <p>预览包含路径特征与核心指标。</p>
    `,
    fullHtml: `
      <p>本文从链上路径分析切入，介绍洗钱行为的常见结构与识别信号。</p>
      <p><strong>路径特征</strong>：分层转移、跳转聚合、跨链掩护。</p>
      <p><strong>识别指标</strong>：异常高频、同源资金聚合、短周期拆分。</p>
      <p><strong>阻断策略</strong>：冻结策略、链上标记、跨平台协同。</p>
      <p>完整内容包含案例与工具链清单。</p>
    `,
  },
  a3: {
    id: 'a3',
    title: '多维风控指标体系设计',
    author: '血饮',
    time: '03/08',
    price: '¥39',
    locked: false,
    previewHtml: `
      <p>本文聚焦多维风控指标体系的设计方法。</p>
    `,
    fullHtml: `
      <p>本文聚焦多维风控指标体系的设计方法。</p>
      <p>内容包括风险维度拆解、评分模型、策略联动与指标看板。</p>
      <p>适用于交易安全、资金监测与平台风控。</p>
    `,
  },
  a4: {
    id: 'a4',
    title: 'AI风控模型的对抗评测',
    author: '血饮',
    time: '03/06',
    price: '¥59',
    locked: true,
    previewHtml: `
      <p>本文展示如何用红队思维评估AI风控模型的鲁棒性。</p>
    `,
    fullHtml: `
      <p>本文展示如何用红队思维评估AI风控模型的鲁棒性。</p>
      <p>覆盖对抗样本、模型漂移、异常检测与策略回滚。</p>
    `,
  },
}

Page({
  data: {
    article: {
      id: '',
      title: '',
      author: '',
      time: '',
      price: '',
      locked: false,
    } as ArticleDetail,
    displayNodes: '',
    listenMode: false,
    listenSpeed: 1.0,
    showPaywall: false,
  },
  onLoad(options: Record<string, string>) {
    // 加载文章详情与富文本
    const id = options.id || 'a1'
    const article = articleMap[id] || articleMap.a1
    const app = getApp<IAppOption>()
    const isMember = Boolean(app.globalData.isMember)
    const showPaywall = article.locked && !isMember
    const rawHtml = showPaywall ? article.previewHtml : article.fullHtml
    const displayNodes = normalizeWxArticleHtml(rawHtml)
    this.setData({
      article,
      showPaywall,
      displayNodes,
    })
  },
  onListenToggle(e: WechatMiniprogram.SwitchChange) {
    const listenMode = e.detail.value
    this.setData({ listenMode })
  },
  onSpeedChange(e: WechatMiniprogram.SliderChange) {
    const listenSpeed = e.detail.value
    this.setData({ listenSpeed })
  },
  onListenAction() {
    const nextMode = !this.data.listenMode
    this.setData({ listenMode: nextMode })
    wx.showToast({
      title: nextMode ? '开始听读' : '已暂停',
      icon: 'none',
    })
  },
  onListenSample() {
    wx.showToast({
      title: '正在加载试听',
      icon: 'none',
    })
  },
  onPayOnce() {
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
  goAI() {
    wx.navigateTo({
      url: '/pages/ai/index',
    })
  },
})
