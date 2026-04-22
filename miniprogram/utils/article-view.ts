import {
  getArticleReadPresentation,
  type ArticleAccessProfile,
  type ArticleContentSource,
  type ArticlePlanetCard,
  type ArticleRecord,
} from './article-data'
import type { PlanetArticleItem } from './planet-api'
import { normalizeAssetUrl, normalizeRichTextAssetUrls } from './request'

export interface ArticleCardItem {
  id: string
  contentSource: ArticleContentSource
  title: string
  summary: string
  author: string
  authorTag?: string
  authorAvatar: string
  time: string
  coverImage: string
  likeCount: number
  commentCount: number
  tags: string[]
  readDuration: string
  wordCount: string
  salesCount: number
  updated: boolean
  sortWeight: number
  access: ArticleAccessProfile
  primaryMarkText: string
  primaryMarkClass: 'is-free' | 'is-paid'
  originPriceLabel?: string
  statusLabel: string
  statusClass: string
  unlockLabel: string
  planetCard: ArticlePlanetCard
}

export interface ArticleDetailViewModel {
  id: string
  contentSource: ArticleContentSource
  title: string
  summary: string
  author: string
  authorTag?: string
  authorAvatar: string
  time: string
  coverImage: string
  likeCount: number
  commentCount: number
  tags: string[]
  readDuration: string
  wordCount: string
  salesCount: number
  access: ArticleAccessProfile
  readState: ReturnType<typeof getArticleReadPresentation>['readState']
  hiddenHint: string
  visibleContent: string[]
  hiddenParagraphCount: number
  showPaywallCard: boolean
  paywallTitle: string
  paywallSubtitle: string
  paywallButtonText: string
  isWechatArticle: boolean
  isPlanetArticle: boolean
  navTitle: string
  isRichContent: boolean
  visibleRichContent: string
  canReadFull: boolean
  showStandaloneSummary: boolean
  showStandaloneCover: boolean
  planetCard: ArticlePlanetCard
}

function formatArticlePriceLabel(priceAmount: number) {
  const normalizedPrice = Number.isFinite(priceAmount) ? Math.max(0, Math.round(priceAmount)) : 0
  return normalizedPrice > 0 ? `¥${normalizedPrice}` : '免费'
}

function formatArticleTime(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value || '')
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}`
}

function splitTextParagraphs(value: string) {
  return String(value || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeComparableText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[，。！？；：、“”"'‘’,.!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, '')
    .trim()
}

function hasRichMediaBlocks(richContent: string) {
  return /<(img|video|figure|iframe)\b/i.test(String(richContent || ''))
}

function shouldShowStandaloneSummary(summary: string, richContent: string, paragraphs: string[]) {
  const normalizedSummary = normalizeComparableText(summary)
  if (!normalizedSummary) {
    return false
  }

  if (String(richContent || '').trim()) {
    return false
  }

  const normalizedParagraphPreview = normalizeComparableText((Array.isArray(paragraphs) ? paragraphs : []).slice(0, 3).join(' '))
  if (!normalizedParagraphPreview) {
    return true
  }

  return (
    normalizedParagraphPreview.indexOf(normalizedSummary) < 0 && normalizedSummary.indexOf(normalizedParagraphPreview) < 0
  )
}

function appendInlineStyle(attributes: string, styleText: string) {
  const normalizedAttributes = String(attributes || '')
  if (!normalizedAttributes.trim()) {
    return `style="${styleText}"`
  }

  if (/style\s*=\s*"/i.test(normalizedAttributes)) {
    return normalizedAttributes.replace(/style\s*=\s*"([^"]*)"/i, (_, currentStyle) => {
      const mergedStyle = `${String(currentStyle || '').trim().replace(/;?$/, ';')} ${styleText}`.trim()
      return `style="${mergedStyle}"`
    })
  }

  if (/style\s*=\s*'/i.test(normalizedAttributes)) {
    return normalizedAttributes.replace(/style\s*=\s*'([^']*)'/i, (_, currentStyle) => {
      const mergedStyle = `${String(currentStyle || '').trim().replace(/;?$/, ';')} ${styleText}`.trim()
      return `style='${mergedStyle}'`
    })
  }

  return `${normalizedAttributes} style="${styleText}"`
}

function normalizeMiniProgramRichContent(html: string) {
  const normalizedHtml = normalizeRichTextAssetUrls(String(html || '').trim())
  if (!normalizedHtml) {
    return ''
  }

  return normalizedHtml
    .replace(/<img\b([^>]*?)\/?>/gi, (_, attributes) => {
      const nextAttributes = appendInlineStyle(
        String(attributes || ''),
        'display:block;max-width:100%;height:auto;margin:16px 0;border-radius:12px;'
      )
      return `<img ${nextAttributes} />`
    })
    .replace(/<video\b([^>]*?)>/gi, (_, attributes) => {
      const nextAttributes = appendInlineStyle(
        String(attributes || ''),
        'display:block;width:100%;height:auto;margin:16px 0;border-radius:12px;background:#000;'
      )
      return `<video ${nextAttributes}>`
    })
}

function estimateReadDuration(text: string, paragraphCount = 0) {
  const normalizedLength = String(text || '').replace(/\s+/g, '').length
  const baselineLength = Math.max(normalizedLength, paragraphCount * 120)
  const minutes = Math.max(1, Math.ceil(baselineLength / 320))
  return `${minutes}分钟`
}

function formatWordCount(text: string, paragraphCount = 0) {
  const normalizedLength = String(text || '').replace(/\s+/g, '').length
  const baselineLength = Math.max(normalizedLength, paragraphCount * 120)

  if (baselineLength >= 1000) {
    return `${(baselineLength / 1000).toFixed(1)}k字`
  }

  return `${baselineLength}字`
}

function buildPlanetCard(article: PlanetArticleItem): ArticlePlanetCard {
  const authorDisplay = article.authorDisplay || null

  return {
    id: String(article.groupId || ''),
    name: String((authorDisplay && authorDisplay.name) || '知识星球'),
    creator: '',
    avatar: normalizeAssetUrl(String((authorDisplay && authorDisplay.avatarUrl) || '')),
    intro: '',
    meta: article.readingCount > 0 ? `${article.readingCount}人读过` : '',
  }
}

function buildAccessProfile(article: PlanetArticleItem): ArticleAccessProfile {
  const rawAccess = article.access || null
  const accessType = rawAccess && rawAccess.accessType === 'paid' ? 'paid' : 'free'
  const priceAmount = accessType === 'paid' ? Math.max(0, Math.round(Number((rawAccess && rawAccess.priceAmount) || 0))) : 0
  const originPriceAmount = accessType === 'paid' ? priceAmount : undefined

  return {
    accessType,
    priceAmount,
    priceLabel:
      accessType === 'paid' && rawAccess && rawAccess.priceLabel ? rawAccess.priceLabel : formatArticlePriceLabel(priceAmount),
    originPriceAmount,
    originPriceLabel:
      accessType === 'paid' && typeof originPriceAmount === 'number' && originPriceAmount > 0
        ? formatArticlePriceLabel(originPriceAmount)
        : undefined,
    isUnlocked: accessType === 'free' ? true : Boolean((rawAccess && rawAccess.isUnlocked) || article.canReadFull),
    previewMode: rawAccess && rawAccess.previewMode === 'ratio' ? 'ratio' : 'paragraph',
    previewValue: Number((rawAccess && rawAccess.previewValue) || 0),
  }
}

function isUpdatedArticle(article: PlanetArticleItem) {
  const createdAt = new Date(article.createdAt || article.publishedAt || 0).getTime()
  const updatedAt = new Date(article.updatedAt || article.createdAt || 0).getTime()

  if (!createdAt || !updatedAt || Number.isNaN(createdAt) || Number.isNaN(updatedAt)) {
    return false
  }

  return updatedAt - createdAt >= 60 * 1000
}

function decorateCardByAccess(base: Omit<ArticleCardItem, 'primaryMarkText' | 'primaryMarkClass' | 'originPriceLabel' | 'statusLabel' | 'statusClass' | 'unlockLabel'>) {
  const presentation = getArticleReadPresentation({
    access: base.access,
    updated: base.updated,
  })

  return {
    ...base,
    primaryMarkText: presentation.primaryMarkText,
    primaryMarkClass: presentation.primaryMarkClass,
    originPriceLabel: base.access.accessType === 'paid' ? base.access.originPriceLabel : undefined,
    statusLabel: presentation.statusLabel,
    statusClass: presentation.statusClass,
    unlockLabel: presentation.unlockLabel,
  } satisfies ArticleCardItem
}

export function decorateStaticArticleCard(article: ArticleRecord) {
  return decorateCardByAccess({
    id: article.id,
    contentSource: article.contentSource,
    title: article.title,
    summary: article.summary,
    author: article.author,
    authorTag: article.authorTag,
    authorAvatar: article.authorAvatar,
    time: article.time,
    coverImage: article.coverImage,
    likeCount: article.likeCount,
    commentCount: article.commentCount,
    tags: [...article.tags],
    readDuration: article.readDuration,
    wordCount: article.wordCount,
    salesCount: article.salesCount,
    updated: article.updated,
    sortWeight: article.sortWeight,
    access: { ...article.access },
    planetCard: { ...article.planetCard },
  })
}

export function mapRemoteArticleToCard(article: PlanetArticleItem) {
  const authorDisplay = article.authorDisplay || null
  const visibleParagraphs =
    Array.isArray(article.contentParagraphs) && article.contentParagraphs.length
      ? article.contentParagraphs
      : splitTextParagraphs(article.contentText)
  const access = buildAccessProfile(article)
  const publishedAt = article.publishedAt || article.createdAt
  const contentText = article.contentText || article.summary || ''

  return decorateCardByAccess({
    id: article.id,
    contentSource: article.contentSource === 'wechat' ? 'wechat' : 'planet',
    title: article.title || '未命名文章',
    summary: article.summary || '',
    author: String((authorDisplay && authorDisplay.name) || '知识星球'),
    authorAvatar: normalizeAssetUrl(String((authorDisplay && authorDisplay.avatarUrl) || '')),
    time: formatArticleTime(publishedAt),
    coverImage: normalizeAssetUrl(String(article.coverUrl || '')),
    likeCount: Number(article.likeCount || 0),
    commentCount: Number(article.commentCount || 0),
    tags: Array.isArray(article.tags) ? article.tags.slice(0, 8) : [],
    readDuration: estimateReadDuration(contentText, article.fullParagraphCount || visibleParagraphs.length),
    wordCount: formatWordCount(contentText, article.fullParagraphCount || visibleParagraphs.length),
    salesCount: Number(article.readingCount || 0),
    updated: isUpdatedArticle(article),
    sortWeight: new Date(publishedAt || 0).getTime() || 0,
    access,
    planetCard: buildPlanetCard(article),
  })
}

export function sortArticleCards(items: ArticleCardItem[]) {
  return items.slice().sort((a, b) => b.sortWeight - a.sortWeight)
}

export function createEmptyArticleDetailViewModel(): ArticleDetailViewModel {
  return {
    id: '',
    contentSource: 'planet',
    title: '',
    summary: '',
    author: '',
    authorTag: '',
    authorAvatar: '',
    time: '',
    coverImage: '',
    likeCount: 0,
    commentCount: 0,
    tags: [],
    readDuration: '',
    wordCount: '',
    salesCount: 0,
    access: {
      accessType: 'free',
      priceAmount: 0,
      priceLabel: '免费',
      isUnlocked: true,
      previewMode: 'paragraph',
      previewValue: 1,
    },
    readState: 'free',
    hiddenHint: '',
    visibleContent: [],
    hiddenParagraphCount: 0,
    showPaywallCard: false,
    paywallTitle: '',
    paywallSubtitle: '',
    paywallButtonText: '',
    isWechatArticle: false,
    isPlanetArticle: true,
    navTitle: '文章详情',
    isRichContent: false,
    visibleRichContent: '',
    canReadFull: true,
    showStandaloneSummary: false,
    showStandaloneCover: false,
    planetCard: {
      id: '',
      name: '',
      creator: '',
      avatar: '',
      intro: '',
      meta: '',
    },
  }
}

export function buildStaticArticleDetail(article: ArticleRecord): ArticleDetailViewModel {
  const presentation = getArticleReadPresentation(article)
  const visibleContent = presentation.canReadFull ? article.fullContent : article.previewContent
  const hiddenParagraphCount = Math.max(0, article.fullContent.length - visibleContent.length)
  const isWechatArticle = article.contentSource === 'wechat'
  const showStandaloneSummary = shouldShowStandaloneSummary(article.summary, '', visibleContent)
  const showStandaloneCover = Boolean(String(article.coverImage || '').trim())
  let hiddenHint = presentation.detailHint
  let paywallTitle = `解锁剩余 ${hiddenParagraphCount} 段完整内容`
  let paywallSubtitle = `当前可试看前 ${visibleContent.length} 段，支付 ${article.access.priceLabel} 后阅读全文`
  let paywallButtonText = `解锁全文 ${article.access.priceLabel}`
  let showPaywallCard = !presentation.canReadFull

  if (isWechatArticle && !presentation.canReadFull) {
    hiddenHint = `已开放前 ${visibleContent.length} 段预览，剩余 ${hiddenParagraphCount} 段为付费正文`
    paywallTitle = '以下内容为付费阅读部分'
    paywallSubtitle = `支付 ${article.access.priceLabel} 后可继续阅读完整公众号正文`
    paywallButtonText = `${article.access.priceLabel} 继续阅读`
  }

  if (presentation.canReadFull) {
    paywallTitle = ''
    paywallSubtitle = ''
    paywallButtonText = ''
    showPaywallCard = false
  }

  return {
    id: article.id,
    contentSource: article.contentSource,
    title: article.title,
    summary: article.summary,
    author: article.author,
    authorTag: article.authorTag,
    authorAvatar: article.authorAvatar,
    time: article.time,
    coverImage: article.coverImage,
    likeCount: article.likeCount,
    commentCount: article.commentCount,
    tags: [...article.tags],
    readDuration: article.readDuration,
    wordCount: article.wordCount,
    salesCount: article.salesCount,
    access: { ...article.access },
    readState: presentation.readState,
    hiddenHint,
    visibleContent,
    hiddenParagraphCount,
    showPaywallCard,
    paywallTitle,
    paywallSubtitle,
    paywallButtonText,
    isWechatArticle,
    isPlanetArticle: !isWechatArticle,
    navTitle: isWechatArticle ? '微信文章' : '文章详情',
    isRichContent: false,
    visibleRichContent: '',
    canReadFull: presentation.canReadFull,
    showStandaloneSummary,
    showStandaloneCover,
    planetCard: { ...article.planetCard },
  }
}

export function buildRemoteArticleDetail(article: PlanetArticleItem): ArticleDetailViewModel {
  const authorDisplay = article.authorDisplay || null
  const access = buildAccessProfile(article)
  const updated = isUpdatedArticle(article)
  const presentation = getArticleReadPresentation({ access, updated })
  const isWechatArticle = article.contentSource === 'wechat'
  const visibleContent =
    Array.isArray(article.contentParagraphs) && article.contentParagraphs.length
      ? article.contentParagraphs
      : splitTextParagraphs(article.contentText || article.previewContentText || '')
  const hiddenParagraphCount = Math.max(
    0,
    Number(
      article.hiddenParagraphCount ||
        Math.max(0, Number(article.fullParagraphCount || 0) - Number(article.visibleParagraphCount || visibleContent.length))
    )
  )
  const visibleRichContent = normalizeMiniProgramRichContent(String(article.richContent || article.previewRichContent || ''))
  const showStandaloneSummary = shouldShowStandaloneSummary(article.summary || '', visibleRichContent, visibleContent)
  const showStandaloneCover =
    Boolean(String(article.coverUrl || '').trim()) && (!visibleRichContent.trim() || !hasRichMediaBlocks(visibleRichContent))
  const paywallTitle = hiddenParagraphCount > 0 ? `解锁剩余 ${hiddenParagraphCount} 段完整内容` : `解锁完整文章 ${access.priceLabel}`
  const paywallSubtitle = isWechatArticle
    ? `支付 ${access.priceLabel} 后可继续阅读完整公众号正文`
    : `当前为付费试看文章，支付 ${access.priceLabel} 后可阅读全文和图片`
  const hiddenHint = presentation.canReadFull
    ? presentation.detailHint
    : hiddenParagraphCount > 0
      ? `当前已开放 ${visibleContent.length} 段，剩余 ${hiddenParagraphCount} 段需解锁`
      : '当前仅开放试看内容，解锁后可阅读全文'

  return {
    id: article.id,
    contentSource: article.contentSource === 'wechat' ? 'wechat' : 'planet',
    title: article.title || '未命名文章',
    summary: article.summary || '',
    author: String((authorDisplay && authorDisplay.name) || (isWechatArticle ? '微信公众号' : '知识星球')),
    authorTag: '',
    authorAvatar: normalizeAssetUrl(String((authorDisplay && authorDisplay.avatarUrl) || '')),
    time: formatArticleTime(article.publishedAt || article.createdAt),
    coverImage: normalizeAssetUrl(String(article.coverUrl || '')),
    likeCount: Number(article.likeCount || 0),
    commentCount: Number(article.commentCount || 0),
    tags: Array.isArray(article.tags) ? article.tags.slice(0, 8) : [],
    readDuration: estimateReadDuration(article.contentText || article.summary || '', article.fullParagraphCount || visibleContent.length),
    wordCount: formatWordCount(article.contentText || article.summary || '', article.fullParagraphCount || visibleContent.length),
    salesCount: Number(article.readingCount || 0),
    access,
    readState: presentation.readState,
    hiddenHint,
    visibleContent,
    hiddenParagraphCount,
    showPaywallCard: !presentation.canReadFull,
    paywallTitle: presentation.canReadFull ? '' : paywallTitle,
    paywallSubtitle: presentation.canReadFull ? '' : paywallSubtitle,
    paywallButtonText: presentation.canReadFull ? '' : `${access.priceLabel} 解锁全文`,
    isWechatArticle,
    isPlanetArticle: !isWechatArticle,
    navTitle: isWechatArticle ? '微信文章' : '文章详情',
    isRichContent: Boolean(visibleRichContent.trim()),
    visibleRichContent,
    canReadFull: presentation.canReadFull,
    showStandaloneSummary,
    showStandaloneCover,
    planetCard: buildPlanetCard(article),
  }
}
