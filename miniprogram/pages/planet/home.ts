import {
  assignLocalPostColumn as assignLocalPlanetPostColumn,
  getLocalPlanetSubscriptionEnabled,
  getPlanetById,
  isPlanetOwnedByCurrentUser,
  joinPlanet,
  loadPinnedPosts,
  loadPostsByPlanet,
  PlanetPinnedPost,
  PlanetPost,
  PlanetProfile,
  toggleLocalPostEssence,
  toggleLocalPostPinned,
  updateLocalPlanetSubscription,
  upsertRemotePlanets,
} from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { listLocalPlanetColumns } from '../../utils/column'
import {
  assignPlanetPostColumn,
  createJoinOrder,
  createRenewalOrder,
  fetchOrderDetail,
  fetchJoinCoupons,
  fetchPlanetJoinPreview,
  fetchCheckinChallenges,
  fetchPlanetColumns,
  fetchPlanetHome,
  fetchPinnedPosts,
  fetchPlanetPosts,
  resolvePromotionScene,
  reportPlanetPost,
  reapplyJoinReview,
  updatePlanetSubscription,
  updatePlanetPost,
} from '../../utils/planet-api'
import {
  navigateToPlanetIndex,
  rememberActivePlanetId,
  resolvePlanetIdFromOptions,
} from '../../utils/planet-route'
import {
  navigateAfterMallMembershipOpen,
  saveMallMembershipReviewNotice,
} from '../../utils/mall-membership'
import { normalizeAssetUrl, prepareAssetDisplayUrls } from '../../utils/request'
import { ensureWechatSession } from '../../utils/wechat-login'

interface PlanetMetricItem {
  label: string
  value: string
}

interface PlanetPreviewItem {
  id: string
  author: string
  authorAvatar: string
  time: string
  title: string
  summary: string
  image: string
  targetPostId?: string
}

interface PlanetDetailConfig {
  planetNo: string
  verifiedLabel: string
  reportLabel: string
  categoryLabel?: string
  ownerNameOverride?: string
  avatarImageUrl?: string
  ownerActiveText: string
  description: string[]
  feeNotices: string[]
  previewList: PlanetPreviewItem[]
  metricOverrides?: {
    topics?: string
    members?: string
    featured?: string
    questions?: string
  }
  priceText?: string
}

interface PlanetTab {
  key: string
  label: string
}

interface PublishActionItem {
  key: string
  label: string
  iconClass: string
  description: string
}

interface PlanetFeatureCard {
  key: string
  title: string
  subtitle: string
  accentLabel?: string
}

interface JoinCouponCardItem {
  id: string
  code: string
  name: string
  amount: number
  amountText: string
  remainingQuantity: number | null
  validTo: string
  isRecommended: boolean
  selected: boolean
}

interface PaywallHighlightItem {
  name: string
  url: string
  displayUrl: string
}

interface PlanetRenewalOverview {
  enabled?: boolean
  canRenew?: boolean
  stage?: string
  isExpired?: boolean
  isExpiringSoon?: boolean
  daysUntilExpire?: number | null
  expireAt?: string | null
  amount?: number
  payableAmount?: number
  originalAmount?: number
  discountedPercentage?: number
  guidance?: string
  renewalUrl?: string
  coupon?: {
    id?: string
    code?: string
    name?: string
    discountAmount?: number
  } | null
}

interface PlanetRenewalEntryState {
  showRenewalEntry: boolean
  renewalBadgeText: string
  renewalTitle: string
  renewalHint: string
  renewalPriceText: string
  renewalOriginalPriceText: string
  renewalDiscountText: string
  renewalSummaryLabel: string
  renewalSummaryHint: string
  renewalActionText: string
  renewalUrl: string
  renewalCouponCode: string
}

interface FeedItem {
  id: string
  author: string
  authorId?: string
  isRemote?: boolean
  avatarClass: string
  avatarUrl: string
  time: string
  title: string
  content: string
  images: string[]
  displayImages: string[]
  likeCount: string
  commentCount: string
  isPinned?: boolean
  isEssence?: boolean
  hasFile?: boolean
  fileName?: string
  fileSizeText?: string
  columnId?: string
  columnTitle?: string
}
interface PinnedArticleItem extends Pick<FeedItem, 'id' | 'title'> {
  prefix: string
}

interface FeedManageActionItem {
  key: 'toggleEssence' | 'togglePinned' | 'assignColumn' | 'editPost' | 'copyTitle' | 'reportPost'
  label: string
  danger?: boolean
}

interface ColumnPickerItem {
  id: string
  title: string
  count: number
  isCurrent?: boolean
}

const feedAvatarClassPool = [
  'feed-avatar-blue',
  'feed-avatar-gray',
  'feed-avatar-rose',
  'feed-avatar-dark',
  'feed-avatar-amber',
  'feed-avatar-navy',
]

const getFeedAvatarClass = (index: number) => feedAvatarClassPool[index % feedAvatarClassPool.length]
const PLANET_PUBLISH_REFRESH_KEY = 'planet_publish_refresh_v1'
const feedReportReasonOptions = [
  {
    label: '广告营销或导流',
    reason: '广告营销或导流',
  },
  {
    label: '内容违规或不适',
    reason: '内容违规或不适',
  },
  {
    label: '骚扰攻击或引战',
    reason: '骚扰攻击或引战',
  },
  {
    label: '信息失实或误导',
    reason: '信息失实或误导',
  },
]

const getSettledValue = <T>(result: PromiseSettledResult<T>) => (result.status === 'fulfilled' ? result.value : null)
const toDatasetBoolean = (value: unknown) => value === true || value === 'true'

const parseSceneRecord = (scene?: string) => {
  const normalizedScene = String(scene || '').trim()
  if (!normalizedScene) {
    return {}
  }

  let decodedScene = normalizedScene
  try {
    decodedScene = decodeURIComponent(normalizedScene)
  } catch {}

  return decodedScene.split('&').reduce<Record<string, string>>((result, item) => {
    const [rawKey, ...restValue] = item.split('=')
    const key = String(rawKey || '').trim()
    if (!key) {
      return result
    }

    result[key] = restValue.join('=').trim()
    return result
  }, {})
}

const waitFor = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs)
  })

const requestWechatPayment = (paymentRequest: {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}) =>
  new Promise<void>((resolve, reject) => {
    const { timeStamp, nonceStr, package: packageValue, signType, paySign } = paymentRequest

    wx.requestPayment({
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: signType as WechatMiniprogram.RequestPaymentOption['signType'],
      paySign,
      success: () => resolve(),
      fail: reject,
    })
  })

const isPaymentCancelled = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const errMsg = 'errMsg' in error ? String((error as { errMsg?: string }).errMsg || '') : ''
  return errMsg.indexOf('cancel') >= 0
}

const pollOrderPaymentResult = async (payload: {
  orderNo: string
  sessionToken: string
  userId: string
}) => {
  let lastResponse: any = null

  for (let index = 0; index < 15; index += 1) {
    try {
      const response = await fetchOrderDetail(payload)
      lastResponse = response

      const paymentStatus = response.data && response.data.order ? response.data.order.paymentStatus : ''
      const membershipStatus = response.data && response.data.membership ? response.data.membership.status || '' : ''

      if (paymentStatus === 'PAID' || membershipStatus === 'ACTIVE' || membershipStatus === 'PENDING') {
        return response
      }
    } catch {}

    await waitFor(index < 4 ? 600 : 1000)
  }

  return lastResponse
}

const formatPostTime = (value?: string) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

const isAssetUrl = (value: string) => /^https?:\/\//.test(value) || /^\//.test(value)
const isImageUrl = (value: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(value)

const extractPostImages = (post: Record<string, any>) => {
  const directImages = Array.isArray(post.images)
    ? post.images
        .filter((item: unknown): item is string => typeof item === 'string' && isImageUrl(item))
        .map((item: string) => normalizeAssetUrl(item.trim()))
        .filter((item: string) => isAssetUrl(item))
    : []
  const attachments = Array.isArray(post.attachments) ? post.attachments : []
  const attachmentImages = attachments
    .map((item) => {
      if (typeof item === 'string') {
        return normalizeAssetUrl(item.trim())
      }
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        return normalizeAssetUrl(item.url.trim())
      }
      return ''
    })
    .filter((item) => isAssetUrl(item) && isImageUrl(item))

  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const metadataImages = Array.isArray(metadata.images)
    ? metadata.images.filter(
        (item: unknown): item is string => typeof item === 'string' && isImageUrl(item)
      )
        .map((item: string) => normalizeAssetUrl(item))
        .filter((item: string) => isAssetUrl(item))
    : []

  return Array.from(new Set(directImages.concat(attachmentImages, metadataImages))).slice(0, 9)
}

const mapRemotePostToFeedItem = (post: Record<string, any>, index: number): FeedItem => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const images = extractPostImages(post)
  const title = String(post.title || post.summary || post.contentText || '').trim()
  const content = String(post.contentText || '').trim()
  const fileAttachments = Array.isArray(metadata.fileAttachments)
    ? metadata.fileAttachments.filter((item: unknown) => item && typeof item === 'object')
    : []
  const firstFileAttachment = fileAttachments.length ? (fileAttachments[0] as Record<string, any>) : null

  return {
    id: String(post.id || ''),
    author:
      post.author && typeof post.author === 'object' && typeof post.author.nickname === 'string'
        ? post.author.nickname
        : '当前成员',
    isRemote: true,
    avatarClass: getFeedAvatarClass(index),
    avatarUrl:
      post.author && typeof post.author === 'object' && typeof post.author.avatarUrl === 'string'
        ? normalizeAssetUrl(post.author.avatarUrl)
        : typeof post.authorAvatar === 'string'
          ? normalizeAssetUrl(post.authorAvatar)
          : '',
    time: formatPostTime(post.publishedAt || post.createdAt || ''),
    title: title || content,
    content: title && content && content !== title ? content : '',
    images,
    displayImages: images,
    likeCount: `${Number(post.likeCount || 0)}`,
    commentCount: `${Number(post.commentCount || 0)}`,
    authorId:
      post.author && typeof post.author === 'object' && typeof post.author.id === 'string' ? post.author.id : '',
    isPinned: Boolean(post.isPinned),
    isEssence: Boolean(post.isEssence),
    hasFile: Boolean(metadata.hasFile) || fileAttachments.length > 0,
    fileName:
      (firstFileAttachment && typeof firstFileAttachment.name === 'string' && firstFileAttachment.name) ||
      (typeof metadata.fileName === 'string' && metadata.fileName) ||
      '附件资料',
    fileSizeText:
      firstFileAttachment && typeof firstFileAttachment.sizeText === 'string' ? firstFileAttachment.sizeText : '',
    columnId: typeof metadata.columnId === 'string' ? metadata.columnId : '',
    columnTitle: typeof metadata.columnTitle === 'string' ? metadata.columnTitle : '',
  }
}

const mapRemotePostsToFeedItems = (posts: Array<Record<string, any>>) =>
  posts.map((post, index) => mapRemotePostToFeedItem(post, index))

const mapRemotePinnedPostsToItems = (posts: Array<Record<string, any>>): PinnedArticleItem[] =>
  posts.map((post) => ({
    id: String(post.id || ''),
    prefix: Array.isArray(post.attachments) && post.attachments.length ? '[图片]' : '',
    title: String(post.title || post.summary || post.contentText || '').trim(),
  }))

const mapLocalPostToFeedItem = (post: PlanetPost, index: number): FeedItem => {
  const normalizedContent = String(post.content || '').trim()
  const title = String(post.title || '').trim() || normalizedContent.slice(0, 38)
  const content =
    title && normalizedContent && normalizedContent !== title
      ? normalizedContent
      : normalizedContent.length > title.length
        ? normalizedContent.slice(title.length).trim()
        : ''
  const fileAttachments = Array.isArray(post.fileAttachments) ? post.fileAttachments : []
  const firstFileAttachment = fileAttachments.length ? fileAttachments[0] : null

  return {
    id: post.id,
    author: post.author || '当前成员',
    authorId: post.authorId || '',
    isRemote: false,
    avatarClass: getFeedAvatarClass(index),
    avatarUrl: typeof post.avatar === 'string' ? normalizeAssetUrl(post.avatar) : '',
    time: String(post.time || ''),
    title,
    content,
    images: Array.isArray(post.images) ? post.images : [],
    displayImages: Array.isArray(post.images) ? post.images : [],
    likeCount: `${Number(post.likeCount || 0)}`,
    commentCount: `${Number(post.commentCount || 0)}`,
    isPinned: Boolean(post.isPinned),
    isEssence: Boolean(post.isEssence),
    hasFile: Boolean(post.hasFile) || fileAttachments.length > 0,
    fileName:
      (typeof post.fileName === 'string' && post.fileName) ||
      (firstFileAttachment && firstFileAttachment.name) ||
      '附件资料',
    fileSizeText: firstFileAttachment && firstFileAttachment.sizeText ? firstFileAttachment.sizeText : '',
    columnId: typeof post.columnId === 'string' ? post.columnId : '',
    columnTitle: typeof post.columnTitle === 'string' ? post.columnTitle : '',
  }
}

const mapLocalPinnedPostToItem = (post: PlanetPinnedPost): PinnedArticleItem => ({
  id: post.id,
  prefix: post.prefix || '',
  title: String(post.title || post.content || '').trim(),
})

const mapLocalPostToPinnedItem = (post: PlanetPost): PinnedArticleItem => ({
  id: post.id,
  prefix: Array.isArray(post.images) && post.images.length ? '[图片]' : post.hasFile ? '[文件]' : '',
  title: String(post.title || post.content || '').trim() || '未命名主题',
})

const buildLocalFeedFallback = (planetId: string) => {
  const localPosts = loadPostsByPlanet(planetId)
  const localFeedItems = localPosts.map((post, index) => mapLocalPostToFeedItem(post, index))
  const localEssenceList = localPosts
    .filter((post) => post.isEssence)
    .map((post, index) => mapLocalPostToFeedItem(post, index))
  const localQuestionList = localPosts
    .filter((post) => post.publishType === 'question')
    .map((post, index) => mapLocalPostToFeedItem(post, index))
  const localFeaturedList =
    localEssenceList.length > 0
      ? localEssenceList
      : [...localFeedItems].sort((left, right) => Number(right.likeCount) - Number(left.likeCount)).slice(0, 3)
  const localPinnedFromFeed = localPosts.filter((post) => post.isPinned).map(mapLocalPostToPinnedItem)
  const localPinnedList = localPinnedFromFeed.concat(
    loadPinnedPosts()
    .filter((post) => !post.planetId || post.planetId === planetId)
    .map(mapLocalPinnedPostToItem)
      .filter((post) => !localPinnedFromFeed.some((item) => item.id === post.id))
  )

  return {
    latestList: localFeedItems,
    featuredList: localFeaturedList.length ? localFeaturedList : localFeedItems.slice(0, 3),
    fileList: localFeedItems.filter((item) => item.images.length > 0 || item.hasFile),
    answerList: localQuestionList.length ? localQuestionList.slice(0, 2) : localFeedItems.slice(0, 2),
    pinnedList: localPinnedList,
  }
}

const detailConfigMap: Record<string, PlanetDetailConfig> = {
  grp_datawhale_001: {
    planetNo: '55518444',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    categoryLabel: 'AI学习',
    ownerActiveText: '创建30天，近期持续更新',
    description: [
      '这是一个围绕 AI 学习与实践的付费星球，主要用于验证用户加入、内容浏览、作业与打卡链路。',
      '当前仓库会优先用它串联小程序端、后台端和后端接口之间的真实 groupId 数据流。',
    ],
    feeNotices: [
      '加入后可在有效期内浏览精华主题、专栏、打卡和作业等样本内容。',
      '当前默认价格与权限策略来自后端种子数据，联网后会以真实接口结果为准。',
      '本地回退数据主要服务调试和结构验证，不代表最终线上内容密度。',
    ],
    previewList: [],
    metricOverrides: {
      topics: '3',
      members: '6+',
      featured: '1',
      questions: '2',
    },
    priceText: '¥50',
  },
  grp_multi_admin_001: {
    planetNo: '20000002',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    categoryLabel: '协作运营',
    ownerActiveText: '创建40天，近期持续活跃',
    description: [
      '这是一个用于验证合伙人、管理员和普通成员混合协作流程的真实样本星球。',
      '适合检查权限设置、成员协作、内容值班和多角色后台联动是否一致。',
    ],
    feeNotices: [
      '加入后可以查看多管理员协作样本中的公告、主题、成员信息和权限设置结果。',
      '该星球主要用于验证后台协作链路与多角色内容管理，不以内容数量为目标。',
      '如果接口同步失败，当前页面会优先保留本地结构化样本，保证调试链路可用。',
    ],
    previewList: [],
    metricOverrides: {
      topics: '2',
      members: '4+',
      featured: '1',
      questions: '0',
    },
    priceText: '¥199',
  },
  grp_review_001: {
    planetNo: '20000003',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    categoryLabel: '内容审核',
    ownerActiveText: '创建18天，最近有审核流转',
    description: [
      '这个样本星球主要用于验证内容审核中的待审、驳回、隐藏和已发布状态切换。',
      '适合检查管理端筛选项、审核状态展示和用户端可见性是否一致。',
    ],
    feeNotices: [
      '当前星球用于审核状态验证，重点是内容状态流转而不是内容数量。',
      '加入审核样本星球后，可以对照管理端和用户端查看可见内容差异。',
      '如果接口返回了审核策略，页面会优先使用真实策略覆盖这里的默认说明。',
    ],
    previewList: [],
    metricOverrides: {
      topics: '2',
      members: '3+',
      featured: '0',
      questions: '0',
    },
    priceText: '¥149',
  },
  grp_empty_001: {
    planetNo: '20000001',
    verifiedLabel: '已认证',
    reportLabel: '投诉',
    categoryLabel: '空内容样本',
    ownerActiveText: '创建12天，当前无主题内容',
    description: [
      '这个样本星球用于验证空内容、空专栏、空帖子和空状态提示文案。',
      '适合检查首页、专栏页、打卡页和后台列表在无数据情况下是否稳定。',
    ],
    feeNotices: [
      '当前星球没有预置内容，主要用于验证各类空状态与默认引导。',
      '如果后续补充了真实内容，页面会自动切换到真实统计与真实列表。',
      '空状态调试优先保证结构清晰、提示明确，不强求第一轮像素级还原。',
    ],
    previewList: [],
    metricOverrides: {
      topics: '0',
      members: '1+',
      featured: '0',
      questions: '0',
    },
    priceText: '¥99',
  },
}

const formatMetricCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k+`
  }
  return `${count}`
}

const buildMetricList = (planet: PlanetProfile, detail: PlanetDetailConfig): PlanetMetricItem[] => {
  const metricOverrides = detail.metricOverrides || {}
  const topics = metricOverrides.topics || formatMetricCount(planet.postCount)
  const members = metricOverrides.members || `${planet.memberCount}+`
  const featured = metricOverrides.featured || `${Math.max(12, Math.floor(planet.postCount / 5))}`
  const questions = metricOverrides.questions || `${Math.max(36, Math.floor(planet.memberCount / 3))}`

  return [
    { label: '主题', value: topics },
    { label: '成员', value: members },
    { label: '精华', value: featured },
    { label: '问答', value: questions },
  ]
}

const buildTags = (planet: PlanetProfile, detail: PlanetDetailConfig) => {
  const tags = [detail.verifiedLabel, detail.categoryLabel || planet.category]
  if (planet.isFree) {
    tags.push('免费')
  }
  return tags
}

const buildPriceText = (isFree: boolean, price: number) => (isFree ? '免费' : `¥${price}`)
const formatPriceTextFromCents = (amount: number) => {
  const normalizedAmount = Math.max(Number(amount || 0), 0)
  if (normalizedAmount <= 0) {
    return '免费'
  }

  const value = normalizedAmount / 100
  return Number.isInteger(value) ? `¥${value}` : `¥${value.toFixed(2)}`
}

const formatCouponExpiryText = (value?: string | null) => {
  if (!value) {
    return '长期有效'
  }

  return value.slice(0, 10).replace(/-/g, '.')
}

const emptyRenewalEntryState: PlanetRenewalEntryState = {
  showRenewalEntry: false,
  renewalBadgeText: '',
  renewalTitle: '',
  renewalHint: '',
  renewalPriceText: '',
  renewalOriginalPriceText: '',
  renewalDiscountText: '',
  renewalSummaryLabel: '',
  renewalSummaryHint: '',
  renewalActionText: '',
  renewalUrl: '',
  renewalCouponCode: '',
}

const buildCouponSummaryText = (couponName: string, amount: number, totalCoupons: number) => {
  if (!couponName) {
    return totalCoupons > 0 ? `当前有 ${totalCoupons} 张可用优惠券` : '当前暂无可用优惠券'
  }

  return `${couponName} 已抵扣 ${formatPriceTextFromCents(amount)}`
}

const buildOverviewMetricList = (
  topicCount: number,
  memberCount: number,
  featuredCount: number,
  answerCount: number
): PlanetMetricItem[] => [
  { label: '主题', value: formatMetricCount(topicCount) },
  { label: '成员', value: `${memberCount}+` },
  { label: '精华', value: `${featuredCount}` },
  { label: '问答', value: `${answerCount}` },
]

const buildOverviewDescriptionList = (
  intro: string,
  description: string,
  ownerBio: string,
  fallbackDescriptionList: string[]
) => {
  const nextDescriptionList = [intro, description, ownerBio ? `星主简介：${ownerBio}` : '']
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return nextDescriptionList.length ? Array.from(new Set(nextDescriptionList)).slice(0, 3) : fallbackDescriptionList
}

const buildOwnerActiveText = (createdAt: string, contentCount: number, fallbackText: string) => {
  if (!createdAt) {
    return fallbackText
  }

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) {
    return fallbackText
  }

  const diffTime = Date.now() - createdDate.getTime()
  const diffDays = Math.max(1, Math.floor(diffTime / (24 * 60 * 60 * 1000)))
  return `创建${diffDays}天，已发布${Math.max(contentCount, 0)}条内容`
}

const buildFeeNotices = (
  group: Record<string, any>,
  policy: Record<string, any> | null,
  fallbackNotices: string[],
  priceText: string,
  membershipStatus = '',
  reviewReason = ''
) => {
  const nextNotices = [
    membershipStatus === 'PENDING'
      ? '你已完成支付，当前申请正在等待管理员审核，通过后会自动开通成员资格。'
      : membershipStatus === 'REJECTED'
      ? `你的加入申请已被驳回${reviewReason ? `：${reviewReason}` : '。'}你可以直接重新提交审核，无需再次支付。`
      : policy && policy.allowJoin === false
      ? '当前星球已暂停加入，仅保留资料展示与已加入成员访问能力。'
      : group.joinType === 'FREE'
      ? '加入后可直接进入星球浏览内容、参与互动并接收更新提醒。'
      : `加入后可在有效期内查看星球内容、参与互动，当前参考价格为${priceText}。`,
    policy && policy.allowJoin === false
      ? '当前星球已暂停加入，仅保留资料展示与已加入成员访问能力。'
      : '',
    policy && policy.needExamine
      ? '当前星球开启了加入审核，通过后方可进入完整内容流。'
      : '加入星球后 72 小时内可申请退款，超时后手续费不予退回。',
    policy && policy.allowPreview === false
      ? '当前星球不开放预览，只有正式加入后才能查看完整内容。'
      : '加入前请确认内容方向与更新节奏，平台不对第三方内容承担保证责任。',
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return nextNotices.length ? nextNotices : fallbackNotices
}

const buildJoinButtonText = (isJoined: boolean, priceText: string, allowJoin = true, membershipStatus = '') => {
  if (isJoined) {
    return '进入星球'
  }

  if (membershipStatus === 'PENDING') {
    return '审核中'
  }

  if (membershipStatus === 'REJECTED') {
    return '重新提交审核'
  }

  if (!allowJoin) {
    return '暂停加入'
  }

  return `立即加入：${priceText === '免费' ? '免费' : priceText}`
}

const buildMallAwareJoinButtonText = (
  isJoined: boolean,
  priceText: string,
  allowJoin = true,
  membershipStatus = '',
  mallRedirectUrl = ''
) => {
  if (mallRedirectUrl && isJoined) {
    return '返回商城继续购买'
  }

  return buildJoinButtonText(isJoined, priceText, allowJoin, membershipStatus)
}

const buildJoinButtonDisabled = (isJoined: boolean, allowJoin: boolean, membershipStatus = '') =>
  !isJoined && (!allowJoin || membershipStatus === 'PENDING')

const buildPlanetNo = (planetId: string, fallbackPlanetNo: string) => {
  const normalizedPlanetId = String(planetId || '').replace(/\D/g, '')
  if (normalizedPlanetId) {
    return normalizedPlanetId.slice(-8)
  }

  return fallbackPlanetNo || '10000001'
}

const buildPreviewItemsFromPosts = (
  posts: Array<Record<string, any>>,
  fallbackAvatarUrl: string,
  fallbackAuthorName: string
) => {
  const normalizedFallbackAvatar = normalizeAssetUrl(fallbackAvatarUrl || '')

  const uniquePostMap = posts.reduce<Record<string, PlanetPreviewItem>>((result, post) => {
    const postId = String(post && post.id ? post.id : '').trim()
    if (!postId || result[postId]) {
      return result
    }

    const title = String(post.title || post.summary || post.contentText || post.content || '').trim()
    const summary = String(post.summary || post.contentText || post.content || '').trim()
    const images = extractPostImages(post)
    const author =
      post.author && typeof post.author === 'object' && typeof post.author.nickname === 'string'
        ? post.author.nickname
        : typeof post.author === 'string'
          ? post.author
        : fallbackAuthorName || '当前成员'
    const authorAvatar =
      post.author && typeof post.author === 'object' && typeof post.author.avatarUrl === 'string'
        ? normalizeAssetUrl(post.author.avatarUrl)
        : typeof post.authorAvatar === 'string'
          ? normalizeAssetUrl(post.authorAvatar)
        : normalizedFallbackAvatar

    result[postId] = {
      id: postId,
      author,
      authorAvatar,
      time: formatPostTime(post.publishedAt || post.createdAt || post.time || ''),
      title: title || summary || '未命名主题',
      summary: summary && summary !== title ? summary : title || '这篇主题暂时还没有摘要',
      image: images[0] || '',
      targetPostId: postId,
    }

    return result
  }, {})

  return Object.keys(uniquePostMap)
    .map((key) => uniquePostMap[key])
    .slice(0, 3)
}

const buildPaywallHighlightItems = (items: Array<Record<string, any>> | undefined | null): PaywallHighlightItem[] => {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item, index) => {
      const rawUrl = item && typeof item.url === 'string' ? item.url : ''
      const url = normalizeAssetUrl(rawUrl)
      if (!url) {
        return null
      }

      const name =
        item && typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 40) : `亮点图${index + 1}`

      return {
        name,
        url,
        displayUrl: url,
      }
    })
    .filter((item): item is PaywallHighlightItem => Boolean(item))
    .slice(0, 4)
}

const preparePaywallHighlightDisplayItems = async (items: PaywallHighlightItem[]): Promise<PaywallHighlightItem[]> => {
  const displayUrls = await prepareAssetDisplayUrls(items.map((item) => item.url))

  return items.map((item, index) => ({
    name: item.name,
    url: item.url,
    displayUrl: displayUrls[index] || item.url,
  }))
}

const prepareFeedDisplayItems = async (items: FeedItem[]): Promise<FeedItem[]> => {
  const displayImageList = await Promise.all(items.map((item) => prepareAssetDisplayUrls(item.images)))

  return items.map((item, index) => ({
    ...item,
    displayImages: displayImageList[index] || item.images,
  }))
}

const buildFeedListSignature = (items: FeedItem[]) =>
  items.map((item) => `${item.id}:${item.images.join(',')}`).join('|')

const buildRenewalEntryState = (renewal: PlanetRenewalOverview | null | undefined): PlanetRenewalEntryState => {
  if (!renewal || !renewal.canRenew) {
    return {
      ...emptyRenewalEntryState,
    }
  }

  const amount = Math.max(Number(renewal.amount || 0), 0)
  const payableAmount = Math.max(
    typeof renewal.payableAmount === 'number' && Number.isFinite(renewal.payableAmount) ? renewal.payableAmount : amount,
    0
  )
  const originalAmount = Math.max(Number(renewal.originalAmount || 0), amount)
  const discountedPercentage = Math.max(Math.round(Number(renewal.discountedPercentage || 100)), 0)
  const coupon =
    renewal.coupon && typeof renewal.coupon === 'object' && typeof renewal.coupon.code === 'string' ? renewal.coupon : null
  const couponDiscountAmount = coupon ? Math.max(Number(coupon.discountAmount || 0), 0) : 0
  const hasAutoCoupon = Boolean(coupon && coupon.code && couponDiscountAmount > 0 && payableAmount <= amount)
  const couponAmountText = hasAutoCoupon ? formatPriceTextFromCents(Math.round(couponDiscountAmount * 100)) : ''
  const couponName = hasAutoCoupon ? String((coupon && coupon.name) || '续期券') : ''
  const daysUntilExpire =
    typeof renewal.daysUntilExpire === 'number' && Number.isFinite(renewal.daysUntilExpire)
      ? renewal.daysUntilExpire
      : null
  const renewalPriceText = formatPriceTextFromCents(Math.round((hasAutoCoupon ? payableAmount : amount) * 100))
  const renewalOriginalPriceText = hasAutoCoupon
    ? formatPriceTextFromCents(Math.round(amount * 100))
    : originalAmount > amount
      ? formatPriceTextFromCents(Math.round(originalAmount * 100))
      : ''
  const renewalDiscountText =
    hasAutoCoupon
      ? `已减${couponAmountText}`
      : renewalOriginalPriceText && discountedPercentage > 0 && discountedPercentage < 100
        ? `${discountedPercentage}折续期`
        : ''
  const renewalTitle = renewal.isExpired
    ? '会员已到期，可立即续期恢复访问'
    : daysUntilExpire === 1
      ? '会员明天到期，建议今天完成续期'
      : `会员还有 ${Math.max(daysUntilExpire || 0, 1)} 天到期`
  const guidance = typeof renewal.guidance === 'string' ? renewal.guidance.trim() : ''
  const renewalHintBody =
    guidance || (renewal.isExpired ? '续期后可恢复当前星球的付费会员权益。' : '提前续期可避免内容访问和提醒中断。')
  const renewalHint = hasAutoCoupon ? `已自动使用「${couponName}」抵扣 ${couponAmountText}。${renewalHintBody}` : renewalHintBody
  const renewalSummaryHint = hasAutoCoupon
    ? `已自动使用「${couponName}」`
    : renewalDiscountText ||
      (renewalOriginalPriceText
        ? `原价 ${renewalOriginalPriceText}`
        : renewal.isExpired
          ? '续期后恢复访问'
          : '建议提前续期')

  return {
    showRenewalEntry: true,
    renewalBadgeText: renewal.isExpired ? '已过期' : '续期提醒',
    renewalTitle,
    renewalHint,
    renewalPriceText,
    renewalOriginalPriceText,
    renewalDiscountText,
    renewalSummaryLabel: renewal.isExpired ? '续期价' : '提前续期价',
    renewalSummaryHint,
    renewalActionText: '立即续期',
    renewalUrl: '',
    renewalCouponCode: hasAutoCoupon ? String((coupon && coupon.code) || '') : '',
  }
}

Page({
  data: {
    isJoined: false,
    joinLoading: false,
    planetId: '',
    planetName: '饮视星球',
    creatorName: '',
    avatarClass: 'avatar-sand',
    avatarImageUrl: '',
    ownerAvatarImageUrl: '',
    planetNo: '',
    ownerName: '',
    ownerActiveText: '',
    featureCards: [] as PlanetFeatureCard[],
    tags: [] as string[],
    metrics: [] as PlanetMetricItem[],
    descriptionList: [] as string[],
    previewDescriptionList: [] as string[],
    introExpanded: false,
    paywallHighlights: [] as PaywallHighlightItem[],
    feeNotices: [] as string[],
    previewList: [] as PlanetPreviewItem[],
    priceText: '¥199',
    displayPriceText: '¥199',
    basePriceCents: 19900,
    payablePriceCents: 19900,
    joinButtonText: '立即加入',
    joinButtonDisabled: false,
    joinCouponLoading: false,
    joinCouponSummary: '当前暂无可用优惠券',
    joinCoupons: [] as JoinCouponCardItem[],
    selectedCouponCode: '',
    channelCode: '',
    selectedCouponName: '',
    selectedCouponAmount: 0,
    selectedCouponAmountText: '',
    allowJoin: true,
    allowPreview: true,
    needExamine: false,
    membershipStatus: '',
    membershipReviewReason: '',
    showRenewalEntry: false,
    renewalBadgeText: '',
    renewalTitle: '',
    renewalHint: '',
    renewalPriceText: '',
    renewalOriginalPriceText: '',
    renewalDiscountText: '',
    renewalSummaryLabel: '',
    renewalSummaryHint: '',
    renewalActionText: '',
    renewalUrl: '',
    renewalCouponCode: '',
    reportLabel: '投诉',
    showNotices: true,
    source: '',
    mallRedirectUrl: '',
    mallSource: '',
    mallProductId: '',
    mallProductTitle: '',
    activeTab: 'latest',
    tabs: [
      { key: 'latest', label: '最新' },
      { key: 'featured', label: '精华' },
      { key: 'files', label: '文件' },
      { key: 'answer', label: '等我回答' },
    ] as PlanetTab[],
    pinnedList: [] as PinnedArticleItem[],
    latestList: [] as FeedItem[],
    featuredList: [
      {
        id: 'f1',
        author: '程序员996号',
        avatarClass: 'feed-avatar-blue',
        avatarUrl: '',
        time: '2026/03/18 15:47',
        title: '26年目标 ai智能体开发或ai产品经理',
        content: '',
        images: [],
        displayImages: [],
        likeCount: '1',
        commentCount: '0',
      },
      {
        id: 'f2',
        author: 'WROC',
        avatarClass: 'feed-avatar-gray',
        avatarUrl: '',
        time: '2026/03/13 05:11',
        title: '26年目标，智能体应用',
        content: '',
        images: [],
        displayImages: [],
        likeCount: '0',
        commentCount: '0',
      },
    ] as FeedItem[],
    fileList: [
      {
        id: 'file1',
        author: '云梦&&玄龙',
        avatarClass: 'feed-avatar-amber',
        avatarUrl: '',
        time: '2026/01/05 09:02',
        title: '分享一个关于AI 智能体的综述',
        content: '',
        images: [],
        displayImages: [],
        likeCount: '6',
        commentCount: '0',
        hasFile: true,
        fileName: 'ai agent综述 李飞飞.pdf',
      },
    ] as FeedItem[],
    answerList: [] as FeedItem[],
    feedUsingLocalFallback: false,
    canManageFeed: false,
    canAssignColumn: false,
    subscribeEnabled: false,
    subscribeLoading: false,
    subscribeActionLabel: '订阅',
    activeMenuPostId: '',
    menuLoadingPostId: '',
    feedManageActions: [] as FeedManageActionItem[],
    columnPickerVisible: false,
    columnPickerLoading: false,
    columnPickerSubmitting: false,
    columnPickerPostId: '',
    columnPickerPostTitle: '',
    columnPickerCurrentColumnId: '',
    columnPickerColumns: [] as ColumnPickerItem[],
    publishMenuVisible: false,
    publishActions: [
      {
        key: 'normal',
        label: '普通发帖',
        iconClass: 'publish-option-normal',
        description: '发布一条普通内容',
      },
      {
        key: 'question',
        label: '提问',
        iconClass: 'publish-option-question',
        description: '发起一个问题',
      },
    ] as PublishActionItem[],
  },

  syncPaywallHighlightDisplayUrls(items: PaywallHighlightItem[]) {
    if (!Array.isArray(items) || !items.length) {
      return
    }

    const signature = items.map((item) => item.url).join('|')

    preparePaywallHighlightDisplayItems(items)
      .then((nextItems) => {
        const currentSignature = this.data.paywallHighlights.map((item) => item.url).join('|')
        if (currentSignature !== signature) {
          return
        }

        const changed = nextItems.some((item, index) => {
          const currentItem = this.data.paywallHighlights[index]
          return !currentItem || item.displayUrl !== currentItem.displayUrl
        })

        if (!changed) {
          return
        }

        this.setData({
          paywallHighlights: nextItems,
        })
      })
      .catch(() => {})
  },

  syncFeedDisplayUrls(listKey: 'latestList' | 'featuredList' | 'fileList' | 'answerList', items: FeedItem[]) {
    if (!Array.isArray(items) || !items.length) {
      return
    }

    const signature = buildFeedListSignature(items)

    prepareFeedDisplayItems(items)
      .then((nextItems) => {
        const currentItems = Array.isArray(this.data[listKey]) ? this.data[listKey] : []
        if (buildFeedListSignature(currentItems) !== signature) {
          return
        }

        const changed = nextItems.some((item, index) => {
          const currentItem = currentItems[index]
          if (!currentItem) {
            return true
          }

          return item.displayImages.join('|') !== currentItem.displayImages.join('|')
        })

        if (!changed) {
          return
        }

        const nextData: Record<string, FeedItem[]> = {}
        nextData[listKey] = nextItems
        this.setData(nextData)
      })
      .catch(() => {})
  },

  getLocalManageContext(planetId?: string) {
    const resolvedPlanetId = planetId || this.data.planetId
    const localPlanet = resolvedPlanetId ? getPlanetById(resolvedPlanetId) || null : null
    const localSubscriptionEnabled = resolvedPlanetId ? getLocalPlanetSubscriptionEnabled(resolvedPlanetId) : false
    return {
      localPlanet,
      canManageLocalPlanet: isPlanetOwnedByCurrentUser(localPlanet),
      localSubscriptionEnabled,
    }
  },

  onLoad(options: Record<string, string>) {
    const sceneRecord = parseSceneRecord(options.scene)
    const sceneChannelId = String(sceneRecord.c || sceneRecord.channelId || '').trim()
    if (sceneChannelId) {
      void this.handlePromotionSceneEntry(options.scene || '')
      return
    }

    const planetId = resolvePlanetIdFromOptions(options, ['id', 'planetId', 'groupId'])
    if (!planetId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    const planet = getPlanetById(planetId)
    const optionName = options.name ? decodeURIComponent(options.name) : ''
    const optionCreator = options.creator ? decodeURIComponent(options.creator) : ''
    const source = options.source || ''
    const optionChannelCode = options.channelCode ? decodeURIComponent(options.channelCode) : ''
    const mallRedirectUrl = options.mallRedirect ? decodeURIComponent(options.mallRedirect) : ''
    const mallSource = options.mallSource ? decodeURIComponent(options.mallSource) : ''
    const mallProductId = options.mallProductId ? decodeURIComponent(options.mallProductId) : ''
    const mallProductTitle = options.mallProductTitle ? decodeURIComponent(options.mallProductTitle) : ''
    const fallbackPlanet: PlanetProfile =
      planet ||
      ({
        id: planetId,
        name: optionName || '饮视星球',
        joined: source === 'joined',
        avatarClass: 'avatar-sand',
        avatarImageUrl: '',
        coverImageUrl: '',
        unread: '',
        badge: '',
        price: 0,
        priceLabel: '免费加入',
        joinType: 'rolling',
        isFree: true,
        requireInviteCode: false,
        ownerName: optionCreator || '星主',
        ownerTagline: '',
        category: '其他',
        intro: '',
        embedPath: '',
        memberCount: 0,
        postCount: 0,
        createdAt: '',
      } as PlanetProfile)

    const detail: PlanetDetailConfig =
      detailConfigMap[optionName] ||
      detailConfigMap[planetId] || {
        planetNo: fallbackPlanet.embedPath.replace(/\D/g, '').slice(0, 8) || '10000001',
        verifiedLabel: '已认证',
        reportLabel: '投诉',
        categoryLabel: fallbackPlanet.category,
        ownerActiveText: `创建${Math.max(30, fallbackPlanet.memberCount)}天，今天活跃过`,
        description: [fallbackPlanet.intro],
        feeNotices: [
          '付费后可在有效期内查看星球内容、参与互动并接收更新提醒。',
          '加入星球后 72 小时内可申请退款，超时后手续费不予退回。',
          '加入前请确认内容方向与更新节奏，平台不对第三方内容承担保证责任。',
        ],
        previewList: [],
        priceText: fallbackPlanet.isFree ? '免费' : `¥${fallbackPlanet.price}`,
      }

    const isJoined = source === 'discover' ? false : source === 'joined' ? true : !!fallbackPlanet.joined
    const creatorName = optionCreator || fallbackPlanet.ownerName
    const localManageContext = this.getLocalManageContext(planetId)
    const initialPriceText = detail.priceText || (fallbackPlanet.isFree ? '免费' : `¥${fallbackPlanet.price}`)
    const initialBasePriceCents = fallbackPlanet.isFree ? 0 : Math.max(Math.round(Number(fallbackPlanet.price || 0) * 100), 0)
    const joinButtonText = buildMallAwareJoinButtonText(isJoined, initialPriceText, true, '', mallRedirectUrl)

    this.setData({
      isJoined,
      joinLoading: false,
      planetId,
      planetName: optionName || fallbackPlanet.name,
      creatorName,
      avatarClass: fallbackPlanet.avatarClass,
      avatarImageUrl: detail.avatarImageUrl || fallbackPlanet.avatarImageUrl,
      ownerAvatarImageUrl: '',
      planetNo: detail.planetNo,
      ownerName: (detail.ownerNameOverride || creatorName).replace(/^(主理人\s*)/, '').replace(/老师$/, ''),
      ownerActiveText: detail.ownerActiveText,
      featureCards: [],
      tags: buildTags(fallbackPlanet, detail),
      metrics: buildMetricList(fallbackPlanet, detail),
      descriptionList: detail.description,
      previewDescriptionList: detail.description.slice(0, 1),
      introExpanded: false,
      paywallHighlights: [],
      feeNotices: buildFeeNotices({}, null, detail.feeNotices, initialPriceText, '', ''),
      previewList: detail.previewList,
      priceText: initialPriceText,
      displayPriceText: initialPriceText,
      basePriceCents: initialBasePriceCents,
      payablePriceCents: initialBasePriceCents,
      joinButtonText,
      joinButtonDisabled: buildJoinButtonDisabled(isJoined, true, ''),
      joinCouponLoading: false,
      joinCouponSummary: '当前暂无可用优惠券',
      joinCoupons: [],
      selectedCouponCode: '',
      channelCode: optionChannelCode,
      selectedCouponName: '',
      selectedCouponAmount: 0,
      selectedCouponAmountText: '',
      allowJoin: true,
      allowPreview: true,
      needExamine: false,
      membershipStatus: '',
      membershipReviewReason: '',
      reportLabel: detail.reportLabel,
      showNotices: false,
      pinnedList: [],
      latestList: [],
      featuredList: [],
      fileList: [],
      answerList: [],
      source,
      mallRedirectUrl,
      mallSource,
      mallProductId,
      mallProductTitle,
      canManageFeed: localManageContext.canManageLocalPlanet,
      canAssignColumn: localManageContext.canManageLocalPlanet,
      subscribeEnabled: localManageContext.localSubscriptionEnabled,
      subscribeLoading: false,
      subscribeActionLabel: localManageContext.localSubscriptionEnabled ? '已订阅' : '订阅',
      activeMenuPostId: '',
      menuLoadingPostId: '',
      feedManageActions: [],
      columnPickerVisible: false,
      columnPickerLoading: false,
      columnPickerSubmitting: false,
      columnPickerPostId: '',
      columnPickerPostTitle: '',
      columnPickerCurrentColumnId: '',
      columnPickerColumns: [],
    })

    void this.refreshFeedContent(planetId)
    void this.syncPlanetOverview(planetId)
  },

  onShow() {
    if (!this.data.planetId) {
      return
    }

    const refreshPlanetId = wx.getStorageSync(PLANET_PUBLISH_REFRESH_KEY)
    if (refreshPlanetId && refreshPlanetId === this.data.planetId) {
      wx.removeStorageSync(PLANET_PUBLISH_REFRESH_KEY)
      this.setData({
        activeTab: 'latest',
        activeMenuPostId: '',
      })
    }

    void this.refreshFeedContent(this.data.planetId)
    void this.syncPlanetOverview(this.data.planetId)
  },

  async handlePromotionSceneEntry(rawScene: string) {
    wx.showLoading({
      title: '打开星球中',
      mask: true,
    })

    try {
      const response = await resolvePromotionScene(String(rawScene || ''))
      if (!response.ok || !response.data || !response.data.groupId) {
        throw new Error('二维码对应的星球不存在')
      }

      const query = [
        `id=${encodeURIComponent(response.data.groupId)}`,
        'source=discover',
      ]

      if (response.data.groupName) {
        query.push(`name=${encodeURIComponent(response.data.groupName)}`)
      }

      if (response.data.ownerName) {
        query.push(`creator=${encodeURIComponent(response.data.ownerName)}`)
      }

      if (response.data.channelCode) {
        query.push(`channelCode=${encodeURIComponent(response.data.channelCode)}`)
      }

      wx.hideLoading()
      wx.reLaunch({
        url: `/pages/planet/home?${query.join('&')}`,
      })
    } catch (error) {
      wx.hideLoading()
      navigateToPlanetIndex(error instanceof Error ? error.message : '二维码解析失败')
    }
  },

  async syncPlanetOverview(planetId: string) {
    if (!planetId) {
      return
    }

    rememberActivePlanetId(planetId)

    const session = await this.ensurePlanetSession()
    const currentPlanet = getPlanetById(planetId)
    const localManageContext = this.getLocalManageContext(planetId)
    this.setData({
      canManageFeed: localManageContext.canManageLocalPlanet,
      canAssignColumn: localManageContext.canManageLocalPlanet,
      subscribeEnabled: localManageContext.localSubscriptionEnabled,
      subscribeActionLabel: localManageContext.localSubscriptionEnabled ? '已订阅' : '订阅',
    })
    const detail: PlanetDetailConfig =
      detailConfigMap[this.data.planetName] ||
      detailConfigMap[planetId] || {
        planetNo: this.data.planetNo || '10000001',
        verifiedLabel: '已认证',
        reportLabel: this.data.reportLabel || '投诉',
        categoryLabel: currentPlanet ? currentPlanet.category : undefined,
        ownerActiveText:
          this.data.ownerActiveText ||
          buildOwnerActiveText(
            currentPlanet && currentPlanet.createdAt ? currentPlanet.createdAt : '',
            currentPlanet ? currentPlanet.postCount : 0,
            '近期持续更新内容'
          ),
        description: this.data.descriptionList.length ? this.data.descriptionList : [''],
        feeNotices: this.data.feeNotices.length ? this.data.feeNotices : [],
        previewList: this.data.previewList,
      }

    try {
      const response = await fetchPlanetHome({
        groupId: planetId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response.ok || !response.data || !response.data.group || !response.data.owner) {
        throw new Error('星球资料加载失败')
      }

      const group = response.data.group
      const owner = response.data.owner
      const membership = response.data.membership || null
      const hasViewerSession = Boolean(session && session.id)
      const nextIsJoined = hasViewerSession
        ? Boolean(response.data.role && (response.data.role.isOwner || response.data.role.isStaff)) ||
          Boolean(membership && membership.isActive)
        : this.data.isJoined
      const priceAmount = Number(group.priceAmount || 0)
      const priceText = buildPriceText(group.joinType === 'FREE', priceAmount)
      const groupAvatarImageUrl = normalizeAssetUrl(String(group.avatarUrl || ''))
      const ownerAvatarImageUrl = normalizeAssetUrl(String(owner.avatarUrl || ''))
      const currentPlanetAvatarImageUrl = normalizeAssetUrl(
        String((currentPlanet && currentPlanet.avatarImageUrl) || this.data.avatarImageUrl || '')
      )
      const currentOwnerAvatarImageUrl = normalizeAssetUrl(String(this.data.ownerAvatarImageUrl || ''))
      const resolvedPlanetAvatarImageUrl =
        groupAvatarImageUrl ||
        (ownerAvatarImageUrl && currentPlanetAvatarImageUrl === ownerAvatarImageUrl
          ? ''
          : currentPlanetAvatarImageUrl)
      const resolvedOwnerAvatarImageUrl =
        ownerAvatarImageUrl || currentOwnerAvatarImageUrl || resolvedPlanetAvatarImageUrl
      const remotePlanet: PlanetProfile = {
        id: planetId,
        name: String(group.name || this.data.planetName || '饮视星球'),
        joined: nextIsJoined,
        avatarClass: (currentPlanet && currentPlanet.avatarClass) || this.data.avatarClass || 'avatar-sand',
        avatarImageUrl: resolvedPlanetAvatarImageUrl,
        coverImageUrl: normalizeAssetUrl(String(group.coverUrl || (currentPlanet && currentPlanet.coverImageUrl) || '')),
        unread: (currentPlanet && currentPlanet.unread) || '',
        badge: (currentPlanet && currentPlanet.badge) || '',
        price: priceAmount,
        priceLabel: group.joinType === 'FREE' ? '免费加入' : `¥ ${priceAmount}/年`,
        joinType: group.billingPeriod === 'YEAR' ? 'rolling' : 'calendar',
        isFree: group.joinType === 'FREE',
        requireInviteCode: group.joinType === 'INVITE_ONLY',
        ownerName: String(owner.nickname || this.data.creatorName || '星主'),
        ownerTagline: String(owner.bio || (currentPlanet && currentPlanet.ownerTagline) || ''),
        category:
          ((currentPlanet && currentPlanet.category) || detail.categoryLabel || this.data.tags[1] || '其他')
            .toString()
            .trim() || '其他',
        intro: String(group.intro || (currentPlanet && currentPlanet.intro) || ''),
        embedPath: (currentPlanet && currentPlanet.embedPath) || '',
        memberCount: Number(group.memberCount || 0),
        postCount: Number(group.contentCount || 0),
        createdAt: String(group.createdAt || '').slice(0, 10),
      }

      upsertRemotePlanets([
        {
          id: remotePlanet.id,
          name: remotePlanet.name,
          avatarImageUrl: remotePlanet.avatarImageUrl,
          coverImageUrl: remotePlanet.coverImageUrl,
          intro: remotePlanet.intro,
          price: remotePlanet.price,
          priceLabel: remotePlanet.priceLabel,
          joinType: remotePlanet.joinType,
          isFree: remotePlanet.isFree,
          requireInviteCode: remotePlanet.requireInviteCode,
          ownerName: remotePlanet.ownerName,
          ownerTagline: remotePlanet.ownerTagline,
          category: remotePlanet.category,
          memberCount: remotePlanet.memberCount,
          postCount: remotePlanet.postCount,
          createdAt: remotePlanet.createdAt,
          joined: nextIsJoined,
        },
      ])

      const descriptionList = buildOverviewDescriptionList(
        String(group.intro || ''),
        String(group.description || ''),
        String(owner.bio || ''),
        detail.description
      )
      const membershipStatus = membership && typeof membership.status === 'string' ? membership.status : ''
      const membershipReviewReason =
        membership && typeof membership.reviewReason === 'string' ? membership.reviewReason : ''
      const nextAllowJoin = !(response.data.policy && response.data.policy.allowJoin === false)
      const nextAllowPreview = !(response.data.policy && response.data.policy.allowPreview === false)
      const renewalEntry = buildRenewalEntryState(response.data.renewal || null)
      const paywallHighlights = buildPaywallHighlightItems(
        response.data.paywallHighlights && Array.isArray(response.data.paywallHighlights.images)
          ? response.data.paywallHighlights.images
          : []
      )

      this.setData(
        {
          isJoined: nextIsJoined,
          planetName: remotePlanet.name,
          creatorName: remotePlanet.ownerName,
          avatarClass: remotePlanet.avatarClass,
          avatarImageUrl: remotePlanet.avatarImageUrl,
          ownerAvatarImageUrl: resolvedOwnerAvatarImageUrl,
          planetNo: buildPlanetNo(planetId, detail.planetNo || this.data.planetNo),
          ownerName: remotePlanet.ownerName,
          ownerActiveText: buildOwnerActiveText(
            String(group.createdAt || ''),
            Number(group.contentCount || 0),
            detail.ownerActiveText
          ),
          tags: buildTags(remotePlanet, detail),
          metrics: buildOverviewMetricList(
            Number((response.data.stats && response.data.stats.latestCount) || group.contentCount || 0),
            Number(group.memberCount || 0),
            Number((response.data.stats && response.data.stats.featuredCount) || 0),
            Number((response.data.stats && response.data.stats.answerCount) || 0)
          ),
          descriptionList,
          previewDescriptionList: this.data.introExpanded ? descriptionList : descriptionList.slice(0, 1),
          paywallHighlights,
          feeNotices: buildFeeNotices(
            group,
            response.data.policy || null,
            detail.feeNotices,
            priceText,
            membershipStatus,
            membershipReviewReason
          ),
          priceText,
          displayPriceText: priceText,
          basePriceCents: Math.max(Math.round(priceAmount * 100), 0),
          payablePriceCents: Math.max(Math.round(priceAmount * 100), 0),
          joinButtonText: buildMallAwareJoinButtonText(
            nextIsJoined,
            priceText,
            nextAllowJoin,
            membershipStatus,
            this.data.mallRedirectUrl
          ),
          joinButtonDisabled: buildJoinButtonDisabled(nextIsJoined, nextAllowJoin, membershipStatus),
          allowJoin: nextAllowJoin,
          allowPreview: nextAllowPreview,
          needExamine: Boolean(response.data.policy && response.data.policy.needExamine),
          membershipStatus,
          membershipReviewReason,
          ...renewalEntry,
          previewList: nextIsJoined || nextAllowPreview ? this.data.previewList : [],
          reportLabel: detail.reportLabel,
          canManageFeed: Boolean(response.data.role && response.data.role.canManage),
          canAssignColumn: Boolean(response.data.role && response.data.role.isOwner),
          subscribeEnabled: Boolean(response.data.viewer && response.data.viewer.subscriptionEnabled),
          subscribeActionLabel:
            response.data.viewer && response.data.viewer.subscriptionEnabled ? '已订阅' : '订阅',
        },
        () => {
          this.syncPaywallHighlightDisplayUrls(paywallHighlights)
        }
      )

      if (!nextIsJoined && !renewalEntry.showRenewalEntry && group.joinType !== 'FREE') {
        await this.refreshJoinCoupons(planetId, session)
      } else {
        this.setData({
          joinCouponLoading: false,
          joinCoupons: [],
          joinCouponSummary: '当前暂无可用优惠券',
          selectedCouponCode: '',
          selectedCouponName: '',
          selectedCouponAmount: 0,
          selectedCouponAmountText: '',
          displayPriceText: priceText,
          payablePriceCents: Math.max(Math.round(priceAmount * 100), 0),
          joinButtonText: buildMallAwareJoinButtonText(
            nextIsJoined,
            priceText,
            nextAllowJoin,
            membershipStatus,
            this.data.mallRedirectUrl
          ),
        })
      }
    } catch {
      // 资料同步失败时保留当前页面回退数据，避免阻塞星球主链路
    }
  },

  async refreshFeedContent(planetId: string) {
    if (!planetId) {
      return
    }

    const localFallback = buildLocalFeedFallback(planetId)
    const localColumns = listLocalPlanetColumns(planetId)

    try {
      const session = getStoredSession()
      const sessionToken = session && session.sessionToken ? session.sessionToken : ''
      const [latestResult, featuredResult, fileResult, answerResult, pinnedResult, checkinResult, columnsResult] = await Promise.allSettled([
        fetchPlanetPosts({ groupId: planetId, tab: 'latest', limit: 20, sessionToken }),
        fetchPlanetPosts({ groupId: planetId, tab: 'featured', limit: 20, sessionToken }),
        fetchPlanetPosts({ groupId: planetId, tab: 'files', limit: 20, sessionToken }),
        fetchPlanetPosts({ groupId: planetId, tab: 'answer', limit: 20, sessionToken }),
        fetchPinnedPosts(planetId, sessionToken),
        fetchCheckinChallenges({ groupId: planetId, status: 'ongoing', sessionToken }),
        fetchPlanetColumns({ groupId: planetId, sessionToken }),
      ])

      const latestResponse = getSettledValue(latestResult)
      const featuredResponse = getSettledValue(featuredResult)
      const fileResponse = getSettledValue(fileResult)
      const answerResponse = getSettledValue(answerResult)
      const pinnedResponse = getSettledValue(pinnedResult)
      const checkinResponse = getSettledValue(checkinResult)
      const columnsResponse = getSettledValue(columnsResult)
      const latestItems =
        latestResponse && latestResponse.ok && latestResponse.data && Array.isArray(latestResponse.data.items)
          ? latestResponse.data.items
          : null
      const featuredItems =
        featuredResponse && featuredResponse.ok && featuredResponse.data && Array.isArray(featuredResponse.data.items)
          ? featuredResponse.data.items
          : null
      const fileItems =
        fileResponse && fileResponse.ok && fileResponse.data && Array.isArray(fileResponse.data.items)
          ? fileResponse.data.items
          : null
      const answerItems =
        answerResponse && answerResponse.ok && answerResponse.data && Array.isArray(answerResponse.data.items)
          ? answerResponse.data.items
          : null
      const pinnedItems =
        pinnedResponse && pinnedResponse.ok && Array.isArray(pinnedResponse.data) ? pinnedResponse.data : null

      const latestList = latestItems ? mapRemotePostsToFeedItems(latestItems) : localFallback.latestList
      const featuredList = featuredItems ? mapRemotePostsToFeedItems(featuredItems) : localFallback.featuredList
      const fileList = fileItems ? mapRemotePostsToFeedItems(fileItems) : localFallback.fileList
      const answerList = answerItems ? mapRemotePostsToFeedItems(answerItems) : localFallback.answerList
      const pinnedList = pinnedItems ? mapRemotePinnedPostsToItems(pinnedItems) : localFallback.pinnedList
      const previewSourcePosts = ([] as Array<Record<string, any>>)
        .concat(pinnedItems || [])
        .concat(featuredItems || [])
        .concat(latestItems || [])
      const nextPreviewList = buildPreviewItemsFromPosts(
        previewSourcePosts,
        this.data.avatarImageUrl,
        this.data.ownerName || this.data.creatorName
      )
      const ongoingCheckinCount =
        checkinResponse && checkinResponse.ok && checkinResponse.data && Array.isArray(checkinResponse.data.items)
          ? checkinResponse.data.items.length
          : 0
      const totalColumns =
        columnsResponse && columnsResponse.ok && columnsResponse.data
          ? Number(columnsResponse.data.totalColumns || 0)
          : Number(localColumns.totalColumns || 0)
      const featureCards: PlanetFeatureCard[] = [
        ...(totalColumns > 0
          ? [
              {
                key: 'columns',
                title: '专栏',
                subtitle: `共${totalColumns}个专栏`,
              },
            ]
          : []),
        ...(ongoingCheckinCount > 0
          ? [
              {
                key: 'checkinChallenge',
                title: '打卡挑战',
                subtitle: `${ongoingCheckinCount}个进行中`,
              },
            ]
          : []),
      ]
      const canShowPreview = this.data.isJoined || this.data.allowPreview

      this.setData(
        {
          latestList,
          featuredList,
          fileList,
          answerList,
          pinnedList,
          feedUsingLocalFallback: Boolean(!latestItems || !featuredItems || !fileItems || !answerItems || !pinnedItems),
          featureCards,
          previewList: canShowPreview ? nextPreviewList : [],
          showNotices: !!pinnedList.length,
          activeMenuPostId: '',
          menuLoadingPostId: '',
        },
        () => {
          this.syncFeedDisplayUrls('latestList', latestList)
          this.syncFeedDisplayUrls('featuredList', featuredList)
          this.syncFeedDisplayUrls('fileList', fileList)
          this.syncFeedDisplayUrls('answerList', answerList)
        }
      )
    } catch {
      const canShowPreview = this.data.isJoined || this.data.allowPreview
      this.setData(
        {
          latestList: localFallback.latestList,
          featuredList: localFallback.featuredList,
          fileList: localFallback.fileList,
          answerList: localFallback.answerList,
          pinnedList: localFallback.pinnedList,
          feedUsingLocalFallback: true,
          featureCards: localColumns.totalColumns
            ? [
                {
                  key: 'columns',
                  title: '专栏',
                  subtitle: `共${localColumns.totalColumns}个专栏`,
                },
              ]
            : [],
          previewList: canShowPreview ? this.data.previewList : [],
          showNotices: !!localFallback.pinnedList.length,
          activeMenuPostId: '',
          menuLoadingPostId: '',
        },
        () => {
          this.syncFeedDisplayUrls('latestList', localFallback.latestList)
          this.syncFeedDisplayUrls('featuredList', localFallback.featuredList)
          this.syncFeedDisplayUrls('fileList', localFallback.fileList)
          this.syncFeedDisplayUrls('answerList', localFallback.answerList)
        }
      )
    }
  },

  getEffectivePriceText(payablePriceCents?: number) {
    const targetPayablePrice = typeof payablePriceCents === 'number' ? payablePriceCents : this.data.payablePriceCents
    return formatPriceTextFromCents(targetPayablePrice)
  },

  getUpdatedJoinCouponCards(selectedCouponCode: string, sourceList?: JoinCouponCardItem[]) {
    const currentList = Array.isArray(sourceList) ? sourceList : this.data.joinCoupons
    return currentList.map((item) => ({
      ...item,
      selected: item.code === selectedCouponCode,
    }))
  },

  async syncJoinCouponPricing(selectedCouponCode: string, session?: { id?: string; sessionToken?: string } | null) {
    const effectiveSession = session || (await this.ensurePlanetSession())
    const fallbackPriceText = formatPriceTextFromCents(this.data.basePriceCents)
    const selectedCoupon = this.data.joinCoupons.find((item) => item.code === selectedCouponCode) || null

    if (!effectiveSession || !effectiveSession.id) {
      const fallbackPayablePrice = Math.max(this.data.basePriceCents - Number(selectedCoupon ? selectedCoupon.amount : 0), 0)
      this.setData({
        payablePriceCents: fallbackPayablePrice,
        displayPriceText: formatPriceTextFromCents(fallbackPayablePrice),
        selectedCouponCode: selectedCoupon ? selectedCoupon.code : '',
        selectedCouponName: selectedCoupon ? selectedCoupon.name : '',
        selectedCouponAmount: selectedCoupon ? selectedCoupon.amount : 0,
        selectedCouponAmountText: selectedCoupon ? formatPriceTextFromCents(selectedCoupon.amount) : '',
        joinCouponSummary: buildCouponSummaryText(
          selectedCoupon ? selectedCoupon.name : '',
          selectedCoupon ? selectedCoupon.amount : 0,
          this.data.joinCoupons.length
        ),
        joinCoupons: this.getUpdatedJoinCouponCards(selectedCoupon ? selectedCoupon.code : ''),
        joinButtonText: buildMallAwareJoinButtonText(
          this.data.isJoined,
          selectedCoupon ? formatPriceTextFromCents(fallbackPayablePrice) : fallbackPriceText,
          this.data.allowJoin,
          this.data.membershipStatus,
          this.data.mallRedirectUrl
        ),
      })
      return
    }

    if (!selectedCouponCode) {
      this.setData({
        payablePriceCents: this.data.basePriceCents,
        displayPriceText: fallbackPriceText,
        selectedCouponCode: '',
        selectedCouponName: '',
        selectedCouponAmount: 0,
        selectedCouponAmountText: '',
        joinCouponSummary: buildCouponSummaryText('', 0, this.data.joinCoupons.length),
        joinCoupons: this.getUpdatedJoinCouponCards(''),
        joinButtonText: buildMallAwareJoinButtonText(
          this.data.isJoined,
          fallbackPriceText,
          this.data.allowJoin,
          this.data.membershipStatus,
          this.data.mallRedirectUrl
        ),
      })
      return
    }

    try {
      const previewResponse = await fetchPlanetJoinPreview({
        groupId: this.data.planetId,
        userId: effectiveSession.id,
        couponCode: selectedCouponCode,
        channelCode: this.data.channelCode || undefined,
        sessionToken: effectiveSession.sessionToken,
      })

      if (!previewResponse.ok || !previewResponse.data || !previewResponse.data.pricing) {
        throw new Error('优惠券预览失败')
      }

      const nextCoupon = previewResponse.data.coupon
      const nextPayablePrice = Number(previewResponse.data.pricing.payableAmount || 0)

      this.setData({
        payablePriceCents: nextPayablePrice,
        displayPriceText: formatPriceTextFromCents(nextPayablePrice),
        selectedCouponCode: nextCoupon ? nextCoupon.code : '',
        selectedCouponName: nextCoupon ? nextCoupon.name : '',
        selectedCouponAmount: nextCoupon ? Number(nextCoupon.discountAmount || 0) : 0,
        selectedCouponAmountText: nextCoupon ? formatPriceTextFromCents(Number(nextCoupon.discountAmount || 0)) : '',
        joinCouponSummary: buildCouponSummaryText(
          nextCoupon ? nextCoupon.name : '',
          nextCoupon ? Number(nextCoupon.discountAmount || 0) : 0,
          this.data.joinCoupons.length
        ),
        joinCoupons: this.getUpdatedJoinCouponCards(nextCoupon ? nextCoupon.code : ''),
        joinButtonText: buildMallAwareJoinButtonText(
          this.data.isJoined,
          formatPriceTextFromCents(nextPayablePrice),
          this.data.allowJoin,
          this.data.membershipStatus,
          this.data.mallRedirectUrl
        ),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '优惠券不可用'
      wx.showToast({
        title: message,
        icon: 'none',
      })
      this.setData({
        payablePriceCents: this.data.basePriceCents,
        displayPriceText: fallbackPriceText,
        selectedCouponCode: '',
        selectedCouponName: '',
        selectedCouponAmount: 0,
        selectedCouponAmountText: '',
        joinCouponSummary: buildCouponSummaryText('', 0, this.data.joinCoupons.length),
        joinCoupons: this.getUpdatedJoinCouponCards(''),
        joinButtonText: buildMallAwareJoinButtonText(
          this.data.isJoined,
          fallbackPriceText,
          this.data.allowJoin,
          this.data.membershipStatus,
          this.data.mallRedirectUrl
        ),
      })
    }
  },

  async refreshJoinCoupons(planetId: string, session?: { id?: string; sessionToken?: string } | null) {
    if (!planetId) {
      return
    }

    this.setData({
      joinCouponLoading: true,
    })

    try {
      const response = await fetchJoinCoupons({
        groupId: planetId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
      })

      if (!response.ok || !response.data) {
        throw new Error('优惠券加载失败')
      }

      const items = Array.isArray(response.data.items) ? response.data.items : []
      const joinCoupons = items.map((item, index) => ({
        id: String(item.id || ''),
        code: String(item.code || ''),
        name: String(item.name || '未命名优惠券'),
        amount: Number(item.amount || 0),
        amountText: String(item.amountText || formatPriceTextFromCents(Number(item.amount || 0))),
        remainingQuantity:
          item.remainingQuantity === null || typeof item.remainingQuantity === 'number' ? item.remainingQuantity : null,
        validTo: formatCouponExpiryText(item.validTo),
        isRecommended: Boolean(item.isRecommended) || index === 0,
        selected: false,
      }))

      const nextBasePrice = response.data.group ? Number(response.data.group.priceAmount || this.data.basePriceCents) : this.data.basePriceCents
      const matchedCoupon = joinCoupons.find((item) => item.code === this.data.selectedCouponCode)
      const selectedCouponCode = matchedCoupon ? matchedCoupon.code : joinCoupons.length ? joinCoupons[0].code : ''

      this.setData({
        joinCouponLoading: false,
        joinCoupons: this.getUpdatedJoinCouponCards(selectedCouponCode, joinCoupons),
        joinCouponSummary: buildCouponSummaryText('', 0, joinCoupons.length),
        basePriceCents: nextBasePrice,
        payablePriceCents: nextBasePrice,
        priceText: formatPriceTextFromCents(nextBasePrice),
      })

      await this.syncJoinCouponPricing(selectedCouponCode, session)
    } catch {
      const fallbackPriceText = formatPriceTextFromCents(this.data.basePriceCents)
      this.setData({
        joinCouponLoading: false,
        joinCoupons: [],
        joinCouponSummary: '当前暂无可用优惠券',
        selectedCouponCode: '',
        selectedCouponName: '',
        selectedCouponAmount: 0,
        selectedCouponAmountText: '',
        payablePriceCents: this.data.basePriceCents,
        displayPriceText: fallbackPriceText,
        joinButtonText: buildMallAwareJoinButtonText(
          this.data.isJoined,
          fallbackPriceText,
          this.data.allowJoin,
          this.data.membershipStatus,
          this.data.mallRedirectUrl
        ),
      })
    }
  },

  async ensurePlanetSession() {
    const session = getStoredSession()

    if (session && session.sessionToken) {
      return session
    }

    try {
      return await ensureWechatSession()
    } catch {
      return null
    }
  },

  returnToMallAfterMembershipSuccess(toastTitle: string, icon: 'success' | 'none' = 'success') {
    const redirectUrl = String(this.data.mallRedirectUrl || '').trim()
    if (!redirectUrl) {
      return false
    }

    this.updateJoinState(true, 'ACTIVE', '')

    wx.showToast({
      title: toastTitle,
      icon,
    })

    setTimeout(() => {
      navigateAfterMallMembershipOpen(redirectUrl)
    }, 650)

    return true
  },

  returnToMallWhileMembershipReviewPending(toastTitle = '支付成功，返回商城查看审核状态') {
    const redirectUrl = String(this.data.mallRedirectUrl || '').trim()
    if (!redirectUrl) {
      return false
    }

    saveMallMembershipReviewNotice({
      redirectUrl,
      mallSource: this.data.mallSource,
      productId: this.data.mallProductId,
      productTitle: this.data.mallProductTitle,
    })

    wx.showToast({
      title: toastTitle,
      icon: 'none',
    })

    setTimeout(() => {
      navigateAfterMallMembershipOpen(redirectUrl)
    }, 700)

    return true
  },

  updateJoinState(isJoined: boolean, membershipStatus?: string, reviewReason = '') {
    const nextMembershipStatus = membershipStatus || (isJoined ? 'ACTIVE' : this.data.membershipStatus)
    this.setData({
      isJoined,
      membershipStatus: nextMembershipStatus,
      membershipReviewReason: reviewReason,
      joinButtonText: buildMallAwareJoinButtonText(
        isJoined,
        this.data.displayPriceText || this.data.priceText,
        this.data.allowJoin,
        nextMembershipStatus,
        this.data.mallRedirectUrl
      ),
      joinButtonDisabled: buildJoinButtonDisabled(isJoined, this.data.allowJoin, nextMembershipStatus),
    })
  },

  onToggleIntro() {
    const introExpanded = !this.data.introExpanded

    this.setData({
      introExpanded,
      previewDescriptionList: introExpanded ? this.data.descriptionList : this.data.descriptionList.slice(0, 1),
    })
  },

  onOwnerTap() {
    wx.navigateTo({
      url: `/pages/planet/profile?id=${this.data.planetId}`,
    })
  },

  onPaywallHighlightTap(e: WechatMiniprogram.TouchEvent) {
    const current = String(e.currentTarget.dataset.url || '')
    const urls = this.data.paywallHighlights.map((item) => item.url).filter(Boolean)

    if (!current || !urls.length) {
      return
    }

    wx.previewImage({
      current,
      urls,
    })
  },

  onPreviewTap(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.isJoined && !this.data.allowPreview) {
      wx.showToast({
        title: '当前星球暂不开放预览',
        icon: 'none',
      })
      return
    }

    const targetPostId = e.currentTarget.dataset.postId || 'pinned_1'
    wx.navigateTo({
      url: `/pages/planet/post?id=${targetPostId}&planetId=${this.data.planetId}`,
    })
  },

  onCouponTap(e: WechatMiniprogram.TouchEvent) {
    const couponCode = String(e.currentTarget.dataset.code || '')
    if (!couponCode || this.data.joinLoading || this.data.joinCouponLoading) {
      return
    }

    if (couponCode === this.data.selectedCouponCode) {
      void this.syncJoinCouponPricing('')
      return
    }

    void this.syncJoinCouponPricing(couponCode)
  },

  onJoinTap() {
    if (this.data.joinLoading) {
      return
    }

    if (!this.data.isJoined && this.data.membershipStatus === 'PENDING') {
      wx.showToast({
        title: '申请正在审核中',
        icon: 'none',
      })
      return
    }

    if (!this.data.isJoined && !this.data.allowJoin) {
      wx.showToast({
        title: '当前星球已暂停加入',
        icon: 'none',
      })
      return
    }

    if (this.data.isJoined) {
      if (this.returnToMallAfterMembershipSuccess('会员已开通，返回商城', 'none')) {
        return
      }

      wx.redirectTo({
        url: `/pages/planet/home?id=${this.data.planetId}&name=${encodeURIComponent(this.data.planetName)}&creator=${encodeURIComponent(this.data.creatorName)}&source=joined`,
      })
      return
    }

    const isReapplying = !this.data.isJoined && this.data.membershipStatus === 'REJECTED'
    const payablePriceText = this.data.displayPriceText || this.data.priceText
    const couponDescription = this.data.selectedCouponName
      ? `\n已选优惠券：${this.data.selectedCouponName}，立减 ${formatPriceTextFromCents(this.data.selectedCouponAmount)}。`
      : ''

    wx.showModal({
      title: isReapplying ? '重新提交审核' : payablePriceText === '免费' ? '确认加入星球' : '确认支付加入',
      content:
        isReapplying
          ? `将重新提交你加入「${this.data.planetName}」的申请，无需再次支付。${this.data.membershipReviewReason ? `\n\n上次驳回原因：${this.data.membershipReviewReason}` : ''}`
          : payablePriceText === '免费'
          ? `加入后将进入「${this.data.planetName}」内容流。`
          : `原价 ${this.data.priceText}，本次按 ${payablePriceText} 支付并加入「${this.data.planetName}」。${couponDescription}`,
      confirmText: isReapplying ? '重新提交' : payablePriceText === '免费' ? '立即加入' : '确认支付',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        const finishJoin = (joinedPlanet: PlanetProfile, toastTitle: string, icon: 'success' | 'none' = 'success') => {
          wx.hideLoading()
          this.setData({
            joinLoading: false,
          })

          if (this.returnToMallAfterMembershipSuccess(toastTitle, icon)) {
            return
          }

          this.updateJoinState(true, 'ACTIVE', '')

          wx.showToast({
            title: toastTitle,
            icon,
          })

          wx.redirectTo({
            url: `/pages/planet/home?id=${joinedPlanet.id}&name=${encodeURIComponent(joinedPlanet.name)}&creator=${encodeURIComponent(joinedPlanet.ownerName)}&source=joined`,
          })
        }

        this.setData({
          joinLoading: true,
        })

        wx.showLoading({
          title: isReapplying ? '提交中' : payablePriceText === '免费' ? '加入中' : '支付中',
          mask: true,
        })

        try {
          const session = await this.ensurePlanetSession()

          if (!session || !session.id) {
            throw new Error('请先完成登录后再加入星球')
          }

          if (isReapplying) {
            const reapplyResponse = await reapplyJoinReview({
              groupId: this.data.planetId,
              userId: session.id,
            })

            if (!reapplyResponse.ok || !reapplyResponse.data || !reapplyResponse.data.membership) {
              throw new Error('重新提交审核失败')
            }

            const nextReviewReason = reapplyResponse.data.membership.reviewReason || ''

            wx.hideLoading()
            this.setData({
              joinLoading: false,
            })
            this.updateJoinState(false, 'PENDING', nextReviewReason)
            this.setData({
              feeNotices: buildFeeNotices(
                {
                  joinType: this.data.priceText === '免费' ? 'FREE' : 'PAID',
                },
                {
                  allowJoin: this.data.allowJoin,
                  needExamine: this.data.needExamine,
                  allowPreview: this.data.allowPreview,
                },
                this.data.feeNotices,
                this.data.priceText,
                'PENDING',
                nextReviewReason
              ),
            })

            wx.showToast({
              title: reapplyResponse.data.idempotent ? '申请已在审核中' : '已重新提交审核',
              icon: 'none',
            })
            return
          }

          const orderResponse = await createJoinOrder({
            groupId: this.data.planetId,
            userId: session.id,
            paymentChannel: 'WECHAT',
            couponCode: this.data.selectedCouponCode || undefined,
            channelCode: this.data.channelCode || undefined,
            sessionToken: session.sessionToken,
          })

          if (!orderResponse.ok || !orderResponse.data || !orderResponse.data.order) {
            throw new Error(orderResponse.message || '创建加入订单失败')
          }

          const orderNo = orderResponse.data.order.orderNo
          let membershipPayload = orderResponse.data.membership || null
          const paymentPayload = orderResponse.data.payment
          const paymentRequest = paymentPayload && paymentPayload.request ? paymentPayload.request : null

          if (paymentPayload && paymentPayload.required && !paymentRequest) {
            throw new Error('未获取到微信支付参数，请稍后重试')
          }

          if (paymentRequest) {
            wx.hideLoading()

            try {
              await requestWechatPayment(paymentRequest)
            } catch (error) {
              if (isPaymentCancelled(error)) {
                this.setData({
                  joinLoading: false,
                })
                wx.showToast({
                  title: '已取消支付',
                  icon: 'none',
                })
                return
              }

              throw new Error('微信支付未完成，请稍后重试')
            }

            wx.showLoading({
              title: '确认支付结果',
              mask: true,
            })

            const orderDetail = await pollOrderPaymentResult({
              orderNo,
              sessionToken: session.sessionToken,
              userId: session.id,
            })

            if (orderDetail && orderDetail.data) {
              membershipPayload = orderDetail.data.membership || membershipPayload
            }
          } else if (paymentPayload && paymentPayload.required === false && !membershipPayload) {
            const orderDetail = await pollOrderPaymentResult({
              orderNo,
              sessionToken: session.sessionToken,
              userId: session.id,
            })

            if (orderDetail && orderDetail.data) {
              membershipPayload = orderDetail.data.membership || membershipPayload
            }
          }

          if (!membershipPayload) {
            throw new Error('支付结果确认中，请稍后刷新页面查看')
          }

          const nextMembershipStatus = membershipPayload.status || ''
          const nextReviewReason = membershipPayload.reviewReason || ''

          if (nextMembershipStatus === 'PENDING') {
            wx.hideLoading()
            this.setData({
              joinLoading: false,
              membershipStatus: 'PENDING',
              membershipReviewReason: nextReviewReason,
              joinButtonText: buildMallAwareJoinButtonText(
                false,
                payablePriceText,
                this.data.allowJoin,
                'PENDING',
                this.data.mallRedirectUrl
              ),
              joinButtonDisabled: buildJoinButtonDisabled(false, this.data.allowJoin, 'PENDING'),
              feeNotices: buildFeeNotices(
                {
                  joinType: this.data.priceText === '免费' ? 'FREE' : 'PAID',
                },
                {
                  allowJoin: this.data.allowJoin,
                  needExamine: this.data.needExamine,
                  allowPreview: this.data.allowPreview,
                },
                this.data.feeNotices,
                this.data.priceText,
                'PENDING',
                nextReviewReason
              ),
            })

            if (this.returnToMallWhileMembershipReviewPending()) {
              return
            }

            wx.showToast({
              title: '支付成功，等待审核',
              icon: 'none',
            })
            return
          }

          const joinedPlanet: PlanetProfile | null = joinPlanet(this.data.planetId)
          if (!joinedPlanet) {
            throw new Error('加入成功，但本地星球状态更新失败')
          }

          finishJoin(joinedPlanet, payablePriceText === '免费' ? '加入成功' : '支付成功')
        } catch (error) {
          wx.hideLoading()
          this.setData({
            joinLoading: false,
          })
          const message = error instanceof Error ? error.message : '加入失败，请稍后重试'

          if (message.indexOf('已是有效成员') >= 0) {
            const joinedPlanet: PlanetProfile | null = joinPlanet(this.data.planetId)
            if (joinedPlanet) {
              finishJoin(joinedPlanet, '你已经加入过了', 'none')
            }
            return
          }

          if (message.indexOf('审核中') >= 0) {
            this.updateJoinState(false, 'PENDING', '')

            if (this.returnToMallWhileMembershipReviewPending('申请正在审核中，返回商城查看状态')) {
              return
            }

            wx.showToast({
              title: '申请正在审核中',
              icon: 'none',
            })
            return
          }

          if (message.indexOf('驳回') >= 0) {
            this.updateJoinState(false, 'REJECTED', message)
            wx.showToast({
              title: '申请已被驳回',
              icon: 'none',
            })
            return
          }

          if (this.data.needExamine) {
            wx.showToast({
              title: `${message}，当前星球需后台审核`,
              icon: 'none',
            })
            return
          }

          wx.showToast({
            title: message,
            icon: 'none',
          })
        }
      },
    })
  },

  onRenewTap() {
    if (!this.data.showRenewalEntry || this.data.joinLoading) {
      return
    }

    const wasJoined = this.data.isJoined
    const payablePriceText = this.data.renewalPriceText || this.data.displayPriceText || this.data.priceText
    const summaryHint = this.data.renewalSummaryHint ? `\n${this.data.renewalSummaryHint}` : ''
    const renewalHint = this.data.renewalHint ? `\n${this.data.renewalHint}` : ''

    wx.showModal({
      title: payablePriceText === '免费' ? '确认续期' : '确认支付续期',
      content:
        payablePriceText === '免费'
          ? `将为「${this.data.planetName}」续期并恢复会员权益。${summaryHint}${renewalHint}`
          : `将按 ${payablePriceText} 为「${this.data.planetName}」续期。${summaryHint}${renewalHint}`,
      confirmText: payablePriceText === '免费' ? '确认续期' : '确认支付',
      success: async (result) => {
        if (!result.confirm) {
          return
        }

        this.setData({
          joinLoading: true,
        })

        wx.showLoading({
          title: payablePriceText === '免费' ? '续期中' : '支付中',
          mask: true,
        })

        try {
          const session = await this.ensurePlanetSession()

          if (!session || !session.id) {
            throw new Error('请先完成登录后再续期')
          }

          const orderResponse = await createRenewalOrder({
            groupId: this.data.planetId,
            userId: session.id,
            paymentChannel: 'WECHAT',
            couponCode: this.data.renewalCouponCode || undefined,
            sessionToken: session.sessionToken,
          })

          if (!orderResponse.ok || !orderResponse.data || !orderResponse.data.order) {
            throw new Error(orderResponse.message || '创建续期订单失败')
          }

          const orderNo = orderResponse.data.order.orderNo
          let membershipPayload = orderResponse.data.membership || null
          const paymentPayload = orderResponse.data.payment
          const paymentRequest = paymentPayload && paymentPayload.request ? paymentPayload.request : null

          if (paymentPayload && paymentPayload.required && !paymentRequest) {
            throw new Error('未获取到微信支付参数，请稍后重试')
          }

          if (paymentRequest) {
            wx.hideLoading()

            try {
              await requestWechatPayment(paymentRequest)
            } catch (error) {
              if (isPaymentCancelled(error)) {
                this.setData({
                  joinLoading: false,
                })
                wx.showToast({
                  title: '已取消支付',
                  icon: 'none',
                })
                return
              }

              throw new Error('微信支付未完成，请稍后重试')
            }

            wx.showLoading({
              title: '确认支付结果',
              mask: true,
            })

            const orderDetail = await pollOrderPaymentResult({
              orderNo,
              sessionToken: session.sessionToken,
              userId: session.id,
            })

            if (orderDetail && orderDetail.data) {
              membershipPayload = orderDetail.data.membership || membershipPayload
            }
          } else if (paymentPayload && paymentPayload.required === false && !membershipPayload) {
            const orderDetail = await pollOrderPaymentResult({
              orderNo,
              sessionToken: session.sessionToken,
              userId: session.id,
            })

            if (orderDetail && orderDetail.data) {
              membershipPayload = orderDetail.data.membership || membershipPayload
            }
          }

          if (!membershipPayload) {
            throw new Error('支付结果确认中，请稍后刷新页面查看')
          }

          wx.hideLoading()
          this.setData({
            joinLoading: false,
          })

          if (this.returnToMallAfterMembershipSuccess('续期成功')) {
            return
          }

          this.updateJoinState(true, 'ACTIVE', '')

          if (!wasJoined) {
            wx.showToast({
              title: '续期成功',
              icon: 'success',
            })
            wx.redirectTo({
              url: `/pages/planet/home?id=${this.data.planetId}&name=${encodeURIComponent(this.data.planetName)}&creator=${encodeURIComponent(this.data.creatorName)}&source=joined`,
            })
            return
          }

          wx.showToast({
            title: '续期成功',
            icon: 'success',
          })

          void this.syncPlanetOverview(this.data.planetId)
        } catch (error) {
          wx.hideLoading()
          this.setData({
            joinLoading: false,
          })
          wx.showToast({
            title: error instanceof Error ? error.message : '续期失败，请稍后重试',
            icon: 'none',
          })
        }
      },
    })
  },

  onActionTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key

    if (key === 'checkin') {
      wx.navigateTo({
        url: `/pages/planet/checkin?groupId=${this.data.planetId}`,
      })
      return
    }

    if (key === 'columns') {
      wx.navigateTo({
        url: `/pages/planet/columns?groupId=${this.data.planetId}`,
      })
      return
    }

    if (key === 'subscribe') {
      void this.onToggleSubscription()
      return
    }

    if (key === 'settings') {
      wx.navigateTo({
        url: `/pages/planet/profile?id=${this.data.planetId}`,
      })
      return
    }

    if (key === 'invite') {
      wx.navigateTo({
        url: `/pages/planet/share-card?id=${this.data.planetId}`,
      })
    }
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key || 'latest'
    this.setData({
      activeTab: key,
      activeMenuPostId: '',
    })
  },

  onFeatureCardTap(e: WechatMiniprogram.TouchEvent) {
    const key = String(e.currentTarget.dataset.key || '')
    if (key === 'columns') {
      wx.navigateTo({
        url: `/pages/planet/columns?groupId=${this.data.planetId}`,
      })
      return
    }

    if (key === 'checkinChallenge') {
      wx.navigateTo({
        url: `/pages/planet/checkin?groupId=${this.data.planetId}`,
      })
      return
    }

    wx.showToast({
      title: '当前入口暂不可用',
      icon: 'none',
    })
  },

  onFeedTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'seed_1'
    wx.navigateTo({
      url: `/pages/planet/post?id=${id}&planetId=${this.data.planetId}`,
    })
  },

  onPinnedTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'pinned_1'
    this.setData({
      activeMenuPostId: '',
    })
    wx.navigateTo({
      url: `/pages/planet/post?id=${id}&planetId=${this.data.planetId}`,
    })
  },

  onFeedAvatarError(e: WechatMiniprogram.TouchEvent) {
    const listKey = String(e.currentTarget.dataset.list || '')
    const postId = String(e.currentTarget.dataset.id || '')

    if (!listKey || !postId) {
      return
    }

    const sourceList = (this.data as unknown as Record<string, FeedItem[]>)[listKey]
    if (!Array.isArray(sourceList)) {
      return
    }

    const targetIndex = sourceList.findIndex((item) => item.id === postId)
    if (targetIndex < 0 || !sourceList[targetIndex].avatarUrl) {
      return
    }

    this.setData({
      [`${listKey}[${targetIndex}].avatarUrl`]: '',
    })
  },

  async onToggleSubscription() {
    if (this.data.subscribeLoading) {
      return
    }

    const nextEnabled = !this.data.subscribeEnabled
    const applyLocalSubscription = () => {
      const enabled = updateLocalPlanetSubscription(this.data.planetId, nextEnabled)
      wx.hideLoading()
      this.setData({
        subscribeEnabled: enabled,
        subscribeActionLabel: enabled ? '已订阅' : '订阅',
        subscribeLoading: false,
      })
      wx.showToast({
        title: enabled ? '已开启订阅' : '已取消订阅',
        icon: 'success',
      })
    }

    this.setData({
      subscribeLoading: true,
    })

    wx.showLoading({
      title: nextEnabled ? '开启订阅中' : '取消订阅中',
      mask: true,
    })

    const session = await this.ensurePlanetSession()
    if (!session || !session.sessionToken) {
      applyLocalSubscription()
      return
    }

    try {
      const response = await updatePlanetSubscription({
        groupId: this.data.planetId,
        enabled: nextEnabled,
        sessionToken: session.sessionToken,
        userId: session.id,
      })

      if (!response.ok || !response.data) {
        throw new Error('订阅设置失败，请稍后重试')
      }

      wx.hideLoading()
      this.setData({
        subscribeEnabled: response.data.enabled,
        subscribeActionLabel: response.data.enabled ? '已订阅' : '订阅',
        subscribeLoading: false,
      })
    } catch (error) {
      applyLocalSubscription()
    }
  },

  getFeedItemById(postId: string) {
    const feedLists = [
      ...this.data.latestList,
      ...this.data.featuredList,
      ...this.data.fileList,
      ...this.data.answerList,
    ] as FeedItem[]

    return feedLists.find((item) => item.id === postId) || null
  },

  isCurrentUserFeedAuthor(item: FeedItem | null) {
    const session = getStoredSession()
    return !!(session && session.id && item && item.authorId && item.authorId === session.id)
  },

  buildFeedMenuActions(postId: string) {
    const targetPost = this.getFeedItemById(postId)
    if (!targetPost) {
      return []
    }

    if (this.data.canManageFeed) {
      return [
        {
          key: 'toggleEssence' as const,
          label: targetPost.isEssence ? '取消精华' : '设为精华',
        },
        {
          key: 'togglePinned' as const,
          label: targetPost.isPinned ? '取消置顶' : '置顶主题',
        },
        ...(this.data.canAssignColumn
          ? [
              {
                key: 'assignColumn' as const,
                label: targetPost.columnId ? '调整专栏' : '归入专栏',
              },
            ]
          : []),
      ]
    }

    const baseActions: FeedManageActionItem[] = [
      {
        key: 'copyTitle',
        label: '复制标题',
      },
    ]

    if (this.isCurrentUserFeedAuthor(targetPost)) {
      return [
        {
          key: 'editPost',
          label: '编辑主题',
        },
      ].concat(baseActions)
    }

    if (targetPost.isRemote) {
      baseActions.push({
        key: 'reportPost',
        label: '投诉主题',
        danger: true,
      })
    }

    return baseActions
  },

  navigateToFeedEditor(postId: string) {
    const targetPost = this.getFeedItemById(postId)
    if (!targetPost) {
      wx.showToast({
        title: '未找到对应帖子',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/planet-publish/index?planetId=${this.data.planetId}&planetName=${encodeURIComponent(this.data.planetName)}&ownerName=${encodeURIComponent(this.data.creatorName)}&postId=${postId}`,
    })
  },

  copyFeedTitle(postId: string) {
    const targetPost = this.getFeedItemById(postId)
    if (!targetPost || !targetPost.title) {
      wx.showToast({
        title: '未找到可复制标题',
        icon: 'none',
      })
      return
    }

    wx.setClipboardData({
      data: targetPost.title,
      success: () => {
        wx.showToast({
          title: '标题已复制',
          icon: 'success',
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制标题失败',
          icon: 'none',
        })
      },
    })
  },

  openFeedReport(postId: string) {
    const session = getStoredSession()
    const targetPost = this.getFeedItemById(postId)

    if (!targetPost || !targetPost.isRemote) {
      wx.showToast({
        title: '当前帖子暂不支持投诉',
        icon: 'none',
      })
      return
    }

    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    wx.showActionSheet({
      itemList: feedReportReasonOptions.map((item) => item.label),
      success: async ({ tapIndex }) => {
        const selectedReason = feedReportReasonOptions[tapIndex]
        if (!selectedReason) {
          return
        }

        this.setData({
          menuLoadingPostId: postId,
        })
        wx.showLoading({
          title: '提交中',
          mask: true,
        })

        try {
          const response = await reportPlanetPost({
            postId,
            reason: selectedReason.reason,
            sessionToken: session.sessionToken,
          })

          if (!response.ok || !response.data) {
            throw new Error('投诉提交失败')
          }

          wx.hideLoading()
          this.setData({
            activeMenuPostId: '',
            feedManageActions: [],
            menuLoadingPostId: '',
          })
          wx.showToast({
            title: response.data.idempotent ? '已提交过待处理投诉' : '投诉已提交',
            icon: 'success',
          })
        } catch (error) {
          wx.hideLoading()
          this.setData({
            menuLoadingPostId: '',
          })
          wx.showToast({
            title: error instanceof Error ? error.message : '投诉提交失败',
            icon: 'none',
          })
        }
      },
    })
  },

  onToggleFeedMenu(e: WechatMiniprogram.TouchEvent) {
    const postId = String(e.currentTarget.dataset.id || '')
    if (!postId || this.data.menuLoadingPostId) {
      return
    }

    const nextPostId = this.data.activeMenuPostId === postId ? '' : postId
    const feedManageActions: FeedManageActionItem[] = nextPostId ? this.buildFeedMenuActions(postId) : []

    this.setData({
      activeMenuPostId: nextPostId,
      feedManageActions,
    })
  },

  onCloseFeedMenu() {
    if (!this.data.activeMenuPostId) {
      return
    }

    this.setData({
      activeMenuPostId: '',
      feedManageActions: [],
    })
  },

  onFeedMenuPanelTap() {},

  async openColumnPicker(postId: string) {
    const targetPost = this.getFeedItemById(postId)
    if (!targetPost) {
      wx.showToast({
        title: '未找到对应帖子',
        icon: 'none',
      })
      return
    }

    this.setData({
      activeMenuPostId: '',
      feedManageActions: [],
      columnPickerVisible: true,
      columnPickerLoading: true,
      columnPickerSubmitting: false,
      columnPickerPostId: postId,
      columnPickerPostTitle: targetPost.title || '这条帖子',
      columnPickerCurrentColumnId: targetPost.columnId || '',
      columnPickerColumns: [],
    })

    const applyLocalColumns = () => {
      const localColumns = listLocalPlanetColumns(this.data.planetId)
      this.setData({
        columnPickerLoading: false,
        columnPickerColumns: localColumns.items.map((item) => ({
          id: item.id,
          title: item.title,
          count: Number(item.count || 0),
          isCurrent: item.id === (targetPost.columnId || ''),
        })),
      })
    }

    const session = await this.ensurePlanetSession()
    if (!session || !session.sessionToken) {
      applyLocalColumns()
      return
    }

    try {
      const response = await fetchPlanetColumns({
        groupId: this.data.planetId,
        sessionToken: session.sessionToken,
        userId: session.id,
      })

      if (!response.ok || !response.data) {
        throw new Error('加载专栏失败，请稍后重试')
      }

      const columnPickerColumns = Array.isArray(response.data.items)
        ? response.data.items.map((item) => ({
            id: item.id,
            title: item.title,
            count: Number(item.count || 0),
            isCurrent: item.id === (targetPost.columnId || ''),
          }))
        : []

      this.setData({
        columnPickerLoading: false,
        columnPickerColumns,
      })
    } catch {
      applyLocalColumns()
    }
  },

  onCloseColumnPicker() {
    if (!this.data.columnPickerVisible || this.data.columnPickerSubmitting) {
      return
    }

    this.setData({
      columnPickerVisible: false,
      columnPickerLoading: false,
      columnPickerPostId: '',
      columnPickerPostTitle: '',
      columnPickerCurrentColumnId: '',
      columnPickerColumns: [],
    })
  },

  onColumnPickerPanelTap() {},

  async onSelectPostColumn(e: WechatMiniprogram.TouchEvent) {
    const columnId = String(e.currentTarget.dataset.columnId || '')
    const postId = this.data.columnPickerPostId

    if (!postId || this.data.columnPickerSubmitting) {
      return
    }

    if (columnId === this.data.columnPickerCurrentColumnId) {
      this.onCloseColumnPicker()
      return
    }

    this.setData({
      columnPickerSubmitting: true,
    })

    wx.showLoading({
      title: columnId ? '归类中' : '移出中',
      mask: true,
    })

    const targetColumn = this.data.columnPickerColumns.find((item) => item.id === columnId)
    const applyLocalAssignment = async () => {
      const updatedPost = assignLocalPlanetPostColumn({
        postId,
        columnId,
        columnTitle: targetColumn ? targetColumn.title : '',
      })

      if (!updatedPost) {
        throw new Error('未找到对应帖子')
      }

      wx.hideLoading()
      this.setData({
        columnPickerVisible: false,
        columnPickerLoading: false,
        columnPickerSubmitting: false,
        columnPickerPostId: '',
        columnPickerPostTitle: '',
        columnPickerCurrentColumnId: '',
        columnPickerColumns: [],
      })

      wx.showToast({
        title: columnId ? '已归入专栏' : '已移出专栏',
        icon: 'success',
      })

      await this.refreshFeedContent(this.data.planetId)
    }

    const session = await this.ensurePlanetSession()
    if (!session || !session.sessionToken) {
      try {
        await applyLocalAssignment()
      } catch (error) {
        wx.hideLoading()
        this.setData({
          columnPickerSubmitting: false,
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '保存专栏归类失败，请稍后重试',
          icon: 'none',
        })
      }
      return
    }

    try {
      const response = await assignPlanetPostColumn({
        postId,
        columnId,
        sessionToken: session.sessionToken,
        userId: session.id,
      })

      if (!response.ok) {
        throw new Error('保存专栏归类失败，请稍后重试')
      }

      wx.hideLoading()
      this.setData({
        columnPickerVisible: false,
        columnPickerLoading: false,
        columnPickerSubmitting: false,
        columnPickerPostId: '',
        columnPickerPostTitle: '',
        columnPickerCurrentColumnId: '',
        columnPickerColumns: [],
      })

      wx.showToast({
        title: columnId ? '已归入专栏' : '已移出专栏',
        icon: 'success',
      })

      await this.refreshFeedContent(this.data.planetId)
    } catch {
      try {
        await applyLocalAssignment()
      } catch (error) {
        wx.hideLoading()
        this.setData({
          columnPickerSubmitting: false,
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '保存专栏归类失败，请稍后重试',
          icon: 'none',
        })
      }
    }
  },

  async onFeedManageActionTap(e: WechatMiniprogram.TouchEvent) {
    const actionKey = String(e.currentTarget.dataset.key || '')
    const postId = String(e.currentTarget.dataset.id || '')
    const isEssence = toDatasetBoolean(e.currentTarget.dataset.isEssence)
    const isPinned = toDatasetBoolean(e.currentTarget.dataset.isPinned)

    if (!actionKey || !postId || this.data.menuLoadingPostId) {
      return
    }

    if (actionKey === 'assignColumn') {
      void this.openColumnPicker(postId)
      return
    }

    if (actionKey === 'editPost') {
      this.setData({
        activeMenuPostId: '',
        feedManageActions: [],
      })
      this.navigateToFeedEditor(postId)
      return
    }

    if (actionKey === 'copyTitle') {
      this.setData({
        activeMenuPostId: '',
        feedManageActions: [],
      })
      this.copyFeedTitle(postId)
      return
    }

    if (actionKey === 'reportPost') {
      this.setData({
        activeMenuPostId: '',
        feedManageActions: [],
      })
      this.openFeedReport(postId)
      return
    }

    let loadingTitle = '处理中'
    const nextValue = actionKey === 'toggleEssence' ? !isEssence : !isPinned
    if (actionKey === 'toggleEssence') {
      loadingTitle = isEssence ? '取消精华中' : '设为精华中'
    }

    if (actionKey === 'togglePinned') {
      loadingTitle = isPinned ? '取消置顶中' : '置顶中'
    }

    this.setData({
      menuLoadingPostId: postId,
    })

    wx.showLoading({
      title: loadingTitle,
      mask: true,
    })

    const applyLocalManageAction = async () => {
      const updatedPost =
        actionKey === 'toggleEssence'
          ? toggleLocalPostEssence(postId, !isEssence)
          : actionKey === 'togglePinned'
            ? toggleLocalPostPinned(postId, !isPinned)
            : null

      if (!updatedPost) {
        throw new Error('未找到对应帖子')
      }

      wx.hideLoading()
      this.setData({
        activeMenuPostId: '',
        feedManageActions: [],
        menuLoadingPostId: '',
      })

      wx.showToast({
        title: actionKey === 'toggleEssence' ? (isEssence ? '已取消精华' : '已设为精华') : isPinned ? '已取消置顶' : '已置顶',
        icon: 'success',
      })

      await this.refreshFeedContent(this.data.planetId)
    }

    const session = await this.ensurePlanetSession()
    if (!session || !session.sessionToken) {
      try {
        await applyLocalManageAction()
      } catch (error) {
        wx.hideLoading()
        this.setData({
          menuLoadingPostId: '',
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '操作失败，请稍后重试',
          icon: 'none',
        })
      }
      return
    }

    const payload: Record<string, any> = {
      postId,
      sessionToken: session.sessionToken,
    }
    if (actionKey === 'toggleEssence') {
      payload.isEssence = nextValue
    }
    if (actionKey === 'togglePinned') {
      payload.isPinned = nextValue
    }

    try {
      const response = await updatePlanetPost(payload)
      if (!response.ok) {
        throw new Error('操作失败，请稍后重试')
      }

      wx.hideLoading()
      this.setData({
        activeMenuPostId: '',
        feedManageActions: [],
        menuLoadingPostId: '',
      })

      wx.showToast({
        title: actionKey === 'toggleEssence' ? (isEssence ? '已取消精华' : '已设为精华') : isPinned ? '已取消置顶' : '已置顶',
        icon: 'success',
      })

      await this.refreshFeedContent(this.data.planetId)
    } catch {
      try {
        await applyLocalManageAction()
      } catch (error) {
        wx.hideLoading()
        this.setData({
          menuLoadingPostId: '',
        })
        wx.showToast({
          title: error instanceof Error ? error.message : '操作失败，请稍后重试',
          icon: 'none',
        })
      }
    }
  },

  onPublish() {
    if (this.data.publishMenuVisible) {
      return
    }

    this.setData({
      publishMenuVisible: true,
    })
  },

  onClosePublishMenu() {
    if (!this.data.publishMenuVisible) {
      return
    }

    this.setData({
      publishMenuVisible: false,
    })
  },

  onPublishPanelTap() {},

  onPublishOptionTap(e: WechatMiniprogram.TouchEvent) {
    const publishType = String(e.currentTarget.dataset.type || 'normal')

    this.setData({
      publishMenuVisible: false,
    })

    wx.navigateTo({
      url: `/pages/planet-publish/index?planetId=${this.data.planetId}&planetName=${encodeURIComponent(this.data.planetName)}&publishType=${publishType}`,
    })
  },

  onShareAppMessage() {
    return {
      title: `邀请你加入「${this.data.planetName}」`,
      path: `/pages/planet/home?id=${this.data.planetId}`,
    }
  },

  onShareTimeline() {
    return {
      title: `邀请你加入「${this.data.planetName}」`,
      query: `id=${this.data.planetId}`,
    }
  },
})
