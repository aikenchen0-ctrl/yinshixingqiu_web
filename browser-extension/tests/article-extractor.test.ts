// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { extractWechatArticleFromDocument } from '../src/content/wechat-article-extractor'

describe('extractWechatArticleFromDocument', () => {
  it('extracts article title, summary, source url, and normalized content blocks', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <h1 id="activity-name">测试标题</h1>
        <div id="js_author_name">测试作者</div>
        <div id="js_digest">测试摘要</div>
        <div class="rich_media_content" id="js_content">
          <p>第一段正文</p>
          <p><strong>第二段加粗</strong></p>
          <img data-src="https://mmbiz.qpic.cn/test-cover.png" />
          <blockquote>引用内容</blockquote>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl:
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    })

    expect(result.title).toBe('测试标题')
    expect(result.summary).toBe('测试摘要')
    expect(result.author).toBe('测试作者')
    expect(result.sourceUrl).toContain('mp.weixin.qq.com/cgi-bin/appmsg')
    expect(result.blocks.map((item) => item.type)).toEqual(['paragraph', 'paragraph', 'image', 'blockquote'])
    expect(result.images).toEqual(['https://mmbiz.qpic.cn/test-cover.png'])
  })

  it('extracts title and summary from edit-page form controls when text nodes are empty', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <input id="activity-name" value="编辑页标题" />
        <textarea id="js_digest">编辑页摘要</textarea>
        <input id="js_author_name" value="编辑页作者" />
        <div class="rich_media_content" id="js_content">
          <p>只有一段正文</p>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl:
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    })

    expect(result.title).toBe('编辑页标题')
    expect(result.summary).toBe('编辑页摘要')
    expect(result.author).toBe('编辑页作者')
  })

  it('prefers a linked wechat article card image over the first ordinary body image for coverUrl', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <h1 id="activity-name">卡片封面优先</h1>
        <div id="js_author_name">测试作者</div>
        <div class="rich_media_content" id="js_content">
          <p>正文开头</p>
          <img data-src="https://mmbiz.qpic.cn/body-image.png" />
          <p>正文中间</p>
          <a href="https://mp.weixin.qq.com/s/example-card-article">
            <img data-src="https://mmbiz.qpic.cn/card-cover.png" />
            <span>这是一张文章卡片</span>
          </a>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl:
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    })

    expect(result.coverUrl).toBe('https://mmbiz.qpic.cn/card-cover.png')
    expect(result.images).toEqual([
      'https://mmbiz.qpic.cn/body-image.png',
      'https://mmbiz.qpic.cn/card-cover.png',
    ])
  })

  it('preserves free-form rich text and table markup from the editor body', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <h1 id="activity-name">带表格的文章</h1>
        <div id="js_author_name">测试作者</div>
        <div class="rich_media_content" id="js_content">
          <div>这是一段不在 p 标签里的正文</div>
          <table class="selectTdClass">
            <tbody>
              <tr><td>字段</td><td>值</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl:
        'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    })

    expect((result as any).contentText).toContain('这是一段不在 p 标签里的正文')
    expect((result as any).contentText).toContain('字段')
    expect((result as any).contentText).toContain('值')
    expect((result as any).richContentHtml).toContain('<table')
    expect((result as any).richContentHtml).toContain('这是一段不在 p 标签里的正文')
  })

  it('extracts structured wechat article cards and replaces them with placeholder slots in rich html', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <h1 id="activity-name">带卡片的文章</h1>
        <div id="js_author_name">测试作者</div>
        <div class="rich_media_content" id="js_content">
          <p>卡片前正文</p>
          <a href="https://mp.weixin.qq.com/s/card-target">
            <img data-src="https://mmbiz.qpic.cn/card-cover.png" />
            <span>卡片文章标题</span>
          </a>
          <p>卡片后正文</p>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    }) as any

    expect(result.wechatArticleCards).toEqual([
      {
        index: 0,
        title: '卡片文章标题',
        summary: '',
        sourceUrl: 'https://mp.weixin.qq.com/s/card-target',
        coverUrl: 'https://mmbiz.qpic.cn/card-cover.png',
      },
    ])
    expect(result.richContentHtml).toContain('data-wechat-card-slot="0"')
    expect(result.richContentHtml).not.toContain('卡片文章标题</span>')
  })

  it('does not replace complex linked blocks as wechat article cards', () => {
    document.body.innerHTML = `
      <div id="js_preview">
        <h1 id="activity-name">复杂链接块</h1>
        <div id="js_author_name">测试作者</div>
        <div class="rich_media_content" id="js_content">
          <a href="https://mp.weixin.qq.com/s/complex-linked-block">
            <div class="custom-linked-box">
              <img data-src="https://mmbiz.qpic.cn/complex-cover.png" />
              <div>这是一个复杂内容块</div>
              <table>
                <tbody>
                  <tr><td>字段</td><td>值</td></tr>
                </tbody>
              </table>
            </div>
          </a>
        </div>
      </div>
    `

    const result = extractWechatArticleFromDocument(document, {
      pageUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=100000028',
    }) as any

    expect(result.wechatArticleCards).toEqual([])
    expect(result.richContentHtml).not.toContain('data-wechat-card-slot=')
    expect(result.richContentHtml).toContain('<table>')
    expect(result.richContentHtml).toContain('这是一个复杂内容块')
  })
})
