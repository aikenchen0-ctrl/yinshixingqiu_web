import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/AdminLayout'
import { mallPlatformMenuGroups } from '../../data/menu'
import {
  createAdminMallCategory,
  createAdminMallProduct,
  getAdminMallCouponAnalytics,
  getAdminMallCategories,
  getAdminMallMemberZoneConfig,
  getMallPublicConfig,
  getAdminMallOrders,
  getAdminMallProductDetailImages,
  getAdminMallProducts,
  reviewAdminMallOrderRefund,
  resolveAdminMallAssetUrl,
  shipAdminMallOrder,
  updateAdminMallMemberZoneConfig,
  updateAdminMallOrderStatus,
  updateAdminMallCategory,
  updateAdminMallProductDetailImages,
  updateAdminMallProduct,
  uploadAdminMallImage,
  type AdminMallCategoryItem,
  type AdminMallCouponAnalyticsData,
  type AdminMallCouponAnalyticsRow,
  type AdminMallCouponAnalyticsTrendItem,
  type AdminMallMemberZoneConfig,
  type AdminMallMemberZoneSortMode,
  type AdminMallOrderItem,
  type AdminMallOrdersSummary,
  type AdminMallProductDetailImageMediaType,
  type AdminMallProductDetailImageItem,
  type AdminMallProductCategoryOption,
  type AdminMallProductItem,
  type MallPublicConfigItem,
} from '../../services/adminMallService'

function formatDateTime(value: string) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ').replace(/-/g, '/')
}

function formatPreviewPrice(value: string, fallback: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback
  }

  return `¥${amount.toFixed(2)}`
}

function formatMoney(value: number | string) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) {
    return '¥0.00'
  }

  return `¥${amount.toFixed(2)}`
}

function formatCountValue(value: number | string) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) {
    return '0'
  }

  return `${Math.round(amount)}`
}

function formatCouponTrendMetricValue(value: number | string, format: 'count' | 'money') {
  return format === 'money' ? formatMoney(value) : formatCountValue(value)
}

function formatMallUserDisplay(user?: { id: string; nickname: string; mobile: string } | null) {
  if (!user) {
    return '未关联分享人'
  }

  const nickname = String(user.nickname || '').trim()
  const mobile = String(user.mobile || '').trim()
  const userId = String(user.id || '').trim()
  const displayName = nickname || (userId ? `用户${userId.slice(-4)}` : '匿名用户')

  return [displayName, mobile].filter(Boolean).join(' · ')
}

function formatMallShareSharerDisplay(
  user?: { id: string; nickname: string; mobile: string } | null,
  fallbackUserId?: string,
) {
  const normalizedFallbackUserId = String(fallbackUserId || '').trim()
  const resolvedUser =
    user || (normalizedFallbackUserId ? { id: normalizedFallbackUserId, nickname: '', mobile: '' } : null)

  if (!resolvedUser) {
    return '未关联分享人'
  }

  const baseText = formatMallUserDisplay(resolvedUser)
  const shareUserId = String(resolvedUser.id || normalizedFallbackUserId).trim()

  return shareUserId ? `${baseText} · UID ${shareUserId.slice(-8)}` : baseText
}

const EMPTY_ORDER_SUMMARY: AdminMallOrdersSummary = {
  orderCount: 0,
  pendingCount: 0,
  readyToShipCount: 0,
  shippedCount: 0,
  refundPendingCount: 0,
  refundProcessingCount: 0,
  refundedCount: 0,
  grossAmount: 0,
  grossAmountText: '0.00',
}

type OrderFilterKey = 'all' | 'readyToShip' | 'refundPending' | 'refundProcessing' | 'refunded'
type OrderInspectionFocusKey =
  | 'all'
  | 'inspected'
  | 'validated'
  | 'legacy'
  | 'risk'
  | 'discounted'
  | 'coupon'
  | 'member'
  | 'stacking'
  | 'shipped'
  | `issue:${string}`
type MallManagementSectionKey = 'categories' | 'products' | 'orders' | 'refunds' | 'memberZone' | 'couponAnalytics'
type AdminMallMemberBenefitType = 'NONE' | 'MEMBER_PRICE' | 'MEMBER_EXCLUSIVE'
type CouponAnalyticsTrendMetricKey = 'paymentSuccessCount' | 'totalDiscountAmount' | 'stackedPaymentSuccessCount' | 'autoApplyCount'

const ORDER_FILTER_OPTIONS: Array<{
  key: OrderFilterKey
  label: string
  description: string
}> = [
  { key: 'all', label: '全部订单', description: '最近订单全量展示，方便统一查看。' },
  { key: 'readyToShip', label: '待发货', description: '已支付且还没进入退款流程的订单。' },
  { key: 'refundPending', label: '退款待审', description: '买家刚提交退款，商家需要先处理。' },
  { key: 'refundProcessing', label: '退款处理中', description: '已经发起退款，等待微信结果。' },
  { key: 'refunded', label: '已退款', description: '退款完成后的订单沉淀在这里。' },
]

const REFUND_FILTER_KEYS: OrderFilterKey[] = ['refundPending', 'refundProcessing', 'refunded']
const COUPON_ANALYTICS_RANGE_OPTIONS = [
  { value: 7, label: '近 7 天', description: '看最近一周是否有即时转化。' },
  { value: 30, label: '近 30 天', description: '默认窗口，适合看稳定趋势。' },
  { value: 90, label: '近 90 天', description: '看是否有阶段性拉新或复购波峰。' },
]
const COUPON_ANALYTICS_TREND_METRIC_OPTIONS: Array<{
  key: CouponAnalyticsTrendMetricKey
  label: string
  hint: string
  format: 'count' | 'money'
}> = [
  {
    key: 'paymentSuccessCount',
    label: '带券支付',
    hint: '看真实带券成交有没有形成持续趋势。',
    format: 'count',
  },
  {
    key: 'totalDiscountAmount',
    label: '总优惠金额',
    hint: '看用户实际感知到的优惠是否稳定释放。',
    format: 'money',
  },
  {
    key: 'stackedPaymentSuccessCount',
    label: '叠加支付',
    hint: '看券与会员权益叠加是否持续发生。',
    format: 'count',
  },
  {
    key: 'autoApplyCount',
    label: '自动命中',
    hint: '看系统自动命中最优券的频率是否稳定。',
    format: 'count',
  },
]
const MEMBER_ZONE_SORT_OPTIONS: Array<{
  value: AdminMallMemberZoneSortMode
  label: string
  description: string
}> = [
  {
    value: 'MEMBER_EXCLUSIVE_FIRST',
    label: '会员专享优先',
    description: '先排会员专享，再排会员价，适合默认承接。',
  },
  {
    value: 'CONFIG_ORDER',
    label: '按指定顺序',
    description: '按下方商品 ID 顺序展示，适合做人工精选。',
  },
  {
    value: 'PRICE_ASC',
    label: '价格升序',
    description: '优先展示低门槛商品，适合先做转化。',
  },
]
const MEMBER_ZONE_PRICE_KEYWORDS = ['会员价', '会员优惠']
const MEMBER_ZONE_EXCLUSIVE_KEYWORDS = ['会员专享', '会员专属', '会员限定']

const MALL_MANAGEMENT_SECTIONS: Array<{
  key: MallManagementSectionKey
  path: string
  navLabel: string
  title: string
  tag: string
  subtitle: string
  description: string
}> = [
  {
    key: 'categories',
    path: '/mall/categories',
    navLabel: '分类管理',
    title: '分类管理',
    tag: '分类',
    subtitle: '先把货架结构搭清楚，再让商品稳定挂到小程序商城里。',
    description: '管理分类名、排序和启停状态。',
  },
  {
    key: 'products',
    path: '/mall/products',
    navLabel: '商品管理',
    title: '商品管理',
    tag: '商品',
    subtitle: '把商品基础信息、商品卡头图、顶部轮播图和宣传海报图放在同一个维护入口。',
    description: '先定商品基础信息，再分别补顶部轮播和宣传海报。',
  },
  {
    key: 'orders',
    path: '/mall/orders',
    navLabel: '订单管理',
    title: '订单管理',
    tag: '订单',
    subtitle: '集中处理待支付、待发货、已发货订单，并补录物流信息。',
    description: '重点看支付状态、物流状态和订单留档。',
  },
  {
    key: 'refunds',
    path: '/mall/refunds',
    navLabel: '售后退款',
    title: '售后退款',
    tag: '售后',
    subtitle: '把退款待审、退款处理中和已退款订单单独拎出来处理。',
    description: '聚焦退款申请、退款进度和售后留档。',
  },
  {
    key: 'memberZone',
    path: '/mall/member-zone',
    navLabel: '会员专区配置',
    title: '会员专区配置',
    tag: '会员',
    subtitle: '把会员专区的标题、提示文案、商品集合和排序策略交给运营直接维护。',
    description: '控制会员专区怎么承接会员商品。',
  },
  {
    key: 'couponAnalytics',
    path: '/mall/coupon-analytics',
    navLabel: '优惠券分析',
    title: '优惠券分析',
    tag: '分析',
    subtitle: '把优惠券曝光、自动命中、抵扣金额和支付转化放到一个商城后台页面里看。',
    description: '聚焦优惠券是否真正产生交易价值。',
  },
]

function resolveMallManagementSection(pathname: string): MallManagementSectionKey {
  if (pathname === '/mall/categories') {
    return 'categories'
  }

  if (pathname === '/mall/products') {
    return 'products'
  }

  if (pathname === '/mall/detail-images') {
    return 'products'
  }

  if (pathname === '/mall/orders') {
    return 'orders'
  }

  if (pathname === '/mall/refunds') {
    return 'refunds'
  }

  if (pathname === '/mall/member-zone') {
    return 'categories'
  }

  if (pathname === '/mall/coupon-analytics') {
    return 'categories'
  }

  return 'categories'
}

function createEmptyCategoryForm() {
  return {
    categoryId: '',
    name: '',
    sortOrder: '0',
    isEnabled: true,
  }
}

function createEmptyProductForm() {
  return {
    productId: '',
    categoryId: '',
    title: '',
    subtitle: '',
    coverImageUrl: '',
    price: '',
    originalPrice: '',
    stock: '0',
    isOnSale: true,
    sortOrder: '0',
  }
}

const MALL_PRODUCT_CAROUSEL_LIMIT = 6
const MALL_PRODUCT_PROMOTION_LIMIT = 30

const PRODUCT_MEDIA_SECTION_META: Record<
  AdminMallProductDetailImageMediaType,
  {
    title: string
    description: string
    addLabel: string
    cardLabelPrefix: string
    emptyPreviewText: string
    emptyStateText: string
    titlePlaceholder: string
    descriptionPlaceholder: string
    maxCount: number
  }
> = {
  CAROUSEL: {
    title: '顶部轮播图',
    description: '显示在小程序商品标题上方的幻灯片，适合放主视觉、核心卖点和开场图。',
    addLabel: '新增轮播图',
    cardLabelPrefix: '轮播',
    emptyPreviewText: '这里会预览顶部轮播图',
    emptyStateText: '还没有顶部轮播图。点“新增轮播图”后再上传图片。',
    titlePlaceholder: '例如：主视觉、核心卖点、爆款首屏',
    descriptionPlaceholder: '可选，用一句话概括这张轮播图想强调的内容。',
    maxCount: MALL_PRODUCT_CAROUSEL_LIMIT,
  },
  PROMOTION: {
    title: '宣传海报图',
    description: '显示在商品详情正文里，适合连续展示海报、长图、细节对比和使用场景。',
    addLabel: '新增宣传图',
    cardLabelPrefix: '宣传',
    emptyPreviewText: '这里会预览宣传海报图',
    emptyStateText: '还没有宣传海报图。点“新增宣传图”后再上传图片。',
    titlePlaceholder: '例如：材质细节、使用场景、卖点拆解',
    descriptionPlaceholder: '可选，用一句话说明这张宣传图想表达的卖点。',
    maxCount: MALL_PRODUCT_PROMOTION_LIMIT,
  },
}

type MallProductDetailImageDraft = {
  localId: string
  mediaType: AdminMallProductDetailImageMediaType
  imageUrl: string
  title: string
  description: string
  sortOrder: string
  isEnabled: boolean
}

let mallProductDetailImageDraftCounter = 0

function createDetailImageDraftLocalId() {
  mallProductDetailImageDraftCounter += 1
  return `mall_detail_image_${mallProductDetailImageDraftCounter}`
}

function createEmptyDetailImageDraft(
  index = 0,
  mediaType: AdminMallProductDetailImageMediaType = 'PROMOTION',
): MallProductDetailImageDraft {
  return {
    localId: createDetailImageDraftLocalId(),
    mediaType,
    imageUrl: '',
    title: '',
    description: '',
    sortOrder: String(index),
    isEnabled: true,
  }
}

function createDetailImageDraftFromItem(item: AdminMallProductDetailImageItem): MallProductDetailImageDraft {
  return {
    localId: item.id || createDetailImageDraftLocalId(),
    mediaType: item.mediaType || 'PROMOTION',
    imageUrl: item.imageUrl,
    title: item.title,
    description: item.description,
    sortOrder: String(item.sortOrder),
    isEnabled: item.isEnabled,
  }
}

function pickDefaultCategoryId(categories: AdminMallProductCategoryOption[]) {
  return categories.find((item) => item.isEnabled)?.id || categories[0]?.id || ''
}

function buildMallPublicSourceLabel(source: string) {
  if (source === 'REQUEST_STORE') {
    return '请求显式指定'
  }

  if (source === 'ENV_CONFIG') {
    return '后端固定配置'
  }

  if (source === 'NON_DEMO_CATALOG_SINGLETON') {
    return '自动识别唯一非演示商城'
  }

  if (source === 'CATALOG_SINGLETON') {
    return '自动识别唯一商城'
  }

  return '自动解析'
}

type ShippingDraftField = 'shippingCompany' | 'shippingTrackingNo' | 'shippingRemark'

type ShippingDraft = {
  shippingCompany: string
  shippingTrackingNo: string
  shippingRemark: string
}

function createShippingDraft(order?: AdminMallOrderItem): ShippingDraft {
  return {
    shippingCompany: order?.shippingCompany || '',
    shippingTrackingNo: order?.shippingTrackingNo || '',
    shippingRemark: order?.shippingRemark || '',
  }
}

function buildShippingDraftMap(orders: AdminMallOrderItem[]) {
  return orders.reduce<Record<string, ShippingDraft>>((result, item) => {
    result[item.id] = createShippingDraft(item)
    return result
  }, {})
}

function resolveOrderStatusChipClass(status: string) {
  if (status === 'PENDING') return 'is-warning'
  if (status === 'PAID') return 'is-success'
  return 'is-muted'
}

function resolveShippingChipClass(order: AdminMallOrderItem) {
  if (order.refundStatus === 'SUCCESS') return 'is-muted'
  if (order.refundStatus === 'PROCESSING') return 'is-warning'
  if (order.refundStatus === 'PENDING') return 'is-warning'
  if (order.shippingStatus === 'SHIPPED') return 'is-success'
  if (order.status === 'PAID') return 'is-warning'
  return 'is-muted'
}

function resolveRefundChipClass(status: string) {
  if (status === 'SUCCESS') return 'is-success'
  if (status === 'PROCESSING' || status === 'PENDING') return 'is-warning'
  if (status === 'FAILED' || status === 'REJECTED') return 'is-danger'
  return 'is-muted'
}

function resolveOrderPricingInspectionChipClass(level?: string) {
  if (level === 'OK') return 'is-success'
  if (level === 'LEGACY') return 'is-warning'
  if (level === 'RISK') return 'is-danger'
  return 'is-muted'
}

function buildOrderPricingBreakdownText(order: AdminMallOrderItem) {
  const parts = []

  if (Number(order.memberDiscountAmount || 0) > 0) {
    parts.push(`会员优惠 ${formatMoney(order.memberDiscountAmount)}`)
  }

  if (Number(order.couponDiscountAmount || order.discountAmount || 0) > 0) {
    parts.push(`券抵扣 ${formatMoney(order.couponDiscountAmount || order.discountAmount)}`)
  }

  if (Number(order.totalDiscountAmount || 0) > 0) {
    parts.push(`已省合计 ${formatMoney(order.totalDiscountAmount)}`)
  }

  parts.push(`应付 ${formatMoney(order.payableAmount)}`)

  return parts.join(' · ')
}

function hasOrderCouponDiscount(order: AdminMallOrderItem) {
  return Boolean(order.coupon) || Number(order.couponDiscountAmount || order.discountAmount || 0) > 0
}

function hasOrderMemberDiscount(order: AdminMallOrderItem) {
  return Number(order.memberDiscountAmount || 0) > 0
}

function hasRefundSample(order: AdminMallOrderItem) {
  return order.refundStatus === 'PENDING' || order.refundStatus === 'PROCESSING' || order.refundStatus === 'SUCCESS'
}

function buildOrderCouponDisplayText(order: AdminMallOrderItem) {
  if (!order.coupon) {
    return ''
  }

  const couponName = String(order.coupon.name || '').trim()
  const couponCode = String(order.coupon.code || '').trim()
  const couponStageLabel = String(order.coupon.stageLabel || '').trim()
  return [couponName || couponCode, couponStageLabel].filter(Boolean).join(' · ')
}

function buildOrderInspectionSampleTypeLabels(order: AdminMallOrderItem) {
  const labels: string[] = []

  if (order.pricingInspection?.level === 'RISK') {
    labels.push('待重点复核')
  } else if (order.pricingInspection?.level === 'LEGACY') {
    labels.push('历史兼容订单')
  } else if (order.pricingInspection?.level === 'OK' && order.pricingInspection?.shouldShowPrompt) {
    labels.push('结构已校验')
  }

  if (hasOrderCouponDiscount(order)) {
    labels.push('优惠券订单')
  }

  if (hasOrderMemberDiscount(order)) {
    labels.push('会员优惠订单')
  }

  if (order.couponStackingApplied) {
    labels.push('叠加优惠订单')
  }

  if (!labels.length) {
    labels.push('普通订单')
  }

  return labels
}

function resolveOrderInspectionStatusChipClass(status: 'success' | 'warning' | 'danger' | 'muted') {
  if (status === 'success') return 'is-success'
  if (status === 'warning') return 'is-warning'
  if (status === 'danger') return 'is-danger'
  return 'is-muted'
}

function resolveCouponAnalyticsReadinessChipClass(level: string) {
  if (level === 'READY') return 'is-success'
  if (level === 'CHECK') return 'is-warning'
  return 'is-danger'
}

function resolveCouponAnalyticsRiskChipClass(value: number, dangerThreshold = 3) {
  if (value >= dangerThreshold) return 'is-danger'
  if (value > 0) return 'is-warning'
  return 'is-success'
}

function matchesOrderFilter(order: AdminMallOrderItem, filterKey: OrderFilterKey) {
  if (filterKey === 'all') {
    return true
  }

  if (filterKey === 'readyToShip') {
    return (
      order.status === 'PAID' &&
      order.shippingStatus !== 'SHIPPED' &&
      order.refundStatus !== 'PENDING' &&
      order.refundStatus !== 'PROCESSING' &&
      order.refundStatus !== 'SUCCESS'
    )
  }

  if (filterKey === 'refundPending') {
    return order.refundStatus === 'PENDING'
  }

  if (filterKey === 'refundProcessing') {
    return order.refundStatus === 'PROCESSING'
  }

  if (filterKey === 'refunded') {
    return order.refundStatus === 'SUCCESS'
  }

  return true
}

function matchesOrderInspectionFocus(order: AdminMallOrderItem, focusKey: OrderInspectionFocusKey) {
  if (focusKey === 'all') {
    return true
  }

  if (focusKey === 'inspected') {
    return Boolean(order.pricingInspection?.shouldShowPrompt)
  }

  if (focusKey === 'validated') {
    return Boolean(order.pricingInspection?.shouldShowPrompt) && order.pricingInspection?.level === 'OK'
  }

  if (focusKey === 'legacy') {
    return Boolean(order.pricingInspection?.shouldShowPrompt) && order.pricingInspection?.level === 'LEGACY'
  }

  if (focusKey === 'risk') {
    return Boolean(order.pricingInspection?.shouldShowPrompt) && order.pricingInspection?.level === 'RISK'
  }

  if (focusKey === 'discounted') {
    return hasOrderCouponDiscount(order) || hasOrderMemberDiscount(order)
  }

  if (focusKey === 'coupon') {
    return hasOrderCouponDiscount(order)
  }

  if (focusKey === 'member') {
    return hasOrderMemberDiscount(order)
  }

  if (focusKey === 'stacking') {
    return Boolean(order.couponStackingApplied)
  }

  if (focusKey === 'shipped') {
    return order.shippingStatus === 'SHIPPED'
  }

  if (focusKey.startsWith('issue:')) {
    const issueCode = focusKey.slice('issue:'.length)
    return order.pricingInspection?.issues.some((issue) => issue.code === issueCode) ?? false
  }

  return true
}

function createEmptyMemberZoneForm(): AdminMallMemberZoneConfig {
  return {
    title: '',
    subtitle: '',
    badgeText: '',
    highlightText: '',
    emptyTitle: '',
    emptySubtitle: '',
    productIds: [],
    sortMode: 'MEMBER_EXCLUSIVE_FIRST',
  }
}

function normalizeMemberZoneProductIds(value: string) {
  const seen = new Set<string>()
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false
      }

      seen.add(item)
      return true
    })
}

function buildMemberZoneProductIdsText(productIds: string[]) {
  return productIds.join('\n')
}

function inferAdminMallProductMemberBenefitType(product: AdminMallProductItem): AdminMallMemberBenefitType {
  const keywordSource = `${String(product.title || '')}\n${String(product.subtitle || '')}`

  if (MEMBER_ZONE_EXCLUSIVE_KEYWORDS.some((keyword) => keywordSource.includes(keyword))) {
    return 'MEMBER_EXCLUSIVE'
  }

  if (MEMBER_ZONE_PRICE_KEYWORDS.some((keyword) => keywordSource.includes(keyword)) && Number(product.originalPrice || 0) > Number(product.price || 0)) {
    return 'MEMBER_PRICE'
  }

  return 'NONE'
}

function buildAdminMallMemberBenefitLabel(memberBenefitType: AdminMallMemberBenefitType) {
  if (memberBenefitType === 'MEMBER_EXCLUSIVE') {
    return '会员专享'
  }
  if (memberBenefitType === 'MEMBER_PRICE') {
    return '会员价'
  }

  return '普通商品'
}

export function MallManagementPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [publicMallConfig, setPublicMallConfig] = useState<MallPublicConfigItem | null>(null)
  const [publicMallConfigError, setPublicMallConfigError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [savingCategory, setSavingCategory] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingOrderId, setSavingOrderId] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showProductMediaEditor, setShowProductMediaEditor] = useState(false)
  const [detailImageProductId, setDetailImageProductId] = useState('')
  const [detailImageProductTitle, setDetailImageProductTitle] = useState('')
  const [detailImageDrafts, setDetailImageDrafts] = useState<MallProductDetailImageDraft[]>([])
  const [detailImagesLoading, setDetailImagesLoading] = useState(false)
  const [savingDetailImages, setSavingDetailImages] = useState(false)
  const [uploadingDetailImageLocalId, setUploadingDetailImageLocalId] = useState('')
  const [detailImageUploadTargetLocalId, setDetailImageUploadTargetLocalId] = useState('')
  const [categories, setCategories] = useState<AdminMallCategoryItem[]>([])
  const [categoryOptions, setCategoryOptions] = useState<AdminMallProductCategoryOption[]>([])
  const [products, setProducts] = useState<AdminMallProductItem[]>([])
  const [orders, setOrders] = useState<AdminMallOrderItem[]>([])
  const [couponAnalytics, setCouponAnalytics] = useState<AdminMallCouponAnalyticsData | null>(null)
  const [couponAnalyticsLoading, setCouponAnalyticsLoading] = useState(false)
  const [couponAnalyticsError, setCouponAnalyticsError] = useState('')
  const [couponAnalyticsDays, setCouponAnalyticsDays] = useState(30)
  const [couponTrendMetricKey, setCouponTrendMetricKey] = useState<CouponAnalyticsTrendMetricKey>('paymentSuccessCount')
  const [couponTrendSelectedDate, setCouponTrendSelectedDate] = useState('')
  const [memberZoneConfigLoading, setMemberZoneConfigLoading] = useState(false)
  const [memberZoneConfigError, setMemberZoneConfigError] = useState('')
  const [memberZoneIgnoredProductIds, setMemberZoneIgnoredProductIds] = useState<string[]>([])
  const [savingMemberZoneConfig, setSavingMemberZoneConfig] = useState(false)
  const [, setOrderSummary] = useState<AdminMallOrdersSummary>(EMPTY_ORDER_SUMMARY)
  const [orderFilterKey, setOrderFilterKey] = useState<OrderFilterKey>('all')
  const [orderInspectionFocusKey, setOrderInspectionFocusKey] = useState<OrderInspectionFocusKey>('all')
  const [shippingDrafts, setShippingDrafts] = useState<Record<string, ShippingDraft>>({})
  const [categoryForm, setCategoryForm] = useState(createEmptyCategoryForm)
  const [memberZoneForm, setMemberZoneForm] = useState<AdminMallMemberZoneConfig>(createEmptyMemberZoneForm)
  const [productForm, setProductForm] = useState(createEmptyProductForm)
  const coverFileInputRef = useRef<HTMLInputElement | null>(null)
  const detailImageFileInputRef = useRef<HTMLInputElement | null>(null)
  const managementSection = useMemo(() => resolveMallManagementSection(location.pathname), [location.pathname])
  const managementSectionMeta = useMemo(
    () => MALL_MANAGEMENT_SECTIONS.find((item) => item.key === managementSection) || MALL_MANAGEMENT_SECTIONS[0],
    [managementSection],
  )
  const showCategoryPanel = managementSection === 'categories'
  const showProductPanel = managementSection === 'products'
  const showOrderPanel = managementSection === 'orders' || managementSection === 'refunds'
  const showMemberZonePanel = managementSection === 'memberZone'
  const showCouponAnalyticsPanel = managementSection === 'couponAnalytics'
  const showPanelStack = showCategoryPanel || showProductPanel
  const showOrderInspectionNotes = false
  const mallStoreId = publicMallConfig?.storeId || ''
  const mallDisplayName = publicMallConfig?.storeName || '商城'
  const mallConfigLoading = !publicMallConfig && !publicMallConfigError

  useEffect(() => {
    if (location.pathname === '/mall/member-zone' || location.pathname === '/mall/coupon-analytics') {
      navigate('/mall/categories', { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    setError('')
    setNotice('')
    setCategoryForm(createEmptyCategoryForm())
    setProductForm(createEmptyProductForm())
    setShowProductMediaEditor(false)
    setDetailImageProductId('')
    setDetailImageProductTitle('')
    setDetailImageDrafts([])
    setDetailImagesLoading(false)
    setSavingDetailImages(false)
    setUploadingDetailImageLocalId('')
    setDetailImageUploadTargetLocalId('')
    setOrderFilterKey('all')
    setShippingDrafts({})
    setCouponAnalytics(null)
    setCouponAnalyticsError('')
    setCouponAnalyticsLoading(false)
    setCouponAnalyticsDays(30)
    setCouponTrendMetricKey('paymentSuccessCount')
    setCouponTrendSelectedDate('')
    setMemberZoneConfigLoading(false)
    setMemberZoneConfigError('')
    setMemberZoneIgnoredProductIds([])
    setSavingMemberZoneConfig(false)
    setMemberZoneForm(createEmptyMemberZoneForm())
    setOrderInspectionFocusKey('all')
  }, [mallStoreId])

  useEffect(() => {
    let active = true
    setPublicMallConfigError('')

    getMallPublicConfig()
      .then((payload) => {
        if (!active) return
        setPublicMallConfig(payload)
      })
      .catch((requestError: Error) => {
        if (!active) return
        setPublicMallConfig(null)
        setPublicMallConfigError(requestError.message || '公开商城配置读取失败')
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    if (!mallStoreId) {
      setLoading(false)
      setCategories([])
      setCategoryOptions([])
      setProducts([])
      setOrders([])
      setOrderSummary(EMPTY_ORDER_SUMMARY)
      setShippingDrafts({})
      return
    }

    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      getAdminMallCategories({ storeId: mallStoreId }),
      getAdminMallProducts({ storeId: mallStoreId }),
      getAdminMallOrders({ storeId: mallStoreId, limit: 20 }),
    ])
      .then(([categoryPayload, productPayload, orderPayload]) => {
        if (!active) return
        setCategories(categoryPayload.items)
        setCategoryOptions(productPayload.categories)
        setProducts(productPayload.items)
        setOrders(orderPayload.items)
        setOrderSummary(orderPayload.summary)
        setShippingDrafts(buildShippingDraftMap(orderPayload.items))
      })
      .catch((requestError: Error) => {
        if (!active) return
        setError(requestError.message || '加载商城管理数据失败')
        setCategories([])
        setCategoryOptions([])
        setProducts([])
        setOrders([])
        setOrderSummary(EMPTY_ORDER_SUMMARY)
        setShippingDrafts({})
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [mallStoreId, reloadKey])

  useEffect(() => {
    if (!mallStoreId) {
      setCouponAnalytics(null)
      setCouponAnalyticsError('')
      setCouponAnalyticsLoading(false)
      return
    }

    if (!showCouponAnalyticsPanel) {
      return
    }

    let active = true
    setCouponAnalyticsLoading(true)
    setCouponAnalyticsError('')

    getAdminMallCouponAnalytics({
      storeId: mallStoreId,
      days: couponAnalyticsDays,
    })
      .then((payload) => {
        if (!active) {
          return
        }

        setCouponAnalytics(payload)
      })
      .catch((requestError: Error) => {
        if (!active) {
          return
        }

        setCouponAnalytics(null)
        setCouponAnalyticsError(requestError.message || '加载优惠券分析失败')
      })
      .finally(() => {
        if (active) {
          setCouponAnalyticsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [couponAnalyticsDays, mallStoreId, reloadKey, showCouponAnalyticsPanel])

  useEffect(() => {
    if (!couponAnalytics || !couponAnalytics.dailyTrend.length) {
      setCouponTrendSelectedDate('')
      return
    }

    setCouponTrendSelectedDate((currentValue) => {
      if (currentValue && couponAnalytics.dailyTrend.some((item) => item.date === currentValue)) {
        return currentValue
      }

      return couponAnalytics.dailyTrend[couponAnalytics.dailyTrend.length - 1].date
    })
  }, [couponAnalytics])

  useEffect(() => {
    if (!mallStoreId) {
      setMemberZoneConfigLoading(false)
      setMemberZoneConfigError('')
      setMemberZoneIgnoredProductIds([])
      setMemberZoneForm(createEmptyMemberZoneForm())
      return
    }

    if (!showMemberZonePanel) {
      return
    }

    let active = true
    setMemberZoneConfigLoading(true)
    setMemberZoneConfigError('')

    getAdminMallMemberZoneConfig({
      storeId: mallStoreId,
    })
      .then((payload) => {
        if (!active) {
          return
        }

        setMemberZoneForm(payload.config)
        setMemberZoneIgnoredProductIds(Array.isArray(payload.ignoredProductIds) ? payload.ignoredProductIds : [])
      })
      .catch((requestError: Error) => {
        if (!active) {
          return
        }

        setMemberZoneForm(createEmptyMemberZoneForm())
        setMemberZoneIgnoredProductIds([])
        setMemberZoneConfigError(requestError.message || '加载会员专区配置失败')
      })
      .finally(() => {
        if (active) {
          setMemberZoneConfigLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [mallStoreId, reloadKey, showMemberZonePanel])

  const publicMallBanner = useMemo(() => {
    if (publicMallConfigError) {
      return {
        tone: 'is-error',
        text: `商城平台还没有稳定数据源：${publicMallConfigError}。如果库里同时留着演示数据和真实商城，公开端会优先自动识别唯一的真实商城。`,
      }
    }

    if (!publicMallConfig) {
      return null
    }

    const sourceLabel = buildMallPublicSourceLabel(publicMallConfig.source)
    return {
      tone: 'is-success',
      text: `当前正在管理独立商城平台「${publicMallConfig.storeName}」。来源：${sourceLabel}。`,
    }
  }, [publicMallConfig, publicMallConfigError])

  useEffect(() => {
    if (!categoryOptions.length) {
      return
    }

    setProductForm((currentForm) => {
      if (currentForm.categoryId) {
        return currentForm
      }

      return {
        ...currentForm,
        categoryId: pickDefaultCategoryId(categoryOptions),
      }
    })
  }, [categoryOptions])

  useEffect(() => {
    if (!products.length) {
      setShowProductMediaEditor(false)
      setDetailImageProductId('')
      setDetailImageProductTitle('')
      setDetailImageDrafts([])
      setDetailImagesLoading(false)
      return
    }

    setDetailImageProductId((currentValue) => {
      if (currentValue && products.some((item) => item.id === currentValue)) {
        return currentValue
      }

      if (productForm.productId && products.some((item) => item.id === productForm.productId)) {
        return productForm.productId
      }

      return products[0]?.id || ''
    })
  }, [productForm.productId, products])

  useEffect(() => {
    if (!mallStoreId || !detailImageProductId) {
      return
    }

    let active = true
    setDetailImagesLoading(true)

    getAdminMallProductDetailImages({
      storeId: mallStoreId,
      productId: detailImageProductId,
    })
      .then((payload) => {
        if (!active) {
          return
        }

        setDetailImageProductTitle(payload.productTitle)
        setDetailImageDrafts(payload.items.map(createDetailImageDraftFromItem))
      })
      .catch((requestError: Error) => {
        if (!active) {
          return
        }

        setDetailImageProductTitle(products.find((item) => item.id === detailImageProductId)?.title || '')
        setDetailImageDrafts([])
        setError(requestError.message || '加载商品轮播与宣传图失败')
      })
      .finally(() => {
        if (active) {
          setDetailImagesLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [detailImageProductId, mallStoreId, products])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [notice])

  useEffect(() => {
    setOrderInspectionFocusKey('all')

    if (managementSection === 'refunds') {
      setOrderFilterKey((currentKey) => (REFUND_FILTER_KEYS.includes(currentKey) ? currentKey : 'refundPending'))
      return
    }

    if (managementSection === 'orders') {
      setOrderFilterKey((currentKey) => (REFUND_FILTER_KEYS.includes(currentKey) ? 'all' : currentKey))
    }
  }, [managementSection])

  const carouselImageDrafts = useMemo(
    () => detailImageDrafts.filter((item) => item.mediaType === 'CAROUSEL'),
    [detailImageDrafts],
  )
  const promotionImageDrafts = useMemo(
    () => detailImageDrafts.filter((item) => item.mediaType === 'PROMOTION'),
    [detailImageDrafts],
  )
  const detailImageConfiguredCount = useMemo(
    () => detailImageDrafts.filter((item) => item.imageUrl.trim()).length,
    [detailImageDrafts],
  )
  const carouselConfiguredCount = useMemo(
    () => carouselImageDrafts.filter((item) => item.imageUrl.trim()).length,
    [carouselImageDrafts],
  )
  const promotionConfiguredCount = useMemo(
    () => promotionImageDrafts.filter((item) => item.imageUrl.trim()).length,
    [promotionImageDrafts],
  )
  const selectedDetailImageProduct = useMemo(
    () => products.find((item) => item.id === detailImageProductId) || null,
    [detailImageProductId, products],
  )
  const activeProductMediaCoverUrl = useMemo(() => {
    if (productForm.productId && productForm.productId === detailImageProductId) {
      return productForm.coverImageUrl.trim()
    }

    return selectedDetailImageProduct?.coverImageUrl.trim() || ''
  }, [detailImageProductId, productForm.coverImageUrl, productForm.productId, selectedDetailImageProduct])
  const filteredOrders = useMemo(
    () => orders.filter((item) => matchesOrderFilter(item, orderFilterKey)),
    [orderFilterKey, orders],
  )
  const visibleOrderFilterOptions = useMemo(
    () =>
      managementSection === 'refunds'
        ? ORDER_FILTER_OPTIONS.filter((item) => REFUND_FILTER_KEYS.includes(item.key))
        : ORDER_FILTER_OPTIONS,
    [managementSection],
  )
  const currentOrderFilterLabel = useMemo(
    () =>
      visibleOrderFilterOptions.find((item) => item.key === orderFilterKey)?.label ||
      ORDER_FILTER_OPTIONS.find((item) => item.key === orderFilterKey)?.label ||
      '全部订单',
    [orderFilterKey, visibleOrderFilterOptions],
  )
  const orderWorkbenchOverviewCards = useMemo(() => {
    const pendingCount = filteredOrders.filter((item) => item.status === 'PENDING').length
    const readyToShipCount = filteredOrders.filter((item) => {
      const refundLocked =
        item.refundStatus === 'PENDING' || item.refundStatus === 'PROCESSING' || item.refundStatus === 'SUCCESS'
      return item.status === 'PAID' && item.shippingStatus !== 'SHIPPED' && !refundLocked
    }).length
    const shippedCount = filteredOrders.filter((item) => item.shippingStatus === 'SHIPPED').length
    const refundHandlingCount = filteredOrders.filter(
      (item) => item.refundStatus === 'PENDING' || item.refundStatus === 'PROCESSING',
    ).length

    return [
      {
        key: 'filtered',
        label: '当前筛选',
        value: filteredOrders.length,
        hint: currentOrderFilterLabel,
      },
      {
        key: 'pending',
        label: '待确认支付',
        value: pendingCount,
        hint: '先确认支付或关闭',
      },
      {
        key: 'ready',
        label: '待发货',
        value: readyToShipCount,
        hint: '支付完成待录物流',
      },
      {
        key: 'shipping',
        label: '售后处理中',
        value: refundHandlingCount,
        hint: shippedCount ? `已发货 ${shippedCount}` : '当前无已发货样本',
      },
    ]
  }, [currentOrderFilterLabel, filteredOrders])
  const refundWorkbenchOverviewCards = useMemo(() => {
    const pendingCount = filteredOrders.filter((item) => item.refundStatus === 'PENDING').length
    const processingCount = filteredOrders.filter((item) => item.refundStatus === 'PROCESSING').length
    const refundedCount = filteredOrders.filter((item) => item.refundStatus === 'SUCCESS').length
    const shippedRefundCount = filteredOrders.filter((item) => item.shippingStatus === 'SHIPPED').length

    return [
      {
        key: 'filtered-refunds',
        label: '当前售后单',
        value: filteredOrders.length,
        hint: currentOrderFilterLabel,
      },
      {
        key: 'pending-refunds',
        label: '待审核退款',
        value: pendingCount,
        hint: pendingCount ? '优先处理' : '当前无待审',
      },
      {
        key: 'processing-refunds',
        label: '退款处理中',
        value: processingCount,
        hint: processingCount ? '跟进退款结果' : '当前无处理中',
      },
      {
        key: 'shipped-refunds',
        label: '已发货售后',
        value: shippedRefundCount,
        hint: refundedCount ? `已退款 ${refundedCount}` : '当前无已退款',
      },
    ]
  }, [currentOrderFilterLabel, filteredOrders])
  const orderInspectionSummary = useMemo(() => {
    const inspectedOrders = filteredOrders.filter((item) => item.pricingInspection?.shouldShowPrompt)
    const readyCount = inspectedOrders.filter((item) => item.pricingInspection?.level === 'OK').length
    const legacyCount = inspectedOrders.filter((item) => item.pricingInspection?.level === 'LEGACY').length
    const riskCount = inspectedOrders.filter((item) => item.pricingInspection?.level === 'RISK').length
    const couponOrderCount = filteredOrders.filter((item) => hasOrderCouponDiscount(item)).length
    const memberDiscountOrderCount = filteredOrders.filter((item) => hasOrderMemberDiscount(item)).length
    const stackingOrderCount = filteredOrders.filter((item) => item.couponStackingApplied).length
    const issueMap = new Map<string, { title: string; count: number }>()

    inspectedOrders.forEach((item) => {
      item.pricingInspection.issues.forEach((issue) => {
        const currentIssue = issueMap.get(issue.code)
        if (currentIssue) {
          currentIssue.count += 1
          return
        }

        issueMap.set(issue.code, {
          title: issue.title,
          count: 1,
        })
      })
    })

    const issueOptions = Array.from(issueMap.entries())
      .map(([code, value]) => ({
        code,
        title: value.title,
        count: value.count,
      }))
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
    const topIssues = issueOptions
      .slice(0, 4)

    const overviewCards = [
      {
        key: 'discount-orders',
        label: '可验优惠订单',
        value: `${inspectedOrders.length}`,
        hint: `当前筛选范围 ${filteredOrders.length} 笔订单里，有 ${inspectedOrders.length} 笔带优惠结构或兼容风险提示`,
        focusKey: 'inspected' as OrderInspectionFocusKey,
      },
      {
        key: 'validated-orders',
        label: '结构已校验',
        value: `${readyCount}`,
        hint: inspectedOrders.length
          ? `占优惠订单 ${Math.round((readyCount / Math.max(inspectedOrders.length, 1)) * 100)}%`
          : '当前还没有可验优惠订单样本',
        focusKey: 'validated' as OrderInspectionFocusKey,
      },
      {
        key: 'legacy-orders',
        label: '历史兼容订单',
        value: `${legacyCount}`,
        hint: legacyCount
          ? '建议优先核对券信息、会员优惠拆分和前后台展示是否一致'
          : '当前筛选范围内没有历史兼容订单',
        focusKey: 'legacy' as OrderInspectionFocusKey,
      },
      {
        key: 'risk-orders',
        label: '待重点复核',
        value: `${riskCount}`,
        hint: riskCount
          ? '优先检查应付金额、总优惠和支付实扣是否一致'
          : '当前筛选范围内没有高风险订单',
        focusKey: 'risk' as OrderInspectionFocusKey,
      },
    ] as Array<{
      key: string
      label: string
      value: string
      hint: string
      focusKey: OrderInspectionFocusKey
    }>

    const checklistItems = [
      {
        key: 'coupon-member-stack',
        title: '叠加优惠验收',
        status: stackingOrderCount ? 'success' : 'muted',
        description: stackingOrderCount
          ? `已有 ${stackingOrderCount} 笔券与会员叠加订单，可直接核对前台订单详情、后台订单卡和支付金额。`
          : '当前筛选范围内没有券与会员叠加订单，数据库恢复后优先补这类样本。',
        focusKey: 'stacking' as OrderInspectionFocusKey,
      },
      {
        key: 'coupon-orders',
        title: '优惠券订单验收',
        status: couponOrderCount ? 'success' : 'muted',
        description: couponOrderCount
          ? `已有 ${couponOrderCount} 笔带券订单，可核对券名称、券阶段和券抵扣金额。`
          : '当前筛选范围内没有带券订单样本。',
        focusKey: 'coupon' as OrderInspectionFocusKey,
      },
      {
        key: 'member-orders',
        title: '会员优惠验收',
        status: memberDiscountOrderCount ? 'success' : 'muted',
        description: memberDiscountOrderCount
          ? `已有 ${memberDiscountOrderCount} 笔会员优惠订单，可核对会员优惠和商品原价合计。`
          : '当前筛选范围内没有会员优惠订单样本。',
        focusKey: 'member' as OrderInspectionFocusKey,
      },
      {
        key: 'legacy-orders',
        title: '历史兼容复核',
        status: legacyCount ? 'warning' : 'muted',
        description: legacyCount
          ? `当前有 ${legacyCount} 笔历史兼容订单，建议逐笔记录“前台展示 / 后台展示 / 支付实扣”是否一致。`
          : '当前筛选范围内没有历史兼容订单。',
        focusKey: 'legacy' as OrderInspectionFocusKey,
      },
      {
        key: 'risk-orders',
        title: '风险订单复核',
        status: riskCount ? 'danger' : 'success',
        description: riskCount
          ? `当前有 ${riskCount} 笔待重点复核订单，优先检查应付金额和总优惠是否匹配。`
          : '当前没有高风险订单，可先按现有样本准备验收记录。',
        focusKey: 'risk' as OrderInspectionFocusKey,
      },
    ] as Array<{
      key: string
      title: string
      status: 'success' | 'warning' | 'danger' | 'muted'
      description: string
      focusKey: OrderInspectionFocusKey
    }>

    const headlineStatus: 'success' | 'warning' | 'danger' | 'muted' = riskCount
      ? 'danger'
      : legacyCount
        ? 'warning'
        : inspectedOrders.length
          ? 'success'
          : 'muted'
    const headlineLabel = riskCount
      ? `待重点复核 ${riskCount}`
      : legacyCount
        ? `历史兼容 ${legacyCount}`
        : inspectedOrders.length
          ? `可验样本 ${inspectedOrders.length}`
          : '待补样本'

    return {
      overviewCards,
      checklistItems,
      issueOptions,
      topIssues,
      headlineStatus,
      headlineLabel,
      inspectedOrdersCount: inspectedOrders.length,
    }
  }, [filteredOrders])
  const visibleOrders = useMemo(
    () => filteredOrders.filter((item) => matchesOrderInspectionFocus(item, orderInspectionFocusKey)),
    [filteredOrders, orderInspectionFocusKey],
  )
  const listedOrders = useMemo(
    () => (managementSection === 'orders' || managementSection === 'refunds' ? filteredOrders : visibleOrders),
    [filteredOrders, managementSection, visibleOrders],
  )
  const orderInspectionFocusMeta = useMemo<{
    label: string
    description: string
    status: 'success' | 'warning' | 'danger' | 'muted'
  }>(() => {
    const sampleCount = visibleOrders.length

    if (orderInspectionFocusKey === 'all') {
      return {
        label: '全部样本',
        description: `当前展示筛选后的 ${sampleCount} 笔订单，可继续按验收类型或风险项聚焦。`,
        status: orderInspectionSummary.headlineStatus,
      }
    }

    if (orderInspectionFocusKey === 'inspected') {
      return {
        label: '可验优惠订单',
        description: `当前聚焦 ${sampleCount} 笔带优惠结构提示的订单，优先核对前台订单详情、后台订单卡和支付实扣是否一致。`,
        status: sampleCount ? 'success' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'validated') {
      return {
        label: '结构已校验样本',
        description: `当前聚焦 ${sampleCount} 笔结构已校验订单，用来确认正常样本没有被误判。`,
        status: sampleCount ? 'success' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'legacy') {
      return {
        label: '历史兼容样本',
        description: `当前聚焦 ${sampleCount} 笔历史兼容订单，优先核对旧订单口径是否仍可接受。`,
        status: sampleCount ? 'warning' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'risk') {
      return {
        label: '待重点复核样本',
        description: `当前聚焦 ${sampleCount} 笔待重点复核订单，优先检查应付金额、总优惠和券信息是否一致。`,
        status: sampleCount ? 'danger' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'discounted') {
      return {
        label: '带优惠样本',
        description: `当前聚焦 ${sampleCount} 笔带优惠订单，优先核对券抵扣、会员优惠、应付金额和退款金额是否一致。`,
        status: sampleCount ? 'warning' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'coupon') {
      return {
        label: '优惠券订单样本',
        description: `当前聚焦 ${sampleCount} 笔带券订单，可快速核对券名称、券阶段和券抵扣金额。`,
        status: sampleCount ? 'success' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'member') {
      return {
        label: '会员优惠样本',
        description: `当前聚焦 ${sampleCount} 笔会员优惠订单，可快速核对会员优惠与商品原价合计。`,
        status: sampleCount ? 'success' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'stacking') {
      return {
        label: '叠加优惠样本',
        description: `当前聚焦 ${sampleCount} 笔券与会员叠加订单，用来验证叠加规则、详情展示和支付金额是否一致。`,
        status: sampleCount ? 'success' : 'muted',
      }
    }

    if (orderInspectionFocusKey === 'shipped') {
      return {
        label: '已发货样本',
        description: `当前聚焦 ${sampleCount} 笔已发货订单，优先确认物流状态、退款处理和退回动作是否一致。`,
        status: sampleCount ? 'warning' : 'muted',
      }
    }

    if (orderInspectionFocusKey.startsWith('issue:')) {
      const issueCode = orderInspectionFocusKey.slice('issue:'.length)
      const issueOption = orderInspectionSummary.issueOptions.find((item) => item.code === issueCode)
      const issueLabel = issueOption?.title || issueCode || '风险项'

      return {
        label: `风险项聚焦：${issueLabel}`,
        description: `当前聚焦 ${sampleCount} 笔命中“${issueLabel}”的订单，可直接整理差异说明和后续补数动作。`,
        status: sampleCount ? 'danger' : 'muted',
      }
    }

    return {
      label: '全部样本',
      description: `当前展示筛选后的 ${sampleCount} 笔订单。`,
      status: sampleCount ? 'success' : 'muted',
    }
  }, [
    orderInspectionFocusKey,
    orderInspectionSummary.headlineStatus,
    orderInspectionSummary.issueOptions,
    visibleOrders.length,
  ])
  const visibleOrderIssueOptions = useMemo(() => {
    const issueMap = new Map<string, { title: string; count: number }>()

    visibleOrders.forEach((item) => {
      item.pricingInspection?.issues.forEach((issue) => {
        const currentIssue = issueMap.get(issue.code)
        if (currentIssue) {
          currentIssue.count += 1
          return
        }

        issueMap.set(issue.code, {
          title: issue.title,
          count: 1,
        })
      })
    })

    return Array.from(issueMap.entries())
      .map(([code, value]) => ({
        code,
        title: value.title,
        count: value.count,
      }))
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
  }, [visibleOrders])
  const orderInspectionConclusion = useMemo<{
    status: 'success' | 'warning' | 'danger' | 'muted'
    label: string
    summary: string
    actionItems: string[]
    text: string
  }>(() => {
    const sampleCount = visibleOrders.length
    const riskCount = visibleOrders.filter((item) => item.pricingInspection?.level === 'RISK').length
    const legacyCount = visibleOrders.filter((item) => item.pricingInspection?.level === 'LEGACY').length
    const validatedCount = visibleOrders.filter((item) => item.pricingInspection?.level === 'OK').length
    const discountedCount = visibleOrders.filter(
      (item) => hasOrderCouponDiscount(item) || hasOrderMemberDiscount(item),
    ).length
    const couponCount = visibleOrders.filter((item) => hasOrderCouponDiscount(item)).length
    const memberCount = visibleOrders.filter((item) => hasOrderMemberDiscount(item)).length
    const stackingCount = visibleOrders.filter((item) => item.couponStackingApplied).length
    const shippedCount = visibleOrders.filter((item) => item.shippingStatus === 'SHIPPED').length
    const pendingRefundCount = visibleOrders.filter((item) => item.refundStatus === 'PENDING').length
    const processingRefundCount = visibleOrders.filter((item) => item.refundStatus === 'PROCESSING').length
    const topIssueText = visibleOrderIssueOptions.length
      ? visibleOrderIssueOptions
          .slice(0, 3)
          .map((item) => `${item.title} ${item.count}`)
          .join('、')
      : '当前样本未命中高频风险项'

    if (!sampleCount) {
      const text = [
        managementSection === 'refunds' ? '商城售后验收结论' : '商城联调验收结论',
        `页面：${managementSection === 'refunds' ? '售后退款' : '订单管理'}`,
        `订单筛选：${currentOrderFilterLabel}`,
        `聚焦样本：${orderInspectionFocusMeta.label}`,
        '当前结论：待补样本',
        '结论说明：当前聚焦条件下没有命中的订单样本，暂时不能输出有效验收结论。',
        '建议动作：调整筛选范围或清除聚焦后重新生成结论。',
      ].join('\n')

      return {
        status: 'muted',
        label: '待补样本',
        summary: '当前聚焦条件下没有命中的订单样本，暂时不能输出有效验收结论。',
        actionItems: ['调整筛选范围或清除聚焦后重新生成结论。'],
        text,
      }
    }

    if (managementSection === 'refunds') {
      let status: 'success' | 'warning' | 'danger' | 'muted' = 'success'
      let label = '可继续按标准售后流程处理'

      if (riskCount) {
        status = 'danger'
        label = '需先复核退款金额和优惠结构'
      } else if (shippedCount || discountedCount || legacyCount || processingRefundCount) {
        status = 'warning'
        label = '退款样本需带条件核对'
      }

      const summary = `当前聚焦 ${sampleCount} 笔退款样本，其中待重点复核 ${riskCount} 笔、历史兼容 ${legacyCount} 笔、带优惠退款 ${discountedCount} 笔、已发货退款 ${shippedCount} 笔、退款待审 ${pendingRefundCount} 笔。`
      const actionItems = [
        riskCount
          ? '命中高风险项的退款单先核对前台订单详情、后台订单卡和支付实扣金额，不直接同意退款。'
          : '当前样本没有命中高风险优惠结构，可按现有数据继续处理退款。',
        shippedCount
          ? '已发货退款先确认物流拦截、退回或售后回收动作，不能按未发货退款处理。'
          : '当前样本没有已发货退款，不需要追加物流拦截动作。',
        discountedCount
          ? '带优惠退款先核对应付金额、退款金额和券/会员优惠口径是否一致。'
          : '当前样本没有带优惠退款，可按标准退款金额流程处理。',
      ]
      const text = [
        '商城售后验收结论',
        '发送对象：测试 / 运营 / 售后处理人',
        `订单筛选：${currentOrderFilterLabel}`,
        `聚焦样本：${orderInspectionFocusMeta.label}`,
        `当前结论：${label}`,
        `结论说明：${summary}`,
        `高频风险项：${topIssueText}`,
        '建议动作：',
        ...actionItems.map((item, index) => `${index + 1}. ${item}`),
      ].join('\n')

      return {
        status,
        label,
        summary,
        actionItems,
        text,
      }
    }

    let status: 'success' | 'warning' | 'danger' | 'muted' = 'success'
    let label = '当前样本可继续联调'

    if (riskCount) {
      status = 'danger'
      label = '当前样本需优先复核'
    } else if (legacyCount) {
      status = 'warning'
      label = '当前样本存在历史兼容待确认'
    }

    const summary = `当前聚焦 ${sampleCount} 笔订单样本，其中结构已校验 ${validatedCount} 笔、历史兼容 ${legacyCount} 笔、待重点复核 ${riskCount} 笔、带券 ${couponCount} 笔、会员优惠 ${memberCount} 笔、叠加优惠 ${stackingCount} 笔。`
    const actionItems = [
      riskCount
        ? '优先逐单核对前台订单详情、后台订单卡和支付实扣金额，再决定是否判定样本通过。'
        : '当前样本没有命中高风险优惠结构，可继续按现有口径推进联调。',
      legacyCount
        ? '对历史兼容订单单独标注旧口径，不与新结构化订单混合判定通过。'
        : '当前样本没有历史兼容订单，可以按结构化口径继续验收。',
      stackingCount
        ? '叠加优惠样本单独核对券抵扣、会员优惠和总优惠金额是否按同一口径展示。'
        : '当前样本没有叠加优惠订单，可优先保持现有样本继续收敛。',
    ]
    const text = [
      '商城联调验收结论',
      '发送对象：测试 / 运营 / 联调同学',
      `订单筛选：${currentOrderFilterLabel}`,
      `聚焦样本：${orderInspectionFocusMeta.label}`,
      `当前结论：${label}`,
      `结论说明：${summary}`,
      `高频风险项：${topIssueText}`,
      '建议动作：',
      ...actionItems.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n')

    return {
      status,
      label,
      summary,
      actionItems,
      text,
    }
  }, [
    currentOrderFilterLabel,
    managementSection,
    orderInspectionFocusMeta.label,
    visibleOrderIssueOptions,
    visibleOrders,
  ])
  const combinedInspectionConclusion = useMemo<{
    status: 'success' | 'warning' | 'danger' | 'muted'
    label: string
    summary: string
    actionItems: string[]
    text: string
  }>(() => {
    const loadedOrderCount = orders.length
    const currentPageLabel = managementSection === 'refunds' ? '售后退款' : '订单管理'
    const inspectableOrderCount = orders.filter((item) => item.pricingInspection?.shouldShowPrompt).length
    const orderValidatedCount = orders.filter((item) => item.pricingInspection?.level === 'OK').length
    const orderLegacyCount = orders.filter((item) => item.pricingInspection?.level === 'LEGACY').length
    const orderRiskCount = orders.filter((item) => item.pricingInspection?.level === 'RISK').length
    const orderCouponCount = orders.filter((item) => hasOrderCouponDiscount(item)).length
    const orderMemberCount = orders.filter((item) => hasOrderMemberDiscount(item)).length
    const orderStackingCount = orders.filter((item) => item.couponStackingApplied).length
    const refundSampleCount = orders.filter((item) => hasRefundSample(item)).length
    const refundRiskCount = orders.filter((item) => hasRefundSample(item) && item.pricingInspection?.level === 'RISK').length
    const refundLegacyCount = orders.filter((item) => hasRefundSample(item) && item.pricingInspection?.level === 'LEGACY').length
    const refundDiscountedCount = orders.filter(
      (item) => hasRefundSample(item) && (hasOrderCouponDiscount(item) || hasOrderMemberDiscount(item)),
    ).length
    const refundShippedCount = orders.filter((item) => hasRefundSample(item) && item.shippingStatus === 'SHIPPED').length
    const refundPendingCount = orders.filter((item) => item.refundStatus === 'PENDING').length
    const refundProcessingCount = orders.filter((item) => item.refundStatus === 'PROCESSING').length
    const issueMap = new Map<string, { title: string; count: number }>()

    orders.forEach((item) => {
      item.pricingInspection?.issues.forEach((issue) => {
        const currentIssue = issueMap.get(issue.code)
        if (currentIssue) {
          currentIssue.count += 1
          return
        }

        issueMap.set(issue.code, {
          title: issue.title,
          count: 1,
        })
      })
    })

    const topIssueText = Array.from(issueMap.entries())
      .map(([code, value]) => ({
        code,
        title: value.title,
        count: value.count,
      }))
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
      .slice(0, 4)
      .map((item) => `${item.title} ${item.count}`)
      .join('、') || '当前已加载订单池未命中高频风险项'

    if (!loadedOrderCount) {
      const text = [
        '商城联合验收结论',
        '发送对象：测试 / 运营 / 联调同学',
        `当前页面：${currentPageLabel}`,
        `当前聚焦：${orderInspectionFocusMeta.label}（${visibleOrders.length} 笔）`,
        '当前结论：待补联合样本',
        '结论说明：当前还没有已加载订单样本，暂时不能输出联合验收结论。',
        '建议动作：先产生订单或退款样本后再生成联合结论。',
      ].join('\n')

      return {
        status: 'muted',
        label: '待补联合样本',
        summary: '当前还没有已加载订单样本，暂时不能输出联合验收结论。',
        actionItems: ['先产生订单或退款样本后再生成联合结论。'],
        text,
      }
    }

    let status: 'success' | 'warning' | 'danger' | 'muted' = 'success'
    let label = '订单与售后样本可继续联调'

    if (orderRiskCount || refundRiskCount) {
      status = 'danger'
      label = '订单与售后样本需优先复核'
    } else if (orderLegacyCount || refundLegacyCount || refundShippedCount || orderStackingCount) {
      status = 'warning'
      label = '订单与售后样本存在条件项'
    }

    const summary = `当前页面聚焦 ${orderInspectionFocusMeta.label} ${visibleOrders.length} 笔；当前已加载订单池 ${loadedOrderCount} 笔，其中订单验收样本 ${inspectableOrderCount} 笔、退款样本 ${refundSampleCount} 笔。订单侧待重点复核 ${orderRiskCount} 笔，售后侧待重点复核 ${refundRiskCount} 笔。`
    const actionItems = [
      orderRiskCount || refundRiskCount
        ? '先处理命中高风险项的订单和退款样本，逐单核对前台订单详情、后台订单卡、支付实扣和退款金额。'
        : '当前已加载样本没有命中高风险优惠结构，可继续按现有口径推进联调。',
      orderLegacyCount || refundLegacyCount
        ? '历史兼容订单和历史兼容退款单独标注旧口径，不和新结构化样本混合判定通过。'
        : '当前已加载样本没有历史兼容口径，可优先按结构化数据继续验收。',
      refundShippedCount || orderStackingCount || refundDiscountedCount
        ? '已发货退款、叠加优惠订单和带优惠退款单独跟进物流、优惠口径和退款处理说明。'
        : '当前样本没有已发货退款或复杂优惠结构，可以优先保持现有样本推进。',
    ]
    const text = [
      '商城联合验收结论',
      '发送对象：测试 / 运营 / 联调同学',
      `当前页面：${currentPageLabel}`,
      `当前聚焦：${orderInspectionFocusMeta.label}（${visibleOrders.length} 笔）`,
      `已加载订单池：${loadedOrderCount} 笔`,
      `订单侧：可验优惠样本 ${inspectableOrderCount} 笔，结构已校验 ${orderValidatedCount} 笔，历史兼容 ${orderLegacyCount} 笔，待重点复核 ${orderRiskCount} 笔，带券 ${orderCouponCount} 笔，会员优惠 ${orderMemberCount} 笔，叠加优惠 ${orderStackingCount} 笔`,
      `售后侧：退款样本 ${refundSampleCount} 笔，待重点复核 ${refundRiskCount} 笔，历史兼容 ${refundLegacyCount} 笔，带优惠退款 ${refundDiscountedCount} 笔，已发货退款 ${refundShippedCount} 笔，退款待审 ${refundPendingCount} 笔，退款处理中 ${refundProcessingCount} 笔`,
      `联合结论：${label}`,
      `高频风险项：${topIssueText}`,
      '建议动作：',
      ...actionItems.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n')

    return {
      status,
      label,
      summary,
      actionItems,
      text,
    }
  }, [
    managementSection,
    orderInspectionFocusMeta.label,
    orders,
    visibleOrders.length,
  ])
  const combinedInspectionBrief = useMemo<{
    status: 'success' | 'warning' | 'danger' | 'muted'
    label: string
    summary: string
    highlights: string[]
    text: string
  }>(() => {
    const loadedOrderCount = orders.length
    const currentPageLabel = managementSection === 'refunds' ? '售后退款' : '订单管理'
    const focusCount = visibleOrders.length
    const orderRiskCount = orders.filter((item) => item.pricingInspection?.level === 'RISK').length
    const orderLegacyCount = orders.filter((item) => item.pricingInspection?.level === 'LEGACY').length
    const orderStackingCount = orders.filter((item) => item.couponStackingApplied).length
    const refundSampleCount = orders.filter((item) => hasRefundSample(item)).length
    const refundRiskCount = orders.filter((item) => hasRefundSample(item) && item.pricingInspection?.level === 'RISK').length
    const refundShippedCount = orders.filter((item) => hasRefundSample(item) && item.shippingStatus === 'SHIPPED').length
    const topIssueText = Array.from(
      orders.reduce<Map<string, { title: string; count: number }>>((result, item) => {
        item.pricingInspection?.issues.forEach((issue) => {
          const currentIssue = result.get(issue.code)
          if (currentIssue) {
            currentIssue.count += 1
            return
          }

          result.set(issue.code, {
            title: issue.title,
            count: 1,
          })
        })
        return result
      }, new Map()),
    )
      .map(([code, value]) => ({
        code,
        title: value.title,
        count: value.count,
      }))
      .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
      .slice(0, 2)
      .map((item) => `${item.title} ${item.count}`)
      .join('、') || '无高频风险'

    if (!loadedOrderCount) {
      const text = [
        '商城联调短摘要',
        `当前页：${currentPageLabel}`,
        `当前聚焦：${orderInspectionFocusMeta.label}（${focusCount} 笔）`,
        '一句话：当前还没有已加载订单样本，暂时不能输出联合短摘要。',
      ].join('\n')

      return {
        status: 'muted',
        label: '待补样本',
        summary: '当前还没有已加载订单样本，暂时不能输出联合短摘要。',
        highlights: ['先产生订单或退款样本后再生成短摘要。'],
        text,
      }
    }

    let status: 'success' | 'warning' | 'danger' | 'muted' = 'success'
    let label = '可继续联调'

    if (orderRiskCount || refundRiskCount) {
      status = 'danger'
      label = '先复核高风险样本'
    } else if (orderLegacyCount || refundShippedCount || orderStackingCount) {
      status = 'warning'
      label = '存在条件项'
    }

    const summary = `已加载 ${loadedOrderCount} 笔订单，当前聚焦 “${orderInspectionFocusMeta.label}” ${focusCount} 笔；订单侧高风险 ${orderRiskCount} 笔、历史兼容 ${orderLegacyCount} 笔；售后侧退款样本 ${refundSampleCount} 笔、高风险退款 ${refundRiskCount} 笔、已发货退款 ${refundShippedCount} 笔。`
    const highlights = [
      `当前判断：${label}`,
      orderRiskCount || refundRiskCount
        ? '先处理订单/退款高风险样本，再核对前台金额、后台金额、支付实扣和退款金额。'
        : '当前没有命中高风险样本，可继续按现有口径推进联调。',
      orderLegacyCount || refundShippedCount || orderStackingCount
        ? '历史兼容、已发货退款和叠加优惠样本单独跟进，不与普通样本混判通过。'
        : `当前高频风险：${topIssueText}`,
    ]
    const text = [
      '商城联调短摘要',
      `当前页：${currentPageLabel}`,
      `当前聚焦：${orderInspectionFocusMeta.label}（${focusCount} 笔）`,
      `一句话：${summary}`,
      `当前判断：${label}`,
      `建议：${highlights[1]}`,
    ].join('\n')

    return {
      status,
      label,
      summary,
      highlights,
      text,
    }
  }, [
    managementSection,
    orderInspectionFocusMeta.label,
    orders,
    visibleOrders.length,
  ])
  const orderInspectionRecordText = useMemo(() => {
    if (!visibleOrders.length) {
      return [
        '联调验收留档文本',
        `页面：${managementSection === 'refunds' ? '售后退款' : '订单管理'}`,
        `订单筛选：${currentOrderFilterLabel}`,
        `聚焦样本：${orderInspectionFocusMeta.label}`,
        '当前没有命中的订单样本，请先调整筛选或清除聚焦后再复制。',
      ].join('\n')
    }

    const headerLines = [
      '联调验收留档文本',
      `页面：${managementSection === 'refunds' ? '售后退款' : '订单管理'}`,
      `订单筛选：${currentOrderFilterLabel}`,
      `聚焦样本：${orderInspectionFocusMeta.label}`,
      `聚焦说明：${orderInspectionFocusMeta.description}`,
      `命中订单：${visibleOrders.length}`,
      '记录字段：订单号 / 样本类型 / 前台订单详情金额 / 后台订单卡金额 / 支付实扣金额 / 是否一致 / 差异说明',
    ]

    const bodyLines = visibleOrders.map((item, index) => {
      const sampleTypeText = buildOrderInspectionSampleTypeLabels(item).join('、')
      const issueText = item.pricingInspection?.issues.length
        ? item.pricingInspection.issues.map((issue) => issue.title).join('、')
        : '无'
      const couponText = buildOrderCouponDisplayText(item) || '无'
      const statusText = [item.statusLabel, item.shippingStatusLabel, item.refundStatusLabel].filter(Boolean).join(' / ')
      const refundLines =
        managementSection === 'refunds'
          ? [
              `退款状态：${item.refundStatusLabel || '当前没有退款申请'}`,
              `退款金额：${item.refundAmountText ? `¥${item.refundAmountText}` : '待确认'}`,
              `退款原因：${item.refundReason || '未填写'}`,
              `退款处理说明：${item.refundReviewRemark || '待填写'}`,
            ]
          : []

      return [
        `${index + 1}. 订单号：${item.orderNo}`,
        `样本类型：${sampleTypeText}`,
        `订单时间：${formatDateTime(item.createdAt)}`,
        `订单状态：${statusText || '未识别'}`,
        `优惠结构：${item.pricingInspection?.levelLabel || '未校验'} / ${item.pricingInspection?.summaryText || '当前订单优惠结构已按现有数据展示。'}`,
        `金额口径：${buildOrderPricingBreakdownText(item)}`,
        `优惠券：${couponText}`,
        `风险项：${issueText}`,
        ...refundLines,
        '前台订单详情金额：待填写',
        '后台订单卡金额：待填写',
        '支付实扣金额：待填写',
        '是否一致：待确认',
        '差异说明：待填写',
      ].join('\n')
    })

    return [...headerLines, '', ...bodyLines].join('\n')
  }, [
    currentOrderFilterLabel,
    managementSection,
    orderInspectionFocusMeta.description,
    orderInspectionFocusMeta.label,
    visibleOrders,
  ])
  const productCoverPreviewUrl = useMemo(
    () => resolveAdminMallAssetUrl(productForm.coverImageUrl),
    [productForm.coverImageUrl],
  )
  const productCoverFallbackText = useMemo(() => {
    const normalizedTitle = productForm.title.trim()
    return normalizedTitle ? normalizedTitle.slice(0, 2) : '封面'
  }, [productForm.title])
  const productPreviewTitle = useMemo(
    () => productForm.title.trim() || '商品标题预览',
    [productForm.title],
  )
  const productPreviewSubtitle = useMemo(
    () => productForm.subtitle.trim() || '这里会显示商品简介，方便先确认封面和文案是否搭配。',
    [productForm.subtitle],
  )
  const productPreviewPrice = useMemo(
    () => formatPreviewPrice(productForm.price, '¥0.00'),
    [productForm.price],
  )
  const productPreviewOriginalPrice = useMemo(
    () => formatPreviewPrice(productForm.originalPrice, '¥0.00'),
    [productForm.originalPrice],
  )
  const memberZoneProductIdsText = useMemo(
    () => buildMemberZoneProductIdsText(memberZoneForm.productIds),
    [memberZoneForm.productIds],
  )
  const memberZoneSelectableProducts = useMemo(
    () =>
      products
        .map((item) => {
          const memberBenefitType = inferAdminMallProductMemberBenefitType(item)
          return {
            ...item,
            memberBenefitType,
            memberBenefitLabel: buildAdminMallMemberBenefitLabel(memberBenefitType),
          }
        })
        .filter((item) => item.isOnSale && item.memberBenefitType !== 'NONE'),
    [products],
  )
  const memberZoneSelectedProductIdSet = useMemo(() => new Set(memberZoneForm.productIds), [memberZoneForm.productIds])
  const memberZoneSelectedProducts = useMemo(
    () => memberZoneForm.productIds.map((productId) => memberZoneSelectableProducts.find((item) => item.id === productId)).filter(Boolean),
    [memberZoneForm.productIds, memberZoneSelectableProducts],
  )
  const memberZoneMissingProductIds = useMemo(() => {
    const selectableIdSet = new Set(memberZoneSelectableProducts.map((item) => item.id))
    return memberZoneForm.productIds.filter((productId) => !selectableIdSet.has(productId))
  }, [memberZoneForm.productIds, memberZoneSelectableProducts])
  const memberZoneSortLabel = useMemo(
    () => MEMBER_ZONE_SORT_OPTIONS.find((item) => item.value === memberZoneForm.sortMode)?.label || MEMBER_ZONE_SORT_OPTIONS[0].label,
    [memberZoneForm.sortMode],
  )
  const memberZoneSortDescription = useMemo(
    () =>
      MEMBER_ZONE_SORT_OPTIONS.find((item) => item.value === memberZoneForm.sortMode)?.description ||
      MEMBER_ZONE_SORT_OPTIONS[0].description,
    [memberZoneForm.sortMode],
  )
  const couponAnalyticsSummary = couponAnalytics ? couponAnalytics.summary : null
  const couponAnalyticsCompatibilitySummary = couponAnalytics ? couponAnalytics.compatibilitySummary : null
  const couponAnalyticsQualitySummary = couponAnalytics ? couponAnalytics.qualitySummary : null
  const topCouponRows = useMemo<AdminMallCouponAnalyticsRow[]>(
    () => (couponAnalytics ? couponAnalytics.couponRows.slice(0, 12) : []),
    [couponAnalytics],
  )
  const couponAnalyticsSummaryCards = useMemo(() => {
    if (!couponAnalyticsSummary) {
      return []
    }

    return [
      {
        key: 'impression',
        label: '优惠券曝光',
        value: `${couponAnalyticsSummary.impressionCount}`,
        hint: `其中 ${couponAnalyticsSummary.availableImpressionCount} 次有可用券，${couponAnalyticsSummary.noCouponImpressionCount} 次无券可用`,
      },
      {
        key: 'available-impression',
        label: '有券曝光',
        value: `${couponAnalyticsSummary.availableImpressionCount}`,
        hint: `最近 ${couponAnalyticsSummary.rangeDays} 天真正有可自动匹配优惠券的曝光次数`,
      },
      {
        key: 'auto-apply',
        label: '自动命中',
        value: `${couponAnalyticsSummary.autoApplyCount}`,
        hint: `自动命中率 ${couponAnalyticsSummary.autoApplyRateText}`,
      },
      {
        key: 'checkout-submit',
        label: '带券提交',
        value: `${couponAnalyticsSummary.checkoutSubmitCount}`,
        hint: '已带券提交订单的次数',
      },
      {
        key: 'payment-success',
        label: '带券支付',
        value: `${couponAnalyticsSummary.paymentSuccessCount}`,
        hint: `支付转化 ${couponAnalyticsSummary.paymentConversionRateText}`,
      },
      {
        key: 'discount-amount',
        label: '券抵扣金额',
        value: `¥${couponAnalyticsSummary.discountAmountText}`,
        hint: `活跃优惠券 ${couponAnalyticsSummary.activeCouponCount} 张`,
      },
      {
        key: 'stacked-payment',
        label: '券+会员叠加支付',
        value: `${couponAnalyticsSummary.stackedPaymentSuccessCount}`,
        hint: `叠加率 ${couponAnalyticsSummary.stackedPaymentRateText}`,
      },
      {
        key: 'member-discount',
        label: '会员让利金额',
        value: `¥${couponAnalyticsSummary.memberDiscountAmountText}`,
        hint: '只统计带券支付里同时发生的会员优惠',
      },
      {
        key: 'total-discount',
        label: '总优惠金额',
        value: `¥${couponAnalyticsSummary.totalDiscountAmountText}`,
        hint: '券抵扣和会员让利合并后，更接近用户真实感知优惠',
      },
    ]
  }, [couponAnalyticsSummary])
  const couponAnalyticsQualityCards = useMemo(() => {
    if (!couponAnalyticsQualitySummary || !couponAnalyticsSummary) {
      return []
    }

    return [
      {
        key: 'readiness',
        label: '验收状态',
        badge: couponAnalyticsQualitySummary.readinessLevelLabel,
        chipClass: resolveCouponAnalyticsReadinessChipClass(couponAnalyticsQualitySummary.readinessLevel),
        metrics: [
          `风险项 ${couponAnalyticsQualitySummary.warningCount}`,
          `活跃天数 ${couponAnalyticsQualitySummary.activeDayCount}/${couponAnalyticsQualitySummary.rangeDays}`,
        ],
        hint:
          couponAnalyticsQualitySummary.warningCount > 0
            ? '建议先看下方风险项，再决定是否直接用这些样本判断经营效果。'
            : '当前样本在只读层面未发现结构性风险，可以优先进入真实链路联调。',
      },
      {
        key: 'sample-window',
        label: '样本窗口',
        badge: couponAnalyticsQualitySummary.sampleTruncated ? '已触顶' : '未触顶',
        chipClass: couponAnalyticsQualitySummary.sampleTruncated ? 'is-warning' : 'is-success',
        metrics: [
          `原始样本 ${couponAnalyticsQualitySummary.rawEventSampleSize}/${couponAnalyticsQualitySummary.sampleLimit}`,
          `券样本 ${couponAnalyticsSummary.eventSampleSize}`,
        ],
        hint: couponAnalyticsQualitySummary.sampleTruncated
          ? '原始 PREVIEW_VIEW 查询已触顶，当前时间窗内可能还有未纳入分析的商城埋点。'
          : '当前时间窗内原始样本没有撞到查询上限。 ',
      },
      {
        key: 'coverage',
        label: '时间覆盖',
        badge: couponAnalyticsQualitySummary.activeDayCoverageRateText,
        chipClass:
          couponAnalyticsQualitySummary.activeDayCount === 0
            ? 'is-warning'
            : couponAnalyticsQualitySummary.activeDayCoverageRate >= 0.5
              ? 'is-success'
              : 'is-warning',
        metrics: [
          `活跃天数 ${couponAnalyticsQualitySummary.activeDayCount}`,
          `空白天数 ${couponAnalyticsQualitySummary.emptyDayCount}`,
        ],
        hint: '覆盖率低不一定是埋点错误，但说明趋势更容易被单日波动放大，解读时要更保守。',
      },
      {
        key: 'field-completeness',
        label: '字段完整性',
        badge: `${couponAnalyticsQualitySummary.couponAppliedWithoutCouponCodeCount}`,
        chipClass: resolveCouponAnalyticsRiskChipClass(couponAnalyticsQualitySummary.couponAppliedWithoutCouponCodeCount),
        metrics: [
          `带券缺券码 ${couponAnalyticsQualitySummary.couponAppliedWithoutCouponCodeCount}`,
          `场景未标记 ${couponAnalyticsQualitySummary.unknownScenarioCount}`,
        ],
        hint: '缺券码会削弱优惠券排行可信度，场景未标记会削弱购物车/立即购买的链路归因。',
      },
      {
        key: 'payment-structure',
        label: '支付结构校验',
        badge: `${couponAnalyticsQualitySummary.paymentWithoutDiscountAmountCount}`,
        chipClass: resolveCouponAnalyticsRiskChipClass(couponAnalyticsQualitySummary.paymentWithoutDiscountAmountCount),
        metrics: [
          `带券支付无优惠 ${couponAnalyticsQualitySummary.paymentWithoutDiscountAmountCount}`,
          `叠加缺会员让利 ${couponAnalyticsQualitySummary.stackedPaymentWithoutMemberDiscountCount}`,
        ],
        hint: '如果这里有值，说明支付成功样本里可能还存在优惠结构字段缺失，先别急着下经营结论。',
      },
      {
        key: 'stage-completeness',
        label: '阶段完整性',
        badge: `${couponAnalyticsQualitySummary.paymentWithoutStageCount}`,
        chipClass: resolveCouponAnalyticsRiskChipClass(couponAnalyticsQualitySummary.paymentWithoutStageCount),
        metrics: [
          `带券支付缺阶段 ${couponAnalyticsQualitySummary.paymentWithoutStageCount}`,
          `显式选券覆盖 ${couponAnalyticsCompatibilitySummary?.explicitSelectionCoverageRateText || '-'}`,
        ],
        hint: '阶段缺失会影响新人券/首单券/复购券的经营判断，建议联调时优先核对下单和支付埋点。 ',
      },
    ]
  }, [couponAnalyticsCompatibilitySummary, couponAnalyticsQualitySummary, couponAnalyticsSummary])
  const couponTrendMetric = useMemo(
    () =>
      COUPON_ANALYTICS_TREND_METRIC_OPTIONS.find((item) => item.key === couponTrendMetricKey) ||
      COUPON_ANALYTICS_TREND_METRIC_OPTIONS[0],
    [couponTrendMetricKey],
  )
  const couponTrendSelectedItem = useMemo<AdminMallCouponAnalyticsTrendItem | null>(() => {
    if (!couponAnalytics || !couponAnalytics.dailyTrend.length) {
      return null
    }

    return (
      couponAnalytics.dailyTrend.find((item) => item.date === couponTrendSelectedDate) ||
      couponAnalytics.dailyTrend[couponAnalytics.dailyTrend.length - 1]
    )
  }, [couponAnalytics, couponTrendSelectedDate])
  const couponTrendMaxValue = useMemo(() => {
    const trendItems = couponAnalytics ? couponAnalytics.dailyTrend : []
    if (!trendItems.length) {
      return 1
    }

    return Math.max(
      1,
      ...trendItems.map((item) => {
        const nextValue = Number(item[couponTrendMetric.key] || 0)
        return Number.isFinite(nextValue) ? nextValue : 0
      }),
    )
  }, [couponAnalytics, couponTrendMetric])
  const couponTrendPeakItem = useMemo<AdminMallCouponAnalyticsTrendItem | null>(() => {
    const trendItems = couponAnalytics ? couponAnalytics.dailyTrend : []
    if (!trendItems.length) {
      return null
    }

    return trendItems.reduce<AdminMallCouponAnalyticsTrendItem | null>((bestItem, currentItem) => {
      if (!bestItem) {
        return currentItem
      }

      const currentValue = Number(currentItem[couponTrendMetric.key] || 0)
      const bestValue = Number(bestItem[couponTrendMetric.key] || 0)
      return currentValue > bestValue ? currentItem : bestItem
    }, null)
  }, [couponAnalytics, couponTrendMetric])
  const couponTrendAverageValue = useMemo(() => {
    const trendItems = couponAnalytics ? couponAnalytics.dailyTrend : []
    if (!trendItems.length) {
      return 0
    }

    const totalValue = trendItems.reduce((sum, item) => sum + Number(item[couponTrendMetric.key] || 0), 0)
    return totalValue / trendItems.length
  }, [couponAnalytics, couponTrendMetric])

  function handleMemberZoneFieldChange(
    field: Exclude<keyof AdminMallMemberZoneConfig, 'productIds' | 'sortMode'>,
    value: string,
  ) {
    setMemberZoneForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function handleMemberZoneSortModeChange(value: AdminMallMemberZoneSortMode) {
    setMemberZoneForm((currentForm) => ({
      ...currentForm,
      sortMode: value,
    }))
  }

  function handleMemberZoneProductIdsTextChange(value: string) {
    setMemberZoneForm((currentForm) => ({
      ...currentForm,
      productIds: normalizeMemberZoneProductIds(value),
    }))
  }

  function handleToggleMemberZoneProduct(productId: string) {
    setMemberZoneForm((currentForm) => {
      const exists = currentForm.productIds.includes(productId)
      return {
        ...currentForm,
        productIds: exists
          ? currentForm.productIds.filter((item) => item !== productId)
          : currentForm.productIds.concat(productId),
      }
    })
  }

  function handleUseDetectedMemberProducts() {
    setMemberZoneForm((currentForm) => ({
      ...currentForm,
      productIds: memberZoneSelectableProducts.map((item) => item.id),
    }))
  }

  function handleClearMemberZoneProducts() {
    setMemberZoneForm((currentForm) => ({
      ...currentForm,
      productIds: [],
    }))
  }

  async function handleMemberZoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mallStoreId) {
      return
    }

    setSavingMemberZoneConfig(true)
    setError('')
    setNotice('')

    try {
      const response = await updateAdminMallMemberZoneConfig({
        storeId: mallStoreId,
        config: memberZoneForm,
      })

      setMemberZoneForm(response.config)
      setMemberZoneIgnoredProductIds(Array.isArray(response.ignoredProductIds) ? response.ignoredProductIds : [])
      setNotice(
        response.ignoredProductIds.length
          ? `会员专区配置已保存，已自动忽略 ${response.ignoredProductIds.length} 个无效商品 ID`
          : '会员专区配置已保存',
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存会员专区配置失败')
    } finally {
      setSavingMemberZoneConfig(false)
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mallStoreId) return

    setSavingCategory(true)
    setError('')
    setNotice('')

    try {
      const payload = {
        storeId: mallStoreId,
        categoryId: categoryForm.categoryId,
        name: categoryForm.name.trim(),
        sortOrder: Number(categoryForm.sortOrder || 0),
        isEnabled: categoryForm.isEnabled,
      }

      if (payload.categoryId) {
        await updateAdminMallCategory(payload)
        setNotice('分类已更新')
      } else {
        await createAdminMallCategory({
          storeId: mallStoreId,
          name: payload.name,
          sortOrder: payload.sortOrder,
        })
        setNotice('分类已创建')
      }

      setCategoryForm(createEmptyCategoryForm())
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存分类失败')
    } finally {
      setSavingCategory(false)
    }
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mallStoreId) return

    if (!categoryOptions.length) {
      setError('请先创建商品分类')
      return
    }

    setSavingProduct(true)
    setError('')
    setNotice('')

    try {
      const payload = {
        storeId: mallStoreId,
        productId: productForm.productId,
        categoryId: productForm.categoryId,
        title: productForm.title.trim(),
        subtitle: productForm.subtitle.trim(),
        coverImageUrl: productForm.coverImageUrl.trim(),
        price: Number(productForm.price || 0),
        originalPrice: Number(productForm.originalPrice || 0),
        stock: Number(productForm.stock || 0),
        isOnSale: productForm.isOnSale,
        sortOrder: Number(productForm.sortOrder || 0),
      }

      if (payload.productId) {
        await updateAdminMallProduct(payload)
        setDetailImageProductId(payload.productId)
        setDetailImageProductTitle(payload.title)
        setNotice('商品已更新')
      } else {
        await createAdminMallProduct(payload)
        setNotice('商品已创建')
      }

      setProductForm({
        ...createEmptyProductForm(),
        categoryId: pickDefaultCategoryId(categoryOptions),
      })
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存商品失败')
    } finally {
      setSavingProduct(false)
    }
  }

  function handleCoverUploadTrigger() {
    if (uploadingCover) {
      return
    }

    coverFileInputRef.current?.click()
  }

  async function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null
    event.target.value = ''

    if (!file) {
      return
    }

    setUploadingCover(true)
    setError('')
    setNotice('')

    try {
      const uploadedUrl = await uploadAdminMallImage(file)
      setProductForm((currentForm) => ({
        ...currentForm,
        coverImageUrl: uploadedUrl,
      }))
      setNotice('商品头图已上传')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '图片上传失败')
    } finally {
      setUploadingCover(false)
    }
  }

  function handleUseCoverAsFirstDetailImage() {
    const coverImageUrl = activeProductMediaCoverUrl
    if (!coverImageUrl) {
      return
    }

    setDetailImageDrafts((currentDrafts) => {
      const carouselDrafts = currentDrafts.filter((item) => item.mediaType === 'CAROUSEL')
      if (!carouselDrafts.length) {
        return [
          ...currentDrafts,
          {
            ...createEmptyDetailImageDraft(0, 'CAROUSEL'),
            imageUrl: coverImageUrl,
            title: '商品头图',
          },
        ]
      }

      const firstCarouselLocalId = carouselDrafts[0]?.localId
      return currentDrafts.map((item) =>
        item.localId === firstCarouselLocalId
          ? {
              ...item,
              imageUrl: coverImageUrl,
              title: item.title || '商品头图',
            }
          : item,
      )
    })
    setNotice('头图已填入首张轮播图')
  }

  function handleEditProduct(item: AdminMallProductItem) {
    setProductForm({
      productId: item.id,
      categoryId: item.categoryId,
      title: item.title,
      subtitle: item.subtitle,
      coverImageUrl: item.coverImageUrl,
      price: String(item.price),
      originalPrice: String(item.originalPrice),
      stock: String(item.stock),
      isOnSale: item.isOnSale,
      sortOrder: String(item.sortOrder),
    })
    setShowProductMediaEditor(false)
  }

  function handleOpenProductMediaEditor(item: AdminMallProductItem) {
    setDetailImageProductId(item.id)
    setDetailImageProductTitle(item.title)
    setShowProductMediaEditor(true)
  }

  function handleOpenEditingProductMediaEditor() {
    if (!productForm.productId) {
      return
    }
    const editingItem = products.find((item) => item.id === productForm.productId)
    if (editingItem) {
      handleOpenProductMediaEditor(editingItem)
    }
  }

  function handleResetProductForm() {
    setProductForm({
      ...createEmptyProductForm(),
      categoryId: pickDefaultCategoryId(categoryOptions),
    })
  }

  function handleDetailImageDraftChange(
    localId: string,
    field: keyof Omit<MallProductDetailImageDraft, 'localId'>,
    value: string | boolean,
  ) {
    setDetailImageDrafts((currentDrafts) =>
      currentDrafts.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)),
    )
  }

  function handleAddDetailImageDraft(mediaType: AdminMallProductDetailImageMediaType) {
    setDetailImageDrafts((currentDrafts) => {
      const currentTypeCount = currentDrafts.filter((item) => item.mediaType === mediaType).length
      if (currentTypeCount >= PRODUCT_MEDIA_SECTION_META[mediaType].maxCount) {
        return currentDrafts
      }

      return [...currentDrafts, createEmptyDetailImageDraft(currentTypeCount, mediaType)]
    })
  }

  function handleRemoveDetailImageDraft(localId: string) {
    setDetailImageDrafts((currentDrafts) => currentDrafts.filter((item) => item.localId !== localId))
  }

  function handleDetailImageUploadTrigger(localId: string) {
    if (uploadingDetailImageLocalId) {
      return
    }

    setDetailImageUploadTargetLocalId(localId)
    detailImageFileInputRef.current?.click()
  }

  async function handleDetailImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null
    const targetLocalId = detailImageUploadTargetLocalId
    event.target.value = ''

    if (!file || !targetLocalId) {
      setDetailImageUploadTargetLocalId('')
      return
    }

    setUploadingDetailImageLocalId(targetLocalId)
    setError('')
    setNotice('')

    try {
      const uploadedUrl = await uploadAdminMallImage(file)
      setDetailImageDrafts((currentDrafts) =>
        currentDrafts.map((item) => (item.localId === targetLocalId ? { ...item, imageUrl: uploadedUrl } : item)),
      )
      setNotice('商品媒体图已上传')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '图片上传失败')
    } finally {
      setUploadingDetailImageLocalId('')
      setDetailImageUploadTargetLocalId('')
    }
  }

  async function handleDetailImagesSubmit() {
    if (!mallStoreId || !detailImageProductId) {
      return
    }

    setSavingDetailImages(true)
    setError('')
    setNotice('')

    try {
      const payload = {
        storeId: mallStoreId,
        productId: detailImageProductId,
        items: detailImageDrafts
          .map((item, index) => ({
            mediaType: item.mediaType,
            imageUrl: item.imageUrl.trim(),
            title: item.title.trim(),
            description: item.description.trim(),
            sortOrder: Number(item.sortOrder || index),
            isEnabled: item.isEnabled,
          }))
          .filter((item) => item.imageUrl),
      }

      const response = await updateAdminMallProductDetailImages(payload)
      setDetailImageProductTitle(response.productTitle)
      setDetailImageDrafts(response.items.map(createDetailImageDraftFromItem))
      setNotice(response.items.length ? '商品轮播图和宣传图已更新' : '商品媒体图已清空，小程序顶部会回退到头图')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存商品媒体图失败')
    } finally {
      setSavingDetailImages(false)
    }
  }

  function renderProductMediaDraftGroup(
    mediaType: AdminMallProductDetailImageMediaType,
    drafts: MallProductDetailImageDraft[],
  ) {
    const sectionMeta = PRODUCT_MEDIA_SECTION_META[mediaType]
    const enabledLabel = mediaType === 'CAROUSEL' ? '在小程序顶部轮播展示' : '在商品详情正文展示'
    const configuredCount = drafts.filter((item) => item.imageUrl.trim()).length

    return (
      <section className="mall-admin-media-group">
        <div className="mall-admin-media-group-head">
          <div>
            <h4>{sectionMeta.title}</h4>
            <p>{sectionMeta.description}</p>
          </div>
          <div className="mall-admin-media-group-actions">
            <span className="mall-admin-media-group-count">
              已配置 {configuredCount} / {sectionMeta.maxCount}
            </span>
            <button
              className="admin-resource-ghost"
              disabled={savingDetailImages || drafts.length >= sectionMeta.maxCount}
              onClick={() => handleAddDetailImageDraft(mediaType)}
              type="button"
            >
              {sectionMeta.addLabel}
            </button>
          </div>
        </div>

        {drafts.length ? (
          <div className="mall-admin-promo-grid">
            {drafts.map((item, index) => (
              <article className="mall-admin-promo-card" key={item.localId}>
                <div className="mall-admin-promo-card-head">
                  <strong>{`${sectionMeta.cardLabelPrefix} ${index + 1}`}</strong>
                  <button
                    className="admin-resource-ghost is-danger"
                    onClick={() => handleRemoveDetailImageDraft(item.localId)}
                    type="button"
                  >
                    删除
                  </button>
                </div>

                <div className="mall-admin-cover-upload-row">
                  <button
                    className="admin-resource-ghost"
                    disabled={Boolean(uploadingDetailImageLocalId)}
                    onClick={() => handleDetailImageUploadTrigger(item.localId)}
                    type="button"
                  >
                    {uploadingDetailImageLocalId === item.localId ? '上传中...' : '上传图片'}
                  </button>
                  <span className="mall-admin-cover-upload-hint">上传后只回填当前这张图片</span>
                </div>

                {item.imageUrl ? (
                  <div className="mall-admin-promo-preview">
                    <img alt={item.title || `${sectionMeta.title} ${index + 1}`} src={resolveAdminMallAssetUrl(item.imageUrl)} />
                  </div>
                ) : (
                  <div className="mall-admin-promo-empty-preview">{sectionMeta.emptyPreviewText}</div>
                )}

                <details className="mall-admin-cover-manual-details">
                  <summary>手动填写图片地址</summary>
                  <input
                    onChange={(event) => handleDetailImageDraftChange(item.localId, 'imageUrl', event.target.value)}
                    placeholder="可选：粘贴图片地址或上传后自动回填的路径"
                    value={item.imageUrl}
                  />
                </details>

                <div className="mall-admin-promo-fields">
                  <label className="admin-resource-field">
                    <span>图片标题</span>
                    <input
                      onChange={(event) => handleDetailImageDraftChange(item.localId, 'title', event.target.value)}
                      placeholder={sectionMeta.titlePlaceholder}
                      value={item.title}
                    />
                  </label>
                  <label className="admin-resource-field">
                    <span>排序</span>
                    <input
                      onChange={(event) => handleDetailImageDraftChange(item.localId, 'sortOrder', event.target.value)}
                      placeholder={String(index)}
                      type="number"
                      value={item.sortOrder}
                    />
                  </label>
                </div>

                <label className="admin-resource-field mall-admin-form-field-wide">
                  <span>说明文案</span>
                  <textarea
                    onChange={(event) => handleDetailImageDraftChange(item.localId, 'description', event.target.value)}
                    placeholder={sectionMeta.descriptionPlaceholder}
                    value={item.description}
                  />
                </label>

                <label className="mall-admin-checkbox-field mall-admin-promo-enabled">
                  <input
                    checked={item.isEnabled}
                    onChange={(event) => handleDetailImageDraftChange(item.localId, 'isEnabled', event.target.checked)}
                    type="checkbox"
                  />
                  <span>{enabledLabel}</span>
                </label>
              </article>
            ))}
          </div>
        ) : (
          <div className="mall-admin-media-empty">{sectionMeta.emptyStateText}</div>
        )}
      </section>
    )
  }

  async function handleOrderStatusSubmit(orderId: string, status: 'PAID' | 'CLOSED') {
    if (!mallStoreId || savingOrderId) {
      return
    }

    setSavingOrderId(orderId)
    setError('')
    setNotice('')

    try {
      await updateAdminMallOrderStatus({
        storeId: mallStoreId,
        orderId,
        status,
      })
      setNotice(status === 'PAID' ? '订单已标记为已支付' : '订单已关闭')
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新订单状态失败')
    } finally {
      setSavingOrderId('')
    }
  }

  function handleShippingDraftChange(orderId: string, field: ShippingDraftField, value: string) {
    setShippingDrafts((currentDrafts) => ({
      ...currentDrafts,
      [orderId]: {
        ...(currentDrafts[orderId] || createShippingDraft()),
        [field]: value,
      },
    }))
  }

  async function handleShipSubmit(orderId: string) {
    if (!mallStoreId || savingOrderId) {
      return
    }

    const draft = shippingDrafts[orderId] || createShippingDraft()
    const shippingCompany = draft.shippingCompany.trim()
    const shippingTrackingNo = draft.shippingTrackingNo.trim()
    const shippingRemark = draft.shippingRemark.trim()
    const targetOrder = orders.find((item) => item.id === orderId)

    if (!shippingCompany) {
      setError('请输入物流公司')
      return
    }

    if (!shippingTrackingNo) {
      setError('请输入物流单号')
      return
    }

    setSavingOrderId(orderId)
    setError('')
    setNotice('')

    try {
      await shipAdminMallOrder({
        storeId: mallStoreId,
        orderId,
        shippingCompany,
        shippingTrackingNo,
        shippingRemark,
      })
      setNotice(targetOrder?.shippingStatus === 'SHIPPED' ? '物流信息已更新' : '订单已发货')
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '发货失败')
    } finally {
      setSavingOrderId('')
    }
  }

  async function handleRefundReview(order: AdminMallOrderItem, action: 'APPROVE' | 'REJECT') {
    if (!mallStoreId || savingOrderId) {
      return
    }

    const reviewRemark = window.prompt(
      action === 'APPROVE' ? '请输入退款说明，可留空。' : '请输入驳回说明，可留空。',
      action === 'APPROVE' ? order.refundReason || '同意退款' : '',
    )

    if (reviewRemark === null) {
      return
    }

    setSavingOrderId(order.id)
    setError('')
    setNotice('')

    try {
      await reviewAdminMallOrderRefund({
        storeId: mallStoreId,
        orderId: order.id,
        action,
        reviewRemark,
      })
      setNotice(action === 'APPROVE' ? '退款已处理' : '退款申请已驳回')
      setReloadKey((currentValue) => currentValue + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '处理退款失败')
    } finally {
      setSavingOrderId('')
    }
  }

  async function handleCopyOrderInspectionRecord() {
    if (!orderInspectionRecordText.trim()) {
      setNotice('当前没有可复制的验收文本')
      return
    }

    setNotice('')

    try {
      await navigator.clipboard.writeText(orderInspectionRecordText)
      setNotice('验收留档文本已复制')
    } catch {
      setNotice('复制失败，请手动复制当前验收文本')
    }
  }

  async function handleCopyOrderInspectionConclusion() {
    if (!orderInspectionConclusion.text.trim()) {
      setNotice('当前没有可复制的验收结论')
      return
    }

    setNotice('')

    try {
      await navigator.clipboard.writeText(orderInspectionConclusion.text)
      setNotice('验收结论已复制')
    } catch {
      setNotice('复制失败，请手动复制当前验收结论')
    }
  }

  async function handleCopyCombinedInspectionConclusion() {
    if (!combinedInspectionConclusion.text.trim()) {
      setNotice('当前没有可复制的联合验收结论')
      return
    }

    setNotice('')

    try {
      await navigator.clipboard.writeText(combinedInspectionConclusion.text)
      setNotice('联合验收结论已复制')
    } catch {
      setNotice('复制失败，请手动复制当前联合验收结论')
    }
  }

  async function handleCopyCombinedInspectionBrief() {
    if (!combinedInspectionBrief.text.trim()) {
      setNotice('当前没有可复制的短版摘要')
      return
    }

    setNotice('')

    try {
      await navigator.clipboard.writeText(combinedInspectionBrief.text)
      setNotice('短版联合摘要已复制')
    } catch {
      setNotice('复制失败，请手动复制当前短版摘要')
    }
  }

  return (
    <AdminLayout
      title={managementSectionMeta.title}
      subtitle={mallStoreId ? `${mallDisplayName} · ${managementSectionMeta.subtitle}` : managementSectionMeta.subtitle}
      tag={managementSectionMeta.tag}
      breadcrumb="独立商城平台"
      menuGroups={mallPlatformMenuGroups}
      brandName="血饮商城"
      brandTag="独立商城后台"
      brandLogo="M"
      hideGroupPicker
      hideTopbarAction
      preserveGroupQuery={false}
    >
      <div className="admin-resource-page mall-admin-page">
        {notice ? <div className="mall-admin-banner is-success">{notice}</div> : null}
        {error ? <div className="mall-admin-banner is-error">{error}</div> : null}
        {publicMallBanner ? <div className={`mall-admin-banner ${publicMallBanner.tone}`}>{publicMallBanner.text}</div> : null}

        {mallConfigLoading || loading ? (
          <div className="admin-resource-empty">正在加载商城管理数据...</div>
        ) : null}

        {!mallConfigLoading && !loading && mallStoreId ? (
          <>
            <section className="mall-admin-grid is-single-column">
              {showPanelStack ? (
                <div className="mall-admin-panel-stack">
                  {showCategoryPanel ? (
                <article className="admin-resource-panel">
                  <div className="mall-admin-section-head">
                    <div>
                      <h3>分类管理</h3>
                      <p>只保留名称、排序、启停状态，不做多级分类。</p>
                    </div>
                    {categoryForm.categoryId ? (
                      <button
                        className="admin-resource-ghost"
                        onClick={() => setCategoryForm(createEmptyCategoryForm())}
                        type="button"
                      >
                        取消编辑
                      </button>
                    ) : null}
                  </div>

                  <form className="mall-admin-form-grid mall-admin-mini-grid" onSubmit={handleCategorySubmit}>
                    <label className="admin-resource-field">
                      <span>分类名称</span>
                      <input
                        onChange={(event) => setCategoryForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                        placeholder="例如：数码、家居、课程周边"
                        value={categoryForm.name}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>排序值</span>
                      <input
                        onChange={(event) => setCategoryForm((currentForm) => ({ ...currentForm, sortOrder: event.target.value }))}
                        placeholder="0"
                        type="number"
                        value={categoryForm.sortOrder}
                      />
                    </label>
                    <label className="mall-admin-checkbox-field">
                      <input
                        checked={categoryForm.isEnabled}
                        onChange={(event) => setCategoryForm((currentForm) => ({ ...currentForm, isEnabled: event.target.checked }))}
                        type="checkbox"
                      />
                      <span>分类启用</span>
                    </label>
                    <div className="mall-admin-form-actions">
                      <button className="admin-resource-submit" disabled={savingCategory} type="submit">
                        {savingCategory ? '保存中...' : categoryForm.categoryId ? '更新分类' : '新增分类'}
                      </button>
                    </div>
                  </form>

                  <div className="resource-table mall-admin-category-table">
                    <div className="resource-table-row resource-table-head mall-admin-category-row">
                      <span>分类</span>
                      <span>商品数</span>
                      <span>排序</span>
                      <span>状态</span>
                      <span>操作</span>
                    </div>
                    {categories.map((item) => (
                      <div className="resource-table-row mall-admin-category-row" key={item.id}>
                        <span className="resource-table-strong">
                          <span>{item.name}</span>
                          <em>{formatDateTime(item.updatedAt)}</em>
                        </span>
                        <span>{item.productCount}</span>
                        <span>{item.sortOrder}</span>
                        <span>
                          <span className={`resource-table-chip ${item.isEnabled ? 'is-success' : 'is-muted'}`}>
                            {item.isEnabled ? '启用中' : '已停用'}
                          </span>
                        </span>
                        <span>
                          <button
                            className="admin-resource-ghost"
                            onClick={() =>
                              setCategoryForm({
                                categoryId: item.id,
                                name: item.name,
                                sortOrder: String(item.sortOrder),
                                isEnabled: item.isEnabled,
                              })
                            }
                            type="button"
                          >
                            编辑
                          </button>
                        </span>
                      </div>
                    ))}
                    {!categories.length ? <div className="admin-resource-empty">还没有分类，先创建一个就能开始挂商品。</div> : null}
                  </div>
                </article>
                  ) : null}

                  {showProductPanel ? (
                <article className="admin-resource-panel">
                  <div className="mall-admin-section-head">
                    <div>
                      <h3>商品管理</h3>
                      <p>同一处维护商品基础信息、商品卡头图、顶部轮播图，以及详情页正文里的宣传海报图。</p>
                    </div>
                  </div>

                  <div className="mall-admin-membership-note">
                    <strong>会员商品轻量规则</strong>
                    <p>标题或商品简介包含“会员价 / 会员优惠”，且原价高于售价时，小程序前台会把“售价”识别为会员价、“原价”识别为非会员价。</p>
                    <p>标题或商品简介包含“会员专享 / 会员专属 / 会员限定”时，小程序前台会识别为会员专享商品，非会员可浏览但不可加购和下单。</p>
                  </div>

                  <form className="mall-admin-form-grid" onSubmit={handleProductSubmit}>
                    <label className="admin-resource-field">
                      <span>所属分类</span>
                      <select
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, categoryId: event.target.value }))}
                        value={productForm.categoryId}
                      >
                        {!categoryOptions.length ? <option value="">请先创建分类</option> : null}
                        {categoryOptions.map((item) => (
                          <option disabled={!item.isEnabled} key={item.id} value={item.id}>
                            {item.name}
                            {item.isEnabled ? '' : '（已停用）'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-resource-field">
                      <span>商品标题</span>
                      <input
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, title: event.target.value }))}
                        placeholder="例如：Apple iPhone 15 128G"
                        value={productForm.title}
                      />
                    </label>
                    <label className="admin-resource-field mall-admin-form-field-wide">
                      <span>商品简介</span>
                      <input
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, subtitle: event.target.value }))}
                        placeholder="一句话说明商品卖点，先不做复杂详情。"
                        value={productForm.subtitle}
                      />
                    </label>
                    <div className="admin-resource-field mall-admin-form-field-wide">
                      <span>商品头图 / 顶部轮播兜底图</span>
                      <div className="mall-admin-cover-asset-panel">
                        <div className="mall-admin-cover-asset-main">
                          <div className="mall-admin-cover-asset-preview">
                            {productCoverPreviewUrl ? (
                              <img alt="商品封面预览" src={productCoverPreviewUrl} />
                            ) : (
                              <div className="mall-admin-cover-asset-fallback">{productCoverFallbackText}</div>
                            )}
                          </div>
                          <div className="mall-admin-cover-asset-meta">
                            <strong>{productCoverPreviewUrl ? '头图已就绪' : '先上传一张商品头图'}</strong>
                            <p>这张图默认用于 web 商城和小程序商品卡片；如果还没单独配置顶部轮播，小程序详情页顶部也会先回退到这张图。</p>
                            <div className="mall-admin-cover-asset-actions">
                              <button className="admin-resource-ghost" disabled={uploadingCover} onClick={handleCoverUploadTrigger} type="button">
                                {uploadingCover ? '上传中...' : productCoverPreviewUrl ? '更换图片' : '上传图片'}
                              </button>
                              {productForm.coverImageUrl ? (
                                <button
                                  className="admin-resource-ghost is-danger"
                                  onClick={() => setProductForm((currentForm) => ({ ...currentForm, coverImageUrl: '' }))}
                                  type="button"
                                >
                                  清空头图
                                </button>
                              ) : null}
                            </div>
                            <details className="mall-admin-cover-manual-details">
                              <summary>手动填写头图地址</summary>
                              <input
                                onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, coverImageUrl: event.target.value }))}
                                placeholder="可选：粘贴商品头图地址或上传后自动回填的路径"
                                value={productForm.coverImageUrl}
                              />
                            </details>
                          </div>
                        </div>

                        <div className="mall-admin-surface-preview-grid">
                          <article className="mall-admin-surface-preview is-web">
                            <div className="mall-admin-surface-preview-head">Web 商城预览</div>
                            <div className="mall-admin-surface-web-card">
                              <div className="mall-admin-surface-web-media">
                                {productCoverPreviewUrl ? (
                                  <img alt="Web 商城商品预览" src={productCoverPreviewUrl} />
                                ) : (
                                  <div className="mall-admin-surface-web-fallback">{productCoverFallbackText}</div>
                                )}
                              </div>
                              <div className="mall-admin-surface-web-copy">
                                <strong>{productPreviewTitle}</strong>
                                <p>{productPreviewSubtitle}</p>
                                <div className="mall-admin-surface-price-row">
                                  <span>{productPreviewPrice}</span>
                                  <em>{productPreviewOriginalPrice}</em>
                                </div>
                              </div>
                            </div>
                          </article>

                          <article className="mall-admin-surface-preview is-miniapp">
                            <div className="mall-admin-surface-preview-head">小程序商品预览</div>
                            <div className="mall-admin-surface-mini-card">
                              <div className="mall-admin-surface-mini-media">
                                {productCoverPreviewUrl ? (
                                  <img alt="小程序商品预览" src={productCoverPreviewUrl} />
                                ) : (
                                  <div className="mall-admin-surface-mini-fallback">{productCoverFallbackText}</div>
                                )}
                              </div>
                              <div className="mall-admin-surface-mini-copy">
                                <strong>{productPreviewTitle}</strong>
                                <span>{productPreviewSubtitle}</span>
                                <div className="mall-admin-surface-price-row">
                                  <span>{productPreviewPrice}</span>
                                  <em>{productPreviewOriginalPrice}</em>
                                </div>
                              </div>
                            </div>
                          </article>
                        </div>
                      </div>
                    </div>
                    <label className="admin-resource-field">
                      <span>售价</span>
                      <input
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, price: event.target.value }))}
                        placeholder="0.00"
                        type="number"
                        value={productForm.price}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>原价</span>
                      <input
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, originalPrice: event.target.value }))}
                        placeholder="0.00"
                        type="number"
                        value={productForm.originalPrice}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>库存</span>
                      <input
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, stock: event.target.value }))}
                        placeholder="0"
                        type="number"
                        value={productForm.stock}
                      />
                    </label>
                    <label className="admin-resource-field">
                      <span>排序值</span>
                      <input
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, sortOrder: event.target.value }))}
                        placeholder="0"
                        type="number"
                        value={productForm.sortOrder}
                      />
                    </label>
                    <label className="mall-admin-checkbox-field">
                      <input
                        checked={productForm.isOnSale}
                        onChange={(event) => setProductForm((currentForm) => ({ ...currentForm, isOnSale: event.target.checked }))}
                        type="checkbox"
                      />
                      <span>上架销售</span>
                    </label>
                    <div className="mall-admin-form-actions">
                      {productForm.productId ? (
                        <>
                          <button
                            className="admin-resource-ghost"
                            disabled={showProductMediaEditor && detailImageProductId === productForm.productId}
                            onClick={handleOpenEditingProductMediaEditor}
                            type="button"
                          >
                            编辑媒体图
                          </button>
                          <button className="admin-resource-ghost" onClick={handleResetProductForm} type="button">
                            取消编辑
                          </button>
                        </>
                      ) : null}
                      <button className="admin-resource-submit" disabled={savingProduct} type="submit">
                        {savingProduct ? '保存中...' : productForm.productId ? '更新商品' : '新增商品'}
                      </button>
                    </div>
                  </form>

                  <div className="resource-table mall-admin-product-table">
                    <div className="resource-table-row resource-table-head mall-admin-product-row">
                      <span>商品</span>
                      <span>售价</span>
                      <span>库存</span>
                      <span>状态</span>
                      <span>排序</span>
                      <span>更新时间</span>
                      <span>操作</span>
                    </div>
                    {products.map((item) => (
                      <div className="resource-table-row mall-admin-product-row" key={item.id}>
                        <span className="mall-admin-product-cell">
                          <span className="mall-admin-cover-preview">
                            {item.coverImageUrl ? <img alt={item.title} src={resolveAdminMallAssetUrl(item.coverImageUrl)} /> : item.coverFallbackText}
                          </span>
                          <span className="resource-table-strong">
                            <span>{item.title}</span>
                            <em>{`${item.categoryName} · 原价 ¥${item.originalPriceText}`}</em>
                          </span>
                        </span>
                        <span>¥{item.priceText}</span>
                        <span>{item.stock}</span>
                        <span>
                          <span className={`resource-table-chip ${item.isOnSale ? 'is-success' : 'is-muted'}`}>
                            {item.isOnSale ? '在售' : '下架'}
                          </span>
                        </span>
                        <span>{item.sortOrder}</span>
                        <span>{formatDateTime(item.updatedAt)}</span>
                        <span>
                          <div className="resource-table-inline-actions mall-admin-product-actions">
                            <button className="admin-resource-ghost" onClick={() => handleEditProduct(item)} type="button">
                              编辑商品
                            </button>
                            <button
                              className={showProductMediaEditor && detailImageProductId === item.id ? 'admin-resource-submit' : 'admin-resource-ghost'}
                              onClick={() => handleOpenProductMediaEditor(item)}
                              type="button"
                            >
                              {showProductMediaEditor && detailImageProductId === item.id ? '编辑中' : '编辑媒体图'}
                            </button>
                          </div>
                        </span>
                      </div>
                    ))}
                    {!products.length ? <div className="admin-resource-empty">还没有商品，新增一条后小程序商城页就能读取。</div> : null}
                  </div>
                  {showProductMediaEditor ? (
                    <section className="mall-admin-product-media-section">
                      <div className="mall-admin-section-head">
                        <div>
                          <h3>商品轮播与宣传图</h3>
                          <p>当前给 {detailImageProductTitle || '这件商品'} 分开维护顶部轮播图和宣传海报图，不再混成同一组内容。</p>
                        </div>
                        <div className="mall-admin-promo-toolbar-actions">
                          <button
                            className="admin-resource-ghost"
                            onClick={() => setShowProductMediaEditor(false)}
                            type="button"
                          >
                            收起
                          </button>
                        </div>
                      </div>

                      {!products.length ? (
                        <div className="admin-resource-empty">先新增商品，再补商品轮播和宣传图。</div>
                      ) : (
                        <>
                          <div className="mall-admin-promo-toolbar">
                            <label className="admin-resource-field mall-admin-promo-product-field">
                              <span>当前商品</span>
                              <select
                                onChange={(event) => {
                                  const nextProductId = event.target.value
                                  setDetailImageProductId(nextProductId)
                                  setDetailImageProductTitle(products.find((item) => item.id === nextProductId)?.title || '')
                                }}
                                value={detailImageProductId}
                              >
                                {products.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="mall-admin-promo-summary">
                              <strong>{detailImageProductTitle || '未选择商品'}</strong>
                              <span>
                                {detailImagesLoading
                                  ? '商品媒体图加载中...'
                                  : productForm.productId && productForm.productId === detailImageProductId
                                    ? `当前正在编辑这件商品，顶部轮播 ${carouselConfiguredCount} 张，宣传海报 ${promotionConfiguredCount} 张。`
                                    : `已配置顶部轮播 ${carouselConfiguredCount} 张，宣传海报 ${promotionConfiguredCount} 张，共 ${detailImageConfiguredCount} 张。`}
                              </span>
                            </div>
                            <div className="mall-admin-promo-toolbar-actions">
                              <button
                                className="admin-resource-ghost"
                                disabled={!activeProductMediaCoverUrl || detailImagesLoading || savingDetailImages}
                                onClick={handleUseCoverAsFirstDetailImage}
                                type="button"
                              >
                                头图填入首张轮播图
                              </button>
                              <button
                                className="admin-resource-submit"
                                disabled={detailImagesLoading || savingDetailImages || !detailImageProductId}
                                onClick={handleDetailImagesSubmit}
                                type="button"
                              >
                                {savingDetailImages ? '保存中...' : '保存商品媒体图'}
                              </button>
                            </div>
                          </div>

                          {detailImagesLoading ? (
                            <div className="admin-resource-empty">正在加载商品媒体图...</div>
                          ) : (
                            <div className="mall-admin-media-groups">
                              {renderProductMediaDraftGroup('CAROUSEL', carouselImageDrafts)}
                              {renderProductMediaDraftGroup('PROMOTION', promotionImageDrafts)}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  ) : products.length ? (
                    <div className="mall-admin-product-media-hint">
                      商品媒体图已收起。点商品列表右侧的“编辑媒体图”，再分别维护顶部轮播图和宣传海报图。
                    </div>
                  ) : null}
                </article>
                  ) : null}
                </div>
              ) : null}

              {showMemberZonePanel ? (
                <article className="admin-resource-panel">
                  <div className="mall-admin-section-head">
                    <div>
                      <h3>会员专区配置</h3>
                      <p>把会员专区标题、承接文案、商品集合和排序策略开放给运营直接维护，不再写死在后端常量里。</p>
                    </div>
                  </div>

                  <div className="mall-admin-membership-note">
                    <strong>当前技术实现</strong>
                    <p>这份配置会保存到当前商城分组的 metadata 里，并由小程序 `store/search` 的会员专区直接读取。</p>
                    <p>如果不手动指定商品 ID，小程序前台会自动承接所有被识别为会员商品的在售商品；如果指定了商品 ID，则优先按这里的清单收敛范围。</p>
                  </div>

                  {memberZoneConfigLoading ? (
                    <div className="admin-resource-empty">正在加载会员专区配置...</div>
                  ) : null}

                  {!memberZoneConfigLoading && memberZoneConfigError ? (
                    <div className="mall-admin-banner is-error">{memberZoneConfigError}</div>
                  ) : null}

                  {!memberZoneConfigLoading && !memberZoneConfigError ? (
                    <form onSubmit={handleMemberZoneSubmit}>
                      <div className="mall-admin-form-grid">
                        <label className="admin-resource-field">
                          <span>专区标题</span>
                          <input
                            onChange={(event) => handleMemberZoneFieldChange('title', event.target.value)}
                            placeholder="例如：会员商品专区"
                            value={memberZoneForm.title}
                          />
                        </label>
                        <label className="admin-resource-field">
                          <span>徽标文案</span>
                          <input
                            onChange={(event) => handleMemberZoneFieldChange('badgeText', event.target.value)}
                            placeholder="例如：会员权益商品"
                            value={memberZoneForm.badgeText}
                          />
                        </label>
                        <label className="admin-resource-field">
                          <span>排序策略</span>
                          <select
                            onChange={(event) => handleMemberZoneSortModeChange(event.target.value as AdminMallMemberZoneSortMode)}
                            value={memberZoneForm.sortMode}
                          >
                            {MEMBER_ZONE_SORT_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-resource-field mall-admin-form-field-wide">
                          <span>副标题</span>
                          <input
                            onChange={(event) => handleMemberZoneFieldChange('subtitle', event.target.value)}
                            placeholder="一句话说明会员专区价值"
                            value={memberZoneForm.subtitle}
                          />
                        </label>
                        <label className="admin-resource-field mall-admin-form-field-wide">
                          <span>高亮提示</span>
                          <textarea
                            onChange={(event) => handleMemberZoneFieldChange('highlightText', event.target.value)}
                            placeholder="例如：默认优先展示会员专享商品，再展示会员价商品。"
                            value={memberZoneForm.highlightText}
                          />
                        </label>
                        <label className="admin-resource-field">
                          <span>空状态标题</span>
                          <input
                            onChange={(event) => handleMemberZoneFieldChange('emptyTitle', event.target.value)}
                            placeholder="例如：会员商品专区暂未上架"
                            value={memberZoneForm.emptyTitle}
                          />
                        </label>
                        <label className="admin-resource-field mall-admin-form-field-wide">
                          <span>空状态说明</span>
                          <input
                            onChange={(event) => handleMemberZoneFieldChange('emptySubtitle', event.target.value)}
                            placeholder="例如：请先给商品配置会员价或会员专享权益。"
                            value={memberZoneForm.emptySubtitle}
                          />
                        </label>
                      </div>

                      <div className="mall-admin-membership-note">
                        <strong>当前预览</strong>
                        <p>{`${memberZoneForm.title || '会员专区标题未填写'} · ${memberZoneForm.badgeText || '徽标未填写'}`}</p>
                        <p>{memberZoneForm.subtitle || '副标题未填写，建议说明会员专区适合什么人购买。'}</p>
                        <p>{`排序策略：${memberZoneSortLabel}。${memberZoneSortDescription}`}</p>
                        <p>
                          {memberZoneForm.productIds.length
                            ? `当前手动指定 ${memberZoneForm.productIds.length} 个商品 ID，已匹配 ${memberZoneSelectedProducts.length} 个当前可用会员商品。`
                            : '当前没有手动指定商品 ID，小程序会自动承接所有被识别为会员商品的在售商品。'}
                        </p>
                        {memberZoneMissingProductIds.length ? (
                          <p>{`有 ${memberZoneMissingProductIds.length} 个商品 ID 当前不在“已识别会员商品”列表里，保存时会自动清洗无效项。`}</p>
                        ) : null}
                        {memberZoneIgnoredProductIds.length ? (
                          <p>{`最近一次保存已忽略 ${memberZoneIgnoredProductIds.length} 个无效商品 ID：${memberZoneIgnoredProductIds.join('、')}`}</p>
                        ) : null}
                      </div>

                      <div className="mall-admin-section-head">
                        <div>
                          <h3>指定商品集合</h3>
                          <p>支持直接贴商品 ID，也支持从下方已识别的会员商品里快速点选。</p>
                        </div>
                        <div className="mall-admin-form-actions">
                          <button className="admin-resource-ghost" onClick={handleUseDetectedMemberProducts} type="button">
                            带入当前会员商品
                          </button>
                          <button className="admin-resource-ghost is-danger" onClick={handleClearMemberZoneProducts} type="button">
                            改为自动承接
                          </button>
                        </div>
                      </div>

                      <label className="admin-resource-field mall-admin-form-field-wide">
                        <span>商品 ID 列表</span>
                        <textarea
                          onChange={(event) => handleMemberZoneProductIdsTextChange(event.target.value)}
                          placeholder="每行一个商品 ID；留空时会自动承接所有会员商品"
                          value={memberZoneProductIdsText}
                        />
                      </label>

                      <div className="resource-table mall-admin-category-table">
                        <div className="resource-table-row resource-table-head mall-admin-category-row">
                          <span>商品</span>
                          <span>会员识别</span>
                          <span>价格</span>
                          <span>库存</span>
                          <span>操作</span>
                        </div>
                        {memberZoneSelectableProducts.map((item) => (
                          <div className="resource-table-row mall-admin-category-row" key={item.id}>
                            <span className="resource-table-strong">
                              <span>{item.title}</span>
                              <em>{item.id}</em>
                            </span>
                            <span>
                              <span className={`resource-table-chip ${item.memberBenefitType === 'MEMBER_EXCLUSIVE' ? 'is-success' : 'is-warning'}`}>
                                {item.memberBenefitLabel}
                              </span>
                            </span>
                            <span>{`${item.priceText} / 原价 ${item.originalPriceText || '¥0.00'}`}</span>
                            <span>{item.stock}</span>
                            <span>
                              <button
                                className={`admin-resource-ghost ${memberZoneSelectedProductIdSet.has(item.id) ? 'is-danger' : ''}`}
                                onClick={() => handleToggleMemberZoneProduct(item.id)}
                                type="button"
                              >
                                {memberZoneSelectedProductIdSet.has(item.id) ? '移出专区' : '加入专区'}
                              </button>
                            </span>
                          </div>
                        ))}
                        {!memberZoneSelectableProducts.length ? (
                          <div className="admin-resource-empty">当前还没有被系统识别为会员商品的在售商品，请先在商品标题 / 简介里补会员关键词。</div>
                        ) : null}
                      </div>

                      <div className="mall-admin-form-actions">
                        <button className="admin-resource-submit" disabled={savingMemberZoneConfig} type="submit">
                          {savingMemberZoneConfig ? '保存中...' : '保存会员专区配置'}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              ) : null}

              {showCouponAnalyticsPanel ? (
                <article className="admin-resource-panel">
                  <div className="mall-admin-section-head">
                    <div>
                      <h3>优惠券分析</h3>
                      <p>围绕优惠券曝光、自动命中、券抵扣、会员让利和总优惠，判断优惠券到底有没有带来真实成交。</p>
                    </div>
                  </div>

                  <div className="mall-admin-membership-note">
                    <strong>当前口径说明</strong>
                    <p>`COUPON_IMPRESSION` 代表优惠券模块被看到，`COUPON_AUTO_APPLY` 代表系统自动命中最优券，`CHECKOUT_SUBMIT` 和 `PAYMENT_SUCCESS` 只统计真正带券的提交与支付。</p>
                    <p>当前已把会员优惠叠加信息一起纳入统计，所以能看到“券抵扣”之外，带券支付里还叠了多少会员让利，以及用户最终感知到的总优惠。</p>
                    <p>本轮已补按日趋势和按选券方式拆分，但仍基于现有埋点做轻量聚合，不是完整经营报表系统。</p>
                    {couponAnalyticsCompatibilitySummary ? (
                      <>
                        <p>
                          {`当前区间共有 ${couponAnalyticsCompatibilitySummary.totalEventCount} 条优惠券相关埋点，其中 ${couponAnalyticsCompatibilitySummary.explicitSelectionModeCount} 条已显式记录选券方式，覆盖率 ${couponAnalyticsCompatibilitySummary.explicitSelectionCoverageRateText}；另有 ${couponAnalyticsCompatibilitySummary.legacyCompatibleEventCount} 条仍处于旧口径兼容区，占比 ${couponAnalyticsCompatibilitySummary.legacyCompatibleRateText}。`}
                        </p>
                        <span className="resource-table-chip-row">
                          <span className="resource-table-chip is-success">{`显式选券方式 ${couponAnalyticsCompatibilitySummary.explicitSelectionModeCount}`}</span>
                          <span className="resource-table-chip is-warning">{`旧埋点推断 ${couponAnalyticsCompatibilitySummary.inferredSelectionModeCount}`}</span>
                          <span
                            className={`resource-table-chip ${
                              couponAnalyticsCompatibilitySummary.unknownSelectionModeCount ? 'is-danger' : 'is-muted'
                            }`}
                          >
                            {`仍未识别 ${couponAnalyticsCompatibilitySummary.unknownSelectionModeCount}`}
                          </span>
                          <span className="resource-table-chip is-muted">{`明确不用券 ${couponAnalyticsCompatibilitySummary.explicitNoneSelectionCount}`}</span>
                        </span>
                        <p>推断规则会优先读取 `couponSelectionMode`；如果旧埋点缺失该字段，则 `couponManualSelected` 归为“手动选券”，`couponAutoApplied` 或 `COUPON_AUTO_APPLY` 归为“自动匹配”，只看到 `couponApplied` 时则保守兜底为“自动匹配”。</p>
                        <p>
                          {`当前手动推断 ${couponAnalyticsCompatibilitySummary.inferredManualSelectionCount} 条，自动推断 ${couponAnalyticsCompatibilitySummary.inferredAutoSelectionCount} 条，仅凭带券事实兜底 ${couponAnalyticsCompatibilitySummary.inferredAppliedFallbackCount} 条。历史旧埋点无法反推出“明确不用券”，所以该指标目前只统计新口径显式上报。`}
                        </p>
                        {couponAnalyticsCompatibilitySummary.invalidSelectionModeCount ? (
                          <p>
                            {`另有 ${couponAnalyticsCompatibilitySummary.invalidSelectionModeCount} 条埋点带了异常的选券方式值，当前已按兼容规则保守处理。`}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <div className="mall-shipping-toolbar">
                    <div className="mall-shipping-filter-row">
                      {COUPON_ANALYTICS_RANGE_OPTIONS.map((item) => (
                        <button
                          key={item.value}
                          className={`mall-shipping-filter-chip ${couponAnalyticsDays === item.value ? 'is-active' : ''}`}
                          onClick={() => setCouponAnalyticsDays(item.value)}
                          type="button"
                        >
                          <span>{item.label}</span>
                          <small>{item.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  {couponAnalyticsLoading ? (
                    <div className="admin-resource-empty">正在加载优惠券分析数据...</div>
                  ) : null}

                  {!couponAnalyticsLoading && couponAnalyticsError ? (
                    <div className="mall-admin-banner is-error">{couponAnalyticsError}</div>
                  ) : null}

                  {!couponAnalyticsLoading && !couponAnalyticsError && couponAnalyticsSummary ? (
                    <div className="mall-coupon-analytics-stack">
                      <div className="mall-coupon-analytics-meta">
                        <strong>{`最近 ${couponAnalyticsSummary.rangeDays} 天共纳入 ${couponAnalyticsSummary.eventSampleSize} 条优惠券相关埋点`}</strong>
                        <span>
                          {couponAnalyticsSummary.lastEventAt
                            ? `最后一次优惠券相关行为发生在 ${formatDateTime(couponAnalyticsSummary.lastEventAt)}`
                            : '当前时间范围内还没有优惠券相关埋点'}
                        </span>
                      </div>

                      <div className="mall-coupon-analytics-summary-grid">
                        {couponAnalyticsSummaryCards.map((item) => (
                          <article className="mall-coupon-analytics-summary-card" key={item.key}>
                            <span className="mall-coupon-analytics-summary-label">{item.label}</span>
                            <strong className="mall-coupon-analytics-summary-value">{item.value}</strong>
                            <span className="mall-coupon-analytics-summary-hint">{item.hint}</span>
                          </article>
                        ))}
                      </div>

                      {couponAnalyticsQualityCards.length ? (
                        <section className="mall-coupon-analytics-card">
                          <div className="mall-admin-section-head">
                            <div>
                              <h3>验收前只读校验</h3>
                              <p>数据库联调恢复前，先看样本有没有触顶、字段有没有缺失，再决定能不能把当前趋势直接当经营结论。</p>
                            </div>
                          </div>

                          <div className="mall-coupon-analytics-breakdown-grid">
                            {couponAnalyticsQualityCards.map((item) => (
                              <article className="mall-coupon-analytics-breakdown-card" key={item.key}>
                                <div className="mall-coupon-analytics-breakdown-head">
                                  <strong>{item.label}</strong>
                                  <span className={`resource-table-chip ${item.chipClass}`}>{item.badge}</span>
                                </div>
                                <div className="mall-coupon-analytics-breakdown-metrics">
                                  {item.metrics.map((metric) => (
                                    <span key={metric}>{metric}</span>
                                  ))}
                                </div>
                                <div className="mall-coupon-analytics-breakdown-hint">{item.hint}</div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <section className="mall-coupon-analytics-card">
                        <div className="mall-admin-section-head">
                          <div>
                            <h3>按日趋势看</h3>
                            <p>切换不同指标，观察带券支付、总优惠和叠加支付有没有形成连续趋势。</p>
                          </div>
                        </div>

                        <div className="analytics-metric-tabs">
                          {COUPON_ANALYTICS_TREND_METRIC_OPTIONS.map((item) => (
                            <button
                              className={couponTrendMetric.key === item.key ? 'is-active' : ''}
                              key={item.key}
                              onClick={() => setCouponTrendMetricKey(item.key)}
                              type="button"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        {couponAnalytics && couponAnalytics.dailyTrend.length && couponTrendSelectedItem ? (
                          <div className="analytics-focus-grid mall-coupon-analytics-trend-grid">
                            <article className="analytics-focus-card">
                              <div className="mall-coupon-analytics-trend-scroll">
                                <div
                                  className="analytics-trend-chart mall-coupon-analytics-trend-chart"
                                  style={{
                                    gridTemplateColumns: `repeat(${Math.max(couponAnalytics.dailyTrend.length, 1)}, minmax(64px, 1fr))`,
                                    minWidth: `${Math.max(couponAnalytics.dailyTrend.length * 76, 320)}px`,
                                  }}
                                >
                                  {couponAnalytics.dailyTrend.map((item) => {
                                    const value = Number(item[couponTrendMetric.key] || 0)
                                    const barHeight = Math.max((value / couponTrendMaxValue) * 146, value ? 18 : 8)
                                    return (
                                      <button
                                        className={`analytics-trend-column${couponTrendSelectedItem.date === item.date ? ' is-active' : ''}`}
                                        key={item.date}
                                        onClick={() => setCouponTrendSelectedDate(item.date)}
                                        type="button"
                                      >
                                        <span className="analytics-trend-value">
                                          {formatCouponTrendMetricValue(value, couponTrendMetric.format)}
                                        </span>
                                        <div className="analytics-trend-bar-shell">
                                          <div className="analytics-trend-bar" style={{ height: `${barHeight}px` }} />
                                        </div>
                                        <span className="analytics-trend-label">{item.label}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </article>

                            <article className="analytics-focus-card analytics-breakdown-card">
                              <div className="analytics-breakdown-kicker">{couponTrendSelectedItem.label}</div>
                              <div className="analytics-breakdown-value">
                                {formatCouponTrendMetricValue(
                                  couponTrendSelectedItem[couponTrendMetric.key] || 0,
                                  couponTrendMetric.format,
                                )}
                              </div>
                              <div className="analytics-breakdown-hint">{couponTrendMetric.hint}</div>

                              <div className="analytics-breakdown-summary">
                                <div className="analytics-breakdown-summary-card">
                                  <span>区间峰值</span>
                                  <strong>
                                    {couponTrendPeakItem
                                      ? formatCouponTrendMetricValue(
                                          couponTrendPeakItem[couponTrendMetric.key] || 0,
                                          couponTrendMetric.format,
                                        )
                                      : '-'}
                                  </strong>
                                  <em>{couponTrendPeakItem?.label || '暂无样本'}</em>
                                </div>
                                <div className="analytics-breakdown-summary-card">
                                  <span>区间均值</span>
                                  <strong>{formatCouponTrendMetricValue(couponTrendAverageValue, couponTrendMetric.format)}</strong>
                                  <em>{`${couponAnalytics ? couponAnalytics.dailyTrend.length : 0} 天平均`}</em>
                                </div>
                              </div>

                              <div className="analytics-breakdown-list">
                                {COUPON_ANALYTICS_TREND_METRIC_OPTIONS.map((item) => (
                                  <div className="analytics-breakdown-row" key={item.key}>
                                    <span>{item.label}</span>
                                    <strong>
                                      {formatCouponTrendMetricValue(couponTrendSelectedItem[item.key] || 0, item.format)}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </article>
                          </div>
                        ) : (
                          <div className="admin-resource-empty">当前时间范围内还没有可展示的趋势数据。</div>
                        )}
                      </section>

                      <div className="mall-coupon-analytics-grid">
                        <section className="mall-coupon-analytics-card">
                          <div className="mall-admin-section-head">
                            <div>
                              <h3>按结算场景看</h3>
                              <p>判断购物车结算和立即购买哪一条链路的券更容易命中和成交。</p>
                            </div>
                          </div>

                          <div className="mall-coupon-analytics-breakdown-grid">
                            {couponAnalytics && couponAnalytics.scenarioBreakdown.length ? (
                              couponAnalytics.scenarioBreakdown.map((item) => (
                                <article className="mall-coupon-analytics-breakdown-card" key={item.key}>
                                  <div className="mall-coupon-analytics-breakdown-head">
                                    <strong>{item.label}</strong>
                                    <span className="resource-table-chip">{`${item.paymentSuccessCount} 单支付`}</span>
                                  </div>
                                  <div className="mall-coupon-analytics-breakdown-metrics">
                                    <span>{`曝光 ${item.impressionCount}`}</span>
                                    <span>{`有券曝光 ${item.availableImpressionCount}`}</span>
                                    <span>{`自动命中 ${item.autoApplyCount}`}</span>
                                    <span>{`叠加支付 ${item.stackedPaymentSuccessCount}`}</span>
                                    <span>{`支付转化 ${item.paymentConversionRateText}`}</span>
                                  </div>
                                  <div className="mall-coupon-analytics-breakdown-hint">
                                    {`券抵扣 ${formatMoney(item.discountAmount)} · 会员让利 ${formatMoney(item.memberDiscountAmount)} · 总优惠 ${formatMoney(item.totalDiscountAmount)}`}
                                  </div>
                                </article>
                              ))
                            ) : (
                              <div className="admin-resource-empty">当前时间范围内还没有可用的场景数据。</div>
                            )}
                          </div>
                        </section>

                        <section className="mall-coupon-analytics-card">
                          <div className="mall-admin-section-head">
                            <div>
                              <h3>按券阶段看</h3>
                              <p>快速判断新人券、首单券、复购券、通用券谁真正贡献支付。</p>
                            </div>
                          </div>

                          <div className="mall-coupon-analytics-breakdown-grid">
                            {couponAnalytics && couponAnalytics.stageBreakdown.length ? (
                              couponAnalytics.stageBreakdown.map((item) => (
                                <article className="mall-coupon-analytics-breakdown-card" key={item.key}>
                                  <div className="mall-coupon-analytics-breakdown-head">
                                    <strong>{item.label}</strong>
                                    <span className="resource-table-chip is-success">{`${item.paymentSuccessCount} 单支付`}</span>
                                  </div>
                                  <div className="mall-coupon-analytics-breakdown-metrics">
                                    <span>{`曝光 ${item.impressionCount}`}</span>
                                    <span>{`自动命中 ${item.autoApplyCount}`}</span>
                                    <span>{`带券提交 ${item.checkoutSubmitCount}`}</span>
                                    <span>{`叠加支付 ${item.stackedPaymentSuccessCount}`}</span>
                                    <span>{`支付转化 ${item.paymentConversionRateText}`}</span>
                                  </div>
                                  <div className="mall-coupon-analytics-breakdown-hint">
                                    {`券抵扣 ${formatMoney(item.discountAmount)} · 会员让利 ${formatMoney(item.memberDiscountAmount)} · 总优惠 ${formatMoney(item.totalDiscountAmount)}`}
                                  </div>
                                </article>
                              ))
                            ) : (
                              <div className="admin-resource-empty">当前时间范围内还没有券阶段数据。</div>
                            )}
                          </div>
                        </section>
                      </div>

                      <section className="mall-coupon-analytics-card">
                        <div className="mall-admin-section-head">
                          <div>
                            <h3>按选券方式看</h3>
                            <p>区分自动匹配、手动选券、明确不用券和旧口径兼容/未标记，判断哪种选择方式更容易形成带券成交。</p>
                          </div>
                        </div>

                        <div className="mall-coupon-analytics-breakdown-grid">
                          {couponAnalytics && couponAnalytics.selectionBreakdown.length ? (
                            couponAnalytics.selectionBreakdown.map((item) => (
                              <article className="mall-coupon-analytics-breakdown-card" key={item.key}>
                                <div className="mall-coupon-analytics-breakdown-head">
                                  <strong>{item.label}</strong>
                                  <span className="resource-table-chip">{`${item.paymentSuccessCount} 单带券支付`}</span>
                                </div>
                                <div className="mall-coupon-analytics-breakdown-metrics">
                                  <span>{`曝光 ${item.impressionCount}`}</span>
                                  <span>{`有券曝光 ${item.availableImpressionCount}`}</span>
                                  <span>{`自动命中 ${item.autoApplyCount}`}</span>
                                  <span>{`带券提交 ${item.checkoutSubmitCount}`}</span>
                                  <span>{`叠加支付 ${item.stackedPaymentSuccessCount}`}</span>
                                  <span>{`支付转化 ${item.paymentConversionRateText}`}</span>
                                </div>
                                <div className="mall-coupon-analytics-breakdown-hint">
                                  {`券抵扣 ${formatMoney(item.discountAmount)} · 会员让利 ${formatMoney(item.memberDiscountAmount)} · 总优惠 ${formatMoney(item.totalDiscountAmount)}`}
                                </div>
                              </article>
                            ))
                          ) : (
                            <div className="admin-resource-empty">当前时间范围内还没有可用的选券方式拆分数据。</div>
                          )}
                        </div>
                      </section>

                      <section className="mall-coupon-analytics-card">
                        <div className="mall-admin-section-head">
                          <div>
                            <h3>优惠券排行</h3>
                            <p>优先看真正带来支付和抵扣金额的券，避免被单纯曝光误导。</p>
                          </div>
                        </div>

                          <div className="resource-table mall-coupon-analytics-table">
                          <div className="resource-table-row resource-table-head mall-coupon-analytics-row">
                            <span>优惠券</span>
                            <span>阶段</span>
                            <span>曝光</span>
                            <span>带券支付</span>
                            <span>叠加支付</span>
                            <span>券抵扣</span>
                            <span>总优惠</span>
                            <span>支付转化</span>
                            <span>最近事件</span>
                          </div>
                          {topCouponRows.map((item) => (
                            <div className="resource-table-row mall-coupon-analytics-row" key={item.couponCode}>
                              <span className="resource-table-strong">
                                <span>{item.couponName || item.couponCode}</span>
                                <em>{item.couponCode}</em>
                              </span>
                              <span>
                                <span className="resource-table-chip is-muted">{item.couponStageLabel || '未标记'}</span>
                              </span>
                              <span>{item.impressionCount}</span>
                              <span>{item.paymentSuccessCount}</span>
                              <span>{item.stackedPaymentSuccessCount}</span>
                              <span>{formatMoney(item.discountAmount)}</span>
                              <span>{formatMoney(item.totalDiscountAmount)}</span>
                              <span>{item.paymentConversionRateText}</span>
                              <span>{formatDateTime(item.lastEventAt)}</span>
                            </div>
                          ))}
                          {!topCouponRows.length ? (
                            <div className="admin-resource-empty">当前时间范围内还没有真实成交过的优惠券埋点。</div>
                          ) : null}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </article>
              ) : null}

              {showOrderPanel ? (
              <article className="admin-resource-panel">
                <div className="mall-admin-section-head">
                  <div>
                    <h3>{managementSection === 'refunds' ? '售后退款' : '订单管理'}</h3>
                    <p>
                      {managementSection === 'refunds'
                        ? '把退款待审、退款处理中和已退款订单单独拎出来，先处理售后，再决定是否继续履约。'
                        : '按订单状态、发货状态和退款状态处理履约，直接看订单并执行操作。'}
                    </p>
                  </div>
                </div>

                <div className="mall-shipping-toolbar">
                  <div className="mall-shipping-filter-row">
                    {visibleOrderFilterOptions.map((item) => (
                      <button
                        key={item.key}
                        className={`mall-shipping-filter-chip ${orderFilterKey === item.key ? 'is-active' : ''}`}
                        onClick={() => setOrderFilterKey(item.key)}
                        type="button"
                      >
                        <span>{item.label}</span>
                        <small>{item.description}</small>
                      </button>
                    ))}
                  </div>
                </div>

                {managementSection === 'orders' || managementSection === 'refunds' ? (
                  <div className="mall-admin-order-overview-grid">
                    {(managementSection === 'refunds' ? refundWorkbenchOverviewCards : orderWorkbenchOverviewCards).map((item) => (
                      <div className="mall-admin-order-overview-card" key={item.key}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <em>{item.hint}</em>
                      </div>
                    ))}
                  </div>
                ) : null}

                {showOrderInspectionNotes && managementSection !== 'orders' && filteredOrders.length ? (
                  <div className="mall-admin-order-inspection-panel">
                    <div className="mall-admin-order-inspection-head">
                      <div>
                        <strong>联调验收模板</strong>
                        <p>数据库恢复前，先用当前订单样本把“前台订单详情 / 后台订单卡 / 支付实扣”三处金额对齐步骤固化下来。</p>
                      </div>
                      <span
                        className={`resource-table-chip ${resolveOrderInspectionStatusChipClass(
                          orderInspectionSummary.headlineStatus,
                        )}`}
                      >
                        {orderInspectionSummary.headlineLabel}
                      </span>
                    </div>

                    <div className="mall-admin-order-inspection-grid">
                      {orderInspectionSummary.overviewCards.map((item) => (
                        <button
                          className={`mall-admin-order-inspection-card is-actionable ${orderInspectionFocusKey === item.focusKey ? 'is-active' : ''}`}
                          key={item.key}
                          onClick={() => setOrderInspectionFocusKey(item.focusKey)}
                          type="button"
                        >
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <em>{item.hint}</em>
                        </button>
                      ))}
                    </div>

                    <div className="mall-admin-order-checklist">
                      {orderInspectionSummary.checklistItems.map((item) => (
                        <button
                          className={`mall-admin-order-checklist-item is-actionable ${orderInspectionFocusKey === item.focusKey ? 'is-active' : ''}`}
                          key={item.key}
                          onClick={() => setOrderInspectionFocusKey(item.focusKey)}
                          type="button"
                        >
                          <div className="mall-admin-order-checklist-head">
                            <strong>{item.title}</strong>
                            <span className={`resource-table-chip ${resolveOrderInspectionStatusChipClass(item.status)}`}>
                              {item.status === 'success'
                                ? '可执行'
                                : item.status === 'warning'
                                  ? '需复核'
                                  : item.status === 'danger'
                                    ? '优先处理'
                                    : '待补样本'}
                            </span>
                          </div>
                          <span>{item.description}</span>
                        </button>
                      ))}
                    </div>

                    {orderInspectionSummary.topIssues.length ? (
                      <div className="mall-admin-order-risk-list">
                        <div className="mall-admin-order-info-title">当前高频风险项</div>
                        <div className="resource-table-chip-row mall-admin-order-risk-tags">
                          {orderInspectionSummary.topIssues.map((item) => (
                            <button
                              className={`resource-table-chip is-warning mall-admin-order-risk-tag ${
                                orderInspectionFocusKey === `issue:${item.code}` ? 'is-active' : ''
                              }`}
                              key={item.code}
                              onClick={() => setOrderInspectionFocusKey(`issue:${item.code}`)}
                              type="button"
                            >
                              {`${item.title} ${item.count}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mall-admin-order-focus-bar">
                      <div className="mall-admin-order-focus-meta">
                        <div className="mall-admin-order-info-title">当前聚焦样本</div>
                        <div className="mall-admin-order-focus-title">{orderInspectionFocusMeta.label}</div>
                        <div className="mall-admin-order-note">{orderInspectionFocusMeta.description}</div>
                      </div>
                      <div className="mall-admin-order-focus-actions">
                        <span
                          className={`resource-table-chip ${resolveOrderInspectionStatusChipClass(
                            orderInspectionFocusMeta.status,
                          )}`}
                        >
                          {`命中订单 ${visibleOrders.length}`}
                        </span>
                        {orderInspectionFocusKey !== 'all' ? (
                          <button
                            className="admin-resource-ghost"
                            onClick={() => setOrderInspectionFocusKey('all')}
                            type="button"
                          >
                            清除聚焦
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mall-admin-order-conclusion-panel mall-admin-order-brief-panel">
                      <div className="mall-admin-order-record-head">
                        <div>
                          <div className="mall-admin-order-info-title">测试/运营短摘要</div>
                          <div className="mall-admin-order-note">
                            已把联合结论压缩成更短的转发版本，适合发到群里或贴到任务同步里。
                          </div>
                        </div>
                        <div className="mall-admin-order-record-actions">
                          <span
                            className={`resource-table-chip ${resolveOrderInspectionStatusChipClass(
                              combinedInspectionBrief.status,
                            )}`}
                          >
                            {combinedInspectionBrief.label}
                          </span>
                          <button
                            className="admin-resource-ghost"
                            onClick={() => void handleCopyCombinedInspectionBrief()}
                            type="button"
                          >
                            复制短摘要
                          </button>
                        </div>
                      </div>
                      <div className="mall-admin-order-note">{combinedInspectionBrief.summary}</div>
                      <div className="mall-admin-order-brief-highlights">
                        {combinedInspectionBrief.highlights.map((item, index) => (
                          <div className="mall-admin-order-brief-item" key={`${index}-${item}`}>
                            <strong>{index === 0 ? '短结论' : `要点 ${index}`}</strong>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <textarea
                        className="mall-admin-order-record-textarea mall-admin-order-brief-textarea"
                        readOnly
                        value={combinedInspectionBrief.text}
                      />
                    </div>

                    <div className="mall-admin-order-conclusion-panel mall-admin-order-combined-panel">
                      <div className="mall-admin-order-record-head">
                        <div>
                          <div className="mall-admin-order-info-title">联合验收结论</div>
                          <div className="mall-admin-order-note">
                            已按当前已加载订单池同时汇总订单联调样本和售后退款样本，适合直接发给测试或运营。
                          </div>
                        </div>
                        <div className="mall-admin-order-record-actions">
                          <span
                            className={`resource-table-chip ${resolveOrderInspectionStatusChipClass(
                              combinedInspectionConclusion.status,
                            )}`}
                          >
                            {combinedInspectionConclusion.label}
                          </span>
                          <button
                            className="admin-resource-ghost"
                            onClick={() => void handleCopyCombinedInspectionConclusion()}
                            type="button"
                          >
                            复制联合结论
                          </button>
                        </div>
                      </div>
                      <div className="mall-admin-order-note">{combinedInspectionConclusion.summary}</div>
                      <div className="mall-admin-order-conclusion-actions">
                        {combinedInspectionConclusion.actionItems.map((item, index) => (
                          <div className="mall-admin-order-conclusion-item" key={`${index}-${item}`}>
                            <strong>{`联合动作 ${index + 1}`}</strong>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <textarea
                        className="mall-admin-order-record-textarea mall-admin-order-conclusion-textarea"
                        readOnly
                        value={combinedInspectionConclusion.text}
                      />
                    </div>

                    <div className="mall-admin-order-conclusion-panel">
                      <div className="mall-admin-order-record-head">
                        <div>
                          <div className="mall-admin-order-info-title">验收结论文本</div>
                          <div className="mall-admin-order-note">
                            已按当前聚焦样本生成一段可直接发给测试、运营或联调同学的验收结论。
                          </div>
                        </div>
                        <div className="mall-admin-order-record-actions">
                          <span
                            className={`resource-table-chip ${resolveOrderInspectionStatusChipClass(
                              orderInspectionConclusion.status,
                            )}`}
                          >
                            {orderInspectionConclusion.label}
                          </span>
                          <button
                            className="admin-resource-ghost"
                            onClick={() => void handleCopyOrderInspectionConclusion()}
                            type="button"
                          >
                            复制验收结论
                          </button>
                        </div>
                      </div>
                      <div className="mall-admin-order-note">{orderInspectionConclusion.summary}</div>
                      <div className="mall-admin-order-conclusion-actions">
                        {orderInspectionConclusion.actionItems.map((item, index) => (
                          <div className="mall-admin-order-conclusion-item" key={`${index}-${item}`}>
                            <strong>{`动作 ${index + 1}`}</strong>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <textarea
                        className="mall-admin-order-record-textarea mall-admin-order-conclusion-textarea"
                        readOnly
                        value={orderInspectionConclusion.text}
                      />
                    </div>

                    <div className="mall-admin-order-record-panel">
                      <div className="mall-admin-order-record-head">
                        <div>
                          <div className="mall-admin-order-info-title">验收留档文本</div>
                          <div className="mall-admin-order-note">
                            已按当前筛选和聚焦样本自动生成，可直接复制到联调记录、群消息或验收文档。
                          </div>
                        </div>
                        <div className="mall-admin-order-record-actions">
                          <button
                            className="admin-resource-ghost"
                            disabled={!visibleOrders.length}
                            onClick={() => void handleCopyOrderInspectionRecord()}
                            type="button"
                          >
                            复制验收文本
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="mall-admin-order-record-textarea"
                        readOnly
                        value={orderInspectionRecordText}
                      />
                    </div>

                    <div className="mall-admin-order-note">
                      验收记录模板：订单号 / 样本类型 / 前台订单详情金额 / 后台订单卡金额 / 支付实扣金额 / 是否一致 / 差异说明
                    </div>
                  </div>
                ) : null}

                <div className="mall-admin-order-list">
                  {listedOrders.map((item) => {
                    const shippingWorkbenchState =
                      item.refundStatus === 'PENDING'
                        ? {
                            chipLabel: '售后优先',
                            chipClassName: 'is-warning',
                            summary: '有退款申请，暂停录入物流',
                            detail: item.refundAmountText ? `退款申请金额 ¥${item.refundAmountText}` : '退款申请待处理',
                          }
                        : item.refundStatus === 'PROCESSING'
                          ? {
                              chipLabel: '已停发',
                              chipClassName: 'is-danger',
                              summary: '退款处理中，发货已停用',
                              detail: item.refundReviewedAt
                                ? `处理时间 ${formatDateTime(item.refundReviewedAt)}`
                                : '等待微信退款结果',
                            }
                          : item.refundStatus === 'SUCCESS'
                            ? {
                                chipLabel: '已退款',
                                chipClassName: 'is-danger',
                                summary: '订单已退款，不再发货',
                                detail: item.refundReviewedAt
                                  ? `退款完成 ${formatDateTime(item.refundReviewedAt)}`
                                  : '售后流程已完成',
                              }
                            : item.status === 'PENDING'
                              ? {
                                  chipLabel: '待支付',
                                  chipClassName: 'is-muted',
                                  summary: '订单未支付，暂不能发货',
                                  detail: '先标记已支付，再录入物流',
                                }
                              : item.status === 'CLOSED'
                                ? {
                                    chipLabel: '已关闭',
                                    chipClassName: 'is-muted',
                                    summary: '订单已关闭',
                                    detail: '当前订单不再进入履约流程',
                                  }
                                : item.shippingCompany && item.shippingTrackingNo
                                  ? {
                                      chipLabel: '已发货',
                                      chipClassName: 'is-success',
                                      summary: `${item.shippingCompany} · ${item.shippingTrackingNo}`,
                                      detail: item.shippedAt
                                        ? `发货时间 ${formatDateTime(item.shippedAt)}`
                                        : '物流信息已录入，可继续更新',
                                    }
                                  : {
                                      chipLabel: '待发货',
                                      chipClassName: 'is-success',
                                      summary: '待录入物流信息',
                                      detail: item.remark ? `买家备注：${item.remark}` : '可直接录入物流公司和单号',
                                    }
                    const refundWorkbenchState =
                      item.refundStatus === 'PENDING'
                        ? {
                            chipLabel: '待审核',
                            chipClassName: 'is-warning',
                            summary: `买家申请退款${item.refundAmountText ? ` · ¥${item.refundAmountText}` : ''}`,
                            detail: item.refundReason || '买家未填写退款原因',
                          }
                        : item.refundStatus === 'PROCESSING'
                          ? {
                              chipLabel: '处理中',
                              chipClassName: 'is-danger',
                              summary: `退款处理中${item.refundAmountText ? ` · ¥${item.refundAmountText}` : ''}`,
                              detail: item.refundReviewRemark || item.refundReason || '等待微信退款结果',
                            }
                          : item.refundStatus === 'SUCCESS'
                            ? {
                                chipLabel: '已退款',
                                chipClassName: 'is-success',
                                summary: `退款完成${item.refundAmountText ? ` · ¥${item.refundAmountText}` : ''}`,
                                detail: item.refundReviewRemark
                                  ? item.refundReviewRemark
                                  : item.refundReviewedAt
                                    ? `处理时间 ${formatDateTime(item.refundReviewedAt)}`
                                    : '售后流程已完成',
                              }
                            : {
                                chipLabel: '正常',
                                chipClassName: 'is-muted',
                                summary: '当前无退款申请',
                                detail: item.remark ? `买家备注：${item.remark}` : '正常履约中，如有异常可切到售后页集中处理',
                              }
                    const canShip =
                      item.refundStatus !== 'PENDING' &&
                      item.refundStatus !== 'PROCESSING' &&
                      item.refundStatus !== 'SUCCESS' &&
                      item.status !== 'PENDING' &&
                      item.status !== 'CLOSED'

                    return (
                    <article className="mall-admin-order-card" key={item.id}>
                      <div className="mall-admin-order-head">
                        <div>
                          <div className="mall-admin-order-no">{item.orderNo}</div>
                          <div className="mall-admin-order-meta">
                            {item.user?.nickname || '匿名用户'}
                            {item.user?.mobile ? ` · ${item.user.mobile}` : ''}
                            {` · UID ${(item.user?.id || item.userId || '').slice(-8) || '-'}`}
                            {` · ${formatDateTime(item.createdAt)}`}
                          </div>
                        </div>
                        <div className="mall-admin-order-side">
                          <div className="mall-admin-order-chip-row">
                            <span className={`resource-table-chip ${resolveOrderStatusChipClass(item.status)}`}>
                              {item.statusLabel}
                            </span>
                            <span className={`resource-table-chip ${resolveShippingChipClass(item)}`}>
                              {item.shippingStatusLabel}
                            </span>
                            {item.refundStatusLabel ? (
                              <span className={`resource-table-chip ${resolveRefundChipClass(item.refundStatus)}`}>
                                {item.refundStatusLabel}
                              </span>
                            ) : null}
                          </div>
                          <strong>¥{item.totalAmountText}</strong>
                          {item.status === 'PENDING' ? (
                            <div className="mall-admin-order-actions">
                              <button
                                className="admin-resource-ghost"
                                disabled={savingOrderId === item.id}
                                onClick={() => handleOrderStatusSubmit(item.id, 'PAID')}
                                type="button"
                              >
                                {savingOrderId === item.id ? '处理中...' : '标记已支付'}
                              </button>
                              <button
                                className="admin-resource-ghost is-danger"
                                disabled={savingOrderId === item.id}
                                onClick={() => handleOrderStatusSubmit(item.id, 'CLOSED')}
                                type="button"
                              >
                                {savingOrderId === item.id ? '处理中...' : '关闭订单'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mall-admin-order-info-grid">
                        <div className="mall-admin-order-info-card">
                          <div className="mall-admin-order-info-title">收货信息</div>
                          <div className="mall-admin-order-info-text">
                            {item.shippingAddress.recipientName || '未填写收件人'}
                            {item.shippingAddress.phone ? ` · ${item.shippingAddress.phone}` : ''}
                          </div>
                          <div className="mall-admin-order-info-subtext">
                            {item.shippingAddress.fullAddress || '未填写收货地址'}
                          </div>
                        </div>
                        <div className="mall-admin-order-info-card">
                          <div className="mall-admin-order-info-title">物流状态</div>
                          <div className="mall-admin-order-info-text">
                            {item.refundStatus === 'PENDING'
                              ? '待处理退款申请'
                              : item.refundStatus === 'PROCESSING'
                                ? '退款处理中，暂不发货'
                                : item.refundStatus === 'SUCCESS'
                                  ? '订单已退款'
                                  : item.shippingCompany && item.shippingTrackingNo
                              ? `${item.shippingCompany} · ${item.shippingTrackingNo}`
                              : item.status === 'PAID'
                                ? '待录入物流信息'
                                : '暂未进入发货环节'}
                          </div>
                          <div className="mall-admin-order-info-subtext">
                            {item.refundStatusLabel
                              ? `${item.refundStatusLabel}${item.refundReviewedAt ? ` · ${formatDateTime(item.refundReviewedAt)}` : ''}`
                              : item.shippedAt
                              ? `发货时间 ${formatDateTime(item.shippedAt)}`
                              : item.remark
                                ? `买家备注：${item.remark}`
                              : '下方可直接补录物流信息'}
                          </div>
                        </div>
                        {item.pricingInspection?.shouldShowPrompt ? (
                          <div className="mall-admin-order-info-card mall-admin-order-pricing-card">
                            <div className="mall-admin-order-pricing-head">
                              <div className="mall-admin-order-info-title">优惠结构校验</div>
                              <span
                                className={`resource-table-chip ${resolveOrderPricingInspectionChipClass(
                                  item.pricingInspection.level,
                                )}`}
                              >
                                {item.pricingInspection.levelLabel || '未校验'}
                              </span>
                            </div>
                            <div className="mall-admin-order-info-text">
                              {item.pricingInspection.summaryText || '当前订单优惠结构已按现有数据展示。'}
                            </div>
                            <div className="mall-admin-order-info-subtext">{buildOrderPricingBreakdownText(item)}</div>
                            {buildOrderCouponDisplayText(item) ? (
                              <div className="mall-admin-order-info-subtext">
                                {`使用优惠券：${buildOrderCouponDisplayText(item)}`}
                              </div>
                            ) : null}
                            {item.memberPriceItemCount > 0 || item.memberExclusiveItemCount > 0 ? (
                              <span className="resource-table-chip-row mall-admin-order-pricing-tags">
                                {item.memberPriceItemCount > 0 ? (
                                  <span className="resource-table-chip is-muted">{`会员价商品 ${item.memberPriceItemCount}`}</span>
                                ) : null}
                                {item.memberExclusiveItemCount > 0 ? (
                                  <span className="resource-table-chip is-muted">{`会员专享商品 ${item.memberExclusiveItemCount}`}</span>
                                ) : null}
                              </span>
                            ) : null}
                            {item.pricingInspection.issues.length ? (
                              <div className="mall-admin-order-pricing-issues">
                                {item.pricingInspection.issues.map((issue) => (
                                  <div className="mall-admin-order-pricing-issue" key={issue.code}>
                                    <strong>{issue.title}</strong>
                                    <span>{issue.detail}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {item.couponStackingRuleText ? (
                              <div className="mall-admin-order-note">{item.couponStackingRuleText}</div>
                            ) : null}
                          </div>
                        ) : null}
                        {item.shareApplied ? (
                          <div className="mall-admin-order-info-card">
                            <div className="mall-admin-order-info-title">分享佣金</div>
                            <div className="mall-admin-order-info-text">
                              {`分享人 ${formatMallShareSharerDisplay(
                                item.shareSharer || item.shareCommissionRecipient,
                                item.shareSharerUserId,
                              )}`}
                            </div>
                            <div className="mall-admin-order-info-subtext">
                              {`佣金 ${item.shareCommissionAmountText || '¥0.00'} · ${item.shareCommissionStatusLabel || '待结算'}${item.shareProductTitle ? ` · ${item.shareProductTitle}` : ''}`}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="mall-admin-order-items">
                        {item.items.map((line) => (
                          <div className="mall-admin-order-line" key={line.id}>
                            <span>{line.title}</span>
                            <span>{`x${line.quantity}`}</span>
                            <span>{`¥${line.totalAmountText}`}</span>
                          </div>
                        ))}
                      </div>

                      <div className={`mall-admin-order-workbench-grid${managementSection === 'refunds' ? ' is-refund-only' : ''}`}>
                        {managementSection !== 'refunds' ? (
                          <div className="mall-admin-order-shipping-panel">
                            <div className="mall-admin-order-panel-head">
                              <div className="mall-admin-order-info-title">发货处理</div>
                              <span className={`resource-table-chip ${shippingWorkbenchState.chipClassName}`}>
                                {shippingWorkbenchState.chipLabel}
                              </span>
                            </div>
                            <div className="mall-admin-order-status-grid">
                              <div className="mall-admin-order-status-item">
                                <span>当前状态</span>
                                <strong>{shippingWorkbenchState.summary}</strong>
                              </div>
                              <div className="mall-admin-order-status-item">
                                <span>处理摘要</span>
                                <strong>{shippingWorkbenchState.detail}</strong>
                              </div>
                            </div>
                            {canShip ? (
                              <>
                                <div className="mall-admin-shipping-grid">
                                  <label className="admin-resource-field">
                                    <span>物流公司</span>
                                    <input
                                      onChange={(event) => handleShippingDraftChange(item.id, 'shippingCompany', event.target.value)}
                                      placeholder="例如：顺丰、京东快递"
                                      value={shippingDrafts[item.id]?.shippingCompany || ''}
                                    />
                                  </label>
                                  <label className="admin-resource-field">
                                    <span>物流单号</span>
                                    <input
                                      onChange={(event) => handleShippingDraftChange(item.id, 'shippingTrackingNo', event.target.value)}
                                      placeholder="请输入快递单号"
                                      value={shippingDrafts[item.id]?.shippingTrackingNo || ''}
                                    />
                                  </label>
                                  <label className="admin-resource-field mall-admin-form-field-wide">
                                    <span>发货备注</span>
                                    <input
                                      onChange={(event) => handleShippingDraftChange(item.id, 'shippingRemark', event.target.value)}
                                      placeholder="选填，例如：拆单发货、同城闪送、已电话确认"
                                      value={shippingDrafts[item.id]?.shippingRemark || ''}
                                    />
                                  </label>
                                </div>
                                <div className="mall-admin-order-actions mall-admin-order-actions-inline">
                                  <button
                                    className="admin-resource-submit"
                                    disabled={savingOrderId === item.id}
                                    onClick={() => void handleShipSubmit(item.id)}
                                    type="button"
                                  >
                                    {savingOrderId === item.id ? '处理中...' : item.shippingStatus === 'SHIPPED' ? '更新物流' : '确认发货'}
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        <div className={`mall-admin-order-shipping-panel${managementSection === 'refunds' ? ' is-refund-focus' : ''}`}>
                          <div className="mall-admin-order-panel-head">
                            <div className="mall-admin-order-info-title">
                              {managementSection === 'refunds' ? '退款处理' : '售后状态'}
                            </div>
                            <span className={`resource-table-chip ${refundWorkbenchState.chipClassName}`}>
                              {refundWorkbenchState.chipLabel}
                            </span>
                          </div>
                          <div className="mall-admin-order-status-grid">
                            <div className="mall-admin-order-status-item">
                              <span>{item.refundStatus === 'PENDING' ? '退款申请' : '退款进度'}</span>
                              <strong>{refundWorkbenchState.summary}</strong>
                            </div>
                            <div className="mall-admin-order-status-item">
                              <span>售后摘要</span>
                              <strong>{refundWorkbenchState.detail}</strong>
                            </div>
                          </div>
                          {item.refundStatus === 'PENDING' ? (
                            <div className="mall-admin-order-actions mall-admin-order-actions-inline">
                              <button
                                className="admin-resource-submit"
                                disabled={savingOrderId === item.id}
                                onClick={() => void handleRefundReview(item, 'APPROVE')}
                                type="button"
                              >
                                {savingOrderId === item.id ? '处理中...' : '同意退款'}
                              </button>
                              <button
                                className="admin-resource-ghost is-danger"
                                disabled={savingOrderId === item.id}
                                onClick={() => void handleRefundReview(item, 'REJECT')}
                                type="button"
                              >
                                {savingOrderId === item.id ? '处理中...' : '驳回申请'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                    )
                  })}
                  {!listedOrders.length ? (
                    <div className="admin-resource-empty">
                      {orders.length
                        ? managementSection === 'refunds'
                          ? '当前筛选条件下没有匹配的售后单。'
                          : '当前筛选条件下没有匹配的订单。'
                        : managementSection === 'refunds'
                          ? '还没有售后单，用户申请退款后这里会自动出现。'
                          : '还没有订单，小程序下单后这里会自动出现。'}
                    </div>
                  ) : null}
                </div>
              </article>
              ) : null}
            </section>
          </>
        ) : null}
        <input accept="image/*" hidden onChange={handleCoverFileChange} ref={coverFileInputRef} type="file" />
        <input accept="image/*" hidden onChange={handleDetailImageFileChange} ref={detailImageFileInputRef} type="file" />
      </div>
    </AdminLayout>
  )
}
