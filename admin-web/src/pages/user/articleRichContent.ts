const PRESERVED_EDITOR_TRIGGER_PATTERN =
  /<(div|section|article|table|thead|tbody|tfoot|tr|td|th|iframe|canvas|svg|form|audio|details|summary)\b/i

const MEANINGFUL_DESCENDANT_SELECTOR =
  'img, video, hr, table, iframe, canvas, svg, form, audio, blockquote, ul, ol, pre, figure, p, h1, h2, h3, h4, h5, h6'

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeEditorHtml(html: string) {
  const normalized = html.trim()
  if (!normalized || normalized === '<p></p>') {
    return ''
  }

  return normalized
}

export function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildParagraphHtmlFromText(value: string) {
  const paragraphs = String(value || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (!paragraphs.length) {
    return '<p></p>'
  }

  return paragraphs.map((item) => `<p>${escapeHtmlText(item)}</p>`).join('')
}

export function extractTextFromHtml(html: string) {
  const normalizedHtml = normalizeEditorHtml(html)
  if (!normalizedHtml) {
    return ''
  }

  if (typeof DOMParser === 'undefined') {
    return normalizeWhitespace(normalizedHtml.replace(/<[^>]+>/g, ' '))
  }

  const document = new DOMParser().parseFromString(normalizedHtml, 'text/html')
  const blockTexts = Array.from(document.body.childNodes)
    .map((node) => normalizeWhitespace(node.textContent || ''))
    .filter(Boolean)

  if (blockTexts.length) {
    return blockTexts.join('\n')
  }

  return normalizeWhitespace(document.body.textContent || '')
}

export function shouldUsePreservedHtmlEditor(html: string) {
  const normalizedHtml = normalizeEditorHtml(html)
  if (!normalizedHtml) {
    return false
  }

  return PRESERVED_EDITOR_TRIGGER_PATTERN.test(normalizedHtml)
}

export function collectArticleBlockHtmlList(html: string) {
  const normalizedHtml = normalizeEditorHtml(html)
  if (!normalizedHtml || typeof DOMParser === 'undefined') {
    return [] as string[]
  }

  const document = new DOMParser().parseFromString(normalizedHtml, 'text/html')
  const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'pre', 'figure', 'video', 'img', 'hr'])

  return Array.from(document.body.childNodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textContent = normalizeWhitespace(node.textContent || '')
        return textContent ? `<p>${escapeHtmlText(textContent)}</p>` : ''
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return ''
      }

      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()
      const textContent = normalizeWhitespace(element.textContent || '')
      const hasMeaningfulMedia = Boolean(element.querySelector(MEANINGFUL_DESCENDANT_SELECTOR))
      const isSelfMeaningfulMedia = tagName === 'img' || tagName === 'hr' || tagName === 'video' || tagName === 'figure'

      if (!blockTags.has(tagName) && !textContent && !hasMeaningfulMedia) {
        return ''
      }

      if (!textContent && !hasMeaningfulMedia && !isSelfMeaningfulMedia) {
        return ''
      }

      return element.outerHTML
    })
    .filter(Boolean)
}
