import { apiRequest } from './apiClient'

export interface PromotionOverviewItem {
  label: string
  value: string
  hint: string
}

export interface PromotionTrendItem {
  date: string
  label: string
  value: number
}

export interface PromotionTrendMetricOption {
  key: string
  label: string
  format: 'number' | 'money' | 'percent'
  hint: string
}

export interface PromotionTrendSeriesItem {
  date: string
  label: string
  values: Record<string, number>
}

export interface PromotionDetailField {
  label: string
  value: string
}

export interface PromotionReportDetailItem {
  id: string
  title: string
  subtitle: string
  orderNo: string
  paidAt: string
  amount: string
  income: string
  status: string
  statusLabel: string
  detailFields: PromotionDetailField[]
  insight: string
  actionLabel?: string
  actionPath?: string
  actionQuery?: Record<string, string>
}

export interface PromotionActionWorkbenchItem {
  action: string
  target: string
  sent: string
  result: string
  detail: string
  actionLabel?: string
  actionPath?: string
}

export interface IncomeReportItem {
  id: string
  orderNo: string
  paidAt: string
  type: string
  typeLabel: string
  nickname: string
  amount: string
  income: string
  status: string
  statusLabel: string
}

export interface PromotionChannelItem {
  id: string
  channel: string
  visits: number
  clicks: number
  paid: number
  rate: string
  income: string
  isEnabled: boolean
}

export interface PromotionChannelDetailItem {
  id: string
  name: string
  code: string
  qrCodeUrl: string
  createdAt: string
  scene: string
  status: string
  statusLabel: string
  visits: number
  clicks: number
  paidCount: number
  conversionRate: string
  income: string
  latestOrderNickname: string
  latestOrderNo: string
  latestOrderPaidAt: string
  creatorName?: string
}

export interface PromotionChannelCreateInput {
  groupId: string
  name: string
}

export interface RenewalCouponItem {
  id: string
  type: string
  typeLabel: string
  name: string
  code: string
  amount: string
  totalQuantity: number
  usedQuantity: number
  visitCount: number
  status: string
  statusLabel: string
  validFrom: string
  validTo: string
}

export interface CouponFormInput {
  groupId: string
  id?: string
  type: 'PROMOTION' | 'RENEWAL'
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED'
  name: string
  code: string
  amount: string
  totalQuantity: number
  validFrom: string
  validTo: string
}

export interface RenewalNoticeItem {
  id: string
  title: string
  content: string
  buttonText: string
  buttonUrl: string
  routeKey: string
  status: string
  statusLabel: string
  scheduledAt: string
  sentAt: string
  pushedCount: number
}

export interface RenewalNoticeCreateInput {
  groupId: string
  title: string
  content: string
  buttonText: string
  buttonUrl: string
  routeKey: string
}

export interface RenewalDiscountItem {
  enabled: boolean
  limitWindow: boolean
  amount: string
  originalAmount: string
  discountedPercentage: number
  expiringEnabled: boolean
  advanceAmount: string
  advanceDiscountPercentage: number
  advanceEnabled: boolean
  graceAmount: string
  graceDiscountPercentage: number
  graceEnabled: boolean
  audience: string
  stackWithCoupon: boolean
  minRenewCount: number
  mode: string
  duration: string
  beginTime: string
  startDate: string
  endTime: string
  endDate: string
  guidance: string
  renewalUrl: string
}

export interface RenewalDiscountUpdateInput {
  groupId: string
  enabled: boolean
  limitWindow: boolean
  startDate: string
  endDate: string
  audience: string
  stackWithCoupon: boolean
  minRenewCount: number
  basePrice: string
  guidance: string
  stages: Array<{
    key: 'advance' | 'expiring' | 'grace'
    discount: string
    enabled: boolean
  }>
}

export interface RenewalGuidanceUpdateInput {
  groupId: string
  guidance: string
}

export interface PromotionReportItem {
  id: string
  orderNo: string
  paidAt: string
  channel: string
  nickname: string
  amount: string
  income: string
  status: string
  statusLabel: string
}

export interface AnalyticsPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AnalyticsGroup {
  id: string
  name: string
  ownerName: string
}

export interface AnalyticsFilters {
  startDate: string
  endDate: string
  rangeDays: number
}

export interface RenewalExpireBucketItem {
  month: string
  label: string
  count: number
}

export interface RenewalDashboardSummary {
  renewalIncomeAmount: number
  renewedCount: number
  renewableCount: number
  renewalPageVisitCount: number
  renewalPaySuccessCount: number
  renewalConversionRate: string
  renewalPrice: string
  renewalOriginalPrice: string
  renewalDiscountedPercentage: number
  renewalGuidance: string
  yesterdayRenewalIncome: number
  monthRenewalIncome: number
  lastMonthRenewalIncome: number
  yesterdayRenewedCount: number
  monthRenewedCount: number
  lastMonthRenewedCount: number
  totalRenewedMembers: number
  firstRenewedYesterdayCount: number
}

export interface RenewalDashboardBreakdown {
  expiredOver7DaysCount: number
  expiredWithin7DaysCount: number
  advanceRenewableCount: number
}

export interface RenewalDashboardTrendItem {
  date: string
  label: string
  renewalIncomeAmount: number
  renewedCount: number
  renewableCount: number
  renewalPageVisitCount: number
  renewalPaySuccessCount: number
  renewalConversionRate: number
}

export interface RenewalDashboardActionItem {
  action: string
  target: string
  sent: string
  result: string
}

export interface RenewalDashboardReportItem {
  id: string
  orderNo: string
  paidAt: string
  nickname: string
  amount: string
  income: string
  status: string
  statusLabel: string
}

export interface RenewalDashboardData {
  mode: 'renewal'
  group: AnalyticsGroup
  filters: AnalyticsFilters
  summary: RenewalDashboardSummary
  breakdown: RenewalDashboardBreakdown
  expireTrend: RenewalExpireBucketItem[]
  trend: RenewalDashboardTrendItem[]
  actions: RenewalDashboardActionItem[]
  pagination: AnalyticsPagination
  items: RenewalDashboardReportItem[]
}

interface AdminIncomeResponse {
  ok: true
  data: {
    mode: 'income'
    group: AnalyticsGroup
    filters: AnalyticsFilters
    summary: {
      totalIncome: number
      weekIncome: number
      lastWeekIncome: number
      monthIncome: number
      lastMonthIncome: number
      yesterdayIncome: number
      joinIncome: number
      yesterdayJoinIncome: number
      renewalIncome: number
      yesterdayRenewalIncome: number
      rewardIncome: number
      yesterdayRewardIncome: number
      questionIncome: number
      yesterdayQuestionIncome: number
      totalMembers: number
      yesterdayJoinedCount: number
      paidMembers: number
      yesterdayPaidJoinedCount: number
      monthRenewedCount: number
      lastMonthRenewedCount: number
      yesterdayRenewedCount: number
    }
    trend: Array<{
      date: string
      label: string
      totalNetAmount: number
      joinNetAmount: number
      renewalNetAmount: number
      rewardNetAmount: number
      questionNetAmount: number
    }>
    pagination: AnalyticsPagination
    items: IncomeReportItem[]
  }
}

interface AdminPromotionResponse {
  ok: true
  data: {
    mode: 'promotion'
    group: AnalyticsGroup
    filters: AnalyticsFilters
    summary: {
      previewVisitCount: number
      clickJoinCount: number
      paySuccessCount: number
      paidJoinCount: number
      joinIncomeAmount: number
      joinIncome: number
      yesterdayJoinIncome: number
      weekJoinIncome: number
      lastWeekJoinIncome: number
      monthJoinIncome: number
      lastMonthJoinIncome: number
      paidMembers: number
      yesterdayPaidJoinedCount: number
      monthPaidJoinedCount: number
      lastMonthPaidJoinedCount: number
      memberInvitedCount: number
      yesterdayMemberInvitedCount: number
      monthRenewedCount: number
      lastMonthRenewedCount: number
      conversionRate: string
      paySuccessRate: string
    }
    funnel: {
      previewVisitCount: number
      clickJoinCount: number
      paySuccessCount: number
      conversionRate: string
    }
    trend: Array<{
      date: string
      label: string
      previewVisitCount: number
      clickJoinCount: number
      paySuccessCount: number
      paidJoinCount: number
      joinIncomeAmount: number
    }>
    channelRows: PromotionChannelItem[]
    pagination: AnalyticsPagination
    items: PromotionReportItem[]
  }
}

interface AdminRenewalResponse {
  ok: true
  data: RenewalDashboardData
}

interface AdminPromotionChannelsResponse {
  ok: true
  data: {
    group: AnalyticsGroup
    rows: PromotionChannelDetailItem[]
  }
}

interface AdminPromotionChannelCreateResponse {
  ok: true
  data: {
    row: PromotionChannelDetailItem
  }
}

interface AdminRenewalCouponsResponse {
  ok: true
  data: {
    group: AnalyticsGroup
    rows: RenewalCouponItem[]
  }
}

interface AdminRenewalNoticesResponse {
  ok: true
  data: {
    group: AnalyticsGroup
    rows: RenewalNoticeItem[]
  }
}

interface AdminRenewalSettingsResponse {
  ok: true
  data: {
    group: AnalyticsGroup
    setting: RenewalDiscountItem
  }
}

export interface AnalyticsQuery {
  groupId?: string
  startDate?: string
  endDate?: string
  rangeDays?: number
  page?: number
  pageSize?: number
}

export interface PromotionPagePayload {
  mode: 'income' | 'promotion' | 'renewal'
  title: string
  subtitle: string
  tag: string
  group: AnalyticsGroup
  filters: AnalyticsFilters
  overviewRows: PromotionOverviewItem[][]
  insightCards: PromotionOverviewItem[]
  trendTitle: string
  trendHint: string
  trend: PromotionTrendItem[]
  trendMetricOptions: PromotionTrendMetricOption[]
  defaultTrendMetricKey: string
  trendSeries: PromotionTrendSeriesItem[]
  reportTitle: string
  reportHint: string
  reportColumns: string[]
  reportRows: Array<Record<string, string>>
  reportItems: PromotionReportDetailItem[]
  pagination: AnalyticsPagination
  funnel?: {
    title: string
    steps: Array<{ count: string; title: string; action: string }>
    summaryLabel: string
    summaryValue: string
  }
  channelRows?: PromotionChannelItem[]
  actionRows?: PromotionActionWorkbenchItem[]
}

function formatMoney(value: number) {
  return value.toFixed(2)
}

function formatPercentValue(value: number) {
  return `${value.toFixed(2)}%`
}

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

function pickPeakItem<T>(rows: T[], getValue: (item: T) => number) {
  return rows.reduce<{ item: T | null; value: number }>(
    (best, item) => {
      const nextValue = getValue(item)
      if (!best.item || nextValue > best.value) {
        return { item, value: nextValue }
      }

      return best
    },
    { item: null, value: 0 },
  )
}

function buildIncomeReportAction(item: IncomeReportItem) {
  if (item.type === 'GROUP_JOIN') {
    return {
      actionLabel: '查看推广数据',
      actionPath: '/promotion/data',
    }
  }

  return {}
}

function buildIncomePayload(response: AdminIncomeResponse['data']): PromotionPagePayload {
  const reportItems = response.items.map((item) => ({
    id: item.id,
    title: item.nickname,
    subtitle: `${item.typeLabel} · ${item.orderNo}`,
    orderNo: item.orderNo,
    paidAt: item.paidAt,
    amount: item.amount,
    income: item.income,
    status: item.status,
    statusLabel: item.statusLabel,
    detailFields: [
      { label: '订单类型', value: item.typeLabel },
      { label: '支付时间', value: formatDateTime(item.paidAt) },
      { label: '订单号', value: item.orderNo },
      { label: '支付金额', value: `${item.amount} 元` },
      { label: '星主收入', value: `${item.income} 元` },
      { label: '订单状态', value: item.statusLabel },
    ],
    insight: `${item.typeLabel}订单为星主带来 ${item.income} 元收入。`,
    ...buildIncomeReportAction(item),
  }))

  return {
    mode: 'income',
    title: '收入数据',
    subtitle: '每日 8 点前更新昨日数据，趋势按日对齐收入统计表，报表明细实时统计。',
    tag: '数据概览',
    group: response.group,
    filters: response.filters,
    overviewRows: [
      [
        { label: '累积收入(元)', value: formatMoney(response.summary.totalIncome), hint: `昨日收入 ${formatMoney(response.summary.yesterdayIncome)}` },
        { label: '本周收入(元)', value: formatMoney(response.summary.weekIncome), hint: `上周收入 ${formatMoney(response.summary.lastWeekIncome)}` },
        { label: '本月收入(元)', value: formatMoney(response.summary.monthIncome), hint: `上月收入 ${formatMoney(response.summary.lastMonthIncome)}` },
        { label: '付费加入收入(元)', value: formatMoney(response.summary.joinIncome), hint: `昨日收入 ${formatMoney(response.summary.yesterdayJoinIncome)}` },
      ],
      [
        { label: '续期收入(元)', value: formatMoney(response.summary.renewalIncome), hint: `昨日收入 ${formatMoney(response.summary.yesterdayRenewalIncome)}` },
        { label: '总成员数', value: String(response.summary.totalMembers), hint: `昨日加入成员 ${response.summary.yesterdayJoinedCount}` },
      ],
      [
        { label: '付费加入成员', value: String(response.summary.paidMembers), hint: `昨日加入成员 ${response.summary.yesterdayPaidJoinedCount}` },
        { label: '本月续期成员', value: String(response.summary.monthRenewedCount), hint: `上月续期成员 ${response.summary.lastMonthRenewedCount}` },
        { label: '昨日续期成员', value: String(response.summary.yesterdayRenewedCount), hint: '' },
      ],
    ],
    insightCards: [],
    trendTitle: '收入数据',
    trendHint: '按日对齐收入统计表，优先保证累计、构成与明细一致。',
    trend: response.trend.map((item) => ({
      date: item.date,
      label: item.label,
      value: item.totalNetAmount,
    })),
    trendMetricOptions: [
      { key: 'totalNetAmount', label: '总收入', format: 'money', hint: '按天查看全部收入合计' },
      { key: 'joinNetAmount', label: '加入收入', format: 'money', hint: '重点看拉新订单贡献' },
      { key: 'renewalNetAmount', label: '续期收入', format: 'money', hint: '看续期带来的收入波动' },
      { key: 'rewardNetAmount', label: '赞赏收入', format: 'money', hint: '适合判断内容赞赏表现' },
      { key: 'questionNetAmount', label: '提问收入', format: 'money', hint: '适合看问答变现贡献' },
    ],
    defaultTrendMetricKey: 'totalNetAmount',
    trendSeries: response.trend.map((item) => ({
      date: item.date,
      label: item.label,
      values: {
        totalNetAmount: item.totalNetAmount,
        joinNetAmount: item.joinNetAmount,
        renewalNetAmount: item.renewalNetAmount,
        rewardNetAmount: item.rewardNetAmount,
        questionNetAmount: item.questionNetAmount,
      },
    })),
    reportTitle: '收入数据报表',
    reportHint: '数据报表实时统计，导出数据后可查看更全面的数据。',
    reportColumns: ['时间', '类型', '用户昵称', '支付金额(元)', '星主收入(元)', '订单状态'],
    reportRows: response.items.map((item) => ({
      col1: item.paidAt.slice(0, 16).replace('T', ' '),
      col2: item.typeLabel,
      col3: item.nickname,
      col4: item.amount,
      col5: item.income,
      col6: item.statusLabel,
    })),
    reportItems,
    pagination: response.pagination,
  }
}

function buildPromotionPayload(response: AdminPromotionResponse['data']): PromotionPagePayload {
  const reportItems = response.items.map((item) => {
    const matchedChannel = response.channelRows.find((channelItem) => channelItem.channel === item.channel)
    return {
      id: item.id,
      title: item.nickname,
      subtitle: `${item.channel} · ${item.orderNo}`,
      orderNo: item.orderNo,
      paidAt: item.paidAt,
      amount: item.amount,
      income: item.income,
      status: item.status,
      statusLabel: item.statusLabel,
      detailFields: [
        { label: '归因渠道', value: item.channel },
        { label: '支付时间', value: formatDateTime(item.paidAt) },
        { label: '订单号', value: item.orderNo },
        { label: '支付金额', value: `${item.amount} 元` },
        { label: '星主收入', value: `${item.income} 元` },
        { label: '订单状态', value: item.statusLabel },
      ],
      insight: `${item.channel} 当前归因订单为星主带来 ${item.income} 元收入。`,
      ...(matchedChannel
        ? {
            actionLabel: '查看渠道二维码',
            actionPath: '/promotion/channel-qrcodes',
            actionQuery: { channelId: matchedChannel.id },
          }
        : {}),
    }
  })

  return {
    mode: 'promotion',
    title: '推广数据',
    subtitle: '上半部分展示付费加入收入、成员拉新和续期成员数据，下方保留真实付费加入订单报表。',
    tag: '推广拉新',
    group: response.group,
    filters: response.filters,
    overviewRows: [
      [
        { label: '付费加入收入(元)', value: formatMoney(response.summary.joinIncome), hint: `昨日收入 ${formatMoney(response.summary.yesterdayJoinIncome)}` },
        { label: '本周付费加入收入(元)', value: formatMoney(response.summary.weekJoinIncome), hint: `上周收入 ${formatMoney(response.summary.lastWeekJoinIncome)}` },
        { label: '本月付费加入收入(元)', value: formatMoney(response.summary.monthJoinIncome), hint: `上月收入 ${formatMoney(response.summary.lastMonthJoinIncome)}` },
      ],
      [
        { label: '付费加入成员', value: String(response.summary.paidMembers), hint: `昨日加入成员 ${response.summary.yesterdayPaidJoinedCount}` },
        { label: '本月付费加入成员', value: String(response.summary.monthPaidJoinedCount), hint: `上月加入成员 ${response.summary.lastMonthPaidJoinedCount}` },
        { label: '成员拉新人数', value: String(response.summary.memberInvitedCount), hint: `昨日加入成员 ${response.summary.yesterdayMemberInvitedCount}` },
        { label: '本月续期成员', value: String(response.summary.monthRenewedCount), hint: `上月续期成员 ${response.summary.lastMonthRenewedCount}` },
      ],
    ],
    insightCards: [],
    trendTitle: '',
    trendHint: '',
    trend: [],
    trendMetricOptions: [],
    defaultTrendMetricKey: '',
    trendSeries: [],
    reportTitle: '付费加入订单明细',
    reportHint: '展示真实已支付的加入订单，未归因渠道会显示为“未归因”，支持按日期筛选和导出。',
    reportColumns: ['支付时间', '渠道', '用户昵称', '支付金额(元)', '星主收入(元)', '订单状态'],
    reportRows: response.items.map((item) => ({
      col1: item.paidAt.slice(0, 16).replace('T', ' '),
      col2: item.channel,
      col3: item.nickname,
      col4: item.amount,
      col5: item.income,
      col6: item.statusLabel,
    })),
    reportItems,
    pagination: response.pagination,
    funnel: {
      title: '30日付费转化率',
      steps: [
        { count: String(response.funnel.previewVisitCount), title: '访问星球预览页的人数（星球外用户）', action: '访问星球预览页' },
        { count: String(response.funnel.clickJoinCount), title: '点击「加入星球」按钮人数', action: '点击加入按钮' },
        { count: String(response.funnel.paySuccessCount), title: '成功加入星球的人数', action: '成功支付' },
      ],
      summaryLabel: '30日付费转化率',
      summaryValue: response.funnel.conversionRate,
    },
    channelRows: response.channelRows,
  }
}

function buildRenewalPayload(response: AdminRenewalResponse['data']): PromotionPagePayload {
  const pendingMembers = Math.max(response.summary.renewableCount - response.summary.renewedCount, 0)
  const peakRenewalDay = pickPeakItem(response.trend, (item) => item.renewalConversionRate)
  const reportItems = response.items.map((item) => ({
    id: item.id,
    title: item.nickname,
    subtitle: `续期订单 · ${item.orderNo}`,
    orderNo: item.orderNo,
    paidAt: item.paidAt,
    amount: item.amount,
    income: item.income,
    status: item.status,
    statusLabel: item.statusLabel,
    detailFields: [
      { label: '支付时间', value: formatDateTime(item.paidAt) },
      { label: '订单号', value: item.orderNo },
      { label: '支付金额', value: `${item.amount} 元` },
      { label: '星主收入', value: `${item.income} 元` },
      { label: '订单状态', value: item.statusLabel },
      { label: '成员昵称', value: item.nickname },
    ],
    insight: `这笔续期订单为星主带来 ${item.income} 元收入。`,
    actionLabel: '查看续期优惠配置',
    actionPath: '/renewal/discounts',
  }))

  return {
    mode: 'renewal',
    title: '续期数据',
    subtitle: '围绕进入续期页、支付成功、续期配置与召回动作构建真实后台页面。',
    tag: '成员续期',
    group: response.group,
    filters: response.filters,
    overviewRows: [
      [
        { label: '进入续期页人数', value: String(response.summary.renewalPageVisitCount), hint: '累计进入续期页' },
        { label: '支付成功人数', value: String(response.summary.renewalPaySuccessCount), hint: '累计续期支付成功' },
        { label: '30日续期转化率', value: response.summary.renewalConversionRate, hint: '支付成功 / 进入续期页' },
        { label: '续期收入(元)', value: formatMoney(response.summary.renewalIncomeAmount), hint: '累计续期收入' },
      ],
      [
        { label: '可续期成员', value: String(response.summary.renewableCount), hint: '统计周期内可触达对象' },
        { label: '已续期成员', value: String(response.summary.renewedCount), hint: '统计周期内成功续期' },
        { label: '当前续期价(元)', value: response.summary.renewalPrice, hint: '来自续期配置' },
        { label: '续期引导语', value: response.summary.renewalGuidance.slice(0, 8) + (response.summary.renewalGuidance.length > 8 ? '…' : ''), hint: response.summary.renewalGuidance },
      ],
    ],
    insightCards: [
      {
        label: '待召回成员',
        value: String(pendingMembers),
        hint: `当前可续期 ${response.summary.renewableCount} 人，已续期 ${response.summary.renewedCount} 人`,
      },
      {
        label: '最高转化日',
        value: peakRenewalDay.item ? peakRenewalDay.item.label : '-',
        hint: peakRenewalDay.item ? `当日转化 ${formatPercentValue(peakRenewalDay.value * 100)}` : '暂无续期转化样本',
      },
      {
        label: '当前续期价',
        value: response.summary.renewalPrice,
        hint: response.summary.renewalGuidance,
      },
    ],
    trendTitle: '续期转化趋势',
    trendHint: '按日对齐续期统计表，优先保证续期收入、访问与支付成功一致。',
    trend: response.trend.map((item) => ({
      date: item.date,
      label: item.label,
      value: item.renewalPageVisitCount,
    })),
    trendMetricOptions: [
      { key: 'renewalPageVisitCount', label: '进入续期页', format: 'number', hint: '先看有多少成员真正进入续期页' },
      { key: 'renewalPaySuccessCount', label: '支付成功', format: 'number', hint: '看进入续期页后有多少人完成支付' },
      { key: 'renewedCount', label: '已续期成员', format: 'number', hint: '看实际完成续期的人数' },
      { key: 'renewalIncomeAmount', label: '续期收入', format: 'money', hint: '按天观察续期订单带来的收入' },
      { key: 'renewalConversionRate', label: '续期转化率', format: 'percent', hint: '支付成功人数 / 进入续期页人数' },
    ],
    defaultTrendMetricKey: 'renewalPageVisitCount',
    trendSeries: response.trend.map((item) => ({
      date: item.date,
      label: item.label,
      values: {
        renewalPageVisitCount: item.renewalPageVisitCount,
        renewalPaySuccessCount: item.renewalPaySuccessCount,
        renewedCount: item.renewedCount,
        renewalIncomeAmount: item.renewalIncomeAmount,
        renewalConversionRate: item.renewalConversionRate * 100,
      },
    })),
    reportTitle: '续期订单明细',
    reportHint: '当前先展示真实续期订单，下一轮再补更多召回动作日志。',
    reportColumns: ['支付时间', '成员', '支付金额(元)', '星主收入(元)', '订单状态', '订单号'],
    reportRows: response.items.map((item) => ({
      col1: item.paidAt.slice(0, 16).replace('T', ' '),
      col2: item.nickname,
      col3: item.amount,
      col4: item.income,
      col5: item.statusLabel,
      col6: item.orderNo,
    })),
    reportItems,
    pagination: response.pagination,
    actionRows: response.actions.map((item) => ({
      ...item,
      detail:
        item.action === '续期提醒'
          ? '去通知工作台继续核对模板、排期和按钮跳转。'
          : '去续期优惠配置页继续核对价格、折扣和引导语。',
      actionLabel: item.action === '续期提醒' ? '查看通知工作台' : '查看续期优惠配置',
      actionPath: item.action === '续期提醒' ? '/renewal/group-notices' : '/renewal/discounts',
    })),
  }
}

export async function getIncomePageData(query: AnalyticsQuery = {}) {
  const response = await apiRequest<AdminIncomeResponse>('/api/admin/income', {
    query: {
      groupId: query.groupId,
      startDate: query.startDate,
      endDate: query.endDate,
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })

  return buildIncomePayload(response.data)
}

export async function getPromotionPageData(query: AnalyticsQuery = {}) {
  const response = await apiRequest<AdminPromotionResponse>('/api/admin/promotion', {
    query: {
      groupId: query.groupId,
      startDate: query.startDate,
      endDate: query.endDate,
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })

  return buildPromotionPayload(response.data)
}

export async function getRenewalPageData(query: AnalyticsQuery = {}) {
  const response = await apiRequest<AdminRenewalResponse>('/api/admin/renewal', {
    query: {
      groupId: query.groupId,
      startDate: query.startDate,
      endDate: query.endDate,
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })

  return buildRenewalPayload(response.data)
}

export async function getRenewalDashboardPageData(query: AnalyticsQuery = {}) {
  const response = await apiRequest<AdminRenewalResponse>('/api/admin/renewal', {
    query: {
      groupId: query.groupId,
      startDate: query.startDate,
      endDate: query.endDate,
      rangeDays: query.rangeDays || 7,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    },
  })

  return response.data
}

export async function getPromotionChannelPageData(groupId: string) {
  const response = await apiRequest<AdminPromotionChannelsResponse>('/api/admin/promotion/channels', {
    query: {
      groupId,
    },
  })

  return response.data
}

export async function createPromotionChannel(input: PromotionChannelCreateInput) {
  const response = await apiRequest<AdminPromotionChannelCreateResponse>('/api/admin/promotion/channels', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function getRenewalCouponPageData(groupId: string) {
  const response = await apiRequest<AdminRenewalCouponsResponse>('/api/admin/renewal/coupons', {
    query: {
      groupId,
    },
  })

  return response.data
}

export async function getCouponPageData(groupId: string, couponType?: string) {
  const response = await apiRequest<AdminRenewalCouponsResponse>('/api/admin/coupons', {
    query: {
      groupId,
      couponType: couponType || '',
    },
  })

  return response.data
}

export async function getRenewalNoticePageData(groupId: string) {
  const response = await apiRequest<AdminRenewalNoticesResponse>('/api/admin/renewal/notices', {
    query: {
      groupId,
    },
  })

  return response.data
}

export async function createAdminRenewalNotice(input: RenewalNoticeCreateInput) {
  const response = await apiRequest<{ ok: true; data: { row: RenewalNoticeItem } }>('/api/admin/renewal/notices', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function getRenewalSettingPageData(groupId: string) {
  const response = await apiRequest<AdminRenewalSettingsResponse>('/api/admin/renewal/settings', {
    query: {
      groupId,
    },
  })

  return response.data
}

export async function updateRenewalSetting(input: RenewalDiscountUpdateInput) {
  const response = await apiRequest<AdminRenewalSettingsResponse>('/api/admin/renewal/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function updateRenewalGuidance(input: RenewalGuidanceUpdateInput) {
  const response = await apiRequest<AdminRenewalSettingsResponse>('/api/admin/renewal/guidance', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.data
}

export async function createAdminCoupon(input: CouponFormInput) {
  return apiRequest<{ ok: true; data: { row: RenewalCouponItem } }>('/api/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAdminCoupon(input: CouponFormInput) {
  return apiRequest<{ ok: true; data: { row: RenewalCouponItem } }>('/api/admin/coupons', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function updateAdminCouponStatus(input: { groupId: string; id: string; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' }) {
  return apiRequest<{ ok: true; data: { row: RenewalCouponItem } }>('/api/admin/coupons/status', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
