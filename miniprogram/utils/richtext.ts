// 富文本兼容处理：将微信文章常见结构规范化
export const normalizeWxArticleHtml = (html: string) => {
  if (!html) return ''
  return html
    .replace(/<section\b[^>]*>/gi, '<p>')
    .replace(/<\/section>/gi, '</p>')
    .replace(/<img\b([^>]*?)>/gi, '<img $1 />')
}
