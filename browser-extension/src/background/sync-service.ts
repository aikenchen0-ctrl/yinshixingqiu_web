import { createWechatArticle } from '../shared/api-client'
import { mapWechatArticleToSaveArticleInput } from '../shared/article-mapper'
import { SYNC_MESSAGE_TYPE } from '../shared/constants'
import type { ExtractedWechatArticle } from '../shared/types'

export async function runWechatArticleSync(input: {
  tabId: number
  sendTabMessage: (tabId: number, message: unknown) => Promise<{ ok: boolean; data?: ExtractedWechatArticle; message?: string }>
  createArticle: (payload: ReturnType<typeof mapWechatArticleToSaveArticleInput>) => ReturnType<typeof createWechatArticle>
}) {
  const extracted = await input.sendTabMessage(input.tabId, { type: SYNC_MESSAGE_TYPE })
  if (!extracted.ok || !extracted.data) {
    throw new Error(extracted.message || '当前页面文章抓取失败')
  }

  const payload = mapWechatArticleToSaveArticleInput(extracted.data)
  return input.createArticle(payload)
}
