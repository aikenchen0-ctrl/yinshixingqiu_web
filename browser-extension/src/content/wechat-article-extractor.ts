import type { ExtractedWechatArticle, WechatArticleCard } from '../shared/types'
import { normalizeWechatArticleContent } from './wechat-article-normalizer'

function readTextValue(node: Element | null | undefined) {
  if (!node) {
    return ''
  }

  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
    return String(node.value || '').trim()
  }

  const contentValue = String(node.getAttribute('content') || '').trim()
  if (contentValue) {
    return contentValue
  }

  return String(node.textContent || '').trim()
}

function readFirstNonEmptyText(selectors: string[], root: ParentNode = document) {
  for (const selector of selectors) {
    const value = readTextValue(root.querySelector(selector))
    if (value) {
      return value
    }
  }

  return ''
}

function readImageSource(node: Element | null | undefined) {
  if (!(node instanceof HTMLImageElement)) {
    return ''
  }

  return String(node.getAttribute('data-src') || node.getAttribute('src') || '').trim()
}

function isWechatArticleLink(url: string) {
  return /^https?:\/\/mp\.weixin\.qq\.com\//i.test(String(url || '').trim())
}

function normalizeInlineText(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSimpleWechatArticleCardNode(node: Element) {
  const imageCount = node.querySelectorAll('img').length
  if (imageCount !== 1) {
    return false
  }

  if (node.querySelector('table, video, blockquote, ul, ol, pre, hr, iframe, canvas, svg, form')) {
    return false
  }

  const complexTextBlocks = node.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
  if (complexTextBlocks.length > 1) {
    return false
  }

  const visibleText = normalizeInlineText(node.textContent || '')
  if (!visibleText || visibleText.length > 80) {
    return false
  }

  return true
}

function readWechatArticleCard(node: Element | null | undefined): Omit<WechatArticleCard, 'index'> | null {
  if (!(node instanceof Element)) {
    return null
  }

  const sourceUrl = String(
    node.getAttribute('href') || node.getAttribute('data-href') || node.getAttribute('data-url') || '',
  ).trim()

  if (!isWechatArticleLink(sourceUrl)) {
    return null
  }

  if (!isSimpleWechatArticleCardNode(node)) {
    return null
  }

  const coverUrl = readImageSource(node.querySelector('img'))
  const title = normalizeInlineText(
    node.getAttribute('data-title') ||
      node.getAttribute('title') ||
      node.querySelector('[data-title]')?.getAttribute('data-title') ||
      node.textContent ||
      node.querySelector('img')?.getAttribute('alt') ||
      '',
  )

  if (!coverUrl || !title) {
    return null
  }

  return {
    title,
    summary: '',
    sourceUrl,
    coverUrl,
  }
}

function extractWechatArticleCards(root: ParentNode) {
  const cards: WechatArticleCard[] = []
  if (!(root instanceof Element)) {
    return {
      richContentHtml: '',
      wechatArticleCards: cards,
    }
  }

  const clone = root.cloneNode(true)
  if (!(clone instanceof Element)) {
    return {
      richContentHtml: root.innerHTML.trim(),
      wechatArticleCards: cards,
    }
  }

  Array.from(clone.querySelectorAll('a[href], a[data-href], a[data-url]')).forEach((node) => {
    const card = readWechatArticleCard(node)
    if (!card) {
      return
    }

    const nextCard = {
      index: cards.length,
      ...card,
    }
    cards.push(nextCard)

    const placeholder = clone.ownerDocument.createElement('section')
    placeholder.setAttribute('data-wechat-card-slot', String(nextCard.index))
    node.replaceWith(placeholder)
  })

  return {
    richContentHtml: clone.innerHTML.trim(),
    wechatArticleCards: cards,
  }
}

function findWechatCardCoverUrl(root: ParentNode) {
  const candidates = root.querySelectorAll('[href], [data-href], [data-url]')

  for (const node of candidates) {
    const card = readWechatArticleCard(node)
    if (card && card.coverUrl) {
      return card.coverUrl
    }
  }

  return ''
}

export function extractWechatArticleFromDocument(documentRef: Document, input: { pageUrl: string }): ExtractedWechatArticle {
  const contentRoot =
    documentRef.querySelector('#js_content') ||
    documentRef.querySelector('.rich_media_content') ||
    documentRef.body

  const blocks = normalizeWechatArticleContent(contentRoot)
  const images = blocks.filter((item) => item.type === 'image').map((item) => item.url)
  const contentText = readTextValue(contentRoot)
  const { richContentHtml, wechatArticleCards } = extractWechatArticleCards(contentRoot)
  const cardCoverUrl = findWechatCardCoverUrl(contentRoot)

  return {
    title: readFirstNonEmptyText(
      ['#activity-name', 'input[name="title"]', 'textarea[name="title"]', '.title_input', '.js_title_input'],
      documentRef,
    ),
    summary: readFirstNonEmptyText(
      ['#js_digest', 'textarea[name="digest"]', 'input[name="digest"]', '.js_digest_input'],
      documentRef,
    ),
    author: readFirstNonEmptyText(
      ['#js_author_name', 'input[name="author"]', 'textarea[name="author"]', '.js_author_input'],
      documentRef,
    ),
    sourceUrl: input.pageUrl,
    coverUrl: cardCoverUrl || images[0] || '',
    images,
    contentText,
    richContentHtml,
    wechatArticleCards,
    blocks,
  }
}
