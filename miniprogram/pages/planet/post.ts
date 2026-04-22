import {
  addComment,
  getPinnedPostById,
  getPlanetById,
  getPostById,
  isPostOwnedByCurrentUser,
  loadComments,
  PlanetComment,
  PlanetPinnedPost,
  PlanetPost,
  toggleLike,
} from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import {
  createArticleUnlockOrder,
  createPlanetComment,
  fetchOrderDetail,
  fetchPlanetComments,
  fetchPlanetHome,
  fetchPlanetPostDetail,
  mockArticleUnlockPayment,
  reportPlanetPost,
  togglePlanetCommentLike,
  togglePlanetPostLike,
} from '../../utils/planet-api'
import {
  navigateToPlanetIndex,
  normalizePlanetId,
  rememberActivePlanetId,
  resolvePlanetIdFromOptions,
} from '../../utils/planet-route'
import {
  createEmptyModerationNotice,
  type ModerationNoticeView,
  mapViewerModerationNotice,
} from '../../utils/post-moderation'
import { normalizeAssetUrl, normalizeRichTextAssetUrls, prepareAssetDisplayUrls } from '../../utils/request'
import { ensureWechatSession } from '../../utils/wechat-login'

interface CommentView {
  id: string
  author: string
  time: string
  content: string
  likeCount: number
  liked: boolean
}

interface PostAttachmentFile {
  name: string
  url: string
  sizeText: string
  mimeType: string
}

interface PostAttachmentVideo {
  name: string
  url: string
  poster: string
  sizeText: string
  mimeType: string
}

type ArticleAccessType = 'free' | 'paid'
type ArticlePreviewMode = 'paragraph' | 'ratio'

interface PostArticleAccessState {
  accessType: ArticleAccessType
  priceLabel: string
  canReadFull: boolean
  visibleRichContent: string
  hiddenHint: string
  showPaywallCard: boolean
  paywallTitle: string
  paywallSubtitle: string
  paywallButtonText: string
}

interface PostDetailView {
  id: string
  groupId: string
  authorId: string
  displayAuthor: string
  avatar: string
  time: string
  title: string
  richContent: string
  coverImageUrl: string
  tags: string[]
  images: string[]
  displayImages: string[]
  videos: PostAttachmentVideo[]
  files: PostAttachmentFile[]
  likeCount: number
  commentCount: number
  liked: boolean
  isRichContent: boolean
  accessType: ArticleAccessType
  priceLabel: string
  canReadFull: boolean
  hiddenHint: string
  showPaywallCard: boolean
  paywallTitle: string
  paywallSubtitle: string
  paywallButtonText: string
  columnId?: string
  columnTitle?: string
}

interface JoinPlanetCardView {
  planetName: string
  ownerName: string
  priceText: string
  metaText: string
  avatarImageUrl: string
  initial: string
}

type ArticleUnlockWechatPaymentRequest = {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

let currentPostId = ''
let currentPlanetId = ''
let currentPlanetName = ''
let currentSource = ''
let skipNextOnShowRefresh = false
const ARTICLE_RICH_BLOCK_PATTERN =
  /(<h[1-6]\b[\s\S]*?<\/h[1-6]>|<p\b[\s\S]*?<\/p>|<blockquote\b[\s\S]*?<\/blockquote>|<ul\b[\s\S]*?<\/ul>|<ol\b[\s\S]*?<\/ol>|<pre\b[\s\S]*?<\/pre>|<figure\b[\s\S]*?<\/figure>|<div\b[\s\S]*?<\/div>|<video\b[\s\S]*?<\/video>|<img\b[^>]*>|<hr\b[^>]*>)/gi
const reportReasonOptions = [
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
const buildJoinPlanetPriceText = (isFree: boolean, price: number, fallbackPriceLabel = '') => {
  if (isFree) {
    return '免费加入'
  }

  if (fallbackPriceLabel) {
    return fallbackPriceLabel
  }

  return price > 0 ? `¥${price}/年` : ''
}

const waitFor = (duration = 0) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), duration)
  })

const requestWechatPayment = (paymentRequest: ArticleUnlockWechatPaymentRequest) =>
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

const isDevelopEnv = () => {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const miniProgram = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram : null
    return !miniProgram || miniProgram.envVersion === 'develop'
  } catch {
    return true
  }
}

const buildJoinPlanetMetaText = (ownerName: string, priceText: string) => {
  if (ownerName && priceText) {
    return `主理人 ${ownerName} ｜ ${priceText}`
  }

  if (ownerName) {
    return `主理人 ${ownerName}`
  }

  return priceText
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
const isVideoUrl = (value: string) => /\.(mp4|m4v|mov|webm|ogv|ogg)(\?.*)?$/i.test(value)

function escapeRichText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toRichParagraphs(value: string) {
  return String(value || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<p>${escapeRichText(item)}</p>`)
    .join('')
}

function splitTextParagraphs(value: string) {
  return String(value || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatArticlePriceLabel(priceAmount: number) {
  const normalizedPrice = Number.isFinite(priceAmount) ? Math.max(0, Math.round(priceAmount)) : 0
  return normalizedPrice > 0 ? `¥${normalizedPrice}` : '免费'
}

function normalizeNumericValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function countRichContentBlocks(richContent: string) {
  const normalizedRichContent = String(richContent || '').trim()
  if (!normalizedRichContent) {
    return 0
  }

  const blocks = normalizedRichContent.match(ARTICLE_RICH_BLOCK_PATTERN)
  if (blocks && blocks.length) {
    return blocks.length
  }

  const plainText = normalizedRichContent.replace(/<[^>]+>/g, '\n')
  return splitTextParagraphs(plainText).length
}

function buildPreviewRichContentFromFull(richContent: string, previewMode: ArticlePreviewMode, previewValue: number) {
  const normalizedRichContent = String(richContent || '').trim()
  if (!normalizedRichContent) {
    return ''
  }

  const blocks = normalizedRichContent.match(ARTICLE_RICH_BLOCK_PATTERN)
  if (!blocks || !blocks.length) {
    return ''
  }

  const totalBlockCount = blocks.length
  let previewCount = totalBlockCount

  if (previewMode === 'ratio') {
    const normalizedRatio = Math.max(0.1, Math.min(1, previewValue || 0))
    previewCount = Math.max(1, Math.ceil(totalBlockCount * normalizedRatio))
  } else {
    previewCount = Math.max(1, Math.min(totalBlockCount, Math.floor(previewValue || 0)))
  }

  return blocks.slice(0, previewCount).join('')
}

function createDefaultPostArticleAccessState(): PostArticleAccessState {
  return {
    accessType: 'free',
    priceLabel: '免费',
    canReadFull: true,
    visibleRichContent: '',
    hiddenHint: '免费全文',
    showPaywallCard: false,
    paywallTitle: '',
    paywallSubtitle: '',
    paywallButtonText: '',
  }
}

function resolvePostArticleAccessState(
  metadata: Record<string, any>,
  richContent: string,
  contentText: string
): PostArticleAccessState {
  const rawAccess =
    metadata.articleAccess && typeof metadata.articleAccess === 'object'
      ? (metadata.articleAccess as Record<string, unknown>)
      : metadata
  const accessType: ArticleAccessType = rawAccess.accessType === 'paid' ? 'paid' : 'free'
  const priceAmount = accessType === 'paid' ? Math.max(0, Math.round(normalizeNumericValue(rawAccess.priceAmount))) : 0
  const priceLabel =
    accessType === 'paid' && typeof rawAccess.priceLabel === 'string' && rawAccess.priceLabel.trim()
      ? rawAccess.priceLabel.trim()
      : accessType === 'paid'
        ? formatArticlePriceLabel(priceAmount)
        : '免费'
  const isUnlocked = accessType === 'free' ? true : Boolean(rawAccess.isUnlocked)
  const previewMode: ArticlePreviewMode = rawAccess.previewMode === 'ratio' ? 'ratio' : 'paragraph'
  const previewValue = normalizeNumericValue(rawAccess.previewValue)
  const fallbackRichContent = richContent || toRichParagraphs(contentText)
  const fallbackPreviewRichContent =
    typeof rawAccess.previewRichContent === 'string' && rawAccess.previewRichContent.trim()
      ? normalizeRichTextAssetUrls(String(rawAccess.previewRichContent))
      : typeof metadata.previewRichContent === 'string' && metadata.previewRichContent.trim()
        ? normalizeRichTextAssetUrls(metadata.previewRichContent)
      : buildPreviewRichContentFromFull(fallbackRichContent, previewMode, previewValue)
  const previewText =
    typeof rawAccess.previewText === 'string'
      ? String(rawAccess.previewText || '').trim()
      : typeof metadata.previewText === 'string'
        ? String(metadata.previewText || '').trim()
        : ''
  const canReadFull = accessType === 'free' || isUnlocked
  const visibleRichContent = canReadFull
    ? fallbackRichContent
    : fallbackPreviewRichContent || toRichParagraphs(previewText || contentText)
  const fullParagraphCount = Math.max(
    0,
    Math.round(
      normalizeNumericValue(rawAccess.contentParagraphCount) ||
        countRichContentBlocks(fallbackRichContent) ||
        splitTextParagraphs(contentText).length
    )
  )
  const previewParagraphCount = canReadFull
    ? fullParagraphCount
    : Math.max(
        1,
        Math.round(
          normalizeNumericValue(rawAccess.previewParagraphCount) ||
            countRichContentBlocks(visibleRichContent) ||
            splitTextParagraphs(previewText || contentText).length
        )
      );
  const hiddenParagraphCount = canReadFull ? 0 : Math.max(0, fullParagraphCount - previewParagraphCount)

  if (canReadFull) {
    return {
      accessType,
      priceLabel,
      canReadFull: true,
      visibleRichContent,
      hiddenHint: accessType === 'paid' ? '已解锁全文' : '免费全文',
      showPaywallCard: false,
      paywallTitle: '',
      paywallSubtitle: '',
      paywallButtonText: '',
    }
  }

  return {
    accessType,
    priceLabel,
    canReadFull: false,
    visibleRichContent,
    hiddenHint: `可试看前 ${previewParagraphCount} 段`,
    showPaywallCard: true,
    paywallTitle: hiddenParagraphCount > 0 ? `解锁剩余 ${hiddenParagraphCount} 段完整内容` : '解锁完整内容',
    paywallSubtitle: `当前可试看前 ${previewParagraphCount} 段，支付 ${priceLabel} 后阅读全文`,
    paywallButtonText: `解锁全文 ${priceLabel}`,
  }
}

const createFallbackPost = (): PostDetailView => ({
  id: '',
  groupId: '',
  authorId: '',
  displayAuthor: '当前成员',
  avatar: '',
  time: '',
  title: '',
  richContent: '',
  coverImageUrl: '',
  tags: [],
  images: [],
  displayImages: [],
  videos: [],
  files: [],
  likeCount: 0,
  commentCount: 0,
  liked: false,
  isRichContent: false,
  ...createDefaultPostArticleAccessState(),
  columnId: '',
  columnTitle: '',
})

const extractImages = (post: Record<string, any>) => {
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
        (item: unknown) => typeof item === 'string' && isImageUrl(item)
      )
        .map((item: unknown) => normalizeAssetUrl(String(item)))
        .filter((item: unknown) => isAssetUrl(String(item)))
    : []

  return Array.from(new Set(attachmentImages.concat(metadataImages))).slice(0, 9)
}

const extractVideos = (post: Record<string, any>) => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const seenUrls = new Set<string>()
  const videos: PostAttachmentVideo[] = []

  const appendVideo = (input: {
    name?: string
    url?: string
    poster?: string
    sizeText?: string
    mimeType?: string
  }, fallbackName: string) => {
    const normalizedUrl = normalizeAssetUrl(typeof input.url === 'string' ? input.url : '')
    if (!normalizedUrl || !isAssetUrl(normalizedUrl) || !isVideoUrl(normalizedUrl) || seenUrls.has(normalizedUrl)) {
      return
    }

    seenUrls.add(normalizedUrl)
    videos.push({
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : fallbackName,
      url: normalizedUrl,
      poster: normalizeAssetUrl(typeof input.poster === 'string' ? input.poster : ''),
      sizeText: typeof input.sizeText === 'string' ? input.sizeText : '',
      mimeType: typeof input.mimeType === 'string' ? input.mimeType : '',
    })
  }

  const attachmentVideos = Array.isArray(post.attachments) ? post.attachments : []
  attachmentVideos.forEach((item: unknown, index: number) => {
    if (typeof item === 'string') {
      appendVideo(
        {
          url: item,
        },
        `视频 ${index + 1}`
      )
      return
    }

    if (item && typeof item === 'object') {
      const videoItem = item as Record<string, unknown>
      appendVideo(
        {
          name: typeof videoItem.name === 'string' ? videoItem.name : '',
          url: typeof videoItem.url === 'string' ? videoItem.url : '',
          poster: typeof videoItem.poster === 'string' ? videoItem.poster : '',
          sizeText: typeof videoItem.sizeText === 'string' ? videoItem.sizeText : '',
          mimeType: typeof videoItem.mimeType === 'string' ? videoItem.mimeType : '',
        },
        `视频 ${index + 1}`
      )
    }
  })

  const metadataVideos = Array.isArray(metadata.videoAttachments) ? metadata.videoAttachments : []
  metadataVideos.forEach((item: unknown, index: number) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const videoItem = item as Record<string, unknown>
    appendVideo(
      {
        name: typeof videoItem.name === 'string' ? videoItem.name : '',
        url: typeof videoItem.url === 'string' ? videoItem.url : '',
        poster: typeof videoItem.poster === 'string' ? videoItem.poster : '',
        sizeText: typeof videoItem.sizeText === 'string' ? videoItem.sizeText : '',
        mimeType: typeof videoItem.mimeType === 'string' ? videoItem.mimeType : '',
      },
      `视频 ${index + 1}`
    )
  })

  const metadataVideoUrls = Array.isArray(metadata.videos) ? metadata.videos : []
  metadataVideoUrls.forEach((item: unknown, index: number) => {
    if (typeof item !== 'string') {
      return
    }

    appendVideo(
      {
        url: item,
      },
      `视频 ${index + 1}`
    )
  })

  return videos.slice(0, 5)
}

const mapRemotePost = (post: Record<string, any>): PostDetailView => {
  const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
  const richContent = normalizeRichTextAssetUrls(typeof metadata.richContent === 'string' ? metadata.richContent : '')
  const title = String(post.title || '').trim()
  const contentText = String(post.contentText || '').trim()
  const articleAccess = resolvePostArticleAccessState(metadata, richContent, contentText)
  const images = extractImages(post)
  const videos = extractVideos(post)
  const files = Array.isArray(metadata.fileAttachments)
    ? metadata.fileAttachments
        .map((item: unknown) => {
          if (!item || typeof item !== 'object') {
            return null
          }

          const fileItem = item as Record<string, unknown>
          const url = typeof fileItem.url === 'string' ? fileItem.url : ''
          if (!url) {
            return null
          }

          return {
            name: typeof fileItem.name === 'string' && fileItem.name.trim() ? fileItem.name.trim() : '附件资料',
            url: normalizeAssetUrl(url),
            sizeText: typeof fileItem.sizeText === 'string' ? fileItem.sizeText : '',
            mimeType: typeof fileItem.mimeType === 'string' ? fileItem.mimeType : '',
          } as PostAttachmentFile
        })
        .filter((item: unknown): item is PostAttachmentFile => !!item)
    : []

  return {
    id: String(post.id || ''),
    groupId: String(post.groupId || ''),
    authorId:
      post.author && typeof post.author === 'object' && typeof post.author.id === 'string'
        ? post.author.id
        : '',
    displayAuthor:
      post.author && typeof post.author === 'object' && typeof post.author.nickname === 'string'
        ? post.author.nickname
        : '当前成员',
    avatar:
      post.author && typeof post.author === 'object' && typeof post.author.avatarUrl === 'string'
        ? normalizeAssetUrl(post.author.avatarUrl)
        : '',
    time: formatPostTime(post.publishedAt || post.createdAt || ''),
    title: title || contentText,
    richContent: articleAccess.visibleRichContent,
    coverImageUrl: normalizeAssetUrl(
      String(
        post.coverUrl ||
          (typeof metadata.coverUrl === 'string' ? metadata.coverUrl : '') ||
          (typeof metadata.coverImageUrl === 'string' ? metadata.coverImageUrl : '')
      )
    ),
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((item: unknown) => typeof item === 'string') : [],
    images: articleAccess.canReadFull ? images : [],
    displayImages: articleAccess.canReadFull ? images : [],
    videos: articleAccess.canReadFull ? videos : [],
    files: articleAccess.canReadFull ? files : [],
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
    liked: !!post.viewerLiked,
    isRichContent: !!articleAccess.visibleRichContent,
    accessType: articleAccess.accessType,
    priceLabel: articleAccess.priceLabel,
    canReadFull: articleAccess.canReadFull,
    hiddenHint: articleAccess.hiddenHint,
    showPaywallCard: articleAccess.showPaywallCard,
    paywallTitle: articleAccess.paywallTitle,
    paywallSubtitle: articleAccess.paywallSubtitle,
    paywallButtonText: articleAccess.paywallButtonText,
    columnId: typeof metadata.columnId === 'string' ? metadata.columnId : undefined,
    columnTitle: typeof metadata.columnTitle === 'string' ? metadata.columnTitle : undefined,
  }
}

const mapRemoteComment = (comment: Record<string, any>): CommentView => ({
  id: String(comment.id || ''),
  author:
    comment.author && typeof comment.author === 'object' && typeof comment.author.nickname === 'string'
      ? comment.author.nickname
      : '当前成员',
  time: formatPostTime(comment.createdAt || ''),
  content: String(comment.content || '').trim(),
  likeCount: Number(comment.likeCount || 0),
  liked: !!comment.viewerLiked,
})

const mapLocalComment = (comment: PlanetComment): CommentView => ({
  id: comment.id,
  author: comment.author || '当前成员',
  time: comment.time || '',
  content: comment.content || '',
  likeCount: 0,
  liked: false,
})

const mapLocalPost = (post: PlanetPost): PostDetailView => ({
  id: post.id,
  groupId: normalizePlanetId(post.planetId) || '',
  authorId: post.authorId || '',
  displayAuthor: post.author || '当前成员',
  avatar: post.avatar || '',
  time: post.time || '',
  title: post.title || '',
  richContent: post.richContent && post.richContent.trim() ? post.richContent : toRichParagraphs(post.content),
  coverImageUrl: normalizeAssetUrl(typeof post.coverImageUrl === 'string' ? post.coverImageUrl : ''),
  tags: Array.isArray(post.tags) ? post.tags : [],
  images: Array.isArray(post.images) ? post.images : [],
  displayImages: Array.isArray(post.images) ? post.images : [],
  videos: [],
  files: Array.isArray(post.fileAttachments)
    ? post.fileAttachments.map((item) => ({
        name: item.name || '附件资料',
        url: item.url || '',
        sizeText: item.sizeText || '',
        mimeType: item.mimeType || '',
      }))
    : [],
  likeCount: Number(post.likeCount || 0),
  commentCount: Number(post.commentCount || 0),
  liked: !!post.liked,
  isRichContent: true,
  accessType: 'free',
  priceLabel: '免费',
  canReadFull: true,
  hiddenHint: '免费全文',
  showPaywallCard: false,
  paywallTitle: '',
  paywallSubtitle: '',
  paywallButtonText: '',
  columnId: typeof post.columnId === 'string' ? post.columnId : '',
  columnTitle: typeof post.columnTitle === 'string' ? post.columnTitle : '',
})

const mapLocalPinnedPost = (post: PlanetPinnedPost, fallbackPlanetId: string): PostDetailView => ({
  id: post.id,
  groupId: normalizePlanetId(post.planetId || fallbackPlanetId) || '',
  authorId: '',
  displayAuthor: post.author || '当前成员',
  avatar: '',
  time: post.time || '',
  title: post.title || '',
  richContent: toRichParagraphs(post.content),
  coverImageUrl: '',
  tags: [],
  images: Array.isArray(post.images) ? post.images : [],
  displayImages: Array.isArray(post.images) ? post.images : [],
  videos: [],
  files: [],
  likeCount: Number(post.likeCount || 0),
  commentCount: Number(post.commentCount || 0),
  liked: !!post.liked,
  isRichContent: true,
  accessType: 'free',
  priceLabel: '免费',
  canReadFull: true,
  hiddenHint: '免费全文',
  showPaywallCard: false,
  paywallTitle: '',
  paywallSubtitle: '',
  paywallButtonText: '',
  columnId: '',
  columnTitle: '',
})

const resolveLocalPostFallback = (postId: string, fallbackPlanetId: string) => {
  const localPost = getPostById(postId)
  if (localPost) {
    return {
      post: mapLocalPost(localPost),
      comments: loadComments(postId).map(mapLocalComment),
      canEdit: isPostOwnedByCurrentUser(localPost),
    }
  }

  const localPinnedPost = getPinnedPostById(postId)
  if (localPinnedPost) {
    return {
      post: mapLocalPinnedPost(localPinnedPost, fallbackPlanetId),
      comments: loadComments(postId).map(mapLocalComment),
      canEdit: false,
    }
  }

  return null
}

const buildPostImageSignature = (post: PostDetailView) => `${post.id}:${post.images.join(',')}`

Page({
  data: {
    post: createFallbackPost(),
    moderationNotice: createEmptyModerationNotice() as ModerationNoticeView,
    commentInput: '',
    comments: [] as CommentView[],
    canLike: true,
    canEdit: false,
    canManagePlanet: false,
    canReport: false,
    reporting: false,
    unlocking: false,
    isLocalFallback: false,
    showJoinPlanetEntry: false,
    joinPlanetCard: {
      planetName: '这个星球',
      ownerName: '',
      priceText: '',
      metaText: '',
      avatarImageUrl: '',
      initial: '星',
    } as JoinPlanetCardView,
  },

  syncPostDisplayImages(post: PostDetailView) {
    if (!post || !Array.isArray(post.images) || !post.images.length) {
      return
    }

    const signature = buildPostImageSignature(post)

    prepareAssetDisplayUrls(post.images)
      .then((displayImages) => {
        if (buildPostImageSignature(this.data.post) !== signature) {
          return
        }

        if (displayImages.join('|') === this.data.post.displayImages.join('|')) {
          return
        }

        this.setData({
          post: {
            ...this.data.post,
            displayImages,
          },
        })
      })
      .catch(() => {})
  },

  onPostAvatarError() {
    if (!this.data.post.avatar) {
      return
    }

    this.setData({
      post: {
        ...this.data.post,
        avatar: '',
      },
    })
  },

  async onOpenAttachment(e: WechatMiniprogram.TouchEvent) {
    const url = String(e.currentTarget.dataset.url || '')
    const name = String(e.currentTarget.dataset.name || '附件资料')
    if (!url) {
      return
    }

    wx.showLoading({
      title: '打开文件中',
      mask: true,
    })

    try {
      const fileType = (name.split('.').pop() || '') as WechatMiniprogram.OpenDocumentOption['fileType']
      const isRemoteAsset = /^https?:\/\//.test(url) || /^\//.test(url)

      if (!isRemoteAsset) {
        await new Promise<void>((resolve, reject) => {
          wx.openDocument({
            filePath: url,
            fileType,
            showMenu: true,
            success: () => resolve(),
            fail: reject,
          })
        })
        return
      }

      const downloadResult = await new Promise<WechatMiniprogram.DownloadFileSuccessCallbackResult>((resolve, reject) => {
        wx.downloadFile({
          url,
          success: resolve,
          fail: reject,
        })
      })

      if (downloadResult.statusCode < 200 || downloadResult.statusCode >= 300 || !downloadResult.tempFilePath) {
        throw new Error('文件下载失败')
      }

      await new Promise<void>((resolve, reject) => {
        wx.openDocument({
          filePath: downloadResult.tempFilePath,
          fileType,
          showMenu: true,
          success: () => resolve(),
          fail: reject,
        })
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '打开文件失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  onLoad(options: Record<string, string>) {
    currentPostId = options.id || ''
    currentPlanetId = resolvePlanetIdFromOptions(options, ['planetId', 'groupId'], false)
    currentPlanetName = options.planetName ? decodeURIComponent(options.planetName) : ''
    currentSource = options.source || ''
    skipNextOnShowRefresh = true

    if (!currentPostId) {
      navigateToPlanetIndex('帖子参数缺失')
      return
    }

    this.syncJoinPlanetEntry()
    void this.refreshPostDetail(true)
  },

  onShow() {
    if (skipNextOnShowRefresh) {
      skipNextOnShowRefresh = false
      return
    }

    this.syncJoinPlanetEntry()
    void this.refreshPostDetail(false)
  },

  canCurrentUserEditPost(post: PostDetailView) {
    const session = getStoredSession()
    return !!(session && session.id && post.authorId && session.id === post.authorId)
  },

  syncJoinPlanetEntry() {
    const planet = currentPlanetId ? getPlanetById(currentPlanetId) : null
    const isJoined = !!(planet && planet.joined)
    const showJoinPlanetEntry = currentSource === 'discover-featured' && !isJoined
    const fallbackPlanetName = currentPlanetName || (planet && planet.name) || this.data.joinPlanetCard.planetName || '这个星球'
    const ownerName = (planet && planet.ownerName) || this.data.joinPlanetCard.ownerName || ''
    const priceText = planet
      ? buildJoinPlanetPriceText(planet.isFree, planet.price, planet.priceLabel)
      : this.data.joinPlanetCard.priceText
    const avatarImageUrl = (planet && planet.avatarImageUrl) || this.data.joinPlanetCard.avatarImageUrl || ''

    this.setData({
      showJoinPlanetEntry,
      joinPlanetCard: {
        planetName: fallbackPlanetName,
        ownerName,
        priceText,
        metaText: buildJoinPlanetMetaText(ownerName, priceText),
        avatarImageUrl,
        initial: fallbackPlanetName.slice(0, 1) || '星',
      },
    })
  },

  async syncJoinPlanetCard() {
    if (!currentPlanetId) {
      return
    }

    const localPlanet = getPlanetById(currentPlanetId)
    const session = getStoredSession()

    try {
      const response = await fetchPlanetHome({
        groupId: currentPlanetId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response.ok || !response.data || !response.data.group || !response.data.owner) {
        return
      }

      const group = response.data.group
      const owner = response.data.owner
      const membership = response.data.membership || null
      const hasViewerSession = Boolean(session && session.id)
      const isJoined = hasViewerSession
        ? Boolean(response.data.role && (response.data.role.isOwner || response.data.role.isStaff)) ||
          Boolean(membership && membership.isActive)
        : Boolean(localPlanet && localPlanet.joined)
      const planetName = String(group.name || currentPlanetName || (localPlanet && localPlanet.name) || '这个星球')
      const ownerName = String(owner.nickname || (localPlanet && localPlanet.ownerName) || '')
      const priceText = buildJoinPlanetPriceText(group.joinType === 'FREE', Number(group.priceAmount || 0))
      const avatarImageUrl = normalizeAssetUrl(
        String(group.avatarUrl || owner.avatarUrl || (localPlanet && localPlanet.avatarImageUrl) || '')
      )

      currentPlanetName = planetName

      this.setData({
        showJoinPlanetEntry: currentSource === 'discover-featured' && !isJoined,
        canManagePlanet: Boolean(response.data.role && response.data.role.canManage),
        canReport:
          !this.data.isLocalFallback &&
          !this.canCurrentUserEditPost(this.data.post) &&
          !Boolean(response.data.role && response.data.role.canManage),
        joinPlanetCard: {
          planetName,
          ownerName,
          priceText,
          metaText: buildJoinPlanetMetaText(ownerName, priceText),
          avatarImageUrl,
          initial: planetName.slice(0, 1) || '星',
        },
      })
    } catch {
      // 推荐流帖子详情优先保证可读，加入卡片同步失败时保留本地回退数据
    }
  },

  async refreshPostDetail(incrementRead = false) {
    const postId = currentPostId
    if (!postId) {
      this.setData({
        post: createFallbackPost(),
        moderationNotice: createEmptyModerationNotice(),
        comments: [],
        canLike: false,
        canEdit: false,
      })
      return
    }

    try {
      const session = getStoredSession()
      const sessionToken = session && session.sessionToken ? session.sessionToken : ''
      const [postResponse, commentsResponse] = await Promise.all([
        fetchPlanetPostDetail(postId, incrementRead, sessionToken),
        fetchPlanetComments(postId, sessionToken),
      ])

      if (!postResponse.ok || !postResponse.data) {
        throw new Error('帖子不存在')
      }

      const post = mapRemotePost(postResponse.data)
      if (post.groupId) {
        currentPlanetId = normalizePlanetId(post.groupId)
        rememberActivePlanetId(currentPlanetId)
      }
      const comments =
        commentsResponse.ok && Array.isArray(commentsResponse.data)
          ? commentsResponse.data.map(mapRemoteComment)
          : []

      this.setData(
        {
          post,
          moderationNotice: mapViewerModerationNotice(postResponse.data),
          comments,
          canLike: true,
          canEdit: this.canCurrentUserEditPost(post),
          canManagePlanet: false,
          canReport: !this.canCurrentUserEditPost(post),
          reporting: false,
          isLocalFallback: false,
        },
        () => {
          this.syncPostDisplayImages(post)
        }
      )
      this.syncJoinPlanetEntry()
      void this.syncJoinPlanetCard()
    } catch (error) {
      const localFallback = resolveLocalPostFallback(postId, currentPlanetId)
      if (localFallback) {
        if (localFallback.post.groupId) {
          currentPlanetId = localFallback.post.groupId
          rememberActivePlanetId(currentPlanetId)
        }

        this.setData(
          {
            post: localFallback.post,
            moderationNotice: createEmptyModerationNotice(),
            comments: localFallback.comments,
            canLike: true,
            canEdit: localFallback.canEdit,
            canManagePlanet: false,
            canReport: false,
            reporting: false,
            isLocalFallback: true,
          },
          () => {
            this.syncPostDisplayImages(localFallback.post)
          }
        )
        this.syncJoinPlanetEntry()
        return
      }

      this.setData({
        post: createFallbackPost(),
        moderationNotice: createEmptyModerationNotice(),
        comments: [],
        canLike: false,
        canEdit: false,
        canManagePlanet: false,
        canReport: false,
        reporting: false,
        isLocalFallback: false,
      })

      wx.showToast({
        title: error instanceof Error ? error.message : '帖子加载失败',
        icon: 'none',
      })
    }
  },

  onJoinPlanetTap() {
    if (!currentPlanetId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    const planet = currentPlanetId ? getPlanetById(currentPlanetId) : null
    const planetName = currentPlanetName || (planet && planet.name) || this.data.joinPlanetCard.planetName || '饮视星球'
    const creatorName = (planet && planet.ownerName) || this.data.joinPlanetCard.ownerName || ''

    wx.navigateTo({
      url: `/pages/planet/home?id=${currentPlanetId}&name=${encodeURIComponent(planetName)}&creator=${encodeURIComponent(creatorName)}&source=discover`,
    })
  },

  onUnlockArticleTap() {
    void this.unlockArticle()
  },

  async unlockArticle() {
    if (this.data.unlocking) {
      return
    }

    if (!this.data.post.id) {
      wx.showToast({
        title: '当前文章不可解锁',
        icon: 'none',
      })
      return
    }

    if (this.data.post.canReadFull) {
      wx.showToast({
        title: '当前已可阅读全文',
        icon: 'none',
      })
      return
    }

    if (this.data.post.accessType !== 'paid') {
      wx.showToast({
        title: '当前文章无需解锁',
        icon: 'none',
      })
      return
    }

    this.setData({
      unlocking: true,
    })

    try {
      wx.showLoading({
        title: '创建支付订单',
        mask: true,
      })

      const session = await ensureWechatSession()
      const orderResponse = await createArticleUnlockOrder({
        articleId: this.data.post.id,
        userId: session.id,
        paymentChannel: 'WECHAT',
        sessionToken: session.sessionToken,
      })

      if (!orderResponse.ok || !orderResponse.data || !orderResponse.data.order) {
        throw new Error(orderResponse.message || '创建文章解锁订单失败')
      }

      const orderNo = orderResponse.data.order.orderNo
      const payment = orderResponse.data.payment
      const paymentRequest = payment && payment.request ? payment.request : null
      const alreadyUnlocked = !!(orderResponse.data.unlock && orderResponse.data.unlock.isUnlocked)

      if (alreadyUnlocked || orderResponse.data.idempotent) {
        await this.refreshPostDetail(false)
        wx.hideLoading()
        wx.showToast({
          title: '已解锁全文',
          icon: 'success',
        })
        return
      }

      if (payment && payment.required) {
        if (!paymentRequest) {
          throw new Error('未获取到微信支付参数，请稍后重试')
        }

        wx.hideLoading()

        try {
          await requestWechatPayment(paymentRequest)
        } catch (error) {
          if (isPaymentCancelled(error)) {
            wx.showToast({
              title: '已取消支付',
              icon: 'none',
            })
            return
          }

          if (!isDevelopEnv()) {
            throw new Error('微信支付未完成，请稍后重试')
          }

          wx.showLoading({
            title: '开发态模拟支付',
            mask: true,
          })

          await mockArticleUnlockPayment({
            orderNo,
            transactionNo: `MOCK_ARTICLE_${Date.now()}`,
            success: true,
          })
        }
      }

      wx.showLoading({
        title: '确认解锁结果',
        mask: true,
      })

      let unlocked = false
      for (let index = 0; index < 15; index += 1) {
        try {
          await fetchOrderDetail({
            orderNo,
            sessionToken: session.sessionToken,
            userId: session.id,
          })
        } catch {}

        await this.refreshPostDetail(false)
        if (this.data.post.canReadFull) {
          unlocked = true
          break
        }

        await waitFor(index < 4 ? 600 : 1000)
      }

      if (!unlocked) {
        throw new Error('支付结果确认中，请稍后刷新页面查看')
      }

      wx.hideLoading()
      wx.showToast({
        title: '已解锁全文',
        icon: 'success',
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error instanceof Error ? error.message : '解锁全文失败',
        icon: 'none',
      })
    } finally {
      this.setData({
        unlocking: false,
      })
    }
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({
      commentInput: e.detail.value,
    })
  },

  async onCommentConfirm() {
    const content = this.data.commentInput.trim()
    const postId = this.data.post.id
    const session = getStoredSession()

    if (!postId) {
      wx.showToast({
        title: '当前文章不可评论',
        icon: 'none',
      })
      return
    }

    if (!content) {
      wx.showToast({
        title: '请输入观点内容',
        icon: 'none',
      })
      return
    }

    if (this.data.isLocalFallback) {
      addComment(postId, content)
      this.setData({
        commentInput: '',
      })
      await this.refreshPostDetail()
      wx.showToast({
        title: '观点已发布',
        icon: 'success',
      })
      return
    }

    if (!session || !session.id || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    try {
      const response = await createPlanetComment({
        postId,
        userId: session.id,
        content,
        sessionToken: session.sessionToken,
      })

      if (!response.ok) {
        throw new Error('评论失败')
      }

      this.setData({
        commentInput: '',
      })
      await this.refreshPostDetail()

      wx.showToast({
        title: '观点已发布',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '评论失败',
        icon: 'none',
      })
    }
  },

  async onLikeTap() {
    const postId = this.data.post.id
    const session = getStoredSession()
    if (!postId) {
      wx.showToast({
        title: '当前文章不可点赞',
        icon: 'none',
      })
      return
    }

    if (this.data.isLocalFallback) {
      const result = toggleLike(postId)
      if (!result) {
        wx.showToast({
          title: '点赞失败，请稍后重试',
          icon: 'none',
        })
        return
      }

      if (result.type === 'post') {
        const nextPost = mapLocalPost(result.post as PlanetPost)
        this.setData(
          {
            post: nextPost,
          },
          () => {
            this.syncPostDisplayImages(nextPost)
          }
        )
      } else {
        const nextPost = mapLocalPinnedPost(result.post as PlanetPinnedPost, currentPlanetId)
        this.setData(
          {
            post: nextPost,
          },
          () => {
            this.syncPostDisplayImages(nextPost)
          }
        )
      }
      return
    }

    if (!session || !session.sessionToken) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return
    }

    try {
      const response = await togglePlanetPostLike({
        postId,
        increment: !this.data.post.liked,
        sessionToken: session.sessionToken,
      })

      if (!response.ok || !response.data) {
        throw new Error('点赞失败')
      }

      const nextPost = mapRemotePost(response.data)
      nextPost.liked = !!response.data.viewerLiked
      this.setData(
        {
          post: nextPost,
        },
        () => {
          this.syncPostDisplayImages(nextPost)
        }
      )
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '点赞失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  async onCommentLikeTap(e: WechatMiniprogram.TouchEvent) {
    const commentId = String(e.currentTarget.dataset.id || '')
    const session = getStoredSession()

    if (!commentId) {
      return
    }

    if (this.data.isLocalFallback) {
      const nextComments = this.data.comments.map((item) =>
        item.id === commentId
          ? {
              ...item,
              likeCount: item.liked ? Math.max(0, item.likeCount - 1) : item.likeCount + 1,
              liked: !item.liked,
            }
          : item
      )

      this.setData({
        comments: nextComments,
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

    const targetComment = this.data.comments.find((item) => item.id === commentId)
    if (!targetComment) {
      return
    }

    try {
      const response = await togglePlanetCommentLike({
        commentId,
        increment: !targetComment.liked,
        sessionToken: session.sessionToken,
      })

      if (!response.ok || !response.data) {
        throw new Error('评论点赞失败')
      }

      const nextComments = this.data.comments.map((item) =>
        item.id === commentId
          ? {
              ...item,
              likeCount: Number(response.data.likeCount || 0),
              liked: !!response.data.viewerLiked,
            }
          : item
      )

      this.setData({
        comments: nextComments,
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '评论点赞失败',
        icon: 'none',
      })
    }
  },

  onReportPost() {
    const postId = this.data.post.id
    const session = getStoredSession()

    if (!postId || !this.data.canReport) {
      wx.showToast({
        title: '当前帖子不可投诉',
        icon: 'none',
      })
      return
    }

    if (this.data.isLocalFallback) {
      wx.showToast({
        title: '离线模式暂不支持投诉',
        icon: 'none',
      })
      return
    }

    if (this.data.reporting) {
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
      itemList: reportReasonOptions.map((item) => item.label),
      success: async ({ tapIndex }) => {
        const selectedReason = reportReasonOptions[tapIndex]
        if (!selectedReason) {
          return
        }

        this.setData({
          reporting: true,
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

          wx.showToast({
            title: response.data.idempotent ? '已提交过待处理投诉' : '投诉已提交',
            icon: 'success',
          })
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : '投诉提交失败',
            icon: 'none',
          })
        } finally {
          wx.hideLoading()
          this.setData({
            reporting: false,
          })
        }
      },
    })
  },

  onGeneratePoster() {
    const postId = this.data.post.id
    const planetId = this.data.post.groupId || currentPlanetId
    if (!postId) {
      wx.showToast({
        title: '当前文章不可生成长图',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/planet/poster?id=${postId}&planetId=${planetId}`,
    })
  },

  onEditPost() {
    const postId = this.data.post.id
    if (!postId || !this.data.canEdit) {
      wx.showToast({
        title: '当前帖子不可编辑',
        icon: 'none',
      })
      return
    }

    const resolvedPlanetId = this.data.post.groupId || currentPlanetId
    const planet = resolvedPlanetId ? getPlanetById(resolvedPlanetId) : null
    const planetName = currentPlanetName || (planet && planet.name) || this.data.joinPlanetCard.planetName || '饮视星球'
    const ownerName = (planet && planet.ownerName) || this.data.joinPlanetCard.ownerName || ''

    wx.navigateTo({
      url: `/pages/planet-publish/index?planetId=${resolvedPlanetId}&planetName=${encodeURIComponent(planetName)}&ownerName=${encodeURIComponent(ownerName)}&postId=${postId}`,
    })
  },

  onShareAppMessage() {
    const { post } = this.data
    const shareTitle = post.title.length > 26 ? `${post.title.slice(0, 26)}...` : post.title
    const sharePlanetId = post.groupId || currentPlanetId

    return {
      title: shareTitle || '文章详情',
      path: `/pages/planet/post?id=${post.id}&planetId=${encodeURIComponent(sharePlanetId)}`,
      imageUrl: post.coverImageUrl || post.images[0] || '',
    }
  },

  onShareTimeline() {
    const { post } = this.data
    const shareTitle = post.title.length > 26 ? `${post.title.slice(0, 26)}...` : post.title
    const sharePlanetId = post.groupId || currentPlanetId

    return {
      title: shareTitle || '文章详情',
      query: `id=${encodeURIComponent(post.id)}&planetId=${encodeURIComponent(sharePlanetId)}`,
      imageUrl: post.coverImageUrl || post.images[0] || '',
    }
  },
})
