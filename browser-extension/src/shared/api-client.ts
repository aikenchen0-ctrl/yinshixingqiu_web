import type { SaveArticlePayload } from './article-mapper'
import { WECHAT_IMPORT_API_PATH, XUEYIN_API_BASE_URL } from './constants'

export async function createWechatArticle(payload: SaveArticlePayload) {
  const response = await fetch(new URL(WECHAT_IMPORT_API_PATH, XUEYIN_API_BASE_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.message || '创建微信文章失败')
  }

  return result.data
}
