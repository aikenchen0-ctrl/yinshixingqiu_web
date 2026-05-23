import { describe, expect, it } from 'vitest'
import { mapWechatArticleToSaveArticleInput } from '../src/shared/article-mapper'

describe('mapWechatArticleToSaveArticleInput', () => {
  it('maps extracted wechat content into the existing /api/articles payload', () => {
    const payload = mapWechatArticleToSaveArticleInput({
      title: '测试标题',
      summary: '测试摘要',
      author: '测试作者',
      sourceUrl: 'https://mp.weixin.qq.com/s/test',
      coverUrl: 'https://mmbiz.qpic.cn/cover.png',
      images: ['https://mmbiz.qpic.cn/cover.png'],
      blocks: [
        { type: 'paragraph', text: '第一段' },
        { type: 'blockquote', text: '引用段落' },
        { type: 'image', url: 'https://mmbiz.qpic.cn/cover.png' },
      ],
    })

    expect(Object.keys(payload)).toEqual([
      'title',
      'summary',
      'contentText',
      'contentSource',
      'coverUrl',
      'richContent',
      'attachments',
      'metadata',
    ])
    expect(payload.contentSource).toBe('wechat')
    expect(payload.title).toBe('测试标题')
    expect(payload.coverUrl).toBe('https://mmbiz.qpic.cn/cover.png')
    expect(payload.metadata?.sourceUrl).toBe('https://mp.weixin.qq.com/s/test')
    expect(String(payload.richContent)).toContain('<p>第一段</p>')
  })

  it('prefers preserved rich html and full text when the extractor provides them', () => {
    const payload = mapWechatArticleToSaveArticleInput({
      title: '表格文章',
      summary: '摘要',
      author: '作者',
      sourceUrl: 'https://mp.weixin.qq.com/s/test-table',
      coverUrl: '',
      images: [],
      blocks: [],
      richContentHtml: '<div>自由正文</div><table><tr><td>字段</td><td>值</td></tr></table>',
      contentText: '自由正文\n字段 值',
    } as any)

    expect(payload.richContent).toContain('<table>')
    expect(payload.richContent).toContain('自由正文')
    expect(payload.contentText).toContain('字段')
    expect(payload.contentText).toContain('值')
  })

  it('stores extracted wechat article cards in metadata for miniapp rendering', () => {
    const payload = mapWechatArticleToSaveArticleInput({
      title: '卡片文章',
      summary: '摘要',
      author: '作者',
      sourceUrl: 'https://mp.weixin.qq.com/s/test-card-source',
      coverUrl: 'https://mmbiz.qpic.cn/cover.png',
      images: ['https://mmbiz.qpic.cn/cover.png'],
      blocks: [{ type: 'paragraph', text: '前置正文' }],
      richContentHtml: '<p>前置正文</p><section data-wechat-card-slot="0"></section>',
      contentText: '前置正文',
      wechatArticleCards: [
        {
          index: 0,
          title: '关联文章标题',
          summary: '',
          sourceUrl: 'https://mp.weixin.qq.com/s/linked-article',
          coverUrl: 'https://mmbiz.qpic.cn/linked-cover.png',
        },
      ],
    } as any)

    expect(payload.metadata.wechatArticleCards).toEqual([
      {
        index: 0,
        title: '关联文章标题',
        summary: '',
        sourceUrl: 'https://mp.weixin.qq.com/s/linked-article',
        coverUrl: 'https://mmbiz.qpic.cn/linked-cover.png',
      },
    ])
    expect(payload.richContent).toContain('data-wechat-card-slot="0"')
  })
})
