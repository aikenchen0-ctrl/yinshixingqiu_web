export type WechatArticleBlock =
  | { type: 'paragraph'; text: string; bold?: boolean }
  | { type: 'blockquote'; text: string }
  | { type: 'image'; url: string }
  | { type: 'divider' }

export interface WechatArticleCard {
  index: number
  title: string
  summary: string
  sourceUrl: string
  coverUrl: string
}

export interface ExtractedWechatArticle {
  title: string
  summary: string
  author: string
  sourceUrl: string
  coverUrl: string
  images: string[]
  contentText: string
  richContentHtml: string
  wechatArticleCards: WechatArticleCard[]
  blocks: WechatArticleBlock[]
}
