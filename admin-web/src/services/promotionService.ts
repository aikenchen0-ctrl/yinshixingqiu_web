export interface PromotionSummaryItem {
  label: string
  value: string
  hint: string
}

export interface PromotionFunnelItem {
  count: string
  title: string
  action: string
  tone: 'teal' | 'blue' | 'orange'
}

export interface PromotionAdviceItem {
  title: string
  suffix: string
  rows: [string, string][]
}

export interface PromotionPagePayload {
  title: string
  subtitle: string
  tag: string
  breadcrumb: string
  summaryRows: PromotionSummaryItem[][]
  memberRows: PromotionSummaryItem[]
  promotionFlow: PromotionFunnelItem[]
  renewalFlow: PromotionFunnelItem[]
  adviceSections: PromotionAdviceItem[]
}

const fallbackData: PromotionPagePayload = {
  title: 'ysc的星球',
  subtitle: '',
  tag: '数据概览',
  breadcrumb: '‹ 返回星球列表',
  summaryRows: [
    [
      { label: '累积收入(元)', value: '0.00', hint: '昨日收入 0.00' },
      { label: '本周收入(元)', value: '0.00', hint: '上周收入 0.00' },
      { label: '本月收入(元)', value: '0.00', hint: '上月收入 0.00' },
    ],
    [
      { label: '付费加入收入(元)', value: '0.00', hint: '昨日收入 0.00' },
      { label: '续期收入(元)', value: '0.00', hint: '昨日收入 0.00' },
      { label: '赞赏收入(元)', value: '0.00', hint: '昨日收入 0.00' },
      { label: '付费提问收入(元)', value: '0.00', hint: '昨日收入 0.00' },
    ],
  ],
  memberRows: [
    { label: '总成员数', value: '0', hint: '昨日加入成员 0' },
    { label: '付费加入成员', value: '0', hint: '昨日加入成员 0' },
    { label: '本月续期成员', value: '0', hint: '上月续期成员 0' },
    { label: '昨日续期成员', value: '0', hint: '' },
  ],
  promotionFlow: [
    { count: '0', title: '访问星球预览页的人数（星球外用户）', action: '访问星球预览页', tone: 'teal' },
    { count: '0', title: '点击「加入星球」按钮人数', action: '点击加入按钮', tone: 'blue' },
    { count: '0', title: '成功加入星球的人数', action: '成功支付', tone: 'orange' },
  ],
  renewalFlow: [
    { count: '0', title: '进入续期页面的人数', action: '进入续期页面', tone: 'teal' },
    { count: '0', title: '支付成功的人数', action: '成功支付', tone: 'orange' },
  ],
  adviceSections: [
    {
      title: '流量转化率: 0.00%',
      suffix: '（正常范围：35%~60%），你的转化率较低，可进一步提升，优化建议：',
      rows: [
        ['渠道追踪', '打开付费页流量越精准，转化率越高，利用「渠道二维码」分析不同渠道带来的新增用户数量与质量，提高流量转化率。'],
        ['付费页优化', '优化「星球简介和星主简介」「图文结合」，全方位介绍星球价值与用户权益，转化率可提升 2 倍~3 倍。'],
        ['内容创作', '持续更新有助于增强星球吸引力，提高收入。去 App 的星球首页创建「创作闹钟」，督促自己不断进步。'],
        ['官方学习指南', '加入「星球学院」，和 10 万名星主共同学习提高流量转化率的方法。'],
      ],
    },
    {
      title: '支付成功率: 0.00%',
      suffix: '（正常范围：10%~30%），优化建议：',
      rows: [
        ['优惠价格', '价格高低直接决定了用户的支付意愿。创建优惠券，可有效提高支付转化率。'],
        ['价格展示优化', '在星球付费页的文案中提醒用户每天只需支付 XX 元/天，每天不到一杯奶茶钱，可有效降低用户支付的心理成本，提高转化率。'],
        ['官方学习指南', '学习「星球定价策略」，优化定价策略，提升支付成功率。'],
      ],
    },
    {
      title: '新成员月留存率: 0.00%',
      suffix: '（同规模星球：70%，戳此查看更多数据），优化建议：',
      rows: [
        ['精选内容', '新用户在付费后越快体验到星球的价值，成为忠实用户的可能性就越高。建议利用置顶帖/专栏汇总精华内容，让用户付费后尽快阅读。'],
        ['自动通知', '自定义「新用户加入星球的自动通知」，可有效引导用户完成加入星球后的首次激活动作。'],
        ['成员登记信息', '开启「成员登记信息」功能，可引导用户在活跃期留下联系方式，方便后续更深度的用户运营。'],
      ],
    },
  ],
}

export async function getPromotionPageData(): Promise<PromotionPagePayload> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000'}/api/admin/promotion/data`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return (await response.json()) as PromotionPagePayload
  } catch {
    return fallbackData
  }
}
