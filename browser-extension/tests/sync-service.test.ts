import { describe, expect, it, vi } from 'vitest'
import { runWechatArticleSync } from '../src/background/sync-service'

describe('runWechatArticleSync', () => {
  it('submits extracted wechat content without extension settings', async () => {
    const sendTabMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        title: '测试标题',
        summary: '测试摘要',
        author: '原公众号作者',
        sourceUrl: 'https://mp.weixin.qq.com/s/test',
        coverUrl: 'https://mmbiz.qpic.cn/cover.png',
        images: ['https://mmbiz.qpic.cn/cover.png'],
        blocks: [{ type: 'paragraph', text: '第一段内容' }],
      },
    })
    const createArticle = vi.fn().mockResolvedValue({ id: 'article_001' })

    await expect(
      runWechatArticleSync({
        tabId: 1,
        sendTabMessage,
        createArticle,
      }),
    ).resolves.toEqual({ id: 'article_001' })

    expect(createArticle).toHaveBeenCalledTimes(1)
    expect(createArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '测试标题',
        contentSource: 'wechat',
      }),
    )
  })
})
