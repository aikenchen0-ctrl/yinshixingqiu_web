import type { WechatArticleBlock } from '../shared/types'

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeWechatArticleContent(root: ParentNode): WechatArticleBlock[] {
  const blocks: WechatArticleBlock[] = []

  root.querySelectorAll('p, blockquote, img, hr').forEach((node) => {
    if (node instanceof HTMLParagraphElement) {
      const text = normalizeText(node.textContent || '')
      if (text) {
        blocks.push({
          type: 'paragraph',
          text,
          bold: Boolean(node.querySelector('strong, b')),
        })
      }
      return
    }

    if (node instanceof HTMLQuoteElement) {
      const text = normalizeText(node.textContent || '')
      if (text) {
        blocks.push({ type: 'blockquote', text })
      }
      return
    }

    if (node instanceof HTMLImageElement) {
      const url = normalizeText(node.getAttribute('data-src') || node.getAttribute('src') || '')
      if (url) {
        blocks.push({ type: 'image', url })
      }
      return
    }

    if (node instanceof HTMLHRElement) {
      blocks.push({ type: 'divider' })
    }
  })

  return blocks
}
