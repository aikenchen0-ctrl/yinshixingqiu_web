import type { ExtractedWechatArticle } from './types'

export interface SaveArticlePayload {
  title: string
  summary: string
  contentText: string
  contentSource: 'wechat'
  coverUrl: string
  richContent: string
  attachments: string[]
  metadata: Record<string, unknown>
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function mapWechatArticleToSaveArticleInput(article: ExtractedWechatArticle): SaveArticlePayload {
  const fallbackRichContent = article.blocks
    .map((block) => {
      if (block.type === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`
      if (block.type === 'blockquote') return `<blockquote>${escapeHtml(block.text)}</blockquote>`
      if (block.type === 'image') return `<p><img src="${block.url}" alt="" /></p>`
      return '<hr />'
    })
    .join('')

  const fallbackContentText = article.blocks
    .filter(
      (
        block,
      ): block is ExtractedWechatArticle['blocks'][number] & { type: 'paragraph' | 'blockquote'; text: string } =>
        block.type === 'paragraph' || block.type === 'blockquote',
    )
    .map((block) => block.text)
    .join('\n\n')

  const richContent = String(article.richContentHtml || '').trim() || fallbackRichContent
  const contentText = String(article.contentText || '').trim() || fallbackContentText

  return {
    title: article.title,
    summary: article.summary,
    contentText,
    contentSource: 'wechat',
    coverUrl: article.coverUrl,
    richContent,
    attachments: article.images,
    metadata: {
      sourceUrl: article.sourceUrl,
      author: article.author,
      images: article.images,
      wechatArticleCards: Array.isArray(article.wechatArticleCards) ? article.wechatArticleCards : [],
    },
  }
}
