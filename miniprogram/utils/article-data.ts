export type ArticleAccessType = 'free' | 'paid'
export type ArticlePreviewMode = 'paragraph' | 'ratio'
export type ArticleReadState = 'free' | 'paid_locked' | 'paid_unlocked'
export type ArticlePrimaryMarkClass = 'is-free' | 'is-paid'
export type ArticleStatusClass = 'is-free' | 'is-locked' | 'is-unlocked' | 'is-updated'
export type ArticleContentSource = 'wechat' | 'planet'

export interface ArticlePlanetCard {
  id: string
  name: string
  creator?: string
  avatar: string
  intro: string
  meta: string
}

export interface ArticleAccessProfile {
  accessType: ArticleAccessType
  priceAmount: number
  priceLabel: string
  originPriceAmount?: number
  originPriceLabel?: string
  isUnlocked: boolean
  previewMode: ArticlePreviewMode
  previewValue: number
}

export interface ArticleReadPresentation {
  readState: ArticleReadState
  primaryMarkText: string
  primaryMarkClass: ArticlePrimaryMarkClass
  statusLabel: string
  statusClass: ArticleStatusClass
  unlockLabel: string
  detailHint: string
  canReadFull: boolean
}

type ArticleReadInput = {
  access: ArticleAccessProfile
  updated: boolean
}

export const getArticleReadState = (article: Pick<ArticleReadInput, 'access'>): ArticleReadState => {
  if (article.access.accessType === 'free') {
    return 'free'
  }

  return article.access.isUnlocked ? 'paid_unlocked' : 'paid_locked'
}

export const getArticleReadPresentation = (article: ArticleReadInput): ArticleReadPresentation => {
  const readState = getArticleReadState(article)

  if (readState === 'free') {
    return {
      readState,
      primaryMarkText: '免费',
      primaryMarkClass: 'is-free',
      statusLabel: '免费全文',
      statusClass: 'is-free',
      unlockLabel: '免费全文',
      detailHint: '免费全文',
      canReadFull: true,
    }
  }

  if (readState === 'paid_unlocked') {
    const statusLabel = article.updated ? '已更新' : '已解锁'
    return {
      readState,
      primaryMarkText: article.access.priceLabel,
      primaryMarkClass: 'is-paid',
      statusLabel,
      statusClass: article.updated ? 'is-updated' : 'is-unlocked',
      unlockLabel: '已解锁全文',
      detailHint: statusLabel,
      canReadFull: true,
    }
  }

  return {
    readState,
    primaryMarkText: article.access.priceLabel,
    primaryMarkClass: 'is-paid',
    statusLabel: '付费试看',
    statusClass: 'is-locked',
    unlockLabel: '解锁全文',
    detailHint: '付费试看',
    canReadFull: false,
  }
}
